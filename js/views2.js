// ClubManager — événements, organisation, bénévoles, messages, documents, cotisations, stats, club, admin, page publique
import { sb, S, role, sport, SPORTS, KINDS, kindEmoji, esc, $, $$, fmt, toast, modal, closeModal, confirmBox, formHTML, readForm,
  errMsg, q, empty, avatar, badge, fullName, toLocalInput, fromLocalInput, upload, applyBrand, ROLE_LABEL, isPremium, downloadCSV, planLimit } from './core.js';
import { memberName, refreshClubData, setTitle, refreshCounters, loadMemberships, selectClub, installApp, isStandalone, joinWithCode } from './app.js';
import { groupInvite } from './views3.js';
import { groupList, deleteClubDialog, editMemberDialog, removeMember, platformUsers, deleteMyAccount, platformHome, platformBroadcast } from './views4.js';
import { actRow, activityForm, loadPlayers, myPlayerIds, inviteDialog, loadActivities } from './views.js';

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const teamName = (id) => S.teams.find((t) => t.id === id)?.name || '';

// ---------------------------------------------------------------- événements
const EV = { past: false };
export async function events(el) {
  const now = new Date();
  let list = await loadActivities(EV.past ? new Date(now.getTime() - 365 * 864e5) : startOfDay(now), EV.past ? now : null, (r) => r.in('kind', ['event', 'tournament', 'meeting']));
  if (EV.past) list.reverse();
  const regs = list.length ? await q(sb.from('registrations').select('activity_id, seats, status, user_id').in('activity_id', list.map((a) => a.id)).neq('status', 'cancelled')) : [];
  const IDEAS = ['🏀 Tournoi', '🎉 Fête du club', '🏆 Compétition', '🍽️ Repas', '🤝 Réunion', '🎟️ Vente de billets', '💰 Loto', '🎄 Arbre de Noël', '📸 Photos officielles'];
  el.innerHTML = `<div class="toolbar"><div class="seg"><button class="${!EV.past ? 'on' : ''}" data-p="0">À venir</button><button class="${EV.past ? 'on' : ''}" data-p="1">Passés</button></div>
    ${role.staff() ? '<button class="btn primary" id="newEv">＋ Événement</button>' : ''}</div>
    ${list.length ? `<div class="cards ev-cards">${list.map((a) => {
      const r = regs.filter((x) => x.activity_id === a.id && x.status === 'registered'); const seats = r.reduce((s, x) => s + x.seats, 0);
      const me = regs.some((x) => x.activity_id === a.id && x.user_id === S.user.id);
      return `<a class="ev-card" href="#/activite/${a.id}">${a.image_url ? `<img src="${esc(a.image_url)}" alt="" loading="lazy">` : `<div class="ev-emoji" style="--k:${KINDS[a.kind].color}">${kindEmoji(a)}</div>`}
        <div class="ev-body"><small>${fmt.day(a.starts_at)} · ${fmt.time(a.starts_at)}</small><b>${esc(a.title)}</b><small>${a.location ? '📍 ' + esc(a.location) : ''}</small>
        <div class="row gap wrap">${badge(KINDS[a.kind].label)}${a.price ? badge(fmt.money(a.price)) : ''}${a.capacity ? badge(`${seats}/${a.capacity} places`, seats >= a.capacity ? 'bad' : '') : seats ? badge(`${seats} inscrit(s)`) : ''}${me ? badge('Inscrit ✓', 'ok') : ''}</div></div></a>`;
    }).join('')}</div>` : empty('🎉', EV.past ? 'Aucun événement passé' : 'Aucun événement prévu', role.staff() ? 'Idées : ' + IDEAS.join(' · ') : '')}`;
  $$('[data-p]', el).forEach((b) => (b.onclick = () => { EV.past = b.dataset.p === '1'; events(el); }));
  $('#newEv', el) && ($('#newEv', el).onclick = () => activityForm({ kind: 'event' }, () => events(el)));
}

// ---------------------------------------------------------------- organisation (tâches)
const TS = { todo: ['🔴', 'À faire'], doing: ['🟡', 'En cours'], done: ['🟢', 'Terminé'] };
const PRIO = { high: ['Haute', 'bad'], normal: ['Normale', ''], low: ['Basse', 'ok'] };
const TK = { mine: false };
export async function tasks(el) {
  let list = await q(sb.from('tasks').select('*, activities(title)').eq('club_id', S.club.id).order('due_at', { nullsFirst: false }));
  if (TK.mine) list = list.filter((t) => t.assignee_id === S.user.id);
  const can = role.is('admin', 'coach', 'volunteer');
  const SUGG = ['Installer les tables', 'Préparer la salle', 'Acheter les boissons', 'Préparer les maillots', 'Accueillir les équipes', 'Tenir la buvette', 'Gérer la table de marque', 'Photographier le match'];
  el.innerHTML = `<div class="toolbar"><div class="seg"><button class="${!TK.mine ? 'on' : ''}" data-m="0">Toutes</button><button class="${TK.mine ? 'on' : ''}" data-m="1">Mes tâches</button></div>
    ${can ? '<button class="btn primary" id="newTask">＋ Tâche</button>' : ''}</div>
    <div class="kanban">${Object.entries(TS).map(([k, [e, l]]) => {
      const col = list.filter((t) => t.status === k);
      return `<section class="kcol" data-col="${k}"><h3>${e} ${l} <span class="muted">${col.length}</span></h3>${col.map((t) => `<article class="kcard" data-task="${t.id}" draggable="${can}">
        <b>${esc(t.title)}</b>${t.comment ? `<p>${esc(t.comment)}</p>` : ''}
        <div class="row gap wrap">${t.priority !== 'normal' ? badge(PRIO[t.priority][0], PRIO[t.priority][1]) : ''}${t.due_at ? badge('🕒 ' + fmt.dt(t.due_at), new Date(t.due_at) < new Date() && k !== 'done' ? 'bad' : '') : ''}
          ${t.activities ? badge('📌 ' + t.activities.title) : ''}</div>
        <small>👤 ${esc(t.assignee_name || memberName(t.assignee_id) || 'Personne')}</small>
        ${can || t.assignee_id === S.user.id ? `<div class="kmove">${k !== 'todo' ? `<button data-mv="${k === 'done' ? 'doing' : 'todo'}" aria-label="Reculer">‹</button>` : ''}${k !== 'done' ? `<button data-mv="${k === 'todo' ? 'doing' : 'done'}">${k === 'todo' ? 'Commencer ›' : 'Terminer ✓'}</button>` : ''}</div>` : ''}
      </article>`).join('') || '<p class="muted small">—</p>'}</section>`;
    }).join('')}</div>
    ${!list.length && can ? `<div class="card"><p class="muted">Idées de tâches : ${SUGG.map((s) => `<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join(' ')}</p></div>` : ''}`;
  $$('[data-m]', el).forEach((b) => (b.onclick = () => { TK.mine = b.dataset.m === '1'; tasks(el); }));
  $('#newTask', el) && ($('#newTask', el).onclick = () => taskForm({}, () => tasks(el)));
  $$('[data-sugg]', el).forEach((b) => (b.onclick = () => taskForm({ title: b.dataset.sugg }, () => tasks(el))));
  const move = async (id, status) => { try { await q(sb.from('tasks').update({ status }).eq('id', id)); tasks(el); } catch (e) { toast(errMsg(e), 'err'); } };
  $$('[data-mv]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); move(b.closest('[data-task]').dataset.task, b.dataset.mv); }));
  $$('[data-task]', el).forEach((c) => {
    c.onclick = () => can && taskForm(list.find((t) => t.id === c.dataset.task), () => tasks(el));
    c.ondragstart = (e) => e.dataTransfer.setData('text', c.dataset.task);
  });
  $$('[data-col]', el).forEach((col) => { col.ondragover = (e) => e.preventDefault(); col.ondrop = (e) => { e.preventDefault(); move(e.dataTransfer.getData('text'), col.dataset.col); }; });
}

export async function taskForm(t = {}, after) {
  const upcoming = await loadActivities(startOfDay(), null, (r) => r.in('kind', ['event', 'tournament', 'match', 'meeting']).limit(40));
  modal({ title: t.id ? 'Modifier la tâche' : 'Nouvelle tâche', body: formHTML([
    { name: 'title', label: 'Tâche', required: true, placeholder: 'Ex. : Tenir la buvette' },
    { name: 'assignee_id', label: 'Responsable', type: 'select', options: [['', '— Personne / autre —'], ...S.members.map((m) => [m.id, m.full_name])], col: 2 },
    { name: 'assignee_name', label: 'Ou nom libre', col: 2, placeholder: 'Ex. : Maman de Léo' },
    { name: 'due_at', label: 'Date et heure', type: 'datetime-local', value: toLocalInput(t.due_at), col: 2 },
    { name: 'priority', label: 'Priorité', type: 'select', options: [['normal', 'Normale'], ['high', 'Haute'], ['low', 'Basse']], col: 2 },
    { name: 'status', label: 'Statut', type: 'select', options: Object.entries(TS).map(([k, [e, l]]) => [k, `${e} ${l}`]), col: 2 },
    { name: 'activity_id', label: 'Lié à', type: 'select', options: [['', '— Rien —'], ...upcoming.map((a) => [a.id, `${fmt.day(a.starts_at)} · ${a.title}`])], col: 2 },
    { name: 'comment', label: 'Commentaire', type: 'textarea' },
  ], { ...t, due_at: undefined }), actions: [
    ...(t.id && role.staff() ? [{ label: 'Supprimer', cls: 'ghost danger-text', run: async () => {
      if (!(await confirmBox('Supprimer cette tâche ?', { ok: 'Supprimer' }))) return false;
      await q(sb.from('tasks').delete().eq('id', t.id)); after?.();
    } }] : []),
    { label: 'Annuler', cls: 'ghost' },
    { label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const row = { ...v, due_at: fromLocalInput(v.due_at), assignee_id: v.assignee_id || null, activity_id: v.activity_id || null };
      if (t.id) await q(sb.from('tasks').update(row).eq('id', t.id));
      else await q(sb.from('tasks').insert({ ...row, club_id: S.club.id, created_by: S.user.id }));
      toast('Tâche enregistrée'); after?.();
    } }] });
}

// ---------------------------------------------------------------- bénévoles
const MTYPES = ['Buvette', 'Arbitrage', 'Table de marque', 'Transport', 'Installation', 'Nettoyage', 'Accueil', 'Photographie', 'Organisation événementielle'];
const MEMO = { Buvette: '🥤', Arbitrage: '🧑‍⚖️', 'Table de marque': '⏱️', Transport: '🚗', Installation: '🪑', Nettoyage: '🧹', Accueil: '👋', Photographie: '📸', 'Organisation événementielle': '🎪' };
const VO = { mine: false };
export async function volunteers(el) {
  let list = await q(sb.from('missions').select('*, mission_signups(user_id, name), activities(title)').eq('club_id', S.club.id).gte('starts_at', startOfDay().toISOString()).order('starts_at'));
  if (VO.mine) list = list.filter((m) => m.mission_signups.some((s) => s.user_id === S.user.id));
  const days = [...new Set(list.map((m) => startOfDay(m.starts_at).getTime()))];
  el.innerHTML = `<div class="toolbar"><div class="seg"><button class="${!VO.mine ? 'on' : ''}" data-v="0">Toutes les missions</button><button class="${VO.mine ? 'on' : ''}" data-v="1">Mon planning</button></div>
    ${role.staff() ? '<button class="btn primary" id="newM">＋ Mission</button>' : ''}</div>
    ${days.length ? days.map((t) => `<h4 class="list-day">${fmt.dayLong(t)}</h4><div class="card">${list.filter((m) => startOfDay(m.starts_at).getTime() === t).map((m) => {
      const inn = m.mission_signups.some((s) => s.user_id === S.user.id); const full = m.mission_signups.length >= m.slots;
      return `<div class="mission"><span class="emoji-box">${MEMO[m.type] || '🙋'}</span><div class="grow"><b>${esc(m.title)}</b>
        <small>${fmt.time(m.starts_at)}${m.ends_at ? ' → ' + fmt.time(m.ends_at) : ''} · ${esc(m.type)}${m.activities ? ' · 📌 ' + esc(m.activities.title) : ''}</small>
        <div class="slots">${[...Array(m.slots)].map((_, i) => { const s = m.mission_signups[i]; return `<span class="slot ${s ? 'full' : ''}">${s ? esc(s.name || '✓') : 'Libre'}</span>`; }).join('')}</div></div>
        <div class="col-actions"><button class="btn sm ${inn ? 'ghost' : 'primary'}" data-sign="${m.id}" data-in="${inn ? 1 : ''}" ${!inn && full ? 'disabled' : ''}>${inn ? 'Me retirer' : full ? 'Complet' : 'Je m’inscris'}</button>
        ${role.staff() ? `<button class="link small" data-edit="${m.id}">Modifier</button>` : ''}</div></div>`;
    }).join('')}</div>`).join('') : empty('🙋', VO.mine ? 'Aucune mission prévue pour toi' : 'Aucune mission', role.staff() ? `Crée des missions : ${MTYPES.join(', ')}.` : 'Le club n’a pas encore publié de mission.')}`;
  $$('[data-v]', el).forEach((b) => (b.onclick = () => { VO.mine = b.dataset.v === '1'; volunteers(el); }));
  $('#newM', el) && ($('#newM', el).onclick = () => missionForm({}, () => volunteers(el)));
  $$('[data-edit]', el).forEach((b) => (b.onclick = () => missionForm(list.find((m) => m.id === b.dataset.edit), () => volunteers(el))));
  $$('[data-sign]', el).forEach((b) => (b.onclick = async () => {
    try {
      if (b.dataset.in) await q(sb.from('mission_signups').delete().eq('mission_id', b.dataset.sign).eq('user_id', S.user.id));
      else { await q(sb.from('mission_signups').insert({ mission_id: b.dataset.sign, user_id: S.user.id, club_id: S.club.id, name: S.profile.full_name })); toast('Merci pour ton aide ! 🙏'); }
      volunteers(el);
    } catch (e) { toast(errMsg(e), 'err'); }
  }));
}

export async function missionForm(m = {}, after) {
  const upcoming = await loadActivities(startOfDay(), null, (r) => r.limit(60));
  const start = m.starts_at || (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(14, 0, 0, 0); return d.toISOString(); })();
  modal({ title: m.id ? 'Modifier la mission' : 'Nouvelle mission', body: formHTML([
    { name: 'type', label: 'Type de mission', type: 'select', options: MTYPES, col: 2 },
    { name: 'slots', label: 'Nombre de bénévoles', type: 'number', min: 1, value: m.slots || 2, col: 2 },
    { name: 'title', label: 'Intitulé', placeholder: 'Ex. : Buvette match Seniors' },
    { name: 'starts_at', label: 'Début', type: 'datetime-local', required: true, value: toLocalInput(start), col: 2 },
    { name: 'ends_at', label: 'Fin', type: 'datetime-local', value: toLocalInput(m.ends_at), col: 2 },
    { name: 'activity_id', label: 'Lié à', type: 'select', options: [['', '— Rien —'], ...upcoming.map((a) => [a.id, `${fmt.day(a.starts_at)} · ${a.title}`])] },
  ], { ...m, starts_at: undefined, ends_at: undefined }), actions: [
    ...(m.id ? [{ label: 'Supprimer', cls: 'ghost danger-text', run: async () => {
      if (!(await confirmBox('Supprimer cette mission et ses inscriptions ?', { ok: 'Supprimer' }))) return false;
      await q(sb.from('missions').delete().eq('id', m.id)); after?.();
    } }] : []),
    { label: 'Annuler', cls: 'ghost' },
    { label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const row = { type: v.type, slots: Math.max(1, v.slots || 1), title: v.title || v.type, starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at), activity_id: v.activity_id || null };
      if (m.id) await q(sb.from('missions').update(row).eq('id', m.id));
      else await q(sb.from('missions').insert({ ...row, club_id: S.club.id }));
      toast('Mission enregistrée'); after?.();
    } }] });
}

// ---------------------------------------------------------------- messages
const MS = { box: 'all', tab: 'groups' };
export async function messages(el) {
  const top = `<div class="seg big-seg"><button class="${MS.tab === 'groups' ? 'on' : ''}" data-mt="groups">💬 Groupes</button><button class="${MS.tab === 'mail' ? 'on' : ''}" data-mt="mail">✉️ Messages & annonces</button></div>`;
  const bindTop = () => $$('[data-mt]', el).forEach((b) => (b.onclick = () => { MS.tab = b.dataset.mt; messages(el); }));
  if (MS.tab === 'groups') {
    el.innerHTML = top + '<div id="grpZone"></div>'; bindTop();
    return groupList($('#grpZone', el));
  }
  const [list, reads] = await Promise.all([
    q(sb.from('messages').select('*').eq('club_id', S.club.id).neq('audience', 'group').order('created_at', { ascending: false }).limit(150)),
    q(sb.from('message_reads').select('message_id').eq('user_id', S.user.id)),
  ]);
  const readSet = new Set(reads.map((r) => r.message_id));
  const f = list.filter((m) => MS.box === 'all' || (MS.box === 'ann' && m.is_announcement) || (MS.box === 'in' && m.sender_id !== S.user.id) || (MS.box === 'out' && m.sender_id === S.user.id));
  const AUD = { all: '🏟️ Tout le club', team: '🏷️ Équipe', parents: '👨‍👩‍👧 Parents', coaches: '🧑‍🏫 Entraîneurs', user: '👤 Personnel' };
  el.innerHTML = top + `<div class="toolbar"><div class="seg">${[['all', 'Tous'], ['ann', '📣 Annonces'], ['in', 'Reçus'], ['out', 'Envoyés']].map(([k, l]) => `<button class="${MS.box === k ? 'on' : ''}" data-b="${k}">${l}</button>`).join('')}</div>
    <div class="row gap">${'Notification' in window && Notification.permission === 'default' ? '<button class="btn ghost sm" id="notifOn">🔔 Activer les notifications</button>' : ''}<button class="btn primary" id="newMsg">✉️ Nouveau message</button></div></div>
    ${f.length ? `<div class="card msgs">${f.map((m) => { const unread = m.sender_id !== S.user.id && !readSet.has(m.id); return `<article class="msg ${m.is_announcement ? 'ann' : ''} ${unread ? 'unread' : ''}">
      ${avatar(m.sender_name)}<div class="grow"><div class="msg-head"><b>${esc(m.sender_name || 'Membre')}</b><small>${fmt.rel(m.created_at)}</small></div>
      <small class="muted">${m.is_announcement ? '📣 Annonce · ' : ''}${AUD[m.audience]}${m.audience === 'team' ? ' ' + esc(teamName(m.team_id)) : ''}${m.audience === 'user' ? (m.sender_id === S.user.id ? ' → ' + esc(memberName(m.recipient_id)) : '') : ''}</small>
      ${m.subject ? `<h4>${esc(m.subject)}</h4>` : ''}<p class="pre">${esc(m.body)}</p>
      ${m.sender_id && m.sender_id !== S.user.id ? `<button class="link small" data-reply="${m.sender_id}" data-subj="${esc(m.subject || '')}">↩︎ Répondre</button>` : ''}
      ${m.sender_id === S.user.id || role.admin() ? `<button class="link small danger-text" data-delmsg="${m.id}">Supprimer</button>` : ''}</div></article>`; }).join('')}</div>`
      : empty('💬', 'Aucun message', 'Envoie un message à une équipe, aux parents ou à tout le club.')}`;
  // marquer comme lus
  const toMark = f.filter((m) => m.sender_id !== S.user.id && !readSet.has(m.id)).map((m) => ({ message_id: m.id, user_id: S.user.id }));
  if (toMark.length) sb.from('message_reads').upsert(toMark, { ignoreDuplicates: true }).then(refreshCounters);
  bindTop();
  $$('[data-b]', el).forEach((b) => (b.onclick = () => { MS.box = b.dataset.b; messages(el); }));
  $('#newMsg', el).onclick = () => compose({}, () => messages(el));
  $('#notifOn', el) && ($('#notifOn', el).onclick = async () => { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notifications activées 🔔' : 'Notifications refusées', p === 'granted' ? 'ok' : 'err'); messages(el); });
  $$('[data-reply]', el).forEach((b) => (b.onclick = () => compose({ audience: 'user', recipient_id: b.dataset.reply, subject: b.dataset.subj ? 'Re : ' + b.dataset.subj.replace(/^Re : /, '') : '' }, () => messages(el))));
  $$('[data-delmsg]', el).forEach((b) => (b.onclick = async () => { if (await confirmBox('Supprimer ce message ?', { ok: 'Supprimer' })) { await q(sb.from('messages').delete().eq('id', b.dataset.delmsg)); messages(el); } }));
}

function compose(pre = {}, after) {
  const staff = role.staff();
  const auds = staff ? [['all', '🏟️ Tout le club'], ['team', '🏷️ Une équipe'], ['parents', '👨‍👩‍👧 Les parents'], ['coaches', '🧑‍🏫 Les entraîneurs'], ['user', '👤 Une personne']]
    : [['user', '👤 Une personne'], ['coaches', "🧑‍🏫 L'encadrement"]];
  const people = S.members.filter((m) => m.id !== S.user.id && (staff || m.roles.some((r) => ['admin', 'coach'].includes(r)) || m.id === pre.recipient_id));
  const w = modal({ title: 'Nouveau message', wide: true, body: formHTML([
    { name: 'audience', label: 'Destinataires', type: 'select', options: auds, value: pre.audience || auds[0][0], col: 2 },
    { name: 'team_id', label: 'Équipe', type: 'select', options: S.teams.map((t) => [t.id, t.name]), col: 2 },
    { name: 'recipient_id', label: 'Personne', type: 'select', options: people.map((m) => [m.id, `${m.full_name} (${m.roles.map((r) => ROLE_LABEL[r]).join(', ')})`]), value: pre.recipient_id, col: 2 },
    { name: 'subject', label: 'Objet', value: pre.subject },
    { name: 'body', label: 'Message', type: 'textarea', rows: 6, required: true },
    ...(staff ? [{ name: 'is_announcement', label: '📣 Annonce importante (notifie tous les membres et s’affiche sur la page publique si « tout le club »)', type: 'checkbox' }] : []),
  ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer', cls: 'primary', run: async (w) => {
    const v = readForm(w);
    if (v.audience === 'user' && !v.recipient_id) throw new Error('Choisis un destinataire');
    await q(sb.from('messages').insert({ club_id: S.club.id, sender_id: S.user.id, sender_name: S.profile.full_name, audience: v.audience,
      team_id: v.audience === 'team' ? v.team_id : null, recipient_id: v.audience === 'user' ? v.recipient_id : null,
      subject: v.subject, body: v.body, is_announcement: !!v.is_announcement }));
    toast('Message envoyé ✉️'); after?.();
  } }] });
  const sync = () => { const a = $('[name=audience]', w).value; $('[name=team_id]', w).closest('.field').hidden = a !== 'team'; $('[name=recipient_id]', w).closest('.field').hidden = a !== 'user'; };
  $('[name=audience]', w).onchange = sync; sync();
}

export async function notificationsPanel() {
  const list = await q(sb.from('notifications').select('*').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(40));
  modal({ title: 'Notifications', body: list.length ? `<div class="list">${list.map((n) => `<a class="list-row ${n.read ? '' : 'unread'}" href="${esc(n.link || '#/')}" data-n="${n.id}">
      <span class="grow"><b>${esc(n.title)}</b><small>${esc(n.body || '')} · ${fmt.rel(n.created_at)}</small></span></a>`).join('')}</div>` : empty('🔔', 'Aucune notification'),
  actions: list.some((n) => !n.read) ? [{ label: 'Tout marquer comme lu', cls: 'ghost', run: async () => { await q(sb.from('notifications').update({ read: true }).eq('user_id', S.user.id).eq('read', false)); refreshCounters(); } }] : [],
  onOpen: (w) => $$('[data-n]', w).forEach((a) => a.addEventListener('click', async () => { closeModal(); await sb.from('notifications').update({ read: true }).eq('id', a.dataset.n); refreshCounters(); })) });
}

// ---------------------------------------------------------------- documents
const DCATS = { licences: '🪪 Licences', certificats: '🩺 Certificats', autorisations: '✍️ Autorisations parentales', reglements: '📜 Règlements', convocations: '📨 Convocations', administratif: '🗂️ Administratif', club: '🏟️ Documents du club' };
const VIS = { all: 'Tout le club', team: "L'équipe", private: 'Le joueur et ses parents', staff: 'Encadrement seulement' };
const DO = { cat: '' };
export async function documents(el) {
  const list = await q(sb.from('documents').select('*').eq('club_id', S.club.id).order('created_at', { ascending: false }));
  const f = list.filter((d) => !DO.cat || d.category === DO.cat);
  el.innerHTML = `<div class="toolbar"><p class="muted">${list.length} document(s)</p>${role.staff() ? '<button class="btn primary" id="up">⬆︎ Ajouter un document</button>' : ''}</div>
    <div class="filters"><button class="chip ${!DO.cat ? 'on' : ''}" data-c="">Tous</button>${Object.entries(DCATS).map(([k, l]) => `<button class="chip ${DO.cat === k ? 'on' : ''}" data-c="${k}">${l}</button>`).join('')}</div>
    ${f.length ? `<div class="card">${f.map((d) => `<div class="doc"><span class="emoji-box">${(DCATS[d.category] || '📄').split(' ')[0]}</span>
      <div class="grow"><b>${esc(d.title)}</b><small>${esc(d.file_name || '')}${d.size_bytes ? ' · ' + Math.ceil(d.size_bytes / 1024) + ' Ko' : ''} · ${fmt.date(d.created_at)} · 👁 ${VIS[d.visibility]}${d.team_id ? ' · ' + esc(teamName(d.team_id)) : ''}</small></div>
      <button class="btn sm ghost" data-dl="${d.id}">Ouvrir</button>${role.admin() ? `<button class="icon-btn" data-deld="${d.id}" aria-label="Supprimer">🗑</button>` : ''}</div>`).join('')}</div>`
      : empty('📁', 'Aucun document', role.staff() ? 'Ajoute licences, certificats médicaux, autorisations, règlements…' : '')}`;
  $$('[data-c]', el).forEach((b) => (b.onclick = () => { DO.cat = b.dataset.c; documents(el); }));
  $$('[data-dl]', el).forEach((b) => (b.onclick = async () => {
    const d = list.find((x) => x.id === b.dataset.dl);
    const win = window.open('', '_blank');
    try { const { data, error } = await sb.storage.from('club-files').createSignedUrl(d.file_path, 300); if (error) throw error; win ? (win.location = data.signedUrl) : (location.href = data.signedUrl); }
    catch (e) { win?.close(); toast(errMsg(e), 'err'); }
  }));
  $$('[data-deld]', el).forEach((b) => (b.onclick = async () => {
    const d = list.find((x) => x.id === b.dataset.deld);
    if (!(await confirmBox(`Supprimer définitivement « ${d.title} » ?`, { ok: 'Supprimer' }))) return;
    await sb.storage.from('club-files').remove([d.file_path]);
    await q(sb.from('documents').delete().eq('id', d.id)); toast('Document supprimé'); documents(el);
  }));
  $('#up', el) && ($('#up', el).onclick = async () => {
    const players = await loadPlayers();
    const w = modal({ title: 'Ajouter un document', body: `<label class="drop"><input type="file" id="file" required><span>📎 Choisir un fichier (PDF, image… 10 Mo max)</span></label>` + formHTML([
      { name: 'title', label: 'Titre', required: true },
      { name: 'category', label: 'Catégorie', type: 'select', options: Object.entries(DCATS), value: DO.cat || 'club', col: 2 },
      { name: 'visibility', label: 'Visible par', type: 'select', options: Object.entries(VIS), col: 2 },
      { name: 'team_id', label: 'Équipe', type: 'select', options: [['', '—'], ...S.teams.map((t) => [t.id, t.name])], col: 2 },
      { name: 'player_id', label: 'Joueur concerné', type: 'select', options: [['', '—'], ...players.map((p) => [p.id, fullName(p)])], col: 2 },
    ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer', cls: 'primary', run: async (w) => {
      const file = $('#file', w).files[0]; if (!file) throw new Error('Choisis un fichier');
      const v = readForm(w);
      if (v.visibility === 'team' && !v.team_id) throw new Error('Choisis l’équipe');
      if (v.visibility === 'private' && !v.player_id) throw new Error('Choisis le joueur');
      const path = await upload(file, 'club-files', 'docs');
      await q(sb.from('documents').insert({ ...v, team_id: v.team_id || null, player_id: v.player_id || null, club_id: S.club.id, file_path: path, file_name: file.name, size_bytes: file.size, uploaded_by: S.user.id }));
      toast('Document ajouté 📄'); documents(el);
    } }] });
    $('#file', w).onchange = (e) => { const f = e.target.files[0]; if (f) { $('.drop span', w).textContent = '📎 ' + f.name; const t = $('[name=title]', w); if (!t.value) t.value = f.name.replace(/\.[^.]+$/, ''); } };
  });
}

// ---------------------------------------------------------------- cotisations
const DU = { filter: '' };
const dueStatus = (d) => !d ? ['Non définie', ''] : d.paid >= d.amount ? ['Payé', 'ok'] : d.paid > 0 ? ['Partiel', 'warn'] : ['Impayé', 'bad'];
export async function dues(el) {
  if (!role.admin()) return familyDues(el);
  const [players, list] = await Promise.all([loadPlayers(true), q(sb.from('dues').select('*').eq('club_id', S.club.id).eq('season_id', S.season?.id))]);
  const rows = players.map((p) => ({ p, d: list.find((d) => d.player_id === p.id) }));
  const f = rows.filter(({ d }) => !DU.filter || dueStatus(d)[1] === DU.filter || (DU.filter === 'none' && !d));
  const total = list.reduce((s, d) => s + +d.amount, 0), paid = list.reduce((s, d) => s + Math.min(+d.paid, +d.amount), 0);
  el.innerHTML = `<div class="kpis"><div class="kpi"><b>${fmt.money(total)}</b><small>Total attendu</small></div><div class="kpi"><b>${fmt.money(paid)}</b><small>Encaissé</small></div>
      <div class="kpi"><b>${fmt.money(total - paid)}</b><small>Reste à encaisser</small></div><div class="kpi"><b>${total ? Math.round((paid / total) * 100) : 0}%</b><small>Taux de paiement</small></div></div>
    <div class="toolbar"><div class="filters">${[['', 'Tous'], ['ok', '🟢 Payé'], ['warn', '🟠 Partiel'], ['bad', '🔴 Impayé'], ['none', 'Non définie']].map(([k, l]) => `<button class="chip ${DU.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div class="row gap wrap"><button class="btn ghost" id="csv">⬇︎ Export</button><button class="btn primary" id="bulkD">Définir les cotisations</button></div></div>
    <div class="notice small">💳 Paiement en ligne : la structure est prête. Il suffira de brancher un compte Stripe pour que les familles paient directement dans l'appli.</div>
    <div class="card table-card"><div class="table-wrap"><table class="table click"><thead><tr><th>Joueur</th><th class="hide-sm">Équipe</th><th>Montant</th><th class="hide-sm">Payé</th><th>Reste</th><th class="hide-sm">Dernier paiement</th><th>Statut</th></tr></thead>
    <tbody>${f.map(({ p, d }) => { const [l, t] = dueStatus(d); return `<tr data-due="${p.id}"><td><b>${esc(fullName(p))}</b></td><td class="hide-sm">${esc(teamName(p.team_id))}</td>
      <td>${d ? fmt.money(d.amount) : '—'}</td><td class="hide-sm">${d ? fmt.money(d.paid) : '—'}</td><td>${d ? fmt.money(Math.max(0, d.amount - d.paid)) : '—'}</td><td class="hide-sm">${d?.last_payment_at ? fmt.date(d.last_payment_at) : '—'}</td><td>${badge(l, t)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  $$('[data-f]', el).forEach((b) => (b.onclick = () => { DU.filter = b.dataset.f; dues(el); }));
  $('#csv', el).onclick = () => downloadCSV(`cotisations-${S.club.slug}.csv`, [['Nom', 'Prénom', 'Équipe', 'Montant', 'Payé', 'Reste', 'Statut', 'Dernier paiement'],
    ...rows.map(({ p, d }) => [p.last_name, p.first_name, teamName(p.team_id), d?.amount ?? '', d?.paid ?? '', d ? d.amount - d.paid : '', dueStatus(d)[0], d?.last_payment_at || ''])]);
  $('#bulkD', el).onclick = () => modal({ title: 'Définir les cotisations', body: formHTML([
    { name: 'team_id', label: 'Pour', type: 'select', options: [['', 'Tous les joueurs'], ...S.teams.map((t) => [t.id, t.name])] },
    { name: 'amount', label: 'Montant (€)', type: 'number', min: 0, step: '0.5', required: true },
    { name: 'overwrite', label: 'Remplacer aussi les montants déjà définis', type: 'checkbox' },
  ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Appliquer', cls: 'primary', run: async (w) => {
    const v = readForm(w);
    const target = rows.filter(({ p, d }) => (!v.team_id || p.team_id === v.team_id) && (v.overwrite || !d));
    if (!target.length) throw new Error('Aucun joueur concerné');
    await q(sb.from('dues').upsert(target.map(({ p, d }) => ({ ...(d ? { id: d.id, paid: d.paid } : {}), club_id: S.club.id, season_id: S.season.id, player_id: p.id, amount: v.amount })), { onConflict: 'season_id,player_id' }));
    toast(`Cotisation définie pour ${target.length} joueur(s)`); dues(el);
  } }] });
  $$('[data-due]', el).forEach((r) => (r.onclick = () => {
    const { p, d } = rows.find((x) => x.p.id === r.dataset.due);
    modal({ title: `Cotisation — ${fullName(p)}`, body: formHTML([
      { name: 'amount', label: 'Montant de la cotisation (€)', type: 'number', min: 0, step: '0.5', value: d?.amount ?? '', required: true, col: 2 },
      { name: 'add', label: 'Nouveau paiement reçu (€)', type: 'number', min: 0, step: '0.5', col: 2, hint: d ? `Déjà payé : ${fmt.money(d.paid)}` : '' },
      { name: 'last_payment_at', label: 'Date du paiement', type: 'date', value: new Date().toISOString().slice(0, 10), col: 2 },
      { name: 'method', label: 'Moyen', type: 'select', options: ['', 'Espèces', 'Chèque', 'Virement', 'CB', 'Pass’Sport', 'Chèques-vacances', 'Autre'], value: d?.method, col: 2 },
      { name: 'note', label: 'Note', value: d?.note },
    ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const paid = (+d?.paid || 0) + (+v.add || 0);
      await q(sb.from('dues').upsert({ ...(d ? { id: d.id } : {}), club_id: S.club.id, season_id: S.season.id, player_id: p.id, amount: v.amount, paid,
        last_payment_at: v.add ? v.last_payment_at : d?.last_payment_at || null, method: v.method, note: v.note }, { onConflict: 'season_id,player_id' }));
      toast('Cotisation mise à jour 💶'); dues(el);
    } }] });
  }));
}
async function familyDues(el) {
  const mine = await myPlayerIds();
  const [players, list] = mine.length ? await Promise.all([q(sb.from('players').select('*').in('id', mine)), q(sb.from('dues').select('*, seasons(name)').in('player_id', mine))]) : [[], []];
  el.innerHTML = list.length ? `<div class="cards">${list.map((d) => { const p = players.find((x) => x.id === d.player_id); const [l, t] = dueStatus(d); return `<div class="card">
    <div class="card-head"><h3>${esc(fullName(p))}</h3>${badge(l, t)}</div><p class="muted">${esc(d.seasons?.name || '')}</p>
    <div class="kpis small"><div class="kpi"><b>${fmt.money(d.amount)}</b><small>Cotisation</small></div><div class="kpi"><b>${fmt.money(d.paid)}</b><small>Payé</small></div><div class="kpi"><b>${fmt.money(Math.max(0, d.amount - d.paid))}</b><small>Reste</small></div></div>
    ${d.last_payment_at ? `<p class="muted small">Dernier paiement le ${fmt.date(d.last_payment_at)}${d.method ? ' · ' + esc(d.method) : ''}</p>` : ''}</div>`; }).join('')}</div>`
    : empty('💶', 'Aucune cotisation', 'Le club n’a pas encore défini de cotisation pour toi ou tes enfants.');
}

// ---------------------------------------------------------------- statistiques
function bars(data, { color = 'var(--brand)', suffix = '' } = {}) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return `<div class="bars">${data.map(([l, v, c]) => `<div class="bar-row"><span class="bar-l">${esc(l)}</span><span class="bar-t"><i style="width:${(v / max) * 100}%;background:${c || color}"></i></span><b>${v}${suffix}</b></div>`).join('') || '<p class="muted">Pas encore de données.</p>'}</div>`;
}
function line(points) {
  if (points.length < 2) return '<p class="muted">Pas encore assez de données.</p>';
  const W = 600, H = 160, max = Math.max(...points.map((p) => p[1]), 1);
  const xy = points.map((p, i) => [20 + (i * (W - 40)) / (points.length - 1), H - 25 - (p[1] / max) * (H - 45)]);
  return `<svg viewBox="0 0 ${W} ${H}" class="line-chart" role="img" aria-label="Évolution des inscriptions"><polyline fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" points="${xy.map((p) => p.join(',')).join(' ')}"/>
    <polygon fill="var(--brand)" opacity=".12" points="${xy.map((p) => p.join(',')).join(' ')} ${xy[xy.length - 1][0]},${H - 25} ${xy[0][0]},${H - 25}"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--brand)"/><text x="${p[0]}" y="${H - 6}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6">${esc(points[i][0])}</text><text x="${p[0]}" y="${p[1] - 9}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${points[i][1]}</text>`).join('')}</svg>`;
}
export async function stats(el) {
  const now = new Date();
  const [players, acts, att, dues, evs] = await Promise.all([
    loadPlayers(true),
    q(sb.from('activities').select('id, kind, team_id, starts_at, score_for, score_against, stats').eq('club_id', S.club.id)),
    q(sb.from('attendance').select('player_id, status, activity_id').eq('club_id', S.club.id).neq('status', 'pending')),
    role.admin() ? q(sb.from('dues').select('amount, paid').eq('club_id', S.club.id).eq('season_id', S.season?.id)) : [],
    q(sb.from('registrations').select('id').eq('club_id', S.club.id)),
  ]);
  const actTeam = Object.fromEntries(acts.map((a) => [a.id, a.team_id]));
  const pres = att.length ? Math.round((att.filter((x) => x.status === 'present').length / att.length) * 100) : 0;
  const matches = acts.filter((a) => a.kind === 'match' && a.score_for != null);
  // évolution des inscriptions (cumul par mois sur 6 mois)
  const months = [...Array(6)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return d; });
  const evo = months.map((m) => [m.toLocaleDateString('fr-FR', { month: 'short' }), players.filter((p) => new Date(p.created_at) < new Date(m.getFullYear(), m.getMonth() + 1, 1)).length]);
  const st = sport().stats;
  const totals = {};
  matches.forEach((a) => Object.entries(a.stats || {}).forEach(([pid, s]) => { totals[pid] = totals[pid] || { gp: 0 }; totals[pid].gp++; Object.entries(s).forEach(([k, v]) => (totals[pid][k] = (totals[pid][k] || 0) + v)); }));
  const leaders = Object.entries(totals).map(([pid, t]) => ({ p: players.find((x) => x.id === pid), ...t })).filter((x) => x.p);
  const TS_ = (team) => { const m = matches.filter((a) => a.team_id === team); return [m.filter((a) => a.score_for > a.score_against).length, m.filter((a) => a.score_for < a.score_against).length, m.filter((a) => a.score_for === a.score_against).length]; };
  const total = dues.reduce((s, d) => s + +d.amount, 0), paid = dues.reduce((s, d) => s + Math.min(+d.paid, +d.amount), 0);

  el.innerHTML = `<div class="kpis"><div class="kpi"><b>${players.length}</b><small>Licenciés</small></div><div class="kpi"><b>${S.teams.length}</b><small>Équipes</small></div>
      <div class="kpi"><b>${pres}%</b><small>Présence moyenne</small></div><div class="kpi"><b>${matches.length}</b><small>Matchs joués</small></div>
      ${role.admin() ? `<div class="kpi"><b>${total ? Math.round((paid / total) * 100) : 0}%</b><small>Cotisations payées</small></div>` : ''}
      <div class="kpi"><b>${acts.filter((a) => ['event', 'tournament'].includes(a.kind)).length}</b><small>Événements · ${evs.length} inscrits</small></div></div>
    <div class="grid2">
      <section class="card"><h3>📈 Évolution des inscriptions</h3>${line(evo)}</section>
      <section class="card"><h3>👥 Joueurs par équipe</h3>${bars(S.teams.map((t) => [t.name, players.filter((p) => p.team_id === t.id).length, t.color]))}</section>
      <section class="card"><h3>🙋 Présence aux entraînements par équipe</h3>${bars(S.teams.map((t) => { const a = att.filter((x) => actTeam[x.activity_id] === t.id); return [t.name, a.length ? Math.round((a.filter((x) => x.status === 'present').length / a.length) * 100) : 0, t.color]; }), { suffix: '%' })}</section>
      <section class="card"><h3>🏁 Résultats par équipe</h3>${S.teams.length ? `<table class="table"><thead><tr><th>Équipe</th><th>V</th><th>D</th><th>N</th></tr></thead><tbody>${S.teams.map((t) => { const [w, l, d] = TS_(t.id); return `<tr><td>${esc(t.name)}</td><td class="ok-text">${w}</td><td class="bad-text">${l}</td><td>${d}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">—</p>'}</section>
    </div>
    <section class="card"><div class="card-head"><h3>${sport().emoji} Meilleurs joueurs (statistiques de match)</h3>${isPremium() ? '<button class="btn sm ghost" id="exp">⬇︎ Rapport CSV</button>' : badge('Rapports : offre Premium')}</div>
      ${leaders.length ? `<div class="leaders">${st.slice(0, 4).map(([k, l]) => { const top = leaders.filter((x) => x[k]).sort((a, b) => b[k] / b.gp - a[k] / a.gp).slice(0, 5);
        return `<div><h4>${l} / match</h4>${top.map((x, i) => `<p><span class="rank">${i + 1}</span>${esc(fullName(x.p))} <b>${(x[k] / x.gp).toFixed(1)}</b></p>`).join('') || '<p class="muted small">—</p>'}</div>`; }).join('')}</div>`
        : '<p class="muted">Saisis les statistiques après un match (page du match → Résultat) pour voir le classement.</p>'}</section>`;
  $('#exp', el) && ($('#exp', el).onclick = () => downloadCSV(`stats-${S.club.slug}.csv`, [['Joueur', 'Équipe', 'Matchs', ...st.map(([, l]) => l)], ...leaders.map((x) => [fullName(x.p), teamName(x.p.team_id), x.gp, ...st.map(([k]) => x[k] || 0)])]));
}

// ---------------------------------------------------------------- mon club
const CT = { tab: 'infos' };
export async function clubSettings(el) {
  if (!role.admin()) { location.hash = '#/'; return; }
  const c = S.club;
  const tabs = [['infos', 'Infos'], ['membres', 'Membres'], ['saisons', 'Saisons'], ['demandes', 'Demandes'], ['offre', 'Offre'], ['journal', 'Journal']];
  const publicUrl = `${location.origin}${location.pathname}#/club/${c.slug}`;
  let body = '';
  if (CT.tab === 'infos') {
    body = `<div class="card"><div class="photo-row">${c.logo_url ? `<img class="club-logo" src="${esc(c.logo_url)}" alt="">` : '<img class="club-logo" src="icons/logo.svg" alt="">'}
      <label class="btn ghost sm">🖼 Changer le logo<input type="file" accept="image/*" id="logo" hidden></label>${c.logo_url ? '<button class="link small" id="rmLogo">Retirer</button>' : ''}</div>
      ${formHTML([
        { name: 'name', label: 'Nom du club', required: true },
        { name: 'sport', label: 'Sport', type: 'select', options: Object.entries(SPORTS).map(([k, s]) => [k, `${s.emoji} ${s.label}`]), col: 2 },
        { name: 'city', label: 'Ville', col: 2 }, { name: 'address', label: 'Adresse' },
        { name: 'email', label: 'Email', type: 'email', col: 2 }, { name: 'phone', label: 'Téléphone', type: 'tel', col: 2 },
        { name: 'website', label: 'Site internet', type: 'url', col: 2 },
        { name: 'instagram', label: 'Instagram', col: 2, placeholder: '@monclub' }, { name: 'facebook', label: 'Facebook', col: 2 }, { name: 'tiktok', label: 'TikTok', col: 2 },
        { name: 'description', label: 'Présentation du club', type: 'textarea', rows: 4 },
        { name: 'color_primary', label: 'Couleur principale', type: 'color', col: 2 }, { name: 'color_secondary', label: 'Couleur secondaire', type: 'color', col: 2 },
        { name: 'is_public', label: 'Page publique visible par tous', type: 'checkbox' },
      ], { ...c, ...(c.socials || {}) })}
      <div class="invite-box"><small>Page publique</small><input readonly value="${esc(publicUrl)}" aria-label="Lien de la page publique"><div class="row gap"><button class="btn sm ghost" id="cpPub">📋 Copier</button><a class="btn sm ghost" href="#/club/${c.slug}" target="_blank">Voir la page</a></div></div>
      <div class="row end mt"><button class="btn primary" id="saveClub">Enregistrer</button></div></div>
      ${role.admin() ? `<div class="card danger-zone"><h3>⚠️ Zone dangereuse</h3><p class="muted">Supprimer le club efface toutes ses données. Réservé aux administrateurs.</p><button class="btn danger" id="delMyClub">Supprimer ce club</button></div>` : ''}`;
  } else if (CT.tab === 'membres') {
    body = `<div class="toolbar"><p class="muted">${S.members.length} membre(s) avec un compte</p><div class="row gap wrap"><button class="btn wa" id="waM">WhatsApp</button><button class="btn primary" id="invM">🔗 Inviter</button></div></div>
      <div class="card">${S.members.map((m) => `<div class="member">${avatar(m.full_name)}<div class="grow"><b>${esc(m.full_name)}</b><small>${esc(m.email || '')}</small>
        <div class="chips">${['admin', 'coach', 'player', 'parent', 'volunteer'].map((r) => `<button class="chip sm ${m.roles.includes(r) ? 'on' : ''}" data-tog="${r}" data-u="${m.id}">${ROLE_LABEL[r]}</button>`).join('')}</div></div>
        <div class="acct-actions"><button class="btn sm ghost" data-medit="${m.id}">✏️</button>${m.id !== S.user.id ? `<button class="btn sm ghost danger-text" data-kick="${m.id}" aria-label="Retirer du club">Retirer</button>` : ''}</div></div>`).join('')}</div>
      <div id="invList"></div>`;
  } else if (CT.tab === 'saisons') {
    body = `<div class="toolbar"><p class="muted">Les saisons archivées gardent tout l'historique.</p><button class="btn primary" id="newSeason">＋ Nouvelle saison</button></div>
      <div class="card">${S.seasons.map((s) => `<div class="member"><span class="emoji-box">${s.status === 'active' ? '🟢' : '🗄️'}</span><div class="grow"><b>${esc(s.name)}</b><small>${fmt.date(s.start_date)} → ${fmt.date(s.end_date)} · ${s.status === 'active' ? 'Active' : 'Archivée'}</small></div>
        <div class="row gap wrap">${s.status === 'active' ? `<button class="btn sm ghost" data-dupl="${s.id}">⧉ Passer à la saison suivante</button><button class="btn sm ghost" data-arch="${s.id}">Archiver</button>` : `<button class="btn sm ghost" data-react="${s.id}">Réactiver</button>`}</div></div>`).join('')}</div>`;
  } else if (CT.tab === 'demandes') {
    const jr = await q(sb.from('join_requests').select('*').eq('club_id', c.id).order('created_at', { ascending: false }));
    body = jr.length ? `<div class="card">${jr.map((r) => `<div class="member"><span class="emoji-box">${{ join: '🙋', signup: '📝', contact: '✉️' }[r.kind] || '✉️'}</span><div class="grow"><b>${esc(r.name)}</b>
      <small>${{ join: 'Veut rejoindre le club', signup: 'Inscription', contact: 'Message' }[r.kind]} · ${fmt.rel(r.created_at)}${r.status === 'done' ? ' · ✅ traité' : ''}</small>
      ${r.message ? `<p class="pre">${esc(r.message)}</p>` : ''}<small>${r.email ? `✉️ <a href="mailto:${esc(r.email)}">${esc(r.email)}</a> ` : ''}${r.phone ? `📞 <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''}</small></div>
      ${r.status !== 'done' ? `<button class="btn sm ghost" data-done="${r.id}">Traité ✓</button>` : `<button class="icon-btn" data-deljr="${r.id}" aria-label="Supprimer">🗑</button>`}</div>`).join('')}</div>`
      : empty('📬', 'Aucune demande', 'Les demandes envoyées depuis la page publique du club arrivent ici.');
  } else if (CT.tab === 'offre') {
    const P = S.plans || {};
    const cur = c.plan;
    const feat = { gratuit: ['Équipes, joueurs, calendrier', 'Convocations et présences', 'Messages et annonces', `Jusqu'à ${P.gratuit?.teams ?? 3} équipes / ${P.gratuit?.players ?? 40} joueurs`],
      standard: ['Tout le Gratuit', 'Gestion complète du club', 'Documents, cotisations, bénévoles', `Jusqu'à ${P.standard?.teams ?? 30} équipes / ${P.standard?.players ?? 600} joueurs`],
      premium: ['Tout le Standard', 'Statistiques avancées et rapports', 'Paiements en ligne (bientôt)', 'Personnalisation et automatisations', 'Équipes et joueurs illimités'] };
    body = `<div class="plans">${['gratuit', 'standard', 'premium'].map((p) => `<div class="card plan ${p === cur ? 'current' : ''}"><h3>${{ gratuit: 'Gratuit', standard: 'Standard', premium: 'Premium' }[p]}</h3>
      <ul>${feat[p].map((f) => `<li>✓ ${f}</li>`).join('')}</ul>${p === cur ? badge('Offre actuelle', 'ok') : '<button class="btn ghost sm" data-ask="' + p + '">Je suis intéressé</button>'}</div>`).join('')}</div>`;
  } else {
    const log = await q(sb.from('audit_log').select('*').eq('club_id', c.id).order('created_at', { ascending: false }).limit(100));
    const ACT = { insert: '➕ Ajout', update: '✏️ Modification', delete: '🗑 Suppression' };
    const ENT = { clubs: 'Club', memberships: 'Rôle', seasons: 'Saison', teams: 'Équipe', players: 'Joueur', activities: 'Activité', dues: 'Cotisation', documents: 'Document', invites: 'Invitation' };
    body = `<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Élément</th></tr></thead>
      <tbody>${log.map((l) => `<tr><td>${fmt.rel(l.created_at)}</td><td>${esc(memberName(l.user_id) || '—')}</td><td>${ACT[l.action] || l.action}</td><td>${ENT[l.entity] || l.entity} · ${esc(l.summary || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  el.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="${CT.tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>${body}`;
  $$('[data-t]', el).forEach((b) => (b.onclick = () => { CT.tab = b.dataset.t; clubSettings(el); }));
  const reload = async () => { await refreshClubData(); clubSettings(el); };

  if (CT.tab === 'infos') {
    $('#delMyClub', el) && ($('#delMyClub', el).onclick = () => deleteClubDialog(c));
    $('#cpPub', el).onclick = () => navigator.clipboard.writeText(publicUrl).then(() => toast('Lien copié'));
    $('#logo', el).onchange = async (e) => {
      try { const url = await upload(e.target.files[0], 'club-public', 'logo'); await q(sb.from('clubs').update({ logo_url: url }).eq('id', c.id)); S.club.logo_url = url; toast('Logo mis à jour'); location.reload(); }
      catch (err) { toast(errMsg(err), 'err'); }
    };
    $('#rmLogo', el) && ($('#rmLogo', el).onclick = async () => { await q(sb.from('clubs').update({ logo_url: null }).eq('id', c.id)); location.reload(); });
    $('#saveClub', el).onclick = async () => {
      try {
        const v = readForm(el);
        const { instagram, facebook, tiktok, ...rest } = v;
        const upd = await q(sb.from('clubs').update({ ...rest, socials: { instagram, facebook, tiktok } }).eq('id', c.id).select().single());
        Object.assign(S.club, upd); applyBrand(S.club); toast('Club enregistré ✅');
        if (rest.sport !== c.sport || rest.name !== c.name) location.reload();
      } catch (e) { toast(errMsg(e), 'err'); }
    };
  }
  if (CT.tab === 'membres') {
    $('#waM', el).onclick = () => groupInvite('parent');
    $('#invM', el).onclick = () => inviteDialog({ roles: ['coach', 'volunteer', 'parent', 'player', 'admin'] });
    $$('[data-tog]', el).forEach((b) => (b.onclick = async () => {
      const u = b.dataset.u, r = b.dataset.tog, has = b.classList.contains('on');
      if (has && u === S.user.id && r === 'admin') return toast('Tu ne peux pas retirer ton propre rôle d’administrateur', 'err');
      try {
        if (has) await q(sb.from('memberships').delete().eq('club_id', c.id).eq('user_id', u).eq('role', r));
        else await q(sb.from('memberships').insert({ club_id: c.id, user_id: u, role: r }));
        reload();
      } catch (e) { toast(errMsg(e), 'err'); }
    }));
    $$('[data-kick]', el).forEach((b) => (b.onclick = () => removeMember(S.members.find((m) => m.id === b.dataset.kick), reload)));
    $$('[data-medit]', el).forEach((b) => (b.onclick = () => editMemberDialog(S.members.find((m) => m.id === b.dataset.medit), reload)));
    const invs = await q(sb.from('invites').select('*').eq('club_id', c.id).gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }));
    $('#invList', el).innerHTML = invs.length ? `<h4 class="list-day">Invitations actives</h4><div class="card">${invs.map((i) => `<div class="member"><b class="code">${i.code}</b><div class="grow"><small>${ROLE_LABEL[i.role]}${i.label ? ' · ' + esc(i.label) : ''} · utilisé ${i.uses}/${i.max_uses} · expire ${fmt.date(i.expires_at)}</small></div><button class="icon-btn" data-delinv="${i.id}" aria-label="Supprimer">🗑</button></div>`).join('')}</div>` : '';
    $$('[data-delinv]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('invites').delete().eq('id', b.dataset.delinv)); clubSettings(el); }));
  }
  if (CT.tab === 'saisons') {
    $('#newSeason', el).onclick = () => { const y = new Date().getFullYear(); modal({ title: 'Nouvelle saison', body: formHTML([
      { name: 'name', label: 'Nom', required: true, value: `Saison ${y}-${y + 1}` }, { name: 'start_date', label: 'Début', type: 'date', col: 2, value: `${y}-09-01` }, { name: 'end_date', label: 'Fin', type: 'date', col: 2, value: `${y + 1}-06-30` }]),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer', cls: 'primary', run: async (w) => { await q(sb.from('seasons').insert({ ...readForm(w), club_id: c.id })); reload(); } }] }); };
    $$('[data-dupl]', el).forEach((b) => (b.onclick = () => { const s = S.seasons.find((x) => x.id === b.dataset.dupl); const m = s.name.match(/(\d{4})-(\d{4})/);
      modal({ title: 'Passer à la saison suivante', body: `<p>Une nouvelle saison est créée avec les mêmes équipes. L'ancienne est archivée (historique conservé).</p>` + formHTML([
        { name: 'name', label: 'Nom de la nouvelle saison', required: true, value: m ? `Saison ${+m[1] + 1}-${+m[2] + 1}` : '' },
        { name: 'move', label: 'Transférer les joueurs dans les nouvelles équipes', type: 'checkbox', value: true }]),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer la saison', cls: 'primary', run: async (w) => { const v = readForm(w); await q(sb.rpc('duplicate_season', { p_season: s.id, p_name: v.name, p_move_players: v.move })); toast('Nouvelle saison prête 🎉'); S.cache = {}; reload(); } }] }); }));
    $$('[data-arch]', el).forEach((b) => (b.onclick = async () => { if (await confirmBox('Archiver cette saison ? Rien n’est supprimé.', { ok: 'Archiver', danger: false })) { await q(sb.from('seasons').update({ status: 'archived' }).eq('id', b.dataset.arch)); reload(); } }));
    $$('[data-react]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('seasons').update({ status: 'active' }).eq('id', b.dataset.react)); reload(); }));
  }
  $$('[data-done]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('join_requests').update({ status: 'done' }).eq('id', b.dataset.done)); clubSettings(el); }));
  $$('[data-deljr]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('join_requests').delete().eq('id', b.dataset.deljr)); clubSettings(el); }));
  $$('[data-ask]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('reports').insert({ club_id: c.id, user_id: S.user.id, reason: `Demande d'offre ${b.dataset.ask} pour ${c.name}` })); toast('Demande envoyée, nous revenons vers toi !'); }));
}

// ---------------------------------------------------------------- profil
export async function profile(el) {
  setTitle('Mon profil');
  const p = S.profile;
  el.innerHTML = `<div class="grid2"><section class="card"><div class="photo-row">${avatar(p.full_name, null, 'xl')}<div><h3>${esc(p.full_name)}</h3><p class="muted">${esc(p.email)}</p>
      <p>${S.roles.map((r) => badge(ROLE_LABEL[r])).join(' ')}</p></div></div>
      ${formHTML([{ name: 'full_name', label: 'Prénom et nom', required: true }, { name: 'phone', label: 'Téléphone', type: 'tel' }], p)}
      <div class="row end"><button class="btn primary" id="saveP">Enregistrer</button></div></section>
    <section class="card"><h3>⚙️ Réglages</h3><div class="list">
      ${!isStandalone() ? '<button class="list-row" id="inst">📲 <span class="grow">Installer l’appli sur ce téléphone</span></button>' : ''}
      ${'Notification' in window ? `<button class="list-row" id="notif">🔔 <span class="grow">Notifications : ${Notification.permission === 'granted' ? 'activées' : Notification.permission === 'denied' ? 'bloquées dans le navigateur' : 'à activer'}</span></button>` : ''}
      <button class="list-row" id="pwd">🔑 <span class="grow">Changer mon mot de passe</span></button>
      <button class="list-row" id="code">🎟️ <span class="grow">Rejoindre un autre club avec un code</span></button>
      <button class="list-row" id="report">🚩 <span class="grow">Signaler un problème</span></button>
      ${!role.admin() ? '<button class="list-row danger-text" id="leave">🚪 <span class="grow">Quitter ce club</span></button>' : ''}
      <button class="list-row danger-text" id="logout">⎋ <span class="grow">Se déconnecter</span></button>
      <button class="list-row danger-text" id="delMe">🗑 <span class="grow">Supprimer mon compte</span></button></div>
      <p class="muted small mt">ClubManager · tes données ne sont visibles que par les membres de ton club.</p></section></div>`;
  $('#saveP', el).onclick = async () => { try { const v = readForm(el); await q(sb.from('profiles').update(v).eq('id', p.id)); Object.assign(S.profile, v); toast('Profil enregistré'); await refreshClubData(); } catch (e) { toast(errMsg(e), 'err'); } };
  $('#inst', el) && ($('#inst', el).onclick = installApp);
  $('#notif', el) && ($('#notif', el).onclick = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Notifications activées 🔔' : 'Notifications non autorisées', r === 'granted' ? 'ok' : 'err'); profile(el); });
  $('#pwd', el).onclick = () => modal({ title: 'Nouveau mot de passe', body: formHTML([{ name: 'p', label: 'Nouveau mot de passe', type: 'password', required: true }]),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => { const { error } = await sb.auth.updateUser({ password: readForm(w).p }); if (error) throw error; toast('Mot de passe modifié'); } }] });
  $('#code', el).onclick = joinWithCode;
  $('#report', el).onclick = () => modal({ title: 'Signaler un problème', body: formHTML([{ name: 'reason', label: 'Décris le problème', type: 'textarea', required: true }]),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer', cls: 'primary', run: async (w) => { await q(sb.from('reports').insert({ club_id: S.club?.id, user_id: S.user.id, reason: readForm(w).reason })); toast('Merci, signalement envoyé'); } }] });
  $('#leave', el) && ($('#leave', el).onclick = async () => {
    if (!(await confirmBox(`Quitter « ${S.club.name} » ? Tu n'auras plus accès à ses informations.`, { ok: 'Quitter' }))) return;
    await q(sb.from('memberships').delete().eq('club_id', S.club.id).eq('user_id', S.user.id)); localStorage.removeItem('cm_club'); location.hash = '#/'; location.reload();
  });
  $('#logout', el).onclick = () => sb.auth.signOut();
  $('#delMe', el).onclick = deleteMyAccount;
}

// ---------------------------------------------------------------- super admin
const SA = { tab: 'apps', appFilter: 'pending' };
const PLAN_OPTS = [['gratuit', 'Gratuit'], ['standard', 'Standard'], ['premium', 'Premium']];

// Lien d'activation à transmettre au responsable du club
function activationBox(code, clubName, contact = '') {
  const link = `${location.origin}${location.pathname}#/rejoindre/${code}`;
  const msg = `Bonjour${contact ? ' ' + contact : ''} ! L'espace de ${clubName} sur ClubManager est prêt. Crée ton compte administrateur ici : ${link}`;
  return { link, msg, html: `<div class="invite-box"><small>Lien d'activation (administrateur du club, valable 30 jours)</small><b class="code">${esc(code)}</b>
    <input readonly value="${esc(link)}" aria-label="Lien d'activation">
    <div class="row gap wrap"><button class="btn sm primary" data-copy>📋 Copier le message</button>
    <a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>
    <a class="btn sm ghost" href="sms:?&body=${encodeURIComponent(msg)}">SMS</a></div></div>` };
}
function showActivation(title, code, clubName, contact, email) {
  const box = activationBox(code, clubName, contact);
  modal({ title, body: `<p class="lead">Le club <b>${esc(clubName)}</b> est créé. Envoie ce lien au responsable${contact ? ` (${esc(contact)})` : ''} : en créant son compte avec, il devient administrateur du club.</p>${box.html}
    ${email ? `<p class="mt"><a class="btn sm ghost" href="mailto:${esc(email)}?subject=${encodeURIComponent('Votre espace ClubManager est prêt')}&body=${encodeURIComponent(box.msg)}">✉️ Envoyer par email à ${esc(email)}</a></p>` : ''}`,
    actions: [{ label: 'Terminé', cls: 'primary' }],
    onOpen: (w) => { $('[data-copy]', w).onclick = () => navigator.clipboard.writeText(box.msg).then(() => toast('Message copié')); } });
}

export async function superAdmin(el, tab) {
  if (!role.sa()) { location.hash = '#/'; return; }
  if (!tab) { location.hash = '#/admin/home'; return; }
  if (tab === 'home') return platformHome(el);
  if (tab === 'annonce') return platformBroadcast(el);
  SA.tab = tab;
  const [o, settings, apps] = await Promise.all([
    q(sb.rpc('platform_overview')),
    q(sb.from('platform_settings').select('*')),
    q(sb.from('club_applications').select('*').order('created_at', { ascending: false }).limit(300)),
  ]);
  const pending = apps.filter((x) => x.status === 'pending');
  const needApproval = settings.find((x) => x.key === 'clubs_need_approval')?.value === true;
  const tabs = [['apps', `Inscriptions${pending.length ? ` (${pending.length})` : ''}`], ['clubs', `Clubs (${o.clubs})`], ['users', 'Utilisateurs'],
    ['reports', `Signalements (${o.reports.filter((r) => r.status === 'open').length})`], ['log', 'Activité'], ['settings', 'Paramètres']];
  let body = '';
  if (SA.tab === 'apps') {
    const list = apps.filter((x) => SA.appFilter === 'all' || x.status === SA.appFilter);
    const ST = { pending: ['En attente', 'warn'], approved: ['Validé', 'ok'], rejected: ['Refusé', 'bad'] };
    body = `<div class="toolbar"><div class="seg">${[['pending', `En attente (${pending.length})`], ['approved', 'Validés'], ['rejected', 'Refusés'], ['all', 'Tous']].map(([k, l]) => `<button class="${SA.appFilter === k ? 'on' : ''}" data-af="${k}">${l}</button>`).join('')}</div>
      <button class="btn primary" id="newClubSA">＋ Créer un club</button></div>
      <div class="notice small">${needApproval ? '🔒 Les nouveaux clubs doivent être validés par toi avant d’être créés.' : '🔓 Les clubs peuvent se créer librement (sans validation).'} <button class="link" id="toggleAppr">${needApproval ? 'Ouvrir les inscriptions libres' : 'Exiger ma validation'}</button></div>
      ${list.length ? list.map((x) => `<article class="card app-card">
        <div class="card-head"><div><h3>${SPORTS[x.sport]?.emoji || '🏅'} ${esc(x.club_name)}</h3><small class="muted">${esc(x.city || 'Ville non précisée')} · demandé ${fmt.rel(x.created_at)}</small></div>${badge(ST[x.status][0], ST[x.status][1])}</div>
        <div class="app-grid"><div><small class="muted">Responsable</small><b>${esc(x.contact_name)}</b></div>
          <div><small class="muted">Email</small><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></div>
          ${x.phone ? `<div><small class="muted">Téléphone</small><a href="tel:${esc(x.phone)}">${esc(x.phone)}</a></div>` : ''}
          ${x.players_estimate != null ? `<div><small class="muted">Licenciés</small><b>≈ ${x.players_estimate}</b></div>` : ''}
          <div><small class="muted">Compte</small><b>${x.user_id ? 'Déjà créé' : 'Pas encore'}</b></div></div>
        ${x.message ? `<p class="pre app-msg">${esc(x.message)}</p>` : ''}
        ${x.status === 'pending' ? `<div class="row gap wrap mt"><select data-aplan="${x.id}" aria-label="Offre" style="width:auto">${PLAN_OPTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <button class="btn primary" data-approve="${x.id}">✓ Valider et créer le club</button><button class="btn ghost danger-text" data-reject="${x.id}">Refuser</button></div>`
        : x.status === 'approved' ? `<div class="row gap wrap mt"><small class="muted grow">Validé ${fmt.rel(x.decided_at)} · offre ${esc(x.plan || 'gratuit')}${x.user_id ? ' · le responsable a déjà accès' : ''}</small>
          ${x.invite_code ? `<button class="btn sm ghost" data-relink="${x.id}">🔗 Lien d'activation</button>` : ''}${x.club_id ? `<button class="btn sm primary" data-manage="${x.club_id}">Gérer le club</button>` : ''}</div>`
        : `<p class="muted small mt">Refusé ${fmt.rel(x.decided_at)}${x.reject_reason ? ` : ${esc(x.reject_reason)}` : ''}</p>`}
      </article>`).join('') : empty('📭', SA.appFilter === 'pending' ? 'Aucune demande en attente' : 'Rien ici', 'Les clubs envoient leur demande depuis l’écran de connexion (« Inscrire mon club »).')}`;
  } else if (SA.tab === 'clubs') body = `<div class="toolbar"><p class="muted">${o.clubs} club(s), ${o.active_clubs} actif(s)</p><button class="btn primary" id="newClubSA">＋ Créer un club</button></div>
    ${o.club_list.length ? `<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>Club</th><th>Membres</th><th>Joueurs</th><th>Offre</th><th>Statut</th><th></th></tr></thead>
    <tbody>${o.club_list.map((c) => `<tr><td><b>${SPORTS[c.sport]?.emoji || ''} ${esc(c.name)}</b><br><small class="muted">${esc(c.city || '')} · créé ${fmt.date(c.created_at)} · <a href="#/club/${c.slug}" target="_blank">page publique</a></small></td><td>${c.members}</td><td>${c.players}</td>
      <td><select data-plan="${c.id}" aria-label="Offre" style="width:auto">${PLAN_OPTS.map(([p, l]) => `<option value="${p}" ${c.plan === p ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><button class="btn sm ${c.status === 'active' ? 'ghost' : 'danger'}" data-sus="${c.id}" data-st="${c.status}">${c.status === 'active' ? '🟢 Actif' : '⛔ Suspendu'}</button></td>
      <td><div class="row gap"><button class="btn sm primary" data-manage="${c.id}">Gérer</button><button class="btn sm ghost" data-invadm="${c.id}" data-name="${esc(c.name)}" title="Nouveau lien administrateur">🔗</button><button class="btn sm ghost danger-text" data-delclub="${c.id}" data-name="${esc(c.name)}" aria-label="Supprimer">🗑</button></div></td></tr>`).join('')}</tbody></table></div></div>`
      : empty('🏟️', 'Aucun club', 'Valide une demande d’inscription ou crée un club toi-même.')}`;
  else if (SA.tab === 'users') { el.innerHTML = '<div id="pfUsers"></div>'; return platformUsers($('#pfUsers', el)); }
  else if (SA.tab === 'users_old') body = `<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Email</th><th>Clubs</th><th>Inscrit</th></tr></thead>
    <tbody>${o.user_list.map((u) => `<tr><td>${esc(u.full_name || '')}${u.super ? ' 🛡️' : ''}</td><td>${esc(u.email || '')}</td><td>${u.clubs}</td><td>${fmt.date(u.created_at)}</td></tr>`).join('')}</tbody></table></div></div>`;
  else if (SA.tab === 'reports') body = o.reports.length ? `<div class="card">${o.reports.map((r) => `<div class="member"><span class="emoji-box">${r.status === 'open' ? '🚩' : '✅'}</span><div class="grow"><b>${esc(r.club || 'Plateforme')}</b><p class="pre">${esc(r.reason)}</p><small>${fmt.rel(r.created_at)}</small></div>
    ${r.status === 'open' ? `<button class="btn sm ghost" data-close="${r.id}">Clore</button>` : ''}</div>`).join('')}</div>` : empty('✅', 'Aucun signalement');
  else if (SA.tab === 'log') body = `<p class="muted">Dernières actions sur la plateforme. Les erreurs techniques détaillées sont dans le tableau de bord Supabase (journaux).</p><div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>Quand</th><th>Club</th><th>Action</th><th>Élément</th></tr></thead>
    <tbody>${o.recent_log.map((l) => `<tr><td>${fmt.rel(l.created_at)}</td><td>${esc(l.club || '—')}</td><td>${l.action}</td><td>${l.entity} · ${esc(l.summary || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
  else {
    const plans = settings.find((x) => x.key === 'plans')?.value || {};
    body = `<div class="card"><h3>Inscription des clubs</h3><label class="check"><input type="checkbox" id="needAppr" ${needApproval ? 'checked' : ''}> <span>Les nouveaux clubs doivent être validés par moi</span></label>
      <p class="muted small">Décoché : n'importe qui peut créer son club directement depuis l'appli.</p>
      <h4>Limites des offres</h4><table class="table"><thead><tr><th>Offre</th><th>Équipes max.</th><th>Joueurs max.</th></tr></thead><tbody>${PLAN_OPTS.map(([p, l]) => `<tr><td>${l}</td>
        <td><input type="number" min="1" data-lim="${p}.teams" value="${plans[p]?.teams ?? ''}"></td><td><input type="number" min="1" data-lim="${p}.players" value="${plans[p]?.players ?? ''}"></td></tr>`).join('')}</tbody></table>
      <div class="row end mt"><button class="btn primary" id="saveSet">Enregistrer</button></div></div>`;
  }
  el.innerHTML = `<div class="kpis"><a class="kpi" href="#/admin/apps" data-goto="apps"><b>${pending.length}</b><small>Demandes en attente</small></a><div class="kpi"><b>${o.clubs}</b><small>Clubs (${o.active_clubs} actifs)</small></div><div class="kpi"><b>${o.users}</b><small>Utilisateurs</small></div>
    <div class="kpi"><b>${o.players}</b><small>Joueurs</small></div><div class="kpi"><b>${o.plans.standard || 0} / ${o.plans.premium || 0}</b><small>Standard / Premium</small></div></div>
    ${body}`;
  const reload = () => superAdmin(el, SA.tab);
  const setApproval = async (v) => { await q(sb.from('platform_settings').upsert([{ key: 'clubs_need_approval', value: v }, { key: 'signups_open', value: true }])); S.needApproval = v; toast(v ? 'Validation des clubs activée' : 'Inscriptions libres ouvertes'); reload(); };
  $$('[data-goto]', el).forEach((b) => (b.onclick = (e) => { e.preventDefault(); SA.appFilter = 'pending'; location.hash = '#/admin/apps'; }));
  $$('[data-af]', el).forEach((b) => (b.onclick = () => { SA.appFilter = b.dataset.af; reload(); }));
  $('#toggleAppr', el) && ($('#toggleAppr', el).onclick = () => setApproval(!needApproval));
  $('#newClubSA', el) && ($('#newClubSA', el).onclick = () => modal({ title: 'Créer un club', wide: true, body: formHTML([
      { name: 'name', label: 'Nom du club', required: true }, { name: 'city', label: 'Ville', col: 2 },
      { name: 'sport', label: 'Sport', type: 'select', options: Object.entries(SPORTS).map(([k, x]) => [k, `${x.emoji} ${x.label}`]), value: 'basket', col: 2 },
      { name: 'plan', label: 'Offre', type: 'select', options: PLAN_OPTS, col: 2 }, { name: 'contact', label: 'Nom du responsable (facultatif)', col: 2 },
    ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer le club', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const r = await q(sb.rpc('admin_create_club', { p_name: v.name, p_sport: v.sport, p_city: v.city || '', p_plan: v.plan, p_contact: v.contact || '' }));
      await loadMemberships(); reload(); showActivation('Club créé 🎉', r.code, v.name, v.contact); return false;
    } }] }));
  $$('[data-approve]', el).forEach((b) => (b.onclick = async () => {
    const x = apps.find((y) => y.id === b.dataset.approve); const plan = $(`[data-aplan="${x.id}"]`, el).value;
    b.disabled = true;
    try {
      const r = await q(sb.rpc('approve_club_application', { p_id: x.id, p_plan: plan }));
      await loadMemberships(); reload();
      if (r.code) showActivation('Club validé 🎉', r.code, x.club_name, x.contact_name, x.email);
      else toast(`${x.club_name} est validé : ${x.contact_name} y a accès dès maintenant`);
    } catch (e) { toast(errMsg(e), 'err'); b.disabled = false; }
  }));
  $$('[data-reject]', el).forEach((b) => (b.onclick = () => {
    const x = apps.find((y) => y.id === b.dataset.reject);
    modal({ title: `Refuser « ${x.club_name} »`, body: formHTML([{ name: 'reason', label: 'Raison (visible par le demandeur)', type: 'textarea', placeholder: 'Ex. : informations incomplètes, club déjà inscrit…' }]),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Refuser la demande', cls: 'danger', run: async (w) => { await q(sb.rpc('reject_club_application', { p_id: x.id, p_reason: readForm(w).reason || '' })); toast('Demande refusée'); reload(); } }] });
  }));
  $$('[data-relink]', el).forEach((b) => (b.onclick = () => { const x = apps.find((y) => y.id === b.dataset.relink); showActivation('Lien d’activation', x.invite_code, x.club_name, x.contact_name, x.email); }));
  $$('[data-invadm]', el).forEach((b) => (b.onclick = async () => {
    try {
      const inv = await q(sb.from('invites').insert({ club_id: b.dataset.invadm, role: 'admin', label: 'Responsable du club', max_uses: 2, created_by: S.user.id }).select().single());
      showActivation('Nouveau lien administrateur', inv.code, b.dataset.name);
    } catch (e) { toast(errMsg(e), 'err'); }
  }));
  $$('[data-delclub]', el).forEach((b) => (b.onclick = () => deleteClubDialog({ id: b.dataset.delclub, name: b.dataset.name }, reload)));
  $$('[data-plan]', el).forEach((x) => (x.onchange = async () => { try { await q(sb.from('clubs').update({ plan: x.value }).eq('id', x.dataset.plan)); toast('Offre modifiée'); } catch (e) { toast(errMsg(e), 'err'); } }));
  $$('[data-sus]', el).forEach((b) => (b.onclick = async () => {
    const sus = b.dataset.st === 'active';
    if (sus && !(await confirmBox('Suspendre ce club ? Ses membres ne pourront plus accéder à leurs données (rien n’est supprimé).', { ok: 'Suspendre' }))) return;
    await q(sb.from('clubs').update({ status: sus ? 'suspended' : 'active' }).eq('id', b.dataset.sus)); reload();
  }));
  $$('[data-close]', el).forEach((b) => (b.onclick = async () => { await q(sb.from('reports').update({ status: 'closed' }).eq('id', b.dataset.close)); reload(); }));
  $$('[data-manage]', el).forEach((b) => (b.onclick = async () => { await loadMemberships(); location.hash = '#/'; await selectClub(b.dataset.manage, 'admin'); toast('🏛️ Tu es dans la direction de ce club'); }));
  $('#saveSet', el) && ($('#saveSet', el).onclick = async () => {
    const plans = settings.find((x) => x.key === 'plans')?.value || {};
    $$('[data-lim]', el).forEach((i) => { const [p, k] = i.dataset.lim.split('.'); plans[p] = { ...(plans[p] || {}), [k]: +i.value }; });
    const v = $('#needAppr', el).checked;
    await q(sb.from('platform_settings').upsert([{ key: 'plans', value: plans }, { key: 'clubs_need_approval', value: v }, { key: 'signups_open', value: true }]));
    S.plans = plans; S.needApproval = v; toast('Paramètres enregistrés');
  });
}

// ---------------------------------------------------------------- page publique
export async function publicPage(root, slug) {
  root.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  window.onhashchange = () => location.reload();
  const { data, error } = await sb.rpc('get_public_club', { p_slug: slug });
  if (error || !data) { root.innerHTML = `<div class="center-screen"><div class="card narrow"><div class="empty"><div class="empty-emoji">🔍</div><h3>Club introuvable</h3><p>Cette page n'existe pas ou n'est pas publique.</p><a class="btn primary" href="#/">Accueil ClubManager</a></div></div></div>`; return; }
  const c = data.club; const sp = SPORTS[c.sport] || SPORTS.autre;
  applyBrand(c); document.title = `${c.name} · ClubManager`;
  const so = c.socials || {};
  const soc = [['instagram', 'Instagram', (v) => `https://instagram.com/${v.replace(/^@/, '')}`], ['facebook', 'Facebook', (v) => v.startsWith('http') ? v : `https://facebook.com/${v}`], ['tiktok', 'TikTok', (v) => `https://tiktok.com/@${v.replace(/^@/, '')}`]]
    .filter(([k]) => so[k]).map(([k, l, u]) => `<a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(u(so[k]))}">${l}</a>`).join('');
  root.innerHTML = `<div class="public">
    <header class="pub-hero"><div class="pub-inner">${c.logo_url ? `<img class="pub-logo" src="${esc(c.logo_url)}" alt="">` : `<div class="pub-logo emoji">${sp.emoji}</div>`}
      <div><p class="pub-tag">${sp.emoji} ${sp.label}${c.city ? ' · ' + esc(c.city) : ''}</p><h1>${esc(c.name)}</h1>${c.description ? `<p class="pub-desc">${esc(c.description)}</p>` : ''}
      <div class="row gap wrap"><button class="btn white" data-ask="join">Rejoindre le club</button><button class="btn outline" data-ask="signup">S'inscrire</button><button class="btn outline" data-ask="contact">Nous contacter</button></div></div></div></header>
    <main class="pub-main">
      <div class="grid2">
        <section class="card"><h3>📅 Prochains rendez-vous</h3>${data.upcoming.length ? data.upcoming.map((a) => `<div class="pub-row"><span class="act-date"><b>${new Date(a.starts_at).getDate()}</b><small>${new Date(a.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</small></span>
          <span class="grow"><b>${a.kind === 'match' ? `${sp.emoji} ${esc(a.team || '')} ${a.is_home === false ? '@' : 'vs'} ${esc(a.opponent || '')}` : `${esc(a.emoji || '🎉')} ${esc(a.title)}`}</b><small>${fmt.day(a.starts_at)} · ${fmt.time(a.starts_at)}${a.location ? ' · ' + esc(a.location) : ''}</small></span></div>`).join('') : '<p class="muted">Aucun rendez-vous public pour le moment.</p>'}</section>
        <section class="card"><h3>🏁 Derniers résultats</h3>${data.results.length ? data.results.map((r) => `<div class="pub-row"><span class="grow"><b>${esc(r.team || '')} ${r.is_home === false ? '@' : 'vs'} ${esc(r.opponent || '')}</b><small>${fmt.date(r.starts_at)}</small></span>
          <span class="score ${r.score_for > r.score_against ? 'win' : r.score_for < r.score_against ? 'loss' : ''}">${r.score_for} – ${r.score_against}</span></div>`).join('') : '<p class="muted">Pas encore de résultat.</p>'}</section>
      </div>
      ${data.teams.length ? `<section class="card"><h3>🏷️ Nos équipes</h3><div class="chips">${data.teams.map((t) => `<span class="chip">${esc(t.name)}${t.gender ? ' · ' + esc(t.gender) : ''}</span>`).join('')}</div></section>` : ''}
      ${data.news.length ? `<section class="card"><h3>📣 Actualités</h3>${data.news.map((n) => `<div class="ann"><b>${esc(n.subject || 'Actualité')}</b><p class="pre">${esc(n.body)}</p><small>${fmt.date(n.created_at)}</small></div>`).join('')}</section>` : ''}
      ${data.gallery.length ? `<section class="card"><h3>📸 Galerie</h3><div class="gallery">${data.gallery.map((g) => `<img src="${esc(g)}" alt="" loading="lazy">`).join('')}</div></section>` : ''}
      <section class="card"><h3>📞 Contact</h3><p>${c.address ? '📍 ' + esc(c.address) + '<br>' : ''}${c.phone ? `📞 <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><br>` : ''}${c.email ? `✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>` : ''}${c.website ? `🌐 <a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : ''}</p>
        <div class="row gap wrap">${soc}</div></section>
    </main>
    <footer class="pub-foot"><a href="#/">Espace membres</a> · Propulsé par <b>ClubManager</b></footer></div>`;
  $$('[data-ask]', root).forEach((b) => (b.onclick = () => {
    const kind = b.dataset.ask;
    modal({ title: { join: 'Rejoindre le club', signup: "S'inscrire", contact: 'Nous contacter' }[kind], body: formHTML([
      { name: 'name', label: 'Prénom et nom', required: true }, { name: 'email', label: 'Email', type: 'email', col: 2 }, { name: 'phone', label: 'Téléphone', type: 'tel', col: 2 },
      { name: 'message', label: kind === 'contact' ? 'Message' : 'Âge, catégorie, expérience…', type: 'textarea', rows: 4 }]) + '<p class="muted small">Tes coordonnées sont transmises uniquement au club.</p>',
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer', cls: 'primary', run: async (w) => {
      const v = readForm(w); if (!v.email && !v.phone) throw new Error('Indique un email ou un téléphone');
      const { data: ok, error: e } = await sb.rpc('public_contact', { p_slug: slug, p_name: v.name, p_email: v.email || '', p_phone: v.phone || '', p_message: v.message || '', p_kind: kind });
      if (e || !ok) throw new Error("L'envoi n'a pas fonctionné, réessaie plus tard");
      toast('Merci ! Le club va te recontacter 🙌');
    } }] });
  }));
}
