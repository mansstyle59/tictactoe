// ClubManager — cœur de l'application
export const SUPABASE_URL = 'https://kdyrminzmlatzmvxnmeo.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_wYt3xv2gfYweLjiuW64lug_cCH0KfPq';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ---------------------------------------------------------------- état
export const S = {
  session: null, user: null, profile: null,
  memberships: [], clubs: [], club: null, roles: [],
  season: null, seasons: [], teams: [], members: [],
  cache: {}, unread: 0, notifCount: 0, plans: null,
};

export const role = {
  is: (...r) => r.some((x) => S.roles.includes(x)),
  admin: () => S.roles.includes('admin'),
  staff: () => S.roles.includes('admin') || S.roles.includes('coach'),
  family: () => S.roles.includes('player') || S.roles.includes('parent'),
  sa: () => !!S.profile?.is_super_admin,
};

// ---------------------------------------------------------------- sports
export const SPORTS = {
  basket: { label: 'Basket', emoji: '🏀', cats: ['U7', 'U9', 'U11', 'U13', 'U15', 'U18', 'U21', 'Seniors', 'Loisirs'],
    positions: ['Meneur', 'Arrière', 'Ailier', 'Ailier fort', 'Pivot'],
    stats: [['pts', 'Points'], ['reb', 'Rebonds'], ['pas', 'Passes'], ['int', 'Interceptions'], ['ctr', 'Contres'], ['tirs', 'Tirs réussis'], ['lf', 'Lancers francs'], ['fte', 'Fautes']] },
  football: { label: 'Football', emoji: '⚽', cats: ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Seniors', 'Vétérans'],
    positions: ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'],
    stats: [['buts', 'Buts'], ['pd', 'Passes décisives'], ['tirs', 'Tirs'], ['jaune', 'Cartons jaunes'], ['rouge', 'Cartons rouges']] },
  rugby: { label: 'Rugby', emoji: '🏉', cats: ['U8', 'U10', 'U12', 'U14', 'U16', 'U19', 'Seniors'],
    positions: ['Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée', "Demi d'ouverture", 'Centre', 'Ailier', 'Arrière'],
    stats: [['essais', 'Essais'], ['pts', 'Points'], ['plaq', 'Plaquages']] },
  volley: { label: 'Volley', emoji: '🏐', cats: ['M11', 'M13', 'M15', 'M18', 'M21', 'Seniors', 'Loisirs'],
    positions: ['Passeur', 'Pointu', 'Réceptionneur-attaquant', 'Central', 'Libéro'],
    stats: [['pts', 'Points'], ['aces', 'Aces'], ['ctr', 'Contres'], ['att', 'Attaques gagnantes']] },
  tennis: { label: 'Tennis', emoji: '🎾', cats: ['Mini-tennis', 'Jeunes', 'Adultes', 'Compétition', 'Loisirs'], positions: [],
    stats: [['sets', 'Sets gagnés'], ['jeux', 'Jeux gagnés'], ['aces', 'Aces']] },
  tennis_table: { label: 'Tennis de table', emoji: '🏓', cats: ['Poussins', 'Benjamins', 'Minimes', 'Cadets', 'Juniors', 'Seniors'], positions: [],
    stats: [['vict', 'Victoires'], ['sets', 'Sets gagnés']] },
  badminton: { label: 'Badminton', emoji: '🏸', cats: ['Minibad', 'Poussins', 'Benjamins', 'Minimes', 'Cadets', 'Juniors', 'Seniors'], positions: [],
    stats: [['vict', 'Victoires'], ['sets', 'Sets gagnés']] },
  handball: { label: 'Handball', emoji: '🤾', cats: ['-9 ans', '-11 ans', '-13 ans', '-15 ans', '-18 ans', 'Seniors'],
    positions: ['Gardien', 'Ailier', 'Arrière', 'Demi-centre', 'Pivot'],
    stats: [['buts', 'Buts'], ['pd', 'Passes décisives'], ['arr', 'Arrêts'], ['excl', 'Exclusions']] },
  martial: { label: 'Arts martiaux', emoji: '🥋', cats: ['Baby', 'Enfants', 'Ados', 'Adultes', 'Compétition'], positions: [],
    stats: [['vict', 'Victoires'], ['ippon', 'Points marqués']] },
  natation: { label: 'Natation', emoji: '🏊', cats: ['Avenirs', 'Jeunes', 'Juniors', 'Seniors', 'Maîtres'], positions: ['Nage libre', 'Dos', 'Brasse', 'Papillon', '4 nages'],
    stats: [['podiums', 'Podiums'], ['records', 'Records perso']] },
  autre: { label: 'Autre', emoji: '➕', cats: ['Jeunes', 'Adultes', 'Loisirs', 'Compétition'], positions: [],
    stats: [['pts', 'Points']] },
};
export const sport = () => SPORTS[S.club?.sport] || SPORTS.autre;

export const KINDS = {
  training: { label: 'Entraînement', emoji: '🏋️', color: '#2F9E6E' },
  match: { label: 'Match', emoji: '🏀', color: '#5B3FD6' },
  tournament: { label: 'Tournoi', emoji: '🏆', color: '#C77C02' },
  meeting: { label: 'Réunion', emoji: '🤝', color: '#2B6CB0' },
  event: { label: 'Événement', emoji: '🎉', color: '#FF7A2F' },
  volunteer: { label: 'Bénévolat', emoji: '🙋', color: '#B83280' },
};
export const kindEmoji = (a) => a.emoji || (a.kind === 'match' ? sport().emoji : KINDS[a.kind]?.emoji || '📌');

export const ROLE_LABEL = { admin: 'Administrateur', coach: 'Entraîneur', player: 'Joueur', parent: 'Parent', volunteer: 'Bénévole' };

// ---------------------------------------------------------------- outils
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = () => Math.random().toString(36).slice(2, 10);

const TZ = 'Europe/Paris';
export const fmt = {
  date: (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
  day: (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
  dayLong: (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  time: (d) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
  dt: (d) => d ? `${fmt.day(d)} · ${fmt.time(d)}` : '—',
  money: (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
  rel: (d) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
    return fmt.date(d);
  },
  age: (b) => b ? Math.floor((Date.now() - new Date(b)) / 31557600000) : null,
};
// valeur pour <input type=datetime-local>
export const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const fromLocalInput = (v) => v ? new Date(v).toISOString() : null;
export const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const fullName = (p) => p ? `${p.first_name} ${p.last_name}` : '';

// ---------------------------------------------------------------- interface
export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', type === 'err' ? 'alert' : 'status');
  t.innerHTML = `<span class="toast-ic" aria-hidden="true">${type === 'err' ? '!' : type === 'info' ? '●' : '✓'}</span><span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  haptic(type === 'err' ? [10, 40, 10] : 8);
  t.addEventListener('click', () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); });
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

export function modal({ title, body, actions = [], wide = false, onOpen }) {
  closeModal();
  const w = document.createElement('div');
  w.className = 'modal-wrap';
  w.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grabber" aria-hidden="true"></div>
    <header><h2>${esc(title)}</h2><button class="icon-btn close-x" data-close aria-label="Fermer"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<footer>${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
  </div>`;
  document.body.append(w);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => w.classList.add('in'));
  w.addEventListener('click', async (e) => {
    if (e.target === w || e.target.closest('[data-close]')) return closeModal();
    const b = e.target.closest('[data-act]');
    if (b) {
      const a = actions[+b.dataset.act];
      if (!a.run) return closeModal();
      b.disabled = true;
      try { const r = await a.run(w); if (r !== false) closeModal(); }
      catch (err) { toast(errMsg(err), 'err'); }
      finally { b.disabled = false; }
    }
  });
  // glisser vers le bas pour fermer (mobile)
  const sheet = w.querySelector('.modal');
  let y0 = null, dy = 0;
  const start = (e) => { if (window.innerWidth > 600 || sheet.querySelector('.modal-body').scrollTop > 0 && !e.target.closest('header,.grabber')) return; y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; };
  const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) { sheet.style.transform = `translateY(${dy}px)`; if (e.cancelable && e.target.closest('header,.grabber')) e.preventDefault(); } };
  const end = () => { if (y0 == null) return; sheet.style.transition = ''; if (dy > 110) closeModal(); else sheet.style.transform = ''; y0 = null; };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: false });
  sheet.addEventListener('touchend', end);
  onOpen?.(w);
  const first = w.querySelector('input,select,textarea');
  if (first && window.innerWidth > 700) first.focus();
  return w;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.modal-wrap.in')) closeModal(); });
export function closeModal() {
  $$('.modal-wrap:not(.closing)').forEach((m) => {
    m.classList.add('closing'); m.classList.remove('in');
    setTimeout(() => { m.remove(); if (!$('.modal-wrap:not(.closing)')) document.body.classList.remove('noscroll'); }, 220);
  });
}

export function confirmBox(text, { danger = true, ok = 'Confirmer' } = {}) {
  return new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    const w = modal({
      title: 'Confirmation',
      body: `<p class="lead">${esc(text)}</p>`,
      actions: [
        { label: 'Annuler', cls: 'ghost', run: () => fin(false) },
        { label: ok, cls: danger ? 'danger' : 'primary', run: () => fin(true) },
      ],
    });
    w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-close]')) fin(false); });
    new MutationObserver((_, o) => { if (!w.isConnected) { fin(false); o.disconnect(); } }).observe(document.body, { childList: true });
  });
}

// Constructeur de formulaires : [{name,label,type,options,required,value,hint,col}]
export function formHTML(fields, values = {}) {
  return `<form class="form" onsubmit="return false">${fields.map((f) => {
    if (f.type === 'section') return `<h3 class="form-section">${esc(f.label)}</h3>`;
    const v = values[f.name] ?? f.value ?? '';
    const id = `f_${f.name}_${uid()}`;
    const req = f.required ? 'required' : '';
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.name}" ${req}>${(f.options || []).map((o) => {
        const [ov, ol] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`;
      }).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    } else if (f.type === 'checkbox') {
      return `<label class="check ${f.col ? 'col-' + f.col : ''}"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> <span>${esc(f.label)}</span></label>`;
    } else if (f.type === 'color') {
      input = `<input id="${id}" type="color" name="${f.name}" value="${esc(v || '#5B3FD6')}">`;
    } else {
      input = `<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" ${req}
        ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.list ? `list="${f.list}"` : ''}
        placeholder="${esc(f.placeholder || '')}" ${f.type === 'email' ? 'autocomplete="email"' : ''}>`;
    }
    return `<div class="field ${f.col ? 'col-' + f.col : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
  }).join('')}</form>`;
}
export function readForm(root) {
  const form = root.querySelector('form') || root;
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  const bad = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
  if (bad) { bad.focus(); throw new Error(`Le champ « ${bad.closest('.field')?.querySelector('label')?.textContent.replace(' *', '')} » est obligatoire`); }
  return out;
}

export function errMsg(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect';
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet email — connecte-toi';
  if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères';
  if (/Email not confirmed/i.test(m)) return "Ton email n'est pas encore confirmé — regarde ta boîte mail";
  if (/rate limit/i.test(m)) return 'Trop de tentatives, réessaie dans quelques minutes';
  if (/row-level security|permission denied/i.test(m)) return "Tu n'as pas les droits pour cette action";
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Pas de connexion internet';
  return m;
}

// Requête Supabase avec gestion d'erreur
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const empty = (emoji, title, text = '', btn = '') =>
  `<div class="empty"><div class="empty-emoji">${emoji}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${btn}</div>`;

const hue = (n) => [...(n || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const avatar = (name, url, size = '') =>
  url ? `<img class="avatar ${size}" src="${esc(url)}" alt="">` : `<span class="avatar ${size}" style="--h:${hue(name)}" aria-hidden="true">${esc(initials(name))}</span>`;

export const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`;

// Applique les couleurs du club à l'interface
export function applyBrand(c) {
  const r = document.documentElement.style;
  if (c?.color_primary) { r.setProperty('--brand', c.color_primary); r.setProperty('--brand-ink', contrast(c.color_primary)); }
  else { r.removeProperty('--brand'); r.removeProperty('--brand-ink'); }
  if (c?.color_secondary) r.setProperty('--accent', c.color_secondary); else r.removeProperty('--accent');
}
function contrast(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#111' : '#fff';
}

// Téléversement de fichier dans le stockage du club
export async function upload(file, bucket = 'club-files', folder = '') {
  if (file.size > (bucket === 'club-public' ? 5 : 10) * 1048576) throw new Error('Fichier trop lourd');
  const clean = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${S.club.id}/${folder ? folder + '/' : ''}${Date.now()}_${clean}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  if (bucket === 'club-public') return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return path;
}

// Limites selon l'offre du club
export function planLimit(kind) {
  const p = S.plans?.[S.club?.plan || 'gratuit'];
  return p ? p[kind] : Infinity;
}
export const isPremium = () => S.club?.plan === 'premium' || role.sa();

export function downloadCSV(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click();
}

// WhatsApp : numéro au format international (France par défaut) et liens de partage
export const waPhone = (p) => { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) return d.slice(1); if (d.startsWith('00')) return d.slice(2); if (d.startsWith('0')) return '33' + d.slice(1); return d; };
export const waLink = (text, phone) => `https://wa.me/${phone ? waPhone(phone) : ''}?text=${encodeURIComponent(text)}`;
export const appUrl = (hash = '') => `${location.origin}${location.pathname}${hash}`;
