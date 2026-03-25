import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_PERSISTENT_COMMANDS } from '../../../src/shared/kautilya-commands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'knowledge');
const SESSION_DIR = path.join(DATA_DIR, 'sessions');

const DEFAULT_CONTEXT_TOKENS = parseInt(process.env.CONTEXT_TOKEN_LIMIT || '16000', 10);
const DEFAULT_CREDIT_LIMIT = parseInt(process.env.CREDIT_LIMIT || '100000', 10);
const DEFAULT_WARN_PERCENT = parseFloat(process.env.CREDIT_WARN_PERCENT || '10');

const sessions = new Map();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // best-effort persistence
  }
}

function sessionPath(sessionId) {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

export function estimateTokens(text) {
  const clean = String(text || '');
  return Math.ceil(clean.length / 4);
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  const fromDisk = readJson(sessionPath(sessionId), null);
  const session = fromDisk || {
    id: sessionId,
    history: [],
    summary: '',
    credits: {
      limit: DEFAULT_CREDIT_LIMIT,
      used: 0,
    },
    key: null,
    persistentCommands: { ...DEFAULT_PERSISTENT_COMMANDS },
    lastAssistantArtifact: '',
    sketchBoard: null,
    updatedAt: new Date().toISOString(),
  };

  session.persistentCommands = {
    ...DEFAULT_PERSISTENT_COMMANDS,
    ...(session.persistentCommands || {}),
  };
  session.lastAssistantArtifact = String(session.lastAssistantArtifact || '');
  session.sketchBoard = session.sketchBoard ?? null;

  sessions.set(sessionId, session);
  return session;
}

export function persistSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) return;
  session.updatedAt = new Date().toISOString();
  writeJson(sessionPath(sessionId), session);
}

export function addMessage(sessionId, role, content) {
  const session = getSession(sessionId);
  if (!session) return;
  const normalizedContent = String(content || '');
  session.history.push({
    role,
    content: normalizedContent,
    ts: new Date().toISOString(),
  });
  if (role === 'assistant') {
    session.lastAssistantArtifact = normalizedContent;
  }
  persistSession(sessionId);
}

export function getRecentMessages(sessionId, count = 5) {
  const session = getSession(sessionId);
  if (!session) return [];
  return session.history.slice(-count);
}

export function buildContextPayload(sessionId) {
  const session = getSession(sessionId);
  if (!session) return { context: '', session: null };
  const recent = getRecentMessages(sessionId, 5);
  const summary = session.summary ? `CONTEXT_SUMMARY:\n${session.summary}\n\n` : '';
  const recentText = recent
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
  const context = `${summary}${recentText}`.trim();
  return { context, session };
}

export async function ensureSummary(sessionId, summarizeFn) {
  const session = getSession(sessionId);
  if (!session) return false;
  const fullText = session.history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const tokens = estimateTokens(fullText);
  const limit = session.contextLimit || DEFAULT_CONTEXT_TOKENS;
  if (tokens < limit * 0.8) return false;

  const toSummarize = session.history.slice(0, Math.max(0, session.history.length - 5));
  if (!toSummarize.length) return false;

  const summary = await summarizeFn(toSummarize);
  if (!summary) return false;

  session.summary = summary;
  session.history = session.history.slice(-5);
  persistSession(sessionId);
  return true;
}

export function updateCredits(sessionId, tokensUsed) {
  const session = getSession(sessionId);
  if (!session) return null;
  const used = Math.max(0, Number(tokensUsed || 0));
  session.credits.used += used;
  persistSession(sessionId);
  return getCreditStatus(sessionId);
}

export function getCreditStatus(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  const limit = session.credits.limit || DEFAULT_CREDIT_LIMIT;
  const used = session.credits.used || 0;
  const remaining = Math.max(0, limit - used);
  const warnAt = Math.floor(limit * (DEFAULT_WARN_PERCENT / 100));
  return {
    limit,
    used,
    remaining,
    warnAt,
    percentRemaining: limit ? Math.max(0, Math.round((remaining / limit) * 100)) : 0,
  };
}

export function setSessionKey(sessionId, keyInfo) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.key = keyInfo;
  persistSession(sessionId);
  return session.key;
}

export function getSessionKey(sessionId) {
  const session = getSession(sessionId);
  return session?.key ?? null;
}

export function getSessionCommands(sessionId) {
  const session = getSession(sessionId);
  return {
    ...DEFAULT_PERSISTENT_COMMANDS,
    ...(session?.persistentCommands || {}),
  };
}

export function setSessionCommands(sessionId, commands) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.persistentCommands = {
    ...DEFAULT_PERSISTENT_COMMANDS,
    ...(commands || {}),
  };
  persistSession(sessionId);
  return session.persistentCommands;
}

export function getLastAssistantArtifact(sessionId) {
  const session = getSession(sessionId);
  return String(session?.lastAssistantArtifact || '');
}

export function setLastAssistantArtifact(sessionId, artifact) {
  const session = getSession(sessionId);
  if (!session) return '';
  session.lastAssistantArtifact = String(artifact || '');
  persistSession(sessionId);
  return session.lastAssistantArtifact;
}

export function getSessionSketch(sessionId) {
  const session = getSession(sessionId);
  return session?.sketchBoard ?? null;
}

export function setSessionSketch(sessionId, sketchBoard) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.sketchBoard = sketchBoard ?? null;
  persistSession(sessionId);
  return session.sketchBoard;
}
