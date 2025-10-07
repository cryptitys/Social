// Echo — frontend + mock API (index side)
// Persistência local: chave localStorage = 'echo_v2_full'
// Admin (separado) pode abrir admin.html (você fará esse arquivo depois).

/* -------------------------
   Mock API (intercepta fetch('/api/...'))
   ------------------------- */
(function(){
  const KEY = 'echo_v2_full';
  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch(e){ return {} } }
  function save(db){ localStorage.setItem(KEY, JSON.stringify(db)) }
  let DB = load();
  if(!DB.users){
    DB = {
      users: [{ username:'admin', password:'admin', isAdmin:true, banned:false, createdAt: Date.now() }],
      posts: []
    };
    save(DB);
  }

  function jsonResponse(data, ok=true){
    return new Response(JSON.stringify(data), { status: ok?200:400, headers: {'Content-Type':'application/json'} });
  }

  async function handleRequest(req){
    const url = new URL(req.url, location.origin);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // GET posts
    if(path === '/api/posts' && method === 'GET'){
      return jsonResponse(DB.posts);
    }

    // CREATE post
    if(path === '/api/posts' && method === 'POST'){
      const b = await req.json();
      const user = DB.users.find(u=>u.username === b.username);
      if(!user) return jsonResponse({ error: 'Usuário não encontrado' }, false);
      if(user.banned) return jsonResponse({ error: 'Usuário banido' }, false);
      const p = { id: Date.now() + Math.floor(Math.random()*1e6), title: b.title, description: b.description, username: b.username, timestamp: Date.now(), likes: [], dislikes: [], comments: [] };
      DB.posts.push(p); save(DB);
      return jsonResponse(p);
    }

    // posts/:id/(like|dislike|comment|delete)
    const postAction = path.match(/^\/api\/posts\/(\d+)\/(like|dislike|comment|delete)$/);
    if(postAction){
      const id = Number(postAction[1]);
      const action = postAction[2];
      const post = DB.posts.find(p=>p.id === id);
      if(!post) return jsonResponse({ error: 'Post não encontrado' }, false);
      const body = method === 'GET' ? {} : await req.json();
      const actor = DB.users.find(u=>u.username === (body.username || body.user));
      if(action === 'delete'){
        const actorName = body.username;
        const actorObj = DB.users.find(u=>u.username === actorName);
        if(!(actorObj && (actorObj.isAdmin || post.username === actorName))) return jsonResponse({ error: 'Sem permissão' }, false);
        DB.posts = DB.posts.filter(p => p.id !== id); save(DB); return jsonResponse({ ok: true });
      }
      if(action === 'like'){
        if(!actor) return jsonResponse({ error: 'Usuário não encontrado' }, false);
        if(actor.banned) return jsonResponse({ error: 'Usuário banido' }, false);
        if(!post.likes.includes(actor.username)) post.likes.push(actor.username);
        post.dislikes = post.dislikes.filter(u=>u!==actor.username);
        save(DB); return jsonResponse(post);
      }
      if(action === 'dislike'){
        if(!actor) return jsonResponse({ error: 'Usuário não encontrado' }, false);
        if(actor.banned) return jsonResponse({ error: 'Usuário banido' }, false);
        if(!post.dislikes.includes(actor.username)) post.dislikes.push(actor.username);
        post.likes = post.likes.filter(u=>u!==actor.username);
        save(DB); return jsonResponse(post);
      }
      if(action === 'comment'){
        if(!actor) return jsonResponse({ error: 'Usuário não encontrado' }, false);
        if(actor.banned) return jsonResponse({ error: 'Usuário banido' }, false);
        const text = body.text;
        if(!text) return jsonResponse({ error: 'Texto vazio' }, false);
        post.comments.push({ id: Date.now()+Math.floor(Math.random()*1e4), username: actor.username, text, timestamp: Date.now() });
        save(DB); return jsonResponse(post);
      }
    }

    // users
    if(path === '/api/users' && method === 'GET'){
      return jsonResponse(DB.users.map(u=>({ username:u.username, isAdmin:u.isAdmin, banned:u.banned, createdAt:u.createdAt })));
    }
    if(path === '/api/users/register' && method === 'POST'){
      const b = await req.json();
      if(!b.username || !b.password) return jsonResponse({ error: 'Dados incompletos' }, false);
      if(DB.users.some(u => u.username.toLowerCase() === b.username.toLowerCase())) return jsonResponse({ error: 'Usuário existe' }, false);
      const u = { username: b.username, password: b.password, isAdmin:false, banned:false, createdAt: Date.now() };
      DB.users.push(u); save(DB); return jsonResponse({ ok: true, username: u.username });
    }
    if(path === '/api/users/login' && method === 'POST'){
      const b = await req.json();
      const u = DB.users.find(x => x.username === b.username && x.password === b.password);
      if(!u) return jsonResponse({ error: 'Credenciais inválidas' }, false);
      if(u.banned) return jsonResponse({ error: 'Banido' }, false);
      return jsonResponse({ ok:true, username: u.username, isAdmin: u.isAdmin });
    }

    // admin actions
    const adminAction = path.match(/^\/api\/users\/(.+)\/(ban|unban|promote)$/);
    if(adminAction){
      const uname = decodeURIComponent(adminAction[1]);
      const act = adminAction[2];
      const b = await req.json();
      const by = b.by;
      const actor = DB.users.find(x=>x.username===by);
      if(!actor || !actor.isAdmin) return jsonResponse({ error: 'Somente admin' }, false);
      const target = DB.users.find(x=>x.username===uname);
      if(!target) return jsonResponse({ error: 'Usuário não existe' }, false);
      if(act === 'ban'){ target.banned = true; DB.posts = DB.posts.filter(p => p.username !== uname); save(DB); return jsonResponse({ ok:true }); }
      if(act === 'unban'){ target.banned = false; save(DB); return jsonResponse({ ok:true }); }
      if(act === 'promote'){ target.isAdmin = true; save(DB); return jsonResponse({ ok:true }); }
    }

    return jsonResponse({ error: 'Endpoint não suportado: '+path }, false);
  }

  // monkeypatch fetch
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    try{
      const url = typeof input === 'string' ? input : input.url;
      if(typeof url === 'string' && url.startsWith('/api/')){
        const req = new Request(url, init||{});
        return await handleRequest(req);
      }
    }catch(e){ console.error('API mock error', e); return new Response(JSON.stringify({ error: 'mock error' }), { status:500, headers:{'Content-Type':'application/json'} }) }
    return originalFetch(input, init);
  };

  // expose DB for debugging (admin page may access window.__ECHO_DB)
  window.__ECHO_DB = DB;
})();

/* -------------------------
   Frontend app logic
   ------------------------- */
(function(){
  const q = s => document.querySelector(s);
  const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  let session = { username: null, isAdmin: false };

  async function api(path, opts){ const r = await fetch(path, opts||{}); const j = await r.json(); if(!r.ok) throw j; return j; }

  // render feed
  async function loadPosts(){
    try{
      const posts = await api('/api/posts');
      renderFeed(posts);
      q('#total-posts').textContent = posts.length;
    }catch(e){ console.error(e) }
  }

  function renderFeed(posts){
    const out = posts.slice().sort((a,b)=>b.timestamp-a.timestamp).map(p=>{
      const avatar = `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(p.username)}`;
      return `
        <article class="post" data-id="${p.id}">
          <div class="avatar"><img src="${avatar}" style="width:100%;height:100%;object-fit:cover" alt="${escape(p.username)}"></div>
          <div class="post-body">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div>
                <div class="title">${escape(p.title)}</div>
                <div class="meta">por <strong>${escape(p.username)}</strong> · ${timeAgo(p.timestamp)}</div>
              </div>
              <div>
                ${session.username && (session.username===p.username || session.isAdmin) ? `<button class="btn btn-ghost btn-delete" data-id="${p.id}">Excluir</button>` : ''}
              </div>
            </div>
            <div class="desc">${escape(p.description)}</div>
            <div class="actions">
              <button class="btn btn-ghost btn-like" data-id="${p.id}">👍 ${p.likes.length}</button>
              <button class="btn btn-ghost btn-dislike" data-id="${p.id}">👎 ${p.dislikes.length}</button>
              <button class="btn btn-ghost btn-comment" data-id="${p.id}">💬 ${p.comments.length}</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
    q('#feed').innerHTML = out || '<div class="panel empty">Nenhum post ainda</div>';

    // attach handlers
    document.querySelectorAll('.btn-like').forEach(b=>b.onclick = ()=>toggleLike(b.dataset.id));
    document.querySelectorAll('.btn-dislike').forEach(b=>b.onclick = ()=>toggleDislike(b.dataset.id));
    document.querySelectorAll('.btn-delete').forEach(b=>b.onclick = ()=>deletePost(b.dataset.id));
    document.querySelectorAll('.btn-comment').forEach(b=>b.onclick = ()=>openComments(b.dataset.id));
  }

  function timeAgo(ts){ const s = Math.floor((Date.now()-ts)/1000); if(s<60) return 'Agora'; if(s<3600) return `${Math.floor(s/60)}m atrás`; if(s<86400) return `${Math.floor(s/3600)}h atrás`; return `${Math.floor(s/86400)}d atrás`; }

  // actions
  async function publish(){
    const t = q('#title').value.trim();
    const c = q('#content').value.trim();
    if(t.length<3) return alert('Título muito curto');
    if(c.length<10) return alert('Conteúdo muito curto');
    if(!session.username) return alert('Faça login para publicar');
    try{
      await api('/api/posts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: t, description: c, username: session.username }) });
      q('#title').value=''; q('#content').value=''; loadPosts();
    }catch(e){ alert(e.error || 'Erro ao publicar') }
  }

  async function toggleLike(id){ if(!session.username) return alert('Faça login'); try{ await api(`/api/posts/${id}/like`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: session.username }) }); loadPosts(); }catch(e){ alert(e.error||'Erro') } }
  async function toggleDislike(id){ if(!session.username) return alert('Faça login'); try{ await api(`/api/posts/${id}/dislike`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: session.username }) }); loadPosts(); }catch(e){ alert(e.error||'Erro') } }
  async function deletePost(id){ if(!confirm('Excluir post?')) return; try{ await api(`/api/posts/${id}/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: session.username }) }); loadPosts(); }catch(e){ alert(e.error||'Erro') } }

  function showModal(html){
    // simple modal (replaces previous)
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay"><div class="modal-card">${html}<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" id="closeModal">Fechar</button></div></div></div>`;
    document.getElementById('closeModal').onclick = ()=>{ root.innerHTML = '' };
  }

  function closeModal(){ document.getElementById('modal-root').innerHTML = ''; }

  async function openComments(id){
    try{
      const posts = await api('/api/posts');
      const p = posts.find(x=>x.id == id);
      if(!p) return;
      const commentsHtml = (p.comments||[]).map(c=>`<div style="padding:8px;border-radius:8px;margin-bottom:8px;background:rgba(255,255,255,0.01)"><div style="font-weight:700">${escape(c.username)}</div><div class="meta">${timeAgo(c.timestamp)}</div><div style="margin-top:6px;color:var(--muted)">${escape(c.text)}</div></div>`).join('') || '<div class="empty">Nenhum comentário</div>';
      const html = `<div style="font-weight:700;margin-bottom:8px">Comentários</div><div style="max-height:260px;overflow:auto">${commentsHtml}</div>${session.username?`<div style="display:flex;gap:8px;margin-top:8px"><input id="cbox" placeholder="Escreva um comentário..." style="flex:1;padding:8px;border-radius:8px;background:#07080b;border:1px solid rgba(255,255,255,0.03)"><button class="btn btn-primary" id="sendc">Enviar</button></div>`:'<div class="meta">Faça login para comentar</div>'}`;
      showModal(html);
      if(session.username){
        document.getElementById('sendc').onclick = async ()=>{
          const txt = document.getElementById('cbox').value.trim();
          if(!txt) return;
          try{
            await api(`/api/posts/${id}/comment`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: session.username, text: txt }) });
            closeModal(); loadPosts();
          }catch(e){ alert(e.error||'Erro') }
        };
      }
    }catch(e){ console.error(e) }
  }

  // auth UI
  function setSession(user){
    session.username = user.username;
    session.isAdmin = user.isAdmin;
    document.getElementById('user-greeting').textContent = user.username + (user.isAdmin? ' (admin)':'');
  }

  async function openAuth(){
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
    document.getElementById('loginbtn').onclick = async ()=>{
      const u = document.getElementById('au').value.trim();
      const p = document.getElementById('ap').value;
      try{ const res = await api('/api/users/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: p }) }); setSession({ username: res.username, isAdmin: res.isAdmin }); closeModal(); loadPosts(); } catch(e){ alert(e.error||'Erro') }
    };
    document.getElementById('regbtn').onclick = async ()=>{
      const u = document.getElementById('au').value.trim();
      const p = document.getElementById('ap').value;
      try{ await api('/api/users/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: p }) }); alert('Registrado com sucesso! Faça login.'); } catch(e){ alert(e.error||'Erro') }
    };
    document.getElementById('closea').onclick = closeModal;
  }

  // load users (community list)
  async function loadUsers(){
    try{
      const users = await api('/api/users');
      q('#users').innerHTML = users.map(u=>`<div class="user-row"><div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid rgba(65,105,225,0.18)"><img src="https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(u.username)}" style="width:100%;height:100%;object-fit:cover"></div><div><div style="font-weight:700">${escape(u.username)} ${u.isAdmin?'<span style="color:var(--primary)">(admin)</span>':''}</div><div class="meta">${u.banned?'<span style="color:#ff9c9c">banido</span>':'membro'}</div></div></div>`).join('');
    }catch(e){ console.error(e) }
  }

  // wiring
  document.getElementById('publish').onclick = publish;
  document.getElementById('clear').onclick = ()=>{ document.getElementById('title').value=''; document.getElementById('content').value='' };
  document.getElementById('btn-login').onclick = openAuth;
  document.getElementById('btn-admin-link').onclick = ()=>{ window.open('admin.html','_blank') };
  document.getElementById('search').addEventListener('input', async function(){
    const qv = this.value.trim().toLowerCase();
    const posts = await api('/api/posts');
    const tags = new Set();
    posts.forEach(p => { (p.description.match(/#\w+/g)||[]).forEach(t=>tags.add(t)); });
    const filter = Array.from(tags).filter(t => t.toLowerCase().includes(qv)).slice(0,10);
    document.getElementById('tag-list').innerHTML = filter.map(t=>`<div class="small">${t}</div>`).join('');
  });

  // start
  loadPosts(); loadUsers();
  setInterval(()=>{ loadPosts(); loadUsers(); }, 5000);
})();
