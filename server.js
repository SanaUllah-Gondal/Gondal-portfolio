require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');

app.set('trust proxy', 1); // needed behind Render/Railway proxies

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ['https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: null
      }
    }
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- helpers ---
function readMessages() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveMessage(msg) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const all = readMessages();
  all.push(msg);
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2));
}

async function sendEmail(msg) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.MAIL_TO || process.env.SMTP_USER,
    replyTo: msg.email,
    subject: `Portfolio message from ${msg.name}`,
    text: `${msg.message}\n\nFrom: ${msg.name} <${msg.email}>`
  });
}

// --- API ---
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many messages. Please try again in a few minutes.' }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message, website } = req.body || {};

  if (website) return res.json({ ok: true }); // honeypot: bots fill this field

  const clean = (v, max) => String(v || '').trim().slice(0, max);
  const data = {
    name: clean(name, 80),
    email: clean(email, 120),
    message: clean(message, 2000)
  };

  if (!data.name || !data.message) {
    return res.status(400).json({ error: 'Please enter your name and a message.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const msg = { ...data, date: new Date().toISOString() };
  try {
    saveMessage(msg);
    await sendEmail(msg).catch(err => console.error('Email failed:', err.message));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send your message. Please email me directly.' });
  }
});

// Read stored messages: send header  x-admin-key: <ADMIN_KEY>
app.get('/api/messages', (req, res) => {
  if (!process.env.ADMIN_KEY || req.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(readMessages());
});

app.listen(PORT, () => console.log(`Portfolio running on http://localhost:${PORT}`));
