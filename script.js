// ===== CRYPTITYS v3 - REDE SOCIAL COM BACKEND =====
const API_BASE = window.location.origin + '/api';

let currentUser = null;
let currentSort = 'recent';
let posts = [];
let onlineUsers = [];
let isSearching = false;

// UI references
const postsEl = document.getElementById('posts');
const postsCountEl = document.getElementById('posts-count');
const usersOnlineEl = document.getElementById('users-online');
const onlineCountEl = document.getElementById('online-count');
const userDisplayEl = document.getElementById('user-display');
const statsPostsEl = document.getElementById('stats-posts');
const statsUsersEl = document.getElementById('stats-users');
const statsOnlineEl = document.getElementById('stats-online');
const statsInteractionsEl = document.getElementById('stats-interactions');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const scrollToTopBtn = document.getElementById('scroll-to-top');
const searchInput = document.getElementById('search-input');
const searchResultsPanel = document.getElementById('search-results-panel');
const searchResultsEl = document.getElementById('search-results');
const charCountEl = document.getElementById('char-count');

// ===== API FUNCTIONS =====
async function apiCall(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            signal: controller.signal,
            ...options
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Tempo de requisição esgotado. Tente novamente.');
        }
        throw error;
    }
}

// ===== AUTHENTICATION =====
async function register(username, password) {
    try {
        showAlert('Criando conta...', 'info');
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        currentUser = data.user;
        localStorage.setItem('cryptitys_user', JSON.stringify(currentUser));
        updateUIForUser();
        closeModal();
        showAlert(`🎉 Conta criada com sucesso! Bem-vindo, ${username}!`, 'success');
        await loadInitialData();
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

async function login(username, password) {
    try {
        showAlert('Entrando...', 'info');
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        currentUser = data.user;
        localStorage.setItem('cryptitys_user', JSON.stringify(currentUser));
        updateUIForUser();
        closeModal();
        showAlert(`👋 Bem-vindo de volta, ${username}!`, 'success');
        await loadInitialData();
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('cryptitys_user');
    updateUIForUser();
    showAlert('👋 Você saiu da sua conta', 'info');
    loadInitialData();
}

function updateUIForUser() {
    if (currentUser) {
        userDisplayEl.textContent = `${currentUser.username} ${currentUser.isAdmin ? '👑' : ''}`;
        userDisplayEl.title = currentUser.isAdmin ? 'Administrador' : 'Usuário';
        document.getElementById('btn-login').classList.add('hidden');
        document.getElementById('btn-register').classList.add('hidden');
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('new-post-panel').classList.remove('hidden');
    } else {
        userDisplayEl.textContent = 'Visitante';
        userDisplayEl.title = 'Faça login para interagir';
        document.getElementById('btn-login').classList.remove('hidden');
        document.getElementById('btn-register').classList.remove('hidden');
        document.getElementById('btn-logout').classList.add('hidden');
        document.getElementById('new-post-panel').classList.add('hidden');
    }
}

// ===== POST MANAGEMENT =====
async function createPost(title, description) {
    if (!currentUser) {
        showAlert('🔒 Você precisa estar logado para postar', 'warning');
        return false;
    }
    
    if (currentUser.banned) {
        showAlert('🚫 Usuários banidos não podem postar', 'danger');
        return false;
    }
    
    if (!title || title.length < 3) {
        showAlert('📝 Título deve ter pelo menos 3 caracteres', 'warning');
        return false;
    }
    
    if (!description || description.length < 10) {
        showAlert('📝 Descrição deve ter pelo menos 10 caracteres', 'warning');
        return false;
    }
    
    try {
        showAlert('Publicando post...', 'info');
        const data = await apiCall('/posts', {
            method: 'POST',
            body: JSON.stringify({
                username: currentUser.username,
                title,
                description
            })
        });
        
        await fetchPosts();
        showAlert('✅ Post publicado com sucesso!', 'success');
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

async function deletePost(id) {
    if (!currentUser) {
        showAlert('🔒 Você precisa estar logado para excluir posts', 'warning');
        return false;
    }
    
    if (!confirm('Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.')) {
        return false;
    }
    
    try {
        showAlert('Excluindo post...', 'info');
        await apiCall(`/posts/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({
                username: currentUser.username,
                isAdmin: currentUser.isAdmin
            })
        });
        
        await fetchPosts();
        showAlert('✅ Post excluído com sucesso', 'info');
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

async function toggleLike(postId) {
    if (!currentUser) {
        showAlert('🔒 Você precisa estar logado para curtir posts', 'warning');
        return false;
    }
    
    if (currentUser.banned) {
        showAlert('🚫 Usuários banidos não podem interagir', 'danger');
        return false;
    }
    
    try {
        const data = await apiCall(`/posts/${postId}/like`, {
            method: 'POST',
            body: JSON.stringify({ username: currentUser.username })
        });
        
        // Atualizar o post específico na lista
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex].likes = data.likes;
            posts[postIndex].dislikes = data.dislikes;
        }
        
        refreshUI();
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

async function toggleDislike(postId) {
    if (!currentUser) {
        showAlert('🔒 Você precisa estar logado para descurtir posts', 'warning');
        return false;
    }
    
    if (currentUser.banned) {
        showAlert('🚫 Usuários banidos não podem interagir', 'danger');
        return false;
    }
    
    try {
        const data = await apiCall(`/posts/${postId}/dislike`, {
            method: 'POST',
            body: JSON.stringify({ username: currentUser.username })
        });
        
        // Atualizar o post específico na lista
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex].likes = data.likes;
            posts[postIndex].dislikes = data.dislikes;
        }
        
        refreshUI();
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

async function addComment(postId, text) {
    if (!currentUser) {
        showAlert('🔒 Você precisa estar logado para comentar', 'warning');
        return false;
    }
    
    if (currentUser.banned) {
        showAlert('🚫 Usuários banidos não podem comentar', 'danger');
        return false;
    }
    
    if (!text || text.trim().length < 1) {
        showAlert('💬 Comentário não pode estar vazio', 'warning');
        return false;
    }
    
    try {
        const data = await apiCall(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({
                username: currentUser.username,
                text
            })
        });
        
        // Atualizar o post específico na lista
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex].comments.unshift(data.comment);
        }
        
        showAlert('✅ Comentário adicionado!', 'success');
        return true;
    } catch (error) {
        showAlert(`❌ ${error.message}`, 'danger');
        return false;
    }
}

// ===== DATA FETCHING =====
async function fetchPosts() {
    try {
        const data = await apiCall(`/posts?sort=${currentSort}`);
        posts = data;
        refreshUI();
        return true;
    } catch (error) {
        showAlert(`❌ Erro ao carregar posts: ${error.message}`, 'danger');
        postsEl.innerHTML = `
            <div class="panel text-center">
                <h3>😕 Erro de Conexão</h3>
                <p class="text-muted">Não foi possível carregar os posts</p>
                <button class="btn btn-primary mt-2" onclick="fetchPosts()">Tentar Novamente</button>
            </div>
        `;
        return false;
    }
}

async function fetchOnlineUsers() {
    try {
        const data = await apiCall('/users/online');
        onlineUsers = data;
        renderUsersOnline();
        return true;
    } catch (error) {
        console.error('Erro ao carregar usuários online:', error);
        return false;
    }
}

async function fetchStats() {
    try {
        const data = await apiCall('/stats');
        updateStats(data);
        return true;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        return false;
    }
}

async function searchPosts(query) {
    if (!query || query.length < 2) {
        showAlert('🔍 Digite pelo menos 2 caracteres para pesquisar', 'warning');
        return;
    }
    
    try {
        showAlert('Pesquisando...', 'info');
        const data = await apiCall(`/posts/search?q=${encodeURIComponent(query)}`);
        displaySearchResults(data, query);
        return true;
    } catch (error) {
        showAlert(`❌ Erro na pesquisa: ${error.message}`, 'danger');
        return false;
    }
}

// ===== UI RENDERING =====
function refreshUI() {
    if (!isSearching) {
        renderPosts();
    }
    updateStats();
    
    postsCountEl.textContent = `Posts: ${posts.length}`;
}

function renderPosts() {
    if (posts.length === 0) {
        postsEl.innerHTML = `
            <div class="panel text-center">
                <h3>📝 Nenhum post ainda</h3>
                <p class="text-muted">Seja o primeiro a compartilhar algo interessante!</p>
                ${!currentUser ? `
                    <button class="btn btn-primary mt-2" onclick="showRegisterModal()">
                        Cadastre-se para postar
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    postsEl.innerHTML = posts.map(post => postHTML(post)).join('');
    attachPostListeners();
}

function postHTML(post) {
    const isAuthor = currentUser && currentUser.username === post.username;
    const canDelete = isAuthor || (currentUser && currentUser.isAdmin);
    const liked = currentUser ? post.likes.includes(currentUser.username) : false;
    const disliked = currentUser ? post.dislikes.includes(currentUser.username) : false;
    const avatar = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(post.username)}`;
    
    return `
    <div class="post" data-id="${post.id}">
        <div class="flex-between mb-1">
            <div class="meta">
                <img src="${avatar}" alt="${post.username}" class="user-avatar" loading="lazy">
                <div>
                    <strong>${escapeHTML(post.username)}</strong>
                    ${post.username === 'admin' ? '<span class="badge badge-admin">ADMIN</span>' : ''}
                    ${post.isNew ? '<span class="badge badge-new">NOVO</span>' : ''}
                </div>
            </div>
            <div class="text-muted">${post.timeAgo}</div>
        </div>
        
        <h4>${post.title}</h4>
        <p>${post.description}</p>
        
        <div class="actions">
            <button class="btn action-like ${liked ? 'active' : ''}" data-id="${post.id}">
                👍 ${post.likes.length}
            </button>
            <button class="btn action-dislike ${disliked ? 'active' : ''}" data-id="${post.id}">
                👎 ${post.dislikes.length}
            </button>
            <button class="btn" data-id="${post.id}" onclick="showComments('${post.id}')">
                💬 ${post.comments.length}
            </button>
            ${canDelete ? `
                <button class="btn btn-danger btn-delete" data-id="${post.id}" title="Excluir post">
                    🗑️ Excluir
                </button>
            ` : ''}
        </div>
    </div>`;
}

function displaySearchResults(results, query) {
    isSearching = true;
    searchResultsPanel.classList.remove('hidden');
    
    if (results.length === 0) {
        searchResultsEl.innerHTML = `
            <div class="panel text-center">
                <h3>🔍 Nenhum resultado</h3>
                <p class="text-muted">Não encontramos posts para "${query}"</p>
            </div>
        `;
        return;
    }
    
    searchResultsEl.innerHTML = results.map(post => postHTML(post)).join('');
    attachPostListeners();
}

function clearSearch() {
    isSearching = false;
    searchResultsPanel.classList.add('hidden');
    searchInput.value = '';
    refreshUI();
}

function attachPostListeners() {
    const container = isSearching ? searchResultsEl : postsEl;
    
    container.querySelectorAll('.action-like').forEach(btn => {
        btn.onclick = () => toggleLike(btn.dataset.id);
    });
    
    container.querySelectorAll('.action-dislike').forEach(btn => {
        btn.onclick = () => toggleDislike(btn.dataset.id);
    });
    
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deletePost(btn.dataset.id);
    });
}

function renderUsersOnline() {
    onlineCountEl.textContent = onlineUsers.length;
    
    if (onlineUsers.length === 0) {
        usersOnlineEl.innerHTML = '<p class="text-muted text-center">Nenhum usuário online</p>';
        return;
    }
    
    usersOnlineEl.innerHTML = onlineUsers.map(user => {
        const status = user.isAdmin ? 'Administrador' : 'Online';
        
        return `
        <div class="user-item">
            <img src="${user.avatar}" alt="${user.username}" class="user-avatar" loading="lazy">
            <div class="user-info">
                <div class="user-name">${escapeHTML(user.username)} ${user.isAdmin ? '👑' : ''}</div>
                <div class="user-status">${status}</div>
            </div>
        </div>`;
    }).join('');
}

function updateStats(stats) {
    if (stats) {
        statsPostsEl.textContent = stats.totalPosts;
        statsUsersEl.textContent = stats.totalUsers;
        statsOnlineEl.textContent = stats.onlineUsers;
        statsInteractionsEl.textContent = stats.totalInteractions;
    }
}

// ===== MODAL SYSTEM =====
function showModal(content) {
    modalContent.innerHTML = content;
    modalBackdrop.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Add ESC key listener
    document.addEventListener('keydown', handleEscKey);
    
    // Focus trap
    setTimeout(() => {
        const focusableElements = modalContent.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }, 100);
}

function closeModal() {
    modalBackdrop.style.display = 'none';
    document.body.style.overflow = 'auto';
    document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

function showLoginModal() {
    const content = `
        <div class="modal-header">
            <h2>🔐 Entrar na Cryptitys</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="mb-2">
            <input type="text" id="login-username" placeholder="Nome de usuário" autocomplete="username">
            <input type="password" id="login-password" placeholder="Senha" autocomplete="current-password">
        </div>
        <div class="flex-between">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="attemptLogin()">Entrar</button>
        </div>
        <p class="text-center mt-2 text-muted">
            Não tem uma conta? 
            <a href="#" onclick="showRegisterModal()" style="color: var(--accent);">Registre-se</a>
        </p>
        <div class="mt-2 text-center text-muted small">
            <p>Conta de teste:<br>Usuário: <strong>admin</strong> | Senha: <strong>admin</strong></p>
        </div>
    `;
    
    showModal(content);
    
    // Add enter key support
    const handleEnter = (e) => {
        if (e.key === 'Enter') attemptLogin();
    };
    
    document.getElementById('login-username').addEventListener('keypress', handleEnter);
    document.getElementById('login-password').addEventListener('keypress', handleEnter);
}

function showRegisterModal() {
    const content = `
        <div class="modal-header">
            <h2>🚀 Criar Conta</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="mb-2">
            <input type="text" id="register-username" placeholder="Nome de usuário" autocomplete="username">
            <input type="password" id="register-password" placeholder="Senha" autocomplete="new-password">
            <input type="password" id="register-confirm" placeholder="Confirmar senha" autocomplete="new-password">
        </div>
        <div class="flex-between">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="attemptRegister()">Registrar</button>
        </div>
        <p class="text-center mt-2 text-muted">
            Já tem uma conta? 
            <a href="#" onclick="showLoginModal()" style="color: var(--accent);">Entre aqui</a>
        </p>
    `;
    
    showModal(content);
    
    // Add enter key support
    const handleEnter = (e) => {
        if (e.key === 'Enter') attemptRegister();
    };
    
    document.getElementById('register-username').addEventListener('keypress', handleEnter);
    document.getElementById('register-password').addEventListener('keypress', handleEnter);
    document.getElementById('register-confirm').addEventListener('keypress', handleEnter);
}

function showComments(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const content = `
        <div class="modal-header">
            <h2>💬 Comentários</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="mb-2">
            <h3>${escapeHTML(post.title)}</h3>
            <p class="text-muted">
                por <strong>${escapeHTML(post.username)}</strong> • ${post.timeAgo}
            </p>
        </div>
        
        ${currentUser ? `
        <div class="mb-2">
            <textarea id="comment-text" placeholder="Escreva um comentário..." rows="3" maxlength="500"></textarea>
            <div class="flex-between mt-1">
                <span class="text-muted small" id="comment-char-count">0/500</span>
                <button class="btn btn-primary" onclick="addCommentFromModal('${postId}')">
                    Adicionar Comentário
                </button>
            </div>
        </div>
        ` : '<p class="text-center text-muted">🔒 Faça login para comentar</p>'}
        
        <div id="comments-list" style="max-height: 400px; overflow-y: auto;">
            ${post.comments.length > 0 ? 
                post.comments.map(comment => `
                    <div class="user-item">
                        <img src="${comment.avatar || `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(comment.username)}`}" 
                             alt="${comment.username}" class="user-avatar" loading="lazy">
                        <div class="user-info">
                            <div class="user-name">${escapeHTML(comment.username)}</div>
                            <div style="margin: 4px 0;">${comment.text}</div>
                            <div class="user-status">${comment.timeAgo}</div>
                        </div>
                    </div>
                `).join('') 
                : '<p class="text-center text-muted">💬 Nenhum comentário ainda</p>'
            }
        </div>
    `;
    
    showModal(content);
    
    // Character counter for comment
    const commentText = document.getElementById('comment-text');
    const commentCharCount = document.getElementById('comment-char-count');
    
    if (commentText) {
        commentText.addEventListener('input', function() {
            commentCharCount.textContent = `${this.value.length}/500`;
        });
        
        // Add enter key support (Ctrl+Enter to submit)
        commentText.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                addCommentFromModal(postId);
            }
        });
    }
    
    // Scroll to bottom of comments
    const commentsList = document.getElementById('comments-list');
    if (commentsList) {
        commentsList.scrollTop = commentsList.scrollHeight;
    }
}

// ===== MODAL ACTIONS =====
function attemptLogin() {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    
    if (!username || !password) {
        showAlert('📝 Preencha todos os campos', 'warning');
        return;
    }
    
    login(username, password);
}

function attemptRegister() {
    const username = document.getElementById('register-username')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const confirm = document.getElementById('register-confirm')?.value;
    
    if (!username || !password || !confirm) {
        showAlert('📝 Preencha todos os campos', 'warning');
        return;
    }
    
    if (password !== confirm) {
        showAlert('🔒 As senhas não coincidem', 'warning');
        return;
    }
    
    if (username.length < 3) {
        showAlert('👤 Nome de usuário deve ter pelo menos 3 caracteres', 'warning');
        return;
    }
    
    if (password.length < 3) {
        showAlert('🔒 Senha deve ter pelo menos 3 caracteres', 'warning');
        return;
    }
    
    register(username, password);
}

function addCommentFromModal(postId) {
    const text = document.getElementById('comment-text')?.value;
    
    if (!text || text.trim().length === 0) {
        showAlert('💬 Digite um comentário', 'warning');
        return;
    }
    
    addComment(postId, text).then(success => {
        if (success) {
            // Refresh the comments modal
            showComments(postId);
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <div class="flex-between">
            <span>${message}</span>
            <button class="btn btn-small" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to top of feed
    const feedSection = document.querySelector('.feed-section');
    if (feedSection.firstChild) {
        feedSection.insertBefore(alert, feedSection.firstChild);
    } else {
        feedSection.appendChild(alert);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function changeSort(sortType) {
    currentSort = sortType;
    
    // Update button states
    document.getElementById('btn-sort-recent').classList.toggle('active', sortType === 'recent');
    document.getElementById('btn-sort-popular').classList.toggle('active', sortType === 'popular');
    
    fetchPosts();
}

// ===== INITIALIZATION =====
async function loadInitialData() {
    try {
        // Test connection first
        await apiCall('/health');
        
        // Load all data in parallel
        await Promise.all([
            fetchPosts(),
            fetchOnlineUsers(),
            fetchStats()
        ]);
        
        console.log('✅ Cryptitys v3 carregado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
        showAlert('⚠️ Erro de conexão com o servidor. Algumas funcionalidades podem não estar disponíveis.', 'warning');
    }
}

async function init() {
    // Restore user session
    try {
        const savedUser = localStorage.getItem('cryptitys_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
        }
    } catch (e) {
        console.warn('❌ Erro ao restaurar sessão:', e);
        localStorage.removeItem('cryptitys_user');
    }
    
    updateUIForUser();
    await loadInitialData();
    
    // Set up auto-refresh every 10 seconds
    setInterval(async () => {
        if (!isSearching) {
            await Promise.all([
                fetchPosts(),
                fetchOnlineUsers(),
                fetchStats()
            ]);
        }
    }, 10000);
    
    // Set up scroll to top button
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.style.display = 'flex';
        } else {
            scrollToTopBtn.style.display = 'none';
        }
    });
    
    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Close modal when clicking backdrop
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });
    
    // Character counter for post description
    const postDesc = document.getElementById('post-desc');
    if (postDesc && charCountEl) {
        postDesc.addEventListener('input', function() {
            const length = this.value.length;
            charCountEl.textContent = `${length}/1000`;
            
            if (length > 900) {
                charCountEl.style.color = 'var(--warning)';
            } else if (length > 950) {
                charCountEl.style.color = 'var(--danger)';
            } else {
                charCountEl.style.color = 'var(--text-secondary)';
            }
        });
    }
    
    // Search functionality
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                searchPosts(query);
            }
        }
    });
    
    document.getElementById('btn-search').addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            searchPosts(query);
        }
    });
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    // Post creation
    document.getElementById('send-post').addEventListener('click', () => {
        const title = document.getElementById('post-title').value.trim();
        const desc = document.getElementById('post-desc').value.trim();
        
        createPost(title, desc).then(success => {
            if (success) {
                document.getElementById('post-title').value = '';
                document.getElementById('post-desc').value = '';
                charCountEl.textContent = '0/1000';
                charCountEl.style.color = 'var(--text-secondary)';
            }
        });
    });

    document.getElementById('clear-post').addEventListener('click', () => {
        document.getElementById('post-title').value = '';
        document.getElementById('post-desc').value = '';
        charCountEl.textContent = '0/1000';
        charCountEl.style.color = 'var(--text-secondary)';
    });

    // Auth buttons
    document.getElementById('btn-login').addEventListener('click', showLoginModal);
    document.getElementById('btn-register').addEventListener('click', showRegisterModal);
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    // Refresh and sort
    document.getElementById('btn-refresh').addEventListener('click', () => {
        showAlert('🔄 Atualizando...', 'info');
        loadInitialData();
    });
    
    document.getElementById('btn-sort-recent').addEventListener('click', () => changeSort('recent'));
    document.getElementById('btn-sort-popular').addEventListener('click', () => changeSort('popular'));
    
    // Search
    document.getElementById('btn-clear-search').addEventListener('click', clearSearch);
    
    // Profile
    document.getElementById('btn-profile').addEventListener('click', () => {
        if (currentUser) {
            showAlert(`👋 Bem-vindo ao seu perfil, ${currentUser.username}!`, 'info');
        } else {
            showLoginModal();
        }
    });

    // Initialize the application
    init();
});

// Make functions globally available for onclick handlers
window.showComments = showComments;
window.addCommentFromModal = addCommentFromModal;
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeModal = closeModal;
window.fetchPosts = fetchPosts;
window.clearSearch = clearSearch;
