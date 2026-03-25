function truthyList(entries) {
  return entries.filter(Boolean);
}

export function buildCommandDirectiveBlock(directives = {}, audience = 'implementer') {
  const intent = directives.intent || 'default';
  const policies = directives.policies || {};
  const modifiers = directives.modifiers || {};
  const lines = ['[COMMAND DIRECTIVES]'];

  lines.push(`INTENT: ${intent}`);
  if (directives.reviewMode && directives.reviewMode !== 'none') {
    lines.push(`REVIEW_MODE: ${directives.reviewMode}`);
  }
  if (directives.voiceMode && directives.voiceMode !== 'default') {
    lines.push(`VOICE_MODE: ${directives.voiceMode}`);
  }
  if (directives.effectiveSection) {
    lines.push(`SECTION_POSTURE: ${directives.effectiveSection}`);
  }
  if (directives.effectiveMedium) {
    lines.push(`MEDIUM_POSTURE: ${directives.effectiveMedium}`);
  }

  const activePolicies = truthyList([
    policies.debug ? 'DEBUG_ONLY: fix what is broken; do not add new features or rewrite scope.' : '',
    policies.freeze ? 'FREEZE_SCOPE: do not touch files, modules, or concerns outside the explicit task boundary.' : '',
    policies.nofake ? 'NOFAKE: no placeholders, no fake imports, no pretend APIs, no unwired code presented as complete.' : '',
  ]);
  lines.push(...activePolicies);

  const activeModifiers = truthyList([
    modifiers.think ? 'THINK: reason more deeply before answering.' : '',
    modifiers.diff ? 'DIFF_FIRST: explain what changed before final output.' : '',
    modifiers.explain ? 'EXPLAIN: provide teaching-level reasoning and tradeoffs.' : '',
    modifiers.minimal ? 'MINIMAL: keep output lean, code-first, minimal narration.' : '',
    modifiers.research ? 'RESEARCH_PREAUTHORIZED: specialist web research is approved for this request.' : '',
    modifiers.inspiredesign ? 'DESIGN_PREAUTHORIZED: specialist design inspiration is approved for this request.' : '',
    modifiers.kautilyarules ? 'KAUTILYA_RULES: optimize for leverage, consequence-awareness, and structural discipline.' : '',
    modifiers.kautilyavoice ? 'KAUTILYA_VOICE: surface the answer in sharper strategist language.' : '',
  ]);
  lines.push(...activeModifiers);

  if (audience === 'king') {
    lines.push('KING_RULE: govern scope, agent usage, and file selection according to these directives.');
  } else if (audience === 'sentinel') {
    lines.push('SENTINEL_RULE: findings first; do not soften risk.');
  } else {
    lines.push('IMPLEMENTER_RULE: execute only within the active mandate.');
  }

  return lines.join('\n');
}

export function buildIntentPromptPrefix(directives = {}, context = {}) {
  const intent = directives.intent;
  const prefixLines = [];

  switch (intent) {
    case 'refactor':
      prefixLines.push('MODE: Refactor only. Preserve behavior. Improve structure and readability without adding features.');
      break;
    case 'types':
      prefixLines.push('MODE: Types only. Add or repair TypeScript types without changing runtime behavior.');
      break;
    case 'docs':
      prefixLines.push('MODE: Documentation only. Generate docs and inline explanation without changing logic.');
      break;
    case 'test':
      prefixLines.push('MODE: Tests only. Produce runnable tests for current code and scenarios.');
      break;
    case 'git':
      prefixLines.push('MODE: Generate a conventional commit message only. Do not emit code.');
      break;
    case 'rollback':
      prefixLines.push('MODE: The last assistant approach was rejected. Choose a clearly different strategy.');
      if (context.lastAssistantArtifact) {
        prefixLines.push(`LAST_ASSISTANT_ARTIFACT:\n${context.lastAssistantArtifact}`);
      }
      break;
    case 'contextrevise':
      prefixLines.push('MODE: Produce a project standup summary: done, pending, broken, and next.');
      break;
    case 'future':
      prefixLines.push('MODE: Map structural next steps, extension points, and likely future work.');
      break;
    case 'perf':
      prefixLines.push('MODE: Audit for performance bottlenecks, re-render waste, N+1 behavior, leaks, and ranked fixes.');
      break;
    case 'audit':
      prefixLines.push('MODE: Audit first. Findings only. Do not generate code unless the user explicitly proceeds later.');
      break;
    case 'secure':
      prefixLines.push('MODE: Security audit only. Findings first. Do not generate code unless the user explicitly proceeds later.');
      break;
    case 'analyse':
      prefixLines.push('MODE: Build an accurate mental model of the imported project before proposing changes.');
      break;
    case 'heavylift':
      prefixLines.push('MODE: HeavyLift. Plan before action, then execute in phases for multi-file work.');
      break;
    case 'solo':
      prefixLines.push('MODE: Solo. Operate autonomously within explicit scope. Be conservative about claims and sequencing.');
      break;
    default:
      break;
  }

  if (directives.reviewMode === 'destroy') {
    prefixLines.push('DESTROYER_MODE: perform adversarial analysis, findings first, no softened wording.');
  }

  return prefixLines.length ? `${prefixLines.join('\n')}\n\n` : '';
}

export function shouldForcePreviewMode(directives = {}) {
  const intent = directives.intent;
  return ['ask', 'plan', 'git', 'audit', 'secure', 'destroy', 'analyse', 'contextrevise', 'future', 'perf'].includes(intent);
}
