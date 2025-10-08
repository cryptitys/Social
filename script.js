// Cryptitys v3 - Protótipo local
const DB_KEY='cryptitys_v3';
const ADMIN_DEFAULT={username:'admin',password:'admin',isAdmin:true,banned:false};
let DB=loadDB();
let currentUser=null;

// UI refs
const postsEl=document.getElementById('posts');
const postsCountEl=document.getElementById('posts-count');
const usersOnlineEl=document.getElementById('users-online');
const currentUserEl=document.getElementById('user-info');

// Helpers
function now(){return Date.now();}
function uid(){return Math.floor(Math.random()*1e9);}
function loadDB(){const raw=localStorage.getItem(DB_KEY); if(!raw){const init={users:[ADMIN_DEFAULT],posts:[]};localStorage.setItem(DB_KEY,JSON.stringify(init));return init;} try{return JSON.parse(raw);}catch(e){const init={users:[ADMIN_DEFAULT],posts:[]};localStorage.setItem(DB_KEY,JSON.stringify(init));return init;}}
function saveDB(){localStorage.setItem(DB_KEY,JSON.stringify(DB));}

// --- UI Refresh ---
function refreshUI(){renderPosts(); renderUsersOnline(); postsCountEl.textContent=`Posts: ${DB.posts.length}`; currentUserEl.textContent=currentUser?`${currentUser.username}${currentUser.isAdmin?' (admin)':''}`:'Não autenticado';}

function renderPosts(){
  if(DB.posts.length===0){postsEl.innerHTML='<div class="panel">Nenhum post ainda — seja o primeiro!</div>'; return;}
  const sorted=DB.posts.slice().sort((a,b)=>b.timestamp-a.timestamp);
  postsEl.innerHTML=sorted.map(p=>postHTML(p)).join('');
  attachPostListeners();
}

function postHTML(p){
  const liked=currentUser?p.likes.includes(currentUser.username):false;
  const disliked=currentUser?p.dislikes.includes(currentUser.username):false;
  const avatar=`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(p.username)}`;
  return `
  <div class="post" data-id="${p.id}">
    <div style="display:flex;gap:12px;align-items:center">
      <img src="${avatar}" alt="${p.username}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--primary)">
      <div style="flex:1">
        <h4>${escape(p.title)}</h4>
        <div class="meta">Por <strong>${escape(p.username)}</strong> · ${timeAgo(p.timestamp)}</div>
        <p style="color:var(--muted)">${escape(p.description)}</p>
        <div class="actions">
          <button class="btn action-like ${liked?'active':''}" data-id="${p.id}">👍 ${p.likes.length}</button>
          <button class="btn action-dislike ${disliked?'active':''}" data-id="${p.id}">👎 ${p.dislikes.length}</button>
          ${currentUser&&(currentUser.isAdmin||currentUser.username===p.username)?`<button class="btn btn-danger btn-delete" data-id="${p.id}">Excluir</button>`:''}
        </div>
      </div>
    </div>
  </div>`;
}

function attachPostListeners(){
  postsEl.querySelectorAll('.action-like').forEach(btn=>btn.onclick=()=>toggleLike(btn.dataset.id));
  postsEl.querySelectorAll('.action-dislike').forEach(btn=>btn.onclick=()=>toggleDislike(btn.dataset.id));
  postsEl.querySelectorAll('.btn-delete').forEach(btn=>btn.onclick=()=>deletePost(btn.dataset.id));
}

// --- Post actions ---
function createPost(title,desc){
  if(!currentUser) return alert('Autentique-se'); if(currentUser.banned) return alert('Você está banido'); 
  const p={id:uid(),username:currentUser.username,title,description:desc,timestamp:now(),likes:[],dislikes:[]};
  DB.posts.push(p); saveDB(); refreshUI();
}

function toggleLike(id){
  if(!currentUser) return alert('Autentique-se'); 
  const p=DB.posts.find(x=>x.id==id); if(!p) return;
  if(p.likes.includes(currentUser.username)) p.likes=p.likes.filter(u=>u!==currentUser.username);
  else {p.likes.push(currentUser.username); p.dislikes=p.dislikes.filter(u=>u!==currentUser.username);} saveDB(); refreshUI();
}

function toggleDislike(id){
  if(!currentUser) return alert('Autentique-se');
  const p=DB.posts.find(x=>x.id==id); if(!p) return;
  if(p.dislikes.includes(currentUser.username)) p.dislikes=p.dislikes.filter(u=>u!==currentUser.username);
  else {p.dislikes.push(currentUser.username); p.likes=p.likes.filter(u=>u!==currentUser.username);} saveDB(); refreshUI();
}

function deletePost(id){if(confirm('Excluir post?')){DB.posts=DB.posts.filter(p=>p.id!=id); saveDB(); refreshUI();}}

// --- Users ---
function register(username,password){
  if(!username||username.length<3) return alert('Nome curto'); 
  if(!password||password.length<3) return alert('Senha curta'); 
  if(DB.users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return alert('Usuário já existe'); 
  const u={username,password,isAdmin:false,banned:false,createdAt:now()}; DB.users.push(u); saveDB(); login(username,password);
}

function login(username,password){
  const u=DB.users.find(x=>x.username===username && x.password===password); 
  if(!u) return alert('Usuário/Senha incorretos'); 
  if(u.banned) return alert('Você está banido'); 
  currentUser={...u}; refreshUI(); closeModal();
}

function logout(){currentUser=null; refreshUI();}

// --- Modal ---
const backdrop=document.getElementById('modal-backdrop');
const modalContent=document.getElementById('modal-content');
function showModal(html){modalContent.innerHTML=html; backdrop.style.display='flex'; backdrop.classList.add('show'); backdrop.onclick=(e)=>{if(e.target===backdrop) closeModal();}}
function closeModal(){backdrop.style.display='none'; backdrop.classList.remove('show'); modalContent.innerHTML='';}

// --- UI Wiring ---
document.getElementById('send-post').onclick=()=>{
  const t=document.getElementById('post-title').value.trim(); const d=document.getElementById('post-desc').value.trim();
  if(t.length<3){return alert('Título muito curto');}
  if(d.length<10){return alert('Descrição muito curta');}
  createPost(t,d);
  document.getElementById('post-title').value='';
  document.getElementById('post-desc').value='';
}
document.getElementById('clear-post').onclick=()=>{document.getElementById('post-title').value='';document.getElementById('post-desc').value='';}

// --- Utility ---
function escape(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function timeAgo(ts){const s=Math.floor((now()-ts)/1000);if(s<60)return'Agora';if(s<3600)return`${Math.floor(s/60)}m atrás`;if(s<86400)return`${Math.floor(s/3600)}h atrás`;return`${Math.floor(s/86400)}d atrás`;}

// --- Users online ---
function renderUsersOnline(){usersOnlineEl.innerHTML=DB.users.slice(0,6).map(u=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><img src="https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent("seed:"+u.username)}" style="width:34px;height:34px;border-radius:50%"/><div><strong>${escape(u.username)}</strong><div style="font-size:12px">${u.isAdmin?'admin':'membro'}</div></div></div>`).join('');}

// --- Init ---
refreshUI();

// Auto-refresh DB
setInterval(()=>{DB=loadDB(); if(currentUser){const fresh=DB.users.find(u=>u.username===currentUser.username); if(fresh) currentUser={...fresh};} refreshUI()},5000);
