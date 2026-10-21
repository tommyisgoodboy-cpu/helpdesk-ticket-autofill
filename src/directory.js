// Fictional staff directory. Everything here is made up for the demo.
// It plays the role of the helpdesk's user database: the /api/users endpoint
// serves it page by page, and the triage step resolves assignees from it.

const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Drew',
  'Robin', 'Sky', 'Reese', 'Parker', 'Hayden', 'Rowan', 'Emery', 'Skyler', 'Dana', 'Kai'];
const LAST = ['Chan', 'Lee', 'Lam', 'Ng', 'Cheung', 'Ho', 'Tsang', 'Yip', 'Fung', 'Law'];
export const DEPARTMENTS = ['Facilities', 'Finance', 'HR', 'Operations', 'Security', 'Sales'];

const FIXTURES = {
  20: { name: 'Grace Lau', department: 'Operations' },
  30: { name: 'Ivy Tran', department: 'Operations' },
  41: { name: 'Tom Okafor', department: 'Monitoring' },
  50: { name: 'Sam Wong', department: 'Facilities' },
  66: { name: 'Leo Martin', department: 'Applications' },
  71: { name: 'Omar Haddad', department: 'Operations' },
  87: { name: 'Priya Nair', department: 'Network' },
  95: { name: 'Marcus Reid', department: 'Power & Cooling' },
  99: { name: 'Nina Petrova', department: 'Operations' },
  103: { name: 'Elena Cruz', department: 'Access Control' },
  108: { name: 'Ben Carter', department: 'Operations' },
  112: { name: 'Hana Sato', department: 'Storage' },
  // Same display name as u-0050 on purpose: the picker only shows name + department.
  119: { name: 'Sam Wong', department: 'Finance' },
};

function slug(name) {
  return name.toLowerCase().replace(/[^a-z]+/g, '.');
}

export const USERS = Array.from({ length: 120 }, (_, i) => {
  const base = {
    name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
  };
  const { name, department } = FIXTURES[i] ?? base;
  return { id: `u-${String(i).padStart(4, '0')}`, name, department, email: `${slug(name)}.${i}@example.com` };
});

// Who owns each subsystem, and who is the on-site contact per region.
const byName = (name, department) => USERS.find((u) => u.name === name && u.department === department);

const ASSIGNEES = {
  Network: byName('Priya Nair', 'Network'),
  'Power & Cooling': byName('Marcus Reid', 'Power & Cooling'),
  'Access Control': byName('Elena Cruz', 'Access Control'),
  Monitoring: byName('Tom Okafor', 'Monitoring'),
  Storage: byName('Hana Sato', 'Storage'),
  Applications: byName('Leo Martin', 'Applications'),
};

const REGION_CONTACTS = {
  North: byName('Ivy Tran', 'Operations'),
  South: byName('Omar Haddad', 'Operations'),
  East: byName('Nina Petrova', 'Operations'),
  West: byName('Ben Carter', 'Operations'),
};

const brief = (u) => (u ? { name: u.name, department: u.department } : null);

export function resolveAssignee(subsystem) {
  return brief(ASSIGNEES[subsystem]);
}

export function resolveRegionalContact(region) {
  return brief(REGION_CONTACTS[region]);
}
