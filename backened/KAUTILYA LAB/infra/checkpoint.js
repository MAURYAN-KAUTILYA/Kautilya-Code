import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'knowledge');
const CHECKPOINT_DIR = path.join(DATA_DIR, 'checkpoints');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function checkpointPath(sessionId) {
  return path.join(CHECKPOINT_DIR, `${sessionId}.json`);
}

export function saveCheckpoint(sessionId, data) {
  if (!sessionId) return false;
  ensureDir(CHECKPOINT_DIR);
  try {
    fs.writeFileSync(checkpointPath(sessionId), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function loadCheckpoint(sessionId) {
  if (!sessionId) return null;
  const filePath = checkpointPath(sessionId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function clearCheckpoint(sessionId) {
  if (!sessionId) return false;
  const filePath = checkpointPath(sessionId);
  if (!fs.existsSync(filePath)) return true;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
