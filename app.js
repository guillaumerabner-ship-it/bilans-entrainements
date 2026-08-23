const dialog = document.querySelector('#session-dialog');
const exerciseDialog = document.querySelector('#exercise-dialog');
const exerciseForm = document.querySelector('#exercise-form');
const exerciseList = document.querySelector('#exercise-list');
const exercisePreview = document.querySelector('#exercise-preview');
const exerciseLibrary = document.querySelector('#exercise-library');
const allSessionsPage = document.querySelector('#all-sessions');
const importDialog = document.querySelector('#import-dialog');
const importForm = document.querySelector('#import-form');
const calendarGrid = document.querySelector('#calendar-grid');
const workoutDialog = document.querySelector('#workout-dialog');
const exerciseProgressDialog = document.querySelector('#exercise-progress-dialog');
const settingsDialog = document.querySelector('#settings-dialog');
const volumeDialog = document.querySelector('#volume-dialog');
const trophyDialog = document.querySelector('#trophy-dialog');
const { buildSessionOverride, applySessionOverride, compactSessionOverride, effectiveSetValues, effectiveComment } = SessionSyncPriority;
const GOOGLE_OAUTH_CLIENT_ID = '538510396242-frqqtj211t5deppj6882pueubmvu4s7t.apps.googleusercontent.com';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxdazdZ5MnK2pbkBjAJkSMROPU3ZPVy0u4wU1WNk0eIuRtiJUNInEMgz5ke_TVxru_8/exec';
const AUTH_SESSION_KEY = 'training-app-google-session';
let authenticatedUser = null;
let activeStudentId = 'student-owner';
let coachAuthResult = null;

function authStatus(message, error = false) { const status = document.querySelector('#auth-status'); if (!status) return; status.textContent = message; status.classList.toggle('error', error); }
function currentGoogleCredential() { return parseStoredRaw(sessionStorage.getItem(AUTH_SESSION_KEY), null)?.credential || ''; }
async function verifyGoogleCredential(credential) {
  if (!credential) throw new Error('Google n’a pas transmis ton identité.');
  let result;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    const request = await fetch('/api/shared', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auth-login', credential }) });
    result = await request.json(); if (!request.ok) throw new Error(result.error || 'Compte non autorisé.');
  } else {
    const requestId = `auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    result = await sharedBridgeMessage(requestId, () => {
      const iframe = document.createElement('iframe'); iframe.name = requestId; iframe.dataset.sharedBridge = requestId; iframe.hidden = true; document.body.appendChild(iframe);
      const form = document.createElement('form'); form.method = 'POST'; form.action = APPS_SCRIPT_URL; form.target = requestId; form.dataset.sharedBridge = requestId; form.hidden = true;
      const fields = { payload: JSON.stringify({ action: 'auth-login', credential }), origin: location.origin, requestId };
      Object.entries(fields).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); }); document.body.appendChild(form); form.submit();
    });
  }
  if (!result?.ok) throw new Error(result?.error || 'Compte non autorisé.');
  return result;
}
async function initializeGoogleLogin() {
  const saved = parseStoredRaw(sessionStorage.getItem(AUTH_SESSION_KEY), null);
  if (saved?.credential && saved?.authResult?.user) {
    applyAuthenticatedUser(saved.authResult);
    authStatus('Session restaurée. Vérification discrète…');
    try {
      const result = await verifyGoogleCredential(saved.credential);
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ credential: saved.credential, authResult: result, savedAt: Date.now() }));
      applyAuthenticatedUser(result);
      return;
    } catch (error) { sessionStorage.removeItem(AUTH_SESSION_KEY); authenticatedUser = null; document.querySelector('.shell').hidden = true; document.querySelector('#coach-console').hidden = true; document.querySelector('#auth-gate').hidden = false; }
  } else if (saved?.credential) {
    authStatus('Restauration de ta session…');
    try {
      const result = await verifyGoogleCredential(saved.credential);
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ credential: saved.credential, authResult: result, savedAt: Date.now() }));
      applyAuthenticatedUser(result);
      return;
    } catch (error) { sessionStorage.removeItem(AUTH_SESSION_KEY); }
  }
  if (!window.google?.accounts?.id) { authStatus('Google ne répond pas. Vérifie ta connexion Internet puis recharge la page.', true); return; }
  google.accounts.id.initialize({ client_id: GOOGLE_OAUTH_CLIENT_ID, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: false });
  google.accounts.id.renderButton(document.querySelector('#google-signin-button'), { theme: 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', locale: 'fr', width: 320 });
  authStatus('Choisis ton compte Google autorisé.');
}
async function handleGoogleCredential(response) {
  authStatus('Vérification du compte…');
  try {
    const result = await verifyGoogleCredential(response?.credential);
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ credential: response.credential, authResult: result, savedAt: Date.now() }));
    applyAuthenticatedUser(result);
  } catch (error) { console.error('Connexion', error); authStatus(error.message || 'Connexion impossible.', true); }
}
function applyAuthenticatedUser(result) {
  authenticatedUser = result.user; activeStudentId = result.user.role === 'coach' ? (result.students[0]?.id || '') : result.user.id; document.querySelector('#auth-gate').hidden = true;
  const shell = document.querySelector('.shell'); const coachConsole = document.querySelector('#coach-console');
  if (result.user.role === 'coach') { shell.hidden = true; coachConsole.hidden = false; renderCoachConsole(result); }
  else { coachConsole.hidden = true; shell.hidden = false; const profile = document.querySelector('.profile'); if (profile) profile.innerHTML = `<span class="avatar">${escapeHtml((result.user.name || 'É').slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(result.user.name)}</strong><small>Élève</small></span><button type="button" class="more" data-auth-logout aria-label="Se déconnecter">↪</button>`; }
}
function renderCoachConsole(result) {
  coachAuthResult = result;
  document.querySelector('#coach-profile').textContent = `${result.user.name} · Coach`;
  const list = document.querySelector('#coach-student-list'); list.innerHTML = result.students.length ? result.students.map((student) => `<button type="button" class="coach-student-button" data-coach-student="${escapeHtml(student.id)}"><i>${escapeHtml((student.name || 'É').slice(0, 2).toUpperCase())}</i><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.email)}</small></span></button>`).join('') : '<div class="coach-empty"><strong>Aucun élève associé</strong></div>';
  if (result.students[0]) selectCoachStudent(result.students[0], result);
}
function selectCoachStudent(student, result) {
  activeStudentId = student.id;
  document.querySelectorAll('[data-coach-student]').forEach((button) => button.classList.toggle('active', button.dataset.coachStudent === student.id)); document.querySelector('#coach-title').innerHTML = `${escapeHtml(student.name)}<span class="accent">.</span>`;
  const sessions = getSessions().filter((session) => (session.studentId || 'student-owner') === student.id); const videos = videoRecords().filter((video) => (video.studentId || 'student-owner') === student.id); const completed = sessions.filter((session) => sessionCompletion(session).state === 'complete').length;
  const pendingVideos = videos.filter((video) => !video.status || video.status === 'coach-review'); const recentSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  document.querySelector('#coach-dashboard').innerHTML = `<div class="coach-overview"><article><span>SÉANCES PLANIFIÉES</span><strong>${sessions.length}</strong></article><article><span>SÉANCES TERMINÉES</span><strong>${completed}</strong></article><article><span>VIDÉOS À REVOIR</span><strong>${pendingVideos.length}</strong></article></div><div class="coach-actions"><button type="button" data-coach-open-calendar>Voir le calendrier</button><button type="button" data-coach-new-session>Créer une séance</button><button type="button" data-coach-open-videos>Bibliothèque vidéo</button></div><section class="coach-section"><div class="coach-section-title"><span>PROCHAINES ET DERNIÈRES SÉANCES</span><b>${sessions.length}</b></div><div class="coach-session-list">${recentSessions.length ? recentSessions.map((session) => `<button type="button" data-coach-session="${escapeHtml(session.id)}"><time>${new Date(`${session.date}T12:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</time><span><strong>${escapeHtml(session.name)}</strong><small>${session.exercises?.length || 0} exercice(s)</small></span><b>${sessionCompletion(session).state === 'complete' ? '✓' : '→'}</b></button>`).join('') : '<p class="coach-empty-line">Aucune séance disponible.</p>'}</div></section><section class="coach-section"><div class="coach-section-title"><span>VIDÉOS EN ATTENTE DE REVUE</span><b>${pendingVideos.length}</b></div><div class="coach-video-review">${pendingVideos.length ? pendingVideos.map(coachVideoReviewCard).join('') : '<p class="coach-empty-line">Toutes les vidéos ont été traitées.</p>'}</div></section>`;
  if (sharedBackendReady() && currentGoogleCredential()) loadSharedSnapshot();
}
function coachVideoReviewCard(video) { return `<article data-coach-video-card="${escapeHtml(video.id)}">${youtubePlayer(video.url, `${video.exerciseName} — ${video.date}`)}<div class="coach-video-meta"><strong>${escapeHtml(video.exerciseName || 'Exercice')}</strong><small>${escapeHtml(video.sessionName || '')} · ${new Date(`${video.date}T12:00`).toLocaleDateString('fr-FR')}</small></div><textarea data-coach-video-comment placeholder="Écrire un retour technique…">${escapeHtml(video.coachComment || '')}</textarea><div class="coach-review-actions"><button type="button" data-coach-video-status="approved">✓ Valider la vidéo</button><button type="button" data-coach-video-status="redo">↻ À refaire</button></div></article>`; }
function openCoachStudentWorkspace(target) { document.querySelector('#coach-console').hidden = true; document.querySelector('.shell').hidden = false; let bar = document.querySelector('#coach-context-bar'); if (!bar) { document.body.insertAdjacentHTML('beforeend', '<div id="coach-context-bar" class="coach-context-bar"><span>Mode coach · Guillaume</span><button type="button" data-coach-back>← Retour à la console</button></div>'); bar = document.querySelector('#coach-context-bar'); } bar.hidden = false; document.querySelector(target)?.scrollIntoView(); }
window.addEventListener('load', initializeGoogleLogin);
document.addEventListener('click', (event) => { if (event.target.closest('[data-auth-logout]')) { sessionStorage.removeItem(AUTH_SESSION_KEY); window.google?.accounts?.id?.disableAutoSelect(); location.reload(); } const studentButton = event.target.closest('[data-coach-student]'); if (studentButton && authenticatedUser) { const name = studentButton.querySelector('strong').textContent; const email = studentButton.querySelector('small').textContent; selectCoachStudent({ id: studentButton.dataset.coachStudent, name, email }); } if (event.target.closest('[data-coach-open-calendar]')) openCoachStudentWorkspace('#calendar'); if (event.target.closest('[data-coach-new-session]')) { openCoachStudentWorkspace('#calendar'); openSessionForm(); } if (event.target.closest('[data-coach-open-videos]')) openCoachStudentWorkspace('#videos'); if (event.target.closest('[data-coach-back]')) { document.querySelector('.shell').hidden = true; document.querySelector('#coach-context-bar').hidden = true; document.querySelector('#coach-console').hidden = false; if (coachAuthResult?.students?.[0]) selectCoachStudent(coachAuthResult.students.find((student) => student.id === activeStudentId) || coachAuthResult.students[0]); } const sessionButton = event.target.closest('[data-coach-session]'); if (sessionButton) { const session = getSessions().find((item) => item.id === sessionButton.dataset.coachSession); if (session) { openCoachStudentWorkspace('#calendar'); openWorkout(session); } } const reviewButton = event.target.closest('[data-coach-video-status]'); if (reviewButton) { const card = reviewButton.closest('[data-coach-video-card]'); const records = videoRecords(); const video = records.find((item) => item.id === card.dataset.coachVideoCard); if (!video) return; video.status = reviewButton.dataset.coachVideoStatus; video.coachComment = card.querySelector('[data-coach-video-comment]').value.trim(); video.reviewedAt = new Date().toISOString(); video.modifiedAt = video.reviewedAt; localStorage.setItem('exercise-video-registry', JSON.stringify(records)); queueSharedWrite('video-upsert', video); const student = coachAuthResult?.students?.find((item) => item.id === activeStudentId); if (student) selectCoachStudent(student); } });
document.body.insertAdjacentHTML('beforeend', '<dialog id="video-registry-dialog"><div class="form-card video-registry-card"><button class="close" type="button" data-close-video-registry aria-label="Fermer">×</button><div id="video-registry-content"></div></div></dialog>');
const videoRegistryDialog = document.querySelector('#video-registry-dialog');
document.querySelector('.nav-link[href="#exercise-library"]').insertAdjacentHTML('afterend', '<a class="nav-link" href="#videos"><span class="nav-icon">▶</span>Vidéos</a>');
document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => { if (link.getAttribute('href') !== '#exercise-library' && document.body.classList.contains('exercise-library-open')) setExerciseLibraryOpen(false, false); if (document.body.classList.contains('all-sessions-open')) setAllSessionsOpen(false, false); document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item === link)); }));
document.querySelector('#exercises').insertAdjacentHTML('beforebegin', '<section id="videos" class="panel video-library-panel"><div class="panel-heading"><div><p class="kicker">REVUE DU COACH</p><h2>Bibliothèque vidéo</h2><p class="panel-subtitle">Vidéos organisées par famille, exercice et date.</p></div><span class="video-library-count" id="video-library-count">0 vidéo</span></div><div class="video-recent-heading"><span>VIDÉOS RÉCENTES</span><small>De la plus récente à la plus ancienne</small></div><div id="video-recent-strip" class="video-recent-strip"></div><div class="video-library-toolbar"><strong>Classement de la bibliothèque</strong><div><button class="active" type="button" data-video-library-mode="exercise">Par exercice</button><button type="button" data-video-library-mode="date">Par date</button></div></div><div id="video-library-tree" class="video-library-tree"></div></section>');
let videoLibraryMode = 'exercise';
const LEGACY_SHEET_ID = '1vj_EQzZqVN7pKhB2eBFh1Rjn8u_aQ53mQosZLTRTT-Q';
const SHEET_ID = '1yCMCwVUPPr9d8MLyL-mhpcPw54M_4g8ihup8L4lG4zw';
const SHEET_SOURCE_LABEL = 'Test appli — Bilans d’entraînements';
const labels = { repetitions: 'Répétitions', tension: 'Temps sous tension', weight: 'Charge (kg)' };
const defaultExercises = [
  { id: 'hspu', name: 'Handstand push-ups', category: 'Handstand push-ups', subcategory: 'Strict', metrics: ['repetitions'], aliases: ['HSPU', 'HSPU //'] },
  { id: 'hspu-half-range', name: 'Handstand push-ups — demi-amplitude', category: 'Handstand push-ups', subcategory: 'Demi-amplitude', metrics: ['repetitions'], aliases: ['HSPU demi amplitude', 'HSPU demies amplitudes'] },
  { id: 'hspu-wall', name: 'Handstand push-ups contre le mur', category: 'Handstand push-ups', subcategory: 'Contre le mur', metrics: ['repetitions'], aliases: ['HSPU mur', 'HSPU mur //', 'HSPU mur // x2', 'HSPU mur 1s en bas', 'HSPU mur (2s en bas)', 'Handstand push-ups au mur', 'Handstand push-ups au mur — pause 1 s', 'Handstand push-ups au mur — pause 2 s'] },
  { id: 'handstand', name: 'Handstand', category: 'Handstand', subcategory: 'Maintien', metrics: ['tension'], aliases: ['handstand', 'HS', 'HS HOLD', 'HS hold'] },
  { id: 'handstand-full-to-straddle', name: 'Handstand — full to straddle', category: 'Handstand', subcategory: 'Transitions', metrics: ['repetitions', 'tension'], aliases: ['HS full to straddle', 'HS straddle to full'] },
  { id: 'handstand-close-to-wide', name: 'Handstand — close to wide', category: 'Handstand', subcategory: 'Transitions', metrics: ['repetitions', 'tension'], aliases: ['HS close grip to wide grip', 'HS wide to close'] },
  { id: 'front-lever', name: 'Front lever', category: 'Front lever', subcategory: 'Full', metrics: ['tension'], aliases: ['FL', 'hold FL', 'FL hold', 'HOLD FL'] },
  { id: 'front-lever-attempt', name: 'Front lever — tentatives', category: 'Front lever', subcategory: 'Tentatives', metrics: ['tension'], aliases: ['try FL', 'Try FL', 'TRY FL', 'try FL hold', 'try fl'] },
  { id: 'front-lever-assisted', name: 'Front lever avec élastique', category: 'Front lever', subcategory: 'Full · assisté', metrics: ['tension'], aliases: ['hold FL élastique', 'hold FL (petit élastique)', 'FL HOLD ELASTIQUE'] },
  { id: 'one-leg-front-lever-advanced', name: 'One-leg front lever — jambe en Advanced Tuck', category: 'Front lever', subcategory: 'One-leg · Advanced Tuck', metrics: ['tension'], aliases: ['hold OLFL (jambe en advT)', 'hold OLFL (jambe en advT+)', 'OLFL hold', 'OL FL Hold', 'hold OLFL', 'OLFL', 'OL FL'] },
  { id: 'one-leg-front-lever-raises-advanced', name: 'One-leg front lever raises — jambe en Advanced Tuck', category: 'Front lever raises', subcategory: 'One-leg · Advanced Tuck', metrics: ['repetitions'], aliases: ['OLFL raises (jambe en advT)', 'OLFL raises (jambe en advT+)'] },
  { id: 'one-leg-front-lever-tuck', name: 'One-leg front lever — jambe en Tuck', category: 'Front lever', subcategory: 'One-leg · Tuck', metrics: ['tension'], aliases: ['hold OLFL (jambe en tuck)'] },
  { id: 'one-leg-front-lever-raises-tuck', name: 'One-leg front lever raises — jambe en Tuck', category: 'Front lever raises', subcategory: 'One-leg · Tuck', metrics: ['repetitions'], aliases: ['OLFL raises (jambe en tuck)'] },
  { id: 'advanced-tuck-front-lever', name: 'Advanced Tuck front lever', category: 'Front lever', subcategory: 'Advanced Tuck', metrics: ['tension'], aliases: ['hold advTFL', 'FL hold en advT+'] },
  { id: 'advanced-tuck-front-lever-pull-up', name: 'Advanced Tuck front lever pull-ups', category: 'Front lever pull-ups', subcategory: 'Advanced Tuck', metrics: ['repetitions'], aliases: ['advTFLPU'] },
  { id: 'tuck-front-lever-raises', name: 'Tuck front lever raises', category: 'Front lever raises', subcategory: 'Tuck', metrics: ['repetitions'], aliases: ['FL tuck raises', 'Fl tuck raises'] },
  { id: 'front-lever-raises', name: 'Front lever raises', category: 'Front lever raises', subcategory: 'Full', metrics: ['repetitions'], aliases: ['FL raises', 'Full front lever raises'] },
  { id: 'l-front-lever-pull-up', name: 'L front lever pull-ups', category: 'Front lever pull-ups', subcategory: 'L position', metrics: ['repetitions'], aliases: ['L FLPU'] },
  { id: 'tuck-planche', name: 'Tuck planche', category: 'Planche', subcategory: 'Tuck', metrics: ['tension'], aliases: ['hold TP', 'TP hold', 'hold TP (sans trop forcer)'] },
  { id: 'advanced-tuck-planche', name: 'Advanced Tuck planche', category: 'Planche', subcategory: 'Advanced Tuck', metrics: ['tension'], aliases: ['hold advTP'] },
  { id: 'semi-planche', name: 'Semi-planche', category: 'Planche', subcategory: 'Semi-planche', metrics: ['tension'], aliases: ['hold semi SP'] },
  { id: 'planche-lean', name: 'Planche lean', category: 'Planche', subcategory: 'Lean', metrics: ['tension'], aliases: ['lean planche 10s', 'lean planche 10s (sans trop forcer)'] },
  { id: 'planche', name: 'Planche', category: 'Planche', subcategory: 'Full', metrics: ['tension'], aliases: ['Planche hold', 'Full planche'] },
  { id: 'planche-lean-push-up', name: 'Planche lean push-ups', category: 'Planche push-ups', subcategory: 'Lean', metrics: ['repetitions'], aliases: ['lean planche pu x5'] },
  { id: 'planche-lean-push-up-deadstop', name: 'Planche lean push-ups — dead stop', category: 'Planche push-ups', subcategory: 'Lean · dead stop', metrics: ['repetitions'], aliases: ['lean pu deadstop // x5'] },
  { id: 'pike-push-up-floor', name: 'Pike push-ups au sol', category: 'Pike push-ups', subcategory: 'Au sol', metrics: ['repetitions'], aliases: ['pike pu sol', 'Pike pu x10', 'pike pu x12', 'pike pu //'] },
  { id: 'pike-push-up-elevated', name: 'Pike push-ups pieds surélevés', category: 'Pike push-ups', subcategory: 'Pieds surélevés', metrics: ['repetitions'], aliases: ['pike pu (pieds surélevés) //'] },
  { id: 'pike-push-up-elevated-pause-2', name: 'Pike push-ups pieds surélevés — pause 2 s', category: 'Pike push-ups', subcategory: 'Pieds surélevés · tempo', metrics: ['repetitions'], aliases: ['pike pu (pieds surélevés) 2s en bas'] },
  { id: 'weighted-pull-up', name: 'Tractions lestées', category: 'Tirage', subcategory: 'Tractions', metrics: ['repetitions', 'weight'], aliases: ['tractions lestées', 'tractions lestées 10kg', 'Tractions lestées 10kg', 'tractions lestées 15kg', 'Pull ups lestees 10kg'] },
  { id: 'inverted-deadlift', name: 'Deadlift inversé', category: 'Deadlift inversé', subcategory: '', metrics: ['repetitions'], aliases: ['deadlift inversé', 'DL INVERSE', 'DL INVERSE*'] },
  { id: 'muscle-up', name: 'Muscle-up strict', category: 'Tirage', subcategory: 'Muscle-up', metrics: ['repetitions', 'tension'], aliases: ['Muscle-up strict'] },
];
const defaultSessions = [
  { id: 's1', date: '2026-08-14', name: 'Mobilité & récupération', duration: 30, place: 'Maison', energy: 9, exercises: [] },
  { id: 's2', date: '2026-08-16', name: 'Pull — muscle-up', duration: 48, place: 'Parc', energy: 8, exercises: ['Muscle-up strict', 'Tractions pronation'] },
  { id: 's3', date: '2026-08-18', name: 'Jambes — volume', duration: 52, place: 'Maison', energy: 7.5, exercises: [] },
  { id: 's4', date: '2026-08-20', name: 'Push — force & technique', duration: 45, place: 'Extérieur', energy: 8.5, exercises: [] },
  { id: 's5', date: '2026-08-24', name: 'Pull — technique', duration: 45, place: 'Parc', energy: null, exercises: ['Tractions pronation'] },
];
let calendarDate = new Date();
let calendarView = 'month';
let pendingImport;

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const toIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const storeReadCache = new Map();
const readStore = (key, fallback) => {
  const raw = localStorage.getItem(key);
  const cached = storeReadCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  try { const value = raw ? JSON.parse(raw) : fallback; storeReadCache.set(key, { raw, value }); return value; }
  catch { storeReadCache.set(key, { raw, value: fallback }); return fallback; }
};
const parseStoredRaw = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
let exerciseCacheRaw = null; let exerciseCache = null; let sessionCacheParts = []; let sessionCache = null;
const getExercises = () => {
  const raw = localStorage.getItem('exercise-catalog-v9');
  if (raw && raw === exerciseCacheRaw && exerciseCache) return exerciseCache;
  const saved = raw ? readStore('exercise-catalog-v9', null) : null;
  if (saved?.length) { exerciseCacheRaw = raw; exerciseCache = saved; return exerciseCache; }
  const legacy = readStore('exercise-catalog-v8', readStore('exercise-catalog-v7', readStore('exercise-catalog-v6', readStore('exercise-catalog-v5', readStore('exercise-catalog-v4', readStore('exercise-catalog-v3', readStore('exercise-catalog-v2', readStore('exercise-catalog-v1', readStore('calisthenics-exercises', [])))))))));
  const catalog = defaultExercises.map((item) => ({ ...item, aliases: [...item.aliases] }));
  const retiredExerciseIds = new Set(['handstand-straddle-to-full', 'handstand-wide-to-close', 'hspu-wall-pause-1', 'hspu-wall-pause-2']);
  legacy.forEach((item) => { if (!retiredExerciseIds.has(item.id) && !catalog.some((known) => known.id === item.id || normalize(known.name) === normalize(item.name))) catalog.push({ ...item, category: item.category || 'Personnalisés', subcategory: item.subcategory || 'Autres', aliases: item.aliases || [item.name] }); });
  localStorage.setItem('exercise-catalog-v9', JSON.stringify(catalog));
  exerciseCacheRaw = localStorage.getItem('exercise-catalog-v9'); exerciseCache = catalog; return exerciseCache;
};
const getSessions = () => {
  const parts = ['sheet-sessions', 'calisthenics-sessions', 'session-overrides', 'hidden-sessions'].map((key) => localStorage.getItem(key) || '');
  if (sessionCache && parts.every((part, index) => part === sessionCacheParts[index])) return sessionCache;
  const sheet = parseStoredRaw(parts[0], []); const local = parseStoredRaw(parts[1], defaultSessions);
  const overrides = parseStoredRaw(parts[2], {}); const hidden = new Set(parseStoredRaw(parts[3], []));
  const sessions = sheet.length ? [...sheet, ...local.filter((item) => item.source === 'manual')] : local;
  sessionCacheParts = parts; sessionCache = sessions.filter((item) => !hidden.has(item.id)).map((item) => overrides[item.id] ? applySessionOverride(item, overrides[item.id]) : item); return sessionCache;
};
const saveExercises = (items) => { const raw = JSON.stringify(items); localStorage.setItem('exercise-catalog-v9', raw); exerciseCacheRaw = raw; exerciseCache = items; displayExerciseSource = null; exerciseFilterCatalogSignature = ''; };
const saveSessions = (items) => localStorage.setItem('calisthenics-sessions', JSON.stringify(items));

const SHARED_CONFIG_KEY = 'shared-backend-config';
const SHARED_OUTBOX_KEY = 'shared-backend-outbox';
const SESSION_OVERRIDE_MIGRATION_KEY = 'session-override-fields-migration-v1';
const sharedProgressTimers = new Map();
let sharedSyncRunning = false;
let sharedSnapshotRunning = false;
let sharedSnapshotRequestedAt = 0;
let sharedSnapshotStudentId = '';
if (!localStorage.getItem(SESSION_OVERRIDE_MIGRATION_KEY)) {
  // Force une seule photographie complète pour convertir proprement les
  // anciennes séances techniques qui ne décrivaient pas leurs champs modifiés.
  localStorage.removeItem(`shared-backend-snapshot-at-${activeStudentId}`);
  localStorage.removeItem(`shared-backend-revision-${activeStudentId}`);
  localStorage.setItem(SESSION_OVERRIDE_MIGRATION_KEY, new Date().toISOString());
}
const SHARED_SNAPSHOT_COOLDOWN = 60 * 1000;
function sharedBackendConfig() { return { url: '', token: '', ...readStore(SHARED_CONFIG_KEY, {}) }; }
function sharedBackendReady() { const config = sharedBackendConfig(); return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(config.url) && Boolean(config.token); }
function setSharedStatus(text, state = 'off') { const status = document.querySelector('#shared-api-status'); if (!status) return; status.textContent = text; status.dataset.state = state; }
function queueSharedWrite(action, data) {
  if (!sharedBackendReady()) return;
  const studentActions = new Set(['progress-upsert', 'video-upsert', 'session-upsert', 'session-delete', 'sheet-calendar-sync']); const scopedData = studentActions.has(action) && data && !Array.isArray(data) ? { ...data, studentId: data.studentId || activeStudentId || 'student-owner' } : data;
  const outbox = readStore(SHARED_OUTBOX_KEY, []); outbox.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, studentId: activeStudentId || 'student-owner', action, data: scopedData });
  localStorage.setItem(SHARED_OUTBOX_KEY, JSON.stringify(outbox)); flushSharedOutbox();
}
async function flushSharedOutbox() {
  if (sharedSyncRunning || !sharedBackendReady()) return;
  sharedSyncRunning = true; setSharedStatus('Synchronisation…', 'busy');
  let conflictDetected = false;
  try {
    while (true) {
      const outbox = readStore(SHARED_OUTBOX_KEY, []); const item = outbox[0]; if (!item) break;
      const confirmation = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? await sharedProxyWrite(item) : await sharedBridgeWrite(item); if (!confirmation.ok) throw new Error(confirmation.error || 'Google n’a pas confirmé l’enregistrement.'); conflictDetected = Boolean(confirmation.conflict) || conflictDetected;
      const latest = readStore(SHARED_OUTBOX_KEY, []); localStorage.setItem(SHARED_OUTBOX_KEY, JSON.stringify(latest.filter((entry) => entry.id !== item.id)));
    }
    localStorage.setItem('shared-backend-last-sync', new Date().toISOString()); setSharedStatus('À jour', 'ok');
  } catch (error) { console.warn('Synchronisation partagée en attente', error); setSharedStatus(`En attente · ${error.message}`, 'error'); const calendarStatus = document.querySelector('#sync-status'); if (calendarStatus) calendarStatus.textContent = `Onglets mensuels lus · mise à jour APP en attente (${error.message})`; }
  finally { sharedSyncRunning = false; if (conflictDetected) loadSharedSnapshot(true); }
}
async function sharedProxyWrite(item) { const config = sharedBackendConfig(); const response = await fetch('/api/shared', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: config.token, credential: currentGoogleCredential(), studentId: item.studentId || activeStudentId, action: item.action, data: item.data }) }); if (!response.ok) throw new Error(`Relais local HTTP ${response.status}.`); return response.json(); }
function sharedBridgeMessage(requestId, startRequest, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const finish = (callback, value) => { window.removeEventListener('message', receive); clearTimeout(timeout); document.querySelectorAll(`[data-shared-bridge="${requestId}"]`).forEach((item) => item.remove()); callback(value); };
    const receive = (event) => { let message = event.data; if (typeof message === 'string') { try { message = JSON.parse(message); } catch { return; } } if (!message?.appTrainingBridge || message.requestId !== requestId) return; finish(resolve, message.data); };
    const timeout = setTimeout(() => finish(reject, new Error('Google n’a pas répondu dans le délai prévu.')), timeoutMs); window.addEventListener('message', receive); startRequest();
  });
}
function sharedBridgeWrite(item) {
  const config = sharedBackendConfig(); const requestId = `write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return sharedBridgeMessage(requestId, () => {
    const iframe = document.createElement('iframe'); iframe.name = requestId; iframe.dataset.sharedBridge = requestId; iframe.hidden = true; document.body.appendChild(iframe);
    const form = document.createElement('form'); form.method = 'POST'; form.action = config.url; form.target = requestId; form.dataset.sharedBridge = requestId; form.hidden = true;
    const fields = { payload: JSON.stringify({ token: config.token, credential: currentGoogleCredential(), studentId: item.studentId || activeStudentId, action: item.action, data: item.data }), origin: location.origin, requestId };
    Object.entries(fields).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); }); document.body.appendChild(form); form.submit();
  });
}
function sharedJsonp(action, onResult, parameters = {}) {
  if (!sharedBackendReady()) return;
  const extra = Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('');
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') { const config = sharedBackendConfig(); fetch(`/api/shared?action=${encodeURIComponent(action)}&token=${encodeURIComponent(config.token)}&credential=${encodeURIComponent(currentGoogleCredential())}&studentId=${encodeURIComponent(activeStudentId)}${extra}&_=${Date.now()}`, { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error(`Relais local HTTP ${response.status}.`); return response.json(); }).then(onResult).catch((error) => { console.warn('Relais local inaccessible', error); setSharedStatus('Relais local indisponible', 'error'); onResult?.({ ok: false, error: error.message }); }); return; }
  const config = sharedBackendConfig(); const requestId = `read-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sharedBridgeMessage(requestId, () => { const iframe = document.createElement('iframe'); iframe.dataset.sharedBridge = requestId; iframe.hidden = true; iframe.src = `${config.url}?action=bridge&resource=${encodeURIComponent(action)}&token=${encodeURIComponent(config.token)}&credential=${encodeURIComponent(currentGoogleCredential())}&studentId=${encodeURIComponent(activeStudentId)}&origin=${encodeURIComponent(location.origin)}&requestId=${encodeURIComponent(requestId)}${extra}&_=${Date.now()}`; document.body.appendChild(iframe); })
    .then(onResult).catch((error) => { console.warn('Pont Google inaccessible', error); setSharedStatus('Service inaccessible', 'error'); onResult?.({ ok: false, error: error.message }); });
}
function mergeSharedSnapshot(snapshot) {
  if (!snapshot?.ok) { setSharedStatus(snapshot?.error || 'Accès refusé', 'error'); return; }
  if (snapshot.notModified) { localStorage.setItem('shared-backend-last-sync', new Date().toISOString()); localStorage.setItem(`shared-backend-snapshot-at-${activeStudentId}`, snapshot.generatedAt || new Date().toISOString()); if (snapshot.revision) localStorage.setItem(`shared-backend-revision-${activeStudentId}`, snapshot.revision); setSharedStatus('À jour', 'ok'); return; }
  const isRemoteNewer = (local, remote) => { const localTime = Date.parse(local?.modifiedAt || '') || 0; const remoteTime = Date.parse(remote?.modifiedAt || '') || 0; return !localTime || !remoteTime || remoteTime >= localTime; };
  const localProgress = readStore('workout-progress', {}); const mergedProgress = { ...localProgress }; Object.entries(snapshot.progress || {}).forEach(([id, remote]) => { const local = mergedProgress[id]; if (isRemoteNewer(local, remote)) mergedProgress[id] = { ...local, ...remote, values: { ...(local?.values || {}), ...(remote.values || {}) }, manualSets: { ...(local?.manualSets || {}), ...(remote.manualSets || {}) } }; }); localStorage.setItem('workout-progress', JSON.stringify(mergedProgress));
  const deletedVideoIds = new Set(snapshot.deletedVideoIds || []); const localVideos = videoRecords().filter((item) => !deletedVideoIds.has(item.id)); const videos = new Map(localVideos.map((item) => [item.id, item])); (snapshot.videos || []).forEach((item) => { const local = videos.get(item.id); if (isRemoteNewer(local, item)) videos.set(item.id, item); }); localStorage.setItem('exercise-video-registry', JSON.stringify([...videos.values()]));
  if (snapshot.exercises || snapshot.archivedExercises) { const archived = new Map(readStore('exercise-archive-catalog', []).map((item) => [item.id, item])); (snapshot.archivedExercises || []).forEach((item) => { const local = archived.get(item.id) || getExercises().find((exercise) => exercise.id === item.id); if (isRemoteNewer(local, item)) archived.set(item.id, item); }); const exercises = new Map(getExercises().filter((item) => !archived.has(item.id)).map((item) => [item.id, item])); (snapshot.exercises || []).forEach((item) => { const local = exercises.get(item.id) || archived.get(item.id); if (isRemoteNewer(local, item)) { archived.delete(item.id); exercises.set(item.id, item); } }); saveExercises([...exercises.values()]); localStorage.setItem('exercise-archive-catalog', JSON.stringify([...archived.values()])); }
  const deletedSessionIds = new Set(snapshot.deletedSessionIds || []); const remoteSessions = snapshot.sessions || []; const demonstrationIds = new Set(defaultSessions.map((item) => item.id)); const localSessions = readStore('calisthenics-sessions', defaultSessions).filter((item) => !deletedSessionIds.has(item.id) && (!demonstrationIds.has(item.id) || item.source === 'manual')); const localSessionMap = new Map(localSessions.map((item) => [item.id, item])); const overrides = readStore('session-overrides', {}); const hidden = new Set(readStore('hidden-sessions', []));
  if (snapshot.archivedSessions) { const archived = new Map((snapshot.partial ? readStore('archived-session-catalog', []) : []).map((item) => [item.id, item])); snapshot.archivedSessions.forEach((item) => archived.set(item.id, item)); localStorage.setItem('archived-session-catalog', JSON.stringify([...archived.values()])); }
  remoteSessions.forEach((session) => {
    const local = session.source === 'google-sheet' ? overrides[session.id] : localSessionMap.get(session.id);
    // Une ligne historique sans « Champs modifiés JSON » n'est pas une saisie
    // manuelle explicite. On retire son ancien masque, même si sa date locale
    // était plus récente, afin que les onglets MOIS 2026 alimentent la fiche.
    const legacySheetRecord = session.source === 'google-sheet' && !Array.isArray(session.overrideFields);
    if (!legacySheetRecord && !isRemoteNewer(local, session)) return;
    hidden.delete(session.id);
    if (session.source === 'google-sheet') overrides[session.id] = compactSessionOverride(session);
    else localSessionMap.set(session.id, { ...session, source: 'manual' });
  });
  deletedSessionIds.forEach((id) => { localSessionMap.delete(id); delete overrides[id]; hidden.add(id); }); saveSessions([...localSessionMap.values()]); localStorage.setItem('session-overrides', JSON.stringify(overrides)); localStorage.setItem('hidden-sessions', JSON.stringify([...hidden]));
  localStorage.setItem('shared-backend-last-sync', new Date().toISOString()); localStorage.setItem(`shared-backend-snapshot-at-${activeStudentId}`, snapshot.generatedAt || new Date().toISOString()); if (snapshot.revision) localStorage.setItem(`shared-backend-revision-${activeStudentId}`, snapshot.revision); setSharedStatus('À jour', 'ok');
  scheduleDataRender();
  if (snapshot.partial) return;
  const remoteProgressIds = new Set(Object.keys(snapshot.progress || {})); const remoteVideoIds = new Set((snapshot.videos || []).map((item) => item.id)); const remoteExerciseIds = new Set((snapshot.exercises || []).map((item) => item.id)); const remoteSessionIds = new Set(remoteSessions.map((item) => item.id));
  const sessions = new Map(getSessions().map((session) => [session.id, session])); const missingProgress = [];
  Object.entries(localProgress).filter(([sessionId]) => !remoteProgressIds.has(sessionId)).forEach(([sessionId, progress]) => { const session = sessions.get(sessionId); (session?.exercises || []).forEach((exercise, exerciseIndex) => missingProgress.push({ sessionId, date: session.date, sessionName: session.name, exerciseKey: exerciseMatchKey(exercise), exerciseIndex, values: progress.values?.[exerciseIndex] || [], manualSets: progress.manualSets?.[exerciseIndex] || {}, comment: progress.comment || '', commentTouched: Boolean(progress.commentTouched), modifiedAt: progress.modifiedAt || new Date().toISOString() })); });
  const missingVideos = localVideos.filter((item) => !remoteVideoIds.has(item.id)); const missingExercises = getExercises().filter((item) => !remoteExerciseIds.has(item.id));
  for (let index = 0; index < missingProgress.length; index += 30) queueSharedWrite('bulk-sync', { progress: missingProgress.slice(index, index + 30) });
  for (let index = 0; index < missingVideos.length; index += 30) queueSharedWrite('bulk-sync', { videos: missingVideos.slice(index, index + 30) });
  for (let index = 0; index < missingExercises.length; index += 30) queueSharedWrite('bulk-sync', { exercises: missingExercises.slice(index, index + 30) });
  const localSharedSessions = [...localSessionMap.values(), ...Object.values(overrides)].filter((item) => !deletedSessionIds.has(item.id) && !remoteSessionIds.has(item.id)); for (let index = 0; index < localSharedSessions.length; index += 30) queueSharedWrite('bulk-sync', { sessions: localSharedSessions.slice(index, index + 30) });
}
function loadSharedSnapshot(force = false) {
  if (!sharedBackendReady() || !currentGoogleCredential()) return;
  const requestedStudentId = activeStudentId; const now = Date.now();
  if (sharedSnapshotRunning) return;
  if (!force && sharedSnapshotStudentId === requestedStudentId && now - sharedSnapshotRequestedAt < SHARED_SNAPSHOT_COOLDOWN) return;
  sharedSnapshotRunning = true; sharedSnapshotStudentId = requestedStudentId; sharedSnapshotRequestedAt = now; setSharedStatus('Synchronisation…', 'busy');
  // Une actualisation forcée doit être complète. Réutiliser les marqueurs
  // différentiels pouvait masquer une modification venant d'un autre appareil
  // lorsque son horodatage ou la révision locale étaient déjà mémorisés.
  const since = force ? '' : localStorage.getItem(`shared-backend-snapshot-at-${requestedStudentId}`) || ''; const revision = force ? '' : localStorage.getItem(`shared-backend-revision-${requestedStudentId}`) || '';
  sharedJsonp('snapshot', (snapshot) => {
    sharedSnapshotRunning = false;
    if (activeStudentId !== requestedStudentId) { loadSharedSnapshot(true); return; }
    mergeSharedSnapshot(snapshot);
  }, { since, revision });
}
function scheduleSharedProgress(session, progress) {
  if (!sharedBackendReady() || !session) return; clearTimeout(sharedProgressTimers.get(session.id));
  sharedProgressTimers.set(session.id, setTimeout(() => {
    (session.exercises || []).forEach((exercise, exerciseIndex) => queueSharedWrite('progress-upsert', { sessionId: session.id, date: session.date, sessionName: session.name, exerciseKey: exerciseMatchKey(exercise), exerciseIndex, values: progress.values?.[exerciseIndex] || [], manualSets: progress.manualSets?.[exerciseIndex] || {}, comment: progress.comment || '', commentTouched: Boolean(progress.commentTouched), modifiedAt: progress.modifiedAt }));
    sharedProgressTimers.delete(session.id);
  }, 900));
}

document.querySelector('[data-open-import]').insertAdjacentHTML('beforebegin', '<button class="sheet-import" type="button" data-sync-sheets>Actualiser les données</button>');

const defaultAppearance = { theme: 'noir-rouge', accent: '#d65b55' };
function applyAppearance(settings = defaultAppearance) {
  document.body.dataset.theme = settings.theme || defaultAppearance.theme;
  document.documentElement.style.setProperty('--accent-custom', settings.accent || defaultAppearance.accent);
}
function appearanceSettings() { return { ...defaultAppearance, ...readStore('app-appearance', {}) }; }
applyAppearance(appearanceSettings());

function openAppearanceSettings() {
  const settings = appearanceSettings(); const selected = document.querySelector(`[name="theme"][value="${settings.theme}"]`);
  if (selected) selected.checked = true;
  const shared = sharedBackendConfig(); document.querySelector('#shared-api-url').value = shared.url; document.querySelector('#shared-api-token').value = shared.token;
  setSharedStatus(sharedBackendReady() ? 'Configuré' : 'Non connecté', sharedBackendReady() ? 'ok' : 'off');
  document.querySelector('#accent-color').value = settings.accent; document.querySelector('#accent-code').textContent = settings.accent.toUpperCase(); settingsDialog.showModal();
}
document.querySelectorAll('.shell .settings, [data-open-settings]').forEach((button) => button.addEventListener('click', openAppearanceSettings));

function renderCurrentDateLabel() {
  const label = document.querySelector('.date-label');
  if (!label) return;
  const now = new Date();
  label.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  label.textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now).toLocaleUpperCase('fr-FR');
}
renderCurrentDateLabel();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderCurrentDateLabel(); });
function closeAppearance() { applyAppearance(appearanceSettings()); settingsDialog.close(); }
document.querySelector('[data-close-settings]').addEventListener('click', closeAppearance);
settingsDialog.addEventListener('click', (event) => { if (event.target === settingsDialog) closeAppearance(); });
document.querySelector('#appearance-form').addEventListener('input', (event) => {
  const form = new FormData(event.currentTarget); const accent = document.querySelector('#accent-color').value;
  document.querySelector('#accent-code').textContent = accent.toUpperCase(); applyAppearance({ theme: form.get('theme') || defaultAppearance.theme, accent });
});
document.querySelector('#appearance-form').addEventListener('submit', (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const settings = { theme: form.get('theme') || defaultAppearance.theme, accent: document.querySelector('#accent-color').value };
  const shared = { url: document.querySelector('#shared-api-url').value.trim().replace(/\/$/, ''), token: document.querySelector('#shared-api-token').value.trim() };
  if ((shared.url || shared.token) && !(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(shared.url) && shared.token)) { setSharedStatus('Adresse ou clé incomplète', 'error'); return; }
  localStorage.setItem('app-appearance', JSON.stringify(settings)); localStorage.setItem(SHARED_CONFIG_KEY, JSON.stringify(shared)); applyAppearance(settings); settingsDialog.close();
  if (sharedBackendReady()) { flushSharedOutbox(); loadSharedSnapshot(); }
});
document.querySelector('#test-shared-api').addEventListener('click', () => {
  const shared = { url: document.querySelector('#shared-api-url').value.trim().replace(/\/$/, ''), token: document.querySelector('#shared-api-token').value.trim() };
  localStorage.setItem(SHARED_CONFIG_KEY, JSON.stringify(shared));
  if (!sharedBackendReady()) { setSharedStatus('Adresse ou clé incomplète', 'error'); return; }
  setSharedStatus('Test…', 'busy'); sharedJsonp('health', (response) => {
    if (!response?.ok) { setSharedStatus(response?.error || 'Échec', 'error'); return; }
    const ready = Number(response.schema) >= 6 && (response.features || []).includes('sheet-calendar-sync');
    setSharedStatus(ready ? 'Connexion réussie · service v6' : `Service à redéployer · v${response.schema || '?'}`, ready ? 'ok' : 'error');
  });
});
document.querySelector('#reset-appearance').addEventListener('click', () => {
  localStorage.removeItem('app-appearance'); applyAppearance(defaultAppearance); document.querySelector('[name="theme"][value="noir-rouge"]').checked = true; document.querySelector('#accent-color').value = defaultAppearance.accent; document.querySelector('#accent-code').textContent = defaultAppearance.accent.toUpperCase();
});

dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector('[data-close-session]').addEventListener('click', () => dialog.close());
const sessionTitlePreset = document.querySelector('#session-title-preset');
sessionTitlePreset.innerHTML = '<option value=""></option><option value="Séance libre">Séance libre</option><option value="GTG">GTG</option><option value="Repos">Repos</option><option value="FL et HSPU">FL et HSPU</option><option value="Planche et FL">Planche et FL</option>';
const durationField = document.querySelector('#session-form [name="duration"]'); durationField.closest('.form-columns').classList.add('single-column'); durationField.closest('label').remove();
document.querySelector('#session-form [name="energy"]').closest('label').remove();
const coachInstructions = document.querySelector('#session-form [name="instructions"]'); coachInstructions.closest('label').childNodes[0].textContent = 'Consignes du coach'; coachInstructions.placeholder = 'Temps de repos, tempo, points techniques, exercices à filmer...';
exerciseForm.querySelector('fieldset').insertAdjacentHTML('beforebegin', `<div class="exercise-extra-fields"><label>Niveau<select id="exercise-level"><option value="">Non précisé</option><option value="Débutant">Débutant</option><option value="Intermédiaire">Intermédiaire</option><option value="Avancé">Avancé</option><option value="Expert">Expert</option></select></label><label class="exercise-aliases-field">Libellés alternatifs du tableau<textarea id="exercise-aliases" rows="2" placeholder="Ex. HSPU, handstand push up, HSPU strict"></textarea><small>Sépare les différents noms par une virgule. Ils seront tous rattachés à cet exercice officiel.</small></label></div>`);
document.querySelector('#exercise-subcategory').required = false;
document.querySelector('#exercise-subcategory').placeholder = 'Facultatif — ex. Advanced Tuck';
document.querySelector('[data-open-exercise]').innerHTML = '<span>＋</span> Créer un exercice';
function updateSessionTypeFields(type) { document.querySelector('#custom-session-title').hidden = type !== ''; document.querySelector('#session-exercise-options').closest('fieldset').hidden = type === 'Repos'; }
sessionTitlePreset.addEventListener('change', (event) => updateSessionTypeFields(event.target.value));

function renderExercises() {
  const allExercises = getDisplayExercises();
  // La page d'accueil n'a besoin que de l'aperçu. Construire les centaines de
  // lignes de la bibliothèque alors qu'elle est masquée bloquait le navigateur.
  if (exerciseLibrary?.hidden) { renderExercisePreview(allExercises); return; }
  const search = normalize(document.querySelector('#exercise-library-search')?.value || '');
  const family = document.querySelector('#exercise-family-filter')?.value || '';
  const subcategory = document.querySelector('#exercise-subcategory-filter')?.value || '';
  const level = document.querySelector('#exercise-level-filter')?.value || '';
  const metric = document.querySelector('#exercise-metric-filter')?.value || '';
  const exercises = allExercises.filter((exercise) => (!search || normalize([exercise.name, exercise.category, exercise.subcategory, exercise.level, ...(exercise.aliases || [])].join(' ')).includes(search)) && (!family || exercise.category === family) && (!subcategory || exercise.subcategory === subcategory) && (!level || exercise.level === level) && (!metric || exercise.metrics.includes(metric)));
  updateExerciseLibraryFilters(allExercises);
  const groups = new Map();
  exercises.forEach((exercise) => { const category = exercise.category || 'Autres'; if (!groups.has(category)) groups.set(category, []); groups.get(category).push(exercise); });
  const catalogHtml = [...groups.entries()].map(([category, categoryExercises]) => `<section class="exercise-category"><div class="exercise-category-title"><span>${escapeHtml(category)}</span><b>${categoryExercises.length} exercices</b></div>${categoryExercises.map((exercise) => `
    <article class="exercise-row"><div class="exercise-symbol">↗</div><div class="exercise-name"><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml([exercise.subcategory, exercise.level].filter(Boolean).join(' · ') || 'Sans sous-catégorie')}</span></div>
    <div class="metric-tags">${exercise.metrics.map((metric) => `<span>${labels[metric]}</span>`).join('')}</div>
    <div class="exercise-actions"><button type="button" class="progress-action" data-progress-exercise-id="${exercise.id}">Voir la progression</button><button type="button" data-video-registry="${exercise.id}">Vidéos</button><button type="button" data-edit-exercise="${exercise.id}">Modifier</button><button type="button" class="delete-action" data-delete-exercise="${exercise.id}">Supprimer</button></div></article>`).join('')}</section>`).join('');
  const unresolved = unresolvedSheetLabels();
  const options = allExercises.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.category)} › ${escapeHtml(item.name)}</option>`).join('');
  const reviewHtml = unresolved.length ? `<section class="exercise-unresolved"><div class="exercise-category-title"><span>À classer ensemble</span><b>${unresolved.length} libellé${unresolved.length > 1 ? 's' : ''}</b></div><p>Ces textes viennent du tableau mais leur sens n’est pas assez certain. Choisis l’exercice officiel correspondant.</p>${unresolved.map((raw) => `<label class="mapping-row"><span><strong>${escapeHtml(raw)}</strong><small>Libellé du Google Sheet</small></span><select data-map-label="${escapeHtml(raw)}"><option value="">Choisir une correspondance…</option>${options}</select></label>`).join('')}</section>` : '';
  const archived = readStore('exercise-archive-catalog', []); const archivedHtml = archived.length ? `<section class="exercise-category exercise-archive"><div class="exercise-category-title"><span>Exercices archivés</span><b>${archived.length}</b></div>${archived.map((exercise) => `<article class="exercise-row"><div class="exercise-symbol">↙</div><div class="exercise-name"><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.category || 'Sans famille')} · historique conservé</span></div><div class="metric-tags">${(exercise.metrics || []).map((metric) => `<span>${labels[metric]}</span>`).join('')}</div><div class="exercise-actions"><button type="button" data-restore-exercise="${exercise.id}">Restaurer</button></div></article>`).join('')}</section>` : '';
  exerciseList.innerHTML = catalogHtml || '<p class="empty-state">Aucun exercice ne correspond à ces filtres.</p>';
  exerciseList.insertAdjacentHTML('beforeend', reviewHtml + archivedHtml);
  renderExercisePreview(allExercises);
}

let exerciseFilterCatalogSignature = '';
function updateExerciseLibraryFilters(allExercises) {
  const signature = allExercises.map((item) => `${item.id}|${item.category}|${item.subcategory}|${item.level}`).join('\n');
  if (signature === exerciseFilterCatalogSignature) return;
  exerciseFilterCatalogSignature = signature;
  const definitions = [
    ['#exercise-family-filter', 'Toutes les familles', (item) => item.category || 'Autres'],
    ['#exercise-subcategory-filter', 'Toutes les sous-catégories', (item) => item.subcategory],
    ['#exercise-level-filter', 'Tous les niveaux', (item) => item.level],
  ];
  definitions.forEach(([selector, placeholder, valueFor]) => {
    const filter = document.querySelector(selector); if (!filter) return;
    const selected = filter.value; const values = [...new Set(allExercises.map(valueFor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    filter.innerHTML = `<option value="">${placeholder}</option>` + values.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join(''); filter.value = selected;
  });
}

function renderExercisePreview(exercises) {
  if (!exercisePreview) return;
  const recentIds = [...getSessions()].sort((a, b) => String(b.date).localeCompare(String(a.date))).flatMap((session) => session.exercises || []).map((item) => resolveCatalogExercise(typeof item === 'string' ? item : item.name || item.exerciseName || '')?.id).filter(Boolean);
  const ordered = [...new Set(recentIds)].map((id) => exercises.find((item) => item.id === id)).filter(Boolean);
  const preview = [...ordered, ...exercises.filter((item) => !ordered.some((recent) => recent.id === item.id))].slice(0, 4);
  exercisePreview.innerHTML = preview.length ? preview.map((exercise) => `<article><div class="exercise-symbol">↗</div><span><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(exercise.category)}${exercise.subcategory ? ` · ${escapeHtml(exercise.subcategory)}` : ''}</small></span><div class="metric-tags">${exercise.metrics.map((item) => `<span>${labels[item]}</span>`).join('')}</div></article>`).join('') : '<p class="empty-state">Aucun exercice pour le moment.</p>';
}

function setExerciseLibraryOpen(open, updateHash = true) {
  if (open) setAllSessionsOpen(false, false);
  exerciseLibrary.hidden = !open;
  document.body.classList.toggle('exercise-library-open', open);
  if (open) { renderExercises(); window.scrollTo({ top: 0, behavior: 'auto' }); }
  if (updateHash) history.pushState(null, '', open ? '#exercise-library' : '#exercises');
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', open ? link.getAttribute('href') === '#exercise-library' : link.getAttribute('href') === '#top'));
}
document.querySelectorAll('[data-open-exercise-library]').forEach((button) => button.addEventListener('click', () => setExerciseLibraryOpen(true)));
document.querySelector('[data-close-exercise-library]').addEventListener('click', () => setExerciseLibraryOpen(false));
document.querySelector('.nav-link[href="#exercise-library"]').addEventListener('click', (event) => { event.preventDefault(); setExerciseLibraryOpen(true); });
window.addEventListener('hashchange', () => setExerciseLibraryOpen(location.hash === '#exercise-library', false));
let exerciseSearchTimer;
document.querySelectorAll('#exercise-library-search, #exercise-family-filter, #exercise-subcategory-filter, #exercise-level-filter, #exercise-metric-filter').forEach((field) => field.addEventListener(field.tagName === 'INPUT' ? 'input' : 'change', () => {
  if (field.tagName !== 'INPUT') { renderExercises(); return; }
  clearTimeout(exerciseSearchTimer); exerciseSearchTimer = setTimeout(renderExercises, 100);
}));
setExerciseLibraryOpen(location.hash === '#exercise-library', false);

function historySessionState(session, today = toIso(new Date())) {
  if (session.isRest) return 'rest';
  const completion = sessionCompletion(session);
  if (completion.state !== 'none') return completion.state;
  return session.date < today ? 'missed' : 'planned';
}
const historyStateLabels = { complete: 'Terminée', partial: 'Partielle', started: 'Commencée', missed: 'Manquée', rest: 'Repos validé', planned: 'À renseigner' };
function renderRegularityOverview(sessions) {
  const months = new Map();
  sessions.forEach((session) => {
    const key = session.date.slice(0, 7); const state = historySessionState(session);
    const month = months.get(key) || { total: 0, followed: 0, missed: 0 };
    month.total += 1;
    if (state === 'complete' || state === 'rest') month.followed += 1;
    if (state === 'missed') month.missed += 1;
    months.set(key, month);
  });
  const recent = [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  document.querySelector('#regularity-overview').innerHTML = recent.length ? recent.map(([key, month]) => {
    const percentage = month.total ? Math.round((month.followed / month.total) * 100) : 0;
    const label = new Date(`${key}-01T12:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `<article class="regularity-month"><span>${escapeHtml(label)}</span><strong>${percentage}%</strong><small>${month.followed}/${month.total} suivie${month.followed > 1 ? 's' : ''}${month.missed ? ` · ${month.missed} manquée${month.missed > 1 ? 's' : ''}` : ''}</small><div class="regularity-bar"><i style="width:${percentage}%"></i></div></article>`;
  }).join('') : '<p class="empty-state">La régularité apparaîtra après les premières séances.</p>';
}
function renderAllSessions() {
  if (!allSessionsPage) return;
  const today = toIso(new Date());
  const allPast = getSessions().filter((session) => session.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const yearFilter = document.querySelector('#session-history-year'); const selectedYear = yearFilter.value;
  const years = [...new Set(allPast.map((session) => session.date.slice(0, 4)))];
  yearFilter.innerHTML = '<option value="">Toutes les années</option>' + years.map((year) => `<option value="${year}">${year}</option>`).join('');
  yearFilter.value = years.includes(selectedYear) ? selectedYear : '';
  const query = normalize(document.querySelector('#session-history-search').value); const status = document.querySelector('#session-history-status').value; const year = yearFilter.value;
  const sessions = allPast.filter((session) => {
    const searchable = normalize(`${session.name} ${(session.exercises || []).map((exercise) => typeof exercise === 'string' ? exercise : exercise.name || '').join(' ')}`);
    return (!query || searchable.includes(query)) && (!status || historySessionState(session, today) === status) && (!year || session.date.startsWith(year));
  });
  document.querySelector('#all-sessions-count').textContent = `${sessions.length} séance${sessions.length > 1 ? 's' : ''}`;
  renderRegularityOverview(allPast);
  document.querySelector('#all-sessions-list').innerHTML = sessions.length ? sessions.map((session) => {
    const date = new Date(`${session.date}T12:00`); const state = historySessionState(session, today); const completion = sessionCompletion(session);
    const details = session.isRest ? 'Journée de récupération planifiée' : `${session.exercises?.length || 0} exercice${session.exercises?.length > 1 ? 's' : ''}${completion.completed ? ` · ${completion.completed}/${completion.total} renseigné${completion.completed > 1 ? 's' : ''}` : ''}`;
    return `<button type="button" class="history-session" data-history-session-id="${escapeHtml(session.id)}"><time><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '')}</span></time><span class="history-session-info"><strong>${escapeHtml(session.name)}</strong><small>${escapeHtml(details)}</small></span><span class="history-state ${state}">${historyStateLabels[state]}</span><span class="chevron">›</span></button>`;
  }).join('') : '<p class="empty-state">Aucune séance ne correspond à ces filtres.</p>';
}
function setAllSessionsOpen(open, updateHash = true) {
  if (!allSessionsPage) return;
  if (open && exerciseLibrary && !exerciseLibrary.hidden) setExerciseLibraryOpen(false, false);
  allSessionsPage.hidden = !open;
  document.body.classList.toggle('all-sessions-open', open);
  if (open) { renderAllSessions(); window.scrollTo({ top: 0, behavior: 'auto' }); }
  if (updateHash) history.pushState(null, '', open ? '#all-sessions' : '#sessions');
}
document.querySelectorAll('[data-open-all-sessions]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); setAllSessionsOpen(true); }));
document.querySelector('[data-close-all-sessions]').addEventListener('click', () => setAllSessionsOpen(false));
document.querySelectorAll('#session-history-search, #session-history-status, #session-history-year').forEach((field) => field.addEventListener(field.tagName === 'INPUT' ? 'input' : 'change', renderAllSessions));
document.querySelector('#all-sessions-list').addEventListener('click', (event) => { const button = event.target.closest('[data-history-session-id]'); if (!button) return; const session = getSessions().find((item) => item.id === button.dataset.historySessionId); if (session) openWorkout(session); });
window.addEventListener('hashchange', () => setAllSessionsOpen(location.hash === '#all-sessions', false));
setAllSessionsOpen(location.hash === '#all-sessions', false);

let displayExerciseSource = null; let displayExerciseCache = null;
function getDisplayExercises() {
  const exercises = getExercises();
  if (displayExerciseSource === exercises && displayExerciseCache) return displayExerciseCache;
  displayExerciseSource = exercises; displayExerciseCache = [...exercises].sort((a, b) => `${a.category}${a.subcategory}${a.name}`.localeCompare(`${b.category}${b.subcategory}${b.name}`, 'fr')); return displayExerciseCache;
}

function unresolvedSheetLabels() {
  const ignored = new Set(['legz', 'bras', 'gtg']);
  return [...new Set(readStore('sheet-sessions', []).flatMap((session) => session.exercises || []).map((exercise) => typeof exercise === 'string' ? exercise : exercise?.name).filter(Boolean))]
    .filter((name) => !ignored.has(normalize(name)) && !resolveCatalogExercise(name)).sort((a, b) => a.localeCompare(b, 'fr'));
}

function renderSessionExerciseOptions(selectedExercises = []) {
  const selected = new Map(selectedExercises.map((exercise) => [exerciseMatchKey(exercise), typeof exercise === 'string' ? { seriesCount: 3 } : exercise]));
  document.querySelector('#session-exercise-options').innerHTML = getDisplayExercises().map((exercise) => {
    const current = selected.get(exerciseMatchKey(exercise)); const checked = Boolean(current); const count = current?.seriesCount || current?.targets?.length || 3;
    return `<label class="session-exercise-option"><input type="checkbox" data-session-exercise="${escapeHtml(exercise.id)}" ${checked ? 'checked' : ''} /><span><strong>${escapeHtml(exercise.name)}</strong><small>${exercise.metrics.map((metric) => labels[metric]).join(' · ')}</small></span><span class="series-choice">Séries <input type="number" min="1" max="20" value="${count}" data-series-for="${escapeHtml(exercise.id)}" ${checked ? '' : 'disabled'} /></span></label>`;
  }).join('');
}
function openSessionForm(session = null, options = {}) {
  const duplicate = Boolean(options.duplicate && session);
  const form = document.querySelector('#session-form'); form.reset(); document.querySelector('#session-error').textContent = '';
  form.dataset.mode = duplicate ? 'duplicate' : session ? 'edit' : 'create';
  document.querySelector('#session-edit-id').value = duplicate ? '' : session?.id || ''; document.querySelector('#session-dialog-title').textContent = duplicate ? 'Dupliquer la séance' : session ? 'Modifier la séance' : 'Créer une séance';
  const preset = ['Séance libre', 'GTG', 'Repos', 'FL et HSPU', 'Planche et FL'].includes(session?.name) ? session.name : '';
  document.querySelector('#session-title-preset').value = preset; updateSessionTypeFields(preset); form.elements.name.value = preset === '' ? session?.name || '' : '';
  let sessionDate = session?.date || toIso(new Date());
  if (duplicate) { const nextDate = new Date(`${session.date}T12:00:00`); nextDate.setDate(nextDate.getDate() + 1); sessionDate = toIso(nextDate); }
  form.elements.date.value = sessionDate; form.dataset.templateDuration = session?.duration || ''; form.dataset.templateEnergy = session?.energy || ''; form.elements.instructions.value = session?.instructions || session?.coachInfo || '';
  renderSessionExerciseOptions(session?.exercises || []); dialog.showModal();
}
document.querySelectorAll('[data-open-form]').forEach((button) => button.addEventListener('click', () => openSessionForm()));
document.querySelector('#session-exercise-options').addEventListener('change', (event) => { if (event.target.matches('[data-session-exercise]')) document.querySelector(`[data-series-for="${event.target.dataset.sessionExercise}"]`).disabled = !event.target.checked; });

document.querySelectorAll('[data-open-exercise]').forEach((button) => button.addEventListener('click', () => {
  exerciseForm.reset(); document.querySelector('#exercise-id').value = ''; document.querySelector('#exercise-dialog-title').textContent = 'Créer un exercice'; document.querySelector('#exercise-error').textContent = ''; exerciseDialog.showModal();
}));
const closeExerciseButton = exerciseDialog.querySelector('.close');
closeExerciseButton.type = 'button';
closeExerciseButton.addEventListener('click', () => exerciseDialog.close());
exerciseDialog.addEventListener('click', (event) => { if (event.target === exerciseDialog) exerciseDialog.close(); });
exerciseList.addEventListener('click', (event) => {
  const restore = event.target.closest('[data-restore-exercise]');
  if (restore) { const archived = readStore('exercise-archive-catalog', []); const exercise = archived.find((item) => item.id === restore.dataset.restoreExercise); if (!exercise) return; exercise.archived = false; exercise.modifiedAt = new Date().toISOString(); saveExercises([...getExercises(), exercise]); localStorage.setItem('exercise-archive-catalog', JSON.stringify(archived.filter((item) => item.id !== exercise.id))); queueSharedWrite('exercise-upsert', exercise); renderExercises(); return; }
  const videos = event.target.closest('[data-video-registry]');
  if (videos) { const exercise = getDisplayExercises().find((item) => item.id === videos.dataset.videoRegistry); if (exercise) openVideoRegistry(exercise); return; }
  const progress = event.target.closest('[data-progress-exercise-id]');
  if (progress) { const exercise = getDisplayExercises().find((item) => item.id === progress.dataset.progressExerciseId); if (exercise) openExerciseProgress(exercise); return; }
  const edit = event.target.closest('[data-edit-exercise]');
  const remove = event.target.closest('[data-delete-exercise]');
  const exercises = getExercises();
  if (edit) {
    const exercise = getDisplayExercises().find((item) => item.id === edit.dataset.editExercise); if (!exercise) return;
    document.querySelector('#exercise-id').value = exercise.id; document.querySelector('#exercise-name').value = exercise.name;
    document.querySelector('#exercise-category').value = exercise.category || ''; document.querySelector('#exercise-subcategory').value = exercise.subcategory || '';
    document.querySelector('#exercise-level').value = exercise.level || ''; document.querySelector('#exercise-aliases').value = (exercise.aliases || []).filter((alias) => normalize(alias) !== normalize(exercise.name)).join(', ');
    document.querySelectorAll('input[name="metric"]').forEach((input) => { input.checked = exercise.metrics.includes(input.value); });
    document.querySelector('#exercise-dialog-title').textContent = 'Modifier un exercice'; exerciseDialog.showModal();
  }
  if (remove && window.confirm('Archiver cet exercice ? Il disparaîtra de la bibliothèque active mais restera associé à ton historique.')) { const exercise = exercises.find((item) => item.id === remove.dataset.deleteExercise); if (!exercise) return; exercise.archived = true; exercise.modifiedAt = new Date().toISOString(); const archived = readStore('exercise-archive-catalog', []).filter((item) => item.id !== exercise.id); archived.push(exercise); localStorage.setItem('exercise-archive-catalog', JSON.stringify(archived)); saveExercises(exercises.filter((item) => item.id !== exercise.id)); queueSharedWrite('exercise-archive', exercise); renderExercises(); }
});
exerciseList.addEventListener('change', (event) => {
  if (!event.target.matches('[data-map-label]') || !event.target.value) return;
  const mappings = readStore('exercise-alias-overrides', {}); mappings[normalize(event.target.dataset.mapLabel)] = event.target.value;
  localStorage.setItem('exercise-alias-overrides', JSON.stringify(mappings)); renderExercises(); renderCalendar(); renderDashboard();
});
exerciseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector('#exercise-name').value.trim();
  const category = document.querySelector('#exercise-category').value.trim() || 'Personnalisés';
  const subcategory = document.querySelector('#exercise-subcategory').value.trim() || 'Autres';
  const level = document.querySelector('#exercise-level').value;
  const aliases = [...new Set([name, ...document.querySelector('#exercise-aliases').value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)])];
  const metrics = [...document.querySelectorAll('input[name="metric"]:checked')].map((input) => input.value);
  if (!metrics.length) { document.querySelector('#exercise-error').textContent = 'Sélectionne au moins une métrique à suivre.'; return; }
  const exercises = getExercises(); const id = document.querySelector('#exercise-id').value || `exercise-${Date.now()}`; const index = exercises.findIndex((item) => item.id === id);
  const duplicate = exercises.find((item) => item.id !== id && [item.name, ...(item.aliases || [])].some((known) => aliases.some((alias) => normalize(alias) === normalize(known))));
  if (duplicate) { document.querySelector('#exercise-error').textContent = `Ce nom est déjà rattaché à « ${duplicate.name} ».`; return; }
  const modifiedAt = new Date().toISOString();
  if (index >= 0) exercises[index] = { ...exercises[index], id, name, category, subcategory, level, metrics, aliases, modifiedAt };
  else exercises.push({ id, name, category, subcategory, level, metrics, aliases, modifiedAt });
  saveExercises(exercises);
  queueSharedWrite('exercise-upsert', exercises.find((item) => item.id === id));
  renderExercises(); exerciseDialog.close();
});

function startOfWeek(date) { const result = new Date(date); result.setHours(12, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
function sessionCompletion(session) {
  if (session.isRest || !session.exercises?.length) return { state: 'none', completed: 0, total: session.exercises?.length || 0 };
  const completed = session.exercises.filter((exercise, index) => {
    return effectiveExerciseValues(session, exercise, index).length > 0;
  }).length;
  const total = session.exercises.length;
  return { state: completed === 0 ? 'none' : completed === 1 && total > 1 ? 'started' : completed < total ? 'partial' : 'complete', completed, total };
}
function effectiveExerciseValues(session, exercise, exerciseIndex) {
  const targets = typeof exercise === 'string' ? [] : exercise.targets || [];
  const progress = readStore('workout-progress', {})[session.id] || {}; const manual = progress.values?.[exerciseIndex] || [];
  return effectiveSetValues(targets, manual, progress.manualSets?.[exerciseIndex]);
}
function effectiveExerciseRecord(session, exercise, exerciseIndex) {
  const item = typeof exercise === 'string' ? { name: exercise, metric: 'repetitions' } : exercise;
  const sessionMetric = canonicalSessionMetric(item.name, item.metric); const metric = sessionMetric === 'seconds' ? 'tension' : sessionMetric || 'repetitions'; const key = exerciseMatchKey(item);
  return { item, key, name: canonicalExerciseName(key, item.name), metric, values: effectiveExerciseValues(session, item, exerciseIndex) };
}
function trainingVolume(startDate, endDate) {
  const volumes = {}; const today = toIso(new Date()); const effectiveEnd = endDate > today ? today : endDate;
  getSessions().filter((session) => !session.isRest && session.date >= startDate && session.date <= effectiveEnd).forEach((session) => {
    (session.exercises || []).forEach((exercise, exerciseIndex) => {
      const { item, key, name, metric, values } = effectiveExerciseRecord(session, exercise, exerciseIndex);
      if (!values.length) return;
      volumes[key] ||= { key, name, sets: 0, sessions: new Set(), metrics: {} };
      volumes[key].sets += values.length; volumes[key].sessions.add(session.id); volumes[key].metrics[metric] = (volumes[key].metrics[metric] || 0) + values.reduce((sum, value) => sum + value, 0);
      const weight = Number(item.name.match(/(\d+(?:[.,]\d+)?)\s*kg/i)?.[1]?.replace(',', '.'));
      if (weight && metric === 'repetitions') volumes[key].metrics.weightedVolume = (volumes[key].metrics.weightedVolume || 0) + values.reduce((sum, value) => sum + value, 0) * weight;
    });
  });
  return Object.values(volumes).map((item) => ({ ...item, sessions: item.sessions.size })).sort((a, b) => b.sets - a.sets || Object.values(b.metrics).reduce((sum, value) => sum + value, 0) - Object.values(a.metrics).reduce((sum, value) => sum + value, 0));
}
function volumeMetricText(item) {
  const parts = [];
  if (item.metrics.repetitions) parts.push(`${item.metrics.repetitions} rép.`);
  if (item.metrics.tension) parts.push(`${item.metrics.tension} s`);
  if (item.metrics.weight) parts.push(`${item.metrics.weight} kg`);
  if (item.metrics.weightedVolume) parts.push(`${item.metrics.weightedVolume.toLocaleString('fr-FR')} kg·rép.`);
  return parts.join(' · ') || 'Aucune valeur';
}
function currentWeekRange() { const start = startOfWeek(new Date()); const end = new Date(start); end.setDate(end.getDate() + 6); return { start: toIso(start), end: toIso(end) }; }
function renderWeeklyVolume() {
  const container = document.querySelector('#weekly-volume-top'); if (!container) return;
  const range = currentWeekRange(); const top = trainingVolume(range.start, range.end).slice(0, 3);
  container.innerHTML = top.length ? top.map((item, index) => `<button type="button" class="volume-quick-row" data-open-volume><span class="volume-rank">0${index + 1}</span><span><strong>${escapeHtml(item.name)}</strong><small>${volumeMetricText(item)}</small></span><b>${item.sets}<small>séries</small></b></button>`).join('') : '<div class="empty-volume"><strong>Aucun volume cette semaine</strong><span>Les exercices apparaîtront dès qu’une série sera renseignée.</span></div>';
}
function volumeRows(items) {
  if (!items.length) return '<p class="empty-state">Aucune série réalisée sur cette période.</p>';
  const maximum = Math.max(...items.map((item) => item.sets), 1);
  return `<div class="volume-table">${items.map((item) => `<article><div class="volume-name"><strong>${escapeHtml(item.name)}</strong><span>${volumeMetricText(item)} · ${item.sessions} séance${item.sessions > 1 ? 's' : ''}</span></div><b>${item.sets}<small>séries</small></b><div class="volume-bar"><i style="width:${(item.sets / maximum) * 100}%"></i></div></article>`).join('')}</div>`;
}
function openVolumeDetails() {
  const today = toIso(new Date()); const range = currentWeekRange(); const blocks = readStore('training-blocks', []).filter((block) => block.startDate && block.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const active = blocks.find((block) => today >= block.startDate && today <= block.endDate); const previous = blocks.filter((block) => block.endDate < today);
  const week = trainingVolume(range.start, range.end);
  const activeHtml = active ? `<p class="volume-period">${new Date(`${active.startDate}T12:00`).toLocaleDateString('fr-FR')} – ${new Date(`${active.endDate}T12:00`).toLocaleDateString('fr-FR')}</p>${volumeRows(trainingVolume(active.startDate, today < active.endDate ? today : active.endDate))}` : '<div class="volume-block-empty"><strong>Période du bloc à définir</strong><p>Le cumul du bloc apparaîtra automatiquement dès que ses dates seront disponibles dans « Plan d’entraînement ».</p></div>';
  const historyHtml = previous.length ? previous.map((block) => `<details class="volume-history"><summary><span>Bloc ${block.number}<small>${new Date(`${block.startDate}T12:00`).toLocaleDateString('fr-FR')} – ${new Date(`${block.endDate}T12:00`).toLocaleDateString('fr-FR')}</small></span><b>Voir</b></summary>${volumeRows(trainingVolume(block.startDate, block.endDate))}</details>`).join('') : '<p class="empty-state">L’historique apparaîtra quand les périodes des anciens blocs seront renseignées.</p>';
  document.querySelector('#volume-content').innerHTML = `<p class="kicker">CHARGE DE TRAVAIL</p><h2>Volume par exercice</h2><div class="volume-section"><div class="volume-section-heading"><div><span>CETTE SEMAINE</span><strong>${new Date(`${range.start}T12:00`).toLocaleDateString('fr-FR')} – ${new Date(`${range.end}T12:00`).toLocaleDateString('fr-FR')}</strong></div><b>${week.reduce((sum, item) => sum + item.sets, 0)} séries</b></div>${volumeRows(week)}</div><div class="volume-section"><div class="volume-section-heading"><div><span>BLOC EN COURS</span><strong>${active ? `Bloc ${active.number}` : 'En attente'}</strong></div></div>${activeHtml}</div><div class="volume-section"><div class="volume-section-heading"><div><span>HISTORIQUE</span><strong>Blocs précédents</strong></div></div>${historyHtml}</div>`;
  volumeDialog.showModal();
}
const trophyGrades = ['bronze', 'silver', 'gold'];
const gradeLabels = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };
const familyLabels = { figures: 'Figures', records: 'Records personnels', consistency: 'Régularité', volume: 'Volume' };
const familyIcons = { figures: '◆', records: '↗', consistency: '◉', volume: '▦' };
const figureTrophies = [
  { id: 'figure-handstand', family: 'figures', title: 'Handstand', keys: ['handstand'], metric: 'tension', unit: 's', thresholds: [10, 30, 60] },
  { id: 'figure-hspu', family: 'figures', title: 'Handstand push-ups', keys: ['hspu'], metric: 'repetitions', unit: 'rép.', thresholds: [1, 5, 8] },
  { id: 'figure-planche', family: 'figures', title: 'Planche', keys: ['planche'], metric: 'tension', unit: 's', thresholds: [1, 5, 10] },
  { id: 'figure-front-lever', family: 'figures', title: 'Front lever', keys: ['front-lever'], metric: 'tension', unit: 's', thresholds: [1, 5, 10] },
  { id: 'figure-front-lever-raises', family: 'figures', title: 'Front lever raises', keys: ['front-lever-raises'], metric: 'repetitions', unit: 'rép.', thresholds: [1, 5, 10] },
];
function completedWorkoutEvents() {
  const today = toIso(new Date()); const events = [];
  getSessions().filter((session) => !session.isRest && session.date <= today && sessionCompletion(session).state === 'complete').sort((a, b) => a.date.localeCompare(b.date)).forEach((session) => {
    (session.exercises || []).forEach((exercise, exerciseIndex) => {
      const { item, key, name, metric, values } = effectiveExerciseRecord(session, exercise, exerciseIndex); if (!values.length) return;
      events.push({ sessionId: session.id, sessionName: session.name, date: session.date, key, name, metric, values, best: Math.max(...values), total: values.reduce((sum, value) => sum + value, 0), sets: values.length });
      const weight = Number(item.name.match(/(\d+(?:[.,]\d+)?)\s*kg/i)?.[1]?.replace(',', '.')); if (weight) events.push({ sessionId: session.id, sessionName: session.name, date: session.date, key, name: canonicalExerciseName(key, item.name), metric: 'weight', values: [weight], best: weight, total: weight, sets: values.length });
    });
  });
  return events;
}
function chainFromBest(definition, events) {
  const acceptedKeys = definition.keys || [definition.key]; const matches = events.filter((event) => acceptedKeys.includes(event.key) && event.metric === definition.metric); const value = Math.max(0, ...matches.map((event) => event.best));
  const awards = definition.thresholds.map((threshold, index) => { const event = matches.find((item) => item.best >= threshold); return { grade: trophyGrades[index], threshold, earned: Boolean(event), event }; });
  return { ...definition, value, awards, description: `Meilleure série en ${definition.unit === 's' ? 'temps sous tension' : 'répétitions'}` };
}
function firstFigureUnlockChain(definition, events) {
  const acceptedKeys = definition.keys || [definition.key]; const first = events.find((event) => acceptedKeys.includes(event.key) && event.metric === definition.metric && event.best > 0);
  return { id: `${definition.id}-first-unlock`, family: 'figures', title: `${definition.title} · Première fois`, description: 'Figure débloquée pour la première fois dans une séance terminée', thresholds: [1], value: first ? 1 : 0, unit: 'figure', awards: [{ grade: 'gold', threshold: 1, earned: Boolean(first), event: first }] };
}
function recordChains(events) {
  const groups = {};
  events.forEach((event) => { const id = `${event.key}-${event.metric}`; (groups[id] ||= []).push(event); });
  return Object.entries(groups).map(([id, items]) => {
    const sample = items[0]; const rules = sample.metric === 'tension' ? { thresholds: [10, 30, 60], unit: 's' } : sample.metric === 'weight' ? { thresholds: [5, 10, 20], unit: 'kg' } : { thresholds: [5, 10, 20], unit: 'rép.' };
    return chainFromBest({ id: `record-${id}`, family: 'records', title: `Record · ${sample.name}`, key: sample.key, metric: sample.metric, ...rules }, events);
  });
}
function milestoneChain(id, family, title, description, thresholds, value, events, unit) {
  const awards = thresholds.map((threshold, index) => { const event = events.find((_, eventIndex) => eventIndex + 1 >= threshold) || (value >= threshold ? events.at(-1) : null); return { grade: trophyGrades[index], threshold, earned: value >= threshold, event }; });
  return { id, family, title, description, thresholds, value, unit, awards };
}
function consistencyChain(completedSessions) {
  const weeks = [...new Set(completedSessions.map((session) => weekStartIso(session.date)))].sort(); let best = 0; let current = 0; let previous;
  weeks.forEach((week) => { const date = new Date(`${week}T12:00`); const expected = previous ? new Date(`${previous}T12:00`) : null; if (expected) expected.setDate(expected.getDate() + 7); current = expected && toIso(expected) === week ? current + 1 : 1; best = Math.max(best, current); previous = week; });
  const events = weeks.map((date) => ({ date, sessionName: 'Semaine régulière' })); return milestoneChain('consistency-weeks', 'consistency', 'Semaines régulières', 'Au moins une séance terminée chaque semaine', [2, 4, 8], best, events, 'sem.');
}
function trophyCollection() {
  const events = completedWorkoutEvents(); const completedSessions = getSessions().filter((session) => !session.isRest && session.date <= toIso(new Date()) && sessionCompletion(session).state === 'complete').sort((a, b) => a.date.localeCompare(b.date));
  const figures = figureTrophies.flatMap((definition) => [firstFigureUnlockChain(definition, events), chainFromBest(definition, events)]); const records = recordChains(events);
  const sessionEvents = completedSessions.map((session) => ({ date: session.date, sessionId: session.id, sessionName: session.name }));
  const setEvents = []; let setCount = 0; events.filter((event) => event.metric !== 'weight').forEach((event) => { setCount += event.sets; setEvents.push({ ...event, cumulative: setCount }); });
  const sessionChain = milestoneChain('consistency-sessions', 'consistency', 'Séances terminées', 'Nombre total de séances validées', [10, 50, 100], completedSessions.length, sessionEvents, 'séances');
  const setChain = { ...milestoneChain('volume-sets', 'volume', 'Séries réalisées', 'Volume cumulé de séries terminées', [100, 500, 1000], setCount, setEvents, 'séries') };
  setChain.awards = setChain.thresholds.map((threshold, index) => ({ grade: trophyGrades[index], threshold, earned: setCount >= threshold, event: setEvents.find((event) => event.cumulative >= threshold) }));
  return [...figures, ...records, sessionChain, consistencyChain(completedSessions), setChain];
}
function persistTrophyUnlocks(collection) {
  const unlocks = readStore('trophy-unlocks', {}); const newUnlocks = [];
  if (localStorage.getItem('figure-trophy-taxonomy') !== '2') {
    Object.keys(unlocks).filter((key) => /^figure-(?:planche|front-lever)/.test(key)).forEach((key) => delete unlocks[key]);
    localStorage.setItem('figure-trophy-taxonomy', '2');
  }
  collection.forEach((chain) => chain.awards.filter((award) => award.earned).forEach((award) => { const key = `${chain.id}:${award.grade}`; if (!unlocks[key]) { unlocks[key] = { trophyId: chain.id, grade: award.grade, date: award.event?.date || toIso(new Date()), sessionId: award.event?.sessionId || null, sessionName: award.event?.sessionName || '' }; newUnlocks.push({ chain, award }); } }));
  localStorage.setItem('trophy-unlocks', JSON.stringify(unlocks));
  if (newUnlocks.length) { const latest = newUnlocks.at(-1); const toast = document.querySelector('#achievement-toast'); toast.innerHTML = `<span class="medal ${latest.award.grade}">${familyIcons[latest.chain.family]}</span><div><small>TROPHÉE ${gradeLabels[latest.award.grade].toUpperCase()}</small><strong>${escapeHtml(latest.chain.title)}</strong></div>`; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4500); }
  return unlocks;
}
function chainGrade(chain) { return [...chain.awards].reverse().find((award) => award.earned)?.grade || 'locked'; }
function trophyProgress(chain) { const next = chain.awards.find((award) => !award.earned); if (!next) return 100; const previous = [...chain.awards].reverse().find((award) => award.earned)?.threshold || 0; return Math.max(0, Math.min(100, ((chain.value - previous) / Math.max(1, next.threshold - previous)) * 100)); }
function trophyCard(chain) {
  const grade = chainGrade(chain); const next = chain.awards.find((award) => !award.earned); const unlocks = readStore('trophy-unlocks', {}); const latestAward = [...chain.awards].reverse().find((award) => award.earned); const unlocked = latestAward ? unlocks[`${chain.id}:${latestAward.grade}`] : null;
  return `<article class="trophy-item ${grade === 'locked' ? 'locked' : ''}"><div class="trophy-medal ${grade}"><span>${familyIcons[chain.family]}</span></div><div class="trophy-info"><span>${familyLabels[chain.family]}</span><strong>${escapeHtml(chain.title)}</strong><small>${escapeHtml(chain.description)}</small><div class="trophy-grades">${chain.awards.map((award) => `<i class="${award.grade} ${award.earned ? 'earned' : ''}" title="${gradeLabels[award.grade]} : ${award.threshold} ${chain.unit}"></i>`).join('')}</div><div class="trophy-progress"><i style="width:${trophyProgress(chain)}%"></i></div><em>${next ? `${chain.value} / ${next.threshold} ${chain.unit} vers ${gradeLabels[next.grade]}` : `Maximum atteint · ${chain.value} ${chain.unit}`}${unlocked ? ` · débloqué le ${new Date(`${unlocked.date}T12:00`).toLocaleDateString('fr-FR')}` : ''}</em></div></article>`;
}
function renderTrophies() {
  const collection = trophyCollection(); persistTrophyUnlocks(collection); const earned = collection.filter((chain) => chainGrade(chain) !== 'locked'); const gradeCounts = trophyGrades.reduce((result, grade) => ({ ...result, [grade]: collection.reduce((sum, chain) => sum + chain.awards.filter((award) => award.grade === grade && award.earned).length, 0) }), {});
  document.querySelector('#trophy-summary').innerHTML = `<strong>${gradeCounts.bronze + gradeCounts.silver + gradeCounts.gold}</strong><span>grades débloqués</span><div><b class="gold">${gradeCounts.gold} or</b><b class="silver">${gradeCounts.silver} argent</b><b class="bronze">${gradeCounts.bronze} bronze</b></div>`;
  const preview = [...earned].sort((a, b) => trophyGrades.indexOf(chainGrade(b)) - trophyGrades.indexOf(chainGrade(a))).slice(0, 3);
  document.querySelector('#trophy-preview').innerHTML = preview.length ? preview.map(trophyCard).join('') : '<div class="empty-volume"><strong>Premiers trophées à débloquer</strong><span>Termine une séance et renseigne tes séries pour commencer la collection.</span></div>';
}
function openTrophyCollection() {
  const collection = trophyCollection(); const groups = Object.keys(familyLabels).map((family) => { const items = collection.filter((chain) => chain.family === family); return `<section class="trophy-family"><div class="trophy-family-heading"><span>${familyIcons[family]}</span><div><small>CATÉGORIE</small><strong>${familyLabels[family]}</strong></div><b>${items.filter((item) => chainGrade(item) !== 'locked').length}/${items.length}</b></div><div class="trophy-grid">${items.map(trophyCard).join('')}</div></section>`; }).join('');
  document.querySelector('#trophy-content').innerHTML = `<p class="kicker">COLLECTION</p><h2>Mes trophées</h2><p class="help-text">Seules les séances entièrement terminées comptent. Atteindre un grade débloque aussi tous les grades inférieurs.</p>${groups}`; trophyDialog.showModal();
}
function objectiveDetails(label) {
  const text = String(label).trim();
  const seconds = text.match(/(\d+(?:[.,]\d+)?)\s*s(?:ec(?:onde)?s?)?\b/i);
  const repetitions = text.match(/(\d+(?:[.,]\d+)?)\s*x\s*/i);
  const match = seconds || repetitions;
  const metric = seconds ? 'seconds' : 'repetitions';
  const target = match ? Number(match[1].replace(',', '.')) : null;
  const exercise = text
    .replace(/\b\d+(?:[.,]\d+)?\s*s(?:ec(?:onde)?s?)?\b/ig, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*x\s*/ig, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { label: text, target, metric, exercise };
}
function blockPeriod(text) {
  const dates = [...String(text).matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g)].map((match) => {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  });
  return dates.length >= 2 ? { startDate: dates[0], endDate: dates[1] } : { startDate: null, endDate: null };
}
function blockObjectiveProgress(block, objective) {
  const details = objectiveDetails(objective.label); if (!details.target) return { best: 'objectif à préciser', progress: 0, unit: '' };
  const key = exerciseKey(details.exercise); let best = 0; const unit = details.metric === 'seconds' ? 's' : 'rép.';
  const sessions = getSessions().filter((session) => (!block.startDate || session.date >= block.startDate) && (!block.endDate || session.date <= block.endDate));
  sessions.forEach((session) => (session.exercises || []).forEach((exercise, index) => {
    if (exerciseMatchKey(exercise) !== key) return;
    best = Math.max(best, ...effectiveExerciseValues(session, exercise, index));
  }));
  return { best: best ? `${best} ${unit}` : 'aucune valeur', progress: Math.min(100, (best / details.target) * 100), unit };
}
function renderJournal() {
  const today = toIso(new Date()); const recent = getSessions().filter((session) => session.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  document.querySelector('#sessions .session-list').innerHTML = recent.length ? recent.map((session) => {
    const date = new Date(`${session.date}T12:00`); const completion = sessionCompletion(session);
    const status = session.isRest ? 'Repos' : completion.state === 'complete' ? 'Terminée' : completion.completed ? `${completion.completed}/${completion.total} exercices` : 'À renseigner';
    const journalState = session.isRest ? 'complete' : completion.state; const journalIcon = session.isRest || completion.state === 'complete' ? '✓' : '→';
    return `<button type="button" class="session journal-session" data-journal-session-id="${session.id}"><div class="session-date"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase()}</span></div><div class="session-info"><strong>${escapeHtml(session.name)}</strong><span>${escapeHtml(status)}</span></div><span class="journal-status status-${journalState}">${journalIcon}</span><span class="chevron">›</span></button>`;
  }).join('') : '<p class="empty-state">Aucune séance passée dans le calendrier.</p>';
}
function renderBlockCockpit(block, sessions) {
  const panel = document.querySelector('#progress');
  if (!block) { panel.innerHTML = '<div class="panel-heading"><div><p class="kicker">PROGRESSION DU BLOC</p><h2>Le prochain cycle en un regard</h2></div></div><div class="block-cockpit-empty"><strong>En attente de la période du bloc</strong><p>Les trois indicateurs apparaîtront dès que les dates seront renseignées dans « Plan d’entraînement ».</p></div>'; return; }
  const today = new Date(`${toIso(new Date())}T12:00`); const start = new Date(`${block.startDate}T12:00`); const end = new Date(`${block.endDate}T12:00`);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1); const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((today - start) / 86400000) + 1)); const periodProgress = (elapsedDays / totalDays) * 100;
  const blockSessions = sessions.filter((session) => session.date >= block.startDate && session.date <= block.endDate); const completedSessions = blockSessions.filter((session) => sessionCompletion(session).state === 'complete').length; const sessionProgress = blockSessions.length ? (completedSessions / blockSessions.length) * 100 : 0;
  const objectiveResults = block.objectives.map((objective) => ({ objective, result: blockObjectiveProgress(block, objective) })); const objectiveProgress = objectiveResults.length ? objectiveResults.reduce((sum, item) => sum + item.result.progress, 0) / objectiveResults.length : 0;
  const indicator = (label, value, note, css) => `<article class="block-indicator ${css}"><div><span>${label}</span><strong>${Math.round(value)}%</strong></div><div class="block-indicator-bar"><i style="width:${value}%"></i></div><small>${note}</small></article>`;
  panel.innerHTML = `<div class="panel-heading"><div><p class="kicker">PROGRESSION DU BLOC ${block.number}</p><h2>Le cycle en un regard</h2><p class="panel-subtitle">${start.toLocaleDateString('fr-FR')} – ${end.toLocaleDateString('fr-FR')}</p></div></div><div class="block-indicators">${indicator('Période écoulée', periodProgress, `${elapsedDays} jours sur ${totalDays}`, 'period')}${indicator('Séances terminées', sessionProgress, `${completedSessions} sur ${blockSessions.length}`, 'sessions')}${indicator('Objectifs complétés', objectiveProgress, `${block.objectives.length} objectif${block.objectives.length > 1 ? 's' : ''} suivi${block.objectives.length > 1 ? 's' : ''}`, 'objectives')}</div><div class="block-objective-list">${objectiveResults.length ? objectiveResults.map(({ objective, result }) => `<article><div><strong>${escapeHtml(objective.label)}</strong><span>Meilleure performance : ${escapeHtml(result.best)}</span></div><b>${Math.round(result.progress)}%</b><div class="block-objective-bar"><i style="width:${result.progress}%"></i></div></article>`).join('') : '<p class="empty-state">Aucun objectif renseigné pour ce bloc.</p>'}</div>`;
}
function renderDashboard() {
  const sessions = getSessions().filter((session) => !session.isRest);
  const today = toIso(new Date()); const blocks = readStore('training-blocks', []);
  const block = blocks.find((item) => item.startDate && item.endDate && today >= item.startDate && today <= item.endDate);
  const blockStatus = document.querySelector('#block-session-status');
  if (block) {
    const blockSessions = sessions.filter((session) => session.date >= block.startDate && session.date <= block.endDate);
    const blockCompleted = blockSessions.filter((session) => sessionCompletion(session).state === 'complete').length;
    const percentage = blockSessions.length ? (blockCompleted / blockSessions.length) * 100 : 0;
    blockStatus.innerHTML = `<span>BLOC ${block.number} · ${new Date(`${block.startDate}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(`${block.endDate}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><strong>${blockCompleted} <small>/ ${blockSessions.length} séances</small></strong><div class="week-bar"><i style="width:${percentage}%"></i></div><p>${Math.round(percentage)} % du bloc réalisé</p>`;
  } else {
    blockStatus.innerHTML = '<span>BLOC À PLANIFIER</span><strong>— <small>/ — séances</small></strong><div class="week-bar"><i style="width:0%"></i></div><p>Période à renseigner dans le tableau</p>';
  }
  let sessionCard;
  if (block) {
    const periodSessions = sessions.filter((session) => session.date >= block.startDate && session.date <= block.endDate);
    const periodCompleted = periodSessions.filter((session) => sessionCompletion(session).state === 'complete').length;
    const periodProgress = periodSessions.length ? (periodCompleted / periodSessions.length) * 100 : 0;
    sessionCard = `<article class="stat-card session-total-card"><span class="stat-label">SÉANCES RÉALISÉES · BLOC ${block.number}</span><strong>${periodCompleted}<span class="unit"> / ${periodSessions.length}</span></strong><span class="stat-note">Sur la durée du bloc · ${new Date(`${block.startDate}T12:00`).toLocaleDateString('fr-FR')} au ${new Date(`${block.endDate}T12:00`).toLocaleDateString('fr-FR')}</span><div class="mini-progress"><i style="width:${periodProgress}%"></i></div></article>`;
  } else {
    sessionCard = '<article class="stat-card session-total-card block-waiting"><span class="stat-label">SÉANCES RÉALISÉES · BLOC</span><strong>—<span class="unit"> / —</span></strong><span class="stat-note">Objectif calculé sur la durée du bloc dès que sa période sera renseignée dans « Plan d’entraînement ».</span><div class="mini-progress"><i style="width:0%"></i></div></article>';
  }
  const goalCards = block && block.objectives.length ? block.objectives.map((objective) => { const result = blockObjectiveProgress(block, objective); return `<article class="stat-card block-goal-card"><span class="stat-label">OBJECTIF · BLOC ${block.number}</span><strong>${escapeHtml(objective.label)}</strong><span class="stat-note">Meilleure performance : ${escapeHtml(result.best)}</span><div class="mini-progress"><i style="width:${result.progress}%"></i></div></article>`; }).join('') : Array.from({ length: 3 }, (_, index) => `<article class="stat-card block-waiting"><span class="stat-label">OBJECTIF ${index + 1} · PROCHAIN BLOC</span><strong>À définir</strong><span class="stat-note">S’affichera dès que la période du bloc sera renseignée dans le tableau.</span><div class="mini-progress"><i style="width:0%"></i></div></article>`).join('');
  document.querySelector('#dashboard-stats').innerHTML = sessionCard + goalCards;
  renderJournal(); renderBlockCockpit(block, sessions); renderWeeklyVolume(); renderTrophies();
  if (document.body.classList.contains('all-sessions-open')) renderAllSessions();
}
function renderCalendar() {
  const today = toIso(new Date()); let start; let days;
  const sessionsByDate = new Map();
  getSessions().forEach((session) => { if (!sessionsByDate.has(session.date)) sessionsByDate.set(session.date, []); sessionsByDate.get(session.date).push(session); });
  const dailySteps = readStore('daily-steps', {});
  if (calendarView === 'week') {
    start = startOfWeek(calendarDate); days = 7; const end = new Date(start); end.setDate(end.getDate() + 6);
    document.querySelector('#calendar-title').textContent = `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  } else {
    start = startOfWeek(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1, 12)); days = 42;
    document.querySelector('#calendar-title').textContent = calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  calendarGrid.className = `calendar-grid ${calendarView}`;
  let calendarHtml = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => `<div class="calendar-day-name">${day}</div>`).join('');
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start); date.setDate(start.getDate() + index); const iso = toIso(date);
    const state = iso === today ? 'today' : iso < today ? 'past' : 'upcoming';
    const outside = calendarView === 'month' && date.getMonth() !== calendarDate.getMonth() ? ' outside' : '';
    const sessionsForDay = sessionsByDate.get(iso) || [];
    const cards = sessionsForDay.map((session) => { const completion = sessionCompletion(session); const steps = dailySteps[session.date]; return `<button type="button" class="calendar-session ${session.isRest ? 'rest-session' : session.isFreeSession ? 'free-session' : `completion-${completion.state}`}" data-workout-id="${session.id}"><strong>${session.videoRequired ? '🎬 ' : ''}${escapeHtml(session.name)}</strong><span>${session.isRest ? `👟 ${steps ? Number(steps).toLocaleString('fr-FR') : '—'} pas` : session.exercises?.length ? session.exercises.map((exercise) => { const raw = typeof exercise === 'string' ? exercise : exercise.name; return escapeHtml(canonicalExerciseName(exerciseKey(raw), raw)); }).join(' · ') : 'Voir la séance'}</span>${completion.total && completion.completed ? `<small>${completion.completed}/${completion.total} exercice${completion.total > 1 ? 's' : ''}</small>` : ''}${session.videoRequired ? '<b class="film-badge">À FILMER</b>' : ''}</button>`; }).join('');
    const daySessions = sessionsForDay.filter((session) => !session.isRest);
    const dayStates = daySessions.map((session) => sessionCompletion(session).state);
    const dayCompletion = !dayStates.length ? '' : dayStates.every((item) => item === 'complete') ? ' day-complete' : dayStates.some((item) => item !== 'none') ? ' day-progress' : ' day-none';
    calendarHtml += `<div class="calendar-day ${state}${outside}${dayCompletion}"><div class="day-number"><span>${date.getDate()}</span>${iso === today ? '<b>Aujourd’hui</b>' : ''}</div>${cards}</div>`;
  }
  calendarGrid.innerHTML = calendarHtml;
}
document.querySelectorAll('[data-calendar-view]').forEach((button) => button.addEventListener('click', () => { calendarView = button.dataset.calendarView; document.querySelectorAll('[data-calendar-view]').forEach((item) => item.classList.toggle('active', item === button)); renderCalendar(); }));
document.querySelector('[data-calendar-prev]').addEventListener('click', () => { if (calendarView === 'week') calendarDate.setDate(calendarDate.getDate() - 7); else { calendarDate.setDate(1); calendarDate.setMonth(calendarDate.getMonth() - 1); } renderCalendar(); });
document.querySelector('[data-calendar-next]').addEventListener('click', () => { if (calendarView === 'week') calendarDate.setDate(calendarDate.getDate() + 7); else { calendarDate.setDate(1); calendarDate.setMonth(calendarDate.getMonth() + 1); } renderCalendar(); });
document.querySelector('[data-calendar-today]').addEventListener('click', () => { calendarDate = new Date(); renderCalendar(); });

document.querySelector('#session-form').addEventListener('submit', (event) => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  const preset = data.get('titlePreset'); const name = preset === '' ? data.get('name').trim() : preset;
  const isRestPreset = preset === 'Repos'; const isFreePreset = preset === 'Séance libre';
  const editId = document.querySelector('#session-edit-id').value; const existing = editId ? getSessions().find((item) => item.id === editId) : null;
  const chosen = isRestPreset ? [] : [...document.querySelectorAll('[data-session-exercise]:checked')]; const available = getDisplayExercises();
  const exerciseDrafts = chosen.map((input) => { const exercise = available.find((item) => item.id === input.dataset.sessionExercise); const seriesCount = Number(document.querySelector(`[data-series-for="${input.dataset.sessionExercise}"]`).value) || 1; const metric = exercise.metrics.includes('tension') && !exercise.metrics.includes('repetitions') ? 'seconds' : 'repetitions'; return { name: exercise.name, metric, seriesCount, targets: Array(seriesCount).fill(0), matchKey: exercise.matchKey || exerciseKey(exercise.name) }; });
  const existingExercises = existing?.exercises || []; const unchangedExercises = exerciseDrafts.length === existingExercises.length && exerciseDrafts.every((draft) => existingExercises.some((exercise) => exerciseMatchKey(exercise) === exerciseMatchKey(draft) && Number(exercise.seriesCount || exercise.targets?.length || 1) === draft.seriesCount));
  const exercises = unchangedExercises ? existingExercises : exerciseDrafts;
  const error = document.querySelector('#session-error'); if (!name) { error.textContent = 'Choisis un type ou saisis un titre complémentaire.'; return; } if (!exercises.length && !isRestPreset && !isFreePreset) { error.textContent = 'Sélectionne au moins un exercice.'; return; }
  const session = { id: editId || `session-${Date.now()}`, source: existing?.source || 'manual', date: data.get('date'), name, duration: Number(data.get('duration') || event.currentTarget.dataset.templateDuration) || null, energy: Number(data.get('energy') || event.currentTarget.dataset.templateEnergy) || null, instructions: data.get('instructions').trim(), exercises, isRest: isRestPreset, isFreeSession: isFreePreset, modifiedAt: new Date().toISOString() };
  if (existing?.source === 'google-sheet') { const sheetSession = readStore('sheet-sessions', []).find((item) => item.id === editId) || existing; const comparableSheetSession = { ...sheetSession, instructions: sheetSession.instructions ?? sheetSession.coachInfo ?? '' }; const overrides = readStore('session-overrides', {}); overrides[editId] = buildSessionOverride(comparableSheetSession, session, session.modifiedAt); localStorage.setItem('session-overrides', JSON.stringify(overrides)); }
  else { const sessions = readStore('calisthenics-sessions', defaultSessions); const index = sessions.findIndex((item) => item.id === session.id); if (index >= 0) sessions[index] = session; else sessions.push(session); saveSessions(sessions); }
  queueSharedWrite('session-upsert', existing?.source === 'google-sheet' ? { ...session, overrideFields: readStore('session-overrides', {})[editId]?.overrideFields || [] } : session);
  if (event.currentTarget.dataset.mode === 'duplicate') calendarDate = new Date(`${session.date}T12:00:00`);
  renderCalendar(); renderExercises(); renderDashboard(); event.currentTarget.reset(); dialog.close();
});

function csvUrl(url) { const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]; if (!id) throw new Error("Ce lien ne ressemble pas à un lien Google Sheets."); return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${new URL(url).searchParams.get('gid') || 0}`; }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const c = text[i]; if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; } else cell += c; }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}
function parseDate(value) { const match = String(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`; return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
const improvements = [[/^traction(s)?$/i, 'Tractions pronation'], [/^pompe(s)?$/i, 'Pompes au poids du corps'], [/^dip(s)?$/i, 'Dips aux barres parallèles'], [/^squat(s)?$/i, 'Squats au poids du corps'], [/muscle.?up/i, 'Muscle-up strict'], [/hand.?stand/i, 'Handstand']];
const improve = (name) => improvements.find(([pattern]) => pattern.test(name.trim()))?.[1] || name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
function buildImport(rows) {
  if (rows.length < 2) throw new Error('Le tableau ne contient aucune séance à importer.');
  const headers = rows[0].map(normalize); const col = (...names) => headers.findIndex((header) => names.map(normalize).includes(header));
  const index = { date: col('date'), name: col('séance', 'seance', 'nom'), duration: col('durée', 'duree', 'minutes'), place: col('lieu'), energy: col('énergie', 'energie'), exercises: col('exercices', 'exercice') };
  if (index.date < 0 || index.name < 0) throw new Error('Les colonnes « Date » et « Séance » sont obligatoires.');
  const sessions = rows.slice(1).map((row, i) => ({ id: `import-${Date.now()}-${i}`, date: parseDate(row[index.date]), name: row[index.name]?.trim(), duration: Number.parseInt(row[index.duration], 10) || null, place: row[index.place]?.trim() || '', energy: Number.parseFloat(String(row[index.energy]).replace(',', '.')) || null, exercises: index.exercises >= 0 ? (row[index.exercises] || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean) : [] })).filter((session) => session.date && session.name);
  if (!sessions.length) throw new Error('Aucune ligne valide. Utilise une date JJ/MM/AAAA ou AAAA-MM-JJ.');
  const known = getExercises(); const names = [...new Set(sessions.flatMap((session) => session.exercises))];
  return { sessions, unknown: names.filter((name) => !known.some((item) => normalize(item.name) === normalize(name))).map((original) => ({ original, proposal: improve(original) })) };
}
function showReview(data) {
  pendingImport = data; document.querySelector('#import-step-source').hidden = true; document.querySelector('#import-step-review').hidden = false;
  document.querySelector('#review-summary').innerHTML = `<strong>${data.sessions.length}</strong> séance(s) détectée(s) · <strong>${data.unknown.length}</strong> nouvel exercice(s)`;
  document.querySelector('#exercise-review-list').innerHTML = data.unknown.length ? data.unknown.map((item, i) => `<label class="review-exercise"><span><small>Dans le tableau</small><s>${escapeHtml(item.original)}</s></span><b>→</b><span><small>Nom proposé</small><input data-proposal="${i}" value="${escapeHtml(item.proposal)}" required></span><select data-metric="${i}"><option value="repetitions">Répétitions</option><option value="tension">Temps sous tension</option><option value="weight">Charge</option></select></label>`).join('') : '<p class="all-known">Tous les exercices existent déjà dans ta bibliothèque.</p>';
  document.querySelector('#session-review-list').innerHTML = data.sessions.map((session) => `<article><time>${new Date(`${session.date}T12:00`).toLocaleDateString('fr-FR')}</time><span><strong>${escapeHtml(session.name)}</strong><small>${session.duration ? `${session.duration} min` : 'Durée non indiquée'}${session.exercises.length ? ` · ${session.exercises.map(escapeHtml).join(', ')}` : ''}</small></span></article>`).join('');
}
document.querySelector('[data-open-import]').addEventListener('click', () => { importForm.reset(); document.querySelector('#import-error').textContent = ''; document.querySelector('#import-step-source').hidden = false; document.querySelector('#import-step-review').hidden = true; importDialog.showModal(); });
document.querySelector('[data-close-import]').addEventListener('click', () => importDialog.close());
document.querySelector('[data-back-import]').addEventListener('click', () => { document.querySelector('#import-step-source').hidden = false; document.querySelector('#import-step-review').hidden = true; });
importForm.addEventListener('submit', async (event) => { event.preventDefault(); const error = document.querySelector('#import-error'); const button = importForm.querySelector('[type="submit"]'); error.textContent = ''; button.disabled = true; button.textContent = 'Analyse en cours…'; try { const response = await fetch(csvUrl(document.querySelector('#sheet-url').value)); if (!response.ok) throw new Error("Le tableau n'est pas accessible. Vérifie son partage public en lecture."); showReview(buildImport(parseCsv(await response.text()))); } catch (problem) { error.textContent = problem.message; } finally { button.disabled = false; button.innerHTML = 'Analyser le tableau <span>→</span>'; } });
document.querySelector('#confirm-import').addEventListener('click', () => {
  const proposals = pendingImport.unknown.map((item, i) => ({ original: item.original, name: document.querySelector(`[data-proposal="${i}"]`).value.trim(), metric: document.querySelector(`[data-metric="${i}"]`).value })); if (proposals.some((item) => !item.name)) return;
  const exercises = getExercises(); proposals.forEach((item, i) => exercises.push({ id: `imported-exercise-${Date.now()}-${i}`, name: item.name, metrics: [item.metric] }));
  const sessions = pendingImport.sessions.map((session) => ({ ...session, exercises: session.exercises.map((name) => proposals.find((item) => item.original === name)?.name || name) }));
  saveExercises(exercises); saveSessions([...getSessions(), ...sessions]); renderExercises(); renderCalendar(); importDialog.close();
});

const frenchDays = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
function sheetDate(value, year) {
  const match = String(value).toLowerCase().match(/^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\/(\d{1,2})/);
  return match ? `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
}

function exerciseMetric(name) {
  const official = resolveCatalogExercise(name);
  if (official?.metrics?.length === 1) return official.metrics[0] === 'tension' ? 'seconds' : official.metrics[0];
  const lower = name.toLowerCase();
  const repetitions = /raise|pull.?up|push.?up|hspu|pike|traction|rep/.test(lower);
  return !repetitions && /hold|maintien|handstand|\bhs\b|\bfl\b|planche|lean|olfl|adv.?t|tp/.test(lower) ? 'seconds' : 'repetitions';
}

function parseTrainingSheet(rows, sourceKey = 'primary', sheetYear = null, sheetMonth = null) {
  const anchors = rows[0].map((cell, index) => String(cell).toUpperCase() === 'SEMAINE' ? index : -1).filter((index) => index >= 0);
  const statedYears = rows.flat().map(String).flatMap((cell) => cell.match(/\b20\d{2}\b/g) || []).map(Number);
  const year = sheetYear || statedYears[0] || new Date().getFullYear();
  const dateFor = (value) => {
    const initial = sheetDate(value, year); if (!initial || sheetMonth === null) return initial;
    const dateMonth = Number(initial.slice(5, 7)) - 1; let resolvedYear = year;
    if (sheetMonth === 0 && dateMonth === 11) resolvedYear -= 1;
    if (sheetMonth === 11 && dateMonth === 0) resolvedYear += 1;
    return `${resolvedYear}${initial.slice(4)}`;
  };
  const sessions = [];
  anchors.forEach((anchor) => {
    const dates = rows.map((row, index) => dateFor(row[anchor]) ? index : -1).filter((index) => index >= 0);
    dates.forEach((dateRow, dateIndex) => {
      const end = dates[dateIndex + 1] ?? rows.length;
      const titleCell = String(rows[dateRow + 1]?.[anchor] || '').trim();
      const isRest = /^repos$/i.test(titleCell);
      let isFreeSession = /^(?:legz|legs|bras|dos|pecs)$/i.test(normalize(titleCell));
      const exercises = isFreeSession ? [{ name: titleCell.toUpperCase(), targets: [], metric: 'repetitions', seriesCount: 1 }] : []; let coachInfo = ''; let studentInfo = '';
      for (let rowIndex = dateRow + 2; rowIndex < end; rowIndex += 1) {
        const name = String(rows[rowIndex]?.[anchor] || '').trim();
        const infoLabel = normalize(name); const infoText = rows[rowIndex].slice(anchor + 1, anchor + 13).map((cell) => String(cell || '').trim()).filter((cell) => cell && !/^0$/.test(cell)).join(' ').trim();
        if (infoLabel.startsWith('infoscoach') || infoLabel.startsWith('infocoach')) { coachInfo = infoText; continue; }
        if (infoLabel.startsWith('infoseleve') || infoLabel.startsWith('infoeleve')) { studentInfo = infoText; continue; }
        if (infoLabel === 'gtg') continue;
        if (!name || !Number.isNaN(Number(name))) continue;
        const targets = (rows[rowIndex + 1] || []).slice(anchor, anchor + 10).map(Number).filter((value) => Number.isFinite(value) && value > 0);
        const exerciseNames = /^l\s*flpu\s*\/\s*dl\s*inverse\*?$/i.test(name) ? ['L FLPU', 'DL INVERSE'] : [name];
        exerciseNames.forEach((exerciseName) => exercises.push({ name: exerciseName, targets, metric: exerciseMetric(exerciseName) }));
      }
      if (!titleCell && exercises.length === 1 && /^(?:legz|legs|bras|dos|pecs)$/i.test(normalize(exercises[0].name))) { isFreeSession = true; exercises[0].seriesCount = exercises[0].seriesCount || 1; }
      if (!titleCell && !exercises.length) return;
      const parsedSession = {
        source: 'google-sheet', date: dateFor(rows[dateRow][anchor]),
        name: isRest ? 'Repos' : isFreeSession ? 'Séance libre' : (titleCell.replace(/^Séance\s*\d*\s*:\s*/i, '') || 'Séance d’entraînement'),
        isRest, isFreeSession, exercises, coachInfo, studentInfo, videoRequired: /film|vidéo|video|🎬/i.test(coachInfo),
        sheetSlotKey: `${sourceKey}|${anchor}|${dateRow}`,
      };
      parsedSession.id = stableSheetSessionId(parsedSession); sessions.push(parsedSession);
    });
  });
  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

function responseRows(response) {
  if (response.status !== 'ok') throw new Error('Réponse Google Sheets incorrecte.');
  return response.table.rows.map((row) => Array.from({ length: response.table.cols.length }, (_, index) => {
    const cell = row.c?.[index]; return cell?.f ?? cell?.v ?? '';
  }));
}
function saveSheetResponse(response, sourceKey) {
  const sessions = parseTrainingSheet(responseRows(response), sourceKey);
  if (!sessions.length) throw new Error('Aucune séance reconnue dans le tableau.');
  localStorage.setItem(`sheet-sessions-${sourceKey}`, JSON.stringify(sessions));
  const signature = (session) => `${session.date}|${normalize(session.name)}|${session.isRest ? 'repos' : (session.exercises || []).map(exerciseMatchKey).join(',')}`;
  const combined = ['calendar'].flatMap((key) => readStore(`sheet-sessions-${key}`, [])).filter((session, index, list) => list.findIndex((item) => signature(item) === signature(session)) === index);
  localStorage.setItem('sheet-sessions', JSON.stringify(combined));
  localStorage.setItem('sheet-last-sync', new Date().toISOString());
  document.querySelector('#sync-status').textContent = `Google Sheets synchronisé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  scheduleDataRender();
}

function sessionSignature(session) {
  return `${session.date}|${normalize(session.name)}|${session.isRest ? 'repos' : (session.exercises || []).map(exerciseMatchKey).join(',')}`;
}
function stableSheetSessionId(session) {
  const value = session.sheetSlotKey || sessionSignature(session); let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `sheet-stable-${(hash >>> 0).toString(36)}`;
}
function preserveSyncedSessionState(previousSessions, nextSessions) {
  const previousBySignature = new Map(previousSessions.map((session) => [sessionSignature(session), session]));
  const progress = readStore('workout-progress', {}); const overrides = readStore('session-overrides', {}); const hidden = new Set(readStore('hidden-sessions', [])); let changed = false;
  nextSessions.forEach((session) => {
    const previous = previousBySignature.get(sessionSignature(session)); if (!previous || previous.id === session.id) return;
    if (progress[previous.id] && !progress[session.id]) { progress[session.id] = progress[previous.id]; changed = true; }
    if (overrides[previous.id] && !overrides[session.id]) { overrides[session.id] = { ...overrides[previous.id], id: session.id }; changed = true; }
    if (hidden.has(previous.id)) { hidden.add(session.id); changed = true; }
  });
  if (changed) { localStorage.setItem('workout-progress', JSON.stringify(progress)); localStorage.setItem('session-overrides', JSON.stringify(overrides)); localStorage.setItem('hidden-sessions', JSON.stringify([...hidden])); }
}
function saveIndexedSessions(groups, loadedTabs, totalTabs) {
  const sessionsBySignature = new Map(); groups.flat().forEach((session) => { const signature = sessionSignature(session); if (!sessionsBySignature.has(signature)) sessionsBySignature.set(signature, session); });
  const combined = [...sessionsBySignature.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!combined.length) throw new Error('Aucune séance reconnue dans les onglets de l’INDEX.');
  preserveSyncedSessionState(readStore('sheet-sessions', []), combined);
  localStorage.setItem('sheet-sessions', JSON.stringify(combined));
  localStorage.setItem('sheet-calendar-tabs', JSON.stringify(loadedTabs));
  localStorage.setItem('sheet-last-sync', new Date().toISOString());
  localStorage.removeItem('sheet-sessions-primary'); localStorage.removeItem('sheet-sessions-recent'); localStorage.removeItem('sheet-sessions-calendar');
  if (sharedBackendReady() && currentGoogleCredential()) {
    queueSharedWrite('sheet-calendar-sync', {
      sessions: combined.map((session) => ({
        id: session.id, date: session.date, name: session.name, source: 'google-sheet', isRest: Boolean(session.isRest),
        isFreeSession: Boolean(session.isFreeSession), instructions: session.coachInfo || '', exercises: session.exercises || [],
        studentInfo: session.studentInfo || '', modifiedAt: new Date().toISOString(),
      })),
    });
  }
  const first = combined[0].date; const last = combined.at(-1).date;
  document.querySelector('#sync-status').textContent = `${SHEET_SOURCE_LABEL} · ${loadedTabs.length}/${totalTabs} onglets synchronisés · ${new Date(`${first}T12:00`).toLocaleDateString('fr-FR')} – ${new Date(`${last}T12:00`).toLocaleDateString('fr-FR')}`;
  scheduleDataRender();
}

function saveBlocksRows(rows) {
  const cells = rows.flat().map(String).filter((cell) => /BLOC\s+\d+/i.test(cell));
  const blocks = cells.map((cell) => {
    const number = Number(cell.match(/BLOC\s+(\d+)/i)?.[1]); const objectiveText = cell.match(/Objectif\s*:\s*([\s\S]*?)(?=Séance\s*1|$)/i)?.[1]?.trim() || '';
    const objectives = objectiveText.split(/[,;\n]+/).map((text) => text.trim()).filter(Boolean).map((label) => ({ ...objectiveDetails(label), progress: 0, best: null }));
    return { id: `block-${number}`, number, objectives, ...blockPeriod(cell) };
  }).filter((block) => block.number);
  localStorage.setItem('training-blocks', JSON.stringify(blocks));
  localStorage.removeItem('active-training-block');
  scheduleDataRender();
}
function saveBlocksResponse(response) { saveBlocksRows(responseRows(response)); }

function addSheetScript(id, callbackName, sheetName = '') {
  if (document.querySelector(`#${id}`)) return;
  const script = document.createElement('script'); script.id = id; script.onerror = () => { window[callbackName]?.(null); script.remove(); };
  const sheet = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
  script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${callbackName}${sheet}&_=${Date.now()}`;
  document.head.appendChild(script);
}

function syncGoogleSheetPublic() {
  if (document.body.dataset.sheetSync === 'running') return;
  document.body.dataset.sheetSync = 'running';
  const syncButton = document.querySelector('[data-sync-sheets]');
  if (syncButton) syncButton.disabled = true;
  const status = document.querySelector('#sync-status'); status.textContent = 'Actualisation discrète du calendrier…';
  window.receiveSheetIndex = (response) => {
    document.querySelector('#sheet-sync-index')?.remove();
    try {
      const tabs = responseRows(response).slice(1).map((row) => String(row[0] || '').trim()).filter(Boolean);
      if (!tabs.length) throw new Error('L’onglet INDEX ne contient aucun nom d’onglet.');
      const groups = []; const loadedTabs = []; let nextTabIndex = 0; let activeLoads = 0; let completedTabs = 0; let syncFinished = false; const maximumParallelLoads = 2;
      const finishAll = () => {
        if (syncFinished) return;
        syncFinished = true;
        try { saveIndexedSessions(groups, loadedTabs, tabs.length); }
        catch (error) { status.textContent = `Dernières données conservées · ${error.message}`; }
        finally { delete document.body.dataset.sheetSync; if (syncButton) syncButton.disabled = false; }
      };
      const launchNext = () => {
        if (completedTabs === tabs.length) { finishAll(); return; }
        while (activeLoads < maximumParallelLoads && nextTabIndex < tabs.length) {
          const index = nextTabIndex; const tab = tabs[nextTabIndex]; nextTabIndex += 1; activeLoads += 1;
        const callback = `receiveCalendarTab${index}`; const id = `sheet-sync-tab-${index}`; const year = Number(tab.match(/\b20\d{2}\b/)?.[0]) || null;
        const monthNames = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']; const month = monthNames.findIndex((name) => normalize(tab).startsWith(name));
        window[callback] = (tabResponse) => { try { if (tabResponse) { const sessions = parseTrainingSheet(responseRows(tabResponse), `tab:${tab}`, year, month >= 0 ? month : null); if (sessions.length) { groups.push(sessions); loadedTabs.push(tab); } } } catch {} document.querySelector(`#${id}`)?.remove(); delete window[callback]; activeLoads -= 1; completedTabs += 1; status.textContent = `Actualisation du calendrier… ${completedTabs}/${tabs.length}`; setTimeout(launchNext, 0); };
        addSheetScript(id, callback, tab);
        }
      };
      launchNext();
    } catch (error) { status.textContent = `Dernières données conservées · ${error.message}`; delete document.body.dataset.sheetSync; if (syncButton) syncButton.disabled = false; }
  };
  window.receiveTrainingBlocks = (response) => { try { saveBlocksResponse(response); } catch {} document.querySelector('#sheet-sync-blocks')?.remove(); };
  addSheetScript('sheet-sync-index', 'receiveSheetIndex', 'INDEX');
  addSheetScript('sheet-sync-blocks', 'receiveTrainingBlocks', "Plan d'entraînement");
}
function syncGoogleSheet() {
  if (document.body.dataset.sheetSync === 'running') return;
  if (!sharedBackendReady() || !currentGoogleCredential()) { syncGoogleSheetPublic(); return; }
  document.body.dataset.sheetSync = 'running';
  const syncButton = document.querySelector('[data-sync-sheets]'); if (syncButton) syncButton.disabled = true;
  const status = document.querySelector('#sync-status'); status.textContent = 'Lecture directe du Google Sheet…';
  sharedJsonp('calendar-source', async (response) => {
    try {
      if (!response?.ok || !Array.isArray(response.tabs)) throw new Error(response?.error || 'Source mensuelle indisponible.');
      const groups = []; const loadedTabs = [];
      for (let index = 0; index < response.tabs.length; index += 1) {
        const tab = response.tabs[index];
        const year = Number(String(tab.name).match(/\b20\d{2}\b/)?.[0]) || null;
        const monthNames = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
        const month = monthNames.findIndex((name) => normalize(tab.name).startsWith(name));
        const sessions = parseTrainingSheet(tab.rows || [], `tab:${tab.name}`, year, month >= 0 ? month : null);
        if (sessions.length) { groups.push(sessions); loadedTabs.push(tab.name); }
        // Les onglets peuvent être volumineux : rendre la main au navigateur
        // régulièrement évite de figer l'accueil pendant l'analyse.
        if (index % 2 === 1) await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      saveIndexedSessions(groups, loadedTabs, response.tabs.length);
      if (Array.isArray(response.blockRows) && response.blockRows.length) saveBlocksRows(response.blockRows);
    } catch (error) {
      status.textContent = `Lecture directe indisponible · essai de la source publique…`;
      delete document.body.dataset.sheetSync; if (syncButton) syncButton.disabled = false;
      syncGoogleSheetPublic(); return;
    }
    delete document.body.dataset.sheetSync; if (syncButton) syncButton.disabled = false;
  }, { refresh: Date.now() });
}
document.querySelector('[data-sync-sheets]').addEventListener('click', async () => {
  localStorage.removeItem('sheet-last-sync');
  if (sharedBackendReady()) { await flushSharedOutbox(); loadSharedSnapshot(true); }
  syncGoogleSheet();
});

function progressFor(sessionId) { const all = readStore('workout-progress', {}); return { all, current: all[sessionId] || { values: {}, comment: '' } }; }
function selectOptions(target, metric, selected) {
  const maximum = metric === 'seconds' ? Math.max(60, target + 30) : Math.max(30, target + 10);
  return `<option value="">—</option>${Array.from({ length: maximum + 1 }, (_, value) => `<option value="${value}" ${selected !== undefined && Number(selected) === value ? 'selected' : ''}>${value}</option>`).join('')}`;
}
function resolveCatalogExercise(name) {
  const value = normalize(name); if (!value) return null;
  const overrideId = readStore('exercise-alias-overrides', {})[value];
  const catalog = [...getExercises(), ...readStore('exercise-archive-catalog', [])];
  if (overrideId) return catalog.find((item) => item.id === overrideId) || null;
  return catalog.find((item) => [item.name, ...(item.aliases || [])].some((alias) => normalize(alias) === value)) || null;
}
function exerciseKey(name) { return resolveCatalogExercise(name)?.id || `unresolved-${normalize(name)}`; }
function exerciseMatchKey(exercise) {
  if (typeof exercise === 'string') return exerciseKey(exercise);
  const storedKeyIsCurrent = exercise.matchKey && getExercises().some((item) => item.id === exercise.matchKey);
  return storedKeyIsCurrent ? exercise.matchKey : exerciseKey(exercise.name);
}
function canonicalExerciseName(key, fallback) {
  return [...getExercises(), ...readStore('exercise-archive-catalog', [])].find((item) => item.id === key)?.name || String(fallback).trim();
}
function canonicalSessionMetric(name, fallback = 'repetitions') {
  const official = resolveCatalogExercise(name); const metrics = official?.metrics || [];
  if (metrics.length === 1) return metrics[0] === 'tension' ? 'seconds' : metrics[0];
  return fallback;
}
function weekStartIso(dateValue) { const date = new Date(`${dateValue}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return toIso(date); }
function previousExerciseInWeek(session, exercise) {
  const currentStart = weekStartIso(session.date); const key = exerciseMatchKey(exercise);
  const candidates = getSessions().filter((item) => item.date < session.date && weekStartIso(item.date) === currentStart).sort((a, b) => b.date.localeCompare(a.date));
  for (const previousSession of candidates) {
    const index = (previousSession.exercises || []).findIndex((item) => exerciseMatchKey(item) === key);
    if (index >= 0) { const values = effectiveExerciseValues(previousSession, previousSession.exercises[index], index); if (values.length) return { date: previousSession.date, values }; }
  }
  return null;
}
function openWorkout(session) {
  session = { ...session, exercises: (session.exercises || []).map((exercise) => typeof exercise === 'string' ? exercise : { ...exercise, name: canonicalExerciseName(exerciseKey(exercise.name), exercise.name), metric: canonicalSessionMetric(exercise.name, exercise.metric) }) };
  const { current } = progressFor(session.id);
  const date = new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const coachNotes = [...new Set((session.overrideFields?.includes('instructions') ? [session.instructions] : [session.coachInfo, session.instructions]).map((value) => String(value || '').trim()).filter(Boolean))];
  const studentComment = effectiveComment(current, session.studentInfo);
  document.querySelector('#workout-content').innerHTML = `<p class="kicker">${escapeHtml(date.toUpperCase())}</p><h2>${escapeHtml(session.name)}</h2>
    <div class="workout-management"><button type="button" data-edit-calendar-session>Modifier la séance</button><button type="button" data-duplicate-calendar-session>Dupliquer</button><button type="button" class="delete-session" data-delete-calendar-session>Supprimer</button></div>
    ${session.videoRequired ? '<div class="video-alert"><b>🎬 EXERCICES À FILMER</b></div>' : ''}
    <div class="coach-note ${coachNotes.length ? '' : 'empty-coach-note'}"><b>Consignes du coach</b><span>${coachNotes.length ? coachNotes.map(escapeHtml).join('<br>') : 'Aucune consigne renseignée pour cette séance.'}</span></div>
    ${session.isRest ? `<div class="rest-metric"><span>👟</span><label>Nombre de pas<input id="rest-steps" type="number" min="0" step="1" value="${readStore('daily-steps', {})[session.date] || ''}" placeholder="À synchroniser" /></label><small>Saisie locale provisoire · connexion Samsung Health à venir</small></div>` : `<p class="help-text">Les valeurs déjà remplies dans le tableau sont automatiquement considérées comme réalisées. Tu peux les corriger ici si nécessaire.</p><div class="workout-exercises">${session.exercises.map((exercise, exerciseIndex) => { const previous = previousExerciseInWeek(session, exercise); const seriesCount = exercise.seriesCount || Math.max(10, exercise.targets.length); return `<section><div class="workout-exercise-title"><span><small>EXERCICE ${exerciseIndex + 1}</small><strong>${escapeHtml(exercise.name)}</strong></span><b>${exercise.metric === 'seconds' ? 'Secondes' : 'Répétitions'}</b></div><p class="previous-performance">${previous ? `Dernière fois cette semaine : <strong>${previous.values.join(' · ')} ${exercise.metric === 'seconds' ? 's' : 'rép.'}</strong>` : 'Première occurrence de cet exercice cette semaine.'}</p><div class="set-scroll"><div class="set-list">${Array.from({ length: seriesCount }, (_, setIndex) => { const target = exercise.targets[setIndex] || 0; const recorded = current.values?.[exerciseIndex]?.[setIndex] ?? (target || undefined); return `<label><span>Série ${setIndex + 1}${target ? `<small>tableau : ${target} ${exercise.metric === 'seconds' ? 's' : 'rép.'}</small>` : '<small>série à renseigner</small>'}</span><select data-progress-exercise="${exerciseIndex}" data-progress-set="${setIndex}">${selectOptions(target, exercise.metric, recorded)}</select></label>`; }).join('')}</div></div></section>`; }).join('')}</div>`}
    <label class="student-comment">Commentaire élève<textarea id="student-comment" rows="4" placeholder="Comment s’est passée cette séance ?">${escapeHtml(studentComment)}</textarea></label><p class="comment-source">${session.studentInfo ? 'Commentaire initial synchronisé depuis « Infos élève » du tableau.' : 'Tu peux renseigner ton retour directement ici.'}</p><p class="save-hint" id="save-hint">Tes réponses sont enregistrées automatiquement sur cet appareil.</p>`;
  workoutDialog.dataset.sessionId = session.id; workoutDialog.showModal();
  renderWorkoutVideoTools(session);
}

function youtubeVideoId(url) {
  try { const parsed = new URL(String(url).trim()); if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || null; if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] || null; }
  catch {} return null;
}
function videoRecords() { return readStore('exercise-video-registry', []); }
function youtubePlayer(url, title) { const id = youtubeVideoId(url); return id ? `<div class="youtube-mini"><button type="button" class="youtube-load" data-youtube-id="${escapeHtml(id)}" data-youtube-title="${escapeHtml(title)}"><span>▶</span><strong>Lire la vidéo</strong><small>YouTube non répertorié</small></button></div>` : ''; }
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-youtube-id]'); if (!button) return; const container = button.closest('.youtube-mini');
  container.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(button.dataset.youtubeId)}?autoplay=1" title="${escapeHtml(button.dataset.youtubeTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
});
function renderWorkoutVideoTools(session) {
  document.querySelectorAll('#workout-content .workout-video-tools').forEach((item) => item.remove());
  const records = videoRecords();
  document.querySelectorAll('#workout-content .workout-exercises > section').forEach((section, exerciseIndex) => {
    const exercise = session.exercises[exerciseIndex]; if (!exercise) return; const key = exerciseMatchKey(exercise); const exerciseName = canonicalExerciseName(key, typeof exercise === 'string' ? exercise : exercise.name);
    const attached = records.filter((item) => item.sessionId === session.id && Number(item.exerciseIndex) === exerciseIndex);
    section.insertAdjacentHTML('beforeend', `<div class="workout-video-tools"><div class="video-tool-heading"><span><b>🎬 Vidéos de cet exercice</b><small>Les liens YouTube non répertoriés sont acceptés.</small></span><em>${attached.length ? 'À revoir par le coach' : 'Aucune vidéo'}</em></div><div class="video-add-row"><input type="url" data-video-url="${exerciseIndex}" placeholder="Coller un lien YouTube…"><button type="button" data-add-exercise-video="${exerciseIndex}">Ajouter</button></div><p class="video-field-error" data-video-error="${exerciseIndex}"></p>${attached.map((item) => `<article class="session-video">${youtubePlayer(item.url, exercise.name)}<div><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Ouvrir sur YouTube ↗</a><button type="button" data-delete-exercise-video="${item.id}">Supprimer</button></div></article>`).join('')}</div>`);
  });
}
function openVideoRegistry(exercise) {
  const records = videoRecords().filter((item) => item.exerciseKey === exercise.id).sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector('#video-registry-content').innerHTML = `<p class="kicker">REGISTRE VIDÉO</p><h2>${escapeHtml(exercise.name)}</h2><p class="help-text">Toutes les vidéos ajoutées depuis les séances du calendrier, classées de la plus récente à la plus ancienne.</p>${records.length ? `<div class="video-registry-list">${records.map((item) => `<article>${youtubePlayer(item.url, `${exercise.name} — ${item.date}`)}<div class="video-registry-meta"><span><strong>${new Date(`${item.date}T12:00`).toLocaleDateString('fr-FR')}</strong><small>${escapeHtml(item.sessionName)} · À revoir par le coach</small></span><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">YouTube ↗</a></div></article>`).join('')}</div>` : '<div class="empty-progress"><strong>Aucune vidéo enregistrée</strong><p>Ajoute une vidéo depuis une séance du calendrier.</p></div>'}`;
  videoRegistryDialog.showModal();
}
function videoRecordExercise(record, catalog = getExercises()) { return catalog.find((item) => item.id === record.exerciseKey) || { id: record.exerciseKey, name: record.exerciseName || 'Exercice à classer', category: 'À classer', subcategory: '' }; }
function datedVideoCards(records, catalog) { return `<div class="dated-video-grid">${records.map((item) => { const exercise = videoRecordExercise(item, catalog); return `<article>${youtubePlayer(item.url, `${exercise.name} — ${item.date}`)}<div><span>${escapeHtml(exercise.name)}</span><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">YouTube ↗</a></div></article>`; }).join('')}</div>`; }
function chronologicalVideoTree(records, catalog) {
  const dates = new Map(); records.forEach((record) => { if (!dates.has(record.date)) dates.set(record.date, []); dates.get(record.date).push(record); });
  return [...dates.entries()].map(([date, items]) => `<details class="video-folder date-folder"><summary><span class="folder-icon">▱</span><span><strong>${new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>${items.length} vidéo(s) · ${[...new Set(items.map((item) => item.sessionName))].map(escapeHtml).join(' · ')}</small></span><b>＋</b></summary><div class="folder-content">${datedVideoCards(items, catalog)}</div></details>`).join('');
}
function renderVideoLibrary() {
  const records = [...videoRecords()].sort((a, b) => b.date.localeCompare(a.date) || String(b.addedAt || '').localeCompare(String(a.addedAt || ''))); const catalog = getExercises(); const tree = new Map();
  document.querySelector('#video-recent-strip').innerHTML = records.length ? records.slice(0, 4).map((item) => { const exercise = videoRecordExercise(item, catalog); return `<article>${youtubePlayer(item.url, `${exercise.name} — ${item.date}`)}<div><strong>${escapeHtml(exercise.name)}</strong><span>${new Date(`${item.date}T12:00`).toLocaleDateString('fr-FR')} · ${escapeHtml(item.sessionName)}</span></div></article>`; }).join('') : '<p class="empty-state">Les dernières vidéos apparaîtront ici.</p>';
  records.forEach((record) => {
    const exercise = catalog.find((item) => item.id === record.exerciseKey) || { id: record.exerciseKey, name: record.exerciseName || 'Exercice à classer', category: 'À classer', subcategory: '' };
    if (!tree.has(exercise.category)) tree.set(exercise.category, new Map()); const family = tree.get(exercise.category);
    if (!family.has(exercise.id)) family.set(exercise.id, { exercise, records: [] }); family.get(exercise.id).records.push(record);
  });
  document.querySelector('#video-library-count').textContent = `${records.length} vidéo${records.length > 1 ? 's' : ''}`;
  if (videoLibraryMode === 'date') { document.querySelector('#video-library-tree').innerHTML = records.length ? chronologicalVideoTree(records, catalog) : '<div class="video-library-empty"><span>▶</span><strong>Aucune vidéo enregistrée</strong><p>Ouvre une séance du calendrier puis ajoute un lien YouTube sous l’exercice concerné.</p></div>'; return; }
  document.querySelector('#video-library-tree').innerHTML = records.length ? [...tree.entries()].map(([category, exercises]) => `<details class="video-folder family-folder"><summary><span class="folder-icon">▰</span><span><strong>${escapeHtml(category)}</strong><small>${[...exercises.values()].reduce((sum, item) => sum + item.records.length, 0)} vidéo(s)</small></span><b>＋</b></summary><div class="folder-content">${[...exercises.values()].map(({ exercise, records: exerciseRecords }) => { const dates = new Map(); exerciseRecords.forEach((record) => { if (!dates.has(record.date)) dates.set(record.date, []); dates.get(record.date).push(record); }); return `<details class="video-folder exercise-folder"><summary><span class="folder-icon">▰</span><span><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(exercise.subcategory || 'Exercice principal')} · ${exerciseRecords.length} vidéo(s)</small></span><b>＋</b></summary><div class="folder-content">${[...dates.entries()].map(([date, dateRecords]) => `<details class="video-folder date-folder"><summary><span class="folder-icon">▱</span><span><strong>${new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>${dateRecords.map((item) => escapeHtml(item.sessionName)).join(' · ')}</small></span><b>＋</b></summary><div class="dated-video-grid">${dateRecords.map((item) => `<article>${youtubePlayer(item.url, `${exercise.name} — ${date}`)}<div><span>À revoir par le coach</span><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">YouTube ↗</a></div></article>`).join('')}</div></details>`).join('')}</div></details>`; }).join('')}</div></details>`).join('') : '<div class="video-library-empty"><span>▶</span><strong>Aucune vidéo enregistrée</strong><p>Ouvre une séance du calendrier puis ajoute un lien YouTube sous l’exercice concerné.</p></div>';
}

document.querySelector('.video-library-toolbar').addEventListener('click', (event) => { const button = event.target.closest('[data-video-library-mode]'); if (!button) return; videoLibraryMode = button.dataset.videoLibraryMode; document.querySelectorAll('[data-video-library-mode]').forEach((item) => item.classList.toggle('active', item === button)); renderVideoLibrary(); });
calendarGrid.addEventListener('click', (event) => { const button = event.target.closest('[data-workout-id]'); if (button) { const session = getSessions().find((item) => item.id === button.dataset.workoutId); if (session) openWorkout(session); } });
document.querySelector('#sessions .session-list').addEventListener('click', (event) => { const button = event.target.closest('[data-journal-session-id]'); if (!button) return; const session = getSessions().find((item) => item.id === button.dataset.journalSessionId); if (session) openWorkout(session); });
document.querySelector('[data-close-workout]').addEventListener('click', () => workoutDialog.close());
workoutDialog.addEventListener('click', (event) => { if (event.target === workoutDialog) workoutDialog.close(); });
document.querySelector('#workout-content').addEventListener('click', (event) => {
  const sessionId = workoutDialog.dataset.sessionId; const session = getSessions().find((item) => item.id === sessionId); if (!session) return;
  const addVideo = event.target.closest('[data-add-exercise-video]');
  if (addVideo) {
    const exerciseIndex = Number(addVideo.dataset.addExerciseVideo); const input = document.querySelector(`[data-video-url="${exerciseIndex}"]`); const url = input.value.trim(); const error = document.querySelector(`[data-video-error="${exerciseIndex}"]`);
    if (!youtubeVideoId(url)) { error.textContent = 'Colle un lien YouTube valide (youtube.com ou youtu.be).'; return; }
    const exercise = session.exercises[exerciseIndex]; const rawExerciseName = typeof exercise === 'string' ? exercise : exercise.name; const records = videoRecords(); const now = new Date().toISOString(); const record = { id: `video-${Date.now()}`, sessionId, sessionName: session.name, date: session.date, exerciseIndex, exerciseKey: exerciseMatchKey(exercise), exerciseName: canonicalExerciseName(exerciseMatchKey(exercise), rawExerciseName), url, status: 'coach-review', studentId: activeStudentId || 'student-owner', addedAt: now, modifiedAt: now }; records.push(record); localStorage.setItem('exercise-video-registry', JSON.stringify(records)); queueSharedWrite('video-upsert', record); renderWorkoutVideoTools(session); renderVideoLibrary(); return;
  }
  const deleteVideo = event.target.closest('[data-delete-exercise-video]');
  if (deleteVideo && window.confirm('Supprimer ce lien vidéo du registre ?')) { const id = deleteVideo.dataset.deleteExerciseVideo; localStorage.setItem('exercise-video-registry', JSON.stringify(videoRecords().filter((item) => item.id !== id))); queueSharedWrite('video-delete', { id, modifiedAt: new Date().toISOString() }); renderWorkoutVideoTools(session); renderVideoLibrary(); return; }
  if (event.target.closest('[data-edit-calendar-session]')) { workoutDialog.close(); openSessionForm(session); }
  if (event.target.closest('[data-duplicate-calendar-session]')) { workoutDialog.close(); openSessionForm(session, { duplicate: true }); }
  if (event.target.closest('[data-delete-calendar-session]') && window.confirm(`Supprimer « ${session.name} » du calendrier ?`)) {
    if (session.source === 'google-sheet') { const hidden = readStore('hidden-sessions', []); if (!hidden.includes(session.id)) hidden.push(session.id); localStorage.setItem('hidden-sessions', JSON.stringify(hidden)); }
    else saveSessions(readStore('calisthenics-sessions', defaultSessions).filter((item) => item.id !== session.id));
    queueSharedWrite('session-delete', { ...session, modifiedAt: new Date().toISOString() });
    const overrides = readStore('session-overrides', {}); delete overrides[session.id]; localStorage.setItem('session-overrides', JSON.stringify(overrides)); workoutDialog.close(); renderCalendar(); renderExercises(); renderDashboard();
  }
});
document.querySelector('#workout-content').addEventListener('input', (event) => {
  const sessionId = workoutDialog.dataset.sessionId; const { all, current } = progressFor(sessionId);
  if (event.target.id === 'rest-steps') { const session = getSessions().find((item) => item.id === sessionId); const steps = readStore('daily-steps', {}); if (event.target.value) steps[session.date] = Number(event.target.value); else delete steps[session.date]; localStorage.setItem('daily-steps', JSON.stringify(steps)); renderCalendar(); return; }
  if (event.target.matches('[data-progress-exercise]')) { const exercise = event.target.dataset.progressExercise; const set = event.target.dataset.progressSet; current.values[exercise] ||= []; current.values[exercise][set] = Number(event.target.value); current.manualSets ||= {}; current.manualSets[exercise] ||= {}; current.manualSets[exercise][set] = true; }
  if (event.target.id === 'student-comment') { current.comment = event.target.value; current.commentTouched = true; }
  current.modifiedAt = new Date().toISOString(); all[sessionId] = current; localStorage.setItem('workout-progress', JSON.stringify(all)); scheduleSharedProgress(getSessions().find((item) => item.id === sessionId), current); renderCalendar(); renderDashboard(); document.querySelector('#save-hint').textContent = `Enregistré à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${sharedBackendReady() ? ' · envoi Google en arrière-plan' : ''}`;
});

const metricNames = { repetitions: 'Répétitions totales', tension: 'Temps sous tension', weight: 'Charge utilisée' };
const metricUnits = { repetitions: 'rép.', tension: 's', weight: 'kg' };
const metricColors = { repetitions: '#df7048', tension: '#5a9b91', weight: '#7766a6' };
function exerciseHistory(exercise) {
  const catalog = getExercises(); const overrides = readStore('exercise-alias-overrides', {}); const aliasIndex = new Map();
  catalog.forEach((item) => [item.name, ...(item.aliases || [])].forEach((alias) => aliasIndex.set(normalize(alias), item.id)));
  Object.entries(overrides).forEach(([alias, id]) => aliasIndex.set(alias, id));
  const fastKey = (item) => item?.matchKey && catalog.some((known) => known.id === item.matchKey) ? item.matchKey : aliasIndex.get(normalize(typeof item === 'string' ? item : item?.name)) || `unresolved-${normalize(typeof item === 'string' ? item : item?.name)}`;
  const key = exercise.id || fastKey(exercise); const groupedHistory = new Map(); const today = toIso(new Date());
  getSessions().filter((session) => !session.isRest && session.date <= today && /^\d{4}-\d{2}-\d{2}$/.test(session.date)).forEach((session) => {
    (session.exercises || []).forEach((item, exerciseIndex) => {
      const current = typeof item === 'string' ? { name: item, targets: [], metric: 'repetitions' } : item;
      if (fastKey(current) !== key) return;
      const values = effectiveExerciseValues(session, current, exerciseIndex);
      if (!values.length) return;
      const correctedMetric = canonicalSessionMetric(current.name, current.metric); const metric = correctedMetric === 'seconds' ? 'tension' : correctedMetric || 'repetitions'; const historyKey = `${session.date}|${metric}`;
      const point = groupedHistory.get(historyKey) || { date: session.date, metric, value: 0, sets: 0 }; point.value += values.reduce((sum, value) => sum + value, 0); point.sets += values.length; groupedHistory.set(historyKey, point);
      const weight = Number(String(current.name || '').match(/(\d+(?:[.,]\d+)?)\s*kg/i)?.[1]?.replace(',', '.'));
      if (weight) groupedHistory.set(`${session.date}|weight`, { date: session.date, metric: 'weight', value: weight, sets: values.length });
    });
  });
  return [...groupedHistory.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function filterHistory(history, period) {
  if (period === 'all' || !history.length) return history;
  const days = { week: 7, month: 28, quarter: 90 }[period]; const latest = new Date(`${history.at(-1).date}T12:00`); const cutoff = new Date(latest); cutoff.setDate(cutoff.getDate() - days);
  return history.filter((point) => new Date(`${point.date}T12:00`) >= cutoff);
}
function smoothPath(points) {
  if (points.length < 2) return points.length ? `M ${points[0][0]} ${points[0][1]}` : '';
  return points.slice(1).reduce((path, point, index) => { const previous = points[index]; const middleX = (previous[0] + point[0]) / 2; const middleY = (previous[1] + point[1]) / 2; return `${path} Q ${previous[0]} ${previous[1]} ${middleX} ${middleY}`; }, `M ${points[0][0]} ${points[0][1]}`) + ` T ${points.at(-1)[0]} ${points.at(-1)[1]}`;
}
function progressionChart(history) {
  if (history.length > 140) { const step = Math.ceil(history.length / 140); history = history.filter((point, index) => index % step === 0 || index === history.length - 1); }
  const grouped = Object.groupBy ? Object.groupBy(history, (point) => point.metric) : history.reduce((result, point) => { (result[point.metric] ||= []).push(point); return result; }, {});
  const dates = [...new Set(history.map((point) => point.date))].sort(); const width = 680; const height = 280; const paddingLeft = 66; const paddingRight = 24; const paddingY = 32; const multiple = Object.keys(grouped).length > 1;
  const x = (date) => dates.length === 1 ? width / 2 : paddingLeft + (dates.indexOf(date) / (dates.length - 1)) * (width - paddingLeft - paddingRight);
  const globalMax = Math.max(...history.map((point) => point.value), 1);
  const yValue = (point, metricPoints) => { const max = multiple ? Math.max(...metricPoints.map((item) => item.value), 1) : globalMax; return height - paddingY - (point.value / max) * (height - paddingY * 2); };
  const lines = Object.entries(grouped).map(([metric, points]) => { const coordinates = points.map((point) => [x(point.date), yValue(point, points)]); const path = smoothPath(coordinates); return `<path d="${path}" fill="none" stroke="${metricColors[metric]}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" filter="url(#soft-shadow)"/>${points.map((point) => `<circle cx="${x(point.date)}" cy="${yValue(point, points)}" r="5" fill="#fbfaf6" stroke="${metricColors[metric]}" stroke-width="3"><title>${point.value} ${metricUnits[metric]} · ${new Date(`${point.date}T12:00`).toLocaleDateString('fr-FR')}</title></circle>`).join('')}`; }).join('');
  const ticks = [1, .75, .5, .25, 0].map((ratio) => { const y = paddingY + (1 - ratio) * (height - paddingY * 2); const label = multiple ? `${ratio * 100}%` : `${Math.round(globalMax * ratio)} ${metricUnits[history[0].metric]}`; return `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#dedbd2" stroke-dasharray="3 7"/><text x="${paddingLeft - 10}" y="${y + 3}" text-anchor="end" fill="#7a817a" font-size="10">${label}</text>`; }).join('');
  return `<div class="progress-legend">${Object.keys(grouped).map((metric) => `<span><i style="background:${metricColors[metric]}"></i>${metricNames[metric]} <b>(${metricUnits[metric]})</b></span>`).join('')}</div><div class="exercise-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Progression de l'exercice"><defs><filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".13"/></filter></defs>${ticks}${lines}</svg><div class="chart-dates"><span>${new Date(`${dates[0]}T12:00`).toLocaleDateString('fr-FR')}</span><span>${new Date(`${dates.at(-1)}T12:00`).toLocaleDateString('fr-FR')}</span></div></div>${multiple ? '<p class="normalization-note">Vue globale normalisée : 100 % correspond à la meilleure valeur de chaque métrique sur la période. Les unités réelles restent visibles dans la légende et au survol des points.</p>' : ''}`;
}
function progressionStats(history) {
  const metrics = [...new Set(history.map((point) => point.metric))];
  return metrics.map((metric) => { const points = history.filter((point) => point.metric === metric); const first = points[0].value; const last = points.at(-1).value; const change = first ? ((last - first) / first) * 100 : 0; const best = Math.max(...points.map((point) => point.value)); const direction = change >= 0 ? '+' : ''; return `<article><span class="stat-trend ${change >= 0 ? 'up' : 'down'}">${direction}${change.toFixed(0)}%</span><div><strong>${metricNames[metric]}</strong><p>${first} à ${last} ${metricUnits[metric]} entre le ${new Date(`${points[0].date}T12:00`).toLocaleDateString('fr-FR')} et le ${new Date(`${points.at(-1).date}T12:00`).toLocaleDateString('fr-FR')}.</p><small>Meilleure valeur : ${best} ${metricUnits[metric]} · ${points.length} relevé${points.length > 1 ? 's' : ''}</small></div></article>`; }).join('');
}
function renderExerciseProgress(exercise, period = 'all') {
  const completeHistory = exerciseHistory(exercise); const history = filterHistory(completeHistory, period); const metrics = [...new Set(completeHistory.map((point) => point.metric))];
  const periods = [['week', '1 semaine'], ['month', '4 semaines'], ['quarter', '3 mois'], ['all', 'Tout']];
  document.querySelector('#exercise-progress-content').innerHTML = `<p class="kicker">PROGRESSION</p><div class="progress-heading"><h2>${escapeHtml(exercise.name)}</h2><div class="period-switch">${periods.map(([value, label]) => `<button type="button" class="${value === period ? 'active' : ''}" data-progress-period="${value}">${label}</button>`).join('')}</div></div>${history.length ? `${progressionChart(history)}<h3>Évolutions notables</h3><div class="progress-stats">${progressionStats(history)}</div>` : '<div class="empty-progress"><strong>Aucune donnée sur cette période</strong><p>Choisis une période plus longue ou renseigne une nouvelle séance.</p></div>'}${exercise.metrics.length > metrics.length ? `<p class="missing-metrics">Certaines métriques suivies (${exercise.metrics.filter((metric) => !metrics.includes(metric)).map((metric) => labels[metric]).join(', ')}) n’ont pas encore de valeur dans les séances.</p>` : ''}`;
}
function openExerciseProgress(exercise) {
  exerciseProgressDialog.dataset.exerciseId = exercise.id;
  document.querySelector('#exercise-progress-content').innerHTML = '<div class="progress-loading"><strong>Préparation de la progression…</strong><span>Analyse des séances enregistrées</span></div>';
  exerciseProgressDialog.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { renderExerciseProgress(exercise, 'all'); }
    catch (error) { console.error(error); document.querySelector('#exercise-progress-content').innerHTML = `<p class="kicker">PROGRESSION</p><h2>${escapeHtml(exercise.name)}</h2><div class="empty-progress"><strong>Impossible d’afficher certaines données</strong><p>Une valeur de l’historique est invalide. Le reste de l’application reste utilisable.</p></div>`; }
  }));
}
document.querySelector('#exercise-progress-content').addEventListener('click', (event) => { const period = event.target.closest('[data-progress-period]'); if (!period) return; const exercise = getDisplayExercises().find((item) => item.id === exerciseProgressDialog.dataset.exerciseId); if (exercise) renderExerciseProgress(exercise, period.dataset.progressPeriod); });
document.querySelector('[data-close-exercise-progress]').addEventListener('click', () => exerciseProgressDialog.close());
exerciseProgressDialog.addEventListener('click', (event) => { if (event.target === exerciseProgressDialog) exerciseProgressDialog.close(); });
document.querySelector('[data-close-video-registry]').addEventListener('click', () => videoRegistryDialog.close());
videoRegistryDialog.addEventListener('click', (event) => { if (event.target === videoRegistryDialog) videoRegistryDialog.close(); });
document.addEventListener('click', (event) => { if (event.target.closest('[data-open-volume]')) openVolumeDetails(); });
document.querySelector('[data-close-volume]').addEventListener('click', () => volumeDialog.close());
volumeDialog.addEventListener('click', (event) => { if (event.target === volumeDialog) volumeDialog.close(); });
document.addEventListener('click', (event) => { if (event.target.closest('[data-open-trophies]')) openTrophyCollection(); });
document.querySelector('[data-close-trophies]').addEventListener('click', () => trophyDialog.close());
trophyDialog.addEventListener('click', (event) => { if (event.target === trophyDialog) trophyDialog.close(); });

function safeInitialRender(label, renderer) {
  try { renderer(); }
  catch (error) { console.error(`Chargement ${label}`, error); const status = document.querySelector('#sync-status'); if (status) status.textContent = `Application ouverte · ${label} temporairement indisponible`; }
}
let scheduledDataRenderTimers = [];
function scheduleDataRender(delay = 60) {
  scheduledDataRenderTimers.forEach(clearTimeout);
  scheduledDataRenderTimers = [];
  const tasks = [
    ['calendrier', renderCalendar, delay],
    ['tableau de bord', renderDashboard, delay + 120],
    ['exercices', () => exerciseLibrary.hidden ? renderExercisePreview(getDisplayExercises()) : renderExercises(), delay + 240],
    ['vidéos', renderVideoLibrary, delay + 480],
  ];
  tasks.forEach(([label, renderer, wait]) => {
    scheduledDataRenderTimers.push(setTimeout(() => {
      requestAnimationFrame(() => safeInitialRender(label, renderer));
    }, wait));
  });
}
requestAnimationFrame(() => scheduleDataRender(0));
const initialLastSync = new Date(localStorage.getItem('sheet-last-sync') || 0);
const sheetSourceChanged = localStorage.getItem('sheet-source-id') !== SHEET_ID;
if (sheetSourceChanged) { localStorage.setItem('sheet-source-id', SHEET_ID); localStorage.removeItem('sheet-last-sync'); }
if (sheetSourceChanged || Date.now() - initialLastSync.getTime() > 5 * 60 * 1000) setTimeout(syncGoogleSheet, sheetSourceChanged ? 1200 : 30000);
if (sharedBackendReady()) setTimeout(() => { flushSharedOutbox(); loadSharedSnapshot(); }, 2200);
setInterval(syncGoogleSheet, 15 * 60 * 1000);
setInterval(() => { if (document.visibilityState === 'visible' && sharedBackendReady()) { flushSharedOutbox(); loadSharedSnapshot(true); } }, 15 * 60 * 1000);
const applicationBootTime = Date.now();
window.addEventListener('focus', () => { const last = new Date(localStorage.getItem('sheet-last-sync') || 0); if (Date.now() - applicationBootTime > 30000 && Date.now() - last.getTime() > 5 * 60 * 1000) syncGoogleSheet(); if (sharedBackendReady()) { flushSharedOutbox(); loadSharedSnapshot(); } });
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Installation hors ligne indisponible', error)));
