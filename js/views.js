// ClubManager — tableau de bord, calendrier, activités, équipes, joueurs
import { SPACES, spaceTeams, waLink, appUrl, sb, S, role, sport, SPORTS, KINDS, kindEmoji, esc, $, $$, fmt, toast, modal, closeModal, confirmBox, formHTML, readForm,
  errMsg, q, empty, avatar, badge, fullName, toLocalInput, fromLocalInput, planLimit, uid, haptic } from './core.js';
import { icon, memberName, refreshClubData, setTitle, refreshCounters, installApp, isStandalone } from './app.js';
import { playerFamilyBlock, contactForm, myChildrenBlock, parentLinkCard, linkChildForm, WA_ICON } from './views3.js';

export const logoBlock = () => '<div class="auth-brand"><img src="icons/logo.svg" alt="" width="48" height="48"><span>Club<b>Manager</b></span></div>';

// ---------------------------------------------------------------- données
export async function myPlayerIds() {
  if (S.cache.myPlayers) return S.cache.myPlayers;
  const [own, kids] = await Promise.all([
    q(sb.from('players').select('id').eq('club_id', S.club.id).eq('user_id', S.user.id)),
    q(sb.from('guardians').select('player_id').eq('club_id', S.club.id).eq('user_id', S.user.id)),
  ]);
  return (S.cache.myPlayers = [...new Set([...own.map((p) => p.id), ...kids.map((g) => g.player_id)])]);
}
export async function loadPlayers(force = false) {
  if (S.cache.players && !force) return S.cache.players;
  return (S.cache.players = await q(sb.from('players').select('*').eq('club_id', S.club.id).is('archived_at', null).order('last_name')));
}
export async function loadActivities(from, to, extra = (x) => x) {
  let r = sb.from('activities').select('*').eq('club_id', S.club.id).order('starts_at');
  if (from) r = r.gte('starts_at', from.toISOString());
  if (to) r = r.lte('starts_at', to.toISOString());
  return q(extra(r));
}
const teamName = (id) => S.teams.find((t) => t.id === id)?.name || '';
const teamColor = (id) => S.teams.find((t) => t.id === id)?.color || '';
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const RESP = { available: ['✅', 'Disponible', 'ok'], unavailable: ['❌', 'Indisponible', 'bad'], maybe: ['❓', 'À confirmer', 'warn'], pending: ['⏳', 'Sans réponse', ''] };
const PRES = { present: ['Présent', 'ok'], absent: ['Absent', 'bad'], excused: ['Absent justifié', 'warn'], pending: ['En attente', ''] };

export function actRow(a, opts = {}) {
  const k = KINDS[a.kind];
  const score = a.kind === 'match' && a.score_for != null
    ? `<span class="score ${a.score_for > a.score_against ? 'win' : a.score_for < a.score_against ? 'loss' : ''}">${a.score_for} – ${a.score_against}</span>` : '';
  return `<a class="act-row" href="#/activite/${a.id}" style="--k:${teamColor(a.team_id) || k.color}">
    <span class="act-date"><b>${new Date(a.starts_at).getDate()}</b><small>${new Date(a.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</small></span>
    <span class="act-main"><b>${kindEmoji(a)} ${esc(a.kind === 'match' && a.opponent ? `${teamName(a.team_id) || a.title} ${a.is_home === false ? '@' : 'vs'} ${a.opponent}` : a.title)}</b>
      <small>${fmt.day(a.starts_at)} · ${fmt.time(a.starts_at)}${a.location ? ' · ' + esc(a.location) : ''}${a.team_id && a.kind !== 'match' ? ' · ' + esc(teamName(a.team_id)) : ''}</small></span>
    ${score || (opts.right || `<span class="badge" style="--b:${k.color}">${k.label}</span>`)}</a>`;
}

// ---------------------------------------------------------------- accueil
export async function dashboard(el) {
  const now = new Date();
  const myTeams = spaceTeams(), myIds = new Set(myTeams.map((t) => t.id));
  let soon = await loadActivities(now, addDays(now, 30));
  if (S.space === 'coach' && myTeams.length < S.teams.length) soon = soon.filter((a) => !a.team_id || myIds.has(a.team_id));
  const staff = role.staff();
  const fam = role.family();
  const parts = [];
  const greet = (S.profile?.full_name || '').split(' ')[0];
  parts.push(`<div class="hello"><div><p class="hello-date">${fmt.dayLong(now)}</p><h2>Bonjour ${esc(greet)} 👋</h2><p class="hello-space">${SPACES[S.space]?.emoji || ''} ${esc(SPACES[S.space]?.hello || '')}</p></div>
    ${staff ? `<button class="btn primary round" id="quickAdd" aria-label="Ajouter"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Ajouter</span></button>` : ''}</div>`);

  const nextGame = soon.find((a) => ['match', 'tournament'].includes(a.kind)) || soon.find((a) => a.kind === 'training');
  if (nextGame) parts.push(await heroCard(nextGame));
  else if (staff) parts.push(`<div class="hero hero-empty"><div class="hero-court" aria-hidden="true">${COURT}</div><div class="hero-body"><p class="hero-when">Rien de prévu pour l'instant</p><h3>Programme le prochain match</h3>
    <p>Les joueurs de l'équipe seront convoqués automatiquement.</p><button class="btn white" id="heroAdd">＋ Ajouter un match</button></div></div>`);

  if (staff) {
    const [allPlayers, dues, tasks, pend] = await Promise.all([
      loadPlayers(),
      role.admin() ? q(sb.from('dues').select('amount, paid').eq('club_id', S.club.id)) : Promise.resolve([]),
      q(sb.from('tasks').select('id, status').eq('club_id', S.club.id).neq('status', 'done')),
      q(sb.from('attendance').select('activity_id, response, activities!inner(starts_at)').eq('club_id', S.club.id).eq('response', 'pending').gte('activities.starts_at', now.toISOString())).catch(() => []),
    ]);
    const players = S.space === 'coach' ? allPlayers.filter((p) => myIds.has(p.team_id)) : allPlayers;
    const due = dues.reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0);
    const kpi = [
      ['👥', players.length, S.space === 'coach' ? 'Mes joueurs' : 'Licenciés', '#/joueurs'],
      ['🏷️', myTeams.length, S.space === 'coach' ? 'Mes équipes' : 'Équipes', '#/equipes'],
      ['📅', soon.filter((a) => a.kind === 'match').length, 'Matchs (30 j)', '#/activites'],
      ['⏳', pend.length, 'Réponses en attente', '#/activites'],
      ...(role.admin() ? [['💶', fmt.money(due), 'Cotisations dues', '#/cotisations']] : []),
      ['✅', tasks.length, 'Tâches à faire', '#/organisation'],
      ['💬', S.unread, 'Messages non lus', '#/messages'],
    ];
    parts.push(`<div class="kpis">${kpi.map(([e, v, l, h]) => `<a class="kpi" href="${h}"><span class="kpi-e">${e}</span><b>${v}</b><small>${l}</small></a>`).join('')}</div>`);
    if (role.admin()) parts.push(await checklist(players));
  }

  if (fam || (S.realRoles || []).includes('parent')) parts.push(await myChildrenBlock().catch(() => ''));
  if (S.roles.includes('parent') && !(await myPlayerIds()).length) parts.push(await parentLinkCard());
  if (fam) {
    const mine = await myPlayerIds();
    if (mine.length) {
      const att = (await q(sb.from('attendance').select('*, activities!inner(*)').in('player_id', mine).gte('activities.starts_at', now.toISOString())))
        .sort((x, y) => new Date(x.activities.starts_at) - new Date(y.activities.starts_at));
      const players = await q(sb.from('players').select('id, first_name, last_name, team_id').in('id', mine));
      const pend = att.filter((a) => a.response === 'pending' || a.response === 'maybe');
      parts.push(`<section class="card"><div class="card-head"><h3>📨 Convocations à confirmer</h3>${badge(pend.length, pend.length ? 'warn' : 'ok')}</div>
        ${pend.length ? `<div class="list">${pend.slice(0, 8).map((x) => convRow(x, players)).join('')}</div>` : '<p class="muted">Tout est à jour 👍</p>'}</section>`);
    } else if (!staff) {
      parts.push(`<div class="notice">Ton compte n'est pas encore relié à un joueur. Demande à ton entraîneur un lien d'invitation « parent » ou « joueur ».</div>`);
    }
  }

  if (role.is('volunteer') || fam) {
    const missions = await q(sb.from('missions').select('*, mission_signups(user_id)').eq('club_id', S.club.id).gte('starts_at', now.toISOString()).order('starts_at').limit(4));
    const open = missions.filter((m) => m.mission_signups.length < m.slots);
    if (open.length) parts.push(`<section class="card"><div class="card-head"><h3>🙋 Le club a besoin de toi</h3><a href="#/benevoles" class="link">Tout voir</a></div>
      <div class="list">${open.map((m) => `<a class="list-row" href="#/benevoles"><span class="emoji-box">🙋</span><span class="grow"><b>${esc(m.title)}</b><small>${fmt.dt(m.starts_at)} · ${m.slots - m.mission_signups.length} place(s)</small></span></a>`).join('')}</div></section>`);
  }

  // semaine
  const week = [...Array(7)].map((_, i) => addDays(startOfDay(), i));
  parts.push(`<section class="card"><div class="card-head"><h3>🗓️ Cette semaine</h3><a href="#/calendrier" class="link">Calendrier</a></div>
    <div class="weekstrip">${week.map((d) => {
      const evs = soon.filter((a) => startOfDay(a.starts_at).getTime() === d.getTime());
      return `<a class="wday ${d.getTime() === startOfDay().getTime() ? 'today' : ''}" href="#/calendrier" data-day="${d.toISOString()}"><small>${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</small><b>${d.getDate()}</b>
        <span class="dots">${evs.slice(0, 4).map((a) => `<i style="background:${KINDS[a.kind].color}"></i>`).join('')}</span></a>`;
    }).join('')}</div></section>`);

  const next = (k) => soon.filter((a) => k.includes(a.kind)).slice(0, 4);
  parts.push(`<div class="grid2">
    <section class="card"><div class="card-head"><h3>${sport().emoji} Prochains matchs</h3><a class="link" href="#/activites">Tout voir</a></div>
      ${next(['match', 'tournament']).map((a) => actRow(a)).join('') || '<p class="muted">Aucun match prévu.</p>'}</section>
    <section class="card"><div class="card-head"><h3>🏋️ Prochains entraînements</h3><a class="link" href="#/activites">Tout voir</a></div>
      ${next(['training']).map((a) => actRow(a)).join('') || '<p class="muted">Aucun entraînement prévu.</p>'}</section>
    <section class="card"><div class="card-head"><h3>🎉 Événements</h3><a class="link" href="#/evenements">Tout voir</a></div>
      ${next(['event', 'meeting', 'volunteer']).map((a) => actRow(a)).join('') || '<p class="muted">Aucun événement prévu.</p>'}</section>
    <section class="card" id="annCard"><div class="card-head"><h3>📣 Annonces</h3><a class="link" href="#/messages">Messages</a></div><div class="muted">…</div></section>
  </div>`);

  el.innerHTML = parts.join('');
  $('#linkChild', el) && ($('#linkChild', el).onclick = () => linkChildForm(() => dashboard(el)));
  bindConvButtons(el, () => dashboard(el));
  if (!isStandalone() && !localStorage.getItem('cm_noinstall')) el.insertAdjacentHTML('beforeend', `<div class="install-card"><img src="icons/icon-192.png" alt="" width="48" height="48"><div><b>Installe ClubManager</b><small>Ajoute l'appli à ton écran d'accueil pour l'ouvrir en une touche.</small></div><button class="btn sm white" id="installBtn">Installer</button><button class="icon-btn" id="noInstall" aria-label="Masquer">✕</button></div>`);
  $('#installBtn', el) && ($('#installBtn', el).onclick = installApp);
  $('#noInstall', el) && ($('#noInstall', el).onclick = () => { localStorage.setItem('cm_noinstall', '1'); $('.install-card', el).remove(); });
  $$('.hero[data-href]', el).forEach((h) => { const go = (e) => { if (!e.target.closest('button')) location.hash = h.dataset.href; }; h.onclick = go; h.onkeydown = (e) => { if (e.key === 'Enter') go(e); }; });
  $$('[data-mykid]', el).forEach((b) => (b.onclick = async () => { const pl = await q(sb.from('players').select('*').eq('id', b.dataset.mykid).single()); playerSheet(pl); }));
  $('#heroAdd', el) && ($('#heroAdd', el).onclick = () => S.teams.length ? activityForm({ kind: 'match', team_id: S.teams.length === 1 ? S.teams[0].id : '' }, () => dashboard(el)) : (location.hash = '#/equipes'));
  $('#quickAdd', el) && ($('#quickAdd', el).onclick = quickAdd);
  $$('[data-check]', el).forEach((b) => (b.onclick = () => (location.hash = b.dataset.check)));

  const ann = await q(sb.from('messages').select('*').eq('club_id', S.club.id).eq('is_announcement', true).order('created_at', { ascending: false }).limit(3));
  const ac = $('#annCard', el);
  if (ac) ac.lastElementChild.outerHTML = ann.length ? `<div class="list">${ann.map((m) => `<div class="ann"><b>${esc(m.subject || 'Annonce')}</b><p>${esc(m.body).slice(0, 180)}</p><small>${fmt.rel(m.created_at)} · ${esc(m.sender_name || '')}</small></div>`).join('')}</div>` : '<p class="muted">Aucune annonce pour le moment.</p>';
}

function quickAdd() {
  const opts = [['training', '🏋️ Entraînement'], ['match', `${sport().emoji} Match`], ['event', '🎉 Événement'], ['player', '👤 Joueur'], ['message', '📣 Annonce'], ['task', '✅ Tâche']];
  modal({ title: 'Ajouter', body: `<div class="sheet-grid">${opts.map(([k, l]) => `<button class="sheet-item" data-q="${k}"><span class="big">${l.split(' ')[0]}</span><span>${l.split(' ').slice(1).join(' ')}</span></button>`).join('')}</div>`,
    onOpen: (w) => $$('[data-q]', w).forEach((b) => (b.onclick = () => {
      const k = b.dataset.q;
      if (['training', 'match', 'event'].includes(k)) activityForm({ kind: k });
      else if (k === 'player') playerForm();
      else if (k === 'message') { closeModal(); location.hash = '#/messages?new=1'; location.hash = '#/messages'; setTimeout(() => $('#newMsg')?.click(), 400); }
      else if (k === 'task') { closeModal(); location.hash = '#/organisation'; setTimeout(() => $('#newTask')?.click(), 400); }
    })) });
}

async function checklist(players) {
  const [{ count: inv }, { count: tr }, { count: ma }, { count: ev }] = await Promise.all([
    sb.from('invites').select('id', { count: 'exact', head: true }).eq('club_id', S.club.id),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('club_id', S.club.id).eq('kind', 'training'),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('club_id', S.club.id).eq('kind', 'match'),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('club_id', S.club.id).in('kind', ['event', 'tournament', 'meeting']),
  ]);
  const steps = [
    ['Créer son club', true, '#/club'], ['Choisir son sport', true, '#/club'], ['Choisir sa saison', !!S.season, '#/club'],
    ['Créer ses équipes', S.teams.length > 0, '#/equipes'], ['Ajouter les entraîneurs', S.members.some((m) => m.roles.includes('coach')), '#/club'],
    ['Ajouter les joueurs', players.length > 0, '#/joueurs'], ['Inviter parents et membres', (inv || 0) > 0, '#/joueurs'],
    ['Ajouter les entraînements', (tr || 0) > 0, '#/activites'], ['Ajouter les matchs', (ma || 0) > 0, '#/activites'],
    ['Lancer le calendrier et les événements', (ev || 0) > 0, '#/evenements'],
  ];
  const done = steps.filter((s) => s[1]).length;
  if (done === steps.length) return '';
  return `<section class="card checklist"><div class="card-head"><h3>🚀 Bien démarrer</h3><span class="muted">${done}/${steps.length}</span></div>
    <div class="progress"><div style="width:${done * 10}%"></div></div>
    <ol>${steps.map(([l, ok, h], i) => `<li class="${ok ? 'done' : ''}"><button data-check="${h}"><span class="tick">${ok ? '✓' : i + 1}</span>${l}</button></li>`).join('')}</ol></section>`;
}

export function welcomeTour() {
  modal({ title: 'Bienvenue dans ClubManager 🎉', body: `<p class="lead">Ton club <b>${esc(S.club.name)}</b> est prêt.</p>
    <ol class="steps-list"><li>Ajoute tes <b>joueurs</b> (un par un ou en liste rapide)</li><li>Crée tes <b>entraînements</b> et <b>matchs</b> : les convocations partent toutes seules</li>
    <li>Envoie un <b>lien d'invitation</b> aux parents par WhatsApp ou SMS</li><li>Installe l'appli sur ton téléphone pour un accès en 1 touche</li></ol>`,
  actions: [{ label: "C'est parti !", cls: 'primary' }] });
}

// Carte « prochain match » : tableau d'affichage
const COURT = `<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="-10" y="20" width="420" height="180" rx="4"/><path d="M200 20v180"/><circle cx="200" cy="110" r="36"/><path d="M-10 60h70a50 50 0 0 1 0 100H-10M410 60h-70a50 50 0 0 0 0 100h70"/><path d="M-10 35c140 0 140 150 0 150M410 35c-140 0-140 150 0 150"/></g></svg>`;
const until = (d) => {
  const days = Math.round((startOfDay(d) - startOfDay()) / 864e5);
  return days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : days < 7 ? `Dans ${days} jours` : fmt.date(d);
};
async function heroCard(a) {
  const team = S.teams.find((t) => t.id === a.team_id);
  const isMatch = a.kind !== 'training';
  let extra = '';
  if (a.team_id && role.staff()) {
    const att = await q(sb.from('attendance').select('response').eq('activity_id', a.id)).catch(() => []);
    const ok = att.filter((x) => x.response === 'available').length;
    extra = att.length ? `<div class="hero-meter"><div class="hero-bar"><i style="width:${Math.round((ok / att.length) * 100)}%"></i></div><small>${ok} disponible${ok > 1 ? 's' : ''} sur ${att.length} convoqué${att.length > 1 ? 's' : ''}</small></div>` : '';
  } else if (role.family()) {
    const mine = await myPlayerIds();
    if (mine.length) {
      const att = await q(sb.from('attendance').select('*').eq('activity_id', a.id).in('player_id', mine)).catch(() => []);
      if (att.length) extra = `<div class="hero-rsvp">${att.map((x) => `<div class="resp" data-a="${a.id}" data-p="${x.player_id}">${['available', 'unavailable', 'maybe'].map((r) =>
        `<button class="${x.response === r ? 'on ' + RESP[r][2] : ''}" data-resp="${r}" aria-label="${RESP[r][1]}">${RESP[r][0]} <span>${RESP[r][1]}</span></button>`).join('')}</div>`).join('')}</div>`;
    }
  }
  return `<div class="hero" role="link" tabindex="0" data-href="#/activite/${a.id}"><div class="hero-court" aria-hidden="true">${COURT}</div>
    <div class="hero-body"><p class="hero-when"><b>${until(a.starts_at)}</b> à ${fmt.time(a.starts_at)}</p>
    ${isMatch && a.opponent ? `<div class="hero-vs"><span class="hero-team">${esc(team?.name || S.club.name)}</span><span class="hero-x">${a.is_home === false ? '@' : 'vs'}</span><span class="hero-team">${esc(a.opponent)}</span></div>`
      : `<h3>${kindEmoji(a)} ${esc(a.title)}</h3>`}
    <p class="hero-place">${a.location ? '📍 ' + esc(a.location) : ''}${isMatch && a.kind === 'match' ? (a.is_home === false ? ' — à l’extérieur' : ' — à domicile') : ''}${a.meet_at ? ` — rendez-vous ${fmt.time(a.meet_at)}` : ''}</p>
    ${extra}</div></div>`;
}

// Convocation avec boutons de réponse
function convRow(x, players) {
  const a = x.activities; const p = players.find((pl) => pl.id === x.player_id);
  return `<div class="conv"><a href="#/activite/${a.id}" class="grow"><b>${kindEmoji(a)} ${esc(a.kind === 'match' && a.opponent ? 'vs ' + a.opponent : a.title)}</b>
    <small>${esc(p ? p.first_name : '')} · ${fmt.dt(a.starts_at)}${a.location ? ' · ' + esc(a.location) : ''}</small></a>
    <div class="resp" data-a="${a.id}" data-p="${x.player_id}">${['available', 'unavailable', 'maybe'].map((r) =>
      `<button class="${x.response === r ? 'on ' + RESP[r][2] : ''}" data-resp="${r}" title="${RESP[r][1]}" aria-label="${RESP[r][1]}">${RESP[r][0]}</button>`).join('')}</div></div>`;
}
export function bindConvButtons(root, after) {
  $$('[data-resp]', root).forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation(); haptic(10);
    const box = b.closest('.resp');
    try {
      await q(sb.from('attendance').update({ response: b.dataset.resp }).eq('activity_id', box.dataset.a).eq('player_id', box.dataset.p));
      toast(`Réponse enregistrée : ${RESP[b.dataset.resp][1]}`);
      after?.();
    } catch (e) { toast(errMsg(e), 'err'); }
  }));
}

// ---------------------------------------------------------------- calendrier
const CAL = { view: innerWidth < 700 ? 'list' : 'month', date: new Date(), kinds: new Set(Object.keys(KINDS)), team: '' };
export async function calendar(el) {
  const d = CAL.date;
  let from, to;
  if (CAL.view === 'month') { from = startOfDay(new Date(d.getFullYear(), d.getMonth(), 1)); from = addDays(from, -((from.getDay() + 6) % 7)); to = addDays(from, 42); }
  else if (CAL.view === 'week') { from = addDays(startOfDay(d), -((d.getDay() + 6) % 7)); to = addDays(from, 7); }
  else if (CAL.view === 'day') { from = startOfDay(d); to = addDays(from, 1); }
  else { from = startOfDay(d); to = addDays(from, 60); }
  const [acts, missions] = await Promise.all([
    loadActivities(from, to),
    q(sb.from('missions').select('*').eq('club_id', S.club.id).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString())),
  ]);
  const all = [...acts, ...missions.filter((m) => !m.activity_id).map((m) => ({ ...m, kind: 'volunteer', _mission: true }))]
    .filter((a) => CAL.kinds.has(a.kind) && (!CAL.team || a.team_id === CAL.team))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const title = CAL.view === 'month' ? d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : CAL.view === 'week' ? `Semaine du ${fmt.date(from)}` : CAL.view === 'day' ? fmt.dayLong(d) : 'Les 60 prochains jours';

  let grid = '';
  const itemHTML = (a) => `<button class="cal-ev" data-ev="${a.id}" data-m="${a._mission ? 1 : ''}" style="--k:${KINDS[a.kind].color}">${fmt.time(a.starts_at)} ${kindEmoji(a)} ${esc(a.kind === 'match' && a.opponent ? 'vs ' + a.opponent : a.title)}</button>`;
  if (CAL.view === 'month') {
    grid = `<div class="month"><div class="mh">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="mgrid">${[...Array(42)].map((_, i) => {
        const day = addDays(from, i); const evs = all.filter((a) => startOfDay(a.starts_at).getTime() === day.getTime());
        return `<div class="mcell ${day.getMonth() !== d.getMonth() ? 'out' : ''} ${day.getTime() === startOfDay().getTime() ? 'today' : ''}" data-day="${day.toISOString()}">
          <span class="mday">${day.getDate()}</span>${evs.slice(0, 3).map(itemHTML).join('')}${evs.length > 3 ? `<small class="more" data-goday="${day.toISOString()}">+${evs.length - 3}</small>` : ''}</div>`;
      }).join('')}</div></div>`;
  } else if (CAL.view === 'week' || CAL.view === 'day') {
    const n = CAL.view === 'week' ? 7 : 1;
    grid = `<div class="weekcols n${n}">${[...Array(n)].map((_, i) => {
      const day = addDays(from, i); const evs = all.filter((a) => startOfDay(a.starts_at).getTime() === day.getTime());
      return `<div class="wcol ${day.getTime() === startOfDay().getTime() ? 'today' : ''}" data-day="${day.toISOString()}"><h4>${fmt.day(day)}</h4>${evs.map(itemHTML).join('') || '<small class="muted">—</small>'}</div>`;
    }).join('')}</div>`;
  } else {
    const days = [...new Set(all.map((a) => startOfDay(a.starts_at).getTime()))];
    grid = days.length ? days.map((t) => `<h4 class="list-day">${fmt.dayLong(t)}</h4>${all.filter((a) => startOfDay(a.starts_at).getTime() === t).map((a) => a._mission
      ? `<button class="act-row" data-ev="${a.id}" data-m="1" style="--k:${KINDS.volunteer.color}"><span class="act-date"><b>${new Date(a.starts_at).getDate()}</b></span><span class="act-main"><b>🙋 ${esc(a.title)}</b><small>${fmt.time(a.starts_at)} · Bénévolat</small></span></button>`
      : actRow(a)).join('')}`).join('') : empty('📅', 'Rien de prévu', 'Aucune activité sur cette période.');
  }

  el.innerHTML = `<div class="toolbar">
      <div class="row gap"><button class="icon-btn" id="prev" aria-label="Précédent">‹</button><button class="btn ghost sm" id="today">Aujourd'hui</button><button class="icon-btn" id="next" aria-label="Suivant">›</button><h2 class="cal-title">${esc(title)}</h2></div>
      <div class="row gap wrap"><div class="seg sm">${[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['list', 'Liste']].map(([k, l]) => `<button class="${CAL.view === k ? 'on' : ''}" data-view="${k}">${l}</button>`).join('')}</div>
      ${role.staff() ? '<button class="btn primary sm" id="addAct">＋ Ajouter</button>' : ''}</div></div>
    <div class="filters"><select id="teamF" aria-label="Équipe"><option value="">Tout le club</option>${S.teams.map((t) => `<option value="${t.id}" ${CAL.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      ${Object.entries(KINDS).map(([k, v]) => `<button class="chip ${CAL.kinds.has(k) ? 'on' : ''}" data-kind="${k}" style="--c:${v.color}">${v.emoji} ${v.label}</button>`).join('')}</div>
    <div class="card cal-card">${grid}</div>`;

  const step = (n) => {
    if (CAL.view === 'month') CAL.date = new Date(d.getFullYear(), d.getMonth() + n, 1);
    else CAL.date = addDays(d, n * (CAL.view === 'week' ? 7 : CAL.view === 'day' ? 1 : 30));
    calendar(el);
  };
  $('#prev', el).onclick = () => step(-1); $('#next', el).onclick = () => step(1);
  $('#today', el).onclick = () => { CAL.date = new Date(); calendar(el); };
  $$('[data-view]', el).forEach((b) => (b.onclick = () => { CAL.view = b.dataset.view; calendar(el); }));
  $$('[data-kind]', el).forEach((b) => (b.onclick = () => { const k = b.dataset.kind; CAL.kinds.has(k) ? CAL.kinds.delete(k) : CAL.kinds.add(k); calendar(el); }));
  $('#teamF', el).onchange = (e) => { CAL.team = e.target.value; calendar(el); };
  $('#addAct', el) && ($('#addAct', el).onclick = () => activityForm({ kind: 'training' }, () => calendar(el)));
  $$('[data-goday]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); CAL.date = new Date(b.dataset.goday); CAL.view = 'day'; calendar(el); }));
  $$('[data-ev]', el).forEach((b) => (b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.m) return (location.hash = '#/benevoles');
    const a = all.find((x) => x.id === b.dataset.ev); if (a) activityPeek(a);
  }));
  if (role.staff()) $$('.mcell,.wcol', el).forEach((c) => (c.ondblclick = () => {
    const day = new Date(c.dataset.day); day.setHours(18, 0);
    activityForm({ kind: 'training', starts_at: day.toISOString() }, () => calendar(el));
  }));
}

function activityPeek(a) {
  const k = KINDS[a.kind];
  modal({ title: `${kindEmoji(a)} ${a.kind === 'match' && a.opponent ? `${teamName(a.team_id)} vs ${a.opponent}` : a.title}`,
    body: `<div class="peek"><p>${badge(k.label)} ${a.team_id ? badge(teamName(a.team_id)) : ''}</p>
      <p>🕒 <b>${fmt.dayLong(a.starts_at)}</b> · ${fmt.time(a.starts_at)}${a.ends_at ? ' → ' + fmt.time(a.ends_at) : ''}</p>
      ${a.location ? `<p>📍 ${esc(a.location)}${a.room ? ' · ' + esc(a.room) : ''}</p>` : ''}
      ${a.kind === 'match' ? `<p>🏟️ ${a.is_home === false ? 'Extérieur' : 'Domicile'}${a.meet_at ? ` · RDV ${fmt.time(a.meet_at)}` : ''}${a.transport ? ' · 🚗 ' + esc(a.transport) : ''}</p>` : ''}
      ${a.description ? `<p class="pre">${esc(a.description)}</p>` : ''}</div>`,
    actions: [{ label: 'Fermer', cls: 'ghost' }, { label: 'Voir le détail', cls: 'primary', run: () => { location.hash = `#/activite/${a.id}`; } }] });
}

// ---------------------------------------------------------------- formulaire activité
export function activityForm(a = {}, after) {
  const kind = a.kind || 'training';
  const editing = !!a.id;
  const start = a.starts_at ? new Date(a.starts_at) : (() => { const x = addDays(new Date(), 1); x.setHours(18, 0, 0, 0); return x; })();
  const end = a.ends_at ? new Date(a.ends_at) : new Date(start.getTime() + (kind === 'match' ? 2 : 1.5) * 3600000);
  const teamOpts = [['', kind === 'event' || kind === 'meeting' ? '— Tout le club —' : '— Choisir —'], ...S.teams.map((t) => [t.id, t.name])];
  const EVENT_EMOJI = ['🎉', '🏀', '🏆', '🍽️', '🤝', '🎟️', '💰', '🎄', '📸', '⚽', '🎂', '🏕️'];
  const fields = [
    { name: 'kind', label: 'Type', type: 'select', options: Object.entries(KINDS).filter(([k]) => k !== 'volunteer').map(([k, v]) => [k, `${v.emoji} ${v.label}`]), value: kind, col: 2 },
    { name: 'team_id', label: 'Équipe', type: 'select', options: teamOpts, value: a.team_id || '', col: 2, required: kind === 'training' || kind === 'match' },
    ...(kind === 'match' ? [
      { name: 'opponent', label: 'Adversaire', required: true, value: a.opponent, col: 2 },
      { name: 'is_home', label: 'Lieu du match', type: 'select', options: [['1', '🏠 Domicile'], ['0', '🚌 Extérieur']], value: a.is_home === false ? '0' : '1', col: 2 },
    ] : [{ name: 'title', label: 'Titre', required: true, value: a.title || (kind === 'training' ? 'Entraînement' : ''), placeholder: kind === 'event' ? 'Ex. : Tournoi de Noël' : '' }]),
    { name: 'starts_at', label: 'Début', type: 'datetime-local', required: true, value: toLocalInput(start), col: 2 },
    { name: 'ends_at', label: 'Fin', type: 'datetime-local', value: toLocalInput(end), col: 2 },
    { name: 'location', label: 'Lieu', value: a.location, placeholder: 'Ex. : Gymnase municipal', col: 2 },
    { name: kind === 'match' ? 'address' : 'room', label: kind === 'match' ? 'Adresse' : 'Salle / terrain', value: kind === 'match' ? a.address : a.room, col: 2 },
    ...(kind === 'training' ? [{ name: 'training_type', label: "Type d'entraînement", type: 'select', options: ['', 'Technique', 'Physique', 'Tactique', 'Tirs', 'Match interne', 'Récupération', 'Gardiens / spécifique'], value: a.training_type }] : []),
    ...(kind === 'match' ? [
      { name: 'meet_at', label: 'Heure de rendez-vous', type: 'datetime-local', value: toLocalInput(a.meet_at || new Date(start.getTime() - 3600000)), col: 2 },
      { name: 'transport', label: 'Transport', value: a.transport, placeholder: 'Ex. : covoiturage parents', col: 2 },
    ] : []),
    ...(['event', 'tournament'].includes(kind) ? [
      { name: 'capacity', label: 'Places max.', type: 'number', min: 0, value: a.capacity, col: 3 },
      { name: 'price', label: 'Tarif (€)', type: 'number', min: 0, step: '0.5', value: a.price, col: 3 },
      { name: 'organizer', label: 'Organisateur', value: a.organizer, col: 3 },
      { name: 'image_url', label: "Image (lien) — facultatif", value: a.image_url },
      { name: 'is_public', label: 'Afficher sur la page publique du club', type: 'checkbox', value: a.is_public ?? true },
    ] : []),
    { name: 'description', label: kind === 'match' ? 'Notes' : 'Description', type: 'textarea', value: a.description },
    ...(!editing && kind === 'training' ? [{ name: 'repeat', label: 'Répéter chaque semaine (nombre de semaines)', type: 'number', min: 0, value: 0, hint: 'Ex. : 12 pour créer tout le trimestre d’un coup' }] : []),
  ];
  const w = modal({
    title: editing ? 'Modifier' : `Nouveau : ${KINDS[kind].label.toLowerCase()}`, wide: true,
    body: (['event', 'tournament'].includes(kind) ? `<div class="emoji-pick">${EVENT_EMOJI.map((e) => `<button type="button" data-emo="${e}" class="${(a.emoji || '🎉') === e ? 'on' : ''}">${e}</button>`).join('')}</div>` : '')
      + formHTML(fields, {}),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: editing ? 'Enregistrer' : 'Créer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const row = {
        club_id: S.club.id, season_id: a.season_id || S.season?.id || null, kind: v.kind,
        team_id: v.team_id || null, starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at),
        location: v.location, description: v.description,
      };
      if (v.kind === 'match') Object.assign(row, { opponent: v.opponent, is_home: v.is_home !== '0', address: v.address, meet_at: fromLocalInput(v.meet_at), transport: v.transport, title: `${teamName(v.team_id) || 'Match'} vs ${v.opponent}` });
      else Object.assign(row, { title: v.title, room: v.room ?? null });
      if (v.kind === 'training') row.training_type = v.training_type;
      if (['event', 'tournament'].includes(v.kind)) Object.assign(row, { capacity: v.capacity, price: v.price, organizer: v.organizer, image_url: v.image_url, is_public: v.is_public, emoji: $('.emoji-pick .on', w)?.dataset.emo || '🎉' });
      if (row.ends_at && row.ends_at < row.starts_at) throw new Error('La fin doit être après le début');
      if (editing) { await q(sb.from('activities').update(row).eq('id', a.id)); toast('Modifications enregistrées'); }
      else {
        row.created_by = S.user.id;
        const n = Math.min(Number(v.repeat) || 0, 52);
        const rows = [row, ...[...Array(n)].map((_, i) => ({ ...row, starts_at: addDays(row.starts_at, 7 * (i + 1)).toISOString(), ends_at: row.ends_at ? addDays(row.ends_at, 7 * (i + 1)).toISOString() : null }))];
        await q(sb.from('activities').insert(rows));
        toast(rows.length > 1 ? `${rows.length} entraînements créés 📅` : row.team_id && ['training', 'match'].includes(row.kind) ? 'Créé — les joueurs sont convoqués 📨' : 'Créé ✅');
      }
      after ? after() : location.hash === '#/activites' ? activities($('#view')) : (location.hash = '#/activites');
    } }],
  });
  // changer de type recharge le formulaire
  $('[name=kind]', w).onchange = (e) => { const v = readSafe(w); activityForm({ ...a, ...v, kind: e.target.value, id: a.id }, after); };
  $$('[data-emo]', w).forEach((b) => (b.onclick = () => { $$('[data-emo]', w).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }));
}
function readSafe(w) {
  const o = {};
  $$('[name]', w).forEach((el) => { if (el.name !== 'kind' && el.value) o[el.name] = el.type === 'datetime-local' ? fromLocalInput(el.value) : el.value; });
  if (o.is_home) o.is_home = o.is_home !== '0';
  return o;
}

// ---------------------------------------------------------------- entraînements & matchs
const ACT = { tab: 'upcoming', kind: 'all', team: '' };
export async function activities(el) {
  const now = new Date();
  const fam = role.family() && !role.staff();
  let list;
  if (ACT.tab === 'upcoming') list = await loadActivities(startOfDay(now), null, (r) => r.limit(150));
  else list = (await loadActivities(addDays(now, -365), now, (r) => r.order('starts_at', { ascending: false }).limit(150))).reverse();
  list = list.filter((a) => ['training', 'match', 'tournament'].includes(a.kind) && (ACT.kind === 'all' || a.kind === ACT.kind) && (!ACT.team || a.team_id === ACT.team));
  if (ACT.tab === 'past') list.reverse();

  let mine = [], att = [], myPlayers = [];
  if (role.family()) {
    mine = await myPlayerIds();
    if (mine.length) {
      [att, myPlayers] = await Promise.all([
        q(sb.from('attendance').select('*').in('player_id', mine)),
        q(sb.from('players').select('id, first_name, last_name, team_id').in('id', mine)),
      ]);
    }
  }
  if (fam && mine.length) list = list.filter((a) => att.some((x) => x.activity_id === a.id) || myPlayers.some((p) => p.team_id === a.team_id));

  el.innerHTML = `<div class="toolbar"><div class="seg">${[['upcoming', 'À venir'], ['past', 'Passés']].map(([k, l]) => `<button class="${ACT.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="row gap wrap">${role.staff() ? `<button class="btn primary" data-new="training">＋ Entraînement</button><button class="btn primary" data-new="match">＋ Match</button>` : ''}</div></div>
    <div class="filters"><select id="teamF" aria-label="Équipe"><option value="">Toutes les équipes</option>${S.teams.map((t) => `<option value="${t.id}" ${ACT.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      ${[['all', 'Tout'], ['training', '🏋️ Entraînements'], ['match', `${sport().emoji} Matchs`], ['tournament', '🏆 Tournois']].map(([k, l]) => `<button class="chip ${ACT.kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="card">${list.length ? list.map((a) => {
      const mineHere = att.filter((x) => x.activity_id === a.id);
      if (!mineHere.length || ACT.tab === 'past') return actRow(a);
      return `<div class="act-wrap">${actRow(a, { right: ' ' })}${mineHere.map((x) => `<div class="conv inline"><small class="grow">${esc(myPlayers.find((p) => p.id === x.player_id)?.first_name || '')}</small>
        <div class="resp" data-a="${a.id}" data-p="${x.player_id}">${['available', 'unavailable', 'maybe'].map((r) => `<button class="${x.response === r ? 'on ' + RESP[r][2] : ''}" data-resp="${r}" aria-label="${RESP[r][1]}">${RESP[r][0]}</button>`).join('')}</div></div>`).join('')}</div>`;
    }).join('') : empty('📋', ACT.tab === 'upcoming' ? 'Rien de prévu' : 'Aucune activité passée', role.staff() ? 'Crée ton premier entraînement ou match : les joueurs de l’équipe sont convoqués automatiquement.' : '')}</div>`;

  $$('[data-tab]', el).forEach((b) => (b.onclick = () => { ACT.tab = b.dataset.tab; activities(el); }));
  $$('[data-k]', el).forEach((b) => (b.onclick = () => { ACT.kind = b.dataset.k; activities(el); }));
  $('#teamF', el).onchange = (e) => { ACT.team = e.target.value; activities(el); };
  $$('[data-new]', el).forEach((b) => (b.onclick = () => {
    if (!S.teams.length) return toast("Crée d'abord une équipe", 'err');
    activityForm({ kind: b.dataset.new, team_id: ACT.team || (S.teams.length === 1 ? S.teams[0].id : '') }, () => activities(el));
  }));
  bindConvButtons(el, () => activities(el));
}

// ---------------------------------------------------------------- détail d'une activité
export async function activityDetail(el, id) {
  const a = await q(sb.from('activities').select('*').eq('id', id).single());
  setTitle(KINDS[a.kind].label);
  const staff = role.staff();
  const isTeamAct = !!a.team_id && ['training', 'match', 'tournament'].includes(a.kind);
  const isEvent = ['event', 'tournament', 'meeting'].includes(a.kind);
  const past = new Date(a.starts_at) < new Date();

  const [att, players, regs, tasks, missions] = await Promise.all([
    isTeamAct ? q(sb.from('attendance').select('*').eq('activity_id', id)) : [],
    isTeamAct ? q(sb.from('players').select('id, first_name, last_name, jersey, position, photo_url').eq('club_id', S.club.id)) : [],
    isEvent ? q(sb.from('registrations').select('*').eq('activity_id', id).neq('status', 'cancelled').order('created_at')) : [],
    q(sb.from('tasks').select('*').eq('activity_id', id).order('due_at')),
    q(sb.from('missions').select('*, mission_signups(user_id, name)').eq('activity_id', id).order('starts_at')),
  ]);
  const mine = role.family() ? await myPlayerIds() : [];
  const pl = (pid) => players.find((p) => p.id === pid);
  const counts = Object.fromEntries(Object.keys(RESP).map((k) => [k, att.filter((x) => x.response === k).length]));
  const k = KINDS[a.kind];

  const head = `<div class="detail-head" style="--k:${teamColor(a.team_id) || k.color}">
    ${a.image_url ? `<img class="cover" src="${esc(a.image_url)}" alt="">` : ''}
    <div><p>${badge(k.label)} ${a.team_id ? badge(teamName(a.team_id)) : ''} ${a.training_type ? badge(a.training_type) : ''}</p>
    <h2>${kindEmoji(a)} ${esc(a.kind === 'match' && a.opponent ? `${teamName(a.team_id) || ''} ${a.is_home === false ? '@' : 'vs'} ${a.opponent}` : a.title)}</h2>
    <p class="meta">🕒 ${fmt.dayLong(a.starts_at)} · ${fmt.time(a.starts_at)}${a.ends_at ? ' → ' + fmt.time(a.ends_at) : ''}</p>
    ${a.location ? `<p class="meta">📍 ${esc(a.location)}${a.room ? ' · ' + esc(a.room) : ''}${a.address ? ' · ' + esc(a.address) : ''}
      <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.location, a.address].filter(Boolean).join(' '))}">Itinéraire</a></p>` : ''}
    ${a.kind === 'match' ? `<p class="meta">${a.is_home === false ? '🚌 Extérieur' : '🏠 Domicile'}${a.meet_at ? ` · ⏰ RDV ${fmt.time(a.meet_at)}` : ''}${a.transport ? ' · 🚗 ' + esc(a.transport) : ''}</p>` : ''}
    ${a.price ? `<p class="meta">💶 ${fmt.money(a.price)}${a.organizer ? ' · Organisé par ' + esc(a.organizer) : ''}</p>` : a.organizer ? `<p class="meta">👤 ${esc(a.organizer)}</p>` : ''}
    ${a.description ? `<p class="pre">${esc(a.description)}</p>` : ''}</div>
    ${staff ? `<div class="row gap wrap"><button class="btn ghost sm" id="edit">✏️ Modifier</button><button class="btn ghost sm" id="dup">⧉ Dupliquer</button>
      ${a.team_id ? '<button class="btn ghost sm" id="remind">📣 Relancer</button>' : ''}<button class="btn wa sm" id="waShare">${WA_ICON} WhatsApp</button><button class="btn ghost sm danger-text" id="del">🗑 Supprimer</button></div>` : ''}
  </div>`;

  // résultat de match
  let result = '';
  if (a.kind === 'match' && (past || a.score_for != null)) {
    const st = sport().stats;
    const statPlayers = att.filter((x) => x.status === 'present' || x.response === 'available').map((x) => pl(x.player_id)).filter(Boolean);
    result = `<section class="card"><div class="card-head"><h3>🏁 Résultat</h3>${staff ? '<button class="btn sm primary" id="saveRes">Enregistrer</button>' : ''}</div>
      ${a.score_for != null ? `<div class="bigscore ${a.score_for > a.score_against ? 'win' : a.score_for < a.score_against ? 'loss' : ''}"><span>${esc(S.club.name)}</span><b>${a.score_for} – ${a.score_against}</b><span>${esc(a.opponent || '')}</span>
        <em>${a.score_for > a.score_against ? 'Victoire 🎉' : a.score_for < a.score_against ? 'Défaite' : 'Match nul'}</em></div>` : ''}
      ${staff ? `<div class="form"><div class="field col-2"><label>Nos points</label><input type="number" min="0" id="sf" value="${a.score_for ?? ''}"></div>
        <div class="field col-2"><label>Points adverses</label><input type="number" min="0" id="sa" value="${a.score_against ?? ''}"></div>
        <div class="field"><label>Compte rendu</label><textarea id="rep" rows="3">${esc(a.report || '')}</textarea></div></div>
        ${statPlayers.length ? `<h4>📊 Statistiques individuelles</h4><div class="table-wrap"><table class="table stats-table"><thead><tr><th>Joueur</th>${st.map(([, l]) => `<th title="${l}">${l.split(' ')[0]}</th>`).join('')}</tr></thead>
          <tbody>${statPlayers.map((p) => `<tr data-sp="${p.id}"><td>${p.jersey ? `<span class="jersey">${esc(p.jersey)}</span>` : ''}${esc(fullName(p))}</td>${st.map(([key]) => `<td><input type="number" min="0" data-st="${key}" value="${a.stats?.[p.id]?.[key] ?? ''}" aria-label="${key}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<p class="muted small">Marque les joueurs présents pour saisir leurs statistiques.</p>'}`
      : `${a.report ? `<p class="pre">${esc(a.report)}</p>` : ''}${Object.keys(a.stats || {}).length ? statsReadonly(a, players) : ''}`}
    </section>`;
  }

  // convocations / présences
  let conv = '';
  if (isTeamAct) {
    const rows = att.map((x) => ({ ...x, p: pl(x.player_id) })).filter((x) => x.p).sort((x, y) => x.p.last_name.localeCompare(y.p.last_name));
    const visible = staff ? rows : rows.filter((x) => mine.includes(x.player_id));
    conv = `<section class="card"><div class="card-head"><h3>${a.kind === 'match' ? '📨 Convocations' : '🙋 Présences'}</h3>
      ${staff ? `<div class="row gap"><span class="badge ok">✅ ${counts.available}</span><span class="badge bad">❌ ${counts.unavailable}</span><span class="badge warn">❓ ${counts.maybe}</span><span class="badge">⏳ ${counts.pending}</span></div>` : ''}</div>
      ${visible.length ? `<div class="list">${visible.map((x) => `<div class="att-row">
        ${avatar(fullName(x.p), x.p.photo_url)}<span class="grow"><b>${esc(fullName(x.p))}</b><small>${x.p.jersey ? '#' + esc(x.p.jersey) + ' · ' : ''}${RESP[x.response][0]} ${RESP[x.response][1]}</small></span>
        ${mine.includes(x.player_id) && !past ? `<div class="resp" data-a="${a.id}" data-p="${x.player_id}">${['available', 'unavailable', 'maybe'].map((r) => `<button class="${x.response === r ? 'on ' + RESP[r][2] : ''}" data-resp="${r}" aria-label="${RESP[r][1]}">${RESP[r][0]}</button>`).join('')}</div>` : ''}
        ${staff ? `<select class="pres ${PRES[x.status][1]}" data-pres="${x.player_id}" aria-label="Présence">${Object.entries(PRES).map(([kk, [l]]) => `<option value="${kk}" ${x.status === kk ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      </div>`).join('')}</div>` : '<p class="muted">Aucun joueur dans cette équipe pour le moment.</p>'}
      ${staff && rows.length ? `<div class="row gap mt"><button class="btn ghost sm" id="allPresent">Tous présents</button><button class="btn ghost sm" id="fromResp">Présence = réponses</button></div>` : ''}
    </section>`;
  }

  // inscriptions événement
  let reg = '';
  if (isEvent) {
    const registered = regs.filter((r) => r.status === 'registered');
    const seats = registered.reduce((s, r) => s + r.seats, 0);
    const wait = regs.filter((r) => r.status === 'waitlist');
    const me = regs.find((r) => r.user_id === S.user.id);
    const full = a.capacity && seats >= a.capacity;
    reg = `<section class="card"><div class="card-head"><h3>🎟️ Inscriptions</h3><span class="muted">${seats}${a.capacity ? ' / ' + a.capacity : ''} place(s)</span></div>
      ${a.capacity ? `<div class="progress"><div style="width:${Math.min(100, (seats / a.capacity) * 100)}%"></div></div>` : ''}
      ${!past ? (me ? `<p>${me.status === 'waitlist' ? "⏳ Tu es sur liste d'attente" : '✅ Tu es inscrit'} (${me.seats} place${me.seats > 1 ? 's' : ''}) <button class="link" id="unreg">Se désinscrire</button></p>`
        : `<div class="row gap"><input type="number" id="seats" min="1" max="20" value="1" aria-label="Nombre de places" style="width:80px"><button class="btn primary" id="reg">${full ? "Liste d'attente" : "Je m'inscris"}</button></div>`) : ''}
      ${registered.length ? `<h4>Participants</h4><div class="chips">${registered.map((r) => `<span class="chip">${esc(r.name)}${r.seats > 1 ? ' ×' + r.seats : ''}${a.price ? (r.paid ? ' 💶' : '') : ''}${staff ? ` <button class="x" data-rm="${r.id}" aria-label="Retirer">✕</button>` : ''}</span>`).join('')}</div>` : ''}
      ${wait.length ? `<h4>Liste d'attente</h4><div class="chips">${wait.map((r) => `<span class="chip">${esc(r.name)}${staff ? ` <button class="x" data-promote="${r.id}" title="Passer en inscrit">↑</button>` : ''}</span>`).join('')}</div>` : ''}
      ${staff && a.price && registered.length ? `<p class="muted small">Touche un participant pour marquer son paiement.</p>` : ''}
    </section>`;
  }

  // tâches & bénévoles liés
  const org = (staff || role.is('volunteer') || missions.length || tasks.length) && (isEvent || a.kind === 'match') ? `<div class="grid2">
    <section class="card"><div class="card-head"><h3>✅ Tâches</h3>${role.is('admin', 'coach', 'volunteer') ? '<button class="btn sm ghost" id="addTask">＋</button>' : ''}</div>
      ${tasks.length ? tasks.map((t) => `<div class="task-mini ${t.status}"><span>${{ todo: '🔴', doing: '🟡', done: '🟢' }[t.status]}</span><span class="grow">${esc(t.title)}<small>${esc(t.assignee_name || memberName(t.assignee_id) || '')}</small></span></div>`).join('') : '<p class="muted small">Aucune tâche.</p>'}</section>
    <section class="card"><div class="card-head"><h3>🙋 Bénévoles</h3>${staff ? '<button class="btn sm ghost" id="addMission">＋</button>' : ''}</div>
      ${missions.length ? missions.map((m) => { const inn = m.mission_signups.some((s) => s.user_id === S.user.id); return `<div class="task-mini"><span>🙋</span><span class="grow">${esc(m.title)}<small>${fmt.time(m.starts_at)} · ${m.mission_signups.map((s) => esc(s.name)).join(', ') || 'personne'} (${m.mission_signups.length}/${m.slots})</small></span>
        <button class="btn sm ${inn ? 'ghost' : 'primary'}" data-mis="${m.id}" data-in="${inn ? 1 : ''}" ${!inn && m.mission_signups.length >= m.slots ? 'disabled' : ''}>${inn ? 'Me retirer' : 'Je viens'}</button></div>`; }).join('') : '<p class="muted small">Aucune mission.</p>'}</section></div>` : '';

  el.innerHTML = `<a class="back" href="#/${isEvent ? 'evenements' : 'activites'}">‹ Retour</a>${head}${result}${conv}${reg}${org}`;
  const reload = () => activityDetail(el, id);
  bindConvButtons(el, reload);

  if (staff) {
    $('#edit', el).onclick = () => activityForm(a, reload);
    $('#dup', el).onclick = () => { const { id: _, created_at, score_for, score_against, report, stats, ...rest } = a; activityForm({ ...rest, starts_at: addDays(a.starts_at, 7).toISOString(), ends_at: a.ends_at ? addDays(a.ends_at, 7).toISOString() : null }); };
    $('#del', el).onclick = async () => {
      if (!(await confirmBox(`Supprimer « ${a.title} » ? Les convocations et réponses associées seront supprimées.`, { ok: 'Supprimer' }))) return;
      try { await q(sb.from('activities').delete().eq('id', id)); toast('Supprimé'); history.back(); } catch (e) { toast(errMsg(e), 'err'); }
    };
    $('#waShare', el) && ($('#waShare', el).onclick = () => {
      const lines = [`${kindEmoji(a)} ${a.kind === 'match' && a.opponent ? `${teamName(a.team_id) || ''} ${a.is_home === false ? '@' : 'vs'} ${a.opponent}` : a.title}`,
        `🕒 ${fmt.dayLong(a.starts_at)} à ${fmt.time(a.starts_at)}`, a.meet_at ? `⏰ RDV ${fmt.time(a.meet_at)}` : '', a.location ? `📍 ${[a.location, a.address].filter(Boolean).join(', ')}` : '',
        isTeamAct ? '\n✅ Merci d’indiquer ta présence dans l’appli :' : '\n👉 Détails :', appUrl(`#/activite/${a.id}`)];
      window.open(waLink(lines.filter(Boolean).join('\n')), '_blank', 'noopener');
    });
    $('#remind', el) && ($('#remind', el).onclick = async () => {
      const pend = att.filter((x) => x.response === 'pending').length;
      try {
        await q(sb.from('messages').insert({ club_id: S.club.id, sender_id: S.user.id, sender_name: S.profile.full_name, audience: 'team', team_id: a.team_id,
          subject: `Rappel : ${a.title}`, body: `${kindEmoji(a)} ${a.title}\n🕒 ${fmt.dayLong(a.starts_at)} à ${fmt.time(a.starts_at)}${a.location ? '\n📍 ' + a.location : ''}${a.meet_at ? '\n⏰ RDV ' + fmt.time(a.meet_at) : ''}\n\nMerci de confirmer votre présence dans l'appli 🙏` }));
        toast(`Rappel envoyé à l'équipe${pend ? ` (${pend} sans réponse)` : ''}`);
      } catch (e) { toast(errMsg(e), 'err'); }
    });
    $$('[data-pres]', el).forEach((s) => (s.onchange = async () => {
      try { await q(sb.from('attendance').update({ status: s.value }).eq('activity_id', id).eq('player_id', s.dataset.pres)); s.className = 'pres ' + PRES[s.value][1]; toast('Présence enregistrée'); }
      catch (e) { toast(errMsg(e), 'err'); }
    }));
    $('#allPresent', el) && ($('#allPresent', el).onclick = async () => { await q(sb.from('attendance').update({ status: 'present' }).eq('activity_id', id)); reload(); });
    $('#fromResp', el) && ($('#fromResp', el).onclick = async () => {
      await Promise.all([
        sb.from('attendance').update({ status: 'present' }).eq('activity_id', id).eq('response', 'available'),
        sb.from('attendance').update({ status: 'excused' }).eq('activity_id', id).eq('response', 'unavailable'),
      ]); reload();
    });
    $('#saveRes', el) && ($('#saveRes', el).onclick = async () => {
      const stats = {};
      $$('[data-sp]', el).forEach((tr) => { const o = {}; $$('[data-st]', tr).forEach((i) => { if (i.value !== '') o[i.dataset.st] = Number(i.value); }); if (Object.keys(o).length) stats[tr.dataset.sp] = o; });
      const sf = $('#sf', el).value, sa = $('#sa', el).value;
      try {
        await q(sb.from('activities').update({ score_for: sf === '' ? null : +sf, score_against: sa === '' ? null : +sa, report: $('#rep', el).value || null, stats }).eq('id', id));
        toast('Résultat enregistré 🏁'); reload();
      } catch (e) { toast(errMsg(e), 'err'); }
    });
    $$('[data-rm]', el).forEach((b) => (b.onclick = async () => { if (await confirmBox('Retirer cette inscription ?')) { await q(sb.from('registrations').delete().eq('id', b.dataset.rm)); reload(); } }));
    $$('[data-promote]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('registrations').update({ status: 'registered' }).eq('id', b.dataset.promote)); reload(); }));
    $('#addMission', el) && ($('#addMission', el).onclick = () => import('./views2.js').then((m) => m.missionForm({ activity_id: id, starts_at: a.starts_at }, reload)));
  }
  $('#addTask', el) && ($('#addTask', el).onclick = () => import('./views2.js').then((m) => m.taskForm({ activity_id: id }, reload)));
  $$('[data-mis]', el).forEach((b) => (b.onclick = async () => {
    try {
      if (b.dataset.in) await q(sb.from('mission_signups').delete().eq('mission_id', b.dataset.mis).eq('user_id', S.user.id));
      else await q(sb.from('mission_signups').insert({ mission_id: b.dataset.mis, user_id: S.user.id, club_id: S.club.id, name: S.profile.full_name }));
      reload();
    } catch (e) { toast(errMsg(e), 'err'); }
  }));
  $('#reg', el) && ($('#reg', el).onclick = async () => {
    const seats = Math.max(1, +$('#seats', el).value || 1);
    const taken = regs.filter((r) => r.status === 'registered').reduce((s, r) => s + r.seats, 0);
    const status = a.capacity && taken + seats > a.capacity ? 'waitlist' : 'registered';
    try { await q(sb.from('registrations').insert({ activity_id: id, club_id: S.club.id, user_id: S.user.id, name: S.profile.full_name, seats, status })); toast(status === 'waitlist' ? "Ajouté à la liste d'attente" : 'Inscription confirmée 🎉'); reload(); }
    catch (e) { toast(errMsg(e), 'err'); }
  });
  $('#unreg', el) && ($('#unreg', el).onclick = async () => { await q(sb.from('registrations').delete().eq('activity_id', id).eq('user_id', S.user.id)); reload(); });
}

function statsReadonly(a, players) {
  const st = sport().stats;
  const rows = Object.entries(a.stats || {}).map(([pid, s]) => [players.find((p) => p.id === pid), s]).filter(([p]) => p);
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Joueur</th>${st.map(([, l]) => `<th>${l.split(' ')[0]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([p, s]) => `<tr><td>${esc(fullName(p))}</td>${st.map(([k]) => `<td>${s[k] ?? '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------- équipes
export async function teams(el) {
  const players = await loadPlayers();
  const coaches = S.members.filter((m) => m.roles.includes('coach') || m.roles.includes('admin'));
  const shown = spaceTeams();
  el.innerHTML = `<div class="toolbar"><p class="muted">${shown.length} équipe(s)${shown.length < S.teams.length ? ' dont tu es l’entraîneur' : ''} · ${esc(S.season?.name || '')}</p>
    ${role.admin() ? '<button class="btn primary" id="newTeam">＋ Nouvelle équipe</button>' : ''}</div>
    ${shown.length ? `<div class="cards">${shown.map((t) => {
      const n = players.filter((p) => p.team_id === t.id).length;
      return `<a class="team-card" href="#/equipe/${t.id}" style="--t:${t.color || 'var(--brand)'}"><div class="team-badge">${esc((t.category || t.name).slice(0, 4))}</div>
        <div><b>${esc(t.name)}</b><small>${[t.category, t.gender, t.level].filter(Boolean).map(esc).join(' · ')}</small>
        <small>👥 ${n} joueur${n > 1 ? 's' : ''}${t.coach_id ? ' · 🧑‍🏫 ' + esc(memberName(t.coach_id)) : ''}</small></div></a>`;
    }).join('')}</div>` : empty('🏷️', 'Aucune équipe', 'Crée tes équipes (U9, U11, Seniors…) pour organiser joueurs, entraînements et matchs.', role.admin() ? '<button class="btn primary" id="newTeam2">＋ Créer une équipe</button>' : '')}`;
  const open = () => teamForm({}, coaches);
  $('#newTeam', el) && ($('#newTeam', el).onclick = open);
  $('#newTeam2', el) && ($('#newTeam2', el).onclick = open);
}

export function teamForm(t = {}, coaches = S.members.filter((m) => m.roles.includes('coach') || m.roles.includes('admin'))) {
  if (!t.id && S.teams.length >= planLimit('teams')) return toast(`Ton offre permet ${planLimit('teams')} équipes. Passe à l'offre supérieure pour en ajouter.`, 'err');
  const cOpts = [['', '— Aucun —'], ...coaches.map((c) => [c.id, c.full_name])];
  modal({ title: t.id ? "Modifier l'équipe" : 'Nouvelle équipe', body: `<datalist id="cats">${sport().cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>` + formHTML([
    { name: 'name', label: "Nom de l'équipe", required: true, placeholder: 'Ex. : U13 Garçons 1' },
    { name: 'category', label: 'Catégorie', list: 'cats', col: 2, hint: 'Choisis ou écris ta propre catégorie' },
    { name: 'gender', label: 'Sexe', type: 'select', options: ['', 'Masculin', 'Féminin', 'Mixte'], col: 2 },
    { name: 'level', label: 'Niveau', placeholder: 'Ex. : Départemental', col: 2 },
    { name: 'color', label: 'Couleur', type: 'color', col: 2 },
    { name: 'coach_id', label: 'Entraîneur', type: 'select', options: cOpts, col: 2 },
    { name: 'assistant_id', label: 'Assistant', type: 'select', options: cOpts, col: 2 },
  ], t) + (coaches.length < 2 ? '<p class="muted small">Pour choisir un entraîneur, invite-le d’abord depuis « Mon club » → Membres.</p>' : ''),
  actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
    const v = readForm(w);
    v.coach_id = v.coach_id || null; v.assistant_id = v.assistant_id || null;
    if (t.id) await q(sb.from('teams').update(v).eq('id', t.id));
    else await q(sb.from('teams').insert({ ...v, club_id: S.club.id, season_id: S.season?.id }));
    await refreshClubData(); toast('Équipe enregistrée');
    location.hash.startsWith('#/equipe/') ? teamDetail($('#view'), t.id) : teams($('#view'));
  } }] });
}

export async function teamDetail(el, id) {
  const t = S.teams.find((x) => x.id === id) || await q(sb.from('teams').select('*').eq('id', id).single());
  setTitle(t.name);
  const [players, acts, att] = await Promise.all([
    loadPlayers(true),
    q(sb.from('activities').select('*').eq('team_id', id).order('starts_at')),
    q(sb.from('attendance').select('player_id, status, activity_id').eq('club_id', S.club.id)),
  ]);
  const roster = players.filter((p) => p.team_id === id);
  const now = new Date();
  const upcoming = acts.filter((a) => new Date(a.starts_at) >= startOfDay(now)).slice(0, 6);
  const matches = acts.filter((a) => a.kind === 'match' && a.score_for != null);
  const w = matches.filter((m) => m.score_for > m.score_against).length, l = matches.filter((m) => m.score_for < m.score_against).length;
  const pastIds = new Set(acts.filter((a) => new Date(a.starts_at) < now).map((a) => a.id));
  const rate = (pid) => { const r = att.filter((x) => x.player_id === pid && pastIds.has(x.activity_id) && x.status !== 'pending'); return r.length ? Math.round((r.filter((x) => x.status === 'present').length / r.length) * 100) : null; };

  el.innerHTML = `<a class="back" href="#/equipes">‹ Équipes</a>
    <div class="detail-head" style="--k:${t.color || 'var(--brand)'}"><div><p>${[t.category, t.gender, t.level].filter(Boolean).map((x) => badge(x)).join(' ')}</p><h2>${esc(t.name)}</h2>
      <p class="meta">🧑‍🏫 ${esc(memberName(t.coach_id) || 'Pas d’entraîneur')}${t.assistant_id ? ' · Assistant : ' + esc(memberName(t.assistant_id)) : ''}</p></div>
      <div class="row gap wrap">${role.staff() ? `<button class="btn ghost sm" id="editT">✏️ Modifier</button><button class="btn ghost sm" id="inviteT">🔗 Inviter</button>` : ''}
      ${role.admin() ? '<button class="btn ghost sm danger-text" id="archT">Archiver</button>' : ''}</div></div>
    <div class="kpis small"><div class="kpi"><b>${roster.length}</b><small>Joueurs</small></div><div class="kpi"><b>${matches.length}</b><small>Matchs joués</small></div>
      <div class="kpi"><b>${w} – ${l}</b><small>Victoires – Défaites</small></div><div class="kpi"><b>${upcoming.length}</b><small>À venir</small></div></div>
    <div class="grid2"><section class="card"><div class="card-head"><h3>👥 Effectif</h3>${role.staff() ? '<button class="btn sm primary" id="addP">＋ Joueur</button>' : ''}</div>
      ${roster.length ? `<div class="list">${roster.map((p) => { const r = rate(p.id); return `<button class="list-row" data-player="${p.id}">${avatar(fullName(p), p.photo_url)}<span class="grow"><b>${p.jersey ? `<span class="jersey">${esc(p.jersey)}</span>` : ''}${esc(fullName(p))}</b><small>${esc(p.position || '')}${p.birth_date ? ' · ' + fmt.age(p.birth_date) + ' ans' : ''}</small></span>
        ${r == null ? '' : `<span class="rate ${r >= 75 ? 'ok' : r >= 50 ? 'warn' : 'bad'}" title="Taux de présence">${r}%</span>`}</button>`; }).join('')}</div>` : '<p class="muted">Aucun joueur.</p>'}</section>
    <section class="card"><div class="card-head"><h3>📅 À venir</h3>${role.staff() ? '<button class="btn sm ghost" id="addA">＋</button>' : ''}</div>${upcoming.map((a) => actRow(a)).join('') || '<p class="muted">Rien de prévu.</p>'}</section></div>`;
  $$('[data-player]', el).forEach((b) => (b.onclick = () => playerSheet(roster.find((p) => p.id === b.dataset.player), () => teamDetail(el, id))));
  $('#editT', el) && ($('#editT', el).onclick = () => teamForm(t));
  $('#inviteT', el) && ($('#inviteT', el).onclick = () => inviteDialog({ team_id: id, roles: role.admin() ? ['player', 'parent', 'coach'] : ['player', 'parent'], label: t.name }));
  $('#addP', el) && ($('#addP', el).onclick = () => playerForm({ team_id: id }, () => teamDetail(el, id)));
  $('#addA', el) && ($('#addA', el).onclick = () => activityForm({ kind: 'training', team_id: id }, () => teamDetail(el, id)));
  $('#archT', el) && ($('#archT', el).onclick = async () => {
    if (!(await confirmBox(`Archiver l'équipe « ${t.name} » ? Elle disparaîtra des listes mais son historique est conservé.`, { ok: 'Archiver' }))) return;
    await q(sb.from('teams').update({ archived_at: new Date().toISOString() }).eq('id', id));
    await refreshClubData(); location.hash = '#/equipes';
  });
}

// ---------------------------------------------------------------- invitations
export function inviteDialog({ team_id = null, player_id = null, roles = ['parent'], label = '' }) {
  const RL = { player: '🏃 Joueur', parent: '👨‍👩‍👧 Parent', coach: '🧑‍🏫 Entraîneur', volunteer: '🙋 Bénévole', admin: '🛡️ Administrateur' };
  modal({ title: `Inviter${label ? ' — ' + label : ''}`,
    body: `<p class="muted">Crée un lien à envoyer par WhatsApp, SMS ou email. La personne crée son compte et rejoint directement le club avec le bon rôle.</p>
      <div class="chips" id="rolePick">${roles.map((r, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-role="${r}">${RL[r]}</button>`).join('')}</div>
      <div id="invOut" class="mt"></div>`,
    actions: [{ label: 'Fermer', cls: 'ghost' }, { label: 'Créer le lien', cls: 'primary', run: async (w) => {
      const r = $('#rolePick .on', w).dataset.role;
      const inv = await q(sb.from('invites').insert({ club_id: S.club.id, role: r, team_id, player_id, label, created_by: S.user.id, max_uses: player_id ? 3 : 50 }).select().single());
      const link = `${location.origin}${location.pathname}#/rejoindre/${inv.code}`;
      const msg = `Bonjour ! Rejoins ${S.club.name} sur ClubManager (${RL[r].slice(2).trim().toLowerCase()}${label ? ' – ' + label : ''}) : ${link}`;
      $('#invOut', w).innerHTML = `<div class="invite-box"><small>Code</small><b class="code">${inv.code}</b><input readonly value="${esc(link)}" aria-label="Lien d'invitation">
        <div class="row gap wrap"><button class="btn sm primary" id="cp">📋 Copier</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>
        <a class="btn sm ghost" href="sms:?&body=${encodeURIComponent(msg)}">SMS</a>${navigator.share ? '<button class="btn sm ghost" id="sh">Partager…</button>' : ''}</div>
        <small class="muted">Valable 30 jours.</small></div>`;
      $('#cp', w).onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Lien copié'));
      $('#sh', w) && ($('#sh', w).onclick = () => navigator.share({ title: S.club.name, text: msg }).catch(() => {}));
      return false;
    } }],
    onOpen: (w) => $$('[data-role]', w).forEach((b) => (b.onclick = () => { $$('[data-role]', w).forEach((x) => x.classList.remove('on')); b.classList.add('on'); })) });
}

// ---------------------------------------------------------------- joueurs
const PL = { search: '', team: '', lic: '' };
export async function players(el) {
  const list = await loadPlayers(true);
  const f = list.filter((p) => (!PL.team || (PL.team === 'none' ? !p.team_id : p.team_id === PL.team)) && (!PL.lic || p.license_status === PL.lic)
    && (!PL.search || `${p.first_name} ${p.last_name} ${p.license_no || ''} ${p.jersey || ''}`.toLowerCase().includes(PL.search.toLowerCase())));
  const LIC = { valide: ['Licence valide', 'ok'], en_attente: ['Licence en attente', 'warn'], expiree: ['Licence expirée', 'bad'] };
  el.innerHTML = `<div class="toolbar"><input type="search" id="ps" placeholder="Rechercher un joueur" value="${esc(PL.search)}" aria-label="Rechercher">
    <div class="row gap wrap">${role.staff() ? `<button class="btn ghost" id="bulk">⚡ Ajout rapide</button><button class="btn primary" id="newP">＋ Joueur</button>` : ''}</div></div>
    <div class="filters"><select id="pt" aria-label="Équipe"><option value="">Toutes les équipes</option><option value="none" ${PL.team === 'none' ? 'selected' : ''}>Sans équipe</option>${S.teams.map((t) => `<option value="${t.id}" ${PL.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <select id="pl" aria-label="Licence"><option value="">Toutes les licences</option>${Object.entries(LIC).map(([k, [l]]) => `<option value="${k}" ${PL.lic === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="muted">${f.length} joueur(s)</span></div>
    ${f.length ? `<div class="card table-card"><div class="table-wrap"><table class="table click"><thead><tr><th>Joueur</th><th>Équipe</th><th class="hide-sm">N°</th><th class="hide-sm">Poste</th><th class="hide-sm">Âge</th><th>Licence</th></tr></thead>
      <tbody>${f.map((p) => `<tr data-player="${p.id}"><td><div class="cell-user">${avatar(fullName(p), p.photo_url, 'sm')}<b>${esc(fullName(p))}</b></div></td><td>${esc(teamName(p.team_id) || '—')}</td>
        <td class="hide-sm">${esc(p.jersey || '')}</td><td class="hide-sm">${esc(p.position || '')}</td><td class="hide-sm">${p.birth_date ? fmt.age(p.birth_date) : ''}</td><td>${badge(LIC[p.license_status][0].replace('Licence ', ''), LIC[p.license_status][1])}</td></tr>`).join('')}</tbody></table></div></div>`
      : empty('👤', list.length ? 'Aucun résultat' : 'Aucun joueur', list.length ? 'Essaie une autre recherche.' : 'Ajoute tes joueurs un par un ou colle une liste de noms avec « Ajout rapide ».')}`;
  const ps = $('#ps', el);
  ps.oninput = () => { PL.search = ps.value; clearTimeout(ps._t); ps._t = setTimeout(() => { players(el).then(() => { const n = $('#ps', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 250); };
  $('#pt', el).onchange = (e) => { PL.team = e.target.value; players(el); };
  $('#pl', el).onchange = (e) => { PL.lic = e.target.value; players(el); };
  $('#newP', el) && ($('#newP', el).onclick = () => playerForm({ team_id: PL.team && PL.team !== 'none' ? PL.team : '' }, () => players(el)));
  $('#bulk', el) && ($('#bulk', el).onclick = () => bulkPlayers(() => players(el)));
  $$('[data-player]', el).forEach((r) => (r.onclick = () => playerSheet(list.find((p) => p.id === r.dataset.player), () => players(el))));
}

function bulkPlayers(after) {
  modal({ title: 'Ajout rapide de joueurs', body: formHTML([
    { name: 'team_id', label: 'Équipe', type: 'select', options: [['', '— Sans équipe —'], ...S.teams.map((t) => [t.id, t.name])] },
    { name: 'list', label: 'Un joueur par ligne : Prénom Nom (et numéro facultatif)', type: 'textarea', rows: 8, required: true, placeholder: 'Léo Martin 7\nInès Garcia 12\nNoah Petit' },
  ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Ajouter', cls: 'primary', run: async (w) => {
    const v = readForm(w);
    const rows = v.list.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const parts = l.split(/\s+/); let jersey = null;
      if (/^\d{1,3}$/.test(parts[parts.length - 1]) && parts.length > 2) jersey = parts.pop();
      return { club_id: S.club.id, team_id: v.team_id || null, first_name: parts.shift(), last_name: parts.join(' ') || '-', jersey };
    });
    const cur = (await loadPlayers()).length;
    if (cur + rows.length > planLimit('players')) throw new Error(`Ton offre permet ${planLimit('players')} joueurs.`);
    await q(sb.from('players').insert(rows));
    toast(`${rows.length} joueur(s) ajouté(s) 👍`); after?.();
  } }] });
}

export function playerForm(p = {}, after) {
  const sp = sport();
  const fields = [
    { type: 'section', label: 'Identité' },
    { name: 'first_name', label: 'Prénom', required: true, col: 2 }, { name: 'last_name', label: 'Nom', required: true, col: 2 },
    { name: 'birth_date', label: 'Date de naissance', type: 'date', col: 2 },
    { name: 'team_id', label: 'Équipe', type: 'select', options: [['', '— Sans équipe —'], ...S.teams.map((t) => [t.id, t.name])], col: 2 },
    { type: 'section', label: 'Licence & jeu' },
    { name: 'license_no', label: 'N° de licence', col: 2 },
    { name: 'license_status', label: 'Statut licence', type: 'select', options: [['en_attente', 'En attente'], ['valide', 'Valide'], ['expiree', 'Expirée']], col: 2 },
    { name: 'jersey', label: 'N° de maillot', col: 3 },
    { name: 'position', label: S.club.sport === 'basket' ? 'Poste' : 'Position', type: sp.positions.length ? 'select' : 'text', options: ['', ...sp.positions], col: 3 },
    ...(['basket', 'volley', 'handball', 'rugby'].includes(S.club.sport) ? [{ name: 'height_cm', label: 'Taille (cm)', type: 'number', min: 0, col: 3 }] : []),
    { type: 'section', label: 'Coordonnées' },
    { name: 'phone', label: 'Téléphone', type: 'tel', col: 2 }, { name: 'email', label: 'Email', type: 'email', col: 2 },
    { type: 'section', label: 'Responsable légal (mineurs)' },
    { name: 'guardian_name', label: 'Nom du responsable', col: 3 }, { name: 'guardian_phone', label: 'Téléphone', type: 'tel', col: 3 }, { name: 'guardian_email', label: 'Email', type: 'email', col: 3 },
    { name: 'notes', label: 'Notes (visibles par l’encadrement)', type: 'textarea' },
  ];
  modal({ title: p.id ? 'Modifier le joueur' : 'Nouveau joueur', wide: true,
    body: `<div class="photo-row">${avatar(fullName(p) || '?', p.photo_url, 'lg')}<label class="btn ghost sm">📷 Photo<input type="file" accept="image/*" id="photo" hidden></label></div>` + formHTML(fields, p),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      v.team_id = v.team_id || null;
      const file = $('#photo', w).files[0];
      if (file) v.photo_url = await import('./core.js').then((m) => m.upload(file, 'club-public', 'players'));
      if (p.id) await q(sb.from('players').update(v).eq('id', p.id));
      else {
        if ((await loadPlayers()).length >= planLimit('players')) throw new Error(`Ton offre permet ${planLimit('players')} joueurs.`);
        const np = await q(sb.from('players').insert({ ...v, club_id: S.club.id }).select('id').single());
        if (v.guardian_name) {
          const [first, ...rest] = v.guardian_name.trim().split(/\s+/);
          const fc = await q(sb.from('family_contacts').insert({ club_id: S.club.id, first_name: first, last_name: rest.join(' ') || v.last_name,
            phone: v.guardian_phone, email: v.guardian_email, relation: 'Parent', emergency: true }).select('id').single()).catch(() => null);
          if (fc) await sb.from('family_links').insert({ contact_id: fc.id, player_id: np.id, club_id: S.club.id });
        }
      }
      S.cache.players = null; toast('Joueur enregistré'); after?.();
    } }] });
}

export async function playerSheet(p, after) {
  const now = new Date();
  const [att, dues, docs, guardians] = await Promise.all([
    q(sb.from('attendance').select('*, activities(title, kind, starts_at, opponent)').eq('player_id', p.id)),
    role.admin() ? q(sb.from('dues').select('*').eq('player_id', p.id)) : [],
    q(sb.from('documents').select('*').eq('player_id', p.id)),
    role.staff() ? q(sb.from('guardians').select('user_id').eq('player_id', p.id)) : [],
  ]);
  const past = att.filter((x) => x.activities && new Date(x.activities.starts_at) < now && x.status !== 'pending');
  const rate = past.length ? Math.round((past.filter((x) => x.status === 'present').length / past.length) * 100) : null;
  const totals = {}; // statistiques cumulées
  const acts = await q(sb.from('activities').select('stats').eq('club_id', S.club.id).eq('kind', 'match').not('score_for', 'is', null));
  let gp = 0; acts.forEach((a) => { const s = a.stats?.[p.id]; if (s) { gp++; Object.entries(s).forEach(([k, v]) => (totals[k] = (totals[k] || 0) + v)); } });
  const due = dues[0];
  const famBlock = await playerFamilyBlock(p).catch(() => '');
  modal({ title: fullName(p), wide: true, onOpen: (w) => { $('[data-addparent]', w) && ($('[data-addparent]', w).onclick = () => contactForm({}, [p.id], () => playerSheet(p, after))); }, body: `<div class="player-head">${avatar(fullName(p), p.photo_url, 'xl')}<div>
      <p>${p.jersey ? `<span class="jersey big">${esc(p.jersey)}</span>` : ''}${badge(teamName(p.team_id) || 'Sans équipe')} ${p.position ? badge(p.position) : ''}</p>
      <p class="muted">${p.birth_date ? `${fmt.date(p.birth_date)} (${fmt.age(p.birth_date)} ans)` : ''}${p.height_cm ? ' · ' + p.height_cm + ' cm' : ''}</p>
      <p class="muted">Licence ${esc(p.license_no || '—')} · ${{ valide: '✅ valide', en_attente: '⏳ en attente', expiree: '⚠️ expirée' }[p.license_status]}</p></div></div>
    <div class="kpis small"><div class="kpi"><b>${rate == null ? '—' : rate + '%'}</b><small>Présence</small></div><div class="kpi"><b>${past.length}</b><small>Séances/matchs</small></div>
      ${gp ? sport().stats.slice(0, 2).map(([k, l]) => `<div class="kpi"><b>${((totals[k] || 0) / gp).toFixed(1)}</b><small>${l} / match</small></div>`).join('') : ''}
      ${due ? `<div class="kpi"><b>${fmt.money(due.amount - due.paid)}</b><small>Reste à payer</small></div>` : ''}</div>
    <div class="grid2"><div><h4>📇 Coordonnées</h4><p>${p.phone ? `📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a><br>` : ''}${p.email ? `✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}${!p.phone && !p.email ? '<span class="muted">—</span>' : ''}</p>
      ${p.guardian_name || p.guardian_phone ? `<h4>👨‍👩‍👧 Responsable légal</h4><p>${esc(p.guardian_name || '')}${p.guardian_phone ? ` · <a href="tel:${esc(p.guardian_phone)}">${esc(p.guardian_phone)}</a>` : ''}${p.guardian_email ? `<br>${esc(p.guardian_email)}` : ''}</p>` : ''}
      ${role.staff() ? `<p class="muted small">${guardians.length ? `✅ ${guardians.length} parent(s) relié(s) dans l'appli` : 'Aucun parent relié dans l’appli'}${p.user_id ? ' · Compte joueur relié' : ''}</p>` : ''}
      ${famBlock}
      ${p.notes && role.staff() ? `<h4>📝 Notes</h4><p class="pre">${esc(p.notes)}</p>` : ''}</div>
      <div><h4>🕒 Historique récent</h4>${att.filter((x) => x.activities).sort((a, b) => new Date(b.activities.starts_at) - new Date(a.activities.starts_at)).slice(0, 8).map((x) =>
        `<div class="hist"><span>${fmt.date(x.activities.starts_at)}</span><span class="grow">${esc(x.activities.kind === 'match' && x.activities.opponent ? 'vs ' + x.activities.opponent : x.activities.title)}</span>${badge(PRES[x.status][0], PRES[x.status][1])}</div>`).join('') || '<p class="muted">—</p>'}
      ${docs.length ? `<h4>📄 Documents</h4>${docs.map((d) => `<p>📎 ${esc(d.title)}</p>`).join('')}` : ''}</div></div>`,
  actions: role.staff() ? [
    ...(role.admin() ? [{ label: 'Archiver', cls: 'ghost danger-text', run: async () => {
      if (!(await confirmBox(`Archiver ${fullName(p)} ? Il disparaîtra des listes mais son historique est conservé.`, { ok: 'Archiver' }))) return false;
      await q(sb.from('players').update({ archived_at: new Date().toISOString(), team_id: null }).eq('id', p.id)); S.cache.players = null; toast('Joueur archivé'); after?.();
    } }] : []),
    { label: '🔗 Inviter parent/joueur', cls: 'ghost', run: () => { inviteDialog({ player_id: p.id, team_id: p.team_id, roles: ['parent', 'player'], label: fullName(p) }); return false; } },
    { label: '✏️ Modifier', cls: 'primary', run: () => { playerForm(p, after); return false; } },
  ] : [] });
}
