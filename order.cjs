const OrderModel = require('./database/order.db.cjs');
const MenuModel = require('./database/menu.cjs');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const moment = require('moment');
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const { similarity } = require('./helper/similarity.cjs');

// SCAN DOCUMENT
const sheet_id = process.env.SHEET_ID;

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const removeAccents = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const arrayUnique = (array) => {
  let a = array.concat();
  for(let i=0; i<a.length; ++i) {
      for(let j=i+1; j<a.length; ++j) {
          if(a[i] === a[j])
              a.splice(j--, 1);
      }
  }

  return a;
}

class AutomaticOrder {
  static #instance;


  constructor() {
  }

  static get instance() {
    if (!this.#instance) {
      this.#instance = new this();
    }

    return this.#instance;
  }

  #groupByDayOfWeek(xs, key) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x.set);
      return rv;
    }, {});
  };

  #filter_name(name_string) {
    name_string = removeAccents(name_string);
    name_string = name_string.toLowerCase();
    const list_name = name_string.split(/[!@#$%^&*()-_,.\s]/);
    return list_name.filter(el => el != '');
  }

  #filter_mon_an(mon_an_string) {
    mon_an_string = mon_an_string.toLowerCase();
    const list_name = mon_an_string.split(/[+]/);
    const list_filter = list_name.filter(el => el != '');
    return arrayUnique(list_filter.map(lf => lf.trim()));
  }

  async #filter_mon_an_in_past(name_string) {
    const listMenus = await MenuModel.find();
    const field_name = this.#filter_name(name_string);

    const list_menu_return = [];
    for (let menu of listMenus) {
      let name_in_menu = (menu.name) ? menu.name : 'n/a';
      const field_name_in_menu = this.#filter_name(name_in_menu);

      const intersection = field_name_in_menu.filter(element => field_name.includes(element));

      if (intersection.length < 1) continue;

      list_menu_return.push(menu.set);
    }

    if (list_menu_return.length < 1) return [];

    let return_data = '';
    list_menu_return.forEach(lmr => {
      return_data += lmr + '+';
    })

    return this.#filter_mon_an(return_data);
  }

  async #filter_mon_an_today() {
    try {
      const auth = await authorize();
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheet_id,
        range: `menu!A1:M`,
      });

      const rows = res.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data sheet found');
        return null;
      }

      let arr_cac_mon = [];
      for (let row of rows) {
        if (row.length < 1) continue;

        for (let i = 0; i < row.length; i++) {
          if (['1', '2', '3', '4', '5', '6'].includes(row[i])) {
            arr_cac_mon.push(row);
          }
        }
      }

      let list_theo_danh_muc;
      const mon_chinh1 = [];
      const mon_chinh2 = [];
      const mon_phu = [];
      const rau = [];
      const canh = [];
      // Lọc theo loại món
      for (const cac_mon of arr_cac_mon) {
        const filtered = cac_mon.filter(el => !['', '1', '2', '3', '4', '5', '6'].includes(el));

        if (filtered[0]) {
          mon_chinh1.push(filtered[0])
        }

        if (filtered[1]) {
          mon_chinh2.push(filtered[1])
        }

        if (filtered[2]) {
          mon_phu.push(filtered[2])
        }

        if (filtered[3]) {
          rau.push(filtered[3])
        }

        if (filtered[4]) {
          canh.push(filtered[4])
        }
      }

      list_theo_danh_muc = {
        mon_chinh1,
        mon_chinh2,
        mon_phu,
        rau,
        canh
      }

      return list_theo_danh_muc;
    } catch (error) {
      return null;
    }
  }

  #lay_mon_an(danh_sach_mon_an_today, mon_an_inpast) {
    if (danh_sach_mon_an_today.length < 1) return null;
    if (mon_an_inpast.length < 1) return null;

    const list_mon_an_da_log = [];
    danh_sach_mon_an_today.forEach(m_today => {
      mon_an_inpast.forEach(mp => {
        const matches = similarity(mp, m_today);
        list_mon_an_da_log.push({
          past: mp,
          now: m_today,
          match: matches
        })
      })
    });

    if (list_mon_an_da_log.length < 1) return null;

    // First, get the max vote from the array of objects
    const maxMatch = Math.max(...list_mon_an_da_log.map(e => e.match));
    const obj = list_mon_an_da_log.find(el => el.match === maxMatch);

    return (obj && obj.now) ? obj.now : null;
  }

  #maping_mon_an(mon_an_inpast, mon_an_today) {
    if (!mon_an_today) return null;

    // Tìm món chính
    const list_mon_chinh1 = (mon_an_today.mon_chinh1) ? mon_an_today.mon_chinh1 : [];
    let mon_chinh1 = null;
    if (list_mon_chinh1.length > 0) {
      mon_chinh1 = this.#lay_mon_an(list_mon_chinh1, mon_an_inpast);
      if (!mon_chinh1) {
        mon_chinh1 = list_mon_chinh1[Math.floor(Math.random() * list_mon_chinh1.length)];
      }
    }

    const list_mon_chinh2 = mon_an_today.mon_chinh2;
    let mon_chinh2 = null;
    if (list_mon_chinh2.length > 0) {
      mon_chinh2 = this.#lay_mon_an(list_mon_chinh2, mon_an_inpast);
      if (!mon_chinh2) {
        mon_chinh2 = list_mon_chinh2[Math.floor(Math.random() * list_mon_chinh2.length)];
      }
    }


    const list_mon_phu = mon_an_today.mon_phu;
    let mon_phu = null;
    if (list_mon_phu.length > 0) {
      mon_phu = this.#lay_mon_an(list_mon_phu, mon_an_inpast);
      if (!mon_phu) {
        mon_phu = list_mon_phu[Math.floor(Math.random() * list_mon_phu.length)];
      }
    }


    const list_rau = mon_an_today.rau;
    let rau = null;
    if (list_rau.length > 0) {
      rau = this.#lay_mon_an(list_rau, mon_an_inpast);
      if (!rau) {
        rau = list_rau[Math.floor(Math.random() * list_rau.length)];
      }
    }


    const list_canh = mon_an_today.canh;
    let canh = null;
    if (list_canh.length > 0) {
      canh = this.#lay_mon_an(list_canh, mon_an_inpast);
      if (!canh) {
        canh = list_canh[Math.floor(Math.random() * list_canh.length)];
      }
    }

    if (!mon_chinh1 && !mon_chinh2 && !mon_phu && !canh && !rau) return null;

    return (mon_chinh1 ? mon_chinh1 : '') + ' + ' + (mon_chinh2 ? mon_chinh2 : '') + ' + ' + (mon_phu ? mon_phu : '') + ' + ' + (canh ? canh : '') + ' + ' + (rau ? rau : '');
  }

  async #calculate(order, list_mon_an_today) {
    let name = (order.name) ? order.name : 'n/a';

    let list_mon_an_hay_an = await this.#filter_mon_an_in_past(name);

    const mon_an_now = this.#maping_mon_an(list_mon_an_hay_an, list_mon_an_today);

    return {
      field_name : this.#filter_name(name),
      name,
      order: mon_an_now,
      price: 35000,
      count: 1
    }
  }

  async exec() {
    try {
      const listOrder = await OrderModel.find();
      if (listOrder.length < 1) return false;

      const list_mon_an_today = await this.#filter_mon_an_today();

      // Phân tích tên người đặt
      for (let i = 0; i < listOrder.length; i++) {
        const cal = await this.#calculate(listOrder[i], list_mon_an_today);
        if (!cal.order) continue;

        await this.#write_order_document(cal);
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async #write_order_document(order) {
    try {
      const auth = await authorize();
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheet_id,
        range: `B1:B100`,
      });

      const rows = res.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data sheet found');
        return false;
      }

      let check_duplicate_name = false;
      for(const row of rows) {
        if (row[0] === order.name) {
          check_duplicate_name = true;
        }
      }

      if (check_duplicate_name) return true;

      const name_range = "B" + (rows.length + 1);
      await this.#sheet_update_document(name_range, order.name);

      const set_range = "C" + (rows.length + 1);
      await this.#sheet_update_document(set_range, order.order);

      const price_range = "E" + (rows.length + 1);
      await this.#sheet_update_document(price_range, order.price);

      const count_range = "F" + (rows.length + 1);
      await this.#sheet_update_document(count_range, order.count);

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async #sheet_update_document(range, value) {
    try {
      const auth = await authorize();
      const sheets = google.sheets({ version: 'v4', auth });
      const request = {
        spreadsheetId: sheet_id,
        resource: {
          valueInputOption: 'RAW',
          data: [{
            "range": range,
            "values": [
              [
                value
              ]
            ]
          }],
        },
        auth
      };

      const response = (await sheets.spreadsheets.values.batchUpdate(request)).data;
      // TODO: Change code below to process the `response` object:
      // console.log(JSON.stringify(response, null, 2));

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = AutomaticOrder.instance;