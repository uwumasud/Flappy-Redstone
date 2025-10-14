// src/leaderboard.js — Global leaderboard client with local fallback.
// Set API_BASE to your Cloudflare Worker URL after you deploy it.

const STORAGE_KEY = 'stoney_lb_v1';
export let API_BASE = ''; // e.g. 'https://stoney-worker.your-subdomain.workers.dev'

export function setApiBase(url){ API_BASE = url; }

// ---------- Telegram identity ----------
function tgUser(){
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: String(u.id),
    username: u.username || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Player',
    photo_url: u.photo_url || ''
  };
}

function ensureLocalIdentity(){
  const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!s.me){
    s.me = { id: 'local-' + Math.random().toString(36).slice(2), username: 'You', photo_url: '' };
    s.scores = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
  return s.me;
}

function loadLocal(){
  const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!s.me) s.me = ensureLocalIdentity();
  if (!Array.isArray(s.scores)) s.scores = [];
  return s;
}
function saveLocal(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function upsertLocal(score){
  const me = tgUser() || ensureLocalIdentity();
  const s = loadLocal();
  const i = s.scores.findIndex(r => r.id === me.id);
  if (i >= 0) s.scores[i].score = Math.max(s.scores[i].score|0, score|0);
  else s.scores.push({ id: me.id, username: me.username, photo_url: me.photo_url, score: score|0 });
  s.scores.sort((a,b)=>b.score-a.score); s.scores.splice(100);
  saveLocal(s);
  return s.scores.slice(0, 20);
}

// ---------- Remote API ----------
async function postJSON(url, body){
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitScore(score){
  // Always keep local
  const localTop = upsertLocal(score);

  // Try remote
  if (!API_BASE) return { ok:false, list: localTop };
  try{
    const payload = { initData: window.Telegram?.WebApp?.initData || '', score: score|0 };
    await postJSON(API_BASE + '/submit', payload);
    return { ok:true, list: localTop };
  }catch(e){
    console.warn('Leaderboard submit failed:', e.message);
    return { ok:false, list: localTop };
  }
}

export async function getTop(limit=20){
  if (API_BASE){
    try{
      const res = await fetch(API_BASE + `/top?limit=${limit}`);
      if (!res.ok) throw new Error(await res.text());
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) return arr;
    }catch(e){
      console.warn('Leaderboard top failed:', e.message);
    }
  }
  // fallback to local
  const s = loadLocal();
  const list = s.scores.slice().sort((a,b)=>b.score-a.score).slice(0, limit);
  return list;
}
