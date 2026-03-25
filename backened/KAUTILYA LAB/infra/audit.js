import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'knowledge', 'audits');
const MAX_ENTRIES = 200;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function auditPath(sessionId) {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function readStore(sessionId) {
  const filePath = auditPath(sessionId);
  if (!fs.existsSync(filePath)) return { entries: [] };
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

export function appendAudit(sessionId, entry) {
  if (!sessionId) return false;
  ensureDir();
  const store = readStore(sessionId);
  store.entries = Array.isArray(store.entries) ? store.entries : [];
  store.entries.push({ ...entry, timestamp: new Date().toISOString() });
  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(-MAX_ENTRIES);
  }
  try {
    fs.writeFileSync(auditPath(sessionId), JSON.stringify(store, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function loadAudits(sessionId) {
  if (!sessionId) return { entries: [] };
  return readStore(sessionId);
}
