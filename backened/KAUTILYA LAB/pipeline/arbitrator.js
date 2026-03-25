/**
 * KAUTILYA ARBITRATOR
 *
 * When divisions disagree, the Rajarishi cannot loop forever.
 * This module enforces a hard precedence hierarchy and produces
 * a binding synthesis verdict — exactly as Chanakya gave the king
 * a casting vote when his ministers deadlocked.
 *
 * PRECEDENCE (highest wins, binding veto):
 *   1. Kantaka (security)     — any critical finding = REWRITE, no appeal
 *   2. Dharmashta (contracts) — broken interface = NEEDS_FIX, must be resolved
 *   3. Amatya (architecture)  — structural issue = NEEDS_FIX
 *   4. Samstha (observability)— logging gaps = ANNOTATE (non-blocking)
 *   5. Diplomat (deps)        — dep risk = WARN (non-blocking)
 *   6. Sanchara (tests)       — test gaps = ANNOTATE (non-blocking)
 */

// ─── SEVERITY LEVELS ──────────────────────────────────────────────────────────

const SEVERITY = {
  REWRITE:     4,
  NEEDS_FIX:   3,
  ANNOTATE:    2,
  WARN:        1,
  APPROVED:    0,
};

// ─── DIVISION PRECEDENCE ──────────────────────────────────────────────────────
// Lower index = higher precedence

const DIVISION_PRECEDENCE = [
  'kantaka',
  'dharmashta',
  'amatya',
  'samstha',
  'diplomat',
  'sanchara',
];

// ─── PARSE DIVISION VERDICT ───────────────────────────────────────────────────
// Each division's output contains a VERDICT: line. Extract it.

function parseDivisionVerdict(output) {
  if (!output || typeof output !== 'string') return { verdict: 'APPROVED', critical: 0, issues: [] };

  const verdictMatch = output.match(/VERDICT:\s*(REWRITE|NEEDS_FIX|APPROVED|CLEAN|SHIP|WARN|ANNOTATE)/i);
  const criticalMatch = output.match(/CRITICAL[_\s]COUNT:\s*(\d+)/i);
  const flawMatch = output.match(/FLAWS_FOUND:\s*(\d+)/i);

  // Normalize verdict aliases
  const rawVerdict = (verdictMatch?.[1] ?? 'APPROVED').toUpperCase();
  const verdict = {
    'CLEAN':      'APPROVED',
    'SHIP':       'APPROVED',
    'NEEDS_FIX':  'NEEDS_FIX',
    'NEEDS_FIXES':'NEEDS_FIX',
    'REWRITE':    'REWRITE',
    'WARN':       'WARN',
    'ANNOTATE':   'ANNOTATE',
  }[rawVerdict] ?? 'APPROVED';

  const critical = parseInt(criticalMatch?.[1] ?? flawMatch?.[1] ?? '0');

  // Extract issue lines (lines containing SEVERITY: critical/high)
  const issues = output
    .split('\n')
    .filter(l => /severity:\s*(critical|high)/i.test(l))
    .slice(0, 5)
    .map(l => l.trim());

  return { verdict, critical, issues };
}

// ─── ARBITRATE ────────────────────────────────────────────────────────────────
/**
 * @param {Record<string, string>} divisionOutputs — { kantaka: '...', amatya: '...', ... }
 * @returns {{
 *   finalVerdict: 'REWRITE'|'NEEDS_FIX'|'APPROVED',
 *   bindingDivision: string|null,
 *   summary: string,
 *   verdictsByDivision: Record<string, object>,
 *   fixPriority: string[],  — ordered list of what to fix first
 * }}
 */
export function arbitrate(divisionOutputs) {
  const verdictsByDivision = {};
  let highestSeverity = 0;
  let bindingDivision = null;
  let finalVerdict = 'APPROVED';

  // Parse every division's output
  for (const [div, output] of Object.entries(divisionOutputs)) {
    const parsed = parseDivisionVerdict(output);
    verdictsByDivision[div] = parsed;

    const severity = SEVERITY[parsed.verdict] ?? 0;

    // Kantaka is the only hard veto: critical security = REWRITE, no override
    if (div === 'kantaka' && parsed.verdict === 'REWRITE' && parsed.critical > 0) {
      finalVerdict = 'REWRITE';
      bindingDivision = 'kantaka';
      highestSeverity = SEVERITY.REWRITE;
      break;  // Kantaka veto is binding — stop evaluating
    }

    if (severity > highestSeverity) {
      highestSeverity = severity;
      // Only the top-precedence division at this severity level is binding
      const currentPrecedence = DIVISION_PRECEDENCE.indexOf(div);
      const existingPrecedence = bindingDivision
        ? DIVISION_PRECEDENCE.indexOf(bindingDivision)
        : Infinity;
      if (currentPrecedence < existingPrecedence) {
        bindingDivision = div;
        finalVerdict = parsed.verdict === 'WARN' || parsed.verdict === 'ANNOTATE'
          ? (highestSeverity >= SEVERITY.NEEDS_FIX ? 'NEEDS_FIX' : 'APPROVED')
          : parsed.verdict;
      }
    }
  }

  // Build fix priority: highest precedence divisions with issues first
  const fixPriority = DIVISION_PRECEDENCE
    .filter(div => {
      const v = verdictsByDivision[div];
      return v && SEVERITY[v.verdict] >= SEVERITY.NEEDS_FIX;
    })
    .map(div => {
      const v = verdictsByDivision[div];
      return `[${div.toUpperCase()}] ${v.issues.slice(0, 2).join(' | ') || v.verdict}`;
    });

  // Build human-readable summary
  const divSummaries = Object.entries(verdictsByDivision)
    .map(([div, v]) => `${div}: ${v.verdict}${v.critical > 0 ? ` (${v.critical} critical)` : ''}`)
    .join(' | ');

  const summary = `Tribunal: ${divSummaries}\nBinding: ${bindingDivision ?? 'none'} → ${finalVerdict}`;

  return {
    finalVerdict,
    bindingDivision,
    summary,
    verdictsByDivision,
    fixPriority,
  };
}

// ─── CONFIDENCE FLOOR ─────────────────────────────────────────────────────────
// If a division's output is empty/failed, we cannot trust the verdict.
// The pipeline must know if a division timed out or errored.

export function assessConfidence(divisionOutputs) {
  const failed = [];
  const succeeded = [];

  for (const [div, output] of Object.entries(divisionOutputs)) {
    if (!output || output.startsWith('[Stage') || output.length < 50) {
      failed.push(div);
    } else {
      succeeded.push(div);
    }
  }

  const confidence = succeeded.length / (succeeded.length + failed.length);

  return {
    confidence,                    // 0.0 – 1.0
    failed,
    succeeded,
    reliable: confidence >= 0.6,   // at least 60% of divisions must succeed
    // Below 60% → escalate to user, don't guess
  };
}

// ─── SYNTHESIS PROMPT BUILDER ─────────────────────────────────────────────────
// Builds the final synthesis system prompt that a REA model uses to unify
// all division outputs into a single corrected code block.

export function buildSynthesisContext(arbitrationResult, divisionOutputs) {
  const { fixPriority, summary, verdictsByDivision } = arbitrationResult;

  const divisionSection = Object.entries(divisionOutputs)
    .map(([div, output]) => {
      const v = verdictsByDivision[div];
      return `## ${div.toUpperCase()} [${v?.verdict ?? 'unknown'}]\n${output}`;
    })
    .join('\n\n');

  return `ARBITRATION RESULT:\n${summary}\n\nFIX PRIORITY:\n${fixPriority.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'None — approved'}\n\nDIVISION REPORTS:\n${divisionSection}`;
}