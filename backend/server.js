const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Banco de dados em memória
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

// Funções auxiliares
function escapeHTML(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atrás`;
  return `${Math.floor(seconds / 86400)} d atrás`;
}

function updateStats() {
  const onlineUsers = database.users.filter(u => 
    (Date.now() - u.lastSeen) < 300000
  ).length;

  database.stats = {
    totalPosts: database.posts.length,
    totalUsers: database.users.length,
    onlineUsers: onlineUsers,
    totalInteractions: database.interactions
  };
}

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rotas da API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    message: '🚀 Cryptitys v3 Backend está funcionando!',
    timestamp: Date.now(),
    version: '3.0.0'
  });
});

// Autenticação
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  
  const user = database.users.find(u => 
    u.username === username && u.password === password && !u.banned
  );
  
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas ou usuário banido' });
  }
  
  // Atualizar último acesso
  user.lastSeen = Date.now();
  
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      banned: user.banned,
      avatar: user.avatar
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Nome de usuário deve ter pelo menos 3 caracteres' });
  }
  
  if (!password || password.length < 3) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 3 caracteres' });
  }
  
  if (database.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }
  
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
  
  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.isAdmin,
      banned: newUser.banned,
      avatar: newUser.avatar
    }
  });
});

// Posts
app.get('/api/posts', (req, res) => {
  const { sort = 'recent' } = req.query;
  
  let sortedPosts = [...database.posts];
  
  if (sort === 'popular') {
    sortedPosts.sort((a, b) => {
      const aScore = (a.likes.length - a.dislikes.length) + (a.comments.length * 2);
      const bScore = (b.likes.length - b.dislikes.length) + (b.comments.length * 2);
      return bScore - aScore;
    });
  } else {
    sortedPosts.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  const postsWithTime = sortedPosts.map(post => ({
    ...post,
    timeAgo: timeAgo(post.timestamp),
    isNew: (Date.now() - post.timestamp) < 300000
  }));
  
  res.json(postsWithTime);
});

app.post('/api/posts', (req, res) => {
  const { username, title, description } = req.body;
  
  if (!username || !title || !description) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  const user = database.users.find(u => u.username === username && !u.banned);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado ou banido' });
  }
  
  if (title.length < 3) {
    return res.status(400).json({ error: 'Título deve ter pelo menos 3 caracteres' });
  }
  
  if (description.length < 10) {
    return res.status(400).json({ error: 'Descrição deve ter pelo menos 10 caracteres' });
  }
  
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
  user.lastSeen = Date.now();
  updateStats();
  
  res.json({
    success: true,
    post: {
      ...newPost,
      timeAgo: timeAgo(newPost.timestamp),
      isNew: true
    }
  });
});

// Likes/Dislikes
app.post('/api/posts/:id/like', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  
  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);
  
  if (!post || !user) {
    return res.status(404).json({ error: 'Post ou usuário não encontrado' });
  }
  
  const hasLiked = post.likes.includes(username);
  const hasDisliked = post.dislikes.includes(username);
  
  if (hasLiked) {
    post.likes = post.likes.filter(u => u !== username);
  } else {
    post.likes.push(username);
    if (hasDisliked) {
      post.dislikes = post.dislikes.filter(u => u !== username);
    }
  }
  
  database.interactions++;
  user.lastSeen = Date.now();
  updateStats();
  
  res.json({
    success: true,
    likes: post.likes,
    dislikes: post.dislikes
  });
});

app.post('/api/posts/:id/dislike', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  
  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);
  
  if (!post || !user) {
    return res.status(404).json({ error: 'Post ou usuário não encontrado' });
  }
  
  const hasLiked = post.likes.includes(username);
  const hasDisliked = post.dislikes.includes(username);
  
  if (hasDisliked) {
    post.dislikes = post.dislikes.filter(u => u !== username);
  } else {
    post.dislikes.push(username);
    if (hasLiked) {
      post.likes = post.likes.filter(u => u !== username);
    }
  }
  
  database.interactions++;
  user.lastSeen = Date.now();
  updateStats();
  
  res.json({
    success: true,
    likes: post.likes,
    dislikes: post.dislikes
  });
});

// Comentários
app.post('/api/posts/:id/comments', (req, res) => {
  const { id } = req.params;
  const { username, text } = req.body;
  
  const post = database.posts.find(p => p.id === id);
  const user = database.users.find(u => u.username === username && !u.banned);
  
  if (!post || !user) {
    return res.status(404).json({ error: 'Post ou usuário não encontrado' });
  }
  
  if (!text || text.trim().length < 1) {
    return res.status(400).json({ error: 'Comentário não pode estar vazio' });
  }
  
  const newComment = {
    id: uuidv4(),
    username,
    text: escapeHTML(text.trim()),
    timestamp: Date.now(),
    avatar: user.avatar
  };
  
  post.comments.unshift(newComment);
  database.interactions++;
  user.lastSeen = Date.now();
  updateStats();
  
  res.json({
    success: true,
    comment: {
      ...newComment,
      timeAgo: timeAgo(newComment.timestamp)
    }
  });
});

// Excluir posts
app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { username, isAdmin } = req.body;
  
  const post = database.posts.find(p => p.id === id);
  if (!post) {
    return res.status(404).json({ error: 'Post não encontrado' });
  }
  
  if (post.username !== username && !isAdmin) {
    return res.status(403).json({ error: 'Sem permissão para excluir este post' });
  }
  
  database.posts = database.posts.filter(p => p.id !== id);
  updateStats();
  
  res.json({ success: true, message: 'Post excluído com sucesso' });
});

// Estatísticas
app.get('/api/stats', (req, res) => {
  updateStats();
  res.json(database.stats);
});

// Usuários online
app.get('/api/users/online', (req, res) => {
  const onlineUsers = database.users
    .filter(u => (Date.now() - u.lastSeen) < 300000)
    .slice(0, 10)
    .map(user => ({
      username: user.username,
      isAdmin: user.isAdmin,
      avatar: user.avatar,
      lastSeen: user.lastSeen
    }));
  
  res.json(onlineUsers);
});

// Pesquisa de posts
app.get('/api/posts/search', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Termo de pesquisa deve ter pelo menos 2 caracteres' });
  }
  
  const searchTerm = q.toLowerCase();
  const results = database.posts.filter(post => 
    post.title.toLowerCase().includes(searchTerm) ||
    post.description.toLowerCase().includes(searchTerm) ||
    post.username.toLowerCase().includes(searchTerm)
  ).map(post => ({
    ...post,
    timeAgo: timeAgo(post.timestamp)
  }));
  
  res.json(results);
});

// Rota padrão para servir o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'..' , 'index.html'));
});

// Rota para todas as outras requisições (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..' , 'index.html'));
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`🚀 Cryptitys v3 Backend rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 Estatísticas: ${database.stats.totalUsers} usuários, ${database.stats.totalPosts} posts`);
});

module.exports = app;
