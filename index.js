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
const moment = require('moment');
const token = process.env.TELEGRAM_BOT_TOKEN;

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
  schedule.scheduleJob("*/10 * * * *", async function () {
    console.log('Crawl now...');
    await Promise.all(items.map(([url, filename, options]) => {
      return captureWebsite.file(url, path.join(__dirname, `/media/${filename}.png`), options);
    }));
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

  bot.sendMessage(chatId, 'Hi mọi người, bây giờ em sẽ lấy thực đơn. Mọi người đợi em một chút nhé 😉');

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

    bot.sendMessage(chatId, 'Chúc anh chị ngon miệng nhé 😘');
    bot.sendMessage(chatId, 'Anh chị có thể order cơm tại đây nhé 😘https://docs.google.com/spreadsheets/d/1r95ZSdSFjHoVt2BiD9IPwXTC3vUCg5zBbdFpjGhXAXs/edit?usp=sharing');

  } catch (error) {
    console.log(error);
    bot.sendMessage(chatId, 'Sorry mọi người. Hiện tại em chưa lấy được thực đơn, anh chị vui lòng thử lại sau ít phút nhé 😋');
  }
}

const start_job = (time, chatId) => {
  console.log('Set job to alarm');
  schedule.scheduleJob(time, function () {
    console.log('Schedule job starting...');
    get_menu(chatId);
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

  const content = `Phiên bản hiện tại là ${version}
Các thay đổi trong phiên bản này:
${changelog_text}
Anh chị có thể sử dụng các lệnh sau đây:
/menu - Xem thực đơn ngày hôm nay 
/alarm - Đặt lịch thông báo thực đơn`;

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
          text: "9.10 AM",
          callback_data: '9h10'
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

  let time;
  switch (action) {
    case '9h10':
      time = { hour: 9, minute: 10, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    case '9h15':
      time = { hour: 9, minute: 15, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    case '9h30':
      time = { hour: 9, minute: 30, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
    default:
      time = { hour: 9, minute: 0, dayOfWeek: [1, 2, 3, 4, 5] };
      break;
  }
  console.log(time);
  const content = `Em sẽ đặt lịch lấy thực đơn ngay bây giờ.
Cám ơn mọi người đã tin tưởng vào iêm 😘`;

  bot.editMessageText(content, opts);
  start_job(time, chatId)
});

console.log('Telegram bot started');
crawl_menu();