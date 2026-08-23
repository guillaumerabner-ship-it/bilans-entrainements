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

  root.SessionSyncPriority = { SESSION_FIELDS, buildSessionOverride, applySessionOverride, compactSessionOverride, effectiveSetValues, effectiveComment };
})(globalThis);
