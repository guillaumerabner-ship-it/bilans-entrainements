const APP_SCHEMA = {
  APP_EXERCISES: ['ID', 'Nom officiel', 'Famille', 'Sous-catégorie', 'Niveau', 'Métriques JSON', 'Alias JSON', 'Modifié le', 'Archivé', 'Propriétaire ID'],
  APP_SESSIONS: ['Session ID', 'Date séance', 'Nom', 'Source', 'Repos', 'Séance libre', 'Consignes', 'Exercices JSON', 'Supprimée', 'Modifié le', 'Élève ID', 'Champs modifiés JSON'],
  APP_PROGRESS: ['Session ID', 'Date séance', 'Séance', 'Exercice ID', 'Index exercice', 'Valeurs JSON', 'Commentaire élève', 'Modifié le', 'Élève ID', 'Champs manuels JSON'],
  APP_VIDEOS: ['ID vidéo', 'Session ID', 'Date séance', 'Séance', 'Exercice ID', 'Index exercice', 'Exercice', 'URL YouTube', 'Statut coach', 'Ajouté le', 'Modifié le', 'Élève ID', 'Commentaire coach', 'Supprimée'],
  APP_SETTINGS: ['Clé', 'Valeur', 'Modifié le'],
  APP_USERS: ['User ID', 'Email', 'Nom', 'Rôle', 'Actif', 'Modifié le'],
  APP_COACH_STUDENTS: ['Coach ID', 'Élève ID', 'Actif', 'Modifié le'],
};

const APP_SCHEMA_VERSION = 6;
const TEST_COACH_EMAIL = 'glogements@gmail.com';
const GOOGLE_OAUTH_CLIENT_ID = '538510396242-frqqtj211t5deppj6882pueubmvu4s7t.apps.googleusercontent.com';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Application entraînement')
    .addItem('Initialiser les onglets techniques', 'initializeAppBackend')
    .addItem('Installer la synchronisation automatique', 'installMonthlyEditTrigger')
    .addItem('Synchroniser la cellule sélectionnée', 'syncSelectedMonthlyCell')
    .addToUi();
}

function handleMonthlyEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet(); const spreadsheet = e.source || sheet.getParent();
    if (!isMonthlySheet_(spreadsheet, sheet.getName())) return;
    syncMonthlyStudentInfoEdit_(spreadsheet, sheet, e.range);
  } catch (error) { recordMonthlySyncStatus_(e && e.source, 'ERREUR : ' + error.message); throw error; }
}

function installMonthlyEditTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().filter((trigger) => trigger.getHandlerFunction() === 'handleMonthlyEdit').forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('handleMonthlyEdit').forSpreadsheet(spreadsheet).onEdit().create();
  recordMonthlySyncStatus_(spreadsheet, 'Déclencheur automatique installé');
  spreadsheet.toast('Synchronisation automatique installée.', 'Application entraînement', 5);
}

function syncSelectedMonthlyCell() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet(); const range = spreadsheet.getActiveRange();
  if (!range) throw new Error('Sélectionne d’abord la cellule contenant le commentaire élève.');
  const result = syncMonthlyStudentInfoEdit_(spreadsheet, range.getSheet(), range);
  spreadsheet.toast(result ? 'APP_PROGRESS mis à jour.' : 'Cellule non reconnue. Consulte APP_SETTINGS.', 'Application entraînement', 7);
}

function isMonthlySheet_(spreadsheet, sheetName) {
  const indexSheet = spreadsheet.getSheetByName('INDEX'); if (!indexSheet) return false;
  const target = normalizeSheetLabel_(sheetName);
  return indexSheet.getDataRange().getDisplayValues().slice(1).some((row) => normalizeSheetLabel_(row[0]) === target);
}

function syncMonthlyStudentInfoEdit_(spreadsheet, monthlySheet, editedRange) {
  const rowNumber = editedRange.getRow(); const editedColumn = editedRange.getColumn();
  const row = monthlySheet.getRange(rowNumber, 1, 1, Math.max(editedColumn, monthlySheet.getLastColumn())).getDisplayValues()[0];
  let labelColumn = -1;
  for (let column = editedColumn - 1; column >= Math.max(0, editedColumn - 14); column -= 1) {
    const label = normalizeSheetLabel_(row[column]);
    if (label.startsWith('infoseleve') || label.startsWith('infoeleve')) { labelColumn = column + 1; break; }
  }
  if (labelColumn < 1) { recordMonthlySyncStatus_(spreadsheet, 'IGNORÉ : libellé Infos élève introuvable près de ' + monthlySheet.getName() + '!' + editedRange.getA1Notation()); return false; }
  const year = Number(String(monthlySheet.getName()).match(/\b20\d{2}\b/)?.[0]) || new Date().getFullYear();
  const firstRow = Math.max(1, rowNumber - 40); const above = monthlySheet.getRange(firstRow, labelColumn, rowNumber - firstRow + 1, 1).getDisplayValues();
  let sessionDate = ''; let dateRowNumber = 0;
  for (let index = above.length - 1; index >= 0; index -= 1) { sessionDate = monthlyDate_(above[index][0], year); if (sessionDate) { dateRowNumber = firstRow + index; break; } }
  if (!sessionDate) { recordMonthlySyncStatus_(spreadsheet, 'IGNORÉ : date de séance introuvable au-dessus de ' + editedRange.getA1Notation()); return false; }
  const comment = row.slice(labelColumn).map((cell) => String(cell || '').trim()).filter(Boolean).join(' ').trim();
  const sessionSheet = spreadsheet.getSheetByName('APP_SESSIONS'); const progressSheet = spreadsheet.getSheetByName('APP_PROGRESS');
  if (!sessionSheet || !progressSheet) { recordMonthlySyncStatus_(spreadsheet, 'ERREUR : APP_SESSIONS ou APP_PROGRESS introuvable'); return false; }
  const sessions = rowsAsObjects_(sessionSheet).filter((item) => String(item['Élève ID'] || 'student-owner') === 'student-owner' && date_(item['Date séance']) === sessionDate && !truthy_(item['Supprimée']));
  if (!sessions.length) { recordMonthlySyncStatus_(spreadsheet, 'IGNORÉ : aucune séance APP_SESSIONS trouvée pour ' + sessionDate); return false; }
  const monthlyExercises = monthlyExercisesForBlock_(monthlySheet, labelColumn, dateRowNumber, rowNumber);
  const progressRows = rowsAsObjects_(progressSheet); const progressByKey = new Map(progressRows.map((item) => [progressKey_(item['Élève ID'], item['Session ID'], item['Index exercice']), item]));
  let writtenRows = 0;
  sessions.forEach((session) => {
    const storedExercises = parseJson_(session['Exercices JSON'], []); const exercises = monthlyExercises.length ? monthlyExercises : storedExercises;
    exercises.forEach((exercise, exerciseIndex) => {
      const key = progressKey_('student-owner', session['Session ID'], exerciseIndex); const existing = progressByKey.get(key);
      const fields = existing ? parseJson_(existing['Champs manuels JSON'], {}) : {}; const commentTouched = Boolean(fields.commentTouched);
      progressByKey.set(key, {
        'Session ID': String(session['Session ID']), 'Date séance': sessionDate, 'Séance': String(session.Nom || ''),
        'Exercice ID': String(exercise.matchKey || exercise.id || exercise.name || ''), 'Index exercice': exerciseIndex,
        'Valeurs JSON': existing ? String(existing['Valeurs JSON'] || '[]') : JSON.stringify(exercise.targets || []),
        'Commentaire élève': commentTouched && existing ? String(existing['Commentaire élève'] || '') : comment,
        'Modifié le': new Date(), 'Élève ID': 'student-owner',
        'Champs manuels JSON': JSON.stringify({ manualSets: fields.manualSets || {}, commentTouched: commentTouched }),
      });
      writtenRows += 1;
    });
  });
  if (!writtenRows) { recordMonthlySyncStatus_(spreadsheet, 'ERREUR : ' + sessionDate + ' trouvé, mais aucun exercice détecté dans le bloc mensuel ni dans APP_SESSIONS'); return false; }
  replaceRows_(progressSheet, [...progressByKey.values()]); touchDataRevision_();
  recordMonthlySyncStatus_(spreadsheet, 'OK : ' + sessionDate + ' → ' + writtenRows + ' ligne(s) APP_PROGRESS, commentaire « ' + comment + ' »'); return true;
}

function monthlyExercisesForBlock_(sheet, anchorColumn, dateRowNumber, infoRowNumber) {
  if (!dateRowNumber || infoRowNumber <= dateRowNumber + 1) return [];
  const height = infoRowNumber - dateRowNumber - 2; if (height <= 0) return [];
  const rows = sheet.getRange(dateRowNumber + 2, anchorColumn, height, 10).getDisplayValues(); const exercises = [];
  for (let index = 0; index < rows.length; index += 1) {
    const name = String(rows[index][0] || '').trim(); const normalized = normalizeSheetLabel_(name);
    if (!name || !Number.isNaN(Number(name)) || normalized === 'gtg' || normalized.startsWith('infoscoach') || normalized.startsWith('infoseleve') || normalized.startsWith('infoeleve')) continue;
    const targets = (rows[index + 1] || []).map((value) => Number(String(value || '').replace(',', '.'))).filter((value) => Number.isFinite(value) && value > 0);
    exercises.push({ name: name, targets: targets });
  }
  return exercises;
}

function recordMonthlySyncStatus_(spreadsheet, message) {
  if (!spreadsheet) return;
  const settings = spreadsheet.getSheetByName('APP_SETTINGS'); if (!settings) return;
  upsertByKey_(settings, 'Clé', 'LAST_MONTHLY_EDIT_SYNC', { 'Clé': 'LAST_MONTHLY_EDIT_SYNC', 'Valeur': message, 'Modifié le': new Date() });
}

function monthlyDate_(value, year) {
  const match = String(value || '').trim().match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\/(\d{1,2})/i);
  return match ? String(year) + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[1]).padStart(2, '0') : '';
}

function normalizeSheetLabel_(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }

function initializeAppBackend() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(APP_SCHEMA).forEach((name) => ensureTechnicalSheet_(spreadsheet, name, APP_SCHEMA[name]));
  upsertByKey_(spreadsheet.getSheetByName('APP_SETTINGS'), 'Clé', 'SCHEMA_VERSION', { 'Clé': 'SCHEMA_VERSION', 'Valeur': String(APP_SCHEMA_VERSION), 'Modifié le': new Date() });
  ensureDataRevision_();
  initializeUsers_(spreadsheet);
  const properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty('APP_API_TOKEN');
  if (!token) { token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); properties.setProperty('APP_API_TOKEN', token); }
  console.log('Initialisation terminée. Clé à copier dans l’application : ' + token);
  return token;
}

function initializeUsers_(spreadsheet) {
  const users = spreadsheet.getSheetByName('APP_USERS'); const relations = spreadsheet.getSheetByName('APP_COACH_STUDENTS');
  const ownerEmail = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  const knownUserIds = new Set(rowsAsObjects_(users).map((row) => String(row['User ID'])));
  if (ownerEmail && !knownUserIds.has('student-owner')) upsertByKey_(users, 'User ID', 'student-owner', { 'User ID': 'student-owner', 'Email': ownerEmail, 'Nom': 'Guillaume', 'Rôle': 'élève', 'Actif': true, 'Modifié le': new Date() });
  if (!knownUserIds.has('coach-test')) upsertByKey_(users, 'User ID', 'coach-test', { 'User ID': 'coach-test', 'Email': TEST_COACH_EMAIL, 'Nom': 'Coach test', 'Rôle': 'coach', 'Actif': true, 'Modifié le': new Date() });
  upsertComposite_(relations, 'coach-test|student-owner', (row) => String(row['Coach ID']) + '|' + String(row['Élève ID']), { 'Coach ID': 'coach-test', 'Élève ID': 'student-owner', 'Actif': true, 'Modifié le': new Date() });
}

function displayAppApiToken() {
  const token = PropertiesService.getScriptProperties().getProperty('APP_API_TOKEN');
  if (!token) throw new Error('La clé n’existe pas encore. Exécute initializeAppBackend une première fois.');
  console.log('Clé à copier dans l’application : ' + token);
  return token;
}

function doGet(e) {
  try {
    assertToken_(e.parameter.token);
    const access = authorizeStudent_(e.parameter.credential, e.parameter.studentId);
    const resource = e.parameter.resource || e.parameter.action; const revision = currentDataRevision_();
    const result = resource === 'health'
      ? { ok: true, source: SpreadsheetApp.getActiveSpreadsheet().getName(), schema: APP_SCHEMA_VERSION, features: ['sheet-calendar-sync'], user: access.user.id, studentId: access.studentId, revision: revision }
      : resource === 'calendar-source'
        ? buildCalendarSource_()
      : (String(e.parameter.revision || '') === revision
        ? { ok: true, notModified: true, studentId: access.studentId, revision: revision, generatedAt: new Date().toISOString() }
        : buildSnapshot_(access.studentId, e.parameter.since));
    if (e.parameter.action === 'bridge') return bridgeOutput_(result, e.parameter.origin, e.parameter.requestId);
    return output_(result, e.parameter.callback);
  } catch (error) { return output_({ ok: false, error: error.message }, e && e.parameter && e.parameter.callback); }
}

function buildCalendarSource_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const indexSheet = spreadsheet.getSheetByName('INDEX');
  if (!indexSheet) throw new Error('L’onglet INDEX est introuvable.');
  const indexRows = indexSheet.getDataRange().getDisplayValues();
  const names = indexRows.slice(1).map((row) => String(row[0] || '').trim()).filter(Boolean);
  const tabs = names.map((name) => {
    const sheet = spreadsheet.getSheetByName(name);
    return sheet ? { name: name, rows: sheet.getDataRange().getDisplayValues() } : null;
  }).filter(Boolean);
  const blockSheet = spreadsheet.getSheetByName("Plan d'entraînement");
  return { ok: true, tabs: tabs, blockRows: blockSheet ? blockSheet.getDataRange().getDisplayValues() : [], generatedAt: new Date().toISOString() };
}

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const isBridge = Boolean(e.parameter && e.parameter.payload); const payload = JSON.parse(isBridge ? e.parameter.payload : (e.postData && e.postData.contents) || '{}');
    if (payload.action === 'auth-login') { const authResult = authenticateGoogle_(payload.credential); return isBridge ? bridgeOutput_(authResult, e.parameter.origin, e.parameter.requestId) : output_(authResult); }
    assertToken_(payload.token);
    const access = authorizeStudent_(payload.credential, payload.studentId || (payload.data && payload.data.studentId));
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet(); Object.keys(APP_SCHEMA).forEach((name) => ensureTechnicalSheet_(spreadsheet, name, APP_SCHEMA[name]));
    const scopedData = Object.assign({}, payload.data || {}, { studentId: access.studentId });
    let changed = false;
    if (payload.action === 'progress-upsert') changed = upsertProgress_(spreadsheet, scopedData);
    else if (payload.action === 'video-upsert') changed = upsertVideo_(spreadsheet, scopedData);
    else if (payload.action === 'video-delete') changed = deleteOwnedVideo_(spreadsheet, scopedData, access.studentId);
    else if (payload.action === 'exercise-upsert') changed = upsertExercise_(spreadsheet, Object.assign({}, scopedData, { ownerId: access.studentId }));
    else if (payload.action === 'exercise-archive') changed = upsertExercise_(spreadsheet, Object.assign({}, scopedData, { archived: true, ownerId: access.studentId }));
    else if (payload.action === 'session-upsert') changed = upsertSession_(spreadsheet, scopedData, false);
    else if (payload.action === 'session-delete') changed = upsertSession_(spreadsheet, scopedData, true);
    else if (payload.action === 'sheet-calendar-sync') changed = syncSheetCalendar_(spreadsheet, scopedData);
    else if (payload.action === 'bulk-sync') changed = bulkSync_(spreadsheet, payload.data || {}, access.studentId);
    else throw new Error('Action inconnue.');
    const revision = changed ? touchDataRevision_() : currentDataRevision_();
    const result = { ok: true, conflict: !changed, revision: revision }; return isBridge ? bridgeOutput_(result, e.parameter.origin, e.parameter.requestId) : output_(result);
  } catch (error) { return e && e.parameter && e.parameter.payload ? bridgeOutput_({ ok: false, error: error.message }, e.parameter.origin, e.parameter.requestId) : output_({ ok: false, error: error.message }); }
  finally { lock.releaseLock(); }
}

function authenticateGoogle_(credential) {
  if (!credential) throw new Error('Jeton Google manquant.');
  const cache = CacheService.getScriptCache(); const cacheKey = 'auth:' + digest_(credential); const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Connexion Google invalide ou expirée.');
  const identity = JSON.parse(response.getContentText());
  if (identity.aud !== GOOGLE_OAUTH_CLIENT_ID || String(identity.email_verified) !== 'true') throw new Error('Compte Google non vérifié pour cette application.');
  const email = String(identity.email || '').trim().toLowerCase(); const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const userRow = rowsAsObjects_(spreadsheet.getSheetByName('APP_USERS')).find((row) => String(row.Email || '').trim().toLowerCase() === email && truthy_(row.Actif));
  if (!userRow) throw new Error('Ce compte ne fait pas partie des utilisateurs autorisés.');
  const user = { id: String(userRow['User ID']), email, name: String(userRow.Nom || identity.name || email), role: String(userRow['Rôle'] || 'élève').toLowerCase(), picture: String(identity.picture || '') };
  const relationships = rowsAsObjects_(spreadsheet.getSheetByName('APP_COACH_STUDENTS')).filter((row) => String(row['Coach ID']) === user.id && truthy_(row.Actif));
  const studentIds = new Set(relationships.map((row) => String(row['Élève ID']))); const students = rowsAsObjects_(spreadsheet.getSheetByName('APP_USERS')).filter((row) => studentIds.has(String(row['User ID'])) && truthy_(row.Actif)).map((row) => ({ id: String(row['User ID']), email: String(row.Email || ''), name: String(row.Nom || row.Email || '') }));
  const result = { ok: true, user, students }; cache.put(cacheKey, JSON.stringify(result), 300); return result;
}

function authorizeStudent_(credential, requestedStudentId) {
  const auth = authenticateGoogle_(credential); const user = auth.user; const requested = String(requestedStudentId || '').trim();
  if (user.role !== 'coach') {
    if (requested && requested !== user.id) throw new Error('Cet élève ne correspond pas au compte connecté.');
    return { user: user, studentId: user.id };
  }
  const allowed = new Set((auth.students || []).map((student) => String(student.id)));
  const studentId = requested || (auth.students[0] && String(auth.students[0].id)) || '';
  if (!studentId || !allowed.has(studentId)) throw new Error('Cet élève n’est pas associé à ce coach.');
  return { user: user, studentId: studentId };
}

function upsertProgress_(spreadsheet, data) {
  if (!data.sessionId || data.exerciseIndex === undefined) throw new Error('Séance ou index exercice manquant.');
  const key = progressKey_(data.studentId, data.sessionId, data.exerciseIndex); const sheet = spreadsheet.getSheetByName('APP_PROGRESS');
  return upsertCompositeIfNewer_(sheet, key, (row) => progressKey_(row['Élève ID'], row['Session ID'], row['Index exercice']), data.modifiedAt, {
    'Session ID': data.sessionId, 'Date séance': data.date || '', 'Séance': data.sessionName || '', 'Exercice ID': data.exerciseKey || '',
    'Index exercice': Number(data.exerciseIndex), 'Valeurs JSON': JSON.stringify(data.values || []), 'Commentaire élève': data.comment || '', 'Modifié le': writeDate_(data.modifiedAt), 'Élève ID': data.studentId || 'student-owner', 'Champs manuels JSON': JSON.stringify({ manualSets: data.manualSets || {}, commentTouched: Boolean(data.commentTouched) }),
  });
}

function upsertVideo_(spreadsheet, data) {
  if (!data.id || !data.sessionId || !data.url) throw new Error('Vidéo incomplète.');
  return upsertByKeyIfNewer_(spreadsheet.getSheetByName('APP_VIDEOS'), 'ID vidéo', data.id, data.modifiedAt, {
    'ID vidéo': data.id, 'Session ID': data.sessionId, 'Date séance': data.date || '', 'Séance': data.sessionName || '', 'Exercice ID': data.exerciseKey || '', 'Index exercice': Number(data.exerciseIndex || 0),
    'Exercice': data.exerciseName || '', 'URL YouTube': data.url, 'Statut coach': data.status || 'coach-review', 'Ajouté le': data.addedAt ? new Date(data.addedAt) : new Date(), 'Modifié le': writeDate_(data.modifiedAt), 'Élève ID': data.studentId || 'student-owner', 'Commentaire coach': data.coachComment || '', 'Supprimée': Boolean(data.deleted),
  });
}

function upsertExercise_(spreadsheet, data) {
  if (!data.id || !data.name) throw new Error('Exercice incomplet.');
  return upsertByKeyIfNewer_(spreadsheet.getSheetByName('APP_EXERCISES'), 'ID', data.id, data.modifiedAt, {
    'ID': data.id, 'Nom officiel': data.name, 'Famille': data.category || '', 'Sous-catégorie': data.subcategory || '', 'Niveau': data.level || '',
    'Métriques JSON': JSON.stringify(data.metrics || []), 'Alias JSON': JSON.stringify(data.aliases || []), 'Modifié le': writeDate_(data.modifiedAt), 'Archivé': Boolean(data.archived), 'Propriétaire ID': data.ownerId || '',
  });
}

function upsertSession_(spreadsheet, data, deleted) {
  if (!data.id) throw new Error('Identifiant de séance manquant.');
  const sheet = spreadsheet.getSheetByName('APP_SESSIONS'); const key = sessionKey_(data.studentId, data.id);
  return upsertCompositeIfNewer_(sheet, key, (row) => sessionKey_(row['Élève ID'], row['Session ID']), data.modifiedAt, {
    'Session ID': data.id, 'Date séance': data.date || '', 'Nom': data.name || '', 'Source': data.source || 'manual',
    'Repos': Boolean(data.isRest), 'Séance libre': Boolean(data.isFreeSession), 'Consignes': data.instructions || '',
    'Exercices JSON': JSON.stringify(data.exercises || []), 'Supprimée': Boolean(deleted), 'Modifié le': writeDate_(data.modifiedAt), 'Élève ID': data.studentId || 'student-owner', 'Champs modifiés JSON': JSON.stringify(data.overrideFields || []),
  });
}

function syncSheetCalendar_(spreadsheet, data) {
  const studentId = data.studentId || 'student-owner';
  const sessionSheet = spreadsheet.getSheetByName('APP_SESSIONS'); const progressSheet = spreadsheet.getSheetByName('APP_PROGRESS');
  const sessionRows = rowsAsObjects_(sessionSheet); const progressRows = rowsAsObjects_(progressSheet);
  const sessionsByKey = new Map(sessionRows.map((row) => [sessionKey_(row['Élève ID'], row['Session ID']), row]));
  const progressByKey = new Map(progressRows.map((row) => [progressKey_(row['Élève ID'], row['Session ID'], row['Index exercice']), row]));
  let changed = false;
  (data.sessions || []).forEach((session) => {
    if (!session.id || !session.date) return;
    const scopedSession = Object.assign({}, session, { studentId: studentId }); const sessionKey = sessionKey_(studentId, session.id);
    sessionsByKey.set(sessionKey, mergeSheetSessionRow_(sessionsByKey.get(sessionKey), scopedSession)); changed = true;
    (session.exercises || []).forEach((exercise, exerciseIndex) => {
      const item = typeof exercise === 'string' ? { name: exercise, targets: [] } : exercise;
      const progressData = {
        sessionId: session.id, date: session.date, sessionName: session.name, exerciseKey: item.matchKey || item.id || item.name || '',
        exerciseIndex: exerciseIndex, values: item.targets || [], comment: session.studentInfo || '', studentId: studentId,
        modifiedAt: session.modifiedAt,
      };
      const progressKey = progressKey_(studentId, session.id, exerciseIndex);
      progressByKey.set(progressKey, mergeSheetProgressRow_(progressByKey.get(progressKey), progressData));
    });
  });
  if (changed) { replaceRows_(sessionSheet, [...sessionsByKey.values()]); replaceRows_(progressSheet, [...progressByKey.values()]); }
  return changed;
}

function mergeSheetSessionRow_(existing, data) {
  const parsedManualFields = existing ? parseJson_(existing['Champs modifiés JSON'], []) : [];
  const manualFields = Array.isArray(parsedManualFields) ? parsedManualFields : [];
  const sheetValues = {
    'Session ID': data.id, 'Date séance': data.date || '', 'Nom': data.name || '', 'Source': 'google-sheet',
    'Repos': Boolean(data.isRest), 'Séance libre': Boolean(data.isFreeSession), 'Consignes': data.instructions || '',
    'Exercices JSON': JSON.stringify(data.exercises || []), 'Supprimée': existing ? truthy_(existing['Supprimée']) : false, 'Modifié le': writeDate_(data.modifiedAt),
    'Élève ID': data.studentId || 'student-owner', 'Champs modifiés JSON': JSON.stringify(manualFields),
  };
  const columnsForField = { date: 'Date séance', name: 'Nom', instructions: 'Consignes', exercises: 'Exercices JSON', isRest: 'Repos', isFreeSession: 'Séance libre' };
  manualFields.forEach((field) => { const column = columnsForField[field]; if (column && existing) sheetValues[column] = existing[column]; });
  return sheetValues;
}

function mergeSheetProgressRow_(existing, data) {
  const fields = existing ? parseJson_(existing['Champs manuels JSON'], {}) : {};
  const manualSets = fields.manualSets || {}; const sheetValues = Array.isArray(data.values) ? data.values : [];
  const existingValues = existing ? parseJson_(existing['Valeurs JSON'], []) : [];
  const count = Math.max(sheetValues.length, existingValues.length); const values = [];
  for (let index = 0; index < count; index += 1) {
    values[index] = manualSets[index] || manualSets[String(index)] ? existingValues[index] : sheetValues[index];
  }
  const commentTouched = Boolean(fields.commentTouched); const comment = commentTouched && existing ? String(existing['Commentaire élève'] || '') : String(data.comment || '');
  return {
    'Session ID': data.sessionId, 'Date séance': data.date || '', 'Séance': data.sessionName || '', 'Exercice ID': data.exerciseKey || '',
    'Index exercice': Number(data.exerciseIndex), 'Valeurs JSON': JSON.stringify(values), 'Commentaire élève': comment,
    'Modifié le': writeDate_(data.modifiedAt), 'Élève ID': data.studentId || 'student-owner',
    'Champs manuels JSON': JSON.stringify({ manualSets: manualSets, commentTouched: commentTouched }),
  };
}

function bulkSync_(spreadsheet, data, studentId) {
  let changed = false;
  (data.progress || []).forEach((item) => { changed = upsertProgress_(spreadsheet, Object.assign({}, item, { studentId: studentId })) || changed; });
  (data.videos || []).forEach((item) => { changed = upsertVideo_(spreadsheet, Object.assign({}, item, { studentId: studentId })) || changed; });
  (data.exercises || []).forEach((item) => { changed = upsertExercise_(spreadsheet, Object.assign({}, item, { ownerId: studentId })) || changed; });
  (data.sessions || []).forEach((item) => { changed = upsertSession_(spreadsheet, Object.assign({}, item, { studentId: studentId }), false) || changed; });
  return changed;
}

function buildSnapshot_(studentId, sinceValue) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet(); Object.keys(APP_SCHEMA).forEach((name) => ensureTechnicalSheet_(spreadsheet, name, APP_SCHEMA[name]));
  const belongsToStudent_ = (row) => String(row['Élève ID'] || 'student-owner') === studentId;
  const since = sinceValue ? new Date(sinceValue) : null; const partial = Boolean(since && !isNaN(since.getTime()));
  const changedSince_ = (row) => !partial || new Date(row['Modifié le']).getTime() > since.getTime();
  const progress = {}; rowsAsObjects_(spreadsheet.getSheetByName('APP_PROGRESS')).filter(belongsToStudent_).filter(changedSince_).forEach((row) => { const id = String(row['Session ID']); const index = String(row['Index exercice']); const fields = parseJson_(row['Champs manuels JSON'], {}); progress[id] = progress[id] || { values: {}, manualSets: {}, comment: '', commentTouched: false, modifiedAt: '' }; progress[id].values[index] = parseJson_(row['Valeurs JSON'], []); progress[id].manualSets[index] = fields.manualSets || {}; if (fields.commentTouched || row['Commentaire élève']) { progress[id].comment = String(row['Commentaire élève'] || ''); progress[id].commentTouched = true; } progress[id].modifiedAt = iso_(row['Modifié le']); });
  const videoRows = rowsAsObjects_(spreadsheet.getSheetByName('APP_VIDEOS')).filter(belongsToStudent_).filter(changedSince_);
  const videos = videoRows.filter((row) => !truthy_(row['Supprimée'])).map((row) => ({ id: String(row['ID vidéo']), sessionId: String(row['Session ID']), date: date_(row['Date séance']), sessionName: String(row['Séance'] || ''), exerciseKey: String(row['Exercice ID'] || ''), exerciseIndex: Number(row['Index exercice'] || 0), exerciseName: String(row['Exercice'] || ''), url: String(row['URL YouTube'] || ''), status: String(row['Statut coach'] || ''), coachComment: String(row['Commentaire coach'] || ''), studentId: String(row['Élève ID'] || 'student-owner'), addedAt: iso_(row['Ajouté le']), modifiedAt: iso_(row['Modifié le']) })).filter((item) => item.id && item.url);
  const deletedVideoIds = videoRows.filter((row) => truthy_(row['Supprimée'])).map((row) => String(row['ID vidéo'])).filter(Boolean);
  const exerciseRows = rowsAsObjects_(spreadsheet.getSheetByName('APP_EXERCISES')).filter((row) => !row['Propriétaire ID'] || String(row['Propriétaire ID']) === studentId).filter(changedSince_); const mapExercise_ = (row) => ({ id: String(row.ID), name: String(row['Nom officiel']), category: String(row.Famille || ''), subcategory: String(row['Sous-catégorie'] || ''), level: String(row.Niveau || ''), metrics: parseJson_(row['Métriques JSON'], []), aliases: parseJson_(row['Alias JSON'], []), modifiedAt: iso_(row['Modifié le']) });
  const exercises = exerciseRows.filter((row) => !truthy_(row.Archivé)).map(mapExercise_).filter((item) => item.id && item.name); const archivedExercises = exerciseRows.filter((row) => truthy_(row.Archivé)).map(mapExercise_).filter((item) => item.id && item.name);
  const sessionRows = rowsAsObjects_(spreadsheet.getSheetByName('APP_SESSIONS')).filter(belongsToStudent_).filter(changedSince_); const mapSession_ = (row) => ({ id: String(row['Session ID']), date: date_(row['Date séance']), name: String(row.Nom || ''), source: String(row.Source || 'manual'), isRest: truthy_(row.Repos), isFreeSession: truthy_(row['Séance libre']), instructions: String(row.Consignes || ''), exercises: parseJson_(row['Exercices JSON'], []), studentId: String(row['Élève ID'] || 'student-owner'), overrideFields: String(row['Champs modifiés JSON'] || '').trim() ? parseJson_(row['Champs modifiés JSON'], []) : null, modifiedAt: iso_(row['Modifié le']) });
  const archivedSessions = sessionRows.filter((row) => truthy_(row['Supprimée'])).map(mapSession_).filter((item) => item.id); const deletedSessionIds = archivedSessions.map((item) => item.id);
  const sessions = sessionRows.filter((row) => !truthy_(row['Supprimée'])).map(mapSession_).filter((item) => item.id && item.date && item.name);
  return { ok: true, partial: partial, studentId: studentId, progress, videos, deletedVideoIds, exercises, archivedExercises, sessions, archivedSessions, deletedSessionIds, revision: currentDataRevision_(), generatedAt: new Date().toISOString() };
}

function deleteOwnedVideo_(spreadsheet, data, studentId) {
  const id = data.id; const sheet = spreadsheet.getSheetByName('APP_VIDEOS'); const row = rowsAsObjects_(sheet).find((item) => String(item['ID vidéo']) === String(id));
  if (!row) return;
  if (String(row['Élève ID'] || 'student-owner') !== studentId) throw new Error('Cette vidéo appartient à un autre élève.');
  row['Supprimée'] = true; row['Modifié le'] = writeDate_(data.modifiedAt); return upsertByKeyIfNewer_(sheet, 'ID vidéo', id, data.modifiedAt, row);
}

function ensureTechnicalSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  headers.forEach((header, index) => { if (current[index] && current[index] !== header) throw new Error(name + ' : la colonne ' + (index + 1) + ' contient déjà « ' + current[index] + ' ».'); });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#25262b').setFontColor('#ffffff'); sheet.setFrozenRows(1); return sheet;
}

function rowsAsObjects_(sheet) { const values = sheet.getDataRange().getValues(); if (values.length < 2) return []; const headers = values[0].map(String); return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => headers.reduce((object, header, index) => { object[header] = row[index]; return object; }, {})); }
function upsertByKey_(sheet, keyHeader, key, values) { upsertComposite_(sheet, String(key), (row) => String(row[keyHeader]), values); }
function upsertByKeyIfNewer_(sheet, keyHeader, key, modifiedAt, values) { return upsertCompositeIfNewer_(sheet, String(key), (row) => String(row[keyHeader]), modifiedAt, values); }
function upsertCompositeIfNewer_(sheet, key, keyForRow, modifiedAt, values) { const rows = rowsAsObjects_(sheet); const existing = rows.find((row) => keyForRow(row) === key); const incoming = writeDate_(modifiedAt); if (existing && new Date(existing['Modifié le']).getTime() > incoming.getTime()) return false; upsertComposite_(sheet, key, keyForRow, Object.assign({}, values, { 'Modifié le': incoming })); return true; }
function upsertComposite_(sheet, key, keyForRow, values) { const rows = rowsAsObjects_(sheet); const index = rows.findIndex((row) => keyForRow(row) === key); const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String); const row = headers.map((header) => values[header] === undefined ? '' : values[header]); if (index >= 0) sheet.getRange(index + 2, 1, 1, headers.length).setValues([row]); else sheet.appendRow(row); }
function replaceRows_(sheet, rows) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String); const previousCount = Math.max(0, sheet.getLastRow() - 1);
  const values = rows.map((row) => headers.map((header) => row[header] === undefined ? '' : row[header]));
  const requiredRows = values.length + 1; if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  for (let index = 0; index < values.length; index += 500) { const batch = values.slice(index, index + 500); sheet.getRange(index + 2, 1, batch.length, headers.length).setValues(batch); }
  if (previousCount > values.length) sheet.getRange(values.length + 2, 1, previousCount - values.length, headers.length).clearContent();
}
function deleteByKey_(sheet, keyHeader, key) { const rows = rowsAsObjects_(sheet); const index = rows.findIndex((row) => String(row[keyHeader]) === String(key)); if (index >= 0) sheet.deleteRow(index + 2); }
function assertToken_(token) { const expected = PropertiesService.getScriptProperties().getProperty('APP_API_TOKEN'); if (!expected || token !== expected) throw new Error('Accès refusé.'); }
function parseJson_(value, fallback) { try { return JSON.parse(String(value || '')); } catch (error) { return fallback; } }
function iso_(value) { const date = value instanceof Date ? value : new Date(value); return isNaN(date.getTime()) ? '' : date.toISOString(); }
function writeDate_(value) { const date = value ? new Date(value) : new Date(); return isNaN(date.getTime()) ? new Date() : date; }
function date_(value) { if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return String(value || '').slice(0, 10); }
function truthy_(value) { return value === true || String(value).toLowerCase() === 'true' || String(value) === '1'; }
function sessionKey_(studentId, sessionId) { return String(studentId || 'student-owner') + '|' + String(sessionId || ''); }
function progressKey_(studentId, sessionId, exerciseIndex) { return sessionKey_(studentId, sessionId) + '|' + String(exerciseIndex); }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))).slice(0, 40); }
function ensureDataRevision_() { const properties = PropertiesService.getScriptProperties(); if (!properties.getProperty('APP_DATA_REVISION')) properties.setProperty('APP_DATA_REVISION', String(Date.now())); }
function currentDataRevision_() { ensureDataRevision_(); return PropertiesService.getScriptProperties().getProperty('APP_DATA_REVISION'); }
function touchDataRevision_() { const revision = String(Date.now()); PropertiesService.getScriptProperties().setProperty('APP_DATA_REVISION', revision); return revision; }
function output_(data, callback) { const json = JSON.stringify(data); if (callback && /^[A-Za-z_$][\w$\.]*$/.test(callback)) return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT); return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON); }
function bridgeOutput_(data, origin, requestId) { const safeOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(origin || '')) || /^https:\/\/[a-z0-9.-]+$/i.test(String(origin || '')) ? String(origin) : '*'; const message = JSON.stringify({ appTrainingBridge: true, requestId: String(requestId || ''), data: data }); return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>top.postMessage(' + JSON.stringify(message) + ',' + JSON.stringify(safeOrigin) + ');<\/script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }
