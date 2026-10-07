// ClubManager — familles : parents / responsables légaux et enfants
import { sb, S, role, esc, $, $$, fmt, toast, modal, closeModal, confirmBox, formHTML, readForm, errMsg, q, empty, avatar, badge, fullName, waLink, appUrl } from './core.js';
import { setTitle } from './app.js';
import { loadPlayers, playerSheet } from './views.js';

export const RELATIONS = ['Mère', 'Père', 'Parent', 'Tuteur / tutrice', 'Grand-parent', 'Beau-parent', 'Frère / sœur majeur', 'Autre'];
const teamName = (id) => S.teams.find((t) => t.id === id)?.name || '';
const cName = (c) => `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`;

export async function loadFamilies() {
  const [contacts, links] = await Promise.all([
    q(sb.from('family_contacts').select('*').eq('club_id', S.club.id).order('last_name', { nullsFirst: false }).order('first_name')),
    q(sb.from('family_links').select('contact_id, player_id').eq('club_id', S.club.id)),
  ]);
  return { contacts, links };
}

// ---------------------------------------------------------------- page « Familles »
const FA = { search: '', filter: '' };
export async function families(el) {
  setTitle('Familles');
  const [{ contacts, links }, players] = await Promise.all([loadFamilies(), loadPlayers(true)]);
  const rq = await familyRequestsBlock(players);
  const kidsOf = (cid) => links.filter((l) => l.contact_id === cid).map((l) => players.find((p) => p.id === l.player_id)).filter(Boolean);
  const parentsOf = (pid) => links.filter((l) => l.player_id === pid).map((l) => contacts.find((c) => c.id === l.contact_id)).filter(Boolean);
  const orphans = players.filter((p) => !parentsOf(p.id).length);
  const minors = orphans.filter((p) => !p.birth_date || (fmt.age(p.birth_date) ?? 0) < 18);
  const s = FA.search.toLowerCase();
  const list = contacts.filter((c) => {
    if (FA.filter === 'noaccount' && c.user_id) return false;
    if (FA.filter === 'account' && !c.user_id) return false;
    if (!s) return true;
    return `${cName(c)} ${c.email || ''} ${c.phone || ''} ${kidsOf(c.id).map(fullName).join(' ')}`.toLowerCase().includes(s);
  });

  el.innerHTML = `${rq.html}<div class="kpis small"><div class="kpi"><b>${contacts.length}</b><small>Parents et responsables</small></div>
      <div class="kpi"><b>${contacts.filter((c) => c.user_id).length}</b><small>Ont l'appli</small></div>
      <div class="kpi"><b>${players.length - orphans.length} / ${players.length}</b><small>Joueurs avec un parent</small></div></div>
    ${minors.length ? `<div class="notice">👶 <b>${minors.length} joueur${minors.length > 1 ? 's' : ''}</b> sans parent enregistré : ${minors.slice(0, 6).map((p) => `<button class="link" data-addfor="${p.id}">${esc(fullName(p))}</button>`).join(', ')}${minors.length > 6 ? '…' : ''}</div>` : ''}
    <div class="toolbar"><input type="search" id="fs" placeholder="Rechercher un parent ou un enfant" value="${esc(FA.search)}" aria-label="Rechercher">
      <div class="row gap wrap"><button class="btn wa" id="waGroup">${WA_ICON} Via WhatsApp</button><button class="btn ghost" id="impFam">📇 Importer</button><button class="btn primary" id="newFam">＋ Parent</button></div></div>
    <div class="filters">${[['', 'Tous'], ['noaccount', 'Sans l’appli'], ['account', 'Avec l’appli']].map(([k, l]) => `<button class="chip ${FA.filter === k ? 'on' : ''}" data-ff="${k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="card">${list.map((c) => {
      const kids = kidsOf(c.id);
      return `<div class="member fam-row" data-fam="${c.id}" role="button" tabindex="0">${avatar(cName(c))}<div class="grow">
        <b>${esc(cName(c))} <span class="muted small">· ${esc(c.relation)}</span></b>
        <small>${[c.phone, c.email].filter(Boolean).map(esc).join(' · ') || 'Pas de coordonnées'}</small>
        <div class="chips">${kids.map((k) => `<span class="chip sm kid">${esc(k.first_name)}${k.team_id ? ` · ${esc(teamName(k.team_id))}` : ''}</span>`).join('') || '<span class="muted small">Aucun enfant relié</span>'}</div></div>
        <div class="col-actions">${c.user_id ? badge('A l’appli', 'ok') : `<button class="btn sm ghost" data-invfam="${c.id}">🔗 Inviter</button>`}
          ${c.emergency ? badge('Urgence', 'bad') : ''}</div></div>`;
    }).join('')}</div>`
    : empty('👨‍👩‍👧', contacts.length ? 'Aucun résultat' : 'Aucune famille enregistrée', 'Ajoute les parents et responsables légaux, relie-les à leurs enfants, puis envoie-leur un lien pour qu’ils suivent tout dans l’appli.')}`;

  const fs = $('#fs', el);
  fs.oninput = () => { FA.search = fs.value; clearTimeout(fs._t); fs._t = setTimeout(() => families(el).then(() => { const n = $('#fs', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 250); };
  $$('[data-ff]', el).forEach((b) => (b.onclick = () => { FA.filter = b.dataset.ff; families(el); }));
  const reload = () => families(el);
  $('#newFam', el).onclick = () => contactForm({}, [], reload);
  $('#waGroup', el).onclick = () => groupInvite('parent');
  $('#impFam', el).onclick = () => importContacts(reload);
  $$('[data-rqok]', el).forEach((b) => (b.onclick = async () => {
    const v = $(`[data-rq="${b.dataset.rqok}"]`, el).value;
    if (!v) return toast('Choisis le joueur concerné', 'err');
    try { await q(sb.rpc('resolve_family_request', { p_id: b.dataset.rqok, p_player: v === '__new' ? null : v, p_create: v === '__new' })); toast('Enfant relié au parent ✓'); reload(); }
    catch (e) { toast(errMsg(e), 'err'); }
  }));
  $$('[data-rqno]', el).forEach((b) => (b.onclick = async () => { if (await confirmBox('Refuser cette demande ?', { ok: 'Refuser' })) { await q(sb.from('family_requests').update({ status: 'rejected' }).eq('id', b.dataset.rqno)); reload(); } }));
  $$('[data-addfor]', el).forEach((b) => (b.onclick = () => contactForm({}, [b.dataset.addfor], reload)));
  $$('[data-fam]', el).forEach((r) => {
    const open = (e) => { if (e.target.closest('button')) return; const c = contacts.find((x) => x.id === r.dataset.fam); contactSheet(c, kidsOf(c.id), reload); };
    r.onclick = open; r.onkeydown = (e) => { if (e.key === 'Enter') open(e); };
  });
  $$('[data-invfam]', el).forEach((b) => (b.onclick = () => inviteFamily(contacts.find((x) => x.id === b.dataset.invfam), kidsOf(b.dataset.invfam))));
}

// ---------------------------------------------------------------- fiche parent
function contactSheet(c, kids, after) {
  modal({ title: cName(c), wide: true, body: `<div class="player-head">${avatar(cName(c), null, 'xl')}<div>
      <p>${badge(c.relation)} ${c.user_id ? badge('A l’appli', 'ok') : badge('Pas encore sur l’appli')} ${c.emergency ? badge('Contact d’urgence', 'bad') : ''}</p>
      <p>${c.phone ? `📞 <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · <a target="_blank" rel="noopener" href="${waLink('', c.phone)}">WhatsApp</a><br>` : ''}${c.email ? `✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>` : ''}${c.address ? `📍 ${esc(c.address)}` : ''}</p></div></div>
    <h4>👧 Enfants</h4>${kids.length ? `<div class="list">${kids.map((k) => `<button class="list-row" data-kid="${k.id}">${avatar(fullName(k), k.photo_url)}<span class="grow"><b>${esc(fullName(k))}</b><small>${esc(teamName(k.team_id) || 'Sans équipe')}${k.birth_date ? ` · ${fmt.age(k.birth_date)} ans` : ''}</small></span></button>`).join('')}</div>` : '<p class="muted">Aucun enfant relié.</p>'}
    <p class="muted small mt">${c.can_pickup ? '✅ Autorisé à récupérer les enfants' : '⛔ Non autorisé à récupérer les enfants'}</p>
    ${c.notes ? `<h4>📝 Notes</h4><p class="pre">${esc(c.notes)}</p>` : ''}`,
  actions: [
    ...(role.admin() ? [{ label: 'Supprimer', cls: 'ghost danger-text', run: async () => {
      if (!(await confirmBox(`Supprimer ${cName(c)} de la liste des familles ?${c.user_id ? ' Son compte perdra l’accès aux informations de ses enfants.' : ''}`, { ok: 'Supprimer' }))) return false;
      if (c.user_id) await sb.from('guardians').delete().eq('user_id', c.user_id).in('player_id', kids.map((k) => k.id));
      await q(sb.from('family_contacts').delete().eq('id', c.id)); toast('Parent supprimé'); after?.();
    } }] : []),
    ...(!c.user_id ? [{ label: '🔗 Inviter', cls: 'ghost', run: () => { inviteFamily(c, kids); return false; } }] : []),
    { label: '✏️ Modifier', cls: 'primary', run: () => { contactForm(c, kids.map((k) => k.id), after); return false; } },
  ],
  onOpen: (w) => $$('[data-kid]', w).forEach((b) => (b.onclick = () => playerSheet(kids.find((k) => k.id === b.dataset.kid), after))) });
}

// ---------------------------------------------------------------- ajout / modification d'un parent
export async function contactForm(c = {}, kidIds = [], after) {
  const players = await loadPlayers();
  const sel = new Set(kidIds);
  const w = modal({ title: c.id ? 'Modifier le parent' : 'Ajouter un parent', wide: true, body: formHTML([
      { name: 'first_name', label: 'Prénom', required: true, col: 2 }, { name: 'last_name', label: 'Nom', col: 2 },
      { name: 'relation', label: 'Lien avec l’enfant', type: 'select', options: RELATIONS, value: c.relation || 'Parent', col: 2 },
      { name: 'phone', label: 'Téléphone', type: 'tel', col: 2 }, { name: 'email', label: 'Email', type: 'email', col: 2 },
      { name: 'address', label: 'Adresse', col: 2 },
      { name: 'emergency', label: 'Contact en cas d’urgence', type: 'checkbox', col: 2 },
      { name: 'can_pickup', label: 'Autorisé à récupérer les enfants', type: 'checkbox', value: c.can_pickup ?? true, col: 2 },
      { name: 'notes', label: 'Notes (visibles par l’encadrement)', type: 'textarea', rows: 2 },
    ], c) + `<h3 class="form-section">Ses enfants au club</h3>
    <input type="search" id="kidSearch" placeholder="Rechercher un joueur" aria-label="Rechercher un joueur" class="mt">
    <div class="kid-pick" id="kidPick">${players.map((p) => `<label class="kid-opt" data-name="${esc(fullName(p).toLowerCase())}"><input type="checkbox" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}>
      ${avatar(fullName(p), p.photo_url, 'sm')}<span class="grow"><b>${esc(fullName(p))}</b><small>${esc(teamName(p.team_id) || 'Sans équipe')}</small></span></label>`).join('') || '<p class="muted">Ajoute d’abord des joueurs.</p>'}</div>`,
  actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', run: async (w) => {
    const v = readForm($('form', w));
    const kids = $$('#kidPick input:checked', w).map((i) => i.value);
    let id = c.id;
    if (id) await q(sb.from('family_contacts').update(v).eq('id', id));
    else id = (await q(sb.from('family_contacts').insert({ ...v, club_id: S.club.id }).select('id').single())).id;
    const before = new Set(kidIds);
    const add = kids.filter((k) => !before.has(k)), remove = kidIds.filter((k) => !kids.includes(k));
    if (add.length) await q(sb.from('family_links').insert(add.map((p) => ({ contact_id: id, player_id: p, club_id: S.club.id }))));
    if (remove.length) {
      await q(sb.from('family_links').delete().eq('contact_id', id).in('player_id', remove));
      if (c.user_id) await sb.from('guardians').delete().eq('user_id', c.user_id).in('player_id', remove);
    }
    toast(c.id ? 'Parent modifié' : 'Parent ajouté'); after?.();
  } }] });
  const ks = $('#kidSearch', w);
  ks.oninput = () => { const t = ks.value.toLowerCase(); $$('.kid-opt', w).forEach((o) => (o.hidden = t && !o.dataset.name.includes(t))); };
}

// ---------------------------------------------------------------- invitation d'un parent (relie tous ses enfants)
export async function inviteFamily(c, kids) {
  try {
    const inv = await q(sb.from('invites').insert({ club_id: S.club.id, role: 'parent', contact_id: c.id, label: cName(c), max_uses: 3, created_by: S.user.id }).select().single());
    const link = `${location.origin}${location.pathname}#/rejoindre/${inv.code}`;
    const names = kids.map((k) => k.first_name).join(', ');
    const msg = `Bonjour ${c.first_name} ! ${S.club.name} utilise ClubManager pour les convocations, le calendrier et les infos du club${names ? ` (${names})` : ''}. Crée ton compte ici : ${link}`;
    modal({ title: `Inviter ${cName(c)}`, body: `<p class="lead">En créant son compte avec ce lien, ${esc(c.first_name)} verra automatiquement ${kids.length ? `<b>${esc(names)}</b>` : 'ses enfants'} : convocations, calendrier, cotisations et messages.</p>
      <div class="invite-box"><small>Code</small><b class="code">${inv.code}</b><input readonly value="${esc(link)}" aria-label="Lien d'invitation">
      <div class="row gap wrap"><button class="btn sm primary" id="cpf">📋 Copier le message</button>
      ${c.phone ? `<a class="btn sm ghost" href="sms:${esc(c.phone)}?&body=${encodeURIComponent(msg)}">SMS</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(c.phone.replace(/\D/g, '').replace(/^0/, '33'))}?text=${encodeURIComponent(msg)}">WhatsApp</a>`
        : `<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>`}
      ${c.email ? `<a class="btn sm ghost" href="mailto:${esc(c.email)}?subject=${encodeURIComponent(S.club.name + ' sur ClubManager')}&body=${encodeURIComponent(msg)}">Email</a>` : ''}</div>
      <small class="muted">Valable 30 jours.</small></div>`,
      actions: [{ label: 'Terminé', cls: 'primary' }],
      onOpen: (w) => { $('#cpf', w).onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Message copié')); } });
  } catch (e) { toast(errMsg(e), 'err'); }
}

// Bloc « Parents » dans la fiche joueur
export async function playerFamilyBlock(p) {
  if (!role.staff()) return '';
  const links = await q(sb.from('family_links').select('contact_id').eq('player_id', p.id));
  const contacts = links.length ? await q(sb.from('family_contacts').select('*').in('id', links.map((l) => l.contact_id))) : [];
  return `<h4>👨‍👩‍👧 Parents et responsables</h4>${contacts.length ? contacts.map((c) => `<div class="hist"><span class="grow"><b>${esc(cName(c))}</b> <small class="muted">${esc(c.relation)}${c.phone ? ` · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}</small></span>${c.user_id ? badge('Appli', 'ok') : ''}${c.emergency ? badge('Urgence', 'bad') : ''}</div>`).join('')
    : '<p class="muted small">Aucun parent enregistré.</p>'}<button class="btn sm ghost mt" data-addparent="${p.id}">＋ Ajouter un parent</button>`;
}

// Espace parent : « Mes enfants »
export async function myChildrenBlock() {
  const kids = await q(sb.from('guardians').select('player_id').eq('user_id', S.user.id).eq('club_id', S.club.id));
  if (!kids.length) return '';
  const players = await q(sb.from('players').select('*').in('id', kids.map((k) => k.player_id)));
  return `<section class="card"><div class="card-head"><h3>👧 Mes enfants</h3></div><div class="list">${players.map((p) => `<button class="list-row" data-mykid="${p.id}">${avatar(fullName(p), p.photo_url)}<span class="grow"><b>${esc(fullName(p))}</b>
    <small>${esc(teamName(p.team_id) || 'Sans équipe')}${p.jersey ? ` · n°${esc(p.jersey)}` : ''}${p.birth_date ? ` · ${fmt.age(p.birth_date)} ans` : ''}</small></span></button>`).join('')}</div></section>`;
}

// ---------------------------------------------------------------- WhatsApp : lien de groupe
const GROUP_ROLES = { parent: ['👨‍👩‍👧 Parents', 'parents'], player: ['🏃 Joueurs adultes', 'joueurs'], volunteer: ['🙋 Bénévoles', 'bénévoles'], coach: ['🧑‍🏫 Entraîneurs', 'entraîneurs'] };
export function groupInvite(defaultRole = 'parent') {
  const roles = Object.keys(GROUP_ROLES).filter((r) => r !== 'coach' || role.admin());
  modal({ title: 'Ajouter des personnes via WhatsApp', wide: true,
    body: `<p class="lead">Crée un lien unique et poste-le dans le groupe WhatsApp de l'équipe ou du club : chaque personne qui le touche crée son compte et rejoint ${esc(S.club.name)}.</p>
      <div class="chips" id="grRole">${roles.map((r) => `<button class="chip ${r === defaultRole ? 'on' : ''}" data-r="${r}">${GROUP_ROLES[r][0]}</button>`).join('')}</div>
      <p class="muted small" id="grHint"></p><div id="grOut"></div>`,
    actions: [{ label: 'Fermer', cls: 'ghost' }, { label: 'Créer le lien', cls: 'primary', run: async (w) => {
      const r = $('#grRole .on', w).dataset.r;
      const inv = await q(sb.from('invites').insert({ club_id: S.club.id, role: r, is_group: true, label: `Groupe WhatsApp — ${GROUP_ROLES[r][1]}`, max_uses: 500,
        expires_at: new Date(Date.now() + 90 * 864e5).toISOString(), created_by: S.user.id }).select().single());
      const link = appUrl(`#/rejoindre/${inv.code}`);
      const msg = r === 'parent'
        ? `📣 ${S.club.name} passe sur ClubManager !\nConvocations, calendrier, infos du club : tout au même endroit.\n\n👉 Crée ton compte ici : ${link}\n\nUne fois inscrit, indique le nom de ton ou tes enfants, le club validera.`
        : `📣 ${S.club.name} sur ClubManager\n👉 Rejoins l'espace ${GROUP_ROLES[r][1]} ici : ${link}`;
      $('#grOut', w).innerHTML = `<div class="invite-box"><small>Lien de groupe — valable 90 jours</small><input readonly value="${esc(link)}" aria-label="Lien de groupe"><p class="pre small">${esc(msg)}</p>
        <div class="row gap wrap"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(msg)}">${WA_ICON} Partager sur WhatsApp</a><button class="btn sm ghost" id="grCp">📋 Copier</button>
        ${navigator.share ? '<button class="btn sm ghost" id="grSh">Partager…</button>' : ''}</div></div>`;
      $('#grCp', w).onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Message copié'));
      $('#grSh', w) && ($('#grSh', w).onclick = () => navigator.share({ text: msg }).catch(() => {}));
      return false;
    } }],
    onOpen: (w) => {
      const hint = () => { const r = $('#grRole .on', w).dataset.r; $('#grHint', w).textContent = r === 'parent' ? 'Les parents indiqueront ensuite le nom de leurs enfants ; tu valides le lien dans « Familles ».' : r === 'coach' ? 'Les entraîneurs auront accès aux équipes, joueurs et convocations.' : ''; };
      $$('[data-r]', w).forEach((b) => (b.onclick = () => { $$('[data-r]', w).forEach((x) => x.classList.remove('on')); b.classList.add('on'); hint(); $('#grOut', w).innerHTML = ''; })); hint();
    } });
}
export const WA_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.6 2 1.1 1 2 1.3 2.3 1.4.3.2.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.2 1.4z"/></svg>';

// ---------------------------------------------------------------- parent : relier ses enfants
export function linkChildForm(after) {
  modal({ title: 'Relier mon enfant', wide: true, body: `<p class="lead">Indique ton enfant inscrit au club. Le club vérifie et relie son profil à ton compte : tu verras ensuite ses convocations et son calendrier.</p>` + formHTML([
      { name: 'child_first_name', label: 'Prénom de l’enfant', required: true, col: 2 }, { name: 'child_last_name', label: 'Nom de l’enfant', col: 2 },
      { name: 'child_birth_date', label: 'Date de naissance', type: 'date', col: 2 },
      { name: 'team_id', label: 'Équipe', type: 'select', options: [['', 'Je ne sais pas'], ...S.teams.map((t) => [t.id, t.name])], col: 2 },
      { name: 'relation', label: 'Je suis', type: 'select', options: RELATIONS, value: 'Parent', col: 2 },
      { name: 'phone', label: 'Mon téléphone (WhatsApp)', type: 'tel', value: S.profile?.phone || '', col: 2 },
    ]), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Envoyer', cls: 'primary', run: async (w) => {
      const v = readForm(w);
      await q(sb.from('family_requests').insert({ ...v, team_id: v.team_id || null, club_id: S.club.id, user_id: S.user.id, parent_name: S.profile?.full_name }));
      toast('Demande envoyée au club'); after?.();
    } }] });
}
export async function parentLinkCard() {
  const reqs = await q(sb.from('family_requests').select('*').eq('club_id', S.club.id).eq('user_id', S.user.id).eq('status', 'pending')).catch(() => []);
  return `<section class="card link-card"><div class="card-head"><h3>👧 Relie tes enfants</h3></div>
    ${reqs.length ? `<p class="muted">En attente de validation par le club :</p><div class="chips">${reqs.map((r) => `<span class="chip">${esc(r.child_first_name)} ${esc(r.child_last_name || '')}</span>`).join('')}</div>`
      : '<p class="muted">Pour recevoir les convocations et suivre le calendrier, indique ton ou tes enfants inscrits au club.</p>'}
    <button class="btn primary mt" id="linkChild">＋ Ajouter un enfant</button></section>`;
}

// ---------------------------------------------------------------- import de contacts (téléphone ou fichier .vcf)
function parseVcf(txt) {
  return txt.split(/END:VCARD/i).map((card) => {
    const get = (k) => (card.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, 'im')) || [])[1]?.trim();
    const fn = get('FN') || (get('N') || '').split(';').slice(0, 2).reverse().join(' ').trim();
    return { name: fn, tel: get('TEL'), email: get('EMAIL') };
  }).filter((c) => c.name);
}
export function importContacts(after) {
  const picker = 'contacts' in navigator && 'select' in (navigator.contacts || {});
  modal({ title: 'Importer des contacts', body: `<p class="lead">Ajoute d'un coup les parents depuis ton téléphone.</p>
    ${picker ? '<button class="btn primary block" id="pick">📱 Choisir dans mes contacts</button><div class="or"><span>ou</span></div>' : ''}
    <label class="drop"><input type="file" accept=".vcf,text/vcard,text/x-vcard" id="vcf"><span>📇 Importer un fichier de contacts (.vcf)</span></label>
    <p class="muted small">Sur iPhone : ouvre un contact → « Partager le contact » → Enregistrer dans Fichiers, puis importe le fichier ici. Tu pourras relier chaque parent à ses enfants ensuite.</p><div id="impList"></div>`,
  onOpen: (w) => {
    const save = async (list) => {
      if (!list.length) return;
      const rows = list.map((c) => { const [first, ...rest] = c.name.trim().split(/\s+/); return { club_id: S.club.id, first_name: first, last_name: rest.join(' ') || null, phone: c.tel || null, email: c.email || null }; });
      try { await q(sb.from('family_contacts').insert(rows)); toast(`${rows.length} contact${rows.length > 1 ? 's' : ''} importé${rows.length > 1 ? 's' : ''}`); closeModal(); after?.(); }
      catch (e) { toast(errMsg(e), 'err'); }
    };
    $('#pick', w) && ($('#pick', w).onclick = async () => {
      try { const res = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
        save(res.map((c) => ({ name: c.name?.[0] || '', tel: c.tel?.[0], email: c.email?.[0] })).filter((c) => c.name)); } catch {}
    });
    $('#vcf', w).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const list = parseVcf(await f.text());
      if (!list.length) return toast('Aucun contact trouvé dans ce fichier', 'err');
      $('#impList', w).innerHTML = `<p><b>${list.length} contact(s) trouvé(s)</b> : ${list.slice(0, 8).map((c) => esc(c.name)).join(', ')}${list.length > 8 ? '…' : ''}</p><button class="btn primary block" id="doImp">Importer</button>`;
      $('#doImp', w).onclick = () => save(list); };
  } });
}

// ---------------------------------------------------------------- demandes des parents (côté club)
export async function familyRequestsBlock(players) {
  const reqs = await q(sb.from('family_requests').select('*').eq('club_id', S.club.id).eq('status', 'pending').order('created_at')).catch(() => []);
  if (!reqs.length) return { html: '', reqs };
  const norm = (x) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const guess = (r) => players.filter((p) => norm(p.first_name) === norm(r.child_first_name) && (!r.child_last_name || norm(p.last_name) === norm(r.child_last_name)));
  return { reqs, html: `<section class="card req-card"><div class="card-head"><h3>📲 Demandes des parents</h3>${badge(reqs.length, 'warn')}</div>
    ${reqs.map((r) => { const g = guess(r); return `<div class="member"><span class="emoji-box">👨‍👧</span><div class="grow">
      <b>${esc(r.parent_name || 'Un parent')}</b> <small class="muted">· ${esc(r.relation || 'Parent')}${r.phone ? ` · ${esc(r.phone)}` : ''}</small>
      <small>pour <b>${esc(r.child_first_name)} ${esc(r.child_last_name || '')}</b>${r.team_id ? ` · ${esc(teamName(r.team_id))}` : ''}${r.child_birth_date ? ` · né(e) le ${fmt.date(r.child_birth_date)}` : ''}</small>
      <div class="row gap wrap mt"><select data-rq="${r.id}" aria-label="Joueur" style="width:auto;max-width:100%">
        ${g.length ? '' : '<option value="">— Choisir le joueur —</option>'}${g.map((p) => `<option value="${p.id}">✓ ${esc(fullName(p))} (${esc(teamName(p.team_id) || 'sans équipe')})</option>`).join('')}
        ${players.filter((p) => !g.includes(p)).map((p) => `<option value="${p.id}">${esc(fullName(p))}</option>`).join('')}<option value="__new">＋ Créer ce joueur</option></select>
        <button class="btn sm primary" data-rqok="${r.id}">Valider</button><button class="btn sm ghost danger-text" data-rqno="${r.id}">Refuser</button></div></div></div>`; }).join('')}</section>` };
}
