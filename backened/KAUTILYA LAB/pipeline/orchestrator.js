/**
 * KAUTILYA ORCHESTRATOR — The Rajarishi
 *
 * This replaces the monolithic pipeline in code-server.js.
 * It is variant-aware, section-aware, and runs the attack layer
 * concurrently (Promise.all) instead of sequentially.
 *
 * FLOW PER VARIANT:
 *
 * 812 (Simple only, tier ≤ 3):
 *   decide → [intent] → generate → constitutional → done
 *
 * 812hybrid (Think available, web search):
 *   decide → [metacog] → intent + webSearch → research → arch →
 *   generate → constitutional → done
 *
 * 812+ (Chanakya Intelligence, tier 1-5, paid models, sequential divisions):
 *   decide → metacog → intent + webSearch? → research → arch →
 *   generateBest → [amatya|kantaka|dharmashta|samstha in parallel] →
 *   arbitrate → synthesize → verify → done
 *
 * 812+hybrid (Max Mode, full concurrent tribunal):
 *   decide → metacog → intent + webSearch → research → arch →
 *   generateBest → [ALL 6 divisions in parallel] →
 *   arbitrate → synthesize → verify → done
 */

import { getVariantModel, rotateVariantModel, VARIANT_CAPS, SECTION_DEPTH, gateTier } from '../models/selector.js';
import { searchMemory, saveToMemory, summarizeIncidents, saveTribunalVerdict } from './memory.js';
import { arbitrate, assessConfidence, buildSynthesisContext } from './arbitrator.js';
import { reviewArbitration } from './king.js';
import { buildCommandDirectiveBlock } from './command-directives.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || `http://localhost:${Number(process.env.CODE_SERVER_PORT || process.env.PORT) || 3002}`;

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const CFG = {
  CALL_TIMEOUT_MS:    120_000,
  RETRY_MAX:          4,
  RETRY_BASE_MS:      2_000,
  STAGE_GAP_MS:       500,     // reduced from 800ms — we gain more from parallelism
  MAX_PAYLOAD_CHARS:  40_000,  // context ceiling per stage
  MAX_SYNTHESIS_CYCLES: 2,
};

const DecisionSchema = z.object({
  tier: z.number().min(1).max(5).default(3),
  reason: z.string().default('parse-fallback'),
  web_search: z.boolean().default(false),
  language: z.string().default('javascript'),
  framework: z.string().default(''),
  focus: z.string().default('correctness'),
  complexity: z.enum(['function', 'feature', 'system']).default('feature'),
});

function clampText(text, maxChars) {
  const clean = String(text || '');
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars) + '\n[TRUNCATED]';
}

function extractHardConstraints(text, max = 5) {
  const lines = String(text || '').split('\n');
  const picks = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isBullet = /^[-*•]\s+/.test(line) || /^\d+\./.test(line);
    const hasMust = /\b(must|never|do not|always|required)\b/i.test(line);
    if (isBullet || hasMust) {
      picks.push(line.replace(/^[-*•]\s+/, ''));
    }
    if (picks.length >= max) break;
  }
  return picks.length ? picks.slice(0, max).join('\n') : '';
}

function normalizeKnowledge(knowledge, commandDirectives) {
  const directiveBlock = buildCommandDirectiveBlock(commandDirectives, 'implementer');
  const sentinelDirectiveBlock = buildCommandDirectiveBlock(commandDirectives, 'sentinel');
  const baseFull = knowledge?.full ?? '';
  const baseDestroyer = knowledge?.destroyer ?? '';
  const full = clampText([baseFull, directiveBlock].filter(Boolean).join('\n\n'), 20_000);
  const patterns = clampText(knowledge?.patterns ?? '', 8_000);
  const destroyer = clampText([baseDestroyer, sentinelDirectiveBlock].filter(Boolean).join('\n\n'), 8_000);
  const constraints = extractHardConstraints(full, 5);
  return { ...knowledge, full, patterns, destroyer, constraints };
}

function constraintsBlock(knowledge) {
  return knowledge?.constraints ? `\nHARD_CONSTRAINTS (top 5):\n${knowledge.constraints}\n` : '';
}

const EXPERTISE_LEVELS = new Set(['junior', 'mid', 'senior', 'expert']);
const OBSERVABILITY_ENABLED = Boolean(process.env.AXIOM_TOKEN || process.env.AXIOM_API_KEY);
const SOCKET_API_KEY = process.env.SOCKET_API_KEY || '';

function normalizeExpertise(level) {
  const clean = String(level || '').toLowerCase();
  return EXPERTISE_LEVELS.has(clean) ? clean : 'mid';
}

function verbosityHint(level) {
  switch (level) {
    case 'junior':
      return 'Explain decisions briefly. Include warnings and edge cases.';
    case 'senior':
      return 'Keep explanations short. Focus on correctness and tradeoffs.';
    case 'expert':
      return 'Minimal explanation. Code first.';
    default:
      return 'Balanced explanation. Concise but clear.';
  }
}

// ─── OPENROUTER CALL ───────────────────────────────────────────────────────────

async function call(variant, role, messages, system, retries = CFG.RETRY_MAX) {
  let model = getVariantModel(variant, role);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.CALL_TIMEOUT_MS);
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': OPENROUTER_REFERER,
          'X-Title': 'Kautilya-Code',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
      });

      if (!r.ok) {
        const raw = await r.text();
        if ((r.status === 429 || r.status === 503) && attempt < retries) {
          model = rotateVariantModel(variant, role);
          await sleep(CFG.RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        throw new Error(`OpenRouter HTTP ${r.status}: ${raw.slice(0, 120)}`);
      }

      const d = await r.json();
      if (d.error) {
        if ((d.error.code === 429 || d.error.code === 503) && attempt < retries) {
          model = rotateVariantModel(variant, role);
          await sleep(3000);
          continue;
        }
        throw new Error(`[${model}] ${d.error.message}`);
      }

      const content = d.choices?.[0]?.message?.content;
      if (!content) throw new Error(`[${model}] empty response`);
      return content;

    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < retries) { model = rotateVariantModel(variant, role); continue; }
        throw new Error(`[${model}] timed out`);
      }
      if (attempt === retries) throw err;
      await sleep(CFG.RETRY_BASE_MS);
    } finally {
      clearTimeout(t);
    }
  }
}

// ─── SAFE STAGE WRAPPER ────────────────────────────────────────────────────────

async function safeStage(name, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`  Stage "${name}" failed: ${err.message}`);
    return `[Stage "${name}" failed: ${err.message}]`;
  }
}

function parseCriticalCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const match = text.match(/CRITICAL[_\s]COUNT:\s*(\d+)/i);
  return parseInt(match?.[1] ?? '0', 10);
}

const BUILTIN_MODULES = new Set([
  'fs','path','url','http','https','crypto','stream','events','os','util','zlib','net',
  'tls','child_process','buffer','assert','timers','querystring','readline','perf_hooks',
  'cluster','dgram','dns','domain','punycode','string_decoder','tty','v8','vm','worker_threads',
]);

function normalizePackageName(raw) {
  if (!raw) return null;
  if (raw.startsWith('.') || raw.startsWith('/')) return null;
  if (BUILTIN_MODULES.has(raw)) return null;
  if (raw.startsWith('@')) {
    const parts = raw.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : raw;
  }
  return raw.split('/')[0];
}

function extractDependencies(code) {
  if (!code) return [];
  const deps = new Set();
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = importRe.exec(code)) !== null) {
    const name = normalizePackageName(match[1]);
    if (name) deps.add(name);
  }
  while ((match = requireRe.exec(code)) !== null) {
    const name = normalizePackageName(match[1]);
    if (name) deps.add(name);
  }
  while ((match = dynamicImportRe.exec(code)) !== null) {
    const name = normalizePackageName(match[1]);
    if (name) deps.add(name);
  }

  return Array.from(deps);
}

function formatSocketSummary(pkg, info) {
  if (!info || typeof info !== 'object') return `${pkg}: no data`;
  const summary = {
    score: info.score ?? info.riskScore ?? info.security?.score ?? null,
    cveCount: info.cveCount ?? info.security?.cveCount ?? info.vulnerabilities?.length ?? null,
    maintenance: info.maintenance ?? info.lastPublished ?? info.metadata?.last_published ?? null,
    license: info.license ?? info.metadata?.license ?? null,
  };
  const hasSignal = Object.values(summary).some(v => v !== null && v !== undefined);
  if (!hasSignal) {
    const raw = JSON.stringify(info).slice(0, 400);
    return `${pkg}: ${raw}`;
  }
  return `${pkg}: ${JSON.stringify(summary)}`;
}

async function fetchSocketSummary(dependencies) {
  if (!SOCKET_API_KEY || !dependencies?.length) return '';
  const cache = new Map();
  const results = [];
  const deps = dependencies.slice(0, 10);

  await Promise.all(deps.map(async (pkg) => {
    if (cache.has(pkg)) return;
    try {
      const r = await fetch(`https://api.socket.dev/v0/npm/${pkg}`, {
        headers: { Authorization: `Bearer ${SOCKET_API_KEY}` },
      });
      if (!r.ok) {
        cache.set(pkg, { error: `HTTP ${r.status}` });
        return;
      }
      const data = await r.json();
      cache.set(pkg, data);
    } catch (err) {
      cache.set(pkg, { error: err?.message || 'fetch_failed' });
    }
  }));

  for (const pkg of deps) {
    results.push(formatSocketSummary(pkg, cache.get(pkg)));
  }
  return results.join('\n');
}

async function fetchNpmAuditSummary(dependencies) {
  if (!dependencies?.length) return '';
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const { stdout } = await execAsync(`${npmCmd} audit --json`, { cwd: PROJECT_ROOT, timeout: 15_000 });
    const data = JSON.parse(stdout || '{}');
    const vulns = data.vulnerabilities || {};
    const results = [];
    for (const dep of dependencies.slice(0, 10)) {
      const v = vulns[dep];
      if (!v) {
        results.push(`${dep}: clean`);
        continue;
      }
      const severity = v.severity || 'unknown';
      const count = Array.isArray(v.via) ? v.via.length : 1;
      results.push(`${dep}: ${severity} (${count} issues)`);
    }
    return results.join('\n');
  } catch {
    return '';
  }
}

function summarizeDivisionOutputs(outputs) {
  const lines = [];
  for (const [div, out] of Object.entries(outputs || {})) {
    const verdict = String(out || '').match(/VERDICT:\s*(\w+)/i)?.[1] ?? 'unknown';
    const critical = parseCriticalCount(out);
    lines.push(`${div.toUpperCase()}: ${verdict}${critical ? ` (critical ${critical})` : ''}`);
  }
  return lines.join('\n');
}

// ─── WEB SEARCH ────────────────────────────────────────────────────────────────

async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${query} code example best practice`,
        search_depth: 'basic',
        max_results: 4,
        include_answer: true,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.results
      ?.map(x => `SOURCE: ${x.url}\n${x.content?.slice(0, 300) ?? ''}`)
      .join('\n\n') ?? null;
  } catch { return null; }
}

// ─── REASONING INJECTION ──────────────────────────────────────────────────────

const REASONING_TRACE = `
MANDATORY: Before output, write inside <reasoning></reasoning> tags:
HYPOTHESES: 3 distinct approaches
FALSIFICATION: what breaks each
SURVIVOR: which survived and why
ASSUMPTIONS: what am I assuming, what breaks if wrong
UNCERTAINTY: K=certain | I=inferred | M=modeled | G=guessed — tag every claim
CONTRARIAN: strongest objection + refutation or incorporation
Then produce actual output AFTER </reasoning>.`;

// ─── PIPELINE STAGES ──────────────────────────────────────────────────────────

async function stageDecide(variant, message, knowledge) {
  const raw = await call(variant, 'G',
    [{ role: 'user', content: `Classify: "${String(message ?? '').slice(0, 500)}"` }],
    `${knowledge.patterns ?? ''}

Classify this coding request. Output ONLY raw JSON, no markdown.
Format: {"tier":2,"reason":"brief","web_search":false,"language":"typescript","framework":"react","focus":"what to nail","complexity":"function|feature|system"}
Rules: auth/security/payments → tier 4+. Multi-file → tier 4+. Current lib versions → tier 5 web_search:true.`
  );
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const validated = DecisionSchema.safeParse(parsed);
    if (validated.success) return validated.data;
    console.warn('  Decision JSON invalid — using defaults.');
  } catch {
    console.warn('  Decision JSON parse failed — using defaults.');
    return DecisionSchema.parse({});
  }
  return DecisionSchema.parse({});
}

async function stageMetacognitive(variant, message, knowledge) {
  return call(variant, 'G',
    [{ role: 'user', content: message }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are the metacognitive layer. Map uncertainty BEFORE code is written.
KNOWLEDGE_GAPS: aspects that are version-specific or uncertain
AMBIGUITY_ZONES: each ambiguity + assumption being made + what breaks if wrong
DEPENDENCY_RISKS: third-party libs, deprecated APIs, license issues
ENVIRONMENT_ASSUMPTIONS: what the code assumes about runtime
PIVOT_FACTS: top 2 facts that, if different, change the architecture
Keep it brief and actionable.`
  );
}

async function stageIntent(variant, message, memNote, decision, meta, knowledge, expertiseLevel) {
  return call(variant, 'G',
    [{ role: 'user', content: message + memNote + (meta ? `\n\nMETA:\n${meta}` : '') }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

${REASONING_TRACE}

You understand what people MEAN, not just what they SAY.
Language: ${decision.language}. Framework: ${decision.framework || 'none'}.
User expertise: ${expertiseLevel}. ${verbosityHint(expertiseLevel)}

REAL_REQUEST: one sentence — the actual need
CONTRACT: every function signature, param types, return types, throws, side effects
EDGE_CASES: null/undefined/empty/0/negative/Infinity/concurrent — expected behavior each
HIDDEN_COMPLEXITY: the non-obvious trap
SCOPE_BOUNDARY: what this does NOT do
FAILURE_PREDICTION: most likely production failure of a naive impl`
  );
}

async function stageResearch(variant, message, intent, webData, knowledge, expertiseLevel) {
  const webCtx = webData ? `\n\nWEB RESULTS:\n${webData}` : '';
  return call(variant, 'G',
    [{ role: 'user', content: `INTENT:\n${intent}\n\nREQUEST: ${message}${webCtx}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

${REASONING_TRACE}

ANALOGY: what domain solved this — steal the solution
WRONG_WAY: obvious impl most devs write + why/when it fails
EXPERT_SHORTCUT: what a 10-year vet knows that a junior does not
EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}
UNCERTAINTY_FLAGS: K/I/M/G/U tag every claim
SECURITY_SURFACE: every untrusted input entry point + attack vector
COMPLEXITY_COST: O notation obvious vs optimal — at what n does it matter`
  );
}

async function stageArchitecture(variant, message, intent, research, knowledge, expertiseLevel) {
  return call(variant, 'REA',
    [{ role: 'user', content: `INTENT:\n${intent}\n\nRESEARCH:\n${research}\n\nREQUEST: ${message}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

${REASONING_TRACE}

EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}
APPROACH_TOURNAMENT:
  Option A: [name + flaw that disqualifies it]
  Option B: [name + flaw that disqualifies it]
  Option C: WINNER — why A and B fail and C does not
INTERFACE_CONTRACT: every public function — signature, types, throws, side effects
DATA_SHAPES: every type/interface — no any, every field typed
ERROR_TAXONOMY: every named error type, when thrown, how caller handles
EXECUTION_NARRATIVE: runtime step-by-step — every branch, every error path
PRE_MORTEM: "It is 6 months from now. This failed."
  Failure 1 → Prevention in architecture:
  Failure 2 → Prevention in architecture:
SAPTANGA_AUDIT: Swami | Amatya | Janapada | Durga | Kosha | Danda | Mitra — one line each`
  );
}

async function stageMetaSkeptic(variant, message, intent, research, architecture, knowledge, expertiseLevel) {
  return call(variant, 'REA',
    [{ role: 'user', content: `INTENT:\n${intent}\n\nRESEARCH:\n${research}\n\nARCHITECTURE:\n${architecture}\n\nREQUEST: ${message}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are the Meta-Skeptic. Audit the reasoning and architecture for hidden false premises.
EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}

OUTPUT:
CRITICAL_COUNT: [number]
FINDINGS: [each: PREMISE | WHY FALSE | IMPACT]
RECOMMENDED_CORRECTION: [one paragraph]`
  );
}

async function stageGenerateBest(variant, message, intent, architecture, research, knowledge, expertiseLevel) {
  const ctx = `INTENT:\n${intent}\n\nARCHITECTURE:\n${architecture}\n\nRESEARCH:\n${research}\n\nREQUEST: ${message}`;
  const sys = `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

Write complete, production-ready code. Follow the architecture plan exactly.
All imports. All types. Every edge case handled. Zero TODOs.
Brief WHY paragraph before code. Correct usage example after.
EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}`;

  console.log('  Generating v1 + v2 in parallel...');
  const [v1, v2] = await Promise.all([
    call(variant, 'COD', [{ role: 'user', content: ctx }], sys),
    call(variant, 'COD', [{ role: 'user', content: ctx + '\n\nWrite a meaningfully different implementation — different error handling approach, different structure, same correctness.' }], sys),
  ]);

  console.log('  Judging versions...');
  return call(variant, 'REA',
    [{ role: 'user', content: `VERSION A:\n${v1}\n\nVERSION B:\n${v2}\n\nREQUEST: ${message}\n\nINTENT:\n${intent}` }],
    `${REASONING_TRACE}
Pick the implementation that SURVIVES production.
CORRECTNESS (40%) | SECURITY (25%) | COMPLETENESS (20%) | REASONING (15%)
If A is more correct but B looks cleaner — pick A.
Output: complete text of winning version only.`
  );
}

// ─── DIVISION FUNCTIONS ────────────────────────────────────────────────────────
// Each division attacks the generated code from its own angle.
// All designed to run concurrently via Promise.all.

async function divisionAmatya(variant, code, intent, architecture, knowledge) {
  return safeStage('amatya', () => call(variant, 'REA',
    [{ role: 'user', content: `ARCHITECTURE PLAN:\n${architecture}\n\nCODE:\n${code}` }],
    `${knowledge.destroyer ?? ''}
${constraintsBlock(knowledge)}

You are Amatya (architect). Check code against the plan.
BROKEN_PROMISES: promised items missing
STRUCTURAL_ISSUES: wrong structure or dependency direction
INTERFACE_VIOLATIONS: signature or contract mismatches
VERDICT: APPROVED | NEEDS_FIX | REWRITE
CRITICAL_COUNT: [blocking issues count]`
  ));
}

async function divisionKantaka(variant, code, intent, incidentSummary, knowledge) {
  const recentAttacks = incidentSummary
    ? `\n\nRECENT DURGA INCIDENTS (structured):\n${incidentSummary}` : '';
  return safeStage('kantaka', () => call(variant, 'REA',
    [{ role: 'user', content: `INTENT:\n${intent}\n\nCODE:\n${code}${recentAttacks}` }],
    `${knowledge.destroyer ?? ''}
${constraintsBlock(knowledge)}

You are Kantaka (security). Your veto is binding.
Find injection, race conditions, secrets, error leakage, missing validation.
VULNERABILITIES_FOUND: [number]
[Each: LOCATION | ATTACK_VECTOR | IMPACT | SEVERITY: critical/high/medium/low]
VERDICT: APPROVED | NEEDS_FIX | REWRITE
CRITICAL_COUNT: [critical + high count]`
  ));
}

async function divisionDharmashta(variant, code, intent, knowledge, passContext) {
  return safeStage('dharmashta', () => call(variant, 'G',
    [{ role: 'user', content: `INTENT:\n${intent}\n${passContext ? `\nPASS1_FINDINGS:\n${passContext}` : ''}\n\nCODE:\n${code}` }],
    `${knowledge.destroyer ?? ''}
${constraintsBlock(knowledge)}

You are Dharmashta (contracts). Enforce types and interfaces.
CONTRACT_VIOLATIONS: broken function contracts
TYPE_ERRORS: any/missing/wrong types
SOLID_VIOLATIONS: principle + location
MISSING_VALIDATION: unsafe input
ISSUES_FOUND: [count]
VERDICT: APPROVED | NEEDS_FIX
CRITICAL_COUNT: [contract-breaking count]`
  ));
}

async function divisionSamstha(variant, code, intent, knowledge, passContext) {
  return safeStage('samstha', () => call(variant, 'G',
    [{ role: 'user', content: `INTENT:\n${intent}\n${passContext ? `\nPASS1_FINDINGS:\n${passContext}` : ''}\n\nCODE:\n${code}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are Samstha (observability). Expose silent failures and add telemetry.
MODE: ${OBSERVABILITY_ENABLED ? 'AXIOM_OTEL' : 'GENERIC'}
SILENT_FAILURES: swallowed errors or missing logging
MISSING_LOGS: entry points and state changes not logged
ERROR_MESSAGE_QUALITY: vague error output
OBSERVABILITY_INJECTIONS: concrete code additions (OpenTelemetry spans, structured logs)
If MODE=AXIOM_OTEL include snippet that uses env AXIOM_TOKEN and AXIOM_DATASET.
ISSUES_FOUND: [count]
VERDICT: APPROVED | ANNOTATE`
  ));
}

async function divisionDiplomat(variant, code, intent, knowledge, passContext) {
  const dependencies = extractDependencies(code);
  const socketSummary = await fetchSocketSummary(dependencies);
  const auditSummary = !socketSummary ? await fetchNpmAuditSummary(dependencies) : '';
  const socketCtx = socketSummary ? `\nSOCKET_INTELLIGENCE:\n${socketSummary}` : '';
  const auditCtx = auditSummary ? `\nNPM_AUDIT:\n${auditSummary}` : '';
  return safeStage('diplomat', () => call(variant, 'G',
    [{ role: 'user', content: `INTENT:\n${intent}\n${passContext ? `\nPASS1_FINDINGS:\n${passContext}` : ''}\n${socketCtx}${auditCtx}\n\nCODE:\n${code}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are Diplomat (dependencies). Apply Shadgunya to each import.
If SOCKET_INTELLIGENCE is present, use it for CVE/maintenance risk.
If NPM_AUDIT is present, use it as fallback signal.
DEPENDENCIES_FOUND: [list with risk assessment]
RISKY_DEPS: [deps that need attention + reason]
UNNECESSARY_DEPS: [built-in alternatives exist]
VERDICT: APPROVED | WARN`
  ));
}

async function divisionSanchara(variant, code, intent, knowledge, passContext) {
  return safeStage('sanchara', () => call(variant, 'COD',
    [{ role: 'user', content: `INTENT:\n${intent}\n${passContext ? `\nPASS1_FINDINGS:\n${passContext}` : ''}\n\nCODE:\n${code}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are Sanchara (tests). Generate runnable tests.
Three tests per core path: happy, edge, failure.
Use Vitest if TS/Vite, otherwise Jest.
VERDICT: APPROVED | ANNOTATE`
  ));
}

// ─── CONCURRENT ATTACK LAYER ──────────────────────────────────────────────────
// Fires all active divisions simultaneously. This is the core latency win.
// Returns { divisionOutputs, arbitrationResult, elapsed }

async function runTribunal(variant, code, intent, architecture, knowledge) {
  const caps = VARIANT_CAPS[variant];
  const activeDivisions = caps?.divisions ?? [];

  if (activeDivisions.length === 0) {
    // Free tiers: run constitutional check instead
    return { divisionOutputs: {}, arbitrationResult: null, elapsed: 0, confidence: { confidence: 1, reliable: true, failed: [], succeeded: [] }, pass1Summary: '' };
  }

  const incidentSummary = summarizeIncidents(10);
  const start = Date.now();

  console.log(`  Tribunal: two-pass (${activeDivisions.length} divisions)...`);

  // Pass 1: Amatya + Kantaka
  const pass1Calls = {};
  if (activeDivisions.includes('amatya'))  pass1Calls.amatya  = divisionAmatya(variant, code, intent, architecture, knowledge);
  if (activeDivisions.includes('kantaka')) pass1Calls.kantaka = divisionKantaka(variant, code, intent, incidentSummary, knowledge);

  const pass1Keys = Object.keys(pass1Calls);
  const pass1Results = await Promise.allSettled(Object.values(pass1Calls));
  const pass1Outputs = {};
  pass1Results.forEach((result, i) => {
    pass1Outputs[pass1Keys[i]] = result.status === 'fulfilled'
      ? result.value
      : `[${pass1Keys[i]} failed: ${result.reason?.message ?? 'unknown'}]`;
  });

  const pass1Summary = summarizeDivisionOutputs(pass1Outputs);

  // Pass 2: remaining divisions, with pass1 summary
  const pass2Calls = {};
  if (activeDivisions.includes('dharmashta')) pass2Calls.dharmashta = divisionDharmashta(variant, code, intent, knowledge, pass1Summary);
  if (activeDivisions.includes('samstha'))    pass2Calls.samstha    = divisionSamstha(variant, code, intent, knowledge, pass1Summary);
  if (activeDivisions.includes('diplomat'))   pass2Calls.diplomat   = divisionDiplomat(variant, code, intent, knowledge, pass1Summary);
  if (activeDivisions.includes('sanchara'))   pass2Calls.sanchara   = divisionSanchara(variant, code, intent, knowledge, pass1Summary);

  const pass2Keys = Object.keys(pass2Calls);
  const pass2Results = await Promise.allSettled(Object.values(pass2Calls));
  const pass2Outputs = {};
  pass2Results.forEach((result, i) => {
    pass2Outputs[pass2Keys[i]] = result.status === 'fulfilled'
      ? result.value
      : `[${pass2Keys[i]} failed: ${result.reason?.message ?? 'unknown'}]`;
  });

  const divisionOutputs = { ...pass1Outputs, ...pass2Outputs };

  const elapsed = Date.now() - start;
  console.log(`  Tribunal complete in ${(elapsed / 1000).toFixed(1)}s`);

  // Confidence check — if too many divisions failed, escalate
  const confidence = assessConfidence(divisionOutputs);
  if (!confidence.reliable) {
    console.warn(`  ⚠ Tribunal confidence low (${Math.round(confidence.confidence * 100)}%) — failed: ${confidence.failed.join(', ')}`);
  }

  const arbitrationResult = arbitrate(divisionOutputs);
  console.log(`  Arbitration: ${arbitrationResult.finalVerdict} (binding: ${arbitrationResult.bindingDivision ?? 'none'})`);

  return { divisionOutputs, arbitrationResult, elapsed, confidence, pass1Summary };
}

// ─── CONSTITUTIONAL (for free tiers without full tribunal) ────────────────────

async function constitutional(variant, code, message, intent, knowledge) {
  const critique = await call(variant, 'REA',
    [{ role: 'user', content: `CODE:\n${code}\n\nREQUEST: ${message}\n\nINTENT:\n${intent}` }],
    `${knowledge.destroyer ?? ''}
${constraintsBlock(knowledge)}

Adversarial review. Attack:
→ null every param — crashes?
→ async fails mid-execution — inconsistent state?
→ every loop — off-by-one?
→ security: injection, oversized input, leaked internal state?
→ all imports present? all types explicit?

FLAWS_FOUND: [count]
[Each: TYPE | LOCATION | WHAT_BREAKS | SEVERITY: critical/high/medium/low]
VERDICT: CLEAN | NEEDS_FIX | REBUILD`
  );

  const verdict = critique.match(/VERDICT:\s*(CLEAN|NEEDS_FIX|REBUILD)/)?.[1];
  const flaws = parseInt(critique.match(/FLAWS_FOUND:\s*(\d+)/)?.[1] ?? '1');

  if (verdict === 'CLEAN' && flaws === 0) return code;

  return call(variant, 'COD',
    [{ role: 'user', content: `ATTACK REPORT:\n${critique}\n\nCODE:\n${code}\n\nREQUEST: ${message}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

Fix EVERY flaw in the attack report. Root causes, not symptoms.
Design paragraph + complete code + usage example.`
  );
}

async function stageDirect(variant, message, decision, knowledge, expertiseLevel) {
  return call(variant, 'COD',
    [{ role: 'user', content: message }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}
Directly generate the simplest correct solution.
Language: ${decision.language}. Framework: ${decision.framework || 'none'}.
EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}`
  );
}

// ─── SYNTHESIS (post-tribunal) ────────────────────────────────────────────────

async function stageSynthesize(variant, code, message, synthesisCtx, knowledge, expertiseLevel) {
  return call(variant, 'COD',
    [{ role: 'user', content: `${synthesisCtx}\n\nCODE TO FIX:\n${code}\n\nORIGINAL REQUEST: ${message}` }],
    `${knowledge.full ?? ''}
${constraintsBlock(knowledge)}

You are writing the FINAL VERSION. Fix EVERY issue in the fix priority list.
Root causes — not symptoms. If a fix requires a design change — make it.

YOGAKSHEMA TEST:
YOGA: Does this fully deliver the request?
KSHEMA: Does this break nothing that was working?

Output: WHY paragraph + complete code block + usage example + any known limitations.
EXPERTISE: ${expertiseLevel} — ${verbosityHint(expertiseLevel)}`
  );
}

async function stageVerify(variant, code, intent, architecture, message, knowledge) {
  return call(variant, 'REA',
    [{ role: 'user', content: `CODE:\n${code}\n\nINTENT:\n${intent}\n\nARCHITECTURE:\n${architecture ?? 'N/A'}\n\nREQUEST: ${message}` }],
    `Three verification checks only:

VERIFICATION 1 — PROMISE vs DELIVERY:
Does every function promised in the architecture exist with correct signature?
BROKEN_PROMISES: [list or None]

VERIFICATION 2 — REASONING CONSISTENCY:
Decisions in final code that contradict the architecture plan?
CONTRADICTIONS: [list with DEFECT/IMPROVEMENT label, or None]

VERIFICATION 3 — HALLUCINATION CHECK:
Any API/method/library function that may not exist?
HALLUCINATION_SUSPECTS: [list with VERIFY labels, or None]

VERIFICATION_VERDICT: APPROVED | NEEDS_PATCH | REJECT`
  );
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.variant   — '812' | '812hybrid' | '812+' | '812+hybrid'
 * @param {string} params.section   — 'Simple' | 'Think' | 'Chanakya Intelligence'
 * @param {string} params.medium    — 'ask' | 'plan' | 'build'
 * @param {string} params.message   — user's request
 * @param {string} params.expertiseLevel — 'junior' | 'mid' | 'senior' | 'expert'
 * @param {object} params.knowledge — { full, patterns, destroyer, ... }
 * @param {function} params.send    — SSE sender: (data) => void
 */
export async function orchestrate({ variant, section, medium, message, expertiseLevel, knowledge, commandDirectives, send }) {
  const sectionCfg = SECTION_DEPTH[section] ?? SECTION_DEPTH['Simple'];
  const caps = VARIANT_CAPS[variant];
  const userExpertise = normalizeExpertise(expertiseLevel);
  const k = normalizeKnowledge(knowledge, commandDirectives);
  const normalizedMedium = String(medium || 'build').toLowerCase();

  // ── Memory lookup ──────────────────────────────────────────────────────────
  const pastContext = await searchMemory(message);
  if (pastContext) send({ type: 'memory', found: true, label: 'Relevant patterns found...' });
  const memNote = pastContext ? `\n\nPAST PATTERNS:\n${pastContext}` : '';

  if (normalizedMedium === 'ask') {
    send({ type: 'stage', stage: 0, label: 'Answering directly...' });
    const answer = await call(
      variant,
      'REA',
      [{ role: 'user', content: `${message}${memNote}` }],
      `${k.full ?? ''}${constraintsBlock(k)}
Answer the request directly. Prefer explanation, diagnosis, or recommendation over code.
If code is truly necessary, keep it minimal and only where it materially helps.
EXPERTISE: ${userExpertise} — ${verbosityHint(userExpertise)}`
    );
    send({ type: 'stage_done', stage: 0 });
    return { finalCode: answer, score: 8, tier: 1, language: 'text' };
  }

  if (normalizedMedium === 'plan') {
    send({ type: 'stage', stage: 0, label: 'Planning before execution...' });
    const plan = await call(
      variant,
      'REA',
      [{ role: 'user', content: `${message}${memNote}` }],
      `${k.full ?? ''}${constraintsBlock(k)}
Produce a full implementation plan first.
No code unless a tiny signature or schema example is required for clarity.
Output phases, risks, file touch points, open questions, and recommended order of work.
EXPERTISE: ${userExpertise} — ${verbosityHint(userExpertise)}`
    );
    send({ type: 'stage_done', stage: 0 });
    return { finalCode: plan, score: 8, tier: 1, language: 'markdown' };
  }

  // ── Decision engine ────────────────────────────────────────────────────────
  send({ type: 'decision', label: 'Analyzing request...' });
  const decision = await stageDecide(variant, message, k);
  decision.tier = gateTier(variant, decision.tier);

  // In 'Simple' section — always tier ≤ 2 regardless of decision
  if (section === 'Simple' && decision.tier > 2) decision.tier = 2;

  send({ type: 'decision_done', tier: decision.tier, reason: decision.reason, language: decision.language, framework: decision.framework });
  console.log(`  [${variant}/${section}] Tier ${decision.tier} | ${decision.language} | ${decision.reason}`);

  let finalCode = '';
  let score = 7;
  let architecture = null;
  let intent = null;

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 1 — Direct answer (all variants)
  // ══════════════════════════════════════════════════════════════════════════
  if (decision.tier === 1) {
    send({ type: 'stage', stage: 1, label: 'Direct answer...' });
    finalCode = await call(variant, 'COD',
      [{ role: 'user', content: message }],
      `${k.full ?? ''}${constraintsBlock(k)}
Answer directly. Language: ${decision.language}. Code block if needed.
EXPERTISE: ${userExpertise} — ${verbosityHint(userExpertise)}`
    );
    send({ type: 'stage_done', stage: 1 });
    score = 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2 — Research + Generate + Constitutional (all variants)
  // ══════════════════════════════════════════════════════════════════════════
  else if (decision.tier === 2) {
    send({ type: 'stage', stage: 2, label: 'Researching patterns...' });
    const [research, webData] = await Promise.all([
      stageResearch(variant, message, `LANGUAGE: ${decision.language}\nFRAMEWORK: ${decision.framework || 'none'}`, null, k, userExpertise),
      (caps.webSearch && decision.web_search) ? webSearch(message) : Promise.resolve(null),
    ]);
    send({ type: 'stage_done', stage: 2 });
    if (webData) send({ type: 'web_search', found: true });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 4, label: 'Generating code...' });
    const generated = await call(variant, 'COD',
      [{ role: 'user', content: `RESEARCH:\n${research}\n${webData ? `DOCS:\n${webData}\n` : ''}REQUEST: ${message}` }],
      `${k.full ?? ''}${constraintsBlock(k)}
Complete production-ready ${decision.language} code. All imports, types, error handling.
EXPERTISE: ${userExpertise} — ${verbosityHint(userExpertise)}`
    );
    send({ type: 'stage_done', stage: 4 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 5, label: 'Self-critique...' });
    finalCode = await constitutional(variant, generated, message, `LANGUAGE: ${decision.language}`, k);
    send({ type: 'stage_done', stage: 5 });
    score = 7;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 3 — Full intent + arch + constitutional (free/hybrid variants)
  // ══════════════════════════════════════════════════════════════════════════
  else if (decision.tier === 3) {
    // Metacognitive only if Think or Chanakya Intelligence section
    let meta3 = null;
    if (sectionCfg.reasoning) {
      send({ type: 'stage', stage: 0, label: 'Metacognitive audit...' });
      meta3 = await safeStage('metacog', () => stageMetacognitive(variant, message, k));
      send({ type: 'stage_done', stage: 0 });
      await sleep(CFG.STAGE_GAP_MS);
    }

    send({ type: 'stage', stage: 1, label: 'Analyzing intent...' });
    const [intentResult, webData3] = await Promise.all([
      stageIntent(variant, message, memNote, decision, meta3, k, userExpertise),
      (caps.webSearch && decision.web_search) ? webSearch(message) : Promise.resolve(null),
    ]);
    intent = intentResult;
    send({ type: 'stage_done', stage: 1 });
    if (webData3) send({ type: 'web_search', found: true });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 2, label: 'Researching...' });
    const research3 = await stageResearch(variant, message, intent, webData3, k, userExpertise);
    send({ type: 'stage_done', stage: 2 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 3, label: 'Architecture...' });
    architecture = await stageArchitecture(variant, message, intent, research3, k, userExpertise);
    send({ type: 'stage_done', stage: 3 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 4, label: 'Generating code...' });
    const generated3 = await call(variant, 'COD',
      [{ role: 'user', content: `INTENT:\n${intent}\n\nARCHITECTURE:\n${architecture}\n\nRESEARCH:\n${research3}\n\nREQUEST: ${message}` }],
      `${k.full ?? ''}${constraintsBlock(k)}\nComplete production-grade code. Follow architecture exactly.\nEXPERTISE: ${userExpertise} — ${verbosityHint(userExpertise)}`
    );
    send({ type: 'stage_done', stage: 4 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 5, label: 'Self-critique...' });
    finalCode = await constitutional(variant, generated3, message, intent, k);
    send({ type: 'stage_done', stage: 5 });
    score = 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 4-5 — Full pipeline with tribunal (paid variants only after gating)
  // ══════════════════════════════════════════════════════════════════════════
  else {
    send({ type: 'stage', stage: 0, label: 'Metacognitive audit...' });
    const meta = await safeStage('metacog', () => stageMetacognitive(variant, message, k));
    send({ type: 'stage_done', stage: 0 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 1, label: 'Deep intent analysis...' });
    const [intentResult, webData] = await Promise.all([
      stageIntent(variant, message, memNote, decision, meta, k, userExpertise),
      (caps.webSearch || decision.tier === 5) ? webSearch(message) : Promise.resolve(null),
    ]);
    intent = intentResult;
    send({ type: 'stage_done', stage: 1 });
    if (webData) send({ type: 'web_search', found: true });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 2, label: 'Research + security surface...' });
    const research = await stageResearch(variant, message, intent, webData, k, userExpertise);
    send({ type: 'stage_done', stage: 2 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 3, label: 'Architecture planning...' });
    architecture = await stageArchitecture(variant, message, intent, research, k, userExpertise);
    send({ type: 'stage_done', stage: 3 });

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 3.5, label: 'Reasoning audit...' });
    const metaSkeptic = await safeStage('meta_skeptic', () =>
      stageMetaSkeptic(variant, message, intent, research, architecture, k, userExpertise)
    );
    send({ type: 'stage_done', stage: 3.5 });
    const metaCritical = parseCriticalCount(metaSkeptic);

    await sleep(CFG.STAGE_GAP_MS);
    send({ type: 'stage', stage: 4, label: 'Generating best of 2...' });
    const bestCode = await stageGenerateBest(variant, message, intent, architecture, research, k, userExpertise);
    send({ type: 'stage_done', stage: 4 });

    await sleep(CFG.STAGE_GAP_MS);

    let divisionOutputs = {};
    let arbitrationResult = null;
    let confidence = null;
    let degraded = false;
    let degradationReason = '';

    if (sectionCfg.tribunal && caps.divisions.length > 0) {
      send({ type: 'stage', stage: 5, label: 'Tribunal firing (two-pass)...' });
      try {
        const tribunal = await runTribunal(variant, bestCode, intent, architecture, k);
        divisionOutputs = tribunal.divisionOutputs ?? {};
        arbitrationResult = tribunal.arbitrationResult;
        confidence = tribunal.confidence;

        const override = await reviewArbitration({
          variant,
          intent,
          arbitration: arbitrationResult,
          divisionOutputs,
        });
        if (override?.overrideVerdict && override.overrideVerdict !== 'NO_OVERRIDE') {
          arbitrationResult = { ...arbitrationResult, finalVerdict: override.overrideVerdict, kingOverride: override.reason ?? '' };
          send({ type: 'king_override', verdict: override.overrideVerdict, reason: override.reason ?? '' });
        }

        if (confidence && !confidence.reliable) {
          degraded = true;
          degradationReason = `low confidence ${Math.round(confidence.confidence * 100)}%`;
        }

        send({
          type: 'stage_done', stage: 5,
          meta: {
            elapsed: tribunal.elapsed,
            verdict: arbitrationResult?.finalVerdict,
            binding: arbitrationResult?.bindingDivision,
            confidence: confidence?.confidence,
          },
        });
      } catch (err) {
        degraded = true;
        degradationReason = err?.message || 'tribunal failed';
        send({ type: 'stage_done', stage: 5, meta: { degraded: true } });
      }
    }

    if (degraded || !sectionCfg.tribunal || caps.divisions.length === 0) {
      const label = degraded ? `Degraded: constitutional fallback (${degradationReason || 'unknown'})...` : 'Constitutional self-critique...';
      send({ type: 'stage', stage: 5, label });
      let fallbackOk = true;
      try {
        finalCode = await constitutional(variant, bestCode, message, intent, k);
      } catch (err) {
        fallbackOk = false;
      }
      send({ type: 'stage_done', stage: 5 });

      if (!fallbackOk) {
        send({ type: 'stage', stage: 6, label: 'Degraded: direct generation...' });
        try {
          finalCode = await stageDirect(variant, message, decision, k, userExpertise);
          send({ type: 'stage_done', stage: 6 });
        } catch (err) {
          finalCode = `${architecture ?? ''}\n\n/* WARNING: Generation unavailable. Returned best-known architecture. */`;
          send({ type: 'stage_done', stage: 6 });
        }
      }

      await sleep(CFG.STAGE_GAP_MS);
      send({ type: 'stage', stage: 7, label: 'Reasoning verification...' });
      const verification = await safeStage('verify', () =>
        stageVerify(variant, finalCode, intent, architecture, message, k)
      );
      send({ type: 'stage_done', stage: 7 });
      const vVerdict = verification.match(/VERIFICATION_VERDICT:\s*(\w+)/)?.[1] ?? 'APPROVED';
      if (vVerdict !== 'APPROVED') {
        finalCode = finalCode + `\n\n/* KAUTILYA REASONING VERIFICATION:\n${verification}\n*/`;
      }
    } else {
      let workingCode = bestCode;
      let synthesisCtx = buildSynthesisContext(arbitrationResult, divisionOutputs);
      if (metaSkeptic && !String(metaSkeptic).startsWith('[Stage')) {
        synthesisCtx = `${synthesisCtx}\n\nMETA_SKEPTIC:\n${metaSkeptic}`;
      }

      let needsFix = arbitrationResult?.finalVerdict !== 'APPROVED' || metaCritical > 0;
      let synthesisCycles = 0;
      let verification = null;
      let verificationVerdict = 'APPROVED';

      while (true) {
        if (needsFix) {
          synthesisCycles += 1;
          send({ type: 'stage', stage: 6, label: `Synthesis cycle ${synthesisCycles}...` });
          workingCode = await stageSynthesize(variant, workingCode, message, synthesisCtx, k, userExpertise);
          send({ type: 'stage_done', stage: 6 });
        }

        await sleep(CFG.STAGE_GAP_MS);
        send({ type: 'stage', stage: 7, label: 'Reasoning verification...' });
        verification = await safeStage('verify', () =>
          stageVerify(variant, workingCode, intent, architecture, message, k)
        );
        send({ type: 'stage_done', stage: 7 });
        verificationVerdict = verification.match(/VERIFICATION_VERDICT:\s*(\w+)/)?.[1] ?? 'APPROVED';

        if (verificationVerdict === 'APPROVED') break;
        if (synthesisCycles >= CFG.MAX_SYNTHESIS_CYCLES) {
          workingCode = workingCode + `\n\n/* UNRESOLVED_ISSUES:\n${verification}\n*/`;
          break;
        }
        synthesisCtx = `${synthesisCtx}\n\nVERIFICATION_ISSUES:\n${verification}`;
        needsFix = true;
      }

      if (divisionOutputs.sanchara && !divisionOutputs.sanchara.startsWith('[Stage')) {
        if (!workingCode.includes('SANCHARA TEST SUITE')) {
          workingCode = workingCode + '\n\n// -- SANCHARA TEST SUITE --\n' + divisionOutputs.sanchara;
        }
      }

      finalCode = workingCode;

      if (arbitrationResult) {
        const verdictMap = {};
        for (const [div, out] of Object.entries(divisionOutputs)) {
          verdictMap[div] = out.match(/VERDICT:\s*(\w+)/)?.[1] ?? 'unknown';
        }
        saveTribunalVerdict(message, arbitrationResult.finalVerdict, verdictMap);
      }
    }

    const destVerdict = finalCode.match(/VERDICT:\s*(SHIP|NEEDS_FIXES|REWRITE)/)?.[1];
    score = destVerdict === 'SHIP' ? 9 : destVerdict === 'NEEDS_FIXES' ? 8 : 7;
  }
// -- Save to memory ---------------------------------------------------------
  try {
    await saveToMemory(message, finalCode, score, decision.language, decision.focus, decision.tier, {
      expertise: userExpertise,
    });
  } catch (err) {
    console.warn(`  Memory save failed: ${err?.message || 'unknown'}`);
  }

  return { finalCode, score, tier: decision.tier, language: decision.language };
}






