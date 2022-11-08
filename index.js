import captureWebsite from 'capture-website';
import { createRequire } from "module";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
require('dotenv').config();
require('./database/connect.cjs');
process.env["NTBA_FIX_350"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const schedule = require('node-schedule');
const moment = require('moment');
const token = process.env.TELEGRAM_BOT_TOKEN;
const { scan, clean, test_sheet } = require('./google_sheets_api.cjs');
const { google } = require('googleapis');
const tesseract = require("node-tesseract-ocr");
const OrderModel = require('./database/order.db.cjs');
const AutomaticOrder = require('./order.cjs');

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

const crawl_menu = () => {
  const capture_opts1 = {
    clip: {
      x: 156,
      y: 156,
      width: 1289,
      height: 260
    },
    overwrite: true,
    width: 1920,
    height: 1000,
    timeout: 0
  }

  const capture_opts2 = {
    clip: {
      x: 255,
      y: 520,
      width: 710,
      height: 410
    },
    overwrite: true,
    width: 1920,
    height: 1000,
    timeout: 0
  }
  const items = [
    ['https://docs.google.com/spreadsheets/d/1r95ZSdSFjHoVt2BiD9IPwXTC3vUCg5zBbdFpjGhXAXs/edit?usp=sharing#gid=501707920', 'screenshot', capture_opts1],
    ['https://docs.google.com/spreadsheets/d/1r95ZSdSFjHoVt2BiD9IPwXTC3vUCg5zBbdFpjGhXAXs/edit?usp=sharing#gid=501707920', 'screenshot2', capture_opts2]
  ];

  console.log('Start crawl media');
  schedule.scheduleJob("*/5 * * * *", async function () {
    console.log('Crawl now...');
    await Promise.all(items.map(([url, filename, options]) => {
      return captureWebsite.file(url, path.join(__dirname, `/media/${filename}.png`), options);
    }));
  });
}

const clean_document_schedule = () => {
  console.log('Start clean document');
  // Start on 6h00 sáng
  schedule.scheduleJob({ hour: 6, minute: 0, dayOfWeek: [1, 2, 3, 4, 5] }, async function () {
    console.log('Clean now...');
    scan();
    clean();
  });
}

const get_answer_outtime = () => {
  const reply = [
    "Em lên chuồng đi ngủ rồi nha, hẹn anh chị ngày mai ạ 😉",
    "Trời ơi, béo lắm rồi order chi nữa, hẹn anh chị ngày mai nha 😆",
    "Đã quá giờ cơm trưa rồi nha anh chị ơi 😊",
  ];
  const index = Math.floor(Math.random() * reply.length);
  return reply[index];
}

const get_menu = async (chatId) => {
  const format = 'hh:mm:ss'
  const time = moment(moment(), format);
  const beforeTime = moment('07:00:00', format);
  const afterTime = moment('18:00:00', format);

  if (!time.isBetween(beforeTime, afterTime)) {
    const content = get_answer_outtime();
    bot.sendMessage(chatId, content);
    return;
  }

  try {
    let params = [
      {
        'type': 'photo',
        'media': path.join(__dirname, '/media/screenshot.png'),
      },
      {
        'type': 'photo',
        'media': path.join(__dirname, '/media/screenshot2.png')
      }
    ]

    bot.sendMediaGroup(chatId, params).catch((error) => {
      console.log(error.response.body); // => { ok: false, error_code: 400, description: 'Bad Request: chat not found' }
      bot.sendMessage(chatId, 'Sorry mọi người. Hiện tại em chưa lấy được thực đơn, anh chị vui lòng thử lại sau ít phút nhé 😋');
    });

    bot.sendMessage(chatId, 'Anh chị có thể order cơm tại đây nhé 😘https://docs.google.com/spreadsheets/d/1r95ZSdSFjHoVt2BiD9IPwXTC3vUCg5zBbdFpjGhXAXs/edit?usp=sharing');
    bot.sendMessage(chatId, 'Chúc anh chị ngon miệng nhé 😘');
  } catch (error) {
    console.log(error);
    bot.sendMessage(chatId, 'Sorry mọi người. Hiện tại em chưa lấy được thực đơn, anh chị vui lòng thử lại sau ít phút nhé 😋');
  }
}

const check_new_menu = async () => {
  const orc_config = {
    lang: "eng",
    oem: 1,
    psm: 3,
  }

  try {
    const text = await tesseract.recognize("./media/screenshot.png", orc_config);

    const text_splited = text.split(/\s/);
    let result = false;
    text_splited.forEach(ts => {
      let moment_time = moment(ts, ["DD/MM/YYYY"], true);
      if (moment_time.isValid() && moment_time.isSame(moment(), "day")) {
        result = true;
      }
    });

    return result;
  } catch (error) {
    console.log(error.message);
    return false;
  }
}

const setCronTimeOut = (chatId) => {
  // Chúng ta sẽ kiểm tra 1 phút / 1 lần xem ảnh đã cập nhật hay chưa?
  setTimeout(async () => {
    const check_menu = await check_new_menu();
    if (check_menu) {
      console.log("Well done, to close today timeout");
      get_menu(chatId);

      // Tự động đặt đổ ăn
      AutomaticOrder.exec();
    } else {
      console.log("Not found new menu, waiting crawl menu..");
      setCronTimeOut(chatId);
    }
  }, 30000);
}

const start_job = (time, chatId) => {
  console.log('Set job to alarm');
  schedule.scheduleJob(time, function () {
    console.log('Schedule job starting...');
    // Thay vì lấy thẳng data trả về, check ảnh trước
    setCronTimeOut(chatId);
  });
}

bot.onText(/\/help/, (msg, match) => {
  const chatId = msg.chat.id;

  let changelog = require('./changelog.json');
  const version = changelog.version;

  let changelog_text = '';
  changelog.log[version].forEach(cl => {
    changelog_text += '- ' + cl + '\n';
  });

  const content = `Phiên bản siêu đầu bếp Vision version ${version}
Các thay đổi trong phiên bản này:
${changelog_text}
Anh chị có thể sử dụng các lệnh sau đây:
/menu - Xem thực đơn ngày hôm nay 
/alarm - Đặt lịch thông báo thực đơn
/order [tên] - Sử dụng dịch vụ tự động đặt cơm
/stop_order - Dừng sử dụng dịch vụ tự động đăt cơm
`;

  bot.sendMessage(chatId, content);
});

bot.onText(/\/menu/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  get_menu(chatId);
});

bot.onText(/\/alarm/, (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Anh chị vui lòng chọn thời gian để em đặt lịch", {
    reply_markup: {
      inline_keyboard: [
        [{
          text: "9.00 AM",
          callback_data: '9h'
        },
        {
          text: "9.15 AM",
          callback_data: '9h15'
        },
        {
          text: "9.30 AM",
          callback_data: '9h30'
        }]
      ]
    }
  })
});

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const opts = {
    chat_id: chatId,
    message_id: msg.message_id,
  };

  if (msg.text !== 'Anh chị vui lòng chọn thời gian để em đặt lịch') return;

  let time, text;
  switch (action) {
    case '9h':
      text = '9 giờ';
      time = { hour: 9, minute: 0, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    case '9h15':
      text = '9 giờ 15 phút';
      time = { hour: 9, minute: 15, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    case '9h30':
      text = '9 giờ 30 phút';
      time = { hour: 9, minute: 30, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    default:
      text = '9 giờ 00 phút';
      time = { hour: 9, minute: 0, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
  }
  console.log(time);
  const content = `Em đã đặt lịch lấy thực đơn vào lúc ${text} hằng ngày
Cám ơn mọi người đã tin tưởng vào iêm 😘`;

  bot.editMessageText(content, opts);
  start_job(time, chatId)
});

bot.onText(/\/test_orc/, async (msg, match) => {
  const chatId = msg.chat.id;
  const check = await check_new_menu();
  bot.sendMessage(chatId, "Check ORC successfully, result is " + check);
});

bot.onText(/\/test_sheet/, async(msg, match) => {
  await scan();
  await clean();
});

bot.onText(/\/test_order/, async (msg, match) => {
  await AutomaticOrder.exec()
});

bot.onText(/\/hillo_my_bot/, async (msg, match) => {
  const chatId = msg.chat.id;
  const check = await check_new_menu();
  bot.sendMessage(chatId, "Hế'sờ lô anh chị, lại là em đây, em được hồi sinh rồi 😘");
});

/////////////////////////ORDER/////////////////////////////////////////
bot.onText(/\/order(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  const findOrder = await OrderModel.findOne({name : resp});
  if (findOrder) {
    bot.sendMessage(chatId, `Người này đã sử dụng dịch vụ tự động đặt cơm!`);
    return;
  }
  // Lưu vào DB 
  await OrderModel.create({ name: resp, chat_id: chatId });

  bot.sendMessage(chatId, `Cám ơn. "${resp}" đã đăng ký sử dụng dịch vụ tự động đặt cơm`);
});

bot.onText(/\/stop_order/, async (msg, match) => {
  const chatId = msg.chat.id;

  const listOrder = await OrderModel.find();
  if (listOrder.length < 1) {
    bot.sendMessage(chatId, "Hiện tại chưa có ai dùng dịch vụ tự động đặt cơm.");
    return;
  }

  const inline_keyboard = [];
  listOrder.forEach(lo => {
    inline_keyboard.push({
      text: lo.name,
      callback_data: lo._id.toString()
    })
  })

  bot.sendMessage(chatId, "Anh/chị muốn dừng dịch vụ tự động đặt cơm cho ai?", {
    reply_markup: {
      inline_keyboard: [inline_keyboard]
    }
  });

  bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const order_id = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const opts = {
      chat_id: chatId,
      message_id: msg.message_id,
    };

    if (msg.text !== 'Anh/chị muốn dừng dịch vụ tự động đặt cơm cho ai?') return;

    const findOrder = await OrderModel.findById(order_id);
    if (!findOrder) {
      bot.editMessageText("Người này chưa sử dụng dịch vụ!", opts);
    }

    await OrderModel.findByIdAndRemove(order_id);
    bot.editMessageText(`"${findOrder.name}" đã ngưng sử dụng dịch vụ tự động đặt cơm`, opts);
  });
});

console.log('Telegram bot started');
clean_document_schedule();
crawl_menu();