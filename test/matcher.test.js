import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('../public/autofill.js');
const { matchRow, normalize } = globalThis.HelpdeskAutofill;

const rows = [
  { name: 'Alex Chan', department: 'Facilities' },
  { name: 'Sam Wong', department: 'Facilities' },
  { name: 'Sam  Wong', department: 'Finance' },
];

test('normalize collapses case and whitespace', () => {
  assert.equal(normalize('  Sam   WONG '), 'sam wong');
});

test('unique name matches', () => {
  assert.equal(matchRow(rows, { name: 'alex chan' }).status, 'matched');
});

test('duplicate name is disambiguated by department', () => {
  const m = matchRow(rows, { name: 'Sam Wong', department: 'Finance' });
  assert.equal(m.status, 'matched');
  assert.equal(m.row.department, 'Finance');
});

test('duplicate name without department is ambiguous, never a guess', () => {
  assert.deepEqual(matchRow(rows, { name: 'Sam Wong' }), { status: 'ambiguous', count: 2 });
});

test('unknown name is missing', () => {
  assert.equal(matchRow(rows, { name: 'Nobody Here' }).status, 'missing');
});
