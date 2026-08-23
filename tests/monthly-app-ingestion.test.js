const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
const context = { console, Map, Set, Date, JSON, String, Number, Boolean, Math, Object, Array, Error };
vm.createContext(context);
vm.runInContext(source, context);

const sheetProgress = context.mergeSheetProgressRow_(null, {
  sessionId: 'sheet-stable-test', date: '2026-08-23', sessionName: 'Push', exerciseKey: 'dips', exerciseIndex: 0,
  values: [8, 7], comment: 'Bonnes sensations', studentId: 'student-owner', modifiedAt: '2026-08-23T10:00:00.000Z',
});
assert.deepStrictEqual(JSON.parse(sheetProgress['Valeurs JSON']), [8, 7]);
assert.strictEqual(sheetProgress['Commentaire élève'], 'Bonnes sensations');

const preservedProgress = context.mergeSheetProgressRow_({
  'Valeurs JSON': '[10,6]', 'Commentaire élève': 'Saisie application',
  'Champs manuels JSON': '{"manualSets":{"0":true},"commentTouched":true}',
}, {
  sessionId: 'sheet-stable-test', date: '2026-08-23', sessionName: 'Push', exerciseKey: 'dips', exerciseIndex: 0,
  values: [8, 7], comment: 'Tableau mensuel', studentId: 'student-owner', modifiedAt: '2026-08-23T10:00:00.000Z',
});
assert.deepStrictEqual(JSON.parse(preservedProgress['Valeurs JSON']), [10, 7]);
assert.strictEqual(preservedProgress['Commentaire élève'], 'Saisie application');

const preservedSession = context.mergeSheetSessionRow_({
  'Nom': 'Nom application', 'Consignes': 'Ancienne consigne', 'Supprimée': false,
  'Champs modifiés JSON': '["name"]',
}, {
  id: 'sheet-stable-test', date: '2026-08-23', name: 'Nom tableau', instructions: 'Test Sync', exercises: [],
  studentId: 'student-owner', modifiedAt: '2026-08-23T10:00:00.000Z',
});
assert.strictEqual(preservedSession.Nom, 'Nom application');
assert.strictEqual(preservedSession.Consignes, 'Test Sync');
assert.strictEqual(context.progressKey_('student-a', 'same-session', 0), 'student-a|same-session|0');
assert.notStrictEqual(context.progressKey_('student-a', 'same-session', 0), context.progressKey_('student-b', 'same-session', 0));
assert.strictEqual(context.monthlyDate_('dimanche 23/08', 2026), '2026-08-23');
assert.strictEqual(context.normalizeSheetLabel_('Infos élève'), 'infoseleve');
const monthlyRows = [
  ['OL FL', '', '', '', '', '', '', '', '', ''],
  ['8', '7', '6', '', '', '', '', '', '', ''],
  ['FL tuck raises', '', '', '', '', '', '', '', '', ''],
  ['5', '4', '4', '', '', '', '', '', '', ''],
];
const fakeMonthlySheet = { getRange: () => ({ getDisplayValues: () => monthlyRows }) };
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.monthlyExercisesForBlock_(fakeMonthlySheet, 29, 117, 123))), [
  { name: 'OL FL', targets: [8, 7, 6] },
  { name: 'FL tuck raises', targets: [5, 4, 4] },
]);
assert.strictEqual(context.monthlyInfoText_(['Infos élève', 'Test App 2', '', '', 'Infos élève', ''], 1), 'Test App 2');

console.log('Tests ingestion MOIS vers APP : OK');
