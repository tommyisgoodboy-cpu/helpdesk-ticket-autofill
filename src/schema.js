export const SUBSYSTEMS = ['Network', 'Power & Cooling', 'Access Control', 'Monitoring', 'Storage', 'Applications'];
export const REGIONS = ['North', 'South', 'East', 'West', 'Unknown'];
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

// Tool the model is asked to call. The model classifies; it does not pick people.
// Assignees and regional contacts are resolved from the directory in code, so a
// wrong or invented name can never reach the form.
export const TRIAGE_TOOL = {
  name: 'submit_triage',
  description:
    'Submit the triage result for one fault email. Call this exactly once. ' +
    'Use "Unknown" for region and an empty string for caller fields when the email does not say.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      subsystem: { type: 'string', enum: SUBSYSTEMS, description: 'Which subsystem the fault belongs to.' },
      region: { type: 'string', enum: REGIONS, description: 'Site region the fault is in.' },
      priority: {
        type: 'string',
        enum: PRIORITIES,
        description: 'P1 service down or safety risk, P2 degraded, P3 normal, P4 request or cosmetic.',
      },
      summary: { type: 'string', description: 'One-line ticket title, at most 90 characters.' },
      caller_name: { type: 'string', description: 'Person who reported the fault, or empty string.' },
      caller_department: { type: 'string', description: "Reporter's department if stated, or empty string." },
    },
    required: ['subsystem', 'region', 'priority', 'summary', 'caller_name', 'caller_department'],
    additionalProperties: false,
  },
};

export function validateTriage(input) {
  const problems = [];
  const oneOf = (key, allowed) => {
    if (!allowed.includes(input?.[key])) problems.push(`${key} must be one of ${allowed.join(', ')}`);
  };
  oneOf('subsystem', SUBSYSTEMS);
  oneOf('region', REGIONS);
  oneOf('priority', PRIORITIES);
  for (const key of ['summary', 'caller_name', 'caller_department']) {
    if (typeof input?.[key] !== 'string') problems.push(`${key} must be a string`);
  }
  if (problems.length) throw new Error(`Invalid triage result: ${problems.join('; ')}`);
  return {
    subsystem: input.subsystem,
    region: input.region,
    priority: input.priority,
    summary: input.summary.trim().slice(0, 90),
    caller_name: input.caller_name.trim(),
    caller_department: input.caller_department.trim(),
  };
}
