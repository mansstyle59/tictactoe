// ClubManager — démarrage, connexion, navigation
import { sb, S, role, SPORTS, esc, $, $$, toast, modal, closeModal, formHTML, readForm, errMsg, q, applyBrand, avatar, fmt, ROLE_LABEL, haptic } from './core.js';
import * as V from './views.js';
import * as V2 from './views2.js';
import * as V3 from './views3.js';
import * as V4 from './views4.js';

// ---------------------------------------------------------------- navigation
const NAV = [
  { r: '', icon: 'home', label: 'Accueil', who: 'all' },
  { r: 'calendrier', icon: 'cal', label: 'Calendrier', who: 'all' },
  { r: 'activites', icon: 'whistle', label: 'Entraînements & matchs', short: 'Activités', who: 'all' },
  { r: 'equipes', icon: 'team', label: 'Équipes', who: 'admin,coach' },
  { r: 'joueurs', icon: 'user', label: 'Joueurs', who: 'admin,coach' },
  { r: 'familles', icon: 'family', label: 'Familles', who: 'admin,coach' },
  { r: 'evenements', icon: 'star', label: 'Événements', who: 'all' },
  { r: 'organisation', icon: 'check', label: 'Organisation', who: 'admin,coach,volunteer' },
  { r: 'benevoles', icon: 'hand', label: 'Bénévoles', who: 'all' },
  { r: 'messages', icon: 'chat', label: 'Messages', who: 'all' },
  { r: 'documents', icon: 'doc', label: 'Documents', who: 'all' },
  { r: 'cotisations', icon: 'euro', label: 'Cotisations', who: 'admin,player,parent' },
  { r: 'stats', icon: 'chart', label: 'Statistiques', who: 'admin,coach' },
  { r: 'club', icon: 'gear', label: 'Mon club', who: 'admin' },
];
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  whistle: '<circle cx="9" cy="14" r="6"/><path d="M13 10l8-4v4l-6 3"/><circle cx="9" cy="14" r="1.5"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
  hand: '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6M16 10V7.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7s-6-2-8-6l-1.5-3a1.5 1.5 0 0 1 2.6-1.5L7 13"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/>',
  family: '<circle cx="7" cy="6" r="2.6"/><circle cx="17" cy="6" r="2.6"/><circle cx="12" cy="13" r="2"/><path d="M3 20v-5a4 4 0 0 1 8 0M13 20v-5a4 4 0 0 1 8 0M9.5 21v-2a2.5 2.5 0 0 1 5 0v2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
};
export const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const navFor = () => NAV.filter((n) => n.who === 'all' || n.who.split(',').some((r) => S.roles.includes(r)));

const ROUTES = [
  [/^$/, V.dashboard], [/^calendrier$/, V.calendar], [/^activites$/, V.activities],
  [/^activite\/(.+)$/, V.activityDetail], [/^groupe\/(.+)$/, V4.groupChat], [/^equipes$/, V.teams], [/^equipe\/(.+)$/, V.teamDetail],
  [/^joueurs$/, V.players], [/^familles$/, V3.families], [/^evenements$/, V2.events], [/^organisation$/, V2.tasks],
  [/^benevoles$/, V2.volunteers], [/^messages$/, V2.messages], [/^documents$/, V2.documents],
  [/^cotisations$/, V2.dues], [/^stats$/, V2.stats], [/^club$/, V2.clubSettings],
  [/^profil$/, V2.profile], [/^admin$/, V2.superAdmin],
];

// ---------------------------------------------------------------- démarrage
function banner(id, html, cls = '') {
  let b = document.getElementById(id);
  if (!html) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = id; b.className = `sysbanner ${cls}`; document.body.append(b); }
  b.innerHTML = html;
  return b;
}
function watchSystem() {
  const net = () => banner('offline', navigator.onLine ? '' : '<span>Hors connexion — les dernières données restent affichées</span>', 'warn');
  addEventListener('online', () => { net(); toast('Connexion rétablie'); });
  addEventListener('offline', net); net();
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (w) => {
      const b = banner('update', '<span>Une nouvelle version est disponible</span><button class="btn sm primary" id="doUpdate">Mettre à jour</button>');
      b.querySelector('#doUpdate').onclick = () => { w.postMessage('skip'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

async function boot() {
  watchSystem();
  const hash = location.hash.slice(2);

  // Page publique d'un club : pas besoin de compte
  const pub = hash.match(/^club\/([a-z0-9-]+)/);
  if (pub) return V2.publicPage($('#app'), pub[1]);

  // Lien d'invitation : on retient le code
  const inv = hash.match(/^rejoindre\/([A-Za-z0-9]+)/);
  if (inv) { localStorage.setItem('cm_invite', inv[1].toUpperCase()); history.replaceState(null, '', '#/'); }

  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') return newPasswordScreen();
    if (ev === 'SIGNED_OUT') { S.session = null; location.hash = '#/'; renderAuth(); }
  });

  const { data } = await sb.auth.getSession();
  if (!data.session) return renderAuth();
  await afterLogin(data.session);
}

async function afterLogin(session) {
  S.session = session; S.user = session.user;
  try {
    S.profile = await q(sb.from('profiles').select('*').eq('id', S.user.id).single());
  } catch { S.profile = { id: S.user.id, email: S.user.email, full_name: S.user.email }; }
  const settings = await q(sb.from('platform_settings').select('*')).catch(() => []);
  S.plans = settings.find((s) => s.key === 'plans')?.value || null;
  S.needApproval = settings.find((s) => s.key === 'clubs_need_approval')?.value === true || settings.find((s) => s.key === 'signups_open')?.value === false;

  const code = localStorage.getItem('cm_invite');
  if (code) {
    localStorage.removeItem('cm_invite');
    try {
      const cid = await q(sb.rpc('accept_invite', { p_code: code }));
      localStorage.setItem('cm_club', cid);
      toast('Bienvenue dans le club ! 🎉');
    } catch (e) { toast(errMsg(e), 'err'); }
  }
  await loadMemberships();
  if (!S.clubs.length) {
    if (S.profile?.is_super_admin) { location.hash = '#/admin'; return shell(); }
    return noClubYet();
  }
  const saved = localStorage.getItem('cm_club');
  await selectClub(S.clubs.find((c) => c.id === saved)?.id || S.clubs[0].id);
}

export async function loadMemberships() {
  S.memberships = await q(sb.from('memberships').select('club_id, role').eq('user_id', S.user.id));
  const ids = [...new Set(S.memberships.map((m) => m.club_id))];
  if (S.profile?.is_super_admin) {
    // Le super administrateur voit et gère tous les clubs de la plateforme
    S.clubs = await q(sb.from('clubs').select('*').order('name'));
    for (const c of S.clubs) if (!ids.includes(c.id)) S.memberships.push({ club_id: c.id, role: 'admin', virtual: true });
    return;
  }
  S.clubs = ids.length ? await q(sb.from('clubs').select('*').in('id', ids).order('name')) : [];
}

export async function selectClub(id) {
  S.club = S.clubs.find((c) => c.id === id);
  S.roles = [...new Set(S.memberships.filter((m) => m.club_id === id).map((m) => m.role))];
  if (S.profile?.is_super_admin && !S.roles.includes('admin')) S.roles.push('admin');
  localStorage.setItem('cm_club', id);
  S.cache = {};
  applyBrand(S.club);
  if (S.club.status === 'suspended' && !role.sa()) {
    $('#app').innerHTML = `<div class="center-screen"><div class="card narrow">${V.logoBlock()}<h2>Club suspendu</h2>
      <p>L'accès à <b>${esc(S.club.name)}</b> est suspendu. Contacte l'administrateur de la plateforme.</p>
      <button class="btn ghost" id="lo">Se déconnecter</button></div></div>`;
    $('#lo').onclick = () => sb.auth.signOut();
    return;
  }
  await refreshClubData();
  shell();
}

export async function refreshClubData() {
  const cid = S.club.id;
  const [seasons, teams, mem] = await Promise.all([
    q(sb.from('seasons').select('*').eq('club_id', cid).order('start_date', { ascending: false })),
    q(sb.from('teams').select('*').eq('club_id', cid).is('archived_at', null).order('name')),
    q(sb.from('memberships').select('user_id, role').eq('club_id', cid)),
  ]);
  S.seasons = seasons;
  S.season = seasons.find((s) => s.status === 'active') || seasons[0] || null;
  S.teams = teams;
  const uids = [...new Set(mem.map((m) => m.user_id))];
  const profs = uids.length ? await q(sb.from('profiles').select('id, full_name, email, phone').in('id', uids)) : [];
  S.members = profs.map((p) => ({ ...p, roles: mem.filter((m) => m.user_id === p.id).map((m) => m.role) }));
}
export const memberName = (id) => S.members.find((m) => m.id === id)?.full_name || '';

// ---------------------------------------------------------------- connexion
const SLIDES = [
  { t: 'Les convocations en un geste', p: 'Joueurs et parents répondent en une touche. Tu vois tout de suite qui vient au match.',
    art: `<svg viewBox="0 0 280 220" class="slide-art"><rect x="40" y="18" width="200" height="184" rx="26" fill="#fff"/><rect x="58" y="40" width="88" height="10" rx="5" fill="#E6E4F5"/>
      <text x="58" y="78" font-size="19" font-weight="800" fill="#191A2E" font-family="-apple-system,system-ui,sans-serif">U13 vs Gruissan</text>
      <text x="58" y="100" font-size="13" fill="#6B6E85" font-family="-apple-system,system-ui,sans-serif">Samedi à 15:00 — Gymnase</text>
      <rect x="58" y="122" width="52" height="44" rx="12" fill="#E3F6EC" stroke="#1F9D61" stroke-width="2.5"/><path d="M72 144l7 7 14-15" fill="none" stroke="#1F9D61" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="116" y="122" width="52" height="44" rx="12" fill="#F2F2F7"/><path d="M134 136l16 16M150 136l-16 16" stroke="#B3B5C6" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="174" y="122" width="48" height="44" rx="12" fill="#F2F2F7"/><text x="198" y="152" text-anchor="middle" font-size="22" font-weight="800" fill="#B3B5C6" font-family="-apple-system,system-ui,sans-serif">?</text>
      <circle cx="232" cy="26" r="18" fill="#FF7A2F"/><text x="232" y="32" text-anchor="middle" font-size="16" font-weight="800" fill="#fff" font-family="-apple-system,system-ui,sans-serif">3</text></svg>` },
  { t: 'Tout le calendrier du club', p: 'Entraînements, matchs, tournois et fêtes du club au même endroit, équipe par équipe.',
    art: `<svg viewBox="0 0 280 220" class="slide-art"><rect x="34" y="24" width="212" height="176" rx="26" fill="#fff"/><rect x="34" y="24" width="212" height="44" rx="22" fill="#5B3FD6"/><rect x="34" y="46" width="212" height="22" fill="#5B3FD6"/>
      <text x="56" y="53" font-size="16" font-weight="800" fill="#fff" font-family="-apple-system,system-ui,sans-serif">Octobre</text>
      ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => `<rect x="${50 + c * 27}" y="${82 + r * 28}" width="20" height="20" rx="6" fill="${(r * 7 + c) % 9 === 2 ? '#5B3FD6' : (r * 7 + c) % 7 === 4 ? '#FF7A2F' : (r * 7 + c) % 11 === 6 ? '#2F9E6E' : '#F2F2F7'}"/>`).join('')).join('')}</svg>` },
  { t: 'Une équipe autour de l’équipe', p: 'Bénévoles, cotisations, documents et messages : le club s’organise sans tableur ni groupe de discussion.',
    art: `<svg viewBox="0 0 280 220" class="slide-art">${[[70, '#FF7A2F', '4'], [140, '#5B3FD6', '10'], [210, '#2F9E6E', '23']].map(([x, c, n], i) => `<g transform="translate(${x - 40} ${i === 1 ? 30 : 56})"><path d="M18 0h44l18 16-12 16-8-6v74H20V26l-8 6L0 16z" fill="${c}"/><text x="40" y="68" text-anchor="middle" font-size="28" font-weight="900" fill="#fff" font-family="-apple-system,system-ui,sans-serif">${n}</text></g>`).join('')}
      <rect x="40" y="176" width="200" height="12" rx="6" fill="#fff" opacity=".5"/></svg>` },
];
function welcomeSlides() {
  $('#app').innerHTML = `<div class="welcome"><div class="welcome-top"><div class="auth-brand small"><img src="icons/logo.svg" alt="" width="34" height="34"><span>Club<b>Manager</b></span></div><button class="link" id="skip">Passer</button></div>
    <div class="slides" id="slides">${SLIDES.map((s) => `<section class="slide">${s.art}<h1>${s.t}</h1><p>${s.p}</p></section>`).join('')}</div>
    <div class="dots" id="dots">${SLIDES.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
    <div class="welcome-actions"><button class="btn primary block big" id="wNext">Continuer</button><button class="link" id="wLogin">J'ai déjà un compte</button></div></div>`;
  const sl = $('#slides'); let i = 0;
  const done = (mode) => { localStorage.setItem('cm_seen', '1'); renderAuth(mode); };
  sl.addEventListener('scroll', () => {
    i = Math.round(sl.scrollLeft / sl.clientWidth);
    $$('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    $('#wNext').textContent = i === SLIDES.length - 1 ? 'Créer mon compte' : 'Continuer';
  }, { passive: true });
  $('#wNext').onclick = () => { haptic(); if (i < SLIDES.length - 1) sl.scrollTo({ left: (i + 1) * sl.clientWidth, behavior: 'smooth' }); else done('signup'); };
  $('#wLogin').onclick = () => done('login');
  $('#skip').onclick = () => done('login');
}

function renderAuth(mode = 'login') {
  applyBrand(null);
  if (!localStorage.getItem('cm_seen') && !localStorage.getItem('cm_invite') && innerWidth < 900) return welcomeSlides();
  const invite = localStorage.getItem('cm_invite');
  $('#app').innerHTML = `<div class="auth">
    <section class="auth-hero">
      <div class="auth-brand"><img src="icons/logo.svg" alt="" width="56" height="56"><span>Club<b>Manager</b></span></div>
      <h1>Tout votre club,<br>dans une seule appli.</h1>
      <p>Équipes, entraînements, matchs, convocations, bénévoles, cotisations et messages — pour les clubs de basket et de tous les sports.</p>
      <ul class="auth-points"><li>🏀 Convocations en 1 clic</li><li>📅 Calendrier partagé</li><li>👨‍👩‍👧 Espace parents</li><li>🔒 Données séparées par club</li></ul>
    </section>
    <section class="auth-card card">
      ${invite ? `<div class="notice">🎟️ Code d'invitation <b>${esc(invite)}</b> : crée ton compte ou connecte-toi pour rejoindre le club.</div>` : ''}
      <div class="seg" role="tablist">
        <button class="${mode === 'login' ? 'on' : ''}" data-mode="login">Se connecter</button>
        <button class="${mode === 'signup' ? 'on' : ''}" data-mode="signup">Créer un compte</button>
      </div>
      <div id="authForm"></div>
      <div class="auth-club"><span>Responsable d'un club ?</span><button class="link" id="applyClub">Inscrire mon club</button></div>
    </section></div>`;
  $$('[data-mode]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  $('#applyClub').onclick = publicClubApplication;
  const f = $('#authForm');
  if (mode === 'login') {
    f.innerHTML = formHTML([
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Mot de passe', type: 'password', required: true },
    ]) + `<button class="btn primary block" id="go">Se connecter</button>
      <button class="link" id="forgot">Mot de passe oublié ?</button>`;
    $('#forgot').onclick = forgot;
  } else {
    f.innerHTML = formHTML([
      { name: 'full_name', label: 'Prénom et nom', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Mot de passe (6 caractères min.)', type: 'password', required: true },
    ]) + `<button class="btn primary block" id="go">Créer mon compte</button>
      <p class="muted small">En créant un compte, tu acceptes que tes données soient utilisées uniquement pour la gestion de ton club.</p>`;
  }
  $('input[type=password]', f).setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  const go = async () => {
    const btn = $('#go'); btn.disabled = true;
    try {
      const v = readForm(f);
      if (mode === 'login') {
        const { data, error } = await sb.auth.signInWithPassword({ email: v.email, password: v.password });
        if (error) throw error;
        await afterLogin(data.session);
      } else {
        const { data, error } = await sb.auth.signUp({ email: v.email, password: v.password,
          options: { data: { full_name: v.full_name }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.session) await afterLogin(data.session);
        else f.innerHTML = `<div class="empty"><div class="empty-emoji">📬</div><h3>Vérifie ta boîte mail</h3>
          <p>Un lien de confirmation a été envoyé à <b>${esc(v.email)}</b>. Clique dessus puis reviens ici pour te connecter.</p></div>`;
      }
    } catch (e) { toast(errMsg(e), 'err'); btn.disabled = false; }
  };
  $('#go').onclick = go;
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

function forgot() {
  modal({ title: 'Mot de passe oublié', body: formHTML([{ name: 'email', label: 'Ton email', type: 'email', required: true }]) +
    '<p class="muted small">Tu recevras un lien pour choisir un nouveau mot de passe.</p>',
  actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer le lien', cls: 'primary', run: async (w) => {
    const { email } = readForm(w);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
    toast('Lien envoyé ! Regarde ta boîte mail.');
  } }] });
}

function newPasswordScreen() {
  modal({ title: 'Nouveau mot de passe', body: formHTML([{ name: 'p', label: 'Nouveau mot de passe', type: 'password', required: true }]),
    actions: [{ label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const { p } = readForm(w);
      const { error } = await sb.auth.updateUser({ password: p });
      if (error) throw error;
      toast('Mot de passe modifié ✅');
      const { data } = await sb.auth.getSession();
      if (data.session) afterLogin(data.session);
    } }] });
}

// ---------------------------------------------------------------- inscription d'un club (validée par l'administrateur)
const SPORT_OPTS = () => Object.entries(SPORTS).map(([k, s]) => [k, `${s.emoji} ${s.label}`]);
const APP_FIELDS = (withContact) => [
  { name: 'club_name', label: 'Nom du club', required: true, placeholder: 'Ex. : Les Aigles Basket' },
  { name: 'city', label: 'Ville', col: 2, placeholder: 'Ex. : Narbonne' },
  { name: 'sport', label: 'Sport', type: 'select', options: SPORT_OPTS(), value: 'basket', col: 2 },
  ...(withContact ? [{ name: 'contact_name', label: 'Ton prénom et nom', required: true, col: 2 }, { name: 'email', label: 'Ton email', type: 'email', required: true, col: 2 }] : []),
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 2 },
  { name: 'players', label: 'Nombre de licenciés (environ)', type: 'number', min: 0, col: 2 },
  { name: 'message', label: 'Un mot pour nous (facultatif)', type: 'textarea', rows: 3, placeholder: 'Ta fonction au club, tes besoins…' },
];
async function sendApplication(v) {
  return q(sb.rpc('submit_club_application', { p_club_name: v.club_name, p_city: v.city || '', p_sport: v.sport || 'basket',
    p_contact_name: v.contact_name, p_email: v.email, p_phone: v.phone || '', p_players: v.players ?? null, p_message: v.message || '' }));
}
// Formulaire public (sans compte), depuis l'écran de connexion
function publicClubApplicationFor() {
  modal({ title: 'Inscrire un autre club', wide: true, body: formHTML(APP_FIELDS(false)),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer la demande', cls: 'primary', run: async (w) => {
      await sendApplication({ ...readForm(w), contact_name: S.profile.full_name, email: S.profile.email || S.user.email }); toast('Demande envoyée, en attente de validation');
    } }] });
}
export function publicClubApplication() {
  modal({ title: 'Inscrire mon club', wide: true, body: `<p class="lead">Envoie ta demande : l'équipe ClubManager la valide et t'envoie le lien pour activer l'espace de ton club.</p>` + formHTML(APP_FIELDS(true)),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer la demande', cls: 'primary', run: async (w) => {
      await sendApplication(readForm(w));
      modal({ title: 'Demande envoyée', body: `<div class="empty"><div class="empty-emoji">📨</div><h3>Merci !</h3><p>Ta demande est en cours de validation. Tu recevras le lien d'activation de ton club par email ou par message.</p></div>`,
        actions: [{ label: 'Fermer', cls: 'primary' }] });
      return false;
    } }] });
}

async function noClubYet() {
  applyBrand(null);
  const apps = await q(sb.from('club_applications').select('*').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(1)).catch(() => []);
  const a = apps[0];
  if (!S.needApproval && !(a && a.status === 'pending')) return onboarding();
  const frame = (inner) => {
    $('#app').innerHTML = `<div class="center-screen"><div class="card wizard">
      <div class="wiz-top"><div class="auth-brand small"><img src="icons/logo.svg" alt="" width="36" height="36"><span>Club<b>Manager</b></span></div>
        <button class="link" id="lo">Déconnexion</button></div>${inner}</div></div>`;
    $('#lo').onclick = () => sb.auth.signOut();
    $('#haveCode') && ($('#haveCode').onclick = joinWithCode);
  };
  if (a && a.status === 'pending') {
    frame(`<div class="empty"><div class="empty-emoji">⏳</div><h3>Demande en cours de validation</h3>
      <p>La demande pour <b>${esc(a.club_name)}</b> a bien été reçue le ${fmt.date(a.created_at)}. Dès qu'elle est validée, l'espace de ton club s'ouvrira ici automatiquement.</p>
      <button class="btn ghost" id="refresh">Vérifier maintenant</button></div>
      <div class="or"><span>ou</span></div><button class="btn ghost block" id="haveCode">🎟️ J'ai un code d'invitation</button>`);
    $('#refresh').onclick = () => afterLogin(S.session);
    return;
  }
  frame(`${a && a.status === 'rejected' ? `<div class="notice">Ta demande pour <b>${esc(a.club_name)}</b> n'a pas été acceptée${a.reject_reason ? ` : ${esc(a.reject_reason)}` : ''}. Tu peux en envoyer une nouvelle.</div>` : ''}
    <h2>Inscrire mon club</h2><p class="muted">Chaque nouveau club est validé par l'équipe ClubManager. Remplis ces informations, on active ton espace rapidement.</p>
    <div id="appForm">${formHTML(APP_FIELDS(false))}</div>
    <div class="wiz-actions"><span></span><button class="btn primary" id="sendApp">Envoyer ma demande</button></div>
    <div class="or"><span>ou</span></div><button class="btn ghost block" id="haveCode">🎟️ Mon club existe déjà : j'ai un code d'invitation</button>`);
  $('#sendApp').onclick = async () => {
    const b = $('#sendApp'); b.disabled = true;
    try { await sendApplication({ ...readForm($('#appForm')), contact_name: S.profile.full_name, email: S.profile.email || S.user.email }); toast('Demande envoyée'); noClubYet(); }
    catch (e) { toast(errMsg(e), 'err'); b.disabled = false; }
  };
}

// ---------------------------------------------------------------- assistant de création
export function onboarding(step = 0, draft = { sport: 'basket', teams: [] }) {
  applyBrand(null);
  const steps = ['Ton club', 'Ton sport', 'Ta saison', 'Tes équipes'];
  const y = new Date().getMonth() < 7 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  const pct = Math.round(((step + 1) / steps.length) * 100);
  let body = '';
  if (step === 0) {
    body = `<h2>Créons ton club 🎉</h2><p class="muted">Tu pourras tout modifier ensuite.</p>
      ${formHTML([{ name: 'name', label: 'Nom du club', required: true, placeholder: 'Ex. : Les Aigles Basket' },
        { name: 'city', label: 'Ville', placeholder: 'Ex. : Narbonne' }], draft)}
      <div class="or"><span>ou</span></div>
      <button class="btn ghost block" id="haveCode">🎟️ J'ai un code d'invitation</button>`;
  } else if (step === 1) {
    body = `<h2>Quel sport pratiquez-vous ?</h2><div class="sport-grid">${Object.entries(SPORTS).map(([k, s]) =>
      `<button class="sport ${draft.sport === k ? 'on' : ''}" data-sport="${k}"><span>${s.emoji}</span>${s.label}</button>`).join('')}</div>`;
  } else if (step === 2) {
    body = `<h2>Ta saison</h2><p class="muted">Les saisons gardent l'historique : tu pourras archiver et dupliquer chaque année.</p>
      ${formHTML([{ name: 'season', label: 'Nom de la saison', value: draft.season || `Saison ${y}-${y + 1}` }])}`;
  } else {
    const sp = SPORTS[draft.sport];
    body = `<h2>Tes équipes</h2><p class="muted">Touche les catégories de ton club. Tu pourras en créer d'autres ensuite.</p>
      <div class="chips">${sp.cats.map((c) => `<button class="chip ${draft.teams.includes(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="row gap"><input id="customCat" placeholder="Autre catégorie (ex. U13 Filles)"><button class="btn ghost" id="addCat">Ajouter</button></div>
      ${draft.teams.filter((t) => !sp.cats.includes(t)).map((t) => `<span class="chip on">${esc(t)}</span>`).join(' ')}`;
  }
  $('#app').innerHTML = `<div class="center-screen"><div class="card wizard">
    <div class="wiz-top"><div class="auth-brand small"><img src="icons/logo.svg" alt="" width="36" height="36"><span>Club<b>Manager</b></span></div>
      <button class="link" id="lo">Déconnexion</button></div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <div class="steps">${steps.map((s, i) => `<span class="${i <= step ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
    <div id="wiz">${body}</div>
    <div class="wiz-actions">${step ? '<button class="btn ghost" id="back">Retour</button>' : '<span></span>'}
      <button class="btn primary" id="next">${step === 3 ? 'Créer mon club 🚀' : 'Continuer'}</button></div>
  </div></div>`;
  $('#lo').onclick = () => sb.auth.signOut();
  $('#back') && ($('#back').onclick = () => onboarding(step - 1, draft));
  $$('[data-sport]').forEach((b) => (b.onclick = () => { draft.sport = b.dataset.sport; draft.teams = []; onboarding(1, draft); }));
  $$('[data-cat]').forEach((b) => (b.onclick = () => {
    const c = b.dataset.cat; draft.teams = draft.teams.includes(c) ? draft.teams.filter((t) => t !== c) : [...draft.teams, c]; onboarding(3, draft);
  }));
  $('#addCat') && ($('#addCat').onclick = () => { const v = $('#customCat').value.trim(); if (v && !draft.teams.includes(v)) draft.teams.push(v); onboarding(3, draft); });
  $('#haveCode') && ($('#haveCode').onclick = joinWithCode);
  $('#next').onclick = async () => {
    try {
      if (step === 0) Object.assign(draft, readForm($('#wiz')));
      if (step === 2) draft.season = readForm($('#wiz')).season;
      if (step < 3) return onboarding(step + 1, draft);
      $('#next').disabled = true;
      const cid = await q(sb.rpc('create_club', { p_name: draft.name, p_sport: draft.sport, p_season: draft.season || '', p_city: draft.city || '' }));
      const season = await q(sb.from('seasons').select('id').eq('club_id', cid).single());
      if (draft.teams.length) {
        await q(sb.from('teams').insert(draft.teams.map((t) => ({ club_id: cid, season_id: season.id, name: t, category: t }))));
      }
      localStorage.setItem('cm_club', cid);
      localStorage.setItem('cm_welcome', '1');
      await loadMemberships();
      await selectClub(cid);
      toast('Ton club est créé ! 🎉');
    } catch (e) { toast(errMsg(e), 'err'); $('#next').disabled = false; }
  };
}

export function joinWithCode() {
  modal({ title: "Rejoindre un club", body: formHTML([{ name: 'code', label: "Code d'invitation", required: true, placeholder: 'Ex. : A97B303E' }]) +
    '<p class="muted small">Le club te donne ce code (ou un lien) pour rejoindre son espace.</p>',
  actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Rejoindre', cls: 'primary', run: async (w) => {
    const { code } = readForm(w);
    const cid = await q(sb.rpc('accept_invite', { p_code: code }));
    await loadMemberships(); await selectClub(cid);
    toast('Bienvenue dans le club ! 🎉');
  } }] });
}

// ---------------------------------------------------------------- coquille de l'appli
function shell() {
  const items = navFor();
  const mobileMain = ['', 'calendrier', 'activites', 'messages'];
  const c = S.club;
  const clubImg = c?.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : '<img src="icons/logo.svg" alt="">';
  $('#app').innerHTML = `<div class="layout">
    <aside class="sidebar">
      <a class="side-brand" href="#/">${clubImg}
        <span><b>${esc(c?.name || 'ClubManager')}</b><small>${c ? SPORTS[c.sport]?.emoji + ' ' + esc(S.season?.name || '') : ''}</small></span></a>
      <nav>${items.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${icon(n.icon)}<span>${n.label}</span>${n.r === 'messages' ? '<i class="dot" data-unread hidden></i>' : ''}</a>`).join('')}
      ${role.sa() ? `<a href="#/admin" data-r="admin">${icon('shield')}<span>Super Admin</span></a>` : ''}</nav>
      <div class="side-foot">
        <button class="side-club" id="switchClub">${icon('swap')}<span>Changer de club</span></button>
        <a class="side-user" href="#/profil">${avatar(S.profile?.full_name)}<span><b>${esc(S.profile?.full_name || '')}</b><small>${S.roles.map((r) => ROLE_LABEL[r]).join(', ')}</small></span></a>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="top-club" id="topClub" aria-label="Changer de club">${clubImg}</button>
        <h1 id="pageTitle" class="compact-title"></h1>
        <div class="top-actions">
          <button class="icon-btn" id="bell" aria-label="Notifications">${icon('bell')}<i class="count" id="notifCount" hidden></i></button>
          <a class="icon-btn only-mobile" href="#/profil" aria-label="Mon profil">${avatar(S.profile?.full_name, null, 'sm')}</a>
        </div>
      </header>
      <div class="ptr" id="ptr" aria-hidden="true"><span></span></div>
      <div class="large-title-wrap"><h1 id="largeTitle" class="large-title"></h1></div>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Navigation principale">${items.filter((n) => mobileMain.includes(n.r)).map((n) => `<a href="#/${n.r}" data-r="${n.r}">${icon(n.icon)}<span>${n.short || n.label}</span>${n.r === 'messages' ? '<i class="dot" data-unread hidden></i>' : ''}</a>`).join('')}
      <button id="moreBtn">${icon('more')}<span>Plus</span></button></nav>
  </div>`;
  $('#switchClub').onclick = switchClub;
  $('#topClub').onclick = switchClub;
  $('#moreBtn').onclick = () => { haptic(); moreSheet(items.filter((n) => !mobileMain.includes(n.r))); };
  $$('.tabbar a').forEach((a) => a.addEventListener('click', () => { haptic(); if (a.classList.contains('on')) window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  $('#bell').onclick = V2.notificationsPanel;
  new IntersectionObserver(([e]) => document.body.classList.toggle('scrolled', !e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' }).observe($('#largeTitle'));
  pullToRefresh();
  window.onhashchange = () => route();
  route();
  watchRealtime();
  refreshCounters();
  if (localStorage.getItem('cm_welcome')) { localStorage.removeItem('cm_welcome'); V.welcomeTour(); }
}

// Tirer vers le bas pour actualiser (mobile)
let ptrBound = false;
function pullToRefresh() {
  if (ptrBound) return; ptrBound = true;
  let y0 = null, d = 0, busy = false;
  const P = () => $('#ptr');
  addEventListener('touchstart', (e) => { if (scrollY <= 0 && !$('.modal-wrap') && !busy) { y0 = e.touches[0].clientY; d = 0; } }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (y0 == null) return; d = e.touches[0].clientY - y0;
    const ptr = P(); if (!ptr) return;
    if (d <= 0) { ptr.style.cssText = ''; return; }
    const p = Math.min(d, 120);
    ptr.style.transform = `translateY(${p * 0.6}px)`; ptr.style.opacity = Math.min(1, p / 70);
    ptr.classList.toggle('ready', d > 80);
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (y0 == null) return; y0 = null;
    const ptr = P(); if (!ptr) return;
    if (d > 80 && !busy) {
      busy = true; haptic(12); ptr.classList.add('spin');
      try { if (S.club) await refreshClubData(); S.cache = {}; await route(true); refreshCounters(); } finally { busy = false; }
    }
    ptr.classList.remove('spin', 'ready'); ptr.style.cssText = '';
  });
}

function moreSheet(items) {
  modal({ title: 'Menu', body: `<div class="sheet-grid">${items.map((n) => `<a href="#/${n.r}" class="sheet-item">${icon(n.icon)}<span>${n.short || n.label}</span></a>`).join('')}
    ${role.sa() ? `<a href="#/admin" class="sheet-item">${icon('shield')}<span>Super Admin</span></a>` : ''}
    <a href="#/profil" class="sheet-item">${icon('user')}<span>Mon profil</span></a>
    <button class="sheet-item" id="sw2">⇄<span>Changer de club</span></button></div>`,
  onOpen: (w) => { $$('a', w).forEach((a) => a.addEventListener('click', closeModal)); $('#sw2', w).onclick = switchClub; } });
}

function switchClub() {
  modal({ title: 'Mes clubs', body: `<div class="list">${S.clubs.map((c) => `<button class="list-row" data-club="${c.id}">
      <span class="emoji-box">${SPORTS[c.sport]?.emoji || '🏅'}</span><span class="grow"><b>${esc(c.name)}</b><small>${S.memberships.filter((m) => m.club_id === c.id).map((m) => ROLE_LABEL[m.role]).join(' · ')}</small></span>
      ${c.id === S.club?.id ? '<span class="badge ok">Actif</span>' : ''}</button>`).join('')}</div>
      <div class="row gap wrap mt"><button class="btn ghost" id="newClub">＋ Créer un autre club</button><button class="btn ghost" id="joinClub">🎟️ Rejoindre avec un code</button></div>`,
  onOpen: (w) => {
    $$('[data-club]', w).forEach((b) => (b.onclick = async () => { closeModal(); location.hash = '#/'; await selectClub(b.dataset.club); }));
    $('#newClub', w).onclick = () => { closeModal(); if (S.needApproval && !role.sa()) publicClubApplicationFor(); else onboarding(); };
    $('#joinClub', w).onclick = joinWithCode;
  } });
}

const SKELETON = `<div class="skel"><div class="sk sk-hero"></div><div class="sk-row"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div><div class="sk sk-line"></div><div class="sk sk-line short"></div><div class="sk sk-card"></div></div>`;
export async function route(silent = false) {
  const path = location.hash.replace(/^#\/?/, '');
  if (path.startsWith('club/')) return V2.publicPage($('#app'), path.slice(5));
  const view = $('#view');
  if (!view) return;
  let fn, params = [];
  for (const [re, f] of ROUTES) { const m = path.match(re); if (m) { fn = f; params = m.slice(1); break; } }
  if (!fn) { location.hash = '#/'; return; }
  if (!S.club && !['admin', 'profil'].includes(path)) { location.hash = '#/admin'; return; }
  const top = path.split('/')[0];
  document.body.dataset.depth = path.includes('/') ? 'detail' : 'root';
  $$('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === top || (top === 'activite' && a.dataset.r === 'activites') || (top === 'equipe' && a.dataset.r === 'equipes') || (top === 'groupe' && a.dataset.r === 'messages')));
  const nav = NAV.find((n) => n.r === top);
  setTitle(top === '' ? (S.club?.name || 'Accueil') : (innerWidth < 900 && nav?.short) || nav?.label || '');
  if (!silent) { view.innerHTML = SKELETON; window.scrollTo(0, 0); }
  try { await fn(view, ...params); }
  catch (e) { console.error(e); view.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div><h3>Impossible d'afficher cette page</h3><p>${esc(errMsg(e))}</p><button class="btn ghost" onclick="location.reload()">Recharger</button></div>`; }
  if (!silent && !matchMedia('(prefers-reduced-motion: reduce)').matches) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
}
export const setTitle = (t) => {
  const h = $('#pageTitle'), l = $('#largeTitle');
  if (h) h.textContent = t; if (l) l.textContent = t;
  document.title = t ? `${t} · ClubManager` : 'ClubManager';
};

// ---------------------------------------------------------------- temps réel & compteurs
let channel;
function watchRealtime() {
  channel?.unsubscribe();
  channel = sb.channel('cm-' + S.user.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${S.user.id}` }, (p) => {
      refreshCounters();
      const n = p.new;
      toast(n.title, 'info');
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        navigator.serviceWorker?.ready.then((r) => r.showNotification(n.title, { body: n.body || '', icon: 'icons/icon-192.png', data: { link: n.link } }))
          .catch(() => new Notification(n.title, { body: n.body || '' }));
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `club_id=eq.${S.club?.id}` }, () => refreshCounters())
    .subscribe();
}

export async function refreshCounters() {
  if (!S.club) return;
  const [{ count: nc }, msgs, reads] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', S.user.id).eq('read', false),
    sb.from('messages').select('id, sender_id').eq('club_id', S.club.id).order('created_at', { ascending: false }).limit(200),
    sb.from('message_reads').select('message_id').eq('user_id', S.user.id),
  ]);
  const readSet = new Set((reads.data || []).map((r) => r.message_id));
  S.unread = (msgs.data || []).filter((m) => m.sender_id !== S.user.id && !readSet.has(m.id)).length;
  S.notifCount = nc || 0;
  const el = $('#notifCount');
  if (el) { el.hidden = !S.notifCount; el.textContent = S.notifCount > 9 ? '9+' : S.notifCount; }
  $$('[data-unread]').forEach((d) => (d.hidden = !S.unread));
  if (navigator.setAppBadge) (S.notifCount + S.unread ? navigator.setAppBadge(S.notifCount + S.unread) : navigator.clearAppBadge?.()).catch?.(() => {});
}

// Installation de l'appli (PWA)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.body.classList.add('can-install'); });
export async function installApp() {
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  modal({ title: "Installer l'appli", body: ios
    ? `<ol class="steps-list"><li>Touche le bouton <b>Partager</b> <span class="kbd">⬆︎</span> en bas de Safari</li><li>Choisis <b>« Sur l'écran d'accueil »</b></li><li>Touche <b>Ajouter</b> — l'icône ClubManager apparaît 🎉</li></ol>`
    : `<ol class="steps-list"><li>Ouvre le menu du navigateur <span class="kbd">⋮</span></li><li>Choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b></li></ol>` });
}
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

boot();
