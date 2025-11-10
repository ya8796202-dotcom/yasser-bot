import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect("mongodb://127.0.0.1:27017/chatapp");

// موديل المستخدم
const User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
}));

// موديل الرسائل
const Message = mongoose.model("Message", new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
}));

app.use(cors());
app.use(express.json());

// تسجيل مستخدم جديد
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.create({ username, password });
  res.json(user);
});

// تسجيل دخول
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ error: "بيانات غير صحيحة" });
  res.json(user);
});

// Socket.IO للرسائل
io.on("connection", (socket) => {
  console.log("🔌 مستخدم متصل");

  socket.on("sendMessage", async (msg) => {
    const saved = await Message.create(msg);
    io.emit("newMessage", saved); // إرسال للجميع
  });
});

server.listen(4000, () => console.log("🚀 شغال على http://localhost:4000"));
