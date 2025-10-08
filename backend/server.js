// server.js - Servidor Node.js/Express para a rede social Cryptitys

// ----------------------------------------------------
// 1. Configuração Inicial e Módulos
// ----------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs/promises'); // Usando fs/promises para operações assíncronas
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs únicos

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos para os arquivos de dados JSON
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Variáveis de estado em memória para manipulação mais rápida
let users = [];
let posts = [];
let stats = {};
let onlineUsers = {}; // { username: timestamp_login, ... }

// ----------------------------------------------------
// 2. Persistência de Dados (JSON)
// ----------------------------------------------------

/**
 * @function loadData
 * @description Carrega todos os dados dos arquivos JSON.
 */
const loadData = async () => {
    try {
        // Cria o diretório de dados se não existir
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Carregar Usuários
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        users = JSON.parse(usersData);
    } catch (error) {
        // Se o arquivo de usuários não existir ou falhar a leitura/parse:
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.log('Arquivo de usuários não encontrado ou inválido. Inicializando com admin padrão.');
            // Inicializa com usuário admin padrão
            users = [{
                id: uuidv4(),
                username: 'admin',
                password: 'admin', // Senha plain para teste, idealmente usaria hash
                isAdmin: true,
                banned: false,
                avatar: `https://api.dicebear.com/9.x/identicon/svg?seed=admin`
            }];
        } else {
            console.error("Erro ao carregar usuários:", error.message);
        }
    }

    try {
        // Carregar Posts
        const postsData = await fs.readFile(POSTS_FILE, 'utf8');
        posts = JSON.parse(postsData);
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.log('Arquivo de posts não encontrado ou inválido. Inicializando posts vazios.');
            posts = [];
        } else {
            console.error("Erro ao carregar posts:", error.message);
        }
    }

    try {
        // Carregar Estatísticas
        const statsData = await fs.readFile(STATS_FILE, 'utf8');
        stats = JSON.parse(statsData);
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.log('Arquivo de estatísticas não encontrado ou inválido. Inicializando estatísticas.');
            stats = { totalPosts: 0, totalUsers: 0, totalInteractions: 0 };
        } else {
            console.error("Erro ao carregar estatísticas:", error.message);
        }
    }

    // Recalcula as estatísticas no início para garantir consistência
    updateStats();
};

/**
 * @function saveData
 * @description Salva todos os dados nas variáveis de estado (users, posts, stats) nos respectivos arquivos JSON.
 */
const saveData = async () => {
    try {
        // Salvar Usuários
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        // Salvar Posts
        await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
        // Salvar Estatísticas
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
        console.error("Erro ao salvar dados:", error.message);
    }
};

/**
 * @function updateStats
 * @description Recalcula e atualiza o objeto de estatísticas.
 */
const updateStats = () => {
    stats.totalUsers = users.length;
    stats.totalPosts = posts.length;
    stats.onlineUsers = Object.keys(onlineUsers).length;
    stats.totalInteractions = posts.reduce((sum, post) => sum + post.likes.length + post.dislikes.length + post.comments.length, 0);
    saveData();
};

// ----------------------------------------------------
// 3. Middlewares
// ----------------------------------------------------

// Middleware para servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parsing de corpo de requisição JSON
app.use(bodyParser.json());

// Middleware de log de requisições
app.use((req, res, next) => {
    console.log(`[LOG] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

/**
 * @function authenticateMiddleware
 * @description Middleware de autenticação: verifica se o header 'X-Username' está presente e válido.
 * Simula uma sessão simples baseada no username, idealmente usaria tokens JWT ou sessões Express.
 */
const authenticateMiddleware = (req, res, next) => {
    const username = req.header('X-Username');
    if (!username) {
        return res.status(401).json({ success: false, message: 'Não autorizado. Usuário precisa estar logado (X-Username header ausente).' });
    }

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado. Autenticação falhou.' });
    }

    // Anexa o objeto de usuário à requisição
    req.user = user;
    next();
};

// ----------------------------------------------------
// 4. Rotas de API - Autenticação (/api/auth)
// ----------------------------------------------------

/**
 * @route POST /api/auth/register
 * @description Rota para registro de novos usuários.
 */
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    // 1. Validações de entrada
    if (!username || !password || username.length < 3 || password.length < 3) {
        return res.status(400).json({ success: false, message: 'Nome de usuário e senha devem ter no mínimo 3 caracteres.' });
    }

    // 2. Validação de usuário duplicado
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Nome de usuário '${username}' já está em uso.` });
    }

    // 3. Criação do novo usuário
    const newUser = {
        id: uuidv4(),
        username: username,
        password: password, // Armazenamento simples para teste
        isAdmin: false,
        banned: false,
        avatar: `https://api.dicebear.com/9.x/identicon/svg?seed=${username}`
    };

    // 4. Salva o usuário e atualiza estatísticas
    users.push(newUser);
    await saveData();
    updateStats();

    // 5. Retorna sucesso (não loga automaticamente, o frontend deve chamar o login)
    return res.status(201).json({ success: true, message: 'Registro realizado com sucesso! Faça login.' });
});

/**
 * @route POST /api/auth/login
 * @description Rota para login de usuários.
 */
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Validações de entrada (simples)
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Por favor, forneça nome de usuário e senha.' });
    }

    // 2. Busca e validação de credenciais
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // 3. Verifica se o usuário está banido
    if (user.banned) {
        return res.status(403).json({ success: false, message: 'Sua conta foi banida e não pode realizar login.' });
    }

    // 4. Marca o usuário como online
    onlineUsers[user.username] = Date.now();
    updateStats();

    // 5. Retorna dados do usuário logado (sem senha)
    const { password: _, ...userToSend } = user;
    return res.status(200).json({ success: true, message: `Bem-vindo de volta, ${user.username}!`, user: userToSend });
});

/**
 * @route POST /api/auth/logout
 * @description Rota para logout de usuários.
 */
app.post('/api/auth/logout', authenticateMiddleware, (req, res) => {
    // Remove o usuário da lista de online
    delete onlineUsers[req.user.username];
    updateStats();
    return res.status(200).json({ success: true, message: 'Logout realizado com sucesso.' });
});

// ----------------------------------------------------
// 5. Rotas de API - Posts (/api/posts)
// ----------------------------------------------------

/**
 * @route GET /api/posts
 * @description Lista todos os posts, ordenados (recente/popular).
 * @query sort: 'recent' (default) | 'popular'
 */
app.get('/api/posts', (req, res) => {
    const sort = req.query.sort || 'recent';

    let sortedPosts = [...posts]; // Copia para não modificar o original

    if (sort === 'popular') {
        // Ordena por (likes - dislikes)
        sortedPosts.sort((a, b) => (b.likes.length - b.dislikes.length) - (a.likes.length - a.dislikes.length));
    } else { // 'recent'
        // Ordena por timestamp (mais recente primeiro)
        sortedPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return res.status(200).json({ success: true, posts: sortedPosts });
});

/**
 * @route GET /api/posts/search?q=...
 * @description Busca posts por título ou descrição.
 */
app.get('/api/posts/search', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';

    if (!query) {
        return res.status(400).json({ success: false, message: 'Parâmetro de busca (q) é obrigatório.' });
    }

    const searchResults = posts.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query)
    );

    return res.status(200).json({ success: true, posts: searchResults });
});

/**
 * @route POST /api/posts
 * @description Cria um novo post.
 */
app.post('/api/posts', authenticateMiddleware, async (req, res) => {
    const { title, description } = req.body;
    const { user } = req;

    // 1. Verifica se o usuário está banido
    if (user.banned) {
        return res.status(403).json({ success: false, message: 'Usuários banidos não podem criar posts.' });
    }

    // 2. Validações de conteúdo
    if (!title || !description || title.length < 3 || description.length < 10) {
        return res.status(400).json({ success: false, message: 'Título deve ter min. 3 caracteres e Descrição min. 10 caracteres.' });
    }

    // 3. Cria o novo objeto de post
    const newPost = {
        id: uuidv4(),
        title: title,
        description: description,
        username: user.username,
        likes: [],
        dislikes: [],
        comments: [],
        timestamp: new Date().toISOString()
    };

    // 4. Salva o post e atualiza estatísticas
    posts.unshift(newPost); // Adiciona no início (mais recente)
    await saveData();
    updateStats();

    return res.status(201).json({ success: true, message: 'Post criado com sucesso!', post: newPost });
});

/**
 * @route DELETE /api/posts/:id
 * @description Deleta um post pelo ID. Apenas autor ou admin pode deletar.
 */
app.delete('/api/posts/:id', authenticateMiddleware, async (req, res) => {
    const postId = req.params.id;
    const { user } = req;

    // 1. Encontra o índice do post
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex === -1) {
        return res.status(404).json({ success: false, message: 'Post não encontrado.' });
    }

    const postToDelete = posts[postIndex];

    // 2. Verifica permissão de deleção (apenas autor ou admin)
    const canDelete = postToDelete.username === user.username || user.isAdmin;

    if (!canDelete) {
        return res.status(403).json({ success: false, message: 'Permissão negada. Apenas o autor ou um administrador pode deletar este post.' });
    }

    // 3. Deleta o post e atualiza estatísticas
    posts.splice(postIndex, 1);
    await saveData();
    updateStats();

    return res.status(200).json({ success: true, message: 'Post deletado com sucesso!' });
});

// ----------------------------------------------------
// 6. Rotas de API - Interações (Likes/Dislikes/Comments)
// ----------------------------------------------------

/**
 * @route POST /api/posts/:id/like
 * @description Adiciona/remove um like.
 */
app.post('/api/posts/:id/like', authenticateMiddleware, async (req, res) => {
    const postId = req.params.id;
    const username = req.user.username;
    const post = posts.find(p => p.id === postId);

    if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado.' });
    if (req.user.banned) return res.status(403).json({ success: false, message: 'Usuários banidos não podem curtir.' });

    const likeIndex = post.likes.indexOf(username);
    const dislikeIndex = post.dislikes.indexOf(username);

    if (likeIndex > -1) {
        // Já curtiu: Remove o like (toggle)
        post.likes.splice(likeIndex, 1);
        await saveData();
        updateStats();
        return res.status(200).json({ success: true, message: 'Like removido.', post });
    } else {
        // Não curtiu: Adiciona o like
        post.likes.push(username);
        // Remove o dislike se existir (toggle)
        if (dislikeIndex > -1) {
            post.dislikes.splice(dislikeIndex, 1);
        }
        await saveData();
        updateStats();
        return res.status(200).json({ success: true, message: 'Post curtido!', post });
    }
});

/**
 * @route POST /api/posts/:id/dislike
 * @description Adiciona/remove um dislike.
 */
app.post('/api/posts/:id/dislike', authenticateMiddleware, async (req, res) => {
    const postId = req.params.id;
    const username = req.user.username;
    const post = posts.find(p => p.id === postId);

    if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado.' });
    if (req.user.banned) return res.status(403).json({ success: false, message: 'Usuários banidos não podem descurtir.' });

    const dislikeIndex = post.dislikes.indexOf(username);
    const likeIndex = post.likes.indexOf(username);

    if (dislikeIndex > -1) {
        // Já descurtiu: Remove o dislike (toggle)
        post.dislikes.splice(dislikeIndex, 1);
        await saveData();
        updateStats();
        return res.status(200).json({ success: true, message: 'Dislike removido.', post });
    } else {
        // Não descurtiu: Adiciona o dislike
        post.dislikes.push(username);
        // Remove o like se existir (toggle)
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        }
        await saveData();
        updateStats();
        return res.status(200).json({ success: true, message: 'Post descurtido!', post });
    }
});

/**
 * @route POST /api/posts/:id/comments
 * @description Adiciona um novo comentário ao post.
 */
app.post('/api/posts/:id/comments', authenticateMiddleware, async (req, res) => {
    const postId = req.params.id;
    const { text } = req.body;
    const { user } = req;

    const post = posts.find(p => p.id === postId);

    if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado.' });
    if (user.banned) return res.status(403).json({ success: false, message: 'Usuários banidos não podem comentar.' });

    // Validação de comentário
    if (!text || text.length < 1) {
        return res.status(400).json({ success: false, message: 'O comentário não pode estar vazio.' });
    }

    // Cria o novo objeto de comentário
    const newComment = {
        id: uuidv4(),
        username: user.username,
        text: text,
        timestamp: new Date().toISOString(),
        avatar: user.avatar
    };

    // Adiciona o comentário e salva
    post.comments.push(newComment);
    await saveData();
    updateStats();

    return res.status(201).json({ success: true, message: 'Comentário adicionado com sucesso!', comment: newComment });
});


// ----------------------------------------------------
// 7. Rotas de API - Estatísticas e Usuários
// ----------------------------------------------------

/**
 * @route GET /api/stats
 * @description Retorna as estatísticas gerais da rede social.
 */
app.get('/api/stats', (req, res) => {
    // A função updateStats garante que os dados em 'stats' estão atualizados
    return res.status(200).json({ success: true, stats: stats });
});

/**
 * @route GET /api/users/online
 * @description Retorna a lista de usernames de usuários online.
 */
app.get('/api/users/online', (req, res) => {
    // Limpa usuários online após 10 minutos de inatividade (simulação de sessão)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    for (const username in onlineUsers) {
        if (onlineUsers[username] < tenMinutesAgo) {
            delete onlineUsers[username];
        }
    }
    updateStats(); // Atualiza o contador de onlineUsers

    const onlineUsernames = Object.keys(onlineUsers);
    return res.status(200).json({ success: true, onlineUsers: onlineUsernames });
});

// ----------------------------------------------------
// 8. Inicialização do Servidor
// ----------------------------------------------------

/**
 * @function startServer
 * @description Carrega os dados e inicia o servidor Express.
 */
const startServer = async () => {
    await loadData();
    app.listen(PORT, () => {
        console.log(`\n============================================`);
        console.log(`  CRYPTITYS: Servidor rodando na porta ${PORT}`);
        console.log(`  Acesse: http://localhost:${PORT}`);
        console.log(`============================================\n`);

        // Simulação de sessão ativa (a cada 5 minutos)
        setInterval(() => {
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            for (const username in onlineUsers) {
                if (onlineUsers[username] < tenMinutesAgo) {
                    delete onlineUsers[username];
                }
            }
            updateStats();
        }, 5 * 60 * 1000);
    });
};

startServer();
