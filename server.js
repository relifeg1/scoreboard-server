const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const cors = require("cors");
const path = require('path');
const axios = require('axios');

app.use(cors());
app.use(express.json());

// ==================================================================
// 🟢 رابط قاعدة البيانات الخاص بك (تمت إضافته) 🟢
// ==================================================================
const DB_URL = "https://jsonblob.com/api/jsonBlob/019bbd06-de27-7fe5-8fb5-8ff7e9d5563a";
// ==================================================================

// متغير لتخزين النتائج مؤقتاً
let scores = { win: 0, loss: 0, rec_win: 0, rec_loss: 0 };

// دالة لجلب البيانات المحفوظة عند تشغيل السيرفر
async function loadScores() {
    try {
        const res = await axios.get(DB_URL);
        // نتأكد أن البيانات موجودة وصحيحة قبل اعتمادها
        if (res.data && typeof res.data === 'object') {
            scores = { ...scores, ...res.data }; // دمج البيانات لضمان عدم فقدان الحقول
            console.log("✅ Database Loaded Successfully:", scores);
        }
    } catch (e) {
        console.error("❌ Error loading DB (Using default 0):", e.message);
    }
}

// تحميل البيانات فوراً عند بدء التشغيل
loadScores();

// دالة لحفظ البيانات (يتم استدعاؤها عند كل تغيير)
async function saveScores() {
    try {
        await axios.put(DB_URL, scores);
        console.log("💾 Database Saved.");
    } catch (e) {
        console.error("❌ Error saving DB:", e.message);
    }
}

// إعدادات التصميم الافتراضية
let settings = {
    winText: "WIN", lossText: "LOSS",
    winColor: "#00FFFF", lossColor: "#FF0055",
    bgColor: "#000000", labelColor: "#CCCCCC", numColor: "#FFFFFF",
    width: 200, height: 50, gap: 15,
    fontFamily: "'Cairo', sans-serif",
    labelSize: 30, numSize: 35,
    layout: "row",
    borderWidth: 4, borderRadius: 6, shadowOpacity: 0.5
};

// إعدادات الاتصال (Socket.io)
io.on("connection", (socket) => {
    // إرسال أحدث البيانات للمتصل
    socket.emit("update_scores", { ...scores, event: "sync" });
    socket.emit("update_settings", settings);

    // استقبال تعديلات التصميم من لوحة التحكم
    socket.on("save_settings", (newSettings) => {
        settings = newSettings;
        io.emit("update_settings", settings);
    });
});

// توجيه لوحة التحكم
app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, '/admin.html')); });

// API التحكم (للستريم ديك وغيره)
app.get("/api/set", (req, res) => {
    const action = req.query.action;
    let eventType = "update";

    if (action === "win_inc") {
        scores.win++;
        // التحقق من الرقم القياسي للفوز
        if (scores.win > scores.rec_win) { 
            scores.rec_win = scores.win; 
            eventType = "win_record"; 
        }
    } 
    else if (action === "win_dec") scores.win = Math.max(0, scores.win - 1);
    else if (action === "loss_inc") {
        scores.loss++;
        // التحقق من الرقم القياسي للخسارة
        if (scores.loss > scores.rec_loss) { 
            scores.rec_loss = scores.loss; 
            eventType = "loss_record"; 
        }
    }
    else if (action === "loss_dec") scores.loss = Math.max(0, scores.loss - 1);
    
    // أوامر التصفير
    else if (action === "reset") { 
        scores.win = 0; 
        scores.loss = 0; 
        eventType = "reset"; 
    }
    else if (action === "reset_records") { 
        scores.rec_win = 0; 
        scores.rec_loss = 0; 
        eventType = "update"; 
    }

    // 🔥 حفظ التغييرات في قاعدة البيانات فوراً
    saveScores();

    // إرسال التحديث لجميع المتصلين
    io.emit("update_scores", { ...scores, event: eventType });
    
    // الرد على الطلب
    res.json(scores);
});

// API لقراءة البيانات فقط
app.get("/api/get", (req, res) => { res.json(scores); });

// تشغيل السيرفر
const port = process.env.PORT || 3000;
http.listen(port, () => { console.log("Server running on port " + port); });
