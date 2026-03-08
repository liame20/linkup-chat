/**
 * LinkUp — Serveur Node.js + Socket.io
 * Messagerie en temps réel, photos, appels
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ─── Config ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'linkup_super_secret_change_this_in_prod';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// ─── Créer les dossiers si inexistants ────────────────────
[DATA_DIR, UPLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Fichiers de données JSON ─────────────────────────────
const FILES = {
  users:    path.join(DATA_DIR, 'users.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
};

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Initialiser les fichiers vides si besoin
Object.values(FILES).forEach(f => {
  if (!fs.existsSync(f)) writeJSON(f, {});
});

// ─── Express + Socket.io ──────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 5e6, // 5MB max pour les images
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Multer — upload photos ───────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// ─── Middleware Auth JWT ───────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ─── Helpers ──────────────────────────────────────────────
function chatKey(a, b) {
  return [a, b].sort().join('__');
}

function getUser(username) {
  return readJSON(FILES.users)[username];
}

function saveUser(username, data) {
  const users = readJSON(FILES.users);
  users[username] = data;
  writeJSON(FILES.users, users);
}

function getMessages(key) {
  return (readJSON(FILES.messages)[key] || []);
}

function saveMessage(key, msg) {
  const all = readJSON(FILES.messages);
  if (!all[key]) all[key] = [];
  all[key].push(msg);
  writeJSON(FILES.messages, all);
  return msg;
}

// Map username → socket.id (en ligne)
const onlineUsers = new Map();

// ══════════════════════════════════════════════════════════
//  REST API
// ══════════════════════════════════════════════════════════

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Pseudo et mot de passe requis.' });
  if (username.length < 2)
    return res.status(400).json({ error: 'Pseudo trop court (min 2 caractères).' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Mot de passe trop court (min 4 caractères).' });
  if (getUser(username))
    return res.status(409).json({ error: 'Ce pseudo est déjà pris.' });

  const hash = await bcrypt.hash(password, 10);
  const colors = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  saveUser(username, { hash, color, created: Date.now() });
  res.json({ message: 'Compte créé !' });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = getUser(username);
  if (!user) return res.status(401).json({ error: 'Pseudo introuvable.' });
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  const token = jwt.sign({ username, color: user.color }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username, color: user.color });
});

// GET /api/users — liste des utilisateurs (sans le current)
app.get('/api/users', authMiddleware, (req, res) => {
  const users = readJSON(FILES.users);
  const result = Object.keys(users)
    .filter(u => u !== req.user.username)
    .map(u => ({
      username: u,
      color: users[u].color,
      online: onlineUsers.has(u),
    }));
  res.json(result);
});

// GET /api/messages/:contact
app.get('/api/messages/:contact', authMiddleware, (req, res) => {
  const key = chatKey(req.user.username, req.params.contact);
  res.json(getMessages(key));
});

// POST /api/upload — upload d'une photo
app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Erreur upload.' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// ══════════════════════════════════════════════════════════
//  SOCKET.IO
// ══════════════════════════════════════════════════════════

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth required'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Token invalide'));
  }
});

io.on('connection', (socket) => {
  const { username } = socket.user;
  onlineUsers.set(username, socket.id);
  console.log(`✅ ${username} connecté (${socket.id})`);

  // Prévenir tout le monde qu'il est en ligne
  socket.broadcast.emit('user:online', { username });

  // ── Envoyer un message texte ──────────────────────────
  socket.on('message:send', ({ to, text }) => {
    if (!text?.trim() || !to) return;
    const msg = {
      id: uuidv4(),
      from: username,
      to,
      type: 'text',
      text: text.trim(),
      ts: Date.now(),
    };
    const key = chatKey(username, to);
    saveMessage(key, msg);

    // Envoyer au destinataire s'il est en ligne
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message:receive', msg);
    }
    // Confirmer à l'expéditeur
    socket.emit('message:sent', msg);
  });

  // ── Envoyer une photo (URL après upload) ─────────────
  socket.on('photo:send', ({ to, url }) => {
    if (!url || !to) return;
    const msg = {
      id: uuidv4(),
      from: username,
      to,
      type: 'image',
      url,
      ts: Date.now(),
    };
    const key = chatKey(username, to);
    saveMessage(key, msg);

    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message:receive', msg);
    }
    socket.emit('message:sent', msg);
  });

  // ── Typing indicator ──────────────────────────────────
  socket.on('typing:start', ({ to }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('typing:start', { from: username });
  });

  socket.on('typing:stop', ({ to }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('typing:stop', { from: username });
  });

  // ── Signalisation appel WebRTC ────────────────────────
  socket.on('call:offer', ({ to, offer, type }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('call:offer', { from: username, offer, type });
    else socket.emit('call:unavailable', { to });
  });

  socket.on('call:answer', ({ to, answer }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('call:answer', { from: username, answer });
  });

  socket.on('call:ice', ({ to, candidate }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('call:ice', { from: username, candidate });
  });

  socket.on('call:end', ({ to }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('call:end', { from: username });
  });

  socket.on('call:reject', ({ to }) => {
    const rid = onlineUsers.get(to);
    if (rid) io.to(rid).emit('call:reject', { from: username });
  });

  // ── Déconnexion ───────────────────────────────────────
  socket.on('disconnect', () => {
    onlineUsers.delete(username);
    socket.broadcast.emit('user:offline', { username });
    console.log(`❌ ${username} déconnecté`);
  });
});

// ─── 404 pour les routes API inconnues ───────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

// ─── Gestionnaire d'erreurs global ───────────────────────
app.use((err, req, res, next) => {
  console.error('Erreur Express:', err);
  res.status(500).json({ error: err.message || 'Erreur interne du serveur.' });
});

// ─── Lancer le serveur ────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 LinkUp lancé sur http://localhost:${PORT}`);
  console.log(`📁 Données : ${DATA_DIR}`);
  console.log(`🖼️  Uploads : ${UPLOADS_DIR}\n`);
});
