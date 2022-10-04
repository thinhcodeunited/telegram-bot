module.exports = {
    apps: [
        {
            name: "Telegram-bot",
            script: "./index.js",
            watch: false,
            ignore_watch: ["./media/screenshot.png",  "./media/screenshot2.png"]
        }
    ]
}