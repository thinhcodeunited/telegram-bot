# telegram-bot (Bot chat in instagram)
Con bot vô dụng dùng để crawl thực đơn hằng ngày

## Usage
First, you need to install the Tesseract project. Instructions for installing Tesseract for all platforms can be found on <a href="https://github.com/tesseract-ocr/tessdoc/blob/master/Installation.md">the project site</a>. On Debian/Ubuntu:
```sh
apt-get install tesseract-ocr
```

Install the modules package with [NPM](https://www.npmjs.org/):

```sh
npm install
```

Run project with [PM2](https://pm2.keymetrics.io/):

```sh
pm2 start ecosystem.config.cjs
```
