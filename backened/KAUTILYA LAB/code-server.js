/**
 * KAUTILYA CODE SERVER — Entry Point
 *
 * This is now a thin Express layer. All pipeline logic lives in:
 *   pipeline/orchestrator.js  — Rajarishi (routing + divisions + arbitration)
 *   pipeline/memory.js        — Janapada (semantic memory)
 *   pipeline/arbitrator.js    — Conflict resolution
 *   models/selector.js        — Variant → model/capability mapping
 *
 * Routes:
 *   POST /api/code    — main pipeline (variant + section aware)
 *   POST /api/react   — React canvas component generation
 *   POST /api/destroy — standalone Destroyer QC
 *   GET  /api/memory  — memory stats
 *   GET  /api/health  — health check with variant info
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

import { orchestrate } from './pipeline/orchestrator.js';
import { getMemoryStats, logDurgaIncident } from './pipeline/memory.js';
import { consultKing, finalizeKingPlan } from './pipeline/king.js';
import { runWebResearchAgent } from './pipeline/web-research-agent.js';
import { runDesignInspirationAgent } from './pipeline/design-inspiration-agent.js';
import {
  buildCommandDirectiveBlock,
  buildIntentPromptPrefix,
  shouldForcePreviewMode,
} from './pipeline/command-directives.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from './infra/checkpoint.js';
import { appendAudit, loadAudits } from './infra/audit.js';
import { runRuntime, runRuntimeStream, stopRuntimeCommand } from './infra/runtime.js';
import { flattenFileTree, selectRelevantFiles, buildImportGraph, expandWithDependencies } from './infra/relevance.js';
import { registerIndicaRoutes } from './infra/indica-routes.js';
import { createLspClient } from './infra/lsp-client.js';
import { createRepoIndex } from './infra/repo-index.js';
import { createToolRegistry } from './infra/tool-registry.js';
import { writeUpstashJson, deleteUpstashKey } from './infra/upstash-state.js';
import { createVerificationService } from './infra/verification.js';
import {
  getSession,
  addMessage,
  buildContextPayload,
  ensureSummary,
  estimateTokens,
  updateCredits,
  getCreditStatus,
  setSessionKey,
  getSessionKey,
  getSessionCommands,
  setSessionCommands,
  getLastAssistantArtifact,
  getSessionSketch,
  setSessionSketch,
  getSessionProfile,
  setSessionProfile,
} from './infra/session.js';
import { detectProvider, defaultModelForProvider, capabilityTierForModel, callProvider } from './infra/providers.js';
import {
  validateRequest,
  logVariantBoot,
  getVariantModel,
  rotateVariantModel,
  VARIANT_CAPS,
} from './models/selector.js';
import {
  parseLeadingSlashCommands,
  resolveCommandSet,
  DEFAULT_PERSISTENT_COMMANDS,
} from '../../src/shared/kautilya-commands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Project root is 2 levels up from this file:
// backened/KAUTILYA LAB/code-server.js -> backened -> project root
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CODE_SERVER_PORT = Number(process.env.CODE_SERVER_PORT || process.env.PORT) || 3002;
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || `http://localhost:${CODE_SERVER_PORT}`;
const MAX_FILES_TO_TOUCH = 8;
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif',
]);

function resolveWithinRoot(relPath) {
  const fullPath = path.resolve(PROJECT_ROOT, String(relPath || ''));
  const relative = path.relative(PROJECT_ROOT, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fullPath;
}

function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp_${path.basename(filePath)}_${Date.now()}`);
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function allowLocalRuntime() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_RUNTIME === 'true';
}

function resolveRuntimeCwd(candidate) {
  if (!candidate) return PROJECT_ROOT;
  const fullPath = resolveWithinRoot(candidate);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  if (fs.statSync(fullPath).isDirectory()) return fullPath;
  return path.dirname(fullPath);
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isBinaryBuffer(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  if (sample.length === 0) return false;

  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    const isControl = byte < 32 && byte !== 9 && byte !== 10 && byte !== 13;
    if (isControl || byte === 127) suspicious += 1;
  }

  return suspicious / sample.length > 0.1;
}

function summarizeFileTree(tree, maxLines = 600) {
  const flat = flattenFileTree(tree);
  const lines = [];
  for (const file of flat.slice(0, maxLines)) {
    lines.push(`${file.path} (${file.size ?? 0} bytes)`);
  }
  return lines.join('\n');
}

function isComplexRequest(message = '') {
  const msg = String(message || '').toLowerCase();
  const keywords = ['build', 'system', 'architecture', 'multi', 'refactor', 'project', 'pipeline', 'integrate', 'full', 'database', 'auth', 'api', 'file', 'module'];
  if (msg.length > 280) return true;
  return keywords.some(k => msg.includes(k));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
registerIndicaRoutes(app);

// ── STARTUP CHECKS ─────────────────────────────────────────────────────────────
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('\n  WARNING: OPENROUTER_API_KEY is not set — platform orchestration is disabled until a session BYOK key is provided.\n');
}
if (!process.env.TAVILY_API_KEY) {
  console.warn('  WARNING: TAVILY_API_KEY not set — web search disabled on hybrid variants');
}

// ── RATE LIMITER ───────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const UPSTASH_ENABLED = Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}

async function upstashIncr(key, ttlSeconds) {
  if (!UPSTASH_ENABLED) return null;
  try {
    const incrRes = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const incrData = await incrRes.json();
    const count = incrData?.result ?? null;
    if (count === 1 && ttlSeconds) {
      await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
      });
    }
    return count;
  } catch {
    return null;
  }
}

async function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowSeconds = 60;
  const limit = 20;

  if (UPSTASH_ENABLED) {
    const bucket = Math.floor(now / (windowSeconds * 1000));
    const key = `durga:rate:${ip}:${bucket}`;
    const count = await upstashIncr(key, windowSeconds);
    if (count && count > limit) {
      logDurgaIncident('rate_limit', req.body?.message, true, { ip, size: req.body?.message?.length });
      return res.status(429).json({ error: 'Too many requests. Wait a minute.' });
    }
    return next();
  }

  const entry = rateLimitMap.get(ip) ?? { count: 0, resetAt: now + windowSeconds * 1000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowSeconds * 1000; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > limit) {
    logDurgaIncident('rate_limit', req.body?.message, true, { ip, size: req.body?.message?.length });
    return res.status(429).json({ error: 'Too many requests. Wait a minute.' });
  }
  next();
}

// ── KNOWLEDGE LOADER ───────────────────────────────────────────────────────────
function loadKnowledge() {
  const readMd = (filePath) => {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
    console.warn(`  ⚠ Not found: ${path.basename(filePath)}`);
    return '';
  };

  const codeDir = path.join(__dirname, 'Knowledge', 'code');
  
  const masterInit = readMd(path.join(codeDir, '00_MASTER_SYSTEM_INITIALIZATION.md'));
  const kingDirective = readMd(path.join(codeDir, '02_System_Mandates', '02_king_directive.md'));
  const pipelineRules = readMd(path.join(codeDir, '02_System_Mandates', '01_pipeline_rules.md'));
  const masterDoctrine = readMd(path.join(codeDir, '01_Core_Philosophy', 'kautilya-master-doctrine.md'));
  const roleDoctrine = readMd(path.join(codeDir, '02_System_Mandates', '03_role_doctrine.md'));
  const voiceOverlays = readMd(path.join(codeDir, '02_System_Mandates', '04_voice_overlays.md'));
  
  const arthashastra = readMd(path.join(codeDir, '01_Core_Philosophy', 'arthashastra.md')) || readMd(path.join(codeDir, 'arthashastra.md'));
  const reasoning = readMd(path.join(codeDir, '01_Core_Philosophy', 'chanakya-reasoning.md')) || readMd(path.join(codeDir, 'chanakya-reasoning.md'));
  const destroyerBase = readMd(path.join(codeDir, '05_Adversarial_Agents', 'destroyer.md')) || readMd(path.join(codeDir, 'destroyer.md'));
  const destroyerDoctrine = readMd(path.join(codeDir, '05_Adversarial_Agents', 'destroyer-doctrine.md'));
  const patterns = readMd(path.join(codeDir, '03_Architecture_Standards', 'code-patterns.md')) || readMd(path.join(codeDir, 'code-patterns.md'));
  const codeStandards = readMd(path.join(codeDir, '03_Architecture_Standards', 'code-standards.md')) || readMd(path.join(codeDir, 'code-standards.md'));
  const frontendDesign = readMd(path.join(codeDir, '04_Frontend_UX', 'frontend-design.md')) || readMd(path.join(codeDir, 'frontend-design.md'));
  const classicLayout = readMd(path.join(codeDir, '04_Frontend_UX', 'classic-app-layout.md')) || readMd(path.join(codeDir, 'classic-app-layout.md'));

  const doctrine = [
    masterInit && `${'═'.repeat(50)}\n# SYSTEM INITIALIZATION DIRECTIVE\n${'═'.repeat(50)}\n${masterInit}`,
    pipelineRules && `${'═'.repeat(50)}\n# PIPELINE MANDATE\n${'═'.repeat(50)}\n${pipelineRules}`,
    kingDirective && `${'═'.repeat(50)}\n# RAJARISHI MANDATE\n${'═'.repeat(50)}\n${kingDirective}`,
    masterDoctrine && `${'═'.repeat(50)}\n# KAUTILYA MASTER DOCTRINE\n${'═'.repeat(50)}\n${masterDoctrine}`,
    roleDoctrine && `${'═'.repeat(50)}\n# ROLE DOCTRINE\n${'═'.repeat(50)}\n${roleDoctrine}`,
    arthashastra && `${'═'.repeat(50)}\n# DIGITAL ARTHASHASTRA\n${'═'.repeat(50)}\n${arthashastra}`,
    reasoning && `${'═'.repeat(50)}\n# CHANAKYA REASONING ENGINE\n${'═'.repeat(50)}\n${reasoning}`,
    codeStandards && `${'═'.repeat(50)}\n# CODE STANDARDS\n${'═'.repeat(50)}\n${codeStandards}`,
  ].filter(Boolean).join('\n\n');

  const full = doctrine;
  const destroyer = [
    masterDoctrine && `${'═'.repeat(50)}\n# MASTER DOCTRINE\n${'═'.repeat(50)}\n${masterDoctrine}`,
    roleDoctrine && `${'═'.repeat(50)}\n# ROLE DOCTRINE\n${'═'.repeat(50)}\n${roleDoctrine}`,
    destroyerDoctrine && `${'═'.repeat(50)}\n# DESTROYER DOCTRINE\n${'═'.repeat(50)}\n${destroyerDoctrine}`,
    destroyerBase && `${'═'.repeat(50)}\n# DESTROYER ATTACK PATTERNS\n${'═'.repeat(50)}\n${destroyerBase}`,
  ].filter(Boolean).join('\n\n');

  console.log(`  ✓ Knowledge Loaded: MasterInit=${!!masterInit} KingMandate=${!!kingDirective} Scope=${full.length}`);

  return {
    init: masterInit,
    king: kingDirective,
    pipeline: pipelineRules,
    masterDoctrine,
    roleDoctrine,
    voiceOverlays,
    reasoning,
    full,
    patterns,
    destroyer,
    frontendDesign,
    classicLayout,
  };
}

const KNOWLEDGE = loadKnowledge();

function buildWorkspaceContext(request = {}) {
  const context = request.workspaceContext || {};
  const activeFile = String(context.activeFile || request.activeFile || '').trim();
  const openTabs = Array.isArray(context.openTabs)
    ? context.openTabs.map((entry) => String(entry || '').trim()).filter(Boolean)
    : activeFile
      ? [activeFile]
      : [];
  return {
    activeFile,
    openTabs,
    selection: context.selection || null,
    diagnostics: Array.isArray(context.diagnostics) ? context.diagnostics : [],
    profile: context.profile || null,
    openFiles: Array.isArray(context.openFiles) ? context.openFiles : [],
  };
}

function buildToolPermissionGrant(overrides = {}) {
  return {
    read: true,
    write: false,
    exec: false,
    riskyExec: false,
    source: 'backend',
    ...overrides,
  };
}

function inferSessionProfile(message = '', workspaceContext = {}, previousProfile = null) {
  const normalized = String(message || '').toLowerCase();
  const activeFile = String(workspaceContext?.activeFile || '').toLowerCase();
  const openTabs = Array.isArray(workspaceContext?.openTabs) ? workspaceContext.openTabs.map((entry) => String(entry || '').toLowerCase()) : [];
  const joinedPaths = [activeFile, ...openTabs].join(' ');
  const prior = previousProfile || {};

  let domainBias = prior.domainBias || 'general';
  if (/\b(ui|ux|css|tailwind|layout|component|react|tsx|figma|frontend)\b/.test(normalized) || /\.(tsx|jsx|css|html)\b/.test(joinedPaths)) {
    domainBias = 'frontend';
  } else if (/\b(api|backend|server|express|database|auth|redis|route|schema)\b/.test(normalized) || /\b(backened|infra|server\.js|code-server\.js)\b/.test(joinedPaths)) {
    domainBias = 'backend';
  }

  let toneFormality = prior.toneFormality || 'balanced';
  if (normalized.includes('please') || normalized.includes('explain') || normalized.includes('why')) {
    toneFormality = 'supportive';
  } else if (normalized.length < 80 || /\bjust do|fix it|only code|minimal\b/.test(normalized)) {
    toneFormality = 'direct';
  }

  let explanationDepth = prior.explanationDepth || 'balanced';
  if (/\bdeep|detailed|explain|teach|why\b/.test(normalized)) {
    explanationDepth = 'detailed';
  } else if (/\bshort|minimal|concise|just code\b/.test(normalized)) {
    explanationDepth = 'minimal';
  }

  let autonomyPreference = prior.autonomyPreference || 'balanced';
  if (/\bdo it|just do|implement|fix\b/.test(normalized)) {
    autonomyPreference = 'high';
  } else if (/\bplan|discuss|brainstorm\b/.test(normalized)) {
    autonomyPreference = 'guided';
  }

  return {
    domainBias,
    toneFormality,
    explanationDepth,
    autonomyPreference,
  };
}

function buildProfileContextBlock(profile) {
  if (!profile) return '';
  return [
    'USER_PROFILE:',
    `- domain_bias: ${profile.domainBias || 'general'}`,
    `- tone_formality: ${profile.toneFormality || 'balanced'}`,
    `- explanation_depth: ${profile.explanationDepth || 'balanced'}`,
    `- autonomy_preference: ${profile.autonomyPreference || 'balanced'}`,
  ].join('\n');
}

const REPO_QUERY_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'after', 'before',
  'just', 'make', 'need', 'want', 'have', 'does', 'will', 'would', 'could', 'should',
  'more', 'less', 'like', 'work', 'working', 'backend', 'frontend', 'project',
]);

function extractRepoQueryTerms(message, limit = 5) {
  return Array.from(
    new Set(
      String(message || '')
        .toLowerCase()
        .replace(/[^\w./-]+/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length >= 3 && !REPO_QUERY_STOP_WORDS.has(term)),
    ),
  ).slice(0, limit);
}

async function suggestIndexedFiles({ message, workspaceContext = {}, profile = null, limit = 6 }) {
  const terms = extractRepoQueryTerms(message, 5);
  if (!terms.length) return [];

  const context = {
    activeFile: workspaceContext.activeFile || '',
    openTabs: workspaceContext.openTabs || [],
    profile,
  };

  let textHits = [];
  let symbolHits = [];
  try {
    [textHits, symbolHits] = await Promise.all([
      Promise.all(terms.map((term) => repoIndex.searchText(term, context, 12))),
      Promise.all(terms.map((term) => repoIndex.findSymbol(term, context, 12))),
    ]);
  } catch {
    return [];
  }

  const scoreByPath = new Map();
  for (const hit of [...textHits.flat(), ...symbolHits.flat()]) {
    if (!hit?.path) continue;
    scoreByPath.set(hit.path, (scoreByPath.get(hit.path) || 0) + Number(hit.score || 1));
  }

  return Array.from(scoreByPath.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([file]) => file);
}

// ── SSE HELPERS ────────────────────────────────────────────────────────────────
function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}
const mkSend = (res) => (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

// ── GRIND OVERRIDE DETECTOR ────────────────────────────────────────────────────
const GRIND_RE = /\b(give up|giving up|pointless|hopeless|can't do this|cant do this|not good enough|i'm done|im done|stupid|idiot|hate this|nothing works|why bother|what's the point|whats the point|i suck|too hard|impossible|never work|forget it)\b/i;

async function callOpenRouter(model, messages, system) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
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
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? '';
}

// ── MAIN CODE ROUTE ────────────────────────────────────────────────────────────
const jobs = new Map();
const taskSnapshots = new Map();

function compactTaskSnapshot(task) {
  if (!task) return null;
  const updatedAt = task.updatedAt || new Date().toISOString();
  return {
    id: task.id,
    kind: task.kind || 'job',
    status: task.status || 'idle',
    label: task.label || '',
    stage: Number.isFinite(Number(task.stage)) ? Number(task.stage) : 0,
    error: task.error || null,
    updatedAt,
  };
}

async function storeTaskSnapshot(task) {
  const snapshot = compactTaskSnapshot(task);
  if (!snapshot?.id) return snapshot;
  taskSnapshots.set(snapshot.id, snapshot);
  await writeUpstashJson(`kautilya:task:${snapshot.id}`, snapshot, 60 * 60 * 4);
  return snapshot;
}

async function removeTaskSnapshot(taskId) {
  if (!taskId) return;
  taskSnapshots.delete(taskId);
  await deleteUpstashKey(`kautilya:task:${taskId}`);
}

function getTaskSnapshot() {
  const jobDerived = Array.from(jobs.values())
    .map((job) => compactTaskSnapshot(job))
    .filter(Boolean);
  const stored = Array.from(taskSnapshots.values());
  const merged = new Map();
  for (const task of [...stored, ...jobDerived]) {
    merged.set(task.id, task);
  }
  return Array.from(merged.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

const lspClient = createLspClient({
  projectRoot: PROJECT_ROOT,
  resolveWithinRoot,
});

const repoIndex = createRepoIndex({
  projectRoot: PROJECT_ROOT,
  resolveWithinRoot,
  lspClient,
});

const verificationService = createVerificationService({
  projectRoot: PROJECT_ROOT,
});

const toolRegistry = createToolRegistry({
  projectRoot: PROJECT_ROOT,
  resolveWithinRoot,
  getFileTree,
  flattenFileTree,
  atomicWrite,
  allowLocalRuntime,
  resolveRuntimeCwd,
  isImageFile,
  isBinaryBuffer,
  getTaskSnapshot,
  lspClient,
  repoIndex,
  verificationService,
});

async function summarizeSessionIfNeeded(sessionId, variant) {
  if (!sessionId) return;
  await ensureSummary(sessionId, async (history) => {
    const model = getVariantModel(variant, 'G');
    const payload = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');
    const system = 'Summarize only the delta. Keep it concise and factual. No bullet nesting.';
    return callOpenRouter(model, [{ role: 'user', content: payload }], system);
  });
}

function normalizeParallelAgents(raw) {
  return {
    webResearch: Boolean(raw?.webResearch),
    designInspiration: Boolean(raw?.designInspiration),
  };
}

function resolveCommandRequest({
  message,
  variant,
  section,
  medium,
  sessionId,
  temporaryCommands,
}) {
  const persisted = sessionId ? getSessionCommands(sessionId) : { ...DEFAULT_PERSISTENT_COMMANDS };
  const parsed = parseLeadingSlashCommands(message);
  const commandNames = Array.isArray(temporaryCommands) && temporaryCommands.length
    ? temporaryCommands.map((name) => String(name || '').toLowerCase())
    : parsed.tokens.map((token) => token.name);
  const strippedMessage = commandNames.length ? parsed.body : message;
  const resolved = resolveCommandSet({
    commandNames,
    persistentCommands: persisted,
    variant,
    section,
    medium,
  });

  return {
    strippedMessage,
    persisted,
    resolved,
  };
}

function buildCommandAwareMessage(message, directives, context = {}) {
  const directiveBlock = buildCommandDirectiveBlock(directives, 'implementer');
  const intentPrefix = buildIntentPromptPrefix(directives, context);
  return `${directiveBlock}\n\n${intentPrefix}${message}`.trim();
}

function hasPlatformModelAccess() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function normalizeSketchNotes(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, index) => {
      const text = String(entry?.text || '').trim();
      if (!text) return null;
      return {
        id: String(entry?.id || `note_${index + 1}`),
        color: String(entry?.color || ''),
        text: text.slice(0, 2000),
        x: Number.isFinite(Number(entry?.x)) ? Number(entry.x) : undefined,
        y: Number.isFinite(Number(entry?.y)) ? Number(entry.y) : undefined,
      };
    })
    .filter(Boolean);
}

function buildSketchContextBlock(sketchContext) {
  const notes = normalizeSketchNotes(sketchContext?.notes);
  if (!notes.length) return '';
  const rendered = notes
    .map((note, index) => {
      let position = '';
      if (Number.isFinite(note.x) && Number.isFinite(note.y)) {
        position = Math.abs(note.x) <= 1 && Math.abs(note.y) <= 1
          ? ` @ (${Math.round(note.x * 100)}%, ${Math.round(note.y * 100)}%)`
          : ` @ (${Math.round(note.x)}, ${Math.round(note.y)})`;
      }
      const color = note.color ? ` [${note.color}]` : '';
      return `${index + 1}. ${note.text}${color}${position}`;
    })
    .join('\n');
  return `SKETCH_NOTES:\n${rendered}`;
}

function createAgentRequest(agentType, directive) {
  if (!directive?.needed) return null;
  return {
    agentType,
    query: String(directive.query || '').trim(),
    reason: String(directive.reason || '').trim(),
    whyNow: String(directive.whyNow || '').trim(),
    approvalRequired: Boolean(directive.approvalRequired),
  };
}

function getAgentRequests(agentPlan = {}) {
  return [
    createAgentRequest('webResearch', agentPlan.webResearch),
    createAgentRequest('designInspiration', agentPlan.designInspiration),
  ].filter(Boolean);
}

function buildAgentJobLabel(request) {
  return `Awaiting ${request.agentType} approval`;
}

function buildPausedAgentResult(request, status) {
  return {
    agentType: request.agentType,
    query: request.query,
    summary: status === 'denied'
      ? 'User denied this specialist agent request.'
      : 'Agent was requested but no result was captured.',
    sources: [],
    references: [],
    imageUrls: [],
    styleNotes: [],
    constraints: [],
    confidence: 0,
    status,
    reason: request.reason || '',
    whyNow: request.whyNow || '',
  };
}

function buildAgentOutputsForKing(agentOutputs = {}) {
  const shaped = {};
  for (const [agentType, output] of Object.entries(agentOutputs)) {
    if (!output) continue;
    shaped[agentType] = {
      status: output.status || 'completed',
      query: output.query || '',
      summary: output.summary || '',
      confidence: output.confidence ?? 0,
      constraints: output.constraints || [],
      styleNotes: output.styleNotes || [],
      references: output.references || [],
      sources: output.sources || [],
      imageUrls: output.imageUrls || [],
      reason: output.reason || '',
      whyNow: output.whyNow || '',
    };
  }
  return shaped;
}

function buildAgentContextBlock(agentOutputs = {}) {
  const blocks = [];
  for (const [agentType, output] of Object.entries(agentOutputs)) {
    if (!output) continue;
    const title = agentType === 'webResearch' ? 'WEB RESEARCH AGENT' : 'DESIGN INSPIRATION AGENT';
    const lines = [`[${title}]`, `STATUS: ${output.status || 'completed'}`];
    if (output.query) lines.push(`QUERY: ${output.query}`);
    if (output.summary) lines.push(`SUMMARY: ${output.summary}`);
    if (Array.isArray(output.constraints) && output.constraints.length) {
      lines.push(`CONSTRAINTS: ${output.constraints.join(' | ')}`);
    }
    if (Array.isArray(output.styleNotes) && output.styleNotes.length) {
      lines.push(`STYLE NOTES: ${output.styleNotes.join(' | ')}`);
    }
    const urls = [
      ...(output.references || []),
      ...(output.sources || []).map((source) => source?.url).filter(Boolean),
      ...(output.imageUrls || []),
    ].filter(Boolean).slice(0, 8);
    if (urls.length) lines.push(`URLS: ${urls.join(' | ')}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

async function runRequestedAgents(agentRequests, send) {
  if (!Array.isArray(agentRequests) || agentRequests.length === 0) return {};
  const outputs = {};
  await Promise.all(agentRequests.map(async (request) => {
    const runner = request.agentType === 'webResearch'
      ? runWebResearchAgent
      : runDesignInspirationAgent;
    outputs[request.agentType] = await runner({ task: request.query, send });
  }));
  return outputs;
}

function pauseForAgentApproval({ send, state, request }) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id: jobId,
    kind: 'agent_permission',
    status: 'awaiting_agent_permission',
    stage: 0,
    label: buildAgentJobLabel(request),
    result: null,
    error: null,
    state,
  };
  jobs.set(jobId, job);
  void storeTaskSnapshot(job);
  send({
    type: 'agent_permission_required',
    jobId,
    agentId: `pending-${request.agentType}`,
    agentType: request.agentType,
    status: 'awaiting_approval',
    reason: request.reason,
    query: request.query,
    whyNow: request.whyNow,
    message: `King requests approval to run ${request.agentType}.`,
  });
  return jobId;
}

async function continuePipelineExecution({ state, send, res }) {
  const {
    message,
    variant,
    section,
    medium,
    expertise,
    sessionId,
    filesToTouch,
    applyMode,
    activeFile,
    userModel,
    commandDirectives,
    workspaceContext,
    sessionProfile,
  } = state.request;
  const creditMultiplier = Math.max(1, Number(commandDirectives?.creditMultiplier || 1));
  const toolContext = {
    ...buildWorkspaceContext({
      activeFile,
      workspaceContext,
    }),
    profile: sessionProfile || null,
  };
  const indexedWorkspaceFiles =
    String(medium).toLowerCase() === 'build'
      ? await suggestIndexedFiles({
        message,
        workspaceContext: toolContext,
        profile: sessionProfile || null,
        limit: Math.min(6, MAX_FILES_TO_TOUCH),
      })
      : [];
  const privilegedToolContext = {
    ...toolContext,
    permissionGrant: buildToolPermissionGrant({
      write: true,
      exec: true,
      riskyExec: true,
      source: 'internal_pipeline',
    }),
  };

  let effectiveKingPlan = state.kingResult;
  const shapedAgentOutputs = buildAgentOutputsForKing(state.agentOutputs);
  if (effectiveKingPlan && Object.keys(shapedAgentOutputs).length > 0) {
    send({ type: 'stage', stage: 0.75, label: 'King is integrating specialist findings...' });
    const finalized = await finalizeKingPlan({
      variant,
      message: state.contextualMessage,
      fileTree: state.fileTreeSummary,
      initialPlan: effectiveKingPlan,
      agentOutputs: shapedAgentOutputs,
      knowledge: KNOWLEDGE,
      commandDirectives,
    });
    effectiveKingPlan = { ...effectiveKingPlan, ...finalized };
    state.kingResult = effectiveKingPlan;
    send({
      type: 'king_decision',
      phase: 'finalized',
      complexity: effectiveKingPlan.complexity,
      workBrief: effectiveKingPlan.workBrief,
      filesToTouch: effectiveKingPlan.filesToTouch,
      agentPlan: effectiveKingPlan.agentPlan,
    });
  }

  let finalMessage = state.contextualMessage;
  if (effectiveKingPlan) {
    const agentContextBlock = buildAgentContextBlock(state.agentOutputs);
    finalMessage = `WORK BRIEF FROM KING:\n${effectiveKingPlan.workBrief}\n\n` +
      (agentContextBlock ? `SPECIALIST AGENT OUTPUTS:\n${agentContextBlock}\n\n` : '') +
      `ORIGINAL REQUEST: ${message}`;
  }

  let files = [];
  if (String(medium).toLowerCase() === 'build') {
    files = Array.isArray(filesToTouch) ? filesToTouch : [];
    if (!files.length && effectiveKingPlan?.filesToTouch?.length) files = effectiveKingPlan.filesToTouch;
    if (!files.length && activeFile) files = [activeFile];
    if (!files.length && indexedWorkspaceFiles.length) files = indexedWorkspaceFiles;
    if (!files.length && state.tree && isComplexRequest(message) && ['build', 'plan'].includes(String(medium).toLowerCase())) {
      const flat = flattenFileTree(state.tree);
      const graph = buildImportGraph(PROJECT_ROOT, flat);
      const relevant = selectRelevantFiles(message, flat, Math.min(6, MAX_FILES_TO_TOUCH));
      files = expandWithDependencies(relevant, graph, MAX_FILES_TO_TOUCH);
    }
  }
  files = files.filter(Boolean).slice(0, MAX_FILES_TO_TOUCH);

  const sessionKey = sessionId ? getSessionKey(sessionId) : null;
  if (sessionKey?.key) {
    const provider = sessionKey.provider || detectProvider(sessionKey.key);
    if (provider === 'unknown') {
      send({ type: 'error', message: 'Unknown API key provider.' });
      res.end();
      return;
    }
    const model = userModel || sessionKey.model || defaultModelForProvider(provider);
    const tier = capabilityTierForModel(model);
    send({ type: 'stage', stage: 0, label: 'User key mode (single model)...' });

    let combined = '';
    if (files.length) {
      send({ type: 'files', files });
      for (const file of files) {
        const fileRead = await toolRegistry.executeTool({
          name: 'read_file',
          input: { path: file, allowMissing: true },
          context: privilegedToolContext,
        });
        const before = fileRead?.kind === 'text' ? fileRead.content || '' : '';
        send({ type: 'file_start', file });
        const payload = `FILE PATH:\n${file}\nCURRENT CONTENT:\n${before}\n\nREQUEST:\n${finalMessage}`;
        const text = await callProvider({
          provider,
          apiKey: sessionKey.key,
          model,
          messages: [{ role: 'user', content: payload }],
        });
        combined += `\n\n// FILE: ${file}\n${text}`;
        const patchSet = await toolRegistry.executeTool({
          name: 'apply_patch_preview',
          input: {
            file,
            before,
            after: text,
            approvalPolicy: 'review_required',
          },
          context: privilegedToolContext,
        });
        if (applyMode === 'write') {
          const applyResult = await toolRegistry.executeTool({
            name: 'apply_patch_apply',
            input: {
              patchId: patchSet.patchId,
              force: true,
              verify: true,
            },
            context: privilegedToolContext,
          });
          if (applyResult?.blocked) {
            send({ type: 'warning', message: `Verification blocked auto-apply for ${file}.` });
          }
        }
        send({ type: 'patch_preview', file, patchSet });
        send({ type: 'file_done', file, before, after: text, patchSet });
        appendAudit(sessionId || 'anonymous', { file, before, after: text });
      }
    } else {
      const text = await callProvider({
        provider,
        apiKey: sessionKey.key,
        model,
        messages: [{ role: 'user', content: finalMessage }],
      });
      combined = text;
      send({ type: 'token', text });
    }

    if (sessionId) {
      addMessage(sessionId, 'assistant', combined);
      const credit = updateCredits(sessionId, Math.ceil((estimateTokens(combined) + estimateTokens(message)) * creditMultiplier));
      if (credit) send({ type: 'credits', credit });
    }

    send({ type: 'done', provider, model, tier, variant, section });
    res.end();
    return;
  }

  if (files.length) {
    send({ type: 'files', files });
    const completed = [];
    let pending = [...files];
    let stopAfterThis = false;
    for (const file of files) {
      const credit = sessionId ? getCreditStatus(sessionId) : null;
      if (credit && credit.remaining <= 0) {
        if (sessionId) {
          saveCheckpoint(sessionId, {
            filesCompleted: completed,
            fileInProgress: null,
            filePending: pending,
            contextSummary: getSession(sessionId)?.summary || '',
            timestamp: new Date().toISOString(),
          });
        }
        send({ type: 'pause', reason: 'credits_exhausted', pending });
        break;
      }
      if (credit && credit.warnAt !== undefined && credit.remaining <= credit.warnAt) {
        send({ type: 'warning', reason: 'credits_low', credit });
        stopAfterThis = true;
      }

      send({ type: 'file_start', file });
      const fileRead = await toolRegistry.executeTool({
        name: 'read_file',
        input: { path: file, allowMissing: true },
        context: privilegedToolContext,
      });
      const before = fileRead?.kind === 'text' ? fileRead.content || '' : '';
      if (sessionId) {
        saveCheckpoint(sessionId, {
          filesCompleted: completed,
          fileInProgress: file,
          filePending: pending,
          contextSummary: getSession(sessionId)?.summary || '',
          timestamp: new Date().toISOString(),
        });
      }
      const payload = `FILE PATH:\n${file}\nCURRENT CONTENT:\n${before}\n\nREQUEST:\n${finalMessage}`;
      const { finalCode, score, tier, language } = await orchestrate({
        variant,
        section,
        medium,
        message: payload,
        expertiseLevel: expertise,
        knowledge: KNOWLEDGE,
        commandDirectives,
        send: (data) => send({ ...data, file }),
      });
      const patchSet = await toolRegistry.executeTool({
        name: 'apply_patch_preview',
        input: {
          file,
          before,
          after: finalCode,
          approvalPolicy: 'review_required',
        },
        context: privilegedToolContext,
      });
      if (applyMode === 'write') {
        const applyResult = await toolRegistry.executeTool({
          name: 'apply_patch_apply',
          input: {
            patchId: patchSet.patchId,
            force: true,
            verify: true,
          },
          context: privilegedToolContext,
        });
        if (applyResult?.blocked) {
          send({ type: 'warning', message: `Verification blocked auto-apply for ${file}.` });
        }
      }
      completed.push(file);
      pending = pending.filter((pendingFile) => pendingFile !== file);
      send({ type: 'patch_preview', file, patchSet });
      send({ type: 'file_done', file, before, after: finalCode, score, tier, language, patchSet });
      appendAudit(sessionId || 'anonymous', { file, before, after: finalCode, score, tier, language });
      if (sessionId) {
        updateCredits(sessionId, Math.ceil((estimateTokens(finalCode) + estimateTokens(message)) * creditMultiplier));
        const credit = getCreditStatus(sessionId);
        if (credit) send({ type: 'credits', credit });
        saveCheckpoint(sessionId, {
          filesCompleted: completed,
          fileInProgress: null,
          filePending: pending,
          contextSummary: getSession(sessionId)?.summary || '',
          timestamp: new Date().toISOString(),
        });
        if (credit && credit.warnAt !== undefined && credit.remaining <= credit.warnAt && pending.length > 0) {
          send({ type: 'warning', reason: 'credits_low', credit });
          send({ type: 'pause', reason: 'credits_low', pending });
          break;
        }
      }
      if (stopAfterThis && pending.length > 0) {
        send({ type: 'pause', reason: 'credits_low', pending });
        break;
      }
    }

    if (sessionId && pending.length === 0) clearCheckpoint(sessionId);
    send({ type: 'done', score: 8, tier: 4, language: 'mixed', variant, section });
    res.end();
    return;
  }

  const { finalCode, score, tier, language } = await orchestrate({
    variant,
    section,
    medium,
    message: finalMessage,
    expertiseLevel: expertise,
    knowledge: KNOWLEDGE,
    commandDirectives,
    send,
  });

  send({ type: 'token', text: finalCode });
  if (sessionId) {
    addMessage(sessionId, 'assistant', finalCode);
    const credit = updateCredits(sessionId, Math.ceil((estimateTokens(finalCode) + estimateTokens(message)) * creditMultiplier));
    if (credit) send({ type: 'credits', credit });
  }
  send({ type: 'done', score, tier, language, variant, section });
  res.end();
}

app.post('/api/code', rateLimit, async (req, res) => {
  const {
    message,
    variant = '812',
    section = 'Simple',
    medium = 'build',
    temporaryCommands = [],
    expertise_level = 'mid',
    expertiseLevel,
    sessionId = '',
    filesToTouch,
    applyMode = 'preview',
    activeFile,
    userModel,
    sketchContext = null,
    workspaceContext = null,
  } = req.body;

  if (!message) return res.status(400).json({ error: 'message required' });

  const commandResolution = resolveCommandRequest({
    message,
    variant,
    section,
    medium,
    sessionId,
    temporaryCommands,
  });
  if (commandResolution.resolved.errors.length > 0) {
    return res.status(400).json({
      error: commandResolution.resolved.errors[0],
      details: commandResolution.resolved.errors,
      warnings: commandResolution.resolved.warnings,
      notices: commandResolution.resolved.notices,
    });
  }

  const strippedMessage = commandResolution.strippedMessage.trim();
  if (!strippedMessage) {
    return res.status(400).json({ error: 'message required after parsing slash commands' });
  }

  const commandDirectives = commandResolution.resolved.directives;
  const effectiveSection = commandDirectives.effectiveSection || section;
  const effectiveMedium = commandDirectives.effectiveMedium || medium;
  const effectiveApplyMode = shouldForcePreviewMode(commandDirectives) ? 'preview' : applyMode;
  const sessionKey = sessionId ? getSessionKey(sessionId) : null;

  if (req.query.async === 'true') {
    const validation = validateRequest(variant, effectiveSection, effectiveMedium);
    if (!validation.valid) {
      return res.status(403).json({
        error: validation.reason,
        upgrade: validation.upgrade ?? null,
      });
    }
    if (sessionKey?.key) {
      return res.status(400).json({
        error: 'Async mode is disabled for BYOK sessions so patch review and verification stay on the main streaming path.',
      });
    }
    if (!hasPlatformModelAccess()) {
      return res.status(503).json({
        error: 'Platform orchestration is unavailable. Add OPENROUTER_API_KEY or attach a session API key.',
      });
    }

    const expertise = expertiseLevel || expertise_level || 'mid';
    if (strippedMessage.length > 8_000) {
      logDurgaIncident('payload_too_large', strippedMessage.slice(0, 50), true, { ip: getClientIp(req), size: strippedMessage.length });
      return res.status(400).json({ error: 'Message too long. Max 8000 characters.' });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = { id: jobId, kind: 'async_code', status: 'running', stage: 0, label: 'Queued...', result: null, error: null };
    jobs.set(jobId, job);
    void storeTaskSnapshot(job);
    res.json({ jobId, status: 'queued' });

    orchestrate({
      variant,
      section: effectiveSection,
      medium: effectiveMedium,
      message: buildCommandAwareMessage(strippedMessage, commandDirectives),
      expertiseLevel: expertise,
      knowledge: KNOWLEDGE,
      commandDirectives,
      send: (data) => {
        const job = jobs.get(jobId);
        if (!job) return;
        if (data.type === 'stage') job.label = data.label;
        if (data.type === 'stage_done') job.stage = data.stage;
        job.updatedAt = new Date().toISOString();
        void storeTaskSnapshot(job);
      },
    })
      .then(({ finalCode, score, tier, language }) => {
        const doneJob = { id: jobId, kind: 'async_code', status: 'done', result: finalCode, score, tier, language, stage: 8, label: 'Complete', updatedAt: new Date().toISOString() };
        jobs.set(jobId, doneJob);
        void storeTaskSnapshot(doneJob);
      })
      .catch(err => {
        const failedJob = { id: jobId, kind: 'async_code', status: 'failed', error: err.message, updatedAt: new Date().toISOString() };
        jobs.set(jobId, failedJob);
        void storeTaskSnapshot(failedJob);
      });
    return;
  }

  const validation = validateRequest(variant, effectiveSection, effectiveMedium);
  if (!validation.valid) {
    return res.status(403).json({
      error: validation.reason,
      upgrade: validation.upgrade ?? null,
    });
  }

  const expertise = expertiseLevel || expertise_level || 'mid';
  if (strippedMessage.length > 8_000) {
    logDurgaIncident('payload_too_large', strippedMessage.slice(0, 50), true, { ip: getClientIp(req), size: strippedMessage.length });
    return res.status(400).json({ error: 'Message too long. Max 8000 characters.' });
  }
  if (!sessionKey?.key && !hasPlatformModelAccess()) {
    return res.status(503).json({
      error: 'No model access available. Set OPENROUTER_API_KEY for platform mode or add a session BYOK key.',
    });
  }

  sseHeaders(res);
  const send = mkSend(res);
  for (const warning of commandResolution.resolved.warnings) {
    send({ type: 'warning', message: warning });
  }
  for (const notice of commandResolution.resolved.notices) {
    send({ type: 'warning', message: notice });
  }

  if (GRIND_RE.test(strippedMessage)) {
    logDurgaIncident('grind_override', strippedMessage.slice(0, 50), false, { ip: getClientIp(req), size: strippedMessage.length });
    console.log('  ? GRIND OVERRIDE triggered');
    send({ type: 'stage', stage: 1, label: 'Chanakya Override' });
    let grindResponse = '';
    if (sessionKey?.key) {
      const provider = sessionKey.provider || detectProvider(sessionKey.key);
      const model = userModel || sessionKey.model || defaultModelForProvider(provider);
      grindResponse = await callProvider({
        provider,
        apiKey: sessionKey.key,
        model,
        system: 'You are Chanakya. Acknowledge reality in ONE sharp sentence. Give ONE specific executable action for the next 10 minutes. End with: "You are only meant to be for grinding. Grind as much as in your prime."',
        messages: [{ role: 'user', content: strippedMessage }],
      });
    } else {
      const grindModel = getVariantModel(variant, 'G');
      grindResponse = await callOpenRouter(grindModel,
        [{ role: 'user', content: strippedMessage }],
        `You are Chanakya. Acknowledge reality in ONE sharp sentence. Give ONE specific executable action for the next 10 minutes. End with: "You are only meant to be for grinding. Grind as much as in your prime."`
      );
    }
    send({ type: 'done', tier: 0, score: '8', text: grindResponse });
    res.end();
    return;
  }

  try {
    if (sessionId && Object.keys(commandResolution.resolved.toggledPersistent).length > 0) {
      setSessionCommands(sessionId, commandResolution.resolved.nextPersistent);
      send({
        type: 'session_commands',
        persistentCommands: commandResolution.resolved.nextPersistent,
      });
    }

    if (sessionId) {
      getSession(sessionId);
      const inferredProfile = inferSessionProfile(strippedMessage, workspaceContext, getSessionProfile(sessionId));
      setSessionProfile(sessionId, inferredProfile);
      await summarizeSessionIfNeeded(sessionId, variant);
      addMessage(sessionId, 'user', strippedMessage);
    }

    let contextualMessage = strippedMessage;
    const contextPayload = sessionId ? buildContextPayload(sessionId) : { context: '' };
    if (contextPayload.context) {
      contextualMessage = `${contextPayload.context}\n\nCURRENT_REQUEST:\n${strippedMessage}`;
    }
    const sessionProfile = sessionId
      ? getSessionProfile(sessionId)
      : inferSessionProfile(strippedMessage, workspaceContext, null);
    const profileBlock = buildProfileContextBlock(sessionProfile);
    if (profileBlock) {
      contextualMessage = `${profileBlock}\n\n${contextualMessage}`;
    }
    const sketchBlock = buildSketchContextBlock(sketchContext);
    if (sketchBlock) {
      contextualMessage = `${contextualMessage}\n\n${sketchBlock}`;
      send({ type: 'warning', message: `Sketch notes attached (${normalizeSketchNotes(sketchContext?.notes).length}).` });
    }
    contextualMessage = buildCommandAwareMessage(contextualMessage, commandDirectives, {
      lastAssistantArtifact: sessionId ? getLastAssistantArtifact(sessionId) : '',
    });

    const requestedParallelAgents = normalizeParallelAgents(req.body.parallelAgents);
    const parallelAgents = {
      webResearch: requestedParallelAgents.webResearch || commandDirectives.parallelAgents?.webResearch,
      designInspiration: requestedParallelAgents.designInspiration || commandDirectives.parallelAgents?.designInspiration,
    };
    let kingResult = null;
    const useKing = ['812+', '812+hybrid'].includes(variant) && isComplexRequest(strippedMessage);
    let tree = null;
    let fileTreeSummary = null;
    if (useKing || (!Array.isArray(filesToTouch) || filesToTouch.length === 0)) {
      tree = getFileTree(PROJECT_ROOT);
      fileTreeSummary = summarizeFileTree(tree);
    }

    const state = {
      request: {
        message: strippedMessage,
        variant,
        section: effectiveSection,
        medium: effectiveMedium,
        expertise,
        sessionId,
        filesToTouch,
        applyMode: effectiveApplyMode,
        activeFile,
        userModel,
        parallelAgents,
        commandDirectives,
        sessionProfile,
        sketchContext,
        workspaceContext,
      },
      contextualMessage,
      tree,
      fileTreeSummary,
      kingResult: null,
      agentOutputs: {},
      pendingApprovals: [],
    };

    if (useKing) {
      send({ type: 'stage', stage: 0, label: 'The King is deliberating...' });
      kingResult = await consultKing({
        variant,
        message: contextualMessage,
        fileTree: fileTreeSummary,
        knowledge: KNOWLEDGE,
        parallelAgents,
        commandDirectives,
      });
      state.kingResult = kingResult;
      send({
        type: 'king_decision',
        phase: 'planning',
        complexity: kingResult.complexity,
        workBrief: kingResult.workBrief,
        filesToTouch: kingResult.filesToTouch,
        agentPlan: kingResult.agentPlan,
      });

      const agentRequests = getAgentRequests(kingResult.agentPlan);
      const preApprovedRequests = agentRequests.filter((request) => !request.approvalRequired);
      const approvalRequests = agentRequests.filter((request) => request.approvalRequired);

      if (preApprovedRequests.length > 0) {
        send({ type: 'stage', stage: 0.5, label: 'King is dispatching specialist agents...' });
        state.agentOutputs = await runRequestedAgents(preApprovedRequests, send);
      }

      state.pendingApprovals = approvalRequests;
      if (approvalRequests.length > 0) {
        pauseForAgentApproval({ send, state, request: approvalRequests[0] });
        res.end();
        return;
      }
    }

    await continuePipelineExecution({ state, send, res });

  } catch (err) {
    console.error(`Pipeline error: ${err.message}`);
    send({ type: 'error', message: err.message });
    res.end();
  }
});

app.get('/api/memory', (req, res) => {
  res.json(getMemoryStats());
});

app.get('/api/checkpoint', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const checkpoint = loadCheckpoint(sessionId);
  res.json({ checkpoint });
});

app.get('/api/audit', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const audits = loadAudits(sessionId);
  res.json(audits);
});

app.post('/api/checkpoint', (req, res) => {
  const { sessionId, checkpoint } = req.body;
  if (!sessionId || !checkpoint) return res.status(400).json({ error: 'sessionId and checkpoint required' });
  const ok = saveCheckpoint(sessionId, checkpoint);
  res.json({ success: ok });
});

app.get('/api/credits', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const credit = getCreditStatus(sessionId);
  res.json({ credit });
});

app.get('/api/session/keys', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const key = getSessionKey(sessionId);
  res.json({ key: key ? { provider: key.provider, model: key.model, tier: key.tier } : null });
});

app.get('/api/session/commands', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const commands = getSessionCommands(sessionId);
  res.json({ persistentCommands: commands });
});

app.post('/api/session/keys', (req, res) => {
  const { sessionId, apiKey, model } = req.body;
  if (!sessionId || !apiKey) return res.status(400).json({ error: 'sessionId and apiKey required' });
  const provider = detectProvider(apiKey);
  const chosenModel = model || defaultModelForProvider(provider);
  const tier = capabilityTierForModel(chosenModel);
  const stored = setSessionKey(sessionId, { key: apiKey, provider, model: chosenModel, tier });
  res.json({ provider, model: stored?.model, tier });
});

app.post('/api/session/commands', (req, res) => {
  const { sessionId, persistentCommands } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const stored = setSessionCommands(sessionId, persistentCommands);
  res.json({ persistentCommands: stored });
});

app.get('/api/session/sketch', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const sketch = getSessionSketch(sessionId);
  res.json({ sketch });
});

app.post('/api/session/sketch', (req, res) => {
  const { sessionId, sketch } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const stored = setSessionSketch(sessionId, sketch ?? null);
  res.json({ sketch: stored });
});

app.get('/api/session/profile', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  res.json({ profile: getSessionProfile(String(sessionId)) });
});

app.post('/api/session/profile', (req, res) => {
  const { sessionId, profile } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  res.json({ profile: setSessionProfile(sessionId, profile || {}) });
});

app.get('/api/tools/schema', (req, res) => {
  res.json({
    tools: toolRegistry.getToolSchema(),
  });
});

app.get('/api/index/status', async (req, res) => {
  try {
    const status = await repoIndex.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to read index status.' });
  }
});

app.post('/api/index/rebuild', async (req, res) => {
  try {
    const status = await toolRegistry.executeTool({
      name: 'rebuild_index',
      input: {},
      context: {
        permissionGrant: buildToolPermissionGrant({ read: true, source: 'index_rebuild_route' }),
      },
    });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to rebuild repo index.' });
  }
});

app.get('/api/diagnostics', async (req, res) => {
  try {
    const file = String(req.query.file || '');
    const diagnostics = await toolRegistry.executeTool({
      name: 'get_diagnostics',
      input: { file },
      context: {
        permissionGrant: buildToolPermissionGrant({ read: true, source: 'diagnostics_route' }),
      },
    });
    res.json(diagnostics);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to collect diagnostics.' });
  }
});

app.post('/api/tools/execute', async (req, res) => {
  const { name, input = {}, context = {} } = req.body || {};
  if (!name) return res.status(400).json({ error: 'tool name required' });
  const tool = toolRegistry.getToolSchema().find((entry) => entry.name === name);
  if (!tool) return res.status(404).json({ ok: false, name, error: 'Unknown tool.' });
  if (tool.permission !== 'read') {
    return res.status(403).json({
      ok: false,
      name,
      error: 'Privileged tools must use dedicated patch, verification, or runtime routes.',
    });
  }
  try {
    const result = await toolRegistry.executeTool({
      name,
      input,
      context: {
        ...context,
        permissionGrant: buildToolPermissionGrant({ read: true, source: 'tools_execute_route' }),
      },
    });
    res.json({ ok: true, name, result });
  } catch (err) {
    res.status(400).json({ ok: false, name, error: err.message || 'Tool execution failed.' });
  }
});

app.post('/api/patches/preview', async (req, res) => {
  const { file, before, after, approvalPolicy = 'review_required', context = {} } = req.body || {};
  if (!file || after === undefined) {
    return res.status(400).json({ error: 'file and after are required' });
  }
  try {
    const patchSet = await toolRegistry.executeTool({
      name: 'apply_patch_preview',
      input: { file, before, after, approvalPolicy },
      context: {
        ...context,
        permissionGrant: buildToolPermissionGrant({
          write: true,
          source: 'patch_preview_route',
        }),
      },
    });
    res.json(patchSet);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create patch preview.' });
  }
});

app.post('/api/patches/apply', async (req, res) => {
  const { patchId, patchSet, force = false, context = {} } = req.body || {};
  if (!patchId && !patchSet) {
    return res.status(400).json({ error: 'patchId or patchSet is required' });
  }
  try {
    const result = await toolRegistry.executeTool({
      name: 'apply_patch_apply',
      input: { patchId, patchSet, force, verify: true },
      context: {
        ...context,
        permissionGrant: buildToolPermissionGrant({
          write: true,
          source: 'patch_apply_route',
        }),
      },
    });
    if (result?.blocked) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to apply patch.' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { file = '', includeTests = true, includeSemgrep = true, context = {} } = req.body || {};
  try {
    const result = await toolRegistry.executeTool({
      name: 'verify_workspace',
      input: { file, includeTests, includeSemgrep },
      context: {
        ...context,
        permissionGrant: buildToolPermissionGrant({
          exec: true,
          source: 'verify_route',
        }),
      },
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Workspace verification failed.' });
  }
});

app.post('/api/runtime/exec', async (req, res) => {
  const { command, cwd, runtimeMode = 'auto', workspaceContext = null } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });

  try {
    const result = await toolRegistry.executeTool({
      name: 'run_command',
      input: { command, cwd, runtimeMode },
      context: {
        ...buildWorkspaceContext({ workspaceContext }),
        permissionGrant: buildToolPermissionGrant({
          exec: true,
          riskyExec: false,
          source: 'runtime_exec_route',
        }),
      },
    });
    void storeTaskSnapshot({
      id: result.commandId,
      kind: 'runtime',
      status: result.code === 0 ? 'done' : 'failed',
      label: command,
      stage: 1,
      error: result.error || null,
      updatedAt: new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Runtime execution failed.' });
  }
});

app.post('/api/runtime/stream', async (req, res) => {
  const { command, cwd, runtimeMode = 'auto', workspaceContext = null } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });
  let streamDescriptor;
  try {
    streamDescriptor = await toolRegistry.executeTool({
      name: 'stream_command',
      input: { command, cwd, runtimeMode },
      context: {
        ...buildWorkspaceContext({ workspaceContext }),
        permissionGrant: buildToolPermissionGrant({
          exec: true,
          riskyExec: false,
          source: 'runtime_stream_route',
        }),
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to validate runtime stream.' });
  }

  const runtimeCwd = resolveRuntimeCwd(streamDescriptor?.transport?.body?.cwd || cwd);
  if (!runtimeCwd) return res.status(403).json({ error: 'Invalid working directory' });

  sseHeaders(res);
  const send = mkSend(res);
  let activeCommandId = null;

  req.on('close', () => {
    if (activeCommandId) stopRuntimeCommand(activeCommandId);
  });

  try {
    const result = await runRuntimeStream({
      command,
      cwd: runtimeCwd,
      runtimeMode,
      allowLocal: allowLocalRuntime(),
      commandId: randomUUID(),
      onEvent: (payload) => {
        if (payload?.commandId) activeCommandId = payload.commandId;
        if (payload?.commandId) {
          const status =
            payload.type === 'start'
              ? 'running'
              : payload.type === 'done'
                ? payload.code === 0
                  ? 'done'
                  : 'failed'
                : payload.type === 'stopped'
                  ? 'stopped'
                  : payload.type === 'error'
                    ? 'failed'
                    : 'running';
          void storeTaskSnapshot({
            id: payload.commandId,
            kind: 'runtime',
            status,
            label: command,
            stage: status === 'running' ? 0.5 : 1,
            error: payload.message || payload.error || null,
            updatedAt: new Date().toISOString(),
          });
        }
        send(payload);
      },
    });

    activeCommandId = result?.commandId ?? activeCommandId;
  } catch (err) {
    send({ type: 'error', message: err.message || 'Runtime stream failed.' });
  } finally {
    res.end();
  }
});

app.post('/api/runtime/stop', (req, res) => {
  const { commandId } = req.body;
  if (!commandId) return res.status(400).json({ error: 'commandId required' });
  const result = stopRuntimeCommand(commandId);
  if (!result.stopped) return res.status(404).json({ error: 'Command not found or already finished.' });
  void storeTaskSnapshot({
    id: commandId,
    kind: 'runtime',
    status: 'stopped',
    label: 'stopped',
    stage: 1,
    updatedAt: new Date().toISOString(),
  });
  res.json({ success: true, commandId });
});

// ── HEALTH CHECK ───────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const indexStatus = await repoIndex.getStatus().catch(() => null);
  res.json({
    status: 'ok',
    variants: Object.keys(VARIANT_CAPS),
    tavilyEnabled: !!process.env.TAVILY_API_KEY,
    openRouterEnabled: hasPlatformModelAccess(),
    byokSupported: true,
    index: indexStatus,
  });
});

// ── DESTROY ROUTE (unchanged from original) ────────────────────────────────────
// Keep this as a standalone route — the frontend uses it separately
app.post('/api/destroy', rateLimit, async (req, res) => {
  const { code, language = 'javascript', context = '' } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  sseHeaders(res);
  const send = mkSend(res);

  try {
    const model = getVariantModel('812+', 'REA');

    send({ type: 'stage', label: 'Understanding intent...' });
    const understanding = await callOpenRouter(model,
      [{ role: 'user', content: `Language: ${language}\nContext: ${context || 'none'}\n\nCode:\n${code}` }],
      `Senior engineer: in 2-3 sentences, what is this code supposed to do? Then list the 3 most critical things it must get right.`
    );
    send({ type: 'understanding', text: understanding });

    const [bugAttack, securityAttack] = await Promise.all([
      callOpenRouter(model,
        [{ role: 'user', content: `WHAT IT DOES:\n${understanding}\n\nCODE:\n${code}` }],
        `${KNOWLEDGE.destroyer}\nAttack for bugs only. BUGS_FOUND: [n] [Each: LOCATION | TRIGGER | WHAT_BREAKS]`
      ),
      callOpenRouter(model,
        [{ role: 'user', content: `WHAT IT DOES:\n${understanding}\n\nCODE:\n${code}` }],
        `${KNOWLEDGE.destroyer}\nAttack for security only. VULNERABILITIES_FOUND: [n] [Each: LOCATION | VECTOR | IMPACT | SEVERITY]`
      ),
    ]);

    send({ type: 'bugs', text: bugAttack });
    send({ type: 'security', text: securityAttack });

    const [perfAttack, qualityAttack] = await Promise.all([
      callOpenRouter(getVariantModel('812', 'G'),
        [{ role: 'user', content: `CODE:\n${code}` }],
        `${KNOWLEDGE.destroyer}\nAttack for performance only. TIME_COMPLEXITY | SPACE_COMPLEXITY | ISSUES_FOUND`
      ),
      callOpenRouter(getVariantModel('812', 'G'),
        [{ role: 'user', content: `CODE:\n${code}` }],
        `${KNOWLEDGE.destroyer}\nAttack for maintainability only. ISSUES_FOUND: [n]`
      ),
    ]);

    send({ type: 'performance', text: perfAttack });
    send({ type: 'quality', text: qualityAttack });

    const verdict = await callOpenRouter(model,
      [{ role: 'user', content: `ORIGINAL:\n${code}\nBUGS:\n${bugAttack}\nSECURITY:\n${securityAttack}\nPERF:\n${perfAttack}\nQUALITY:\n${qualityAttack}` }],
      `VERDICT: SHIP | NEEDS_FIXES | REWRITE\nCONFIDENCE: [1-10]\nCRITICAL_COUNT: [n]\nTOP_FIX: [one sentence]\nSUMMARY: [2-3 sentences]`
    );

    send({ type: 'verdict', text: verdict });
    send({ type: 'done' });
    res.end();

  } catch (err) {
    console.error(`Destroyer error: ${err.message}`);
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// ── REACT CANVAS ROUTE ─────────────────────────────────────────────────────────
app.post('/api/react', rateLimit, async (req, res) => {
  const { message, currentCode, variant = '812hybrid' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  sseHeaders(res);
  const send = mkSend(res);

  try {
    send({ type: 'decision', label: 'Planning component...' });

    const isClassicApp = /\b(dashboard|admin|panel|tool|system|app|crud|table|list|data|settings|management|tracker|monitor|analytics|portal)\b/i.test(message);
    const designPrefix = isClassicApp
      ? `${'═'.repeat(50)}\n# CLASSIC APP LAYOUT\n${'═'.repeat(50)}\n${KNOWLEDGE.classicLayout}\n\n`
      : `${'═'.repeat(50)}\n# FRONTEND DESIGN\n${'═'.repeat(50)}\n${KNOWLEDGE.frontendDesign}\n\n`;

    const gModel = getVariantModel(variant, 'G');
    const intent = await callOpenRouter(gModel,
      [{ role: 'user', content: `Build: "${message}"\n${currentCode ? `Current:\n${currentCode}` : ''}` }],
      designPrefix + 'Analyze requirements. Commit to aesthetic direction. List state, props, interactions, edge states.'
    );
    send({ type: 'stage_done', stage: 1 });

    const REACT_SYS = `${designPrefix}React developer for live browser preview.
Globals available (DO NOT import): React + all hooks, Tailwind, window.lucideReact
OUTPUT: jsx code block only. Root named App. No imports. No exports. Dark theme bg-[#07080e].`;

    send({ type: 'stage', stage: 2, label: 'Generating x2 in parallel...' });
    const codModel = getVariantModel(variant, 'COD');
    const [v1, v2] = await Promise.all([
      callOpenRouter(codModel, [{ role: 'user', content: `INTENT:\n${intent}\nBUILD: ${message}` }], REACT_SYS),
      callOpenRouter(codModel, [{ role: 'user', content: `INTENT:\n${intent}\nBUILD: ${message}\nFocus on visual polish.` }], REACT_SYS),
    ]);
    const reaModel = getVariantModel(variant, 'REA');
    const bestCode = await callOpenRouter(reaModel,
      [{ role: 'user', content: `A:\n${v1}\n\nB:\n${v2}\n\nREQUEST: ${message}` }],
      'Pick better React component — more complete, polished, correct. Output ONLY the chosen version.'
    );
    send({ type: 'stage_done', stage: 2 });

    send({ type: 'stage', stage: 3, label: 'Self-critique...' });
    const critique = await callOpenRouter(reaModel,
      [{ role: 'user', content: `COMPONENT:\n${bestCode}\nREQUEST: ${message}` }],
      'Find flaws: import/export statements (must be none), root not App, broken interactions, Lucide not using window.lucideReact.'
    );
    const fixed = await callOpenRouter(codModel,
      [{ role: 'user', content: `ORIGINAL:\n${bestCode}\nFLAWS:\n${critique}\nFix everything.` }],
      REACT_SYS
    );
    send({ type: 'stage_done', stage: 3 });

    const match = fixed.match(/```(?:jsx?|tsx?)\n([\s\S]*?)```/);
    let clean = (match ? match[1] : fixed).trim()
      .replace(/^import\s+.*?;?\s*$/gm, '')
      .replace(/^export\s+default\s+/gm, '')
      .replace(/^export\s+/gm, '')
      .trim();

    send({ type: 'token', text: clean });
    send({ type: 'done', score: 8, tier: 4 });
    res.end();

  } catch (err) {
    console.error(`React canvas error: ${err.message}`);
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// ── ASYNC JOB STATUS ──────────────────────────────────────────────────────────
app.get('/api/code/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/code/jobs/:id/agent-decision', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.kind !== 'agent_permission' || job.status !== 'awaiting_agent_permission') {
    return res.status(404).json({ error: 'Paused agent approval job not found.' });
  }

  const { decision } = req.body || {};
  if (decision !== 'allow' && decision !== 'deny') {
    return res.status(400).json({ error: 'decision must be allow or deny' });
  }

  const state = job.state;
  const [currentRequest, ...remaining] = state.pendingApprovals || [];
  if (!currentRequest) {
    return res.status(400).json({ error: 'No pending agent approval found for this job.' });
  }

  sseHeaders(res);
  const send = mkSend(res);

  try {
    if (decision === 'allow') {
      send({
        type: 'agent_status',
        agentId: `pending-${currentRequest.agentType}`,
        agentType: currentRequest.agentType,
        status: 'allowed',
        stage: 'approval',
        message: `User approved ${currentRequest.agentType}.`,
        query: currentRequest.query,
      });
      const result = await runRequestedAgents([currentRequest], send);
      state.agentOutputs = { ...state.agentOutputs, ...result };
    } else {
      state.agentOutputs = {
        ...state.agentOutputs,
        [currentRequest.agentType]: buildPausedAgentResult(currentRequest, 'denied'),
      };
      send({
        type: 'agent_status',
        agentId: `pending-${currentRequest.agentType}`,
        agentType: currentRequest.agentType,
        status: 'denied',
        stage: 'approval',
        message: `User denied ${currentRequest.agentType}.`,
        query: currentRequest.query,
      });
    }

    state.pendingApprovals = remaining;

    if (remaining.length > 0) {
      job.state = state;
      job.label = buildAgentJobLabel(remaining[0]);
      send({
        type: 'agent_permission_required',
        jobId: job.id,
        agentId: `pending-${remaining[0].agentType}`,
        agentType: remaining[0].agentType,
        status: 'awaiting_approval',
        reason: remaining[0].reason,
        query: remaining[0].query,
        whyNow: remaining[0].whyNow,
        message: `King requests approval to run ${remaining[0].agentType}.`,
      });
      res.end();
      return;
    }

    jobs.delete(job.id);
    void removeTaskSnapshot(job.id);
    await continuePipelineExecution({ state, send, res });
  } catch (err) {
    console.error(`Agent approval resume error: ${err.message}`);
    send({ type: 'error', message: err.message || 'Failed to resume pipeline.' });
    res.end();
  }
});

// ── FILE SYSTEM API (Phase 4) ──────────────────────────────────────────────────
// Allows the frontend to read/write the user's project files.
// CAUTION: Local execution environment.

function getFileTree(dir) {
  const results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === '.DS_Store') return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');

    if (stat && stat.isDirectory()) {
      results.push({
        id: relativePath,
        name: file,
        type: 'folder',
        children: getFileTree(filePath)
      });
    } else {
      results.push({
        id: relativePath,
        name: file,
        type: 'file',
        size: stat.size
      });
    }
  });
  return results;
}

app.get('/api/fs/tree', (req, res) => {
  try {
    res.json(getFileTree(PROJECT_ROOT));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fs/file', async (req, res) => {
  const { path: relPath } = req.query;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  try {
    const result = await toolRegistry.executeTool({
      name: 'read_file',
      input: { path: String(relPath) },
    });
    if (result.kind === 'text') return res.json({ kind: 'text', content: result.content });
    if (result.kind === 'image') return res.json({ kind: 'image', url: result.url });
    return res.json({
      kind: 'binary',
      content: '',
      message: result.message || 'Binary files cannot be edited in the code editor.',
    });
  } catch (err) {
    const status = err.message === 'File not found' ? 404 : err.message === 'Access denied' ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/fs/raw', (req, res) => {
  const { path: relPath } = req.query;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  try {
    const fullPath = resolveWithinRoot(relPath);
    if (!fullPath) return res.status(403).json({ error: 'Access denied' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
    if (fs.statSync(fullPath).isDirectory()) {
      return res.status(400).json({ error: 'Cannot preview a folder' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/file', (req, res) => {
  const { path: relPath, content } = req.body;
  if (!relPath || content === undefined) return res.status(400).json({ error: 'path and content required' });

  try {
    const fullPath = resolveWithinRoot(relPath);
    if (!fullPath) return res.status(403).json({ error: 'Access denied' });

    atomicWrite(fullPath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/new', (req, res) => {
  const { path: relPath, type = 'file', content = '' } = req.body;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  const fullPath = resolveWithinRoot(relPath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });
  try {
    if (type === 'folder') {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      atomicWrite(fullPath, content);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/rename', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const fromPath = resolveWithinRoot(from);
  const toPath = resolveWithinRoot(to);
  if (!fromPath || !toPath) return res.status(403).json({ error: 'Access denied' });
  try {
    const dir = path.dirname(toPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(fromPath, toPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/move', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const fromPath = resolveWithinRoot(from);
  const toPath = resolveWithinRoot(to);
  if (!fromPath || !toPath) return res.status(403).json({ error: 'Access denied' });
  try {
    if (!fs.existsSync(fromPath)) return res.status(404).json({ error: 'Source not found' });
    const normalizedFrom = path.normalize(fromPath);
    const normalizedTo = path.normalize(toPath);
    if (normalizedFrom === normalizedTo) return res.json({ success: true });
    if (normalizedTo.startsWith(`${normalizedFrom}${path.sep}`)) {
      return res.status(400).json({ error: 'Cannot move a folder into its own descendant' });
    }
    const dir = path.dirname(toPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(fromPath, toPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/delete', (req, res) => {
  const { path: relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  const fullPath = resolveWithinRoot(relPath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });
  try {
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fs/search', async (req, res) => {
  const query = String(req.query.query || '').toLowerCase().trim();
  if (!query) return res.json({ results: [] });
  try {
    const result = await toolRegistry.executeTool({
      name: 'search_text',
      input: { query, limit: 200 },
    });
    res.json({
      results: (result.results || []).map((entry) => entry.path),
      matches: result.results || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TERMINAL EXECUTION (Phase 5 - Local Fallback) ──────────────────────────────
app.post('/api/term/exec', async (req, res) => {
  const { command, cwd, runtimeMode = 'auto', workspaceContext = null } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });
  try {
    const result = await toolRegistry.executeTool({
      name: 'run_command',
      input: { command, cwd, runtimeMode },
      context: {
        ...buildWorkspaceContext({ workspaceContext }),
        permissionGrant: buildToolPermissionGrant({
          exec: true,
          riskyExec: false,
          source: 'term_exec_route',
        }),
      },
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Terminal execution failed.' });
  }
});

// ── BOOT ───────────────────────────────────────────────────────────────────────
app.listen(CODE_SERVER_PORT, () => {
  console.log('\n  ⚔  KAUTILYA CODE SERVER v2');
  console.log('  Variant-aware | Concurrent tribunal | Semantic memory | Arbitration\n');
  logVariantBoot();
  console.log(`\n  http://localhost:${CODE_SERVER_PORT}\n`);
});
