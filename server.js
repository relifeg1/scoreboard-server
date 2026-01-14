const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const cors = require("cors");
const path = require('path');
const axios = require('axios');

app.use(cors());
app.use(express.json());

// 🔴 رابط قاعدة البيانات
const DB_URL = "https://jsonblob.com/api/jsonBlob/019bbd06-de27-7fe5-8fb5-8ff7e9d5563a";

let db = {
    activeMode: "1v1",
    modes: {
        "1v1": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "2v2": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "3v3": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 },
        "4v4": { win: 0, loss: 0, rec_win: 0, rec_loss: 0 }
    }
};

async function loadScores() {
    try {
        const res = await axios.get(DB_URL);
        if (res.data && res.data.modes) db = res.data;
    } catch (e) { console.error("Error loading DB"); }
}
loadScores();

async function saveScores() { try { await axios.put(DB_URL, db); } catch (e) {} }

let settings = {
    winText: "WIN", lossText: "LOSS", winColor: "#00FFFF", lossColor: "#FF0055",
    bgColor: "#000000", labelColor: "#CCCCCC", numColor: "#FFFFFF",
    width: 200, height: 50, gap: 15, fontFamily: "'Cairo', sans-serif",
    labelSize: 30, numSize: 35, layout: "row", borderWidth: 4, borderRadius: 6, shadowOpacity: 0.5
};

// دالة مساعدة لإنشاء المؤشرات (Indicators)
function getResponseData(eventType) {
    const current = db.modes[db.activeMode];
    
    // هنا السحر: نرسل علامة خاصة للطور المفعل
    const indicators = {
        "i_1v1": db.activeMode === "1v1" ? "🟢 1v1" : "1v1", // إذا مفعل يضع دائرة خضراء
        "i_2v2": db.activeMode === "2v2" ? "🟢 2v2" : "2v2",
        "i_3v3": db.activeMode === "3v3" ? "🟢 3v3" : "3v3",
        "i_4v4": db.activeMode === "4v4" ? "🟢 4v4" : "4v4"
    };

    return { ...current, mode: db.activeMode, indicators: indicators, event: eventType };
}

io.on("connection", (socket) => {
    socket.emit("update_scores", getResponseData("sync"));
    socket.emit("update_settings", settings);
    socket.on("save_settings", (newSettings) => { settings = newSettings; io.emit("update_settings", settings); });
});

app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, '/admin.html')); });

app.get("/api/set", (req, res) => {
    const action = req.query.action;
    let eventType = "update";
    
    let current = db.modes[db.activeMode];

    if (action.startsWith("set_mode_")) {
        const newMode = action.replace("set_mode_", "");
        if (db.modes[newMode]) { db.activeMode = newMode; eventType = "mode_change"; }
    }
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

    const responseData = getResponseData(eventType);
    io.emit("update_scores", responseData);
    res.json(responseData);
});

app.get("/api/get", (req, res) => { res.json(getResponseData("sync")); });

const port = process.env.PORT || 3000;
http.listen(port, () => { console.log("Server running on port " + port); });
