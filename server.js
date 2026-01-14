const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const cors = require("cors");
const path = require('path');
const axios = require('axios');

app.use(cors());
app.use(express.json());

// ==========================================
// 🔴 رابط قاعدة البيانات (تأكد أنه صحيح)
const DB_URL = "https://jsonblob.com/api/jsonBlob/019bbd06-de27-7fe5-8fb5-8ff7e9d5563a";
// ==========================================

// الهيكل الجديد للبيانات (4 أطوار)
let db = {
    activeMode: "1v1", // الطور الحالي
    modes: {
        "1v1": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "2v2": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "3v3": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "4v4": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 }
    }
};

// تحميل البيانات
async function loadScores() {
    try {
        const res = await axios.get(DB_URL);
        if (res.data && res.data.modes) {
            db = res.data;
            console.log("✅ DB Loaded. Active Mode:", db.activeMode);
        } else {
            // تهيئة أولية إذا كانت الداتا قديمة
            saveScores();
        }
    } catch (e) { console.error("Error loading DB"); }
}
loadScores();

async function saveScores() {
    try { await axios.put(DB_URL, db); } catch (e) { console.error("Error saving DB"); }
}

// الإعدادات (الشكل)
let settings = {
    winText: "WIN", lossText: "LOSS",
    winColor: "#00FFFF", lossColor: "#FF0055",
    bgColor: "#000000", labelColor: "#CCCCCC", numColor: "#FFFFFF",
    width: 200, height: 50, gap: 15,
    fontFamily: "'Cairo', sans-serif",
    labelSize: 30, numSize: 35,
    layout: "row", borderWidth: 4, borderRadius: 6, shadowOpacity: 0.5
};

io.on("connection", (socket) => {
    // نرسل للمتصل بيانات الطور الحالي فقط
    emitUpdate(socket);
    socket.emit("update_settings", settings);
    socket.on("save_settings", (newSettings) => {
        settings = newSettings;
        io.emit("update_settings", settings);
    });
});

// دالة مساعدة لإرسال البيانات الصحيحة
function emitUpdate(socket = io) {
    const currentData = db.modes[db.activeMode];
    // نرسل البيانات + اسم الطور الحالي
    socket.emit("update_scores", { 
        ...currentData, 
        mode: db.activeMode, 
        event: "sync" 
    });
}

app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, '/admin.html')); });

app.get("/api/set", (req, res) => {
    const action = req.query.action;
    let eventType = "update";
    
    // نحدد أي بيانات نعدل عليها بناءً على الطور النشط
    let current = db.modes[db.activeMode];

    // 1. تغيير الطور (Game Mode Switch)
    if (action.startsWith("set_mode_")) {
        const newMode = action.replace("set_mode_", ""); // e.g., 2v2
        if (db.modes[newMode]) {
            db.activeMode = newMode;
            eventType = "mode_change"; // حدث خاص لتغيير الطور
        }
    }
    // 2. تعديل النتائج (يعدل الطور النشط فقط)
    else if (action === "win_inc") {
        current.win++;
        if (current.win > current.rec_win) { current.rec_win = current.win; eventType = "win_record"; }
    } 
    else if (action === "win_dec") current.win = Math.max(0, current.win - 1);
    else if (action === "loss_inc") {
        current.loss++;
        if (current.loss > current.rec_loss) { current.rec_loss = current.loss; eventType = "loss_record"; }
    }
    else if (action === "loss_dec") current.loss = Math.max(0, current.loss - 1);
    else if (action === "reset") { current.win = 0; current.loss = 0; eventType = "reset"; }
    else if (action === "reset_records") { current.rec_win = 0; current.rec_loss = 0; eventType = "update"; }

    saveScores();

    // نرسل التحديث للجميع (OBS + StreamDeck)
    // نرسل بيانات الطور النشط حالياً
    io.emit("update_scores", { 
        ...db.modes[db.activeMode], 
        mode: db.activeMode, 
        event: eventType 
    });
    
    // رد للستريم ديك (نعطيه بيانات الطور النشط)
    res.json({ ...db.modes[db.activeMode], activeMode: db.activeMode });
});

// قراءة البيانات (يعيد بيانات الطور النشط)
app.get("/api/get", (req, res) => { 
    res.json({ ...db.modes[db.activeMode], activeMode: db.activeMode }); 
});

const port = process.env.PORT || 3000;
http.listen(port, () => { console.log("Server running on port " + port); });
