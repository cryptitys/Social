// ========================= CRYPTITYS v3 SERVER =========================
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------- MIDDLEWARES -------------------------
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

// ------------------------- BANCO DE DADOS EM MEMÓRIA -------------------------
let database = {
  users: [
    {
      id: 'admin-001',
      username: 'admin',
      password: 'admin',
      isAdmin: true,
      banned: false,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=admin'
    }
  ],
  posts: [],
  interactions: 0,
  stats: {
    totalPosts: 0,
    totalUsers: 1,
    onlineUsers: 0,
    totalInteractions: 0
  }
};

// ------------------------- FUNÇÕES AUXILIARES -------------------------
function escapeHTML(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/[&<>"']/g, (match) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[match];
  });
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atrás`;
  return `${Math.floor(seconds / 86400)} d atrás`;
}

function updateStats() {
  const onlineUsers = database.users.filter(u => (Date.now() - u.lastSeen) < 300000).length;
  database.stats = {
    totalPosts: database.posts.length,
    totalUsers: database.users.length,
    onlineUsers,
    totalInteractions: database.interactions
  };
}

// ------------------------- ROTAS -------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    message: '🚀 Cryptitys v3 Backend funcionando!',
    timestamp: Date.now(),
    version: '3.0.0'
  });
});

// ---------- AUTH ----------
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || username.length < 3)
    return res.status(400).json({ error: 'Usuário deve ter ao menos 3 caracteres.' });
  if (!password || password.length < 3)
    return res.status(400).json({ error: 'Senha deve ter ao menos 3 caracteres.' });

  const exists = database.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists)
    return res.status(400).json({ error: 'Usuário já existe.' });

  const newUser = {
    id: uuidv4(),
    username,
    password,
    isAdmin: false,
    banned: false,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    avatar: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(username)}`
  };

  database.users.push(newUser);
  updateStats();
  res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const user = database.users.find(u => u.username === username && u.password === password && !u.banned);
  if (!user)
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

  user.lastSeen = Date.now();
  res.json({ success: true, user });
});

// ---------- POSTS ----------
app.get('/api/posts', (req, res) => {
  const { sort = 'recent' } = req.query;
  let posts = [...database.posts];

  if (sort === 'popular') {
    posts.sort((a, b) => {
      const scoreA = (a.likes.length - a.dislikes.length) + a.comments.length * 2;
      const scoreB = (b.likes.length - b.dislikes.length) + b.comments.length * 2;
      return scoreB - scoreA;
    });
  } else {
    posts.sort((a, b) => b.timestamp - a.timestamp);
  }

  res.json(posts.map(p => ({
    ...p,
    timeAgo: timeAgo(p.timestamp),
    isNew: (Date.now() - p.timestamp) < 300000
  })));
});

app.post('/api/posts', (req, res) => {
  const { username, title, description } = req.body;
  if (!username || !title || !description)
    return res.status(400).json({ error: 'Preencha todos os campos.' });

  const user = database.users.find(u => u.username === username && !u.banned);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou banido.' });

  const newPost = {
    id: uuidv4(),
    username,
    title: escapeHTML(title),
    description: escapeHTML(description),
    timestamp: Date.now(),
    likes: [],
    dislikes: [],
    comments: []
  };

  database.posts.unshift(newPost);
  database.interactions++;
  updateStats();

  res.json({ success: true, post: newPost });
});

// ---------- INTERAÇÕES ----------
app.post('/api/posts/:id/like', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);

  if (!post || !user) return res.status(404).json({ error: 'Post ou usuário não encontrado.' });

  const liked = post.likes.includes(username);
  const disliked = post.dislikes.includes(username);

  if (liked) post.likes = post.likes.filter(u => u !== username);
  else {
    post.likes.push(username);
    if (disliked) post.dislikes = post.dislikes.filter(u => u !== username);
  }

  database.interactions++;
  updateStats();
  res.json({ success: true, likes: post.likes, dislikes: post.dislikes });
});

app.post('/api/posts/:id/dislike', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);

  if (!post || !user) return res.status(404).json({ error: 'Post ou usuário não encontrado.' });

  const disliked = post.dislikes.includes(username);
  const liked = post.likes.includes(username);

  if (disliked) post.dislikes = post.dislikes.filter(u => u !== username);
  else {
    post.dislikes.push(username);
    if (liked) post.likes = post.likes.filter(u => u !== username);
  }

  database.interactions++;
  updateStats();
  res.json({ success: true, likes: post.likes, dislikes: post.dislikes });
});

// ---------- COMENTÁRIOS ----------
app.post('/api/posts/:id/comments', (req, res) => {
  const { id } = req.params;
  const { username, text } = req.body;

  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);

  if (!post || !user) return res.status(404).json({ error: 'Post ou usuário não encontrado.' });
  if (!text || text.trim().length < 1) return res.status(400).json({ error: 'Comentário vazio.' });

  const comment = {
    id: uuidv4(),
    username,
    text: escapeHTML(text.trim()),
    timestamp: Date.now(),
    avatar: user.avatar
  };

  post.comments.unshift(comment);
  database.interactions++;
  updateStats();

  res.json({ success: true, comment });
});

// ---------- ESTATÍSTICAS ----------
app.get('/api/stats', (req, res) => {
  updateStats();
  res.json(database.stats);
});

app.get('/api/users/online', (req, res) => {
  const users = database.users
    .filter(u => (Date.now() - u.lastSeen) < 300000)
    .map(u => ({
      username: u.username,
      avatar: u.avatar,
      isAdmin: u.isAdmin
    }));
  res.json(users);
});

// ---------- PESQUISA ----------
app.get('/api/posts/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2)
    return res.status(400).json({ error: 'Pesquise com pelo menos 2 caracteres.' });

  const term = q.toLowerCase();
  const results = database.posts.filter(p =>
    p.title.toLowerCase().includes(term) ||
    p.description.toLowerCase().includes(term) ||
    p.username.toLowerCase().includes(term)
  );

  res.json(results);
});

// ---------- SERVE O SITE ----------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ------------------------- START SERVER -------------------------
app.listen(PORT, () => {
  console.log(`✅ Servidor Cryptitys v3 rodando na porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
