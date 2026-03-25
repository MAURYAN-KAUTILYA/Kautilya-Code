import fs from 'fs';
const file = 'code-server.js';
const content = fs.readFileSync(file, 'utf8');

const markerStart = 'const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;';
const markerEnd = '// ── MAIN CODE ROUTE ────────────────────────────────────────────────────────────';

const prefix = content.slice(0, content.indexOf(markerStart) + markerStart.length);
const suffix = content.slice(content.indexOf(markerEnd));

const replacement = `
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
    const incrRes = await fetch(\`\${UPSTASH_REDIS_REST_URL}/incr/\${encodeURIComponent(key)}\`, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${UPSTASH_REDIS_REST_TOKEN}\` },
    });
    const incrData = await incrRes.json();
    const count = incrData?.result ?? null;
    if (count === 1 && ttlSeconds) {
      await fetch(\`\${UPSTASH_REDIS_REST_URL}/expire/\${encodeURIComponent(key)}/\${ttlSeconds}\`, {
        method: 'POST',
        headers: { Authorization: \`Bearer \${UPSTASH_REDIS_REST_TOKEN}\` },
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
    const key = \`durga:rate:\${ip}:\${bucket}\`;
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
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadKnowledge() {
  const readMd = (filePath) => {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
    console.warn(\`  ⚠ Not found: \${path.basename(filePath)}\`);
    return '';
  };

  const codeDir = path.join(__dirname, 'Knowledge', 'code');
  
  const masterInit = readMd(path.join(codeDir, '00_MASTER_SYSTEM_INITIALIZATION.md'));
  const kingDirective = readMd(path.join(codeDir, '02_System_Mandates', '02_king_directive.md'));
  const pipelineRules = readMd(path.join(codeDir, '02_System_Mandates', '01_pipeline_rules.md'));
  
  const arthashastra = readMd(path.join(codeDir, '01_Core_Philosophy', 'arthashastra.md')) || readMd(path.join(codeDir, 'arthashastra.md'));
  const reasoning = readMd(path.join(codeDir, '01_Core_Philosophy', 'chanakya-reasoning.md')) || readMd(path.join(codeDir, 'chanakya-reasoning.md'));
  const destroyer = readMd(path.join(codeDir, '05_Adversarial_Agents', 'destroyer.md')) || readMd(path.join(codeDir, 'destroyer.md'));
  const patterns = readMd(path.join(codeDir, '03_Architecture_Standards', 'code-patterns.md')) || readMd(path.join(codeDir, 'code-patterns.md'));
  const codeStandards = readMd(path.join(codeDir, '03_Architecture_Standards', 'code-standards.md')) || readMd(path.join(codeDir, 'code-standards.md'));
  const frontendDesign = readMd(path.join(codeDir, '04_Frontend_UX', 'frontend-design.md')) || readMd(path.join(codeDir, 'frontend-design.md'));
  const classicLayout = readMd(path.join(codeDir, '04_Frontend_UX', 'classic-app-layout.md')) || readMd(path.join(codeDir, 'classic-app-layout.md'));

  const philosophyPrefix = [
    masterInit && \`\${'═'.repeat(50)}\\n# SYSTEM INITIALIZATION DIRECTIVE\\n\${'═'.repeat(50)}\\n\${masterInit}\`,
    pipelineRules && \`\${'═'.repeat(50)}\\n# PIPELINE MANDATE\\n\${'═'.repeat(50)}\\n\${pipelineRules}\`,
    kingDirective && \`\${'═'.repeat(50)}\\n# RAJARISHI MANDATE\\n\${'═'.repeat(50)}\\n\${kingDirective}\`,
    arthashastra && \`\${'═'.repeat(50)}\\n# DIGITAL ARTHASHASTRA\\n\${'═'.repeat(50)}\\n\${arthashastra}\`,
    reasoning && \`\${'═'.repeat(50)}\\n# CHANAKYA REASONING ENGINE\\n\${'═'.repeat(50)}\\n\${reasoning}\`,
    codeStandards && \`\${'═'.repeat(50)}\\n# CODE STANDARDS\\n\${'═'.repeat(50)}\\n\${codeStandards}\`,
  ].filter(Boolean).join('\\n\\n');

  const full = philosophyPrefix;

  console.log(\`  ✓ Knowledge Loaded: MasterInit=\${!!masterInit} KingMandate=\${!!kingDirective} Scope=\${full.length}\`);

  return { init: masterInit, king: kingDirective, pipeline: pipelineRules, full, patterns, destroyer, frontendDesign, classicLayout };
}

const KNOWLEDGE = loadKnowledge();

// ── SSE HELPERS ────────────────────────────────────────────────────────────────
function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}
const mkSend = (res) => (data) => res.write(\`data: \${JSON.stringify(data)}\\n\\n\`);

// ── GRIND OVERRIDE DETECTOR ────────────────────────────────────────────────────
const GRIND_RE = /\\b(give up|giving up|pointless|hopeless|can't do this|cant do this|not good enough|i'm done|im done|stupid|idiot|hate this|nothing works|why bother|what's the point|whats the point|i suck|too hard|impossible|never work|forget it)\\b/i;

async function callOpenRouter(model, messages, system) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
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

`;

fs.writeFileSync(file, prefix + replacement + suffix, 'utf8');
console.log("Patched successfully.");
