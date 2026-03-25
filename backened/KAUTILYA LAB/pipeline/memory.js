/**
 * KAUTILYA MEMORY SYSTEM — Janapada Layer
 *
 * Upgrades from the flat JSON keyword-match to:
 *   1. TF-IDF-style term scoring (no external deps)
 *   2. Recency decay — recent sessions score higher
 *   3. Outcome-weighted retrieval — high-score past answers rank first
 *   4. Durga incident log — security blocks inform Kantaka
 *   5. Division verdict log — tribunal decisions persist
 *   6. LRU eviction — cheapest sessions evicted first
 *   7. Supabase pgvector semantic memory (Gemini embeddings)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'knowledge');
const MEMORY_FILE = path.join(DATA_DIR, 'code-memory.json');
const DURGA_FILE = path.join(DATA_DIR, 'durga-incidents.json');
const VERDICT_FILE = path.join(DATA_DIR, 'tribunal-verdicts.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

let warnedSupabase = false;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

const CFG = {
  MAX_SESSIONS: 300,
  SNIPPET_CHARS: 500,
  RECENT_COUNT: 5,
  MIN_WORD_LEN: 3,
  MIN_OVERLAP: 2,
  OVERLAP_RATIO: 0.35,
  RECENCY_HALF_LIFE_DAYS: 14, // score halves every 14 days
  MAX_DURGA_INCIDENTS: 100,
  MAX_VERDICTS: 200,
  RETRIEVE_TOP_K: 3,
  EMBEDDING_MODEL: 'text-embedding-004',
  EMBEDDING_DIM: 768,
  EMBEDDING_MAX_CHARS: 8000,
};

// -- FILE HELPERS --------------------------------------------------------------

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeRead(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    const backup = filePath + '.corrupted.' + Date.now();
    try { fs.copyFileSync(filePath, backup); } catch { /* ignore */ }
    console.warn(`  Memory file corrupted — backed up, resetting: ${path.basename(filePath)}`);
    return fallback;
  }
}

function safeWrite(filePath, data) {
  ensureDir();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`  Failed to write memory: ${err.message}`);
  }
}

// -- EMBEDDINGS (GEMINI) -------------------------------------------------------

async function embedText(text) {
  if (!GEMINI_API_KEY) return null;
  const clean = String(text || '').slice(0, CFG.EMBEDDING_MAX_CHARS);
  if (!clean) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CFG.EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: clean }] },
        }),
      }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const values = d?.embedding?.values;
    if (!Array.isArray(values) || values.length !== CFG.EMBEDDING_DIM) return null;
    return values;
  } catch {
    return null;
  }
}

async function searchSupabase(question) {
  if (!supabase) return null;
  const embedding = await embedText(question);
  if (!embedding) return null;
  const { data, error } = await supabase.rpc('search_memory', {
    query_embedding: embedding,
    match_count: CFG.RETRIEVE_TOP_K,
  });
  if (error) {
    console.warn(`  Supabase search_memory error: ${error.message}`);
    return null;
  }
  return data && data.length ? data : null;
}

async function saveSupabase(session) {
  if (!supabase) return false;
  const embedding = await embedText(session.question);
  if (!embedding) return false;
  const { error } = await supabase.from('memory_sessions').insert({
    question: session.question,
    code_snippet: session.codeSnippet,
    language: session.language,
    pattern: session.pattern,
    tier: session.tier,
    score: session.score,
    metadata: session.metadata ?? {},
    embedding,
  });
  if (error) {
    console.warn(`  Supabase memory insert failed: ${error.message}`);
    return false;
  }
  return true;
}

// -- TERM EXTRACTION -----------------------------------------------------------

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','need','dare','ought','used','to','in',
  'on','at','by','for','with','about','as','of','from','into','through',
  'how','what','when','where','why','which','who','this','that','these',
  'those','and','or','but','if','then','so','yet','both','either',
  'my','your','his','her','its','our','their','it','i','me','we',
]);

function extractTerms(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= CFG.MIN_WORD_LEN && !STOP_WORDS.has(w));
}

// -- RECENCY SCORE -------------------------------------------------------------

function recencyScore(isoTimestamp) {
  if (!isoTimestamp) return 0.5;
  const ageDays = (Date.now() - new Date(isoTimestamp).getTime()) / 86_400_000;
  // Exponential decay: score = 1 / (1 + age/halfLife)
  return 1 / (1 + ageDays / CFG.RECENCY_HALF_LIFE_DAYS);
}

// -- TERM OVERLAP SCORE --------------------------------------------------------

function overlapScore(queryTerms, session) {
  if (!session.terms?.length) return 0;
  const sessionSet = new Set(session.terms);
  const overlap = queryTerms.filter(t => sessionSet.has(t)).length;
  if (!overlap) return 0;
  // Normalize: overlap / max(query, session) — penalizes very long sessions
  return overlap / Math.max(queryTerms.length, session.terms.length);
}

// -- COMPOSITE SCORE -----------------------------------------------------------
// 50% semantic overlap + 30% recency + 20% outcome quality

function compositeScore(queryTerms, session) {
  const semantic = overlapScore(queryTerms, session);
  if (semantic === 0) return 0; // fast-exit: no overlap
  const recency = recencyScore(session.timestamp);
  const quality = ((session.score ?? 7) - 5) / 5; // normalize 5-10 ? 0-1
  return 0.5 * semantic + 0.3 * recency + 0.2 * quality;
}

function formatMemoryRows(rows) {
  return rows
    .map(m =>
      `Past: "${m.question}" [${m.language ?? 'unknown'}]\n` +
      `Pattern: ${m.pattern ?? 'unknown'} | Score: ${m.score ?? '?'} / 10 | Tier: ${m.tier ?? '?'}\n` +
      (m.code_snippet || m.codeSnippet ? `Snippet: ${m.code_snippet ?? m.codeSnippet}` : '')
    )
    .join('\n\n');
}

// -- PUBLIC: SEARCH MEMORY -----------------------------------------------------

export async function searchMemory(question) {
  if (!question) return null;

  if (!SUPABASE_ENABLED && !warnedSupabase) {
    console.warn('  Supabase disabled — using local TF-IDF memory');
    warnedSupabase = true;
  }

  // Try Supabase semantic memory first
  const supa = await searchSupabase(question);
  if (!supa && SUPABASE_ENABLED && !warnedSupabase) {
    console.warn('  Supabase search failed — falling back to TF-IDF');
    warnedSupabase = true;
  }
  if (supa) return formatMemoryRows(supa);

  // Fallback to local TF-IDF memory
  const memory = safeRead(MEMORY_FILE, { sessions: [], totalQuestions: 0 });
  if (!memory.sessions?.length) return null;

  const queryTerms = extractTerms(question);
  if (queryTerms.length < 1) return null;

  const minOverlap = Math.max(
    CFG.MIN_OVERLAP,
    Math.floor(queryTerms.length * CFG.OVERLAP_RATIO)
  );

  const scored = memory.sessions
    .filter(s => {
      if (typeof s?.question !== 'string') return false;
      const overlap = queryTerms.filter(t =>
        (s.terms ?? extractTerms(s.question)).includes(t)
      ).length;
      return overlap >= minOverlap;
    })
    .map(s => ({ s, score: compositeScore(queryTerms, s) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.RETRIEVE_TOP_K)
    .map(x => x.s);

  if (!scored.length) return null;

  return formatMemoryRows(scored.map(s => ({
    question: s.question,
    codeSnippet: s.codeSnippet,
    language: s.language,
    pattern: s.pattern,
    tier: s.tier,
    score: s.score,
  })));
}

// -- PUBLIC: SAVE TO MEMORY -----------------------------------------------------

export async function saveToMemory(question, code, score, language, pattern, tier = 0, metadata = {}) {
  const memory = safeRead(MEMORY_FILE, { sessions: [], totalQuestions: 0 });

  const terms = extractTerms(question);
  const session = {
    id: Date.now(),
    question,
    terms, // pre-indexed for fast retrieval
    language,
    pattern,
    tier,
    codeSnippet: typeof code === 'string' ? code.slice(0, CFG.SNIPPET_CHARS) : '',
    score,
    timestamp: new Date().toISOString(),
    metadata,
  };

  memory.sessions.push(session);

  // LRU eviction: evict lowest-scoring sessions first when over limit
  if (memory.sessions.length > CFG.MAX_SESSIONS) {
    memory.sessions.sort((a, b) => (a.score ?? 5) - (b.score ?? 5));
    memory.sessions = memory.sessions.slice(-CFG.MAX_SESSIONS);
  }

  memory.totalQuestions = (memory.totalQuestions ?? 0) + 1;
  memory.lastUpdated = new Date().toISOString();

  safeWrite(MEMORY_FILE, memory);

  // Best-effort Supabase write
  if (SUPABASE_ENABLED) {
    await saveSupabase(session);
  } else if (!warnedSupabase) {
    console.warn('  Supabase disabled — skipping pgvector write');
    warnedSupabase = true;
  }
}

// -- DURGA INCIDENT LOG ---------------------------------------------------------
// When Durga blocks an attack, log it so Kantaka knows what real attacks look like.

function classifyPayload(payload) {
  const sample = String(payload || '').toLowerCase();
  if (sample.includes('<script') || sample.includes('alert(')) return 'xss';
  if (sample.includes('drop table') || sample.includes('select ') || sample.includes('union select')) return 'sql';
  if (sample.length > 5000) return 'oversized';
  return 'generic';
}

export function logDurgaIncident(type, payload, blocked, details = {}) {
  const incidents = safeRead(DURGA_FILE, { incidents: [] });
  const payloadSnippet = String(payload ?? '').slice(0, 100);

  incidents.incidents.push({
    id: Date.now(),
    type, // 'grind_override' | 'rate_limit' | 'payload_too_large' | 'injection_attempt'
    payloadSnippet,
    payloadClass: details.payloadClass || classifyPayload(payloadSnippet),
    blocked,
    ip: details.ip || null,
    size: details.size || null,
    timestamp: new Date().toISOString(),
  });

  if (incidents.incidents.length > CFG.MAX_DURGA_INCIDENTS) {
    incidents.incidents = incidents.incidents.slice(-CFG.MAX_DURGA_INCIDENTS);
  }

  safeWrite(DURGA_FILE, incidents);
}

export function getRecentIncidents(limit = 5) {
  const incidents = safeRead(DURGA_FILE, { incidents: [] });
  return incidents.incidents.slice(-limit);
}

export function summarizeIncidents(limit = 10) {
  const incidents = getRecentIncidents(limit);
  if (!incidents.length) return 'No recent incidents.';

  const bucket = {};
  for (const i of incidents) {
    const key = `${i.type}:${i.payloadClass}`;
    bucket[key] = (bucket[key] || 0) + 1;
  }

  const summaryLines = Object.entries(bucket)
    .map(([key, count]) => {
      const [type, payloadClass] = key.split(':');
      return `Type=${type} Class=${payloadClass} Count=${count}`;
    })
    .join('\n');

  const recentLines = incidents
    .map(i => `Type=${i.type} Class=${i.payloadClass} Blocked=${i.blocked} At=${i.timestamp}`)
    .join('\n');

  return `SUMMARY:\n${summaryLines}\n\nRECENT:\n${recentLines}`;
}

// -- PUBLIC: SAVE TRIBUNAL VERDICT ---------------------------------------------
// Persists what each division decided so the pipeline can learn over time.

export function saveTribunalVerdict(question, verdict, divisions) {
  const store = safeRead(VERDICT_FILE, { verdicts: [] });

  store.verdicts.push({
    id: Date.now(),
    question: question.slice(0, 200),
    verdict, // 'SHIP' | 'NEEDS_FIXES' | 'REWRITE'
    divisions, // { amatya: 'approved', kantaka: 'vetoed', ... }
    timestamp: new Date().toISOString(),
  });

  if (store.verdicts.length > CFG.MAX_VERDICTS) {
    store.verdicts = store.verdicts.slice(-CFG.MAX_VERDICTS);
  }

  safeWrite(VERDICT_FILE, store);
}

// -- PUBLIC: MEMORY STATS ------------------------------------------------------

export function getMemoryStats() {
  const memory = safeRead(MEMORY_FILE, { sessions: [], totalQuestions: 0 });
  return {
    totalQuestions: memory.totalQuestions ?? 0,
    totalSessions: memory.sessions?.length ?? 0,
    lastUpdated: memory.lastUpdated ?? null,
    recent: (memory.sessions ?? [])
      .slice(-CFG.RECENT_COUNT)
      .map(s => ({ q: s.question, lang: s.language, score: s.score, tier: s.tier })),
    supabaseEnabled: SUPABASE_ENABLED,
    embeddingModel: CFG.EMBEDDING_MODEL,
  };
}

