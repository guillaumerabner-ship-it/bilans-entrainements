const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'sync-priority.js'), 'utf8');
const context = {}; vm.createContext(context); vm.runInContext(source, context);
const sync = context.SessionSyncPriority;

const sheet = { id: 's1', source: 'google-sheet', date: '2026-08-24', name: 'FL', instructions: 'Filmer', exercises: [{ name: 'Front lever', targets: [5, 5] }], isRest: false, isFreeSession: false };
const edited = { ...sheet, name: 'FL technique' };
const override = sync.buildSessionOverride(sheet, edited, '2026-08-22T20:00:00.000Z');
assert.deepStrictEqual(Array.from(override.overrideFields), ['name']);
const refreshedSheet = { ...sheet, instructions: 'Filmer de profil', exercises: [{ name: 'Front lever', targets: [7, 6] }] };
const merged = sync.applySessionOverride(refreshedSheet, override);
assert.strictEqual(merged.name, 'FL technique');
assert.strictEqual(merged.instructions, 'Filmer de profil');
assert.strictEqual(merged.exercises[0].targets[0], 7);
assert.deepStrictEqual(Array.from(sync.effectiveSetValues([7, 6], [], {})), [7, 6]);
assert.deepStrictEqual(Array.from(sync.effectiveSetValues([7, 6], [9], { 0: true })), [9, 6]);
assert.deepStrictEqual(Array.from(sync.effectiveSetValues([7, 6], [0], { 0: true })), [6]);
assert.strictEqual(sync.effectiveComment({}, 'Commentaire du tableau'), 'Commentaire du tableau');
assert.strictEqual(sync.effectiveComment({ comment: '', commentTouched: true }, 'Commentaire du tableau'), '');
assert.strictEqual(sync.normalizeSeriesCount('4'), 4);
assert.strictEqual(sync.normalizeSeriesCount('99'), 20);
assert.strictEqual(sync.normalizeSeriesCount('0'), 1);
assert.strictEqual(sync.plannedSeriesCount({ seriesCount: 4, targets: [] }), 4);
assert.strictEqual(sync.plannedSeriesCount({ targets: [8, 7, 6] }), 3);
assert.strictEqual(sync.plannedSeriesCount('Ancien exercice'), 0);
const jwtPayload = Buffer.from(JSON.stringify({ exp: 2000 })).toString('base64url');
const fakeCredential = `header.${jwtPayload}.signature`;
const decodeJwt = (value) => Buffer.from(value, 'base64').toString('utf8');
assert.strictEqual(sync.googleCredentialExpiresAt(fakeCredential, decodeJwt), 2000000);
assert.strictEqual(sync.googleCredentialNeedsRefresh(fakeCredential, 1600000, decodeJwt), false);
assert.strictEqual(sync.googleCredentialNeedsRefresh(fakeCredential, 1800001, decodeJwt), true);
assert.strictEqual(sync.googleCredentialNeedsRefresh('invalide', 0, decodeJwt), true);

const existingExercises = [
  { name: 'Dips', matchKey: 'dips', seriesCount: 3, targets: [10, 9, 8], note: 'conserver' },
  { name: 'Tractions', matchKey: 'tractions', seriesCount: 2, targets: [6, 5] },
];
const editedExercises = sync.reconcileSessionExercises(existingExercises, [
  { name: 'Tractions', matchKey: 'tractions', seriesCount: 3, targets: [0, 0, 0], metric: 'repetitions' },
  { name: 'Pompes', matchKey: 'pompes', seriesCount: 2, targets: [0, 0], metric: 'repetitions' },
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(editedExercises)), [
  { name: 'Tractions', matchKey: 'tractions', seriesCount: 3, targets: [6, 5, 0], metric: 'repetitions' },
  { name: 'Pompes', matchKey: 'pompes', seriesCount: 2, targets: [0, 0], metric: 'repetitions' },
]);
const remappedProgress = sync.remapSessionProgress({ values: { 0: [10, 9, 8], 1: [6, 5] }, manualSets: { 0: { 0: true }, 1: { 0: true, 1: true } }, comment: 'Solide', commentTouched: true }, existingExercises, editedExercises);
assert.deepStrictEqual(JSON.parse(JSON.stringify(remappedProgress)), { values: { 0: [6, 5] }, manualSets: { 0: { 0: true, 1: true } }, comment: 'Solide', commentTouched: true });
console.log('Tests de priorité champ par champ : OK');
