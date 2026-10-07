// ClubManager — groupes de discussion et suppression d'un club
import { sb, S, role, esc, $, $$, fmt, toast, modal, closeModal, confirmBox, formHTML, readForm, errMsg, q, empty, avatar, badge, haptic, downloadCSV } from './core.js';
import { setTitle, refreshCounters, loadMemberships } from './app.js';

const ROLE_LABEL = { admin: 'Admin', coach: 'Entraîneur', player: 'Joueur', parent: 'Parent', volunteer: 'Bénévole' };
const EMOJIS = ['💬', '🏀', '🏆', '👨‍👩‍👧', '🧑‍🏫', '🙋', '🚗', '🍔', '📣', '⭐️', '🔥', '🎉'];
const who = (id) => S.members.find((m) => m.id === id);
const nameOf = (id) => who(id)?.full_name || 'Membre';

// ---------------------------------------------------------------- liste des groupes
export async function groupList(el) {
  const [groups, mine] = await Promise.all([
    q(sb.from('chat_groups').select('*').eq('club_id', S.club.id).order('last_message_at', { ascending: false })),
    q(sb.from('chat_group_members').select('group_id, user_id').eq('club_id', S.club.id)),
  ]);
  const ids = groups.map((g) => g.id);
  const [msgs, reads] = ids.length ? await Promise.all([
    q(sb.from('messages').select('id, group_id, sender_id, sender_name, body, created_at').in('group_id', ids).order('created_at', { ascending: false }).limit(400)),
    q(sb.from('message_reads').select('message_id').eq('user_id', S.user.id)),
  ]) : [[], []];
  const readSet = new Set(reads.map((r) => r.message_id));
  const count = (g) => mine.filter((m) => m.group_id === g.id).length;
  const isIn = (g) => mine.some((m) => m.group_id === g.id && m.user_id === S.user.id);
  const last = (g) => msgs.find((m) => m.group_id === g.id);
  const unread = (g) => msgs.filter((m) => m.group_id === g.id && m.sender_id !== S.user.id && !readSet.has(m.id)).length;

  el.innerHTML = `<div class="toolbar"><p class="muted">${groups.length ? `${groups.length} groupe${groups.length > 1 ? 's' : ''}` : ''}</p>
      ${role.staff() ? '<button class="btn primary" id="newGroup">＋ Nouveau groupe</button>' : ''}</div>
    ${groups.length ? `<div class="card list">${groups.map((g) => { const l = last(g), u = unread(g); return `<a class="list-row grp-row" href="#/groupe/${g.id}">
        <span class="grp-emoji">${esc(g.emoji)}</span><span class="grow"><b>${esc(g.name)}</b>
        <small>${l ? `${l.sender_id === S.user.id ? 'Toi' : esc(l.sender_name || 'Membre')} : ${esc(l.body.slice(0, 70))}` : `${count(g)} membre${count(g) > 1 ? 's' : ''} · aucun message`}${!isIn(g) ? ' · 👁 lecture admin' : ''}</small></span>
        <span class="grp-meta">${l ? `<small>${fmt.rel(l.created_at)}</small>` : ''}${u ? `<span class="badge-dot">${u > 99 ? '99+' : u}</span>` : ''}</span></a>`; }).join('')}</div>`
    : empty('💬', 'Aucun groupe', role.staff() ? 'Crée un groupe pour une équipe, les parents d’une catégorie, les bénévoles d’un tournoi…' : 'Tu n’es dans aucun groupe pour le moment. Le club t’ajoutera aux groupes de ton équipe.')}`;
  $('#newGroup', el) && ($('#newGroup', el).onclick = () => groupForm({}, (g) => (location.hash = `#/groupe/${g.id}`)));
}

// ---------------------------------------------------------------- créer / modifier un groupe
export function groupForm(g = {}, after) {
  const editing = !!g.id;
  let picked = new Set();
  const people = S.members.filter((m) => m.id !== S.user.id);
  modal({ title: editing ? 'Modifier le groupe' : 'Nouveau groupe', wide: true,
    body: `<div class="emoji-pick" id="emo">${EMOJIS.map((e) => `<button type="button" class="${(g.emoji || '💬') === e ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>` + formHTML([
      { name: 'name', label: 'Nom du groupe', required: true, value: g.name, placeholder: 'Ex. : Parents U13 Garçons' },
      { name: 'description', label: 'Description (facultatif)', value: g.description },
      { name: 'team_id', label: 'Lié à une équipe', type: 'select', options: [['', '— Aucune —'], ...S.teams.map((t) => [t.id, t.name])], value: g.team_id || '' },
      { name: 'only_managers_post', label: '📣 Seuls les gestionnaires peuvent écrire (groupe d’annonces)', type: 'checkbox', value: g.only_managers_post },
    ]) + (editing ? '' : `<h4 class="mt">Membres</h4>
      <div class="chips" id="quick"><button type="button" class="chip" data-q="team">🏷️ Toute l’équipe choisie</button>
        ${Object.entries(ROLE_LABEL).map(([r, l]) => `<button type="button" class="chip" data-q="${r}">${l}s</button>`).join('')}<button type="button" class="chip" data-q="none">Aucun</button></div>
      <input type="search" id="pplQ" placeholder="Rechercher une personne…" aria-label="Rechercher" class="mt">
      <div class="kid-pick" id="ppl">${people.map((m) => `<label class="kid-opt" data-name="${esc(m.full_name.toLowerCase())}"><input type="checkbox" value="${m.id}">${avatar(m.full_name, null, 'sm')}
        <span class="grow"><b>${esc(m.full_name)}</b><small>${m.roles.map((r) => ROLE_LABEL[r]).join(', ')}</small></span></label>`).join('') || '<p class="muted">Aucun autre membre pour l’instant : invite d’abord des personnes au club.</p>'}</div>
      <p class="muted small" id="pplN">0 personne sélectionnée (tu es ajouté automatiquement)</p>`),
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: editing ? 'Enregistrer' : 'Créer le groupe', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      const row = { name: v.name.trim(), description: v.description || null, team_id: v.team_id || null, only_managers_post: !!v.only_managers_post, emoji: $('#emo .on', w)?.dataset.e || '💬' };
      if (editing) { await q(sb.from('chat_groups').update(row).eq('id', g.id)); toast('Groupe modifié'); after?.(g); return; }
      const created = await q(sb.from('chat_groups').insert({ ...row, club_id: S.club.id, created_by: S.user.id }).select().single());
      const ids = [...picked].filter((id) => id !== S.user.id);
      if (ids.length) await q(sb.from('chat_group_members').insert(ids.map((user_id) => ({ group_id: created.id, user_id, club_id: S.club.id }))));
      haptic(); toast(`Groupe créé · ${ids.length + 1} membre${ids.length ? 's' : ''}`); after?.(created);
    } }],
    onOpen: (w) => {
      $$('#emo [data-e]', w).forEach((b) => (b.onclick = () => { $$('#emo [data-e]', w).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }));
      if (editing) return;
      const sync = () => { picked = new Set($$('#ppl input:checked', w).map((i) => i.value)); $('#pplN', w).textContent = `${picked.size} personne${picked.size > 1 ? 's' : ''} sélectionnée${picked.size > 1 ? 's' : ''} (tu es ajouté automatiquement)`; };
      const check = (ids) => { $$('#ppl input', w).forEach((i) => { if (ids.has(i.value)) i.checked = true; }); sync(); };
      $$('#ppl input', w).forEach((i) => (i.onchange = sync));
      $('#pplQ', w).oninput = (e) => { const s = e.target.value.toLowerCase().trim(); $$('#ppl .kid-opt', w).forEach((l) => (l.hidden = s && !l.dataset.name.includes(s))); };
      $$('#quick [data-q]', w).forEach((b) => (b.onclick = async () => {
        const k = b.dataset.q;
        if (k === 'none') { $$('#ppl input', w).forEach((i) => (i.checked = false)); return sync(); }
        if (k === 'team') {
          const t = $('[name=team_id]', w).value;
          if (!t) return toast('Choisis d’abord l’équipe dans « Lié à une équipe »', 'err');
          const ids = await q(sb.rpc('team_people', { p_team: t })).catch(() => []);
          const set = new Set((ids || []).map((x) => (typeof x === 'string' ? x : x.team_people)));
          if (!set.size) toast('Personne de cette équipe n’a encore de compte', 'info');
          if (!$('[name=name]', w).value) $('[name=name]', w).value = S.teams.find((x) => x.id === t)?.name || '';
          return check(set);
        }
        check(new Set(people.filter((m) => m.roles.includes(k)).map((m) => m.id)));
      }));
    } });
}

// ---------------------------------------------------------------- conversation
let liveGroup = null;
export async function groupChat(el, id) {
  const g = (await q(sb.from('chat_groups').select('*').eq('id', id).limit(1)))[0];
  if (!g) { el.innerHTML = empty('🔒', 'Groupe introuvable', 'Ce groupe a été supprimé ou tu n’en fais plus partie.'); return; }
  setTitle(`${g.emoji} ${g.name}`);
  const [members, msgs] = await Promise.all([
    q(sb.from('chat_group_members').select('*').eq('group_id', id)),
    q(sb.from('messages').select('*').eq('group_id', id).order('created_at', { ascending: false }).limit(200)),
  ]);
  msgs.reverse();
  const me = members.find((m) => m.user_id === S.user.id);
  const manager = !!me?.is_manager || g.created_by === S.user.id || role.admin();
  const canPost = !!me && (!g.only_managers_post || manager);

  let prevDay = '';
  const bubble = (m) => {
    const mine = m.sender_id === S.user.id;
    const day = fmt.dayLong(m.created_at);
    const sep = day !== prevDay ? `<div class="chat-day"><span>${day}</span></div>` : ''; prevDay = day;
    return `${sep}<div class="bubble-row ${mine ? 'me' : ''}">${mine ? '' : avatar(m.sender_name, null, 'sm')}
      <div class="bubble" data-mid="${m.id}" data-own="${mine || role.admin() ? 1 : ''}">${mine ? '' : `<b>${esc(m.sender_name || 'Membre')}</b>`}<p class="pre">${esc(m.body)}</p><small>${fmt.time(m.created_at)}</small></div></div>`;
  };
  el.innerHTML = `<div class="chat">
    <button class="chat-head card" id="gInfo"><span class="grp-emoji">${esc(g.emoji)}</span><span class="grow"><b>${esc(g.name)}</b>
      <small>${members.length} membre${members.length > 1 ? 's' : ''}${g.only_managers_post ? ' · 📣 annonces' : ''}${g.description ? ' · ' + esc(g.description) : ''}</small></span><span class="muted">ⓘ</span></button>
    <div class="chat-body" id="chatBody">${msgs.length ? msgs.map(bubble).join('') : `<div class="chat-empty">👋 Aucun message.<br>${canPost ? 'Écris le premier !' : ''}</div>`}</div>
    ${canPost ? `<form class="chat-input" id="chatForm"><textarea name="body" rows="1" placeholder="Écrire un message…" aria-label="Message" maxlength="4000"></textarea><button class="btn primary round" aria-label="Envoyer">➤</button></form>`
      : `<p class="chat-ro muted small">${me ? '📣 Seuls les gestionnaires peuvent écrire dans ce groupe.' : '👁 Tu consultes ce groupe en tant qu’administrateur du club.'}</p>`}</div>`;
  const body = $('#chatBody', el);
  const toBottom = () => (body.scrollTop = body.scrollHeight);
  toBottom(); window.scrollTo(0, document.body.scrollHeight);

  // lu
  const unread = msgs.filter((m) => m.sender_id !== S.user.id).map((m) => ({ message_id: m.id, user_id: S.user.id }));
  if (unread.length) sb.from('message_reads').upsert(unread, { ignoreDuplicates: true }).then(refreshCounters);

  $('#gInfo', el).onclick = () => groupInfo(g, members, manager, () => groupChat(el, id));
  const form = $('#chatForm', el);
  if (form) {
    const ta = $('textarea', form);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
    ta.oninput = grow;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; grow();
      try {
        const m = await q(sb.from('messages').insert({ club_id: S.club.id, group_id: id, audience: 'group', sender_id: S.user.id, sender_name: S.profile?.full_name, body: text }).select().single());
        append(m); haptic();
      } catch (err) { ta.value = text; toast(errMsg(err), 'err'); }
    };
  }
  const seen = new Set(msgs.map((m) => m.id));
  const append = (m) => {
    if (seen.has(m.id)) return; seen.add(m.id);
    $('.chat-empty', body)?.remove();
    body.insertAdjacentHTML('beforeend', bubble(m)); bindBubbles(); toBottom();
  };
  const bindBubbles = () => $$('.bubble[data-own="1"]', body).forEach((b) => (b.oncontextmenu = b.ondblclick = async (e) => {
    e.preventDefault();
    if (await confirmBox('Supprimer ce message ?', { ok: 'Supprimer' })) {
      try { await q(sb.from('messages').delete().eq('id', b.dataset.mid)); b.closest('.bubble-row').remove(); } catch (err) { toast(errMsg(err), 'err'); }
    }
  }));
  bindBubbles();

  // temps réel
  liveGroup?.unsubscribe();
  liveGroup = sb.channel('grp-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${id}` }, (p) => {
    if (!document.body.contains(body)) { liveGroup?.unsubscribe(); liveGroup = null; return; }
    append(p.new);
    if (p.new.sender_id !== S.user.id) sb.from('message_reads').upsert({ message_id: p.new.id, user_id: S.user.id }, { ignoreDuplicates: true }).then(refreshCounters);
  }).subscribe();
}

// ---------------------------------------------------------------- infos et membres du groupe
function groupInfo(g, members, manager, after) {
  const inIds = new Set(members.map((m) => m.user_id));
  const others = S.members.filter((m) => !inIds.has(m.id));
  const sorted = [...members].sort((a, b) => (b.is_manager - a.is_manager) || nameOf(a.user_id).localeCompare(nameOf(b.user_id)));
  const isMember = inIds.has(S.user.id);
  modal({ title: `${g.emoji} ${g.name}`, wide: true,
    body: `${g.description ? `<p class="lead">${esc(g.description)}</p>` : ''}
      <h4>${members.length} membre${members.length > 1 ? 's' : ''}</h4>
      <div class="gm-list">${sorted.map((m) => { const p = who(m.user_id); return `<div class="gm-row">${avatar(nameOf(m.user_id), null, 'sm')}
        <span class="grow"><b>${esc(nameOf(m.user_id))}${m.user_id === S.user.id ? ' (toi)' : ''}</b><small>${m.is_manager ? '⭐️ Gestionnaire · ' : ''}${(p?.roles || []).map((r) => ROLE_LABEL[r]).join(', ')}</small></span>
        ${manager && m.user_id !== S.user.id ? `<button class="btn sm ghost" data-mgr="${m.user_id}" data-v="${m.is_manager ? '' : 1}" title="${m.is_manager ? 'Retirer le rôle de gestionnaire' : 'Nommer gestionnaire'}">${m.is_manager ? '☆' : '⭐️'}</button><button class="icon-btn" data-rm="${m.user_id}" aria-label="Retirer du groupe">✕</button>` : ''}</div>`; }).join('')}</div>
      ${manager && others.length ? `<h4 class="mt">Ajouter des personnes</h4><input type="search" id="addQ" placeholder="Rechercher…" aria-label="Rechercher">
        <div class="kid-pick" id="addL">${others.map((m) => `<label class="kid-opt" data-name="${esc(m.full_name.toLowerCase())}"><input type="checkbox" value="${m.id}">${avatar(m.full_name, null, 'sm')}<span class="grow"><b>${esc(m.full_name)}</b><small>${m.roles.map((r) => ROLE_LABEL[r]).join(', ')}</small></span></label>`).join('')}</div>
        <button class="btn primary block mt" id="addGo">Ajouter au groupe</button>` : ''}
      ${manager && g.team_id ? '<button class="btn ghost block mt wrap-text" id="syncTeam">🔄 Ajouter les nouveaux de l’équipe</button>' : ''}`,
    actions: [
      ...(manager ? [{ label: '🗑 Supprimer le groupe', cls: 'ghost danger-text', run: async () => {
        if (!(await confirmBox(`Supprimer « ${g.name} » et tous ses messages ?`, { ok: 'Supprimer' }))) return false;
        await q(sb.from('chat_groups').delete().eq('id', g.id)); toast('Groupe supprimé'); location.hash = '#/messages';
      } }, { label: '✏️ Modifier', cls: 'ghost', run: () => { closeModal(); setTimeout(() => groupForm(g, after), 250); return false; } }] : []),
      ...(isMember ? [{ label: 'Quitter le groupe', cls: 'ghost danger-text', run: async () => {
        if (!(await confirmBox('Quitter ce groupe ? Tu ne recevras plus ses messages.', { ok: 'Quitter' }))) return false;
        await q(sb.from('chat_group_members').delete().eq('group_id', g.id).eq('user_id', S.user.id)); toast('Tu as quitté le groupe'); location.hash = '#/messages';
      } }] : []),
    ],
    onOpen: (w) => {
      $$('[data-rm]', w).forEach((b) => (b.onclick = async () => {
        if (!(await confirmBox(`Retirer ${nameOf(b.dataset.rm)} du groupe ?`, { ok: 'Retirer' }))) return;
        try { await q(sb.from('chat_group_members').delete().eq('group_id', g.id).eq('user_id', b.dataset.rm)); closeModal(); after(); } catch (e) { toast(errMsg(e), 'err'); }
      }));
      $$('[data-mgr]', w).forEach((b) => (b.onclick = async () => {
        try { await q(sb.from('chat_group_members').update({ is_manager: !!b.dataset.v }).eq('group_id', g.id).eq('user_id', b.dataset.mgr)); closeModal(); after(); } catch (e) { toast(errMsg(e), 'err'); }
      }));
      $('#addQ', w) && ($('#addQ', w).oninput = (e) => { const s = e.target.value.toLowerCase().trim(); $$('#addL .kid-opt', w).forEach((l) => (l.hidden = s && !l.dataset.name.includes(s))); });
      const add = async (ids) => {
        ids = ids.filter((x) => !inIds.has(x));
        if (!ids.length) return toast('Aucune nouvelle personne à ajouter', 'info');
        try { await q(sb.from('chat_group_members').insert(ids.map((user_id) => ({ group_id: g.id, user_id, club_id: S.club.id })))); toast(`${ids.length} personne${ids.length > 1 ? 's' : ''} ajoutée${ids.length > 1 ? 's' : ''}`); closeModal(); after(); }
        catch (e) { toast(errMsg(e), 'err'); }
      };
      $('#addGo', w) && ($('#addGo', w).onclick = () => add($$('#addL input:checked', w).map((i) => i.value)));
      $('#syncTeam', w) && ($('#syncTeam', w).onclick = async () => {
        const ids = await q(sb.rpc('team_people', { p_team: g.team_id })).catch(() => []);
        add((ids || []).map((x) => (typeof x === 'string' ? x : x.team_people)));
      });
    } });
}

// ---------------------------------------------------------------- supprimer un club (administrateurs uniquement)
export function deleteClubDialog(club, after) {
  modal({ title: 'Supprimer définitivement ce club', body: `<p class="lead">Toutes les données de <b>${esc(club.name)}</b> seront effacées : équipes, joueurs, familles, matchs, groupes et messages, documents, cotisations. Les membres perdront l’accès à ce club (leur compte reste actif). <b>Impossible de revenir en arrière.</b></p>
    ${formHTML([{ name: 'confirm', label: `Pour confirmer, écris le nom du club : ${club.name}`, required: true }])}`,
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Supprimer le club', cls: 'danger', run: async (w) => {
      if (readForm(w).confirm.trim().toLowerCase() !== club.name.trim().toLowerCase()) throw new Error('Le nom ne correspond pas');
      const gone = await q(sb.from('clubs').delete().eq('id', club.id).select('id'));
      if (!gone?.length) throw new Error('Seul un administrateur du club peut le supprimer');
      if (S.club?.id === club.id) { S.club = null; try { localStorage.removeItem('cm_club'); } catch {} }
      toast('Club supprimé');
      if (after) { await loadMemberships(); after(); } else setTimeout(() => location.replace(location.pathname), 600);
    } }] });
}

// ---------------------------------------------------------------- gestion des comptes
const missingFn = (e) => /Could not find the function|PGRST202|does not exist/i.test(e?.message || '');
const NOT_READY = 'Cette action doit d’abord être activée dans la base (voir le message de Claude).';

// Modifier un membre du club (administrateur du club)
export function editMemberDialog(m, after) {
  modal({ title: `Modifier ${m.full_name || 'ce membre'}`, body: formHTML([
      { name: 'full_name', label: 'Prénom et nom', required: true, value: m.full_name },
      { name: 'phone', label: 'Téléphone', type: 'tel', value: m.phone || '' },
    ]) + `<p class="muted small">Email : ${esc(m.email || '—')} · seul le membre (ou l’administrateur de la plateforme) peut changer son email.</p>`,
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      await q(sb.rpc('club_update_member', { p_club: S.club.id, p_user: m.id, p_full_name: v.full_name, p_phone: v.phone }));
      toast('Membre modifié'); after?.();
    } }] });
}
// Retirer un membre du club
export async function removeMember(m, after) {
  if (!(await confirmBox(`Retirer ${m.full_name || 'ce membre'} du club ? Son compte n’aura plus accès aux données du club (il n’est pas supprimé).`, { ok: 'Retirer du club' }))) return;
  try {
    try { await q(sb.rpc('club_remove_member', { p_club: S.club.id, p_user: m.id })); }
    catch (e) { if (!missingFn(e)) throw e; await q(sb.from('memberships').delete().eq('club_id', S.club.id).eq('user_id', m.id)); }
    toast('Membre retiré du club'); after?.();
  } catch (e) { toast(errMsg(e), 'err'); }
}

// Comptes de la plateforme (administrateur ClubManager)
const UA = { search: '' };
export async function platformUsers(el) {
  const [profiles, mems, clubs] = await Promise.all([
    q(sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000)),
    q(sb.from('memberships').select('user_id, club_id, role')),
    q(sb.from('clubs').select('id, name')),
  ]);
  const clubName = (id) => clubs.find((c) => c.id === id)?.name || '';
  const s = UA.search.toLowerCase().trim();
  const list = profiles.filter((p) => !s || `${p.full_name} ${p.email} ${p.phone || ''}`.toLowerCase().includes(s));
  const rolesOf = (id) => { const by = {}; mems.filter((m) => m.user_id === id).forEach((m) => (by[m.club_id] = [...(by[m.club_id] || []), ROLE_LABEL[m.role]])); return Object.entries(by); };
  el.innerHTML = `<div class="toolbar"><input type="search" id="uq" placeholder="Rechercher un nom, un email, un téléphone" value="${esc(UA.search)}" aria-label="Rechercher"><p class="muted">${list.length} compte${list.length > 1 ? 's' : ''}</p></div>
    ${list.length ? `<div class="card list">${list.map((p) => { const r = rolesOf(p.id); return `<div class="acct">
      ${avatar(p.full_name)}<div class="grow"><b>${esc(p.full_name || 'Sans nom')}${p.is_super_admin ? ' <span class="badge admin-badge">🛡️ Administrateur unique</span>' : ''}${p.id === S.user.id ? ' <span class="muted small">(toi)</span>' : ''}</b>
        <small>${esc(p.email || '')}${p.phone ? ' · ' + esc(p.phone) : ''} · inscrit ${fmt.date(p.created_at)}</small>
        <div class="chips">${r.length ? r.map(([cid, rl]) => `<span class="chip sm">${esc(clubName(cid))} · ${rl.join(', ')}</span>`).join('') : '<span class="muted small">Aucun club</span>'}</div></div>
      <div class="acct-actions"><button class="btn sm ghost" data-edit="${p.id}">✏️ Modifier</button>${p.id !== S.user.id && !p.is_super_admin ? `<button class="btn sm ghost danger-text" data-del="${p.id}">🗑</button>` : ''}</div></div>`; }).join('')}</div>`
      : empty('👥', 'Aucun compte trouvé')}`;
  const reload = () => platformUsers(el);
  let t; $('#uq', el).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { UA.search = e.target.value; reload().then(() => { const i = $('#uq', el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };
  $$('[data-edit]', el).forEach((b) => (b.onclick = () => { const p = profiles.find((x) => x.id === b.dataset.edit);
    modal({ title: 'Modifier le compte', body: formHTML([
        { name: 'full_name', label: 'Prénom et nom', required: true, value: p.full_name },
        { name: 'email', label: 'Email de connexion', type: 'email', required: true, value: p.email },
        { name: 'phone', label: 'Téléphone', type: 'tel', value: p.phone || '' },
      ]) + '<button class="btn ghost block mt" id="resetPwd">🔑 Envoyer un lien pour choisir un nouveau mot de passe</button>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
        const v = readForm(w);
        await q(sb.rpc('admin_update_user', { p_user: p.id, p_full_name: v.full_name, p_phone: v.phone, p_email: v.email }));
        if (p.id === S.user.id) Object.assign(S.profile, { full_name: v.full_name, phone: v.phone });
        toast('Compte modifié'); reload();
      } }],
      onOpen: (w) => ($('#resetPwd', w).onclick = async () => {
        const { error } = await sb.auth.resetPasswordForEmail(p.email, { redirectTo: location.origin + location.pathname });
        toast(error ? errMsg(error) : `Lien envoyé à ${p.email}`, error ? 'err' : 'ok');
      }) });
  }));
  $$('[data-del]', el).forEach((b) => (b.onclick = () => { const p = profiles.find((x) => x.id === b.dataset.del);
    modal({ title: 'Supprimer ce compte', body: `<p class="lead">Le compte de <b>${esc(p.full_name || p.email)}</b> sera supprimé définitivement : il ne pourra plus se connecter et sera retiré de tous ses clubs. Les données des clubs (joueurs, matchs…) sont conservées.</p>
      ${formHTML([{ name: 'confirm', label: 'Pour confirmer, écris SUPPRIMER', required: true }])}`,
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Supprimer le compte', cls: 'danger', run: async (w) => {
        if (readForm(w).confirm.trim().toUpperCase() !== 'SUPPRIMER') throw new Error('Écris SUPPRIMER pour confirmer');
        try { await q(sb.rpc('admin_delete_user', { p_user: p.id })); } catch (e) { throw new Error(missingFn(e) ? NOT_READY : errMsg(e)); }
        toast('Compte supprimé'); reload();
      } }] });
  }));
}

// Supprimer mon propre compte
export function deleteMyAccount() {
  modal({ title: 'Supprimer mon compte', body: `<p class="lead">Ton compte sera supprimé définitivement : tu ne pourras plus te connecter et tu seras retiré de tous tes clubs. <b>Impossible de revenir en arrière.</b></p>
    ${formHTML([{ name: 'confirm', label: 'Pour confirmer, écris SUPPRIMER', required: true }])}`,
    actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Supprimer mon compte', cls: 'danger', run: async (w) => {
      if (readForm(w).confirm.trim().toUpperCase() !== 'SUPPRIMER') throw new Error('Écris SUPPRIMER pour confirmer');
      try { await q(sb.rpc('delete_my_account')); } catch (e) { throw new Error(missingFn(e) ? NOT_READY : errMsg(e)); }
      try { localStorage.clear(); } catch {}
      await sb.auth.signOut(); toast('Ton compte a été supprimé'); setTimeout(() => location.replace(location.pathname), 500);
    } }] });
}

// ---------------------------------------------------------------- tableau de bord de l'administrateur (lui seul)
export async function platformHome(el) {
  if (!role.sa()) { location.hash = '#/'; return; }
  const [o, st] = await Promise.all([q(sb.rpc('platform_overview')), q(sb.rpc('platform_stats'))]);
  const max = Math.max(1, ...st.weeks.map((w) => w.users));
  const R = { admin: 'Responsables', coach: 'Entraîneurs', parent: 'Parents', player: 'Joueurs', volunteer: 'Bénévoles' };
  const alerts = [
    st.pending_apps ? `<a class="alert-row" href="#/admin/apps"><span>📥</span><b>${st.pending_apps} club${st.pending_apps > 1 ? 's attendent' : ' attend'} ta validation</b><span class="chev-r">›</span></a>` : '',
    st.open_reports ? `<a class="alert-row bad" href="#/admin/reports"><span>🚩</span><b>${st.open_reports} signalement${st.open_reports > 1 ? 's' : ''} à traiter</b><span class="chev-r">›</span></a>` : '',
  ].join('');
  el.innerHTML = `<section class="admin-hero"><div><p class="admin-kicker">🛡️ Compte administrateur unique</p><h2>Bonjour ${esc((S.profile?.full_name || '').split(' ')[0])}</h2>
      <p>Tu es le seul à voir cet espace. Tout ClubManager se pilote d’ici.</p></div><span class="admin-crest" aria-hidden="true">🛡️</span></section>
    ${alerts ? `<div class="card alerts">${alerts}</div>` : '<div class="notice">✅ Rien en attente : aucune demande de club ni aucun signalement.</div>'}
    <div class="kpis">
      ${[['🏟️', o.clubs, 'Clubs', `${st.clubs_30} ce mois-ci`, '#/admin/clubs'], ['👥', o.users, 'Comptes', `+${st.users_7} cette semaine`, '#/admin/users'], ['🏃', o.players, 'Joueurs', 'licenciés actifs', ''],
         ['📅', st.activities_7, 'Activités créées', '7 derniers jours', ''], ['💬', st.messages_7, 'Messages', '7 derniers jours', ''], ['💎', `${o.plans.standard || 0} / ${o.plans.premium || 0}`, 'Standard / Premium', 'offres payantes', '#/admin/clubs']]
        .map(([e, v, l, s, h]) => `<${h ? `a href="${h}"` : 'div'} class="kpi"><span class="kpi-e">${e}</span><b>${v}</b><small>${l}</small><small class="kpi-sub">${s}</small></${h ? 'a' : 'div'}>`).join('')}</div>
    <div class="grid2">
      <section class="card"><div class="card-head"><h3>📈 Nouveaux comptes</h3><small class="muted">8 dernières semaines</small></div>
        <div class="bars">${st.weeks.map((w) => `<div class="bar-col" title="${w.users} compte(s), ${w.clubs} club(s)"><span class="bar-v">${w.users || ''}</span><div class="bar" style="height:${Math.round((w.users / max) * 100)}%"></div><small>${new Date(w.w).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small></div>`).join('')}</div></section>
      <section class="card"><div class="card-head"><h3>🧩 Qui utilise ClubManager</h3></div>
        ${Object.keys(R).map((k) => { const n = st.roles[k] || 0, tot = Math.max(1, ...Object.values(st.roles)); return `<div class="meter-row"><span>${R[k]}</span><div class="meter"><div style="width:${(n / tot) * 100}%"></div></div><b>${n}</b></div>`; }).join('')}
        <h4>🏆 Clubs les plus actifs</h4>${st.top_clubs.length ? `<ol class="top-list">${st.top_clubs.map((c) => `<li><span>${esc(c.name)}</span><b>${c.members} membre${c.members > 1 ? 's' : ''}</b></li>`).join('')}</ol>` : '<p class="muted">Aucun club pour l’instant.</p>'}</section>
    </div>
    <section class="card"><div class="card-head"><h3>⚡ Actions de l’administrateur</h3></div>
      <div class="sheet-grid admin-actions">
        <a class="sheet-item" href="#/admin/apps"><span class="big">🏟️</span><span>Créer ou valider un club</span></a>
        <a class="sheet-item" href="#/admin/annonce"><span class="big">📣</span><span>Envoyer une annonce à tous</span></a>
        <button class="sheet-item" id="expU"><span class="big">⬇️</span><span>Exporter les comptes</span></button>
        <button class="sheet-item" id="expC"><span class="big">⬇️</span><span>Exporter les clubs</span></button>
        <a class="sheet-item" href="#/admin/settings"><span class="big">🔧</span><span>Inscriptions et offres</span></a>
        <a class="sheet-item" href="#/admin/log"><span class="big">📜</span><span>Journal d’activité</span></a>
      </div></section>`;
  $('#expU', el).onclick = () => downloadCSV('clubmanager-comptes.csv', [['Nom', 'Email', 'Clubs', 'Inscrit le'], ...o.user_list.map((u) => [u.full_name, u.email, u.clubs, fmt.date(u.created_at)])]);
  $('#expC', el).onclick = () => downloadCSV('clubmanager-clubs.csv', [['Club', 'Sport', 'Ville', 'Offre', 'Statut', 'Membres', 'Joueurs', 'Créé le'], ...o.club_list.map((c) => [c.name, c.sport, c.city, c.plan, c.status, c.members, c.players, fmt.date(c.created_at)])]);
}

// ---------------------------------------------------------------- annonce à toute la plateforme (administrateur seul)
export async function platformBroadcast(el) {
  if (!role.sa()) { location.hash = '#/'; return; }
  el.innerHTML = `<section class="card"><p class="lead">Envoie une notification à tous les membres de ClubManager, ou seulement aux responsables de club. Elle s’affiche dans leur cloche 🔔 et sur leur téléphone si les notifications sont activées.</p>
    ${formHTML([
      { name: 'target', label: 'Destinataires', type: 'select', options: [['admins', '🏛️ Les responsables de club'], ['all', '👥 Tous les membres']], value: 'admins' },
      { name: 'title', label: 'Titre', required: true, placeholder: 'Ex. : Nouvelle fonction disponible' },
      { name: 'body', label: 'Message', type: 'textarea', rows: 5, placeholder: 'Ex. : Vous pouvez maintenant créer des groupes de discussion dans Messages.' },
    ])}
    <div class="row end mt"><button class="btn primary" id="send">📣 Envoyer l’annonce</button></div></section>`;
  $('#send', el).onclick = async () => {
    const v = readForm(el);
    if (!v.title?.trim()) return toast('Ajoute un titre', 'err');
    if (!(await confirmBox(`Envoyer « ${v.title} » à ${v.target === 'all' ? 'tous les membres' : 'tous les responsables de club'} ?`, { ok: 'Envoyer', danger: false }))) return;
    try { const n = await q(sb.rpc('platform_broadcast', { p_title: v.title, p_body: v.body || null, p_target: v.target })); toast(`Annonce envoyée à ${n} personne${n > 1 ? 's' : ''} ✅`); location.hash = '#/admin/home'; }
    catch (e) { toast(errMsg(e), 'err'); }
  };
}
