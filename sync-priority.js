(function (root) {
  const SESSION_FIELDS = ['date', 'name', 'duration', 'energy', 'instructions', 'exercises', 'isRest', 'isFreeSession'];
  const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

  function buildSessionOverride(sheetSession, editedSession, modifiedAt) {
    const overrideFields = SESSION_FIELDS.filter((field) => !same(sheetSession?.[field], editedSession?.[field]));
    const override = { id: editedSession.id, source: 'google-sheet', overrideFields, modifiedAt };
    overrideFields.forEach((field) => { override[field] = editedSession[field]; });
    return override;
  }

  function applySessionOverride(sheetSession, override) {
    if (!override) return sheetSession;
    const fields = Array.isArray(override.overrideFields) ? override.overrideFields : SESSION_FIELDS;
    const result = { ...sheetSession };
    fields.forEach((field) => { if (Object.prototype.hasOwnProperty.call(override, field)) result[field] = override[field]; });
    return { ...result, id: sheetSession.id, source: sheetSession.source, overrideFields: fields, modifiedAt: override.modifiedAt || result.modifiedAt };
  }

  function compactSessionOverride(record) {
    if (!record) return record;
    // Les anciennes lignes APP_SESSIONS ne précisaient pas quels champs avaient
    // réellement été saisis dans l'application. Elles ne doivent donc pas
    // masquer les valeurs plus récentes des onglets mensuels.
    const fields = Array.isArray(record.overrideFields) ? record.overrideFields : [];
    const result = { id: record.id, source: 'google-sheet', overrideFields: fields, modifiedAt: record.modifiedAt || '' };
    fields.forEach((field) => { if (Object.prototype.hasOwnProperty.call(record, field)) result[field] = record[field]; });
    return result;
  }

  function effectiveSetValues(sheetTargets, manualValues, manualSets) {
    const targets = sheetTargets || []; const values = manualValues || []; const marks = manualSets || {};
    const count = Math.max(targets.length, values.length); const result = [];
    for (let index = 0; index < count; index += 1) {
      const manual = Boolean(marks[index]) || (values[index] !== undefined && values[index] !== null);
      const value = Number(manual ? values[index] : targets[index]);
      if (Number.isFinite(value) && value > 0) result.push(value);
    }
    return result;
  }

  function effectiveComment(progress, sheetComment) {
    if (progress?.commentTouched || String(progress?.comment || '').length) return String(progress.comment || '');
    return String(sheetComment || '');
  }

  function exerciseIdentity(exercise) {
    if (typeof exercise === 'string') return exercise.trim().toLowerCase();
    return String(exercise?.matchKey || exercise?.id || exercise?.name || '').trim().toLowerCase();
  }

  function normalizeSeriesCount(value, fallback = 1) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(20, Math.max(1, parsed));
  }

  function plannedSeriesCount(exercise) {
    if (!exercise || typeof exercise === 'string') return 0;
    const explicit = Math.trunc(Number(exercise.seriesCount));
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return Array.isArray(exercise.targets) ? exercise.targets.length : 0;
  }

  function googleCredentialExpiresAt(credential, decodeBase64 = (value) => atob(value)) {
    try {
      const payload = String(credential || '').split('.')[1];
      if (!payload) return 0;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      return Number(JSON.parse(decodeBase64(normalized)).exp || 0) * 1000;
    } catch (error) { return 0; }
  }

  function googleCredentialNeedsRefresh(credential, now = Date.now(), decodeBase64) {
    const expiresAt = googleCredentialExpiresAt(credential, decodeBase64);
    return !expiresAt || expiresAt - now < 5 * 60 * 1000;
  }

  function normalizedExerciseSearch(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function exerciseMatchesSearch(exercise, query) {
    const normalizedQuery = normalizedExerciseSearch(query);
    if (!normalizedQuery) return true;
    const item = typeof exercise === 'string' ? { name: exercise } : exercise || {};
    const searchable = normalizedExerciseSearch([item.name, item.category, item.subcategory, item.level, ...(item.aliases || [])].filter(Boolean).join(' '));
    return normalizedQuery.split(/\s+/).every((term) => searchable.includes(term));
  }

  function reconcileSessionExercises(existingExercises, exerciseDrafts) {
    const existingByKey = new Map((existingExercises || []).map((exercise) => [exerciseIdentity(exercise), exercise]));
    return (exerciseDrafts || []).map((draft) => {
      const existing = existingByKey.get(exerciseIdentity(draft));
      const seriesCount = normalizeSeriesCount(draft.seriesCount);
      const previousTargets = typeof existing === 'string' ? [] : Array.isArray(existing?.targets) ? existing.targets : [];
      const targets = Array.from({ length: seriesCount }, (_, index) => previousTargets[index] ?? draft.targets?.[index] ?? 0);
      return { ...(typeof existing === 'object' && existing ? existing : {}), ...draft, seriesCount, targets };
    });
  }

  function remapSessionProgress(progress, existingExercises, updatedExercises) {
    if (!progress) return progress;
    const oldIndexByKey = new Map((existingExercises || []).map((exercise, index) => [exerciseIdentity(exercise), index]));
    const values = {}; const manualSets = {};
    (updatedExercises || []).forEach((exercise, newIndex) => {
      const oldIndex = oldIndexByKey.get(exerciseIdentity(exercise));
      if (oldIndex === undefined) return;
      const seriesCount = plannedSeriesCount(exercise) || 1;
      if (Array.isArray(progress.values?.[oldIndex])) values[newIndex] = progress.values[oldIndex].slice(0, seriesCount);
      if (progress.manualSets?.[oldIndex] && typeof progress.manualSets[oldIndex] === 'object') {
        manualSets[newIndex] = Object.fromEntries(Object.entries(progress.manualSets[oldIndex]).filter(([setIndex]) => Number(setIndex) < seriesCount));
      }
    });
    return { ...progress, values, manualSets };
  }

  root.SessionSyncPriority = { SESSION_FIELDS, buildSessionOverride, applySessionOverride, compactSessionOverride, effectiveSetValues, effectiveComment, normalizeSeriesCount, plannedSeriesCount, googleCredentialExpiresAt, googleCredentialNeedsRefresh, exerciseMatchesSearch, reconcileSessionExercises, remapSessionProgress };
})(globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.SessionSyncPriority;
