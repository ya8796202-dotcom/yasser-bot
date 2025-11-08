// server.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages = [] } = req.body;
  const last = messages[messages.length - 1]?.content || '';

  try {
    // استدعاء خدمة الذكاء الاصطناعي
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 🔑 هنا بتحط المفتاح بتاعك
        "Authorization": "Bearer ضع_المفتاح_هنا"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // تقدر تغيّر الموديل حسب المتاح
        messages: [{ role: "user", content: last }]
      })
    });

    const data = await resp.json();

    if (data.error) {
      return res.json({ reply: "⚠️ حصل خطأ: " + data.error.message });
    }

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.json({ reply: "⚠️ في مشكلة في الاتصال بالسيرفر أو الـ API." });
  }
});

app.listen(3000, () => console.log("✅ السيرفر شغال على http://localhost:3000"));

