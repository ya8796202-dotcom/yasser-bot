// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect("mongodb://127.0.0.1:27017/chatapp");

// موديل الرسائل
const Message = mongoose.model("Message", new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
}));

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 مستخدم متصل");

  // استقبال رسالة
  socket.on("sendMessage", async (msg) => {
    const saved = await Message.create(msg);
    // إرسال للطرفين
    io.emit("newMessage", saved);
  });
});

server.listen(4000, () => console.log("🚀 شغال على http://localhost:4000"));
