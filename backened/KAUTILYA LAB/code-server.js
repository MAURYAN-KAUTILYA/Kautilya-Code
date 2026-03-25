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
  const fullPath = path.resolve(PROJECT_ROOT, relPath);
  if (!fullPath.startsWith(PROJECT_ROOT)) return null;
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

// ── STARTUP CHECKS ─────────────────────────────────────────────────────────────
if (!process.env.OPENROUTER_API_KEY) {
  console.error('\n  FATAL: OPENROUTER_API_KEY is not set\n');
  process.exit(1);
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
      'HTTP-Referer': 'http://localhost:3002',
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
  jobs.set(jobId, {
    id: jobId,
    kind: 'agent_permission',
    status: 'awaiting_agent_permission',
    stage: 0,
    label: buildAgentJobLabel(request),
    result: null,
    error: null,
    state,
  });
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
  } = state.request;
  const creditMultiplier = Math.max(1, Number(commandDirectives?.creditMultiplier || 1));

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
        const fullPath = resolveWithinRoot(file);
        const before = fullPath && fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
        send({ type: 'file_start', file });
        const payload = `FILE PATH:\n${file}\nCURRENT CONTENT:\n${before}\n\nREQUEST:\n${finalMessage}`;
        const text = await callProvider({
          provider,
          apiKey: sessionKey.key,
          model,
          messages: [{ role: 'user', content: payload }],
        });
        combined += `\n\n// FILE: ${file}\n${text}`;
        send({ type: 'file_done', file, before, after: text });
        appendAudit(sessionId || 'anonymous', { file, before, after: text });
        if (applyMode === 'write' && fullPath) atomicWrite(fullPath, text);
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
      const fullPath = resolveWithinRoot(file);
      const before = fullPath && fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
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
      if (applyMode === 'write' && fullPath) atomicWrite(fullPath, finalCode);
      completed.push(file);
      pending = pending.filter((pendingFile) => pendingFile !== file);
      send({ type: 'file_done', file, before, after: finalCode, score, tier, language });
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

  if (req.query.async === 'true') {
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

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    jobs.set(jobId, { status: 'running', stage: 0, label: 'Queued...', result: null, error: null });
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
      },
    })
      .then(({ finalCode, score, tier, language }) => {
        jobs.set(jobId, { status: 'done', result: finalCode, score, tier, language, stage: 8, label: 'Complete' });
      })
      .catch(err => {
        jobs.set(jobId, { status: 'failed', error: err.message });
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
    const grindModel = getVariantModel(variant, 'G');
    const grindResponse = await callOpenRouter(grindModel,
      [{ role: 'user', content: strippedMessage }],
      `You are Chanakya. Acknowledge reality in ONE sharp sentence. Give ONE specific executable action for the next 10 minutes. End with: "You are only meant to be for grinding. Grind as much as in your prime."`
    );
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
      await summarizeSessionIfNeeded(sessionId, variant);
      addMessage(sessionId, 'user', strippedMessage);
    }

    let contextualMessage = strippedMessage;
    const contextPayload = sessionId ? buildContextPayload(sessionId) : { context: '' };
    if (contextPayload.context) {
      contextualMessage = `${contextPayload.context}\n\nCURRENT_REQUEST:\n${strippedMessage}`;
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
        sketchContext,
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

app.post('/api/runtime/exec', async (req, res) => {
  const { command, cwd, runtimeMode = 'auto', sessionId } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });

  const runtimeCwd = resolveRuntimeCwd(cwd);
  if (!runtimeCwd) return res.status(403).json({ error: 'Invalid working directory' });

  const result = await runRuntime({
    command,
    cwd: runtimeCwd,
    runtimeMode,
    allowLocal: allowLocalRuntime(),
    commandId: randomUUID(),
    sessionId,
  });

  res.json(result);
});

app.post('/api/runtime/stream', async (req, res) => {
  const { command, cwd, runtimeMode = 'auto' } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });

  const runtimeCwd = resolveRuntimeCwd(cwd);
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
  res.json({ success: true, commandId });
});

// ── HEALTH CHECK ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    variants: Object.keys(VARIANT_CAPS),
    tavilyEnabled: !!process.env.TAVILY_API_KEY,
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
    const tree = getFileTree(PROJECT_ROOT);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fs/file', (req, res) => {
  const { path: relPath } = req.query;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  try {
    const fullPath = resolveWithinRoot(relPath);
    if (!fullPath) return res.status(403).json({ error: 'Access denied' });

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
    if (fs.statSync(fullPath).isDirectory()) {
      return res.status(400).json({ error: 'Cannot open a folder in the editor' });
    }

    if (isImageFile(fullPath)) {
      return res.json({
        kind: 'image',
        url: `/api/fs/raw?path=${encodeURIComponent(String(relPath))}`,
      });
    }

    const buffer = fs.readFileSync(fullPath);
    if (isBinaryBuffer(buffer)) {
      return res.json({
        kind: 'binary',
        content: '',
        message: 'Binary files cannot be edited in the code editor.',
      });
    }

    const content = buffer.toString('utf-8');
    res.json({ kind: 'text', content });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.get('/api/fs/search', (req, res) => {
  const query = String(req.query.query || '').toLowerCase().trim();
  if (!query) return res.json({ results: [] });
  const tree = getFileTree(PROJECT_ROOT);
  const flat = flattenFileTree(tree);
  const results = flat
    .map(f => f.path)
    .filter(p => p.toLowerCase().includes(query))
    .slice(0, 200);
  res.json({ results });
});

// ── TERMINAL EXECUTION (Phase 5 - Local Fallback) ──────────────────────────────
app.post('/api/term/exec', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });

  // Basic security check - prevent obvious destruction
  if (command.includes('rm -rf /') || command.includes('format c:')) {
    return res.status(403).json({ error: 'Command blocked by safety protocol' });
  }

  exec(command, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
    res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      error: error ? error.message : null,
      code: error ? error.code : 0
    });
  });
});

// ── BOOT ───────────────────────────────────────────────────────────────────────
app.listen(3002, () => {
  console.log('\n  ⚔  KAUTILYA CODE SERVER v2');
  console.log('  Variant-aware | Concurrent tribunal | Semantic memory | Arbitration\n');
  logVariantBoot();
  console.log('\n  http://localhost:3002\n');
});
