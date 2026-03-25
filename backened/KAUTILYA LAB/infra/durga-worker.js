export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ORIGIN_URL || 'http://localhost:3002';
    const maxBytes = parseInt(env.MAX_BODY_BYTES || '8000', 10);
    const rateLimit = parseInt(env.RATE_LIMIT_PER_MIN || '20', 10);
    const edgeCache = env.EDGE_CACHE === 'true';

    const ip = request.headers.get('CF-Connecting-IP')
      || request.headers.get('X-Forwarded-For')
      || 'unknown';

    let bodyBuffer = null;
    if (request.method === 'POST') {
      bodyBuffer = await request.clone().arrayBuffer();
      if (bodyBuffer.byteLength > maxBytes) {
        return new Response('Payload too large', { status: 413 });
      }

      if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        const bucket = Math.floor(Date.now() / 60000);
        const key = `durga:rate:${ip}:${bucket}`;
        const count = await upstashIncr(env, key, 60);
        if (count && count > rateLimit) {
          return new Response('Too many requests', { status: 429 });
        }
      }
    }

    const targetUrl = new URL(url.pathname + url.search, origin).toString();

    if (edgeCache && request.method === 'POST' && request.headers.get('Accept') !== 'text/event-stream') {
      const cacheKey = await buildCacheKey(targetUrl, bodyBuffer || new ArrayBuffer(0));
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;

      const originResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: request.headers,
        body: bodyBuffer,
      });

      const clone = originResponse.clone();
      clone.headers.set('Cache-Control', 'public, max-age=60');
      ctx.waitUntil(caches.default.put(cacheKey, clone));
      return originResponse;
    }

    return fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: bodyBuffer || request.body,
    });
  }
};

async function upstashIncr(env, key, ttlSeconds) {
  try {
    const incrRes = await fetch(`${env.UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const incrData = await incrRes.json();
    const count = incrData?.result ?? null;
    if (count === 1 && ttlSeconds) {
      await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      });
    }
    return count;
  } catch {
    return null;
  }
}

async function buildCacheKey(url, bodyBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bodyBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return new Request(`${url}#${hashHex}`, { method: 'GET' });
}
