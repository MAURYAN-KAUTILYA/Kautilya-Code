import 'dotenv/config';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const UPSTASH_ENABLED = Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);

function endpoint(commandPath) {
  return `${UPSTASH_REDIS_REST_URL.replace(/\/$/, '')}/${commandPath.replace(/^\/+/, '')}`;
}

async function request(commandPath, { method = 'POST' } = {}) {
  if (!UPSTASH_ENABLED) return null;
  try {
    const response = await fetch(endpoint(commandPath), {
      method,
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function isUpstashEnabled() {
  return UPSTASH_ENABLED;
}

export async function writeUpstashJson(key, value, ttlSeconds = 3600) {
  if (!UPSTASH_ENABLED || !key) return false;
  const serialized = encodeURIComponent(JSON.stringify(value));
  const safeKey = encodeURIComponent(String(key));
  const written = await request(`set/${safeKey}/${serialized}`);
  if (!written) return false;
  if (ttlSeconds) {
    await request(`expire/${safeKey}/${Math.max(1, Number(ttlSeconds) || 1)}`);
  }
  return true;
}

export async function readUpstashJson(key) {
  if (!UPSTASH_ENABLED || !key) return null;
  const safeKey = encodeURIComponent(String(key));
  const response = await request(`get/${safeKey}`, { method: 'GET' });
  const raw = response?.result;
  if (typeof raw !== 'string' || !raw.length) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deleteUpstashKey(key) {
  if (!UPSTASH_ENABLED || !key) return false;
  const safeKey = encodeURIComponent(String(key));
  const deleted = await request(`del/${safeKey}`);
  return Boolean(deleted);
}
