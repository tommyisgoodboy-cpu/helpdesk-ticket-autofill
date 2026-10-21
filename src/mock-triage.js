// Offline classifier used when no API key is configured. Plain keyword rules:
// good enough to demo the form-filling pipeline, not a substitute for the model.
import { DEPARTMENTS } from './directory.js';

const SUBSYSTEM_KEYWORDS = {
  Network: ['switch', 'router', 'uplink', 'vlan', 'link down', 'packet loss', 'bgp', 'firewall', 'vpn', 'latency'],
  'Power & Cooling': ['ups', 'power', 'generator', 'pdu', 'cooling', 'hvac', 'temperature', 'battery'],
  'Access Control': ['door', 'badge', 'access control', 'turnstile', 'card reader', 'reader'],
  Monitoring: ['monitoring', 'alert storm', 'agent not reporting', 'dashboard', 'no data', 'heartbeat'],
  Storage: ['disk', 'raid', 'san ', 'nas ', 'volume', 'backup', 'storage'],
  Applications: ['application', 'api', 'login', 'http 500', 'database', 'timeout'],
};

const SITE_CODE = { N: 'North', S: 'South', E: 'East', W: 'West' };

function score(text, words) {
  return words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
}

function detectSubsystem(text) {
  let best = 'Applications';
  let bestScore = 0;
  for (const [name, words] of Object.entries(SUBSYSTEM_KEYWORDS)) {
    const s = score(text, words);
    if (s > bestScore) [best, bestScore] = [name, s];
  }
  return best;
}

function detectRegion(text) {
  const code = text.match(/\b([nsew])-\d{2}\b/);
  if (code) return SITE_CODE[code[1].toUpperCase()];
  const word = text.match(/\b(north|south|east|west)\b/);
  return word ? word[1][0].toUpperCase() + word[1].slice(1) : 'Unknown';
}

function detectPriority(text) {
  if (/(critical|urgent|outage|offline|smoke|fire|all users|p1)/.test(text)) return 'P1';
  if (/(degraded|intermittent|failing|failed|warning|on battery)/.test(text)) return 'P2';
  if (/(request|question|minor|cosmetic)/.test(text)) return 'P4';
  return 'P3';
}

function detectCaller(email) {
  const from = email.match(/^from:\s*([^<\n]+?)\s*(?:<[^>]*>)?\s*$/im);
  const name = from ? from[1].trim() : '';
  const dept = DEPARTMENTS.find((d) => new RegExp(`\\b${d}\\b`, 'i').test(email.split(/regards|thanks/i).pop() ?? ''));
  return { name, department: dept ?? '' };
}

export function mockTriage(email) {
  const text = email.toLowerCase();
  const subject = email.match(/^subject:\s*(.+)$/im)?.[1]?.trim() ?? 'Fault report';
  const { name, department } = detectCaller(email);
  return {
    subsystem: detectSubsystem(text),
    region: detectRegion(text),
    priority: detectPriority(text),
    summary: subject.replace(/^\[[^\]]*\]\s*/, '').slice(0, 90),
    caller_name: name,
    caller_department: department,
  };
}
