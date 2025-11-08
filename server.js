import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages = [] } = req.body;
  const last = messages[messages.length - 1]?.content || '';

  // هنا بنبعت السؤال لـ API الذكاء الاصطناعي
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_API_KEY" // حط مفتاحك هنا
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: last }]
    })
  });

  const data = await resp.json();
  const reply = data.choices[0].message.content;

  res.json({ reply });
});

app.listen(3000, () => console.log("البوت الذكي شغال على http://localhost:3000"));
