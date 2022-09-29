module.exports = {
    apps: [
        {
            name: "Telegram-bot",
            script: "./index.js",
            watch: false,
            ignore_watch: ["screenshot.png",  "screenshot2.png"]
        }
    ]
}