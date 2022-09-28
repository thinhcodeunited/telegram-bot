import captureWebsite from 'capture-website';
import { createRequire } from "module";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
require('dotenv').config();
process.env["NTBA_FIX_350"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const schedule = require('node-schedule');
const token = process.env.TELEGRAM_BOT_TOKEN;
const schedule_time = {hour: 6, minute: 30, dayOfWeek: [1,2,3,4,5]}; // 6h30 from monday to friday
const capture_opts = {
  clip: {
    x: 46,
    y: 152,
    width: 1083,
    height: 628
  },
  overwrite: true,
  width: 1920,
  height: 1000,
  timeout: 0
}
const items = [
  ['https://sindresorhus.com', 'screenshot', capture_opts],
  ['https://www.google.com/search?q=Masterchef&rlz=1C1ONGR_enVN991VN991&sxsrf=ALiCzsZvpUwa2emcQ7fNb3A_Ag0tqRW1NQ%3A1664393429385&ei=1aA0Y62QF5iSseMPpZ29qA0&ved=0ahUKEwjtzv_YnLj6AhUYSWwGHaVOD9UQ4dUDCA4&uact=5&oq=Masterchef&gs_lcp=Cgdnd3Mtd2l6EAMyBQguEMsBMggILhDUAhDLATIFCAAQywEyBQgAEMsBMggILhDUAhDLATIFCAAQywEyBQgAEMsBMggILhDUAhDLATIFCC4QywEyBQgAEMsBOgYIABAeEAdKBAhBGABKBAhGGABQAFgAYN8MaABwAXgAgAFriAHIAZIBAzEuMZgBAKABAcABAQ&sclient=gws-wiz', 'screenshot2', capture_opts]
];
let job;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

const get_menu = async (chatId) => {
  try {
    await Promise.all(items.map(([url, filename, options]) => {
      return captureWebsite.file(url, `${filename}.png`, options);
    }));

    setTimeout(() => {
      let params = [
        {
          'type': 'photo',
          'media': path.join(__dirname, '/screenshot.png'),
        },
        {
          'type': 'photo',
          'media': path.join(__dirname, '/screenshot2.png')
        }
      ]

      bot.sendMediaGroup(chatId, params).catch((error) => {
        console.log(error.response.body); // => { ok: false, error_code: 400, description: 'Bad Request: chat not found' }
        bot.sendMessage(chatId, 'Sorry mọi người, hôm nay không có thực đơn nha 🥲');
      });
    }, 1000 * 15);
  } catch(error) {
    console.log(error);
    bot.sendMessage(chatId, 'Sorry mọi người, hôm nay không có thực đơn nha 🥲');
  }
}

const start_job = (chatId) => {
  console.log('Schedule job starting...');
  job = schedule.scheduleJob(schedule_time, async function () {
      console.log(chatId)
      get_menu(chatId);
  });
}


bot.onText(/\/start (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  if (resp === 'thucdon') {
    bot.sendMessage(chatId, 'Hi mọi người, bây giờ em sẽ lấy thực đơn. Mọi người đợi em một chút nhé 😉');
    get_menu(chatId);
    start_job(chatId);
  }
});


bot.onText(/\/stop (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  if (resp === 'thucdon') {
    bot.sendMessage(chatId, 'Cám ơn mọi người đã tin tưởng vào iêm 😘');
    job.cancel();
  }
});

console.log('Telegram bot starting...');