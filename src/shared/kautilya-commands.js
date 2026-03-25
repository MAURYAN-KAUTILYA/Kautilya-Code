const BASE_VARIANT_CAPS = {
  '812': {
    sections: ['Simple'],
    mediums: ['ask', 'build'],
  },
  '812hybrid': {
    sections: ['Simple', 'Think'],
    mediums: ['ask', 'plan', 'build'],
  },
  '812+': {
    sections: ['Simple', 'Think', 'Chanakya Intelligence'],
    mediums: ['ask', 'plan', 'build'],
  },
  '812+hybrid': {
    sections: ['Simple', 'Think', 'Chanakya Intelligence'],
    mediums: ['ask', 'plan', 'build'],
  },
};

export const COMMAND_TIERS = {
  standard: 'Standard',
  elite: 'Elite',
  sentinel: 'Sentinel',
};

export const PERSISTENT_COMMANDS = ['debug', 'freeze', 'nofake'];
export const UTILITY_COMMANDS = ['status', 'resetmode', 'commands'];

export const DEFAULT_PERSISTENT_COMMANDS = {
  debug: false,
  freeze: false,
  nofake: false,
};

const command = (name, config) => ({
  name,
  slash: `/${name}`,
  tier: 'standard',
  type: 'temporary',
  category: 'modifier',
  costMultiplier: 1,
  chipLabel: config.label || name,
  help: '',
  ...config,
});

export const COMMAND_REGISTRY = {
  plan: command('plan', {
    label: 'Plan',
    category: 'intent',
    help: 'Plan the task before touching code.',
    effectiveMedium: 'plan',
  }),
  ask: command('ask', {
    label: 'Ask',
    category: 'intent',
    help: 'Q&A only. No code generation or file writes.',
    effectiveMedium: 'ask',
  }),
  build: command('build', {
    label: 'Build',
    category: 'intent',
    help: 'Lightweight implementation path for scoped work.',
    effectiveMedium: 'build',
  }),
  debug: command('debug', {
    label: 'Debug',
    type: 'persistent',
    category: 'policy',
    indicator: 'DEBUG',
    help: 'Persistent bugfix-only mode. No new features or rewrites.',
  }),
  freeze: command('freeze', {
    label: 'Freeze',
    type: 'persistent',
    category: 'policy',
    indicator: 'FREEZE',
    help: 'Persistent scope lock. Do not touch anything outside the explicit task boundary.',
  }),
  diff: command('diff', {
    label: 'Diff',
    category: 'output',
    help: 'Explain exactly what changed before final output.',
  }),
  explain: command('explain', {
    label: 'Explain',
    category: 'output',
    help: 'Over-explain decisions and tradeoffs.',
  }),
  minimal: command('minimal', {
    label: 'Minimal',
    category: 'output',
    help: 'Strip narration and keep output as lean as possible.',
  }),
  refactor: command('refactor', {
    label: 'Refactor',
    category: 'intent',
    help: 'Improve structure without changing behavior.',
  }),
  types: command('types', {
    label: 'Types',
    category: 'intent',
    help: 'Add or repair TypeScript types only.',
  }),
  docs: command('docs', {
    label: 'Docs',
    category: 'intent',
    help: 'Generate documentation only. No logic changes.',
  }),
  test: command('test', {
    label: 'Test',
    category: 'intent',
    help: 'Generate runnable tests for the current code.',
  }),
  git: command('git', {
    label: 'Git',
    category: 'intent',
    help: 'Generate a conventional commit message for current changes.',
  }),
  rollback: command('rollback', {
    label: 'Rollback',
    category: 'intent',
    help: 'Discard the last approach and force a different one.',
  }),
  contextrevise: command('contextrevise', {
    label: 'Context Revise',
    category: 'intent',
    help: 'Summarize what is done, pending, broken, and next.',
    effectiveMedium: 'plan',
  }),
  think: command('think', {
    label: 'Think',
    tier: 'elite',
    category: 'modifier',
    costMultiplier: 1.15,
    help: 'Increase reasoning depth for one request.',
    minSection: 'Think',
  }),
  research: command('research', {
    label: 'Research',
    tier: 'elite',
    category: 'modifier',
    costMultiplier: 1.25,
    help: 'Pre-authorize the web research specialist for this request.',
  }),
  inspiredesign: command('inspiredesign', {
    label: 'Inspire Design',
    tier: 'elite',
    category: 'modifier',
    costMultiplier: 1.25,
    help: 'Pre-authorize the design inspiration specialist for this request.',
  }),
  future: command('future', {
    label: 'Future',
    tier: 'elite',
    category: 'intent',
    help: 'Map likely next steps and extension paths.',
  }),
  perf: command('perf', {
    label: 'Perf',
    tier: 'elite',
    category: 'intent',
    help: 'Run a performance-focused audit.',
  }),
  heavylift: command('heavylift', {
    label: 'HeavyLift',
    tier: 'elite',
    category: 'intent',
    costMultiplier: 1.6,
    help: 'Escalate to the strongest available orchestration posture.',
    minSection: 'Chanakya Intelligence',
  }),
  solo: command('solo', {
    label: 'Solo',
    tier: 'elite',
    category: 'intent',
    costMultiplier: 2,
    help: 'Autonomous execution mode. Requires careful review.',
    minSection: 'Chanakya Intelligence',
  }),
  kautilyarules: command('kautilyarules', {
    label: 'Kautilya Rules',
    tier: 'elite',
    category: 'modifier',
    help: 'Reframe structure and tradeoffs through Chanakya doctrine.',
  }),
  audit: command('audit', {
    label: 'Audit',
    tier: 'sentinel',
    category: 'intent',
    help: 'Review before acting. Findings first.',
    effectiveMedium: 'plan',
  }),
  secure: command('secure', {
    label: 'Secure',
    tier: 'sentinel',
    category: 'intent',
    help: 'Security-focused review path.',
    effectiveMedium: 'plan',
  }),
  destroy: command('destroy', {
    label: 'Destroy',
    tier: 'sentinel',
    category: 'intent',
    costMultiplier: 1.1,
    help: 'Adversarial destroyer scan.',
    effectiveMedium: 'plan',
  }),
  nofake: command('nofake', {
    label: 'NoFake',
    tier: 'sentinel',
    type: 'persistent',
    category: 'policy',
    indicator: 'NOFAKE',
    help: 'Persistent production rule: no fake wiring, no placeholders, no pretend imports.',
  }),
  analyse: command('analyse', {
    label: 'Analyse',
    tier: 'sentinel',
    category: 'intent',
    help: 'Read the existing project first before changing anything.',
    effectiveMedium: 'plan',
  }),
  kautilyavoice: command('kautilyavoice', {
    label: 'Kautilya Voice',
    tier: 'elite',
    category: 'modifier',
    help: 'Use an overt Chanakya-inspired response voice for one reply.',
  }),
  status: command('status', {
    label: 'Status',
    type: 'utility',
    category: 'utility',
    help: 'Show active persistent commands and request posture.',
  }),
  resetmode: command('resetmode', {
    label: 'Reset Mode',
    type: 'utility',
    category: 'utility',
    help: 'Clear all persistent command policies.',
  }),
  commands: command('commands', {
    label: 'Commands',
    type: 'utility',
    category: 'utility',
    help: 'Open the slash-command reference.',
  }),
};

export const COMMAND_LIST = Object.values(COMMAND_REGISTRY);

const SECTION_RANK = {
  Simple: 0,
  Think: 1,
  'Chanakya Intelligence': 2,
};

function normalizePersistentCommands(input) {
  return {
    ...DEFAULT_PERSISTENT_COMMANDS,
    ...(input || {}),
  };
}

function uniqueNames(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function parseLeadingSlashCommands(text) {
  const source = String(text || '');
  let cursor = 0;
  const tokens = [];

  while (cursor < source.length) {
    const slice = source.slice(cursor);
    const match = slice.match(/^\s*\/([a-z][a-z0-9]*)\b/i);
    if (!match) break;
    const raw = `/${match[1]}`;
    tokens.push({
      token: raw,
      name: match[1].toLowerCase(),
      recognized: Boolean(COMMAND_REGISTRY[match[1].toLowerCase()]),
    });
    cursor += match[0].length;
  }

  return {
    tokens,
    body: source.slice(cursor).replace(/^\s+/, ''),
  };
}

function sectionForRank(rank) {
  return Object.entries(SECTION_RANK).find(([, value]) => value === rank)?.[0] || 'Simple';
}

function elevateSection(baseSection, desiredSection, variant) {
  const caps = BASE_VARIANT_CAPS[variant] || BASE_VARIANT_CAPS['812'];
  const allowedRanks = caps.sections.map((section) => SECTION_RANK[section] ?? 0);
  const maxAllowedRank = Math.max(...allowedRanks);
  const baseRank = SECTION_RANK[baseSection] ?? 0;
  const desiredRank = SECTION_RANK[desiredSection] ?? baseRank;
  const nextRank = Math.min(Math.max(baseRank, desiredRank), maxAllowedRank);
  return sectionForRank(nextRank);
}

export function resolveCommandSet({
  commandNames = [],
  persistentCommands = DEFAULT_PERSISTENT_COMMANDS,
  variant = '812+',
  section = 'Simple',
  medium = 'build',
} = {}) {
  const activePersistent = normalizePersistentCommands(persistentCommands);
  const normalizedNames = commandNames.map((name) => String(name || '').toLowerCase()).filter(Boolean);
  const duplicateNames = normalizedNames.filter((name, index) => normalizedNames.indexOf(name) !== index);
  const uniqueCommandNames = uniqueNames(normalizedNames);
  const unknown = uniqueCommandNames.filter((name) => !COMMAND_REGISTRY[name]);
  const knownNames = uniqueCommandNames.filter((name) => COMMAND_REGISTRY[name]);
  const commands = knownNames.map((name) => COMMAND_REGISTRY[name]);

  const errors = [];
  const warnings = [];
  const notices = [];
  const toggledPersistent = {};
  const nextPersistent = { ...activePersistent };

  for (const name of knownNames) {
    const config = COMMAND_REGISTRY[name];
    if (config.type === 'persistent') {
      nextPersistent[name] = !activePersistent[name];
      toggledPersistent[name] = nextPersistent[name];
    }
  }

  if (duplicateNames.length) {
    warnings.push(`Duplicate commands ignored: ${uniqueNames(duplicateNames).map((name) => `/${name}`).join(', ')}`);
  }
  if (unknown.length) {
    errors.push(`Unknown commands: ${unknown.map((name) => `/${name}`).join(', ')}`);
  }

  const primaryIntents = commands.filter((config) => config.category === 'intent').map((config) => config.name);
  if (primaryIntents.length > 1) {
    errors.push(`Use only one primary command at a time. Found: ${primaryIntents.map((name) => `/${name}`).join(', ')}`);
  }

  if (knownNames.includes('minimal') && knownNames.includes('explain')) {
    errors.push('Use either /minimal or /explain, not both.');
  }
  if (knownNames.includes('ask') && primaryIntents.some((name) => name !== 'ask')) {
    errors.push('/ask cannot be combined with code-generating primary commands.');
  }
  if (knownNames.includes('solo') && (knownNames.includes('audit') || knownNames.includes('secure') || knownNames.includes('destroy'))) {
    errors.push('/solo cannot be combined with /audit, /secure, or /destroy.');
  }

  const primaryIntent = primaryIntents[0] || null;
  let effectiveMedium = String(medium || 'build').toLowerCase();
  if (primaryIntent && COMMAND_REGISTRY[primaryIntent]?.effectiveMedium) {
    effectiveMedium = COMMAND_REGISTRY[primaryIntent].effectiveMedium;
  }
  if (!['ask', 'plan', 'build'].includes(effectiveMedium)) {
    effectiveMedium = 'build';
  }

  let effectiveSection = String(section || 'Simple');
  if (knownNames.includes('think')) effectiveSection = elevateSection(effectiveSection, 'Think', variant);
  if (knownNames.includes('heavylift') || knownNames.includes('solo')) {
    effectiveSection = elevateSection(effectiveSection, 'Chanakya Intelligence', variant);
  }

  const caps = BASE_VARIANT_CAPS[variant] || BASE_VARIANT_CAPS['812'];
  if (!caps.mediums.includes(effectiveMedium)) {
    errors.push(`/${primaryIntent || effectiveMedium} is not available on ${variant}.`);
  }

  const requiredCommands = commands.filter((config) => config.minSection);
  for (const config of requiredCommands) {
    const requiredSection = config.minSection;
    const achievable = elevateSection(section, requiredSection, variant);
    if ((SECTION_RANK[achievable] ?? 0) < (SECTION_RANK[requiredSection] ?? 0)) {
      notices.push(`/${config.name} needs ${requiredSection} or a stronger variant.`);
      errors.push(`/${config.name} is not supported on ${variant}.`);
    }
  }

  const creditMultiplier = commands.reduce((max, config) => Math.max(max, Number(config.costMultiplier || 1)), 1);
  const policyState = { ...nextPersistent };
  const modifiers = {
    think: knownNames.includes('think'),
    research: knownNames.includes('research'),
    inspiredesign: knownNames.includes('inspiredesign'),
    diff: knownNames.includes('diff'),
    explain: knownNames.includes('explain'),
    minimal: knownNames.includes('minimal'),
    kautilyarules: knownNames.includes('kautilyarules'),
    kautilyavoice: knownNames.includes('kautilyavoice'),
  };

  const reviewMode = knownNames.includes('destroy')
    ? 'destroy'
    : knownNames.includes('secure')
      ? 'secure'
      : knownNames.includes('audit')
        ? 'audit'
        : primaryIntent === 'perf'
          ? 'performance'
          : 'none';

  const directiveSummary = [
    primaryIntent ? `intent=${primaryIntent}` : null,
    policyState.debug ? 'debug=on' : null,
    policyState.freeze ? 'freeze=on' : null,
    policyState.nofake ? 'nofake=on' : null,
    modifiers.think ? 'think=on' : null,
    modifiers.research ? 'research=preauth' : null,
    modifiers.inspiredesign ? 'inspiredesign=preauth' : null,
    modifiers.kautilyarules ? 'kautilyarules=on' : null,
    modifiers.kautilyavoice ? 'kautilyavoice=on' : null,
    reviewMode !== 'none' ? `review=${reviewMode}` : null,
  ].filter(Boolean);

  return {
    commands,
    knownNames,
    unknownNames: unknown,
    duplicateNames: uniqueNames(duplicateNames),
    errors,
    warnings,
    notices,
    toggledPersistent,
    nextPersistent,
    directives: {
      intent: primaryIntent,
      modifiers,
      policies: policyState,
      reviewMode,
      voiceMode: modifiers.kautilyavoice ? 'kautilya' : 'default',
      effectiveMedium,
      effectiveSection,
      creditMultiplier,
      temporaryCommands: knownNames.filter((name) => COMMAND_REGISTRY[name]?.type !== 'persistent'),
      persistentCommands: Object.keys(policyState).filter((name) => policyState[name]),
      parallelAgents: {
        webResearch: modifiers.research,
        designInspiration: modifiers.inspiredesign,
      },
      summary: directiveSummary.join(' | '),
    },
  };
}

export function describePersistentCommands(persistentCommands) {
  const normalized = normalizePersistentCommands(persistentCommands);
  return PERSISTENT_COMMANDS.filter((name) => normalized[name]).map((name) => COMMAND_REGISTRY[name]);
}

export function buildCommandReference() {
  const buckets = {
    Standard: [],
    Elite: [],
    Sentinel: [],
  };
  for (const config of COMMAND_LIST) {
    const key = COMMAND_TIERS[config.tier] || COMMAND_TIERS.standard;
    buckets[key].push(config);
  }
  return buckets;
}
