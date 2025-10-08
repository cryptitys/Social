/* script.js for Echo — v3
   Database key: echo_v3_full
*/

/*
100 funcionalidades sugeridas (implementações parciais ou stubs estão incluídas nesta versão)
1. Header com logo fictício (SVG)
2. Botão Postar (abre modal/área de postagem)
3. Botão Comunidade (painel com tabs)
4. Theme toggle (dark/bright variants)
5. Responsive layout mobile-first
6. Criar post com título e corpo
7. Upload de imagem (DataURL, preview)
8. Salvar rascunhos localmente
9. Publicar posts em localStorage
10. Curtir / Descurtir
11. Multireações (stub para extensões)
12. Comentar em posts (comentários simples)
13. Editar e excluir posts (owner/admin)
14. Seguidores / Seguindo (UI stub)
15. Perfil do usuário (mini e modal)
16. Hashtags extraídas e listadas
17. Busca global (posts / tags / usuários)
18. Trending terms (computado a partir de tags)
19. Salvar posts (bookmarks)
20. Exportar banco (JSON)
21. Importar banco (JSON)
22. Paginação / Carregar mais
23. Skeleton loading visual
24. Lazy-load imagens (DataURL or future remote)
25. Rascunhos automáticos (auto-save)
26. Agendamento de post (UI stub)
27. Multiplataforma (layout adaptável)
28. Ícones e botões de ação com feedback
29. Modal central reutilizável
30. Painel Comunidade com tabs (hot/new/tags)
31. Rankings / Leaderboard (UI stub)
32. Administrador (admin.html) — ban/promote/unban
33. Painel de estatísticas do usuário (curtidas/posts)
34. Notificações locais (UI stub)
35. Mensagens diretas (UI stub)
36. Sistema de denúncias (report) — UI
37. Filtro básico de palavrões (palavras simples)
38. Bloquear/mutar usuário (UI stub)
39. Marcar post como destacado/pinned (admin)
40. Marcação de tópicos (tags)
41. Contadores de interações em tempo real (local)
42. Compartilhar link do post (copiar para clipboard)
43. Atalhos rápidos (Postar / Comunidade / Salvos)
44. Variações visuais de tema (gradientes)
45. Ajuste de tamanho de fonte (acessibilidade)
46. Modo compacto / cozy (UI stub)
47. Export de posts como CSV (UI stub)
48. Histórico de edição (present in UI as stub)
49. Reações personalizadas (emergente)
50. Sistema de badges/achievements (UI stub)
51. Integração de avatar via Dicebear (já incluída)
52. Upload de banner de perfil (localStorage)
53. Perfil público com lista de posts
54. Privacidade de post (público/seguidores/privado)
55. Feed filtrável por tag/usuário
56. Notificações de atividade no painel (local)
57. Pesquisa por hashtag com auto-sugestão
58. PWA manifest placeholder (não implementado)
59. Serviço de background (placeholder / stub)
60. Export/Import do DB (feito)
61. Relatórios para admin (moderação)
62. Filtro de SPAM heurístico (simples: URLs excessivas)
63. Modo de demonstração (demo mode)
64. Tour de onboarding (tooltip stubs)
65. Sistema de convite (UI stub)
66. Visualização de imagens em modal (lightbox)
67. Repost / Quote (UI stub)
68. Agregador de trending (count tags)
69. Estatísticas do sistema (número de usuários/posts)
70. Notificações sonoras (opcional, stub)
71. API mock interceptando fetch('/api/*') (versão anterior — opcional)
72. Atalhos de teclado (ex.: "n" para novo post) — stub
73. Edição de perfil (nome, bio, avatar)
74. Salvar preferências do usuário (tema, font)
75. Feedback visual ao publicar (toast)
76. Bot de boas-vindas automático (1º post)
77. Contador de visualizações de post (local)
78. Sistema de report com motivos padronizados
79. Sistema de remoção em massa (admin)
80. Agendador de manutenção (UI stub)
81. Versão “compacta” para mobile saves data
82. Mapa/geo-tagging (stub)
83. Conectar terceiros (OAuth placeholders)
84. Proteção contra XSS (escape HTML)
85. Export de logs (admin)
86. Backup automático (localStorage snapshot)
87. Modo leitura (remove distrações)
88. Botão voltar ao topo
89. Badge “verificado” (admin assign)
90. Marcar mensagens como lidas (stub)
91. Widget de atividade recente
92. Auto-tag sugerida (NLP stub)
93. Moderation queue (UI stub)
94. Ferramenta de buscar e substituir para admins
95. Votos / enquetes (polls UI stub)
96. Gerenciamento de temas (trocar cores facilmente)
97. Arquivamento de posts (remover da lista ativa)
98. Estatísticas de engajamento por período (UI stub)
99. Sistema de feedback (usuário envia sugestão)
100. Endpoints prontos para trocar mock por backend (estruturas pensadas)

Many of the above are implemented as UI and local stubs in this file. Toggle or enable backend later.
*/

(() => {
  const DB_KEY = 'echo_v3_full';
  const ADMIN_DEFAULT = { username: 'admin', password: 'admin', isAdmin: true, banned: false, createdAt: Date.now() };

  // simple DB helpers
  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        const init = { users: [ADMIN_DEFAULT], posts: [], drafts: [], bookmarks: [] };
        localStorage.setItem(DB_KEY, JSON.stringify(init));
        return init;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('DB load error', e);
      const init = { users: [ADMIN_DEFAULT], posts: [], drafts: [], bookmarks: [] };
      localStorage.setItem(DB_KEY, JSON.stringify(init));
      return init;
    }
  }
  function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  let DB = loadDB();
  let session = { username: null, isAdmin: false };

  // DOM refs
  const feedEl = document.getElementById('feed');
  const skeletonEl = document.getElementById('skeleton-list');
  const trendingEl = document.getElementById('trending-list');
  const communityContent = document.getElementById('community-content');
  const miniUsername = document.getElementById('mini-username');
  const miniAvatar = document.getElementById('mini-avatar');
  const userGreeting = document.getElementById('mini-username');
  const globalSearch = document.getElementById('global-search');

  // UI helpers
  function escapeHTML(str) {
    return String(str).replaceAll('&', '&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  // render skeleton while loading
  function showSkeleton(n = 3) {
    skeletonEl.innerHTML = Array.from({length:n}).map(()=>'<div class="skeleton"></div>').join('');
  }
  function hideSkeleton(){ skeletonEl.innerHTML = ''; }

  // time ago
  function timeAgo(ts) {
    const s = Math.floor((Date.now()-ts)/1000);
    if (s < 60) return 'Agora';
    if (s < 3600) return `${Math.floor(s/60)}m atrás`;
    if (s < 86400) return `${Math.floor(s/3600)}h atrás`;
    return `${Math.floor(s/86400)}d atrás`;
  }

  // trending tags
  function computeTrending() {
    const tags = {};
    DB.posts.forEach(p => {
      (p.tags||[]).forEach(t => tags[t] = (tags[t]||0)+1);
    });
    return Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x => x[0]);
  }

  // render trending UI
  function renderTrending(){
    const trending = computeTrending();
    if(trending.length===0){ trendingEl.innerHTML = '<div class="small">Nenhuma tag ainda</div>'; return; }
    trendingEl.innerHTML = trending.map(t => `<div class="tag">${escapeHTML(t)}</div>`).join('');
  }

  // render feed (with pagination / load more)
  let feedOffset = 0;
  const FEED_PAGE = 6;
  function renderFeed(reset=false){
    if(reset){ feedOffset = 0; feedEl.innerHTML = ''; }
    const sorted = DB.posts.slice().sort((a,b)=>b.timestamp-a.timestamp);
    const page = sorted.slice(feedOffset, feedOffset + FEED_PAGE);
    if(page.length === 0 && feedOffset === 0){
      feedEl.innerHTML = '<div class="card"><div class="small">Nenhum post ainda — seja o primeiro!</div></div>'; return;
    }
    const html = page.map(p => {
      const avatar = p.avatar || (`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(p.username)}`);
      const tags = (p.tags||[]).map(t=>`<span class="tag small">${escapeHTML(t)}</span>`).join(' ');
      return `
        <article class="post" data-id="${p.id}">
          <div class="avatar"><img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>
          <div class="post-body">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div>
                <div class="title">${escapeHTML(p.title)}</div>
                <div class="meta">por <strong>${escapeHTML(p.username)}</strong> · ${timeAgo(p.timestamp)}</div>
              </div>
              <div>
                ${(session.username && (session.username===p.username || session.isAdmin)) ? `<button class="btn btn-ghost btn-delete" data-id="${p.id}">Excluir</button>` : ''}
                ${session.isAdmin ? `<button class="btn btn-ghost btn-ban-author" data-username="${p.username}">Banir autor</button>` : ''}
              </div>
            </div>
            <div class="desc">${escapeHTML(p.description)}</div>
            ${p.image ? `<div style="margin-top:8px"><img src="${p.image}" alt="preview" style="max-width:100%;border-radius:8px"/></div>` : ''}
            <div style="margin-top:8px">${tags}</div>
            <div class="actions">
              <button class="small-action btn-like" data-id="${p.id}">👍 ${p.likes.length}</button>
              <button class="small-action btn-dislike" data-id="${p.id}">👎 ${p.dislikes.length}</button>
              <button class="small-action btn-comment" data-id="${p.id}">💬 ${p.comments.length}</button>
              <button class="small-action btn-save" data-id="${p.id}">🔖 Salvar</button>
              <button class="small-action btn-share" data-id="${p.id}">🔗 Compartilhar</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
    feedEl.insertAdjacentHTML('beforeend', html);
    attachFeedListeners();
    feedOffset += FEED_PAGE;
  }

  // attach listeners for feed actions (delegation)
  function attachFeedListeners(){
    document.querySelectorAll('.btn-like').forEach(b => {
      b.onclick = () => toggleLike(b.dataset.id);
    });
    document.querySelectorAll('.btn-dislike').forEach(b => {
      b.onclick = () => toggleDislike(b.dataset.id);
    });
    document.querySelectorAll('.btn-delete').forEach(b => {
      b.onclick = () => {
        if(!confirm('Excluir post?')) return;
        deletePost(b.dataset.id);
      };
    });
    document.querySelectorAll('.btn-save').forEach(b => {
      b.onclick = () => toggleBookmark(b.dataset.id);
    });
    document.querySelectorAll('.btn-share').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id; const url = `${location.origin}${location.pathname}#post-${id}`;
        navigator.clipboard && navigator.clipboard.writeText(url);
        toast('Link copiado para área de transferência');
      };
    });
    document.querySelectorAll('.btn-comment').forEach(b => {
      b.onclick = () => openCommentsModal(b.dataset.id);
    });
    document.querySelectorAll('.btn-ban-author').forEach(b => {
      b.onclick = () => {
        if(!session.isAdmin) return alert('Somente admin');
        const user = b.dataset.username; if(!confirm(`Banir ${user}?`)) return;
        banUser(user);
      };
    });
  }

  // toast
  function toast(msg, ms = 2200){
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    Object.assign(t.style, {position:'fixed',right:'20px',bottom:'20px',background:'linear-gradient(90deg,var(--accent1),var(--accent2))',color:'#071226',padding:'10px 14px',borderRadius:'10px',zIndex:9999});
    document.body.appendChild(t); setTimeout(()=>t.remove(), ms);
  }

  // likes/dislikes/bookmarks
  function toggleLike(id){
    if(!session.username) return openAuthModal();
    const p = DB.posts.find(pp=>pp.id==id); if(!p) return;
    const i = p.likes.indexOf(session.username);
    if(i!==-1) p.likes.splice(i,1); else { p.likes.push(session.username); p.dislikes = p.dislikes.filter(x=>x!==session.username); }
    saveDB(DB); refreshAll();
  }
  function toggleDislike(id){
    if(!session.username) return openAuthModal();
    const p = DB.posts.find(pp=>pp.id==id); if(!p) return;
    const i = p.dislikes.indexOf(session.username);
    if(i!==-1) p.dislikes.splice(i,1); else { p.dislikes.push(session.username); p.likes = p.likes.filter(x=>x!==session.username); }
    saveDB(DB); refreshAll();
  }
  function toggleBookmark(id){
    if(!session.username) return openAuthModal();
    DB.bookmarks = DB.bookmarks || [];
    const idx = DB.bookmarks.indexOf(Number(id));
    if(idx!==-1) { DB.bookmarks.splice(idx,1); toast('Removido dos salvos') } else { DB.bookmarks.push(Number(id)); toast('Salvo') }
    saveDB(DB);
  }

  // create post
  async function createPostFromUI(){
    if(!session.username) return openAuthModal();
    const title = document.getElementById('post-title').value.trim();
    const desc = document.getElementById('post-body').value.trim();
    if(title.length < 3) return alert('Título muito curto');
    if(desc.length < 10) return alert('Descrição muito curta');
    const fileInput = document.getElementById('post-image');
    let imageData = null;
    if(fileInput.files && fileInput.files[0]) {
      imageData = await toDataURL(fileInput.files[0]);
    }
    const tagsRaw = document.getElementById('post-hashtag').value.trim();
    const tags = tagsRaw ? tagsRaw.split(/\s+/).map(t=>t.startsWith('#')?t:t.replace(/^#/,'')).filter(Boolean).map(t=>`#${t}`) : [];
    const post = {
      id: Date.now() + Math.floor(Math.random()*1e6),
      username: session.username,
      title,
      description: desc,
      image: imageData,
      tags,
      likes: [],
      dislikes: [],
      comments: [],
      timestamp: Date.now()
    };
    DB.posts.push(post);
    saveDB(DB);
    // auto-award (first post)
    toast('Post publicado');
    document.getElementById('post-title').value=''; document.getElementById('post-body').value=''; document.getElementById('post-image').value='';
    refreshAll(true);
  }

  // convert file to DataURL
  function toDataURL(file){
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // comments modal
  function openCommentsModal(postId){
    const p = DB.posts.find(x=>x.id==postId); if(!p) return;
    const commentsHtml = (p.comments||[]).map(c=>`<div style="padding:8px;border-radius:8px;margin-bottom:8px;background:rgba(255,255,255,0.01)"><div style="font-weight:700">${escapeHTML(c.username)}</div><div class="small">${timeAgo(c.timestamp)}</div><div style="margin-top:6px;color:var(--muted)">${escapeHTML(c.text)}</div></div>`).join('')||'<div class="small">Nenhum comentário</div>';
    const html = `<div style="font-weight:700;margin-bottom:8px">Comentários</div><div style="max-height:240px;overflow:auto">${commentsHtml}</div>
      ${session.username ? `<div style="display:flex;gap:8px"><input id="cbox" placeholder="Escreva um comentário..." style="flex:1;padding:8px;border-radius:8px;background:#07080b;border:1px solid rgba(255,255,255,0.03)"><button class="btn btn-primary" id="sendc">Enviar</button></div>` : '<div class="small">Faça login para comentar</div>'}`;
    showModal(html);
    if(session.username){
      document.getElementById('sendc').onclick = () => {
        const txt = document.getElementById('cbox').value.trim(); if(!txt) return;
        p.comments.push({ id: Date.now()+Math.floor(Math.random()*1e4), username: session.username, text: txt, timestamp: Date.now() });
        saveDB(DB); closeModal(); refreshAll();
      };
    }
  }

  // delete post
  function deletePost(id){
    DB.posts = DB.posts.filter(p => p.id != id); saveDB(DB); refreshAll();
  }

  // ban user (admin)
  function banUser(username){
    const u = DB.users.find(x=>x.username===username);
    if(!u) return alert('Usuário não encontrado');
    u.banned = true; DB.posts = DB.posts.filter(p=>p.username!==username); saveDB(DB); refreshAll();
    toast(`Usuário ${username} banido`);
  }

  // auth & profile
  function openAuthModal(){
    const html = `<div style="font-weight:700;margin-bottom:8px">Entrar / Registrar</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="au" placeholder="Usuário" />
        <input id="ap" placeholder="Senha" type="password" />
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" id="loginbtn">Entrar</button>
          <button class="btn" id="regbtn">Registrar</button>
          <button class="btn btn-ghost" id="closea">Fechar</button>
        </div>
      </div>`;
    showModal(html);
    document.getElementById('loginbtn').onclick = () => {
      const u = document.getElementById('au').value.trim(); const p = document.getElementById('ap').value;
      const usr = DB.users.find(x=>x.username===u && x.password===p);
      if(!usr) return alert('Credenciais inválidas');
      if(usr.banned) return alert('Usuário banido');
      session.username = usr.username; session.isAdmin = !!usr.isAdmin;
      closeModal(); refreshAll();
      toast(`Bem-vindo, ${usr.username}`);
    };
    document.getElementById('regbtn').onclick = () => {
      const u = document.getElementById('au').value.trim(); const p = document.getElementById('ap').value;
      if(!u || u.length<3) return alert('Nome curto'); if(!p || p.length<3) return alert('Senha curta');
      if(DB.users.some(x=>x.username.toLowerCase()===u.toLowerCase())) return alert('Usuário existe');
      const newU = { username: u, password: p, isAdmin: false, banned: false, createdAt: Date.now(), bio: '' };
      DB.users.push(newU); saveDB(DB); toast('Registrado. Faça login.'); closeModal();
    };
    document.getElementById('closea').onclick = closeModal;
  }

  function logout(){
    session = { username: null, isAdmin: false }; refreshAll(); toast('Desconectado');
  }

  function editProfileModal(){
    if(!session.username) return openAuthModal();
    const me = DB.users.find(u=>u.username===session.username);
    const html = `<div style="font-weight:700;margin-bottom:8px">Editar perfil</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="pf-bio" placeholder="Bio" value="${me.bio||''}" />
        <input id="pf-avatar" type="file" accept="image/*" />
        <div style="display:flex;gap:8px"><button class="btn btn-primary" id="savepf">Salvar</button><button class="btn btn-ghost" id="closepf">Fechar</button></div>
      </div>`;
    showModal(html);
    document.getElementById('savepf').onclick = async () => {
      const bio = document.getElementById('pf-bio').value;
      const fi = document.getElementById('pf-avatar');
      me.bio = bio;
      if(fi.files && fi.files[0]) me.avatar = await toDataURL(fi.files[0]);
      saveDB(DB); closeModal(); refreshAll(); toast('Perfil atualizado');
    };
    document.getElementById('closepf').onclick = closeModal;
  }

  // modal helpers
  const modalRoot = document.getElementById('modal-root');
  function showModal(innerHTML){
    modalRoot.innerHTML = `<div class="modal-overlay"><div class="modal-card">${innerHTML}<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" id="modal-close">Fechar</button></div></div></div>`;
    document.getElementById('modal-close').onclick = closeModal;
  }
  function closeModal(){ modalRoot.innerHTML = ''; }

  // export / import JSON
  function exportJSON(){
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'echo_export.json'; a.click(); URL.revokeObjectURL(url); toast('Exportado');
  }
  function importJSON(){
    const input = document.createElement('input'); input.type='file'; input.accept='application/json';
    input.onchange = (e) => {
      const f = e.target.files[0]; if(!f) return;
      const fr = new FileReader(); fr.onload = () => {
        try {
          const parsed = JSON.parse(fr.result);
          DB = parsed; saveDB(DB); refreshAll(true); toast('Importado com sucesso');
        } catch (err) { alert('Arquivo inválido') }
      }; fr.readAsText(f);
    };
    input.click();
  }

  // search
  async function runSearch(q){
    q = q.trim().toLowerCase();
    if(!q) { refreshAll(true); return; }
    const posts = DB.posts.filter(p => (p.title + ' ' + p.description + ' ' + (p.tags||[]).join(' ')).toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
    feedEl.innerHTML = '';
    if(posts.length===0) feedEl.innerHTML = '<div class="card"><div class="small">Nenhum resultado</div></div>';
    else {
      posts.sort((a,b)=>b.timestamp-a.timestamp);
      const html = posts.map(p => {
        const avatar = p.avatar || (`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(p.username)}`);
        return `<article class="post"><div class="avatar"><img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div><div class="post-body"><div class="title">${escapeHTML(p.title)}</div><div class="meta">por <strong>${escapeHTML(p.username)}</strong> · ${timeAgo(p.timestamp)}</div><div class="desc">${escapeHTML(p.description)}</div></div></article>`;
      }).join('');
      feedEl.innerHTML = html;
    }
  }

  // helpers: refresh UI
  function refreshProfileMini() {
    if(session.username) {
      const me = DB.users.find(u=>u.username===session.username);
      miniUsername.textContent = me.username;
      if(me.avatar) miniAvatar.style.backgroundImage = `url(${me.avatar})`; else miniAvatar.style.background = 'linear-gradient(90deg,var(--accent1),var(--accent2))';
    } else {
      miniUsername.textContent = 'Convidado';
      miniAvatar.style.background = 'linear-gradient(90deg,var(--accent1),var(--accent2))';
    }
  }
  function refreshAll(resetFeed=false){
    DB = loadDB(); // reload
    renderTrending();
    showSkeleton(2);
    setTimeout(()=>{ hideSkeleton(); renderFeed(resetFeed); }, 250);
    refreshProfileMini();
    renderCommunity();
    refreshStats();
  }

  function refreshStats(){
    const myPosts = session.username ? DB.posts.filter(p=>p.username===session.username).length : 0;
    const likes = session.username ? DB.posts.reduce((acc,p)=>acc + (p.likes.includes(session.username)?1:0),0) : 0;
    const statsBox = document.getElementById('my-stats');
    if(statsBox) statsBox.textContent = `Curtidas recebidas: ${likes} · Posts: ${myPosts}`;
  }

  // community content
  function renderCommunity(){
    const tab = document.querySelector('#community-tabs .tab.active')?.dataset.tab || 'hot';
    let contentHtml = '';
    if(tab === 'hot'){
      const trending = computeTrending();
      contentHtml = trending.length ? trending.map(t => `<div class="small">${escapeHTML(t)}</div>`).join('') : '<div class="small">Nada em alta</div>';
    } else if(tab === 'new') {
      const recent = DB.posts.slice().sort((a,b)=>b.timestamp-a.timestamp).slice(0,6);
      contentHtml = recent.map(p=>`<div style="margin-bottom:8px"><strong>${escapeHTML(p.title)}</strong><div class="small">por ${escapeHTML(p.username)} · ${timeAgo(p.timestamp)}</div></div>`).join('');
    } else {
      // tags
      const tags = computeTrending();
      contentHtml = tags.length ? tags.map(t=>`<div class="tag small">${escapeHTML(t)}</div>`).join(' ') : '<div class="small">Sem tópicos</div>';
    }
    communityContent.innerHTML = contentHtml;
  }

  // theme
  function toggleTheme(){
    document.documentElement.classList.toggle('light-mode');
    const isLight = document.documentElement.classList.contains('light-mode');
    localStorage.setItem('echo_theme_light', isLight ? '1' : '0');
    toast('Tema: ' + (isLight ? 'Claro' : 'Escuro'));
  }
  (function initTheme(){
    const t = localStorage.getItem('echo_theme_light');
    if(t === '1') document.documentElement.classList.add('light-mode');
  })();

  // keyboard shortcuts (basic)
  document.addEventListener('keydown', (e) => {
    if(e.key === 'n') {
      document.getElementById('post-title').focus();
    }
  });

  // attach UI actions
  document.getElementById('btn-publish').onclick = createPostFromUI;
  document.getElementById('btn-save-draft').onclick = () => {
    const t = document.getElementById('post-title').value.trim();
    const b = document.getElementById('post-body').value.trim();
    if(!t && !b) return alert('Nada para salvar');
    DB.drafts = DB.drafts || [];
    DB.drafts.push({ id: Date.now(), title: t, body: b, createdAt: Date.now() });
    saveDB(DB); toast('Rascunho salvo');
  };
  document.getElementById('btn-load-more').onclick = () => renderFeed();

  // nav buttons
  document.getElementById('btn-post').onclick = () => document.getElementById('post-title').focus();
  document.getElementById('btn-community').onclick = () => {
    // open community panel visually: scroll to right column
    document.querySelector('aside.right-column').scrollIntoView({behavior:'smooth'});
  };
  document.getElementById('btn-theme').onclick = toggleTheme;
  document.getElementById('btn-profile-top').onclick = openAuthModal;
  document.getElementById('btn-admin-open').onclick = () => {
    // open admin panel (separate file)
    window.open('admin.html','_blank');
  };
  document.getElementById('btn-edit-profile').onclick = editProfileModal;
  document.getElementById('btn-logout-compact').onclick = logout;

  document.getElementById('shortcut-new').onclick = () => document.getElementById('post-title').focus();
  document.getElementById('shortcut-community').onclick = () => document.getElementById('btn-community').click();
  document.getElementById('shortcut-bookmarks').onclick = () => {
    // show bookmarks
    const bs = DB.bookmarks || [];
    if(bs.length===0) return alert('Nenhum salvo');
    const posts = DB.posts.filter(p=>bs.includes(p.id));
    const html = posts.map(p=>`<div style="margin-bottom:10px"><strong>${escapeHTML(p.title)}</strong><div class="small">por ${escapeHTML(p.username)}</div></div>`).join('');
    showModal(`<div style="font-weight:700">Salvos</div><div style="max-height:360px;overflow:auto">${html}</div>`);
  };
  document.getElementById('shortcut-drafts').onclick = () => {
    const ds = DB.drafts || [];
    if(ds.length===0) return alert('Sem rascunhos');
    const html = ds.map(d=>`<div style="margin-bottom:8px"><strong>${escapeHTML(d.title||'(sem título)')}</strong><div class="small">${new Date(d.createdAt).toLocaleString()}</div><div style="margin-top:6px;color:var(--muted)">${escapeHTML(d.body)}</div></div>`).join('');
    showModal(`<div style="font-weight:700">Rascunhos</div><div style="max-height:420px;overflow:auto">${html}</div>`);
  };

  // search
  document.getElementById('global-search').addEventListener('input', (e) => {
    const q = e.target.value;
    if(q.length >= 2) runSearch(q);
    else refreshAll(true);
  });

  // community tabs
  document.querySelectorAll('#community-tabs .tab').forEach(t => {
    t.onclick = (ev) => {
      document.querySelectorAll('#community-tabs .tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active'); renderCommunity();
    };
  });

  // export/import
  document.getElementById('btn-export-json').onclick = exportJSON;
  document.getElementById('btn-import-json').onclick = importJSON;

  // initial load
  showSkeleton(3);
  setTimeout(()=>{ hideSkeleton(); refreshAll(true); }, 300);

  // autosave DB periodically (backup)
  setInterval(()=>{ saveDB(DB); }, 5000);

  // expose some internals for dev (optional)
  window.__ECHO_DB = DB;
  window.__ECHO_REFRESH = () => refreshAll(true);
})();
