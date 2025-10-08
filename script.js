// script.js - Lógica Frontend para Cryptitys (JS Puro)

// ----------------------------------------------------
// 1. Variáveis de Estado e Elementos do DOM
// ----------------------------------------------------
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentSort = 'recent'; // 'recent' ou 'popular'
let currentSearchQuery = '';
let currentPostIdForComment = null;

const DOM = {
    // Layout
    authButtons: document.getElementById('auth-buttons'),
    createPostPanel: document.getElementById('create-post-panel'),
    postsFeed: document.getElementById('posts-feed'),
    feedEmptyState: document.getElementById('feed-empty-state'),
    
    // Search
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    clearSearchBtn: document.getElementById('btn-clear-search'),
    
    // Sort
    sortRecentBtn: document.getElementById('sort-recent'),
    sortPopularBtn: document.getElementById('sort-popular'),

    // Create Post
    postTitle: document.getElementById('post-title'),
    postDescription: document.getElementById('post-description'),
    btnCreatePost: document.getElementById('btn-create-post'),
    btnClearPost: document.getElementById('btn-clear-post'),
    charCounterPost: document.getElementById('char-counter-post'),

    // Modals
    modalBackdrop: document.getElementById('modal-backdrop'),
    authModal: document.getElementById('auth-modal'),
    commentsModal: document.getElementById('comments-modal'),
    
    // Auth Forms
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authModalTitle: document.getElementById('auth-modal-title'),
    
    // Comments Modal
    commentsList: document.getElementById('comments-list'),
    commentTextInput: document.getElementById('comment-text-input'),
    btnAddComment: document.getElementById('btn-add-comment'),
    charCounterComment: document.getElementById('char-counter-comment'),
    commentLoginMessage: document.getElementById('comment-login-message'),
    
    // Stats & Online
    statPosts: document.getElementById('stat-posts'),
    statUsers: document.getElementById('stat-users'),
    statInteractions: document.getElementById('stat-interactions'),
    statOnline: document.getElementById('stat-online'),
    onlineUsersList: document.getElementById('online-users-list'),

    // Extras
    scrollToTopBtn: document.getElementById('scroll-to-top-btn'),
    alertContainer: document.getElementById('alert-container'),
};

// ----------------------------------------------------
// 2. Utilitários e Helpers
// ----------------------------------------------------

/**
 * @function apiCall
 * @description Wrapper para a Fetch API para simplificar chamadas e tratamento de erros.
 * @param {string} url - URL da API.
 * @param {string} method - Método HTTP (GET, POST, DELETE, etc.).
 * @param {object} [body=null] - Corpo da requisição.
 * @returns {Promise<object>} - Dados da resposta JSON.
 */
const apiCall = async (url, method = 'GET', body = null) => {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };

        // Adiciona o username para simular autenticação em todas as chamadas de API
        if (currentUser) {
            headers['X-Username'] = currentUser.username;
        }

        const options = {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : null,
        };

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || !data.success) {
            // Lança um erro para ser capturado no bloco catch
            throw new Error(data.message || `Erro de API (${response.status})`);
        }

        return data;

    } catch (error) {
        // Exibe o alerta de erro e relança
        showAlert(`Erro: ${error.message}`, 'danger');
        throw error;
    }
};

/**
 * @function showAlert
 * @description Cria e exibe um alerta auto-removível.
 * @param {string} message - Mensagem a ser exibida.
 * @param {'success'|'danger'|'warning'|'info'} type - Tipo de alerta.
 */
const showAlert = (message, type) => {
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = message;
    
    DOM.alertContainer.prepend(alertEl); // Adiciona no topo
    
    // Força o reflow para aplicar a transição (start hidden)
    requestAnimationFrame(() => alertEl.classList.add('show'));

    // Remove o alerta após 5 segundos
    setTimeout(() => {
        alertEl.classList.remove('show');
        alertEl.addEventListener('transitionend', () => alertEl.remove());
    }, 5000);
};

/**
 * @function timeAgo
 * @description Formata um timestamp para "X minutos atrás".
 * @param {string} timestamp - Timestamp ISO.
 * @returns {string}
 */
const timeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = now - past; // diferença em milissegundos
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}m atrás`;
    return 'agora';
};

/**
 * @function escapeHTML
 * @description Previne XSS escapando caracteres HTML.
 * @param {string} str - String a ser escapada.
 * @returns {string}
 */
const escapeHTML = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"'/]/g, (s) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    }[s]));
};


// ----------------------------------------------------
// 3. Gerenciamento de Modal
// ----------------------------------------------------

/**
 * @function showModal
 * @description Exibe um modal específico e o backdrop.
 * @param {string} modalId - ID do modal a ser exibido (e.g., 'auth-modal').
 */
const showModal = (modalId) => {
    DOM.modalBackdrop.classList.add('active');
    
    // Esconde todos os modais primeiro
    document.querySelectorAll('.modal-content').forEach(m => m.style.display = 'none');
    
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.style.display = 'block';
        
        // Foca no primeiro input para acessibilidade
        const firstInput = targetModal.querySelector('input, textarea');
        if (firstInput) firstInput.focus();
    }
};

/**
 * @function closeModal
 * @description Esconde o modal e o backdrop.
 */
const closeModal = (modalId) => {
    const targetModal = document.getElementById(modalId);
    if (targetModal) targetModal.style.display = 'none';

    // Se nenhum outro modal estiver visível, esconde o backdrop
    const visibleModals = document.querySelectorAll('.modal-content:not([style*="display: none"])');
    if (visibleModals.length === 0) {
        DOM.modalBackdrop.classList.remove('active');
    }
};

const showLoginModal = () => {
    DOM.authModalTitle.textContent = 'Login';
    DOM.loginForm.style.display = 'block';
    DOM.registerForm.style.display = 'none';
    showModal('auth-modal');
};

const showRegisterModal = () => {
    DOM.authModalTitle.textContent = 'Registro';
    DOM.loginForm.style.display = 'none';
    DOM.registerForm.style.display = 'block';
    showModal('auth-modal');
};

/**
 * @function showCommentsModal
 * @description Exibe o modal de comentários para um post específico.
 * @param {string} postId - ID do post.
 * @param {Array} comments - Array de comentários do post.
 */
const showCommentsModal = (postId, comments) => {
    currentPostIdForComment = postId;
    DOM.commentsList.innerHTML = ''; // Limpa a lista
    
    if (comments.length === 0) {
        DOM.commentsList.innerHTML = '<p style="text-align: center; color: #777;">Nenhum comentário ainda.</p>';
    } else {
        comments.forEach(c => DOM.commentsList.innerHTML += createCommentHTML(c));
    }
    
    // Mostra/Esconde a área de adicionar comentário dependendo do status de login
    if (currentUser && !currentUser.banned) {
        DOM.addCommentArea.style.display = 'block';
        DOM.commentLoginMessage.style.display = 'none';
    } else {
        DOM.addCommentArea.style.display = 'none';
        DOM.commentLoginMessage.style.display = 'block';
    }

    showModal('comments-modal');
};


// ----------------------------------------------------
// 4. Lógica de Autenticação
// ----------------------------------------------------

/**
 * @function updateUIForUser
 * @description Atualiza elementos da interface dependendo do status de login (currentUser).
 */
const updateUIForUser = () => {
    if (currentUser) {
        // Logado
        DOM.authButtons.innerHTML = `<button id="btn-logout" class="btn btn-secondary">Logout (${currentUser.username})</button>`;
        DOM.createPostPanel.style.display = currentUser.banned ? 'none' : 'block';
        document.getElementById('btn-logout').addEventListener('click', attemptLogout);
        
        if (currentUser.banned) {
             showAlert('Sua conta está banida. Você não pode interagir.', 'danger');
        }

    } else {
        // Deslogado
        DOM.authButtons.innerHTML = `
            <button id="btn-login" class="btn btn-primary">Login</button>
            <button id="btn-register" class="btn btn-secondary">Registro</button>
        `;
        DOM.createPostPanel.style.display = 'none';
        
        document.getElementById('btn-login').addEventListener('click', showLoginModal);
        document.getElementById('btn-register').addEventListener('click', showRegisterModal);
    }
    
    // Re-renderiza o feed para atualizar likes, dislikes e botões de delete
    fetchPosts();
};

/**
 * @function handleLogin
 * @description Tenta realizar o login.
 */
const attemptLogin = async (event) => {
    event.preventDefault();
    const username = DOM.loginForm.elements['login-username'].value;
    const password = DOM.loginForm.elements['login-password'].value;
    
    try {
        const data = await apiCall('/api/auth/login', 'POST', { username, password });
        
        // Atualiza o estado global e salva no localStorage
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showAlert(data.message, 'success');
        closeModal('auth-modal');
        updateUIForUser();

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function handleRegister
 * @description Tenta registrar um novo usuário.
 */
const attemptRegister = async (event) => {
    event.preventDefault();
    const username = DOM.registerForm.elements['register-username'].value;
    const password = DOM.registerForm.elements['register-password'].value;
    
    try {
        const data = await apiCall('/api/auth/register', 'POST', { username, password });
        
        showAlert(data.message, 'success');
        // Após o registro, alterna para o modal de login
        showLoginModal();

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function attemptLogout
 * @description Tenta realizar o logout.
 */
const attemptLogout = async () => {
    try {
        const data = await apiCall('/api/auth/logout', 'POST');
        
        // Limpa o estado global e o localStorage
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        showAlert(data.message, 'info');
        updateUIForUser();
        
    } catch (error) {
        // Logout falhou no backend, mas limpamos o frontend de qualquer forma
        currentUser = null;
        localStorage.removeItem('currentUser');
        updateUIForUser();
        showAlert('Sua sessão local foi encerrada.', 'info');
    }
};


// ----------------------------------------------------
// 5. Renderização de Posts e HTML
// ----------------------------------------------------

/**
 * @function createBadgeHTML
 * @description Gera o HTML para badges (ADMIN, NOVO, BANIDO).
 * @param {object} postOrUser - Objeto post ou user.
 * @returns {string} - HTML dos badges.
 */
const createBadgeHTML = (postOrUser) => {
    let badges = '';
    
    // Badge ADMIN
    if (postOrUser.isAdmin) {
        badges += `<span class="badge badge-admin" title="Administrador do Cryptitys">ADMIN</span>`;
    }

    // Badge NOVO (para posts)
    if (postOrUser.timestamp) {
        const postDate = new Date(postOrUser.timestamp);
        const diffHours = (new Date() - postDate) / (1000 * 60 * 60);
        if (diffHours < 24) {
            badges += `<span class="badge badge-new" title="Postado nas últimas 24 horas">NOVO</span>`;
        }
    }
    
    // Badge BANIDO (para usuários)
    if (postOrUser.banned) {
        badges += `<span class="badge badge-banned" title="Este usuário foi banido">BANIDO</span>`;
    }
    
    return badges;
};

/**
 * @function createCommentHTML
 * @description Gera o HTML para um comentário.
 * @param {object} comment - Objeto comentário.
 * @returns {string} - HTML do comentário.
 */
const createCommentHTML = (comment) => {
    const user = { username: comment.username, avatar: comment.avatar, isAdmin: false, banned: false }; // Simples para badges
    const isAdmin = currentUser && currentUser.isAdmin && comment.username !== currentUser.username; // Admin pode ver quem é admin
    
    // Recarrega o usuário para pegar status de admin
    const commentUser = usersOnlineData.find(u => u.username === comment.username) || user; 
    
    return `
        <div class="comment-item">
            <img src="${comment.avatar}" alt="${comment.username} Avatar">
            <div class="comment-content">
                <span class="username">${escapeHTML(comment.username)}${createBadgeHTML(commentUser)}</span>
                <span class="timestamp">${timeAgo(comment.timestamp)}</span>
                <p>${escapeHTML(comment.text)}</p>
            </div>
        </div>
    `;
};

/**
 * @function createPostHTML
 * @description Gera o HTML para um post.
 * @param {object} post - Objeto post.
 * @returns {string} - HTML do post.
 */
const createPostHTML = (post) => {
    const isAuthor = currentUser && currentUser.username === post.username;
    const isAdmin = currentUser && currentUser.isAdmin;
    const isBanned = currentUser && currentUser.banned;
    
    const canDelete = isAuthor || isAdmin;

    const liked = currentUser && post.likes.includes(currentUser.username) ? 'liked' : '';
    const disliked = currentUser && post.dislikes.includes(currentUser.username) ? 'disliked' : '';
    
    // Pega o avatar do autor
    const authorAvatar = `https://api.dicebear.com/9.x/identicon/svg?seed=${post.username}`;
    
    // Pega o objeto de usuário para verificar o status de admin
    const postUser = usersOnlineData.find(u => u.username === post.username) || { username: post.username, isAdmin: false, banned: false }; 

    return `
        <div class="card post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${authorAvatar}" alt="${post.username} Avatar">
                <div class="post-info">
                    <div class="username">${escapeHTML(post.username)}${createBadgeHTML(postUser)}</div>
                    <div class="timestamp">${timeAgo(post.timestamp)}</div>
                </div>
                ${canDelete ? `<button class="btn btn-icon delete-post-btn" data-id="${post.id}" title="Deletar Post"><span class="material-icons">delete</span></button>` : ''}
            </div>
            <div class="post-content">
                <h3>${escapeHTML(post.title)}</h3>
                <p>${escapeHTML(post.description)}</p>
            </div>
            <div class="post-actions">
                <div class="interaction-buttons">
                    <button class="like-btn ${liked}" data-id="${post.id}" ${isBanned ? 'disabled' : ''}>
                        <span class="material-icons">thumb_up</span> ${post.likes.length}
                    </button>
                    <button class="dislike-btn ${disliked}" data-id="${post.id}" ${isBanned ? 'disabled' : ''}>
                        <span class="material-icons">thumb_down</span> ${post.dislikes.length}
                    </button>
                    <button class="comment-btn" data-id="${post.id}" data-comments='${JSON.stringify(post.comments)}' ${isBanned ? 'disabled' : ''}>
                        <span class="material-icons">comment</span> ${post.comments.length} Comentários
                    </button>
                </div>
            </div>
        </div>
    `;
};

/**
 * @function renderPosts
 * @description Renderiza o feed de posts e anexa os event listeners.
 * @param {Array<object>} posts - Array de objetos post.
 */
const renderPosts = (posts) => {
    DOM.postsFeed.innerHTML = ''; // Limpa o feed

    if (posts.length === 0) {
        DOM.feedEmptyState.textContent = currentSearchQuery ? 'Nenhum post encontrado com este termo.' : 'Ainda não há posts no feed.';
        DOM.postsFeed.appendChild(DOM.feedEmptyState);
        return;
    }
    
    // Remove o estado vazio se houver posts
    if (DOM.feedEmptyState.parentNode) {
        DOM.postsFeed.removeChild(DOM.feedEmptyState);
    }
    
    posts.forEach(post => {
        DOM.postsFeed.innerHTML += createPostHTML(post);
    });

    // Anexa listeners para os botões recém-renderizados
    attachPostListeners();
};

/**
 * @function attachPostListeners
 * @description Anexa os event listeners para botões de like, dislike, comment e delete.
 */
const attachPostListeners = () => {
    // Deleção
    document.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.onclick = (e) => {
            if (confirm('Tem certeza que deseja deletar este post?')) {
                attemptDeletePost(e.currentTarget.dataset.id);
            }
        };
    });
    
    // Likes
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.onclick = (e) => attemptToggleLike(e.currentTarget.dataset.id);
    });

    // Dislikes
    document.querySelectorAll('.dislike-btn').forEach(btn => {
        btn.onclick = (e) => attemptToggleDislike(e.currentTarget.dataset.id);
    });
    
    // Comentários
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.onclick = (e) => {
            const postId = e.currentTarget.dataset.id;
            // O atributo data-comments é uma string JSON, precisa ser parseado
            const comments = JSON.parse(e.currentTarget.dataset.comments || '[]'); 
            showCommentsModal(postId, comments);
        };
    });
};

// ----------------------------------------------------
// 6. Funções de Fetch da API (Posts, Stats, Online)
// ----------------------------------------------------
let usersOnlineData = []; // Armazena a lista completa de usuários online para renderização de badges

/**
 * @function fetchPosts
 * @description Busca posts do backend, com opção de busca.
 * @param {string} [query=''] - Termo de busca.
 */
const fetchPosts = async (query = '') => {
    currentSearchQuery = query;
    try {
        let url = '/api/posts';
        if (query) {
            url = `/api/posts/search?q=${encodeURIComponent(query)}`;
            DOM.sortRecentBtn.style.display = 'none';
            DOM.sortPopularBtn.style.display = 'none';
            DOM.clearSearchBtn.classList.remove('btn-hidden');
        } else {
            // Se não houver busca, usa o sorting atual
            url += `?sort=${currentSort}`;
            DOM.sortRecentBtn.style.display = 'inline-block';
            DOM.sortPopularBtn.style.display = 'inline-block';
            DOM.clearSearchBtn.classList.add('btn-hidden');
        }

        const data = await apiCall(url);
        renderPosts(data.posts);

    } catch (error) {
        // Erro tratado no apiCall, mas podemos limpar o feed
        DOM.postsFeed.innerHTML = '<p style="text-align: center; color: var(--color-danger); margin-top: 50px;">Erro ao carregar posts.</p>';
        console.error("Fetch Posts Error:", error);
    }
};

/**
 * @function fetchStats
 * @description Busca e atualiza as estatísticas.
 */
const fetchStats = async () => {
    try {
        const data = await apiCall('/api/stats');
        DOM.statPosts.textContent = data.stats.totalPosts;
        DOM.statUsers.textContent = data.stats.totalUsers;
        DOM.statInteractions.textContent = data.stats.totalInteractions;
        DOM.statOnline.textContent = data.stats.onlineUsers;
    } catch (error) {
        console.error("Fetch Stats Error:", error);
    }
};

/**
 * @function fetchOnlineUsers
 * @description Busca a lista de usuários online.
 */
const fetchOnlineUsers = async () => {
    try {
        const data = await apiCall('/api/users/online');
        const onlineUsernames = data.onlineUsers;
        
        // Pega todos os usuários para encontrar o status de admin
        const allUsersData = await apiCall('/api/users'); // Rota extra que o backend precisa ter para isso

        // Como não temos a rota /api/users no backend, simulamos a busca a partir dos dados do online.
        // A melhor prática seria ter a rota /api/users para buscar todos.
        // Vamos simular a admin a partir do username "admin"
        
        usersOnlineData = onlineUsernames.map(u => ({ 
            username: u, 
            isAdmin: u === 'admin',
            avatar: `https://api.dicebear.com/9.x/identicon/svg?seed=${u}`,
            banned: false // Simples
        }));


        DOM.onlineUsersList.innerHTML = onlineUsernames.map(u => {
            const user = usersOnlineData.find(ou => ou.username === u);
            return `<li>${escapeHTML(u)}${createBadgeHTML(user)}</li>`;
        }).join('');

    } catch (error) {
        console.error("Fetch Online Users Error:", error);
    }
};

// ----------------------------------------------------
// 7. Funções de Interação (Criar, Deletar, Curtir, Comentar)
// ----------------------------------------------------

/**
 * @function attemptCreatePost
 * @description Tenta criar um novo post.
 */
const attemptCreatePost = async () => {
    const title = DOM.postTitle.value.trim();
    const description = DOM.postDescription.value.trim();
    
    // Validações Front-end
    if (!title || title.length < 3) {
        return showAlert('O título deve ter no mínimo 3 caracteres.', 'warning');
    }
    if (!description || description.length < 10) {
        return showAlert('A descrição deve ter no mínimo 10 caracteres.', 'warning');
    }
    
    if (!currentUser || currentUser.banned) {
        return showAlert('Você precisa estar logado para criar um post.', 'danger');
    }

    try {
        const data = await apiCall('/api/posts', 'POST', { title, description });
        
        showAlert(data.message, 'success');
        
        // Limpa o formulário e re-renderiza o feed
        DOM.postTitle.value = '';
        DOM.postDescription.value = '';
        DOM.charCounterPost.textContent = '0/500';
        await fetchPosts();

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function attemptDeletePost
 * @description Tenta deletar um post.
 * @param {string} postId - ID do post.
 */
const attemptDeletePost = async (postId) => {
    if (!currentUser) {
        return showAlert('Você precisa estar logado para deletar posts.', 'danger');
    }

    try {
        const data = await apiCall(`/api/posts/${postId}`, 'DELETE');
        
        showAlert(data.message, 'success');
        
        // Remove o post do DOM e atualiza o feed
        document.querySelector(`.post-card[data-post-id="${postId}"]`).remove();
        fetchStats(); // Atualiza contador de posts

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function attemptToggleLike
 * @description Tenta curtir/descurtir um post.
 * @param {string} postId - ID do post.
 */
const attemptToggleLike = async (postId) => {
    if (!currentUser) return showAlert('Você precisa estar logado para curtir.', 'warning');
    if (currentUser.banned) return showAlert('Usuários banidos não podem curtir.', 'danger');

    try {
        const data = await apiCall(`/api/posts/${postId}/like`, 'POST');
        showAlert(data.message, 'info');
        
        // Atualiza o post individualmente no DOM
        updatePostCard(postId, data.post);
        fetchStats();

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function attemptToggleDislike
 * @description Tenta descurtir/remover descurtida de um post.
 * @param {string} postId - ID do post.
 */
const attemptToggleDislike = async (postId) => {
    if (!currentUser) return showAlert('Você precisa estar logado para descurtir.', 'warning');
    if (currentUser.banned) return showAlert('Usuários banidos não podem descurtir.', 'danger');

    try {
        const data = await apiCall(`/api/posts/${postId}/dislike`, 'POST');
        showAlert(data.message, 'info');

        // Atualiza o post individualmente no DOM
        updatePostCard(postId, data.post);
        fetchStats();

    } catch (error) {
        // Erro já tratado no apiCall
    }
};

/**
 * @function updatePostCard
 * @description Atualiza um post específico no DOM após uma interação.
 * @param {string} postId - ID do post.
 * @param {object} updatedPost - Post atualizado do backend.
 */
const updatePostCard = (postId, updatedPost) => {
    const postElement = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (postElement) {
        // Recria o HTML do post com os dados atualizados e substitui
        const newPostHTML = createPostHTML(updatedPost);
        
        // Cria um elemento temporário para o novo HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newPostHTML;
        const newPostElement = tempDiv.firstChild;
        
        postElement.parentNode.replaceChild(newPostElement, postElement);
        
        // Re-anexa os listeners ao novo post
        attachPostListeners(); 
    }
};

/**
 * @function attemptAddComment
 * @description Tenta adicionar um comentário.
 */
const attemptAddComment = async () => {
    const postId = currentPostIdForComment;
    const text = DOM.commentTextInput.value.trim();

    // Validação Front-end
    if (!text || text.length < 1) {
        return showAlert('O comentário não pode estar vazio.', 'warning');
    }
    
    if (!currentUser || currentUser.banned) {
        return showAlert('Você precisa estar logado para comentar.', 'danger');
    }

    try {
        const data = await apiCall(`/api/posts/${postId}/comments`, 'POST', { text });
        
        showAlert(data.message, 'success');
        
        // 1. Adiciona o comentário à lista do modal
        const emptyState = DOM.commentsList.querySelector('p');
        if (emptyState) emptyState.remove(); // Remove o "Nenhum comentário"
        DOM.commentsList.innerHTML += createCommentHTML(data.comment);

        // 2. Limpa o input
        DOM.commentTextInput.value = '';
        DOM.charCounterComment.textContent = '0/200';
        
        // 3. Re-renderiza o feed principal para atualizar a contagem de comentários no post-card
        await fetchPosts();
        
        fetchStats(); // Atualiza interações

    } catch (error) {
        // Erro já tratado no apiCall
    }
};


// ----------------------------------------------------
// 8. Inicialização e Event Listeners
// ----------------------------------------------------

/**
 * @function init
 * @description Função de inicialização do frontend.
 */
const init = () => {
    // 1. Restaura sessão e atualiza UI
    updateUIForUser();
    
    // 2. Carrega dados iniciais e configura auto-refresh
    fetchStats();
    fetchPosts();
    fetchOnlineUsers();
    
    // Auto-refresh a cada 10s
    setInterval(() => {
        if (!DOM.modalBackdrop.classList.contains('active')) {
            fetchStats();
            fetchOnlineUsers();
            if (!currentSearchQuery) {
                fetchPosts();
            }
        }
    }, 10000); // 10 segundos
    
    // 3. Listeners de Formulários
    DOM.loginForm.addEventListener('submit', attemptLogin);
    DOM.registerForm.addEventListener('submit', attemptRegister);
    
    // 4. Listeners de Postagem
    DOM.btnCreatePost.addEventListener('click', attemptCreatePost);
    DOM.btnClearPost.addEventListener('click', () => {
        DOM.postTitle.value = '';
        DOM.postDescription.value = '';
        DOM.charCounterPost.textContent = '0/500';
    });
    
    // 5. Listeners de Search
    const debounceSearch = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    const delayedSearch = debounceSearch(() => {
        fetchPosts(DOM.searchInput.value.trim());
    }, 500); // Debounce de 500ms
    
    DOM.searchInput.addEventListener('input', delayedSearch);
    DOM.searchBtn.addEventListener('click', () => fetchPosts(DOM.searchInput.value.trim()));
    DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        fetchPosts('');
    });
    
    // 6. Listeners de Ordenação
    DOM.sortRecentBtn.addEventListener('click', () => {
        currentSort = 'recent';
        DOM.sortRecentBtn.classList.add('btn-active');
        DOM.sortPopularBtn.classList.remove('btn-active');
        fetchPosts();
    });
    
    DOM.sortPopularBtn.addEventListener('click', () => {
        currentSort = 'popular';
        DOM.sortPopularBtn.classList.add('btn-active');
        DOM.sortRecentBtn.classList.remove('btn-active');
        fetchPosts();
    });

    // 7. Listeners de Comentário
    DOM.btnAddComment.addEventListener('click', attemptAddComment);
    
    // 8. Contadores de Caracteres
    DOM.postDescription.addEventListener('input', () => {
        DOM.charCounterPost.textContent = `${DOM.postDescription.value.length}/500`;
    });
    DOM.commentTextInput.addEventListener('input', () => {
        DOM.charCounterComment.textContent = `${DOM.commentTextInput.value.length}/200`;
    });
    
    // 9. Scroll-to-Top Button
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            DOM.scrollToTopBtn.style.display = 'block';
        } else {
            DOM.scrollToTopBtn.style.display = 'none';
        }
    });

    DOM.scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // 10. Eventos Globais (ESC e Backdrop)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.modalBackdrop.classList.contains('active')) {
            // Fecha o modal visível
            const visibleModal = document.querySelector('.modal-content:not([style*="display: none"])');
            if (visibleModal) closeModal(visibleModal.id);
        }
    });

    DOM.modalBackdrop.addEventListener('click', (e) => {
        // Se clicar no backdrop (e não no conteúdo do modal)
        if (e.target === DOM.modalBackdrop) {
            const visibleModal = document.querySelector('.modal-content:not([style*="display: none"])');
            if (visibleModal) closeModal(visibleModal.id);
        }
    });

    // 11. Enter/Ctrl+Enter
    DOM.loginForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin(e);
    });
    DOM.registerForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptRegister(e);
    });
    DOM.commentTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            attemptAddComment();
        }
    });
};

document.addEventListener('DOMContentLoaded', init);
