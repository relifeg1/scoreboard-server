const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { 
    cors: { origin: "*" } 
});
const cors = require("cors");

app.use(cors());
app.use(express.json());

// قاعدة البيانات المؤقتة
let db = {
  win: 0,
  loss: 0,
  rec_win: 0,
  rec_loss: 0
};

// عند اتصال OBS (Socket.io)
io.on("connection", (socket) => {
  console.log("OBS Connected");
  socket.emit("update", { ...db, event: "sync" });
});

// روابط التحكم (API) لصديقك والستريم ديك
app.get("/api/set", (req, res) => {
  const action = req.query.action;
  let eventType = "update"; // افتراضي

  if (action === "win_inc") {
    db.win++;
    // منطق كسر الرقم القياسي للفوز
    if (db.win > db.rec_win) { 
        db.rec_win = db.win; 
        eventType = "win_record"; 
    }
  } 
  else if (action === "win_dec") db.win = Math.max(0, db.win - 1);
  else if (action === "loss_inc") {
    db.loss++;
    // منطق كسر الرقم القياسي للخسارة
    if (db.loss > db.rec_loss) { 
        db.rec_loss = db.loss; 
        eventType = "loss_record"; 
    }
  }
  else if (action === "loss_dec") db.loss = Math.max(0, db.loss - 1);
  else if (action === "reset") { 
      db.win = 0; db.loss = 0; 
      eventType = "reset"; 
  }

  // إرسال التحديث لـ OBS فوراً
  io.emit("update", { ...db, event: eventType });
  
  // الرد على الستريم ديك
  res.json(db);
});

// رابط لقراءة الأرقام فقط
app.get("/api/get", (req, res) => {
  res.json(db);
});

// تشغيل السيرفر
const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log("Server running on port " + port);
});
