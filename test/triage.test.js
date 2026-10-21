import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mockTriage } from '../src/mock-triage.js';
import { validateTriage } from '../src/schema.js';
import { classifyWithClaude, resolveMode, triage } from '../src/triage.js';
import { USERS, resolveAssignee, resolveRegionalContact } from '../src/directory.js';

const sample = (name) => readFile(new URL(`../examples/${name}.txt`, import.meta.url), 'utf8');

test('mock: UPS email goes to Power & Cooling, North, P1', async () => {
  const r = validateTriage(mockTriage(await sample('01-ups-on-battery')));
  assert.equal(r.subsystem, 'Power & Cooling');
  assert.equal(r.region, 'North');
  assert.equal(r.priority, 'P1');
  assert.equal(r.caller_name, 'Sam Wong');
  assert.equal(r.caller_department, 'Facilities');
});

test('mock: switch email goes to Network, East', async () => {
  const r = validateTriage(mockTriage(await sample('02-core-switch-uplink')));
  assert.equal(r.subsystem, 'Network');
  assert.equal(r.region, 'East');
});

test('mock: badge readers go to Access Control, West', async () => {
  const r = validateTriage(mockTriage(await sample('03-badge-readers-offline')));
  assert.equal(r.subsystem, 'Access Control');
  assert.equal(r.region, 'West');
});

test('validateTriage rejects values outside the enums', () => {
  assert.throws(() => validateTriage({ subsystem: 'Printers', region: 'North', priority: 'P1', summary: 'x', caller_name: '', caller_department: '' }), /subsystem/);
});

test('directory: every subsystem and region resolves, with a duplicate-name fixture', () => {
  for (const s of ['Network', 'Power & Cooling', 'Access Control', 'Monitoring', 'Storage', 'Applications']) assert.ok(resolveAssignee(s), s);
  for (const r of ['North', 'South', 'East', 'West']) assert.ok(resolveRegionalContact(r), r);
  assert.equal(USERS.filter((u) => u.name === 'Sam Wong').length, 2);
});

test('triage(): mock mode resolves assignee and regional contact from the directory', async () => {
  const r = await triage(await sample('01-ups-on-battery'), { mode: 'mock' });
  assert.deepEqual(r.assignee, { name: 'Marcus Reid', department: 'Power & Cooling' });
  assert.deepEqual(r.regional_contact, { name: 'Ivy Tran', department: 'Operations' });
  assert.deepEqual(r.caller, { name: 'Sam Wong', department: 'Facilities' });
});

test('claude path: parses the tool call, validates it, and does not force tool_choice', async () => {
  let request;
  const client = {
    messages: {
      create: async (params) => {
        request = params;
        return {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', name: 'submit_triage', input: { subsystem: 'Storage', region: 'South', priority: 'P2', summary: 'Backup failed', caller_name: '', caller_department: '' } }],
        };
      },
    },
  };
  const r = await classifyWithClaude('Subject: backup failed', { client, model: 'test-model' });
  assert.equal(r.subsystem, 'Storage');
  assert.equal(request.tool_choice, undefined);
  assert.equal(request.tools[0].strict, true);
  assert.match(request.messages[0].content, /<email>/);
});

test('claude path: missing tool call is an error', async () => {
  const client = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }) } };
  await assert.rejects(classifyWithClaude('x', { client }), /did not call submit_triage/);
});

test('resolveMode', () => {
  assert.equal(resolveMode({}), 'mock');
  assert.equal(resolveMode({ ANTHROPIC_API_KEY: 'k' }), 'claude');
  assert.equal(resolveMode({ ANTHROPIC_API_KEY: 'k', TRIAGE_MODE: 'mock' }), 'mock');
});
