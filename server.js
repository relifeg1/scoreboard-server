const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const cors = require("cors");
const path = require('path');

app.use(cors());
app.use(express.json());

// 1. بيانات النتائج
let scores = { win: 0, loss: 0, rec_win: 0, rec_loss: 0 };

// 2. إعدادات التصميم الافتراضية
let settings = {
    winText: "WIN", lossText: "LOSS",
    winColor: "#00FFFF", lossColor: "#FF0055",
    bgColor: "#000000", labelColor: "#CCCCCC", numColor: "#FFFFFF",
    width: 200, height: 50, gap: 15,
    fontFamily: "'Cairo', sans-serif",
    labelSize: 30, numSize: 35,
    layout: "row"
};

// عند اتصال OBS أو لوحة التحكم
io.on("connection", (socket) => {
    // إرسال البيانات الحالية فور الاتصال
    socket.emit("update_scores", { ...scores, event: "sync" });
    socket.emit("update_settings", settings);

    // استقبال الإعدادات الجديدة من لوحة التحكم
    socket.on("save_settings", (newSettings) => {
        settings = newSettings;
        io.emit("update_settings", settings); // تعميم التغيير للكل
    });
});

// صفحة لوحة التحكم
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, '/admin.html'));
});

// API للستريم ديك
app.get("/api/set", (req, res) => {
    const action = req.query.action;
    let eventType = "update";

    if (action === "win_inc") {
        scores.win++;
        if (scores.win > scores.rec_win) { scores.rec_win = scores.win; eventType = "win_record"; }
    } 
    else if (action === "win_dec") scores.win = Math.max(0, scores.win - 1);
    else if (action === "loss_inc") {
        scores.loss++;
        if (scores.loss > scores.rec_loss) { scores.rec_loss = scores.loss; eventType = "loss_record"; }
    }
    else if (action === "loss_dec") scores.loss = Math.max(0, scores.loss - 1);
    else if (action === "reset") { scores.win = 0; scores.loss = 0; eventType = "reset"; }

    io.emit("update_scores", { ...scores, event: eventType });
    res.json(scores);
});

app.get("/api/get", (req, res) => { res.json(scores); });

const port = process.env.PORT || 3000;
http.listen(port, () => { console.log("Server running on port " + port); });
