// server.js — ملف واحد جاهز: سيرفر Node.js/Express + MongoDB + واجهة HTML/CSS/JS مربوطة بالكامل
// التعليمات:
// 1) npm init -y
// 2) npm i express mongoose bcrypt jsonwebtoken cookie-parser cors dotenv
// 3) node server.js
// 4) افتح http://localhost:4000

import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// إعدادات بسيطة
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/shabkety';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-please-change';

// اتصال بقاعدة البيانات
mongoose.connect(MONGO_URL).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// الموديلات
import mongoosePkg from 'mongoose';
const { Schema } = mongoosePkg;

const userSchema = new Schema({
  username: { type: String, unique: true, index: true, trim: true },
  email: { type: String, unique: true, index: true, trim: true },
  passwordHash: { type: String, required: true },
  avatarUrl: String,
  bio: { type: String, maxlength: 200 },
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  settings: {
    visibility: { type: String, enum: ['public', 'private'], default: 'public' }
  }
}, { timestamps: true });

const postSchema = new Schema({
  authorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  content: { type: String, trim: true },
  mediaUrls: [String],
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const commentSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', index: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, trim: true }
}, { timestamps: true });

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['like', 'comment', 'follow', 'message'] },
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  entityId: { type: Schema.Types.ObjectId },
  seen: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ميدلوير التوثيق
function auth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// السيرفر
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// الواجهة (HTML + CSS + JS) — ملف واحد
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>شبكتي</title>
  <style>
    body { font-family: "Cairo", sans-serif; background: #f5f7fb; margin: 0; color: #222; }
    header { background: #0078d7; color: #fff; padding: 12px; display: flex; gap: 10px; align-items: center; }
    header .brand { font-weight: 800 }
    .container { max-width: 900px; margin: 16px auto; padding: 0 12px }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin: 10px 0 }
    .input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #d1d5db; }
    .btn { background: #0078d7; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
    .btn.secondary { background: #fff; color: #0078d7; border: 1px solid #0078d7 }
    .post { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; margin: 10px 0 }
    .row { display: flex; gap: 8px; align-items: center }
    .muted { color: #6b7280; font-size: 12px }
    .between { display:flex; justify-content:space-between; align-items:center }
  </style>
</head>
<body>
  <header>
    <div class="brand">شبكتي</div>
    <div id="authBar" style="margin-inline-start:auto" class="row"></div>
  </header>

  <div class="container">
    <div id="authForms" class="card"></div>

    <div id="composer" class="card" style="display:none">
      <div style="font-weight:800">اكتب منشورًا</div>
      <div style="height:8px"></div>
      <textarea id="postContent" placeholder="ما الذي يجول في خاطرك؟"></textarea>
      <div style="height:8px"></div>
      <button id="publishBtn" class="btn">نشر</button>
    </div>

    <div id="feed" class="card">
      <div class="between">
        <div style="font-weight:800">الخط الزمني</div>
        <button id="reloadFeedBtn" class="btn secondary">تحديث</button>
      </div>
      <div id="feedList"></div>
    </div>

    <div class="card">
      <div class="between">
        <div style="font-weight:800">إشعاراتي</div>
        <button id="markSeenBtn" class="btn secondary">تعليم كمقروء</button>
      </div>
      <div id="notifications"></div>
    </div>
  </div>

  <script>
    const API = location.origin;

    async function api(path, method='GET', data=null, token=null) {
      const res = await fetch(\`\${API}\${path}\`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: \`Bearer \${token}\` } : {})
        },
        credentials: 'include',
        body: data ? JSON.stringify(data) : null
      });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(body.error || 'Error');
      return body;
    }

    let token = null;
    let me = null;

    const el = s => document.querySelector(s);
    const $ = {
      authBar: el('#authBar'),
      authForms: el('#authForms'),
      composer: el('#composer'),
      postContent: el('#postContent'),
      publishBtn: el('#publishBtn'),
      feedList: el('#feedList'),
      reloadFeedBtn: el('#reloadFeedBtn'),
      notifications: el('#notifications'),
      markSeenBtn: el('#markSeenBtn')
    };

    function renderAuthBar() {
      $.authBar.innerHTML = '';
      if (me) {
        const name = document.createElement('span'); name.textContent = me.username;
        const logout = document.createElement('button'); logout.textContent = 'خروج'; logout.className = 'btn secondary';
        logout.onclick = async () => { await api('/auth/logout', 'POST'); token = null; me = null; init(); };
        $.authBar.append(name, logout);
      } else {
        const register = document.createElement('button'); register.textContent = 'تسجيل'; register.className = 'btn secondary';
        const login = document.createElement('button'); login.textContent = 'دخول'; login.className = 'btn secondary';
        $.authBar.append(register, login);
      }
    }

    function renderAuthForms() {
      if (me) { $.authForms.style.display = 'none'; $.composer.style.display = ''; return; }
      $.authForms.style.display = '';
      $.composer.style.display = 'none';
      $.authForms.innerHTML = \`
        <div class="row" style="justify-content:space-between">
          <div style="font-weight:800">ابدأ الآن</div>
        </div>
        <div style="height:8px"></div>
        <div class="row" style="gap:16px; flex-wrap:wrap">
          <div class="card" style="flex:1">
            <div style="font-weight:800">إنشاء حساب</div>
            <div style="height:8px"></div>
            <input id="regUser" class="input" placeholder="اسم المستخدم" />
            <div style="height:8px"></div>
            <input id="regEmail" class="input" placeholder="البريد الإلكتروني" />
            <div style="height:8px"></div>
            <input id="regPass" type="password" class="input" placeholder="كلمة المرور" />
            <div style="height:8px"></div>
            <button id="regBtn" class="btn">تسجيل</button>
            <div id="regErr" class="muted"></div>
          </div>
          <div class="card" style="flex:1">
            <div style="font-weight:800">تسجيل الدخول</div>
            <div style="height:8px"></div>
            <input id="logEmail" class="input" placeholder="البريد الإلكتروني" />
            <div style="height:8px"></div>
            <input id="logPass" type="password" class="input" placeholder="كلمة المرور" />
            <div style="height:8px"></div>
            <button id="logBtn" class="btn">دخول</button>
            <div id="logErr" class="muted"></div>
          </div>
        </div>
      \`;
      el('#regBtn').onclick = async () => {
        try {
          const username = el('#regUser').value.trim();
          const email = el('#regEmail').value.trim();
          const password = el('#regPass').value.trim();
          const res = await api('/auth/register', 'POST', { username, email, password });
          token = res.token; me = res.user; init();
        } catch(e){ el('#regErr').textContent = e.message }
      };
      el('#logBtn').onclick = async () => {
        try {
          const email = el('#logEmail').value.trim();
          const password = el('#logPass').value.trim();
          const res = await api('/auth/login', 'POST', { email, password });
          token = res.token; me = res.user; init();
        } catch(e){ el('#logErr').textContent = e.message }
      };
    }

    function postNode(p) {
      const div = document.createElement('div'); div.className = 'post';
      const liked = me && p.likes.some(uid => uid === me._id);
      div.innerHTML = \`
        <div class="row" style="justify-content:space-between">
          <div><b>\${p.authorId?.username || 'مستخدم'}</b> <span class="muted">\${new Date(p.createdAt).toLocaleString('ar-EG')}</span></div>
          <div class="row">
            \${me ? \`<button class="btn secondary likeBtn">\${liked?'إلغاء إعجاب':'إعجاب'} (\${p.likes.length})</button>\` : ''}
            \${me && String(p.authorId?._id) === String(me._id) ? \`<button class="btn secondary delBtn">حذف</button>\` : ''}
          </div>
        </div>
        <div style="margin-top:6px">\${p.content || ''}</div>
        <div style="height:8px"></div>
        <div class="muted">التعليقات</div>
        <div style="height:6px"></div>
        <div class="comments"></div>
        \${me ? \`<div class="row"><input class="input cInput" placeholder="أضف تعليقًا..." /><button class="btn cBtn">نشر</button></div>\` : ''}
      \`;
      const commentsEl = div.querySelector('.comments');
      const loadComments = async () => {
        const list = await api(\`/comments/\${p._id}\`, 'GET');
        commentsEl.innerHTML = '';
        for (const c of list) {
          const item = document.createElement('div'); item.className = 'card';
          item.innerHTML = \`<div><b>\${c.authorId?.username || 'مستخدم'}</b> <span class="muted">\${new Date(c.createdAt).toLocaleString('ar-EG')}</span></div><div style="margin-top:6px">\${c.content}</div>\`;
          commentsEl.appendChild(item);
        }
      };
      loadComments();

      const likeBtn = div.querySelector('.likeBtn');
      if (likeBtn) likeBtn.onclick = async () => { await api(\`/posts/\${p._id}/like\`, 'POST', null, token); loadFeed(); };
      const delBtn = div.querySelector('.delBtn');
      if (delBtn) delBtn.onclick = async () => { await api(\`/posts/\${p._id}\`, 'DELETE', null, token); loadFeed(); };
      const cBtn = div.querySelector('.cBtn');
      if (cBtn) cBtn.onclick = async () => {
        const txt = div.querySelector('.cInput').value.trim();
        if (!txt) return;
        await api(\`/comments/\${p._id}\`, 'POST', { content: txt }, token);
        div.querySelector('.cInput').value = '';
        loadComments();
      };
      return div;
    }

    async function loadFeed() {
      const posts = await api('/posts/feed', 'GET');
      const userIds = [...new Set(posts.map(p => p.authorId))];
      const map = {};
      await Promise.all(userIds.map(async id => {
        const u = await api(\`/users/\${id}\`, 'GET');
        map[id] = u;
      }));
      $.feedList.innerHTML = '';
      for (const p of posts) {
        p.authorId = map[p.authorId] || { username: 'مستخدم' };
        $.feedList.appendChild(postNode(p));
      }
    }

    function initComposer() {
      $.publishBtn.onclick = async () => {
        const content = $.postContent.value.trim();
        if (!content) return;
        await api('/posts', 'POST', { content }, token);
        $.postContent.value = '';
        loadFeed();
      };
    }

    async function loadNotifications() {
      if (!me) { $.notifications.innerHTML = '<div class="muted">سجّل دخولك لرؤية الإشعارات</div>'; return; }
      const ns = await api('/notifications', 'GET', null, token);
      $.notifications.innerHTML = '';
      for (const n of ns) {
        const typeText = n.type==='like'?'أعجب بمنشورك': n.type==='comment'?'علق على منشورك': n.type==='message'?'أرسل لك رسالة':'قام بمتابعتك';
        $.notifications.innerHTML += \`<div class="card"><b>\${typeText}</b> — <span class="muted">\${new Date(n.createdAt).toLocaleString('ar-EG')}</span> — <span class="muted">\${n.seen?'مقروء':'غير مقروء'}</span></div>\`;
      }
      $.markSeenBtn.onclick = async () => { await api('/notifications/seen', 'POST', null, token); loadNotifications(); };
    }

    async function fetchMe() {
      // لا يوجد مسار مباشر لاسترجاع المستخدم الحالي من التوكن — سنحافظ على me من رد التسجيل/الدخول
      return me;
    }

    function init() {
      renderAuthBar();
      renderAuthForms();
      initComposer();
      loadFeed();
      loadNotifications();
    }

    init();
    $.reloadFeedBtn.onclick = () => loadFeed();
  </script>
</body>
</html>`);
});

// مسارات API

// Auth
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ error: 'User exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });
    const token = jwt.sign({ _id: user._id, id: user._id, username }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax' });
    res.status(201).json({ user, token });
  } catch(e) { res.status(500).json({ error: 'Server error' }) }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ _id: user._id, id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({ user, token });
  } catch(e) { res.status(500).json({ error: 'Server error' }) }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('access_token'); res.json({ ok: true });
});

// Users
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.patch('/users/:id', auth, async (req, res) => {
  if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  const patch = { bio: req.body.bio, avatarUrl: req.body.avatarUrl };
  const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true }).select('-passwordHash');
  res.json(user);
});

// Posts
app.post('/posts', auth, async (req, res) => {
  const { content, mediaUrls = [] } = req.body;
  if (!content && mediaUrls.length === 0) return res.status(400).json({ error: 'Empty post' });
  const post = await Post.create({ authorId: req.user.id, content, mediaUrls });
  res.status(201).json(post);
});

app.get('/posts/feed', async (req, res) => {
  const posts = await Post.find({}).sort({ createdAt: -1 }).limit(50);
  res.json(posts);
});

app.post('/posts/:id/like', auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const i = post.likes.findIndex(u => String(u) === String(req.user.id));
  if (i >= 0) post.likes.splice(i, 1);
  else {
    post.likes.push(req.user.id);
    await Notification.create({ userId: post.authorId, type: 'like', actorId: req.user.id, entityId: post._id });
  }
  await post.save();
  res.json(post);
});

app.delete('/posts/:id', auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (String(post.authorId) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  await post.deleteOne();
  res.json({ ok: true });
});

// Comments
app.post('/comments/:postId', auth, async (req, res) => {
  const { content } = req.body;
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const c = await Comment.create({ postId: post._id, authorId: req.user.id, content });
  await Notification.create({ userId: post.authorId, type: 'comment', actorId: req.user.id, entityId: post._id });
  res.status(201).json(c);
});

app.get('/comments/:postId', async (req, res) => {
  const list = await Comment.find({ postId: req.params.postId }).sort({ createdAt: 1 }).populate('authorId', 'username');
  res.json(list);
});

// Notifications
app.get('/notifications', auth, async (req, res) => {
  const ns = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
  res.json(ns);
});

app.post('/notifications/seen', auth, async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, seen: false }, { seen: true });
  res.json({ ok: true });
});

// تشغيل السيرفر
app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
