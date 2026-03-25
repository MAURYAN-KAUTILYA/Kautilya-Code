/**
 * KAUTILYA KING - The Rajarishi
 *
 * Layer 1 Orchestrator.
 * Decomposes tasks, assigns divisions, monitors verdicts.
 * DOES NOT CODE.
 *
 * Inputs: User Request + File Tree + Specialist Agent Outputs
 * Output: Work Brief (JSON)
 */

import { getVariantModel } from '../models/selector.js';
import { z } from 'zod';
import { buildCommandDirectiveBlock } from './command-directives.js';

const KING_PROMPT_TEMPLATE = (knowledge) => `
${knowledge?.init ? `[READ FIRST: SYSTEM INITIALIZATION DIRECTIVE]\n${knowledge.init}\n\n` : ''}
${knowledge?.king ? `[READ SECOND: THE RAJARISHI MANDATE / TEACHER'S DIRECTIVE]\n${knowledge.king}\n\n` : ''}
${knowledge?.masterDoctrine ? `[MASTER DOCTRINE]\n${knowledge.masterDoctrine}\n\n` : ''}
${knowledge?.roleDoctrine ? `[ROLE DOCTRINE]\n${knowledge.roleDoctrine}\n\n` : ''}
You are the Rajarishi. You decompose, delegate, and monitor. You never write code.

INPUTS:
- User Request
- File Tree (if provided)
- Parallel agent permissions
- Approved agent outputs (if already available)

OUTPUT:
Structured JSON only:
{
  "complexity": "simple|complex|novel",
  "filesToTouch": ["path/to/file1", "path/to/file2"],
  "workBrief": "precise task description for the Block",
  "divisionFocus": {
    "kantaka": "focus on X (security)",
    "amatya": "focus on Y (architecture)",
    "dharmashta": "focus on Z (types)",
    "samstha": "focus on W (observability)",
    "diplomat": "focus on D (dependencies)"
  },
  "monitorNote": "what to watch for during execution",
  "agentPlan": {
    "webResearch": {
      "needed": boolean,
      "query": "exact search brief if needed",
      "reason": "why this research agent helps",
      "whyNow": "why it must happen before implementation",
      "approvalRequired": boolean
    },
    "designInspiration": {
      "needed": boolean,
      "query": "exact inspiration brief if needed",
      "reason": "why this design agent helps",
      "whyNow": "why it must happen before implementation",
      "approvalRequired": boolean
    }
  }
}

RULES:
1. If output contains a code block -> invalid.
2. If filesToTouch > 8 -> invalid, narrow the scope.
3. Use webResearch only when external facts, documentation, or current web context materially help.
4. Use designInspiration only when visuals, references, or mood/style direction materially help.
5. If a permission is already enabled, approvalRequired should be false for that agent.
6. "simple" complexity means the request can be handled by a single file change or direct answer.
7. "complex" means multi-file coordination or architectural change.
8. "novel" means it requires external research or design inspiration.
`;

const KING_FINALIZE_PROMPT_TEMPLATE = (knowledge) => `
${knowledge?.init ? `[READ FIRST: SYSTEM INITIALIZATION DIRECTIVE]\n${knowledge.init}\n\n` : ''}
${knowledge?.king ? `[READ SECOND: THE RAJARISHI MANDATE / TEACHER'S DIRECTIVE]\n${knowledge.king}\n\n` : ''}
${knowledge?.masterDoctrine ? `[MASTER DOCTRINE]\n${knowledge.masterDoctrine}\n\n` : ''}
${knowledge?.roleDoctrine ? `[ROLE DOCTRINE]\n${knowledge.roleDoctrine}\n\n` : ''}
You are the Rajarishi. Finalize the implementation brief after specialist agent work is complete or denied.

INPUTS:
- User Request
- File Tree
- Initial King Plan
- Specialist Agent Outputs and statuses

OUTPUT:
Structured JSON only:
{
  "complexity": "simple|complex|novel",
  "filesToTouch": ["path/to/file1", "path/to/file2"],
  "workBrief": "precise task description for the Block",
  "divisionFocus": {
    "kantaka": "focus on X (security)",
    "amatya": "focus on Y (architecture)",
    "dharmashta": "focus on Z (types)",
    "samstha": "focus on W (observability)",
    "diplomat": "focus on D (dependencies)"
  },
  "monitorNote": "what to watch for during execution"
}

RULES:
1. Do not request more agents.
2. Incorporate approved agent findings when available.
3. If an agent was denied, compensate by narrowing scope and reducing assumptions.
4. If output contains a code block -> invalid.
5. filesToTouch must be at most 8.
`;

const KING_REVIEW_PROMPT = `
You are the King. You are reviewing tribunal arbitration output.

OUTPUT JSON ONLY:
{
  "overrideVerdict": "NO_OVERRIDE|APPROVED|NEEDS_FIX|REWRITE",
  "reason": "one concise sentence"
}

RULES:
1. If arbitration risk is accurate, return NO_OVERRIDE.
2. Override only if the tribunal is clearly too lax or too strict.
3. Never output code(IF YOU ARE EXPLAING TO AGENTS THEN CODE IS ALLOWED, BUT NOT DIRECTLY TO USER OR IN EDITOR)
`;

const DivisionFocusSchema = z.object({
  kantaka: z.string().optional(),
  amatya: z.string().optional(),
  dharmashta: z.string().optional(),
  samstha: z.string().optional(),
  diplomat: z.string().optional(),
}).default({});

const AgentDirectiveSchema = z.object({
  needed: z.boolean().default(false),
  query: z.string().default(''),
  reason: z.string().default(''),
  whyNow: z.string().default(''),
  approvalRequired: z.boolean().default(false),
});

const BaseKingSchema = z.object({
  complexity: z.enum(['simple', 'complex', 'novel']).default('complex'),
  filesToTouch: z.array(z.string()).default([]),
  workBrief: z.string().default(''),
  divisionFocus: DivisionFocusSchema,
  monitorNote: z.string().default(''),
});

const KingSchema = BaseKingSchema.extend({
  agentPlan: z.object({
    webResearch: AgentDirectiveSchema.default({}),
    designInspiration: AgentDirectiveSchema.default({}),
  }).default({}),
});

const ReviewSchema = z.object({
  overrideVerdict: z.enum(['NO_OVERRIDE', 'APPROVED', 'NEEDS_FIX', 'REWRITE']).default('NO_OVERRIDE'),
  reason: z.string().default(''),
});

async function callOpenRouter(model, messages, system) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3002',
      'X-Title': 'Kautilya-King',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      response_format: { type: 'json_object' },
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`King API Error: ${r.status} ${txt}`);
  }

  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? '';
}

function stripCodeBlocks(text) {
  return String(text || '').replace(/```[\s\S]*?```/g, '').trim();
}

function safeParseJson(raw) {
  const cleaned = stripCodeBlocks(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeAgentDirective(rawDirective, preAuthorized = false) {
  const parsed = AgentDirectiveSchema.safeParse(rawDirective || {});
  const data = parsed.success ? parsed.data : AgentDirectiveSchema.parse({});
  const needed = Boolean(data.needed);
  return {
    needed,
    query: needed ? stripCodeBlocks(data.query) : '',
    reason: needed ? stripCodeBlocks(data.reason) : '',
    whyNow: needed ? stripCodeBlocks(data.whyNow) : '',
    approvalRequired: needed && !preAuthorized,
  };
}

function sanitizeKingOutput(rawObj, fallbackMessage = '', parallelAgents = {}) {
  const parsed = KingSchema.safeParse(rawObj || {});
  const data = parsed.success ? parsed.data : KingSchema.parse({});
  const files = Array.isArray(data.filesToTouch) ? data.filesToTouch.filter(Boolean).slice(0, 8) : [];
  const agentPlan = {
    webResearch: sanitizeAgentDirective(data.agentPlan?.webResearch, parallelAgents?.webResearch),
    designInspiration: sanitizeAgentDirective(data.agentPlan?.designInspiration, parallelAgents?.designInspiration),
  };

  return {
    complexity: data.complexity,
    filesToTouch: files,
    workBrief: stripCodeBlocks(data.workBrief || fallbackMessage),
    divisionFocus: data.divisionFocus || {},
    monitorNote: stripCodeBlocks(data.monitorNote || ''),
    agentPlan,
    messengerNeeded: agentPlan.webResearch.needed || agentPlan.designInspiration.needed,
    researchBrief: agentPlan.webResearch.query || agentPlan.designInspiration.query || '',
  };
}

function sanitizeFinalizedPlan(rawObj, fallbackPlan = {}) {
  const parsed = BaseKingSchema.safeParse(rawObj || {});
  const data = parsed.success ? parsed.data : BaseKingSchema.parse(fallbackPlan || {});
  return {
    complexity: data.complexity,
    filesToTouch: Array.isArray(data.filesToTouch) ? data.filesToTouch.filter(Boolean).slice(0, 8) : [],
    workBrief: stripCodeBlocks(data.workBrief || fallbackPlan?.workBrief || ''),
    divisionFocus: data.divisionFocus || fallbackPlan?.divisionFocus || {},
    monitorNote: stripCodeBlocks(data.monitorNote || fallbackPlan?.monitorNote || ''),
  };
}

export async function consultKing({ variant, message, fileTree, messengerOutput, knowledge, parallelAgents, commandDirectives }) {
  const model = getVariantModel(variant, 'REA');
  const directiveBlock = buildCommandDirectiveBlock(commandDirectives, 'king');

  const userContent = `${directiveBlock}

REQUEST: ${message}
${fileTree ? `\nFILE TREE:\n${fileTree}` : ''}
PARALLEL AGENT PERMISSIONS:
${JSON.stringify(parallelAgents || { webResearch: false, designInspiration: false })}
${messengerOutput ? `\nAPPROVED AGENT OUTPUTS:\n${JSON.stringify(messengerOutput)}` : ''}`;

  console.log(`  King (${model}) deliberating...`);

  try {
    const raw = await callOpenRouter(model, [{ role: 'user', content: userContent }], KING_PROMPT_TEMPLATE(knowledge));
    const parsed = safeParseJson(raw);
    if (!parsed) console.warn('  King returned invalid JSON - using fallback.');
    return sanitizeKingOutput(parsed ?? {}, message, parallelAgents);
  } catch (err) {
    console.error(`  King failed: ${err.message}`);
    return sanitizeKingOutput({}, message, parallelAgents);
  }
}

export async function finalizeKingPlan({ variant, message, fileTree, initialPlan, agentOutputs, knowledge, commandDirectives }) {
  const model = getVariantModel(variant, 'REA');
  const directiveBlock = buildCommandDirectiveBlock(commandDirectives, 'king');
  const userContent = `${directiveBlock}

REQUEST: ${message}
${fileTree ? `\nFILE TREE:\n${fileTree}` : ''}
INITIAL KING PLAN:
${JSON.stringify(initialPlan || {})}

SPECIALIST AGENT OUTPUTS:
${JSON.stringify(agentOutputs || {})}`;

  try {
    const raw = await callOpenRouter(model, [{ role: 'user', content: userContent }], KING_FINALIZE_PROMPT_TEMPLATE(knowledge));
    const parsed = safeParseJson(raw);
    if (!parsed) console.warn('  King finalization returned invalid JSON - using initial plan.');
    return sanitizeFinalizedPlan(parsed ?? {}, initialPlan);
  } catch (err) {
    console.error(`  King finalization failed: ${err.message}`);
    return sanitizeFinalizedPlan({}, initialPlan);
  }
}

export async function reviewArbitration({ variant, intent, arbitration, divisionOutputs }) {
  if (!arbitration) return null;
  const model = getVariantModel(variant, 'REA');
  const payload = `INTENT:\n${intent}\n\nARBITRATION:\n${JSON.stringify(arbitration)}\n\nDIVISION_OUTPUTS:\n${JSON.stringify(divisionOutputs).slice(0, 4000)}`;
  try {
    const raw = await callOpenRouter(model, [{ role: 'user', content: payload }], KING_REVIEW_PROMPT);
    const parsed = safeParseJson(raw);
    if (!parsed) console.warn('  King review returned invalid JSON - using fallback.');
    const validated = ReviewSchema.safeParse(parsed || {});
    return validated.success ? validated.data : ReviewSchema.parse({});
  } catch {
    return ReviewSchema.parse({});
  }
}
