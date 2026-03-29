import path from 'path';

const SOCKET_API_KEY = process.env.SOCKET_API_KEY || '';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || '{}'));
  } catch {
    return null;
  }
}

function collectDependencies(manifest) {
  const result = {};
  for (const field of DEPENDENCY_FIELDS) {
    const values = manifest?.[field];
    if (!values || typeof values !== 'object') continue;
    for (const [name, version] of Object.entries(values)) {
      result[name] = {
        name,
        version: String(version || ''),
        section: field,
      };
    }
  }
  return result;
}

function summarizeSocketFinding(pkg, info) {
  const score = info?.score ?? info?.riskScore ?? info?.security?.score ?? null;
  const cveCount = info?.cveCount ?? info?.security?.cveCount ?? info?.vulnerabilities?.length ?? 0;
  const maintenance = info?.maintenance ?? info?.metadata?.last_published ?? info?.lastPublished ?? null;
  const blocked = (typeof score === 'number' && score < 40) || Number(cveCount || 0) > 0;
  return {
    package: pkg,
    score,
    cveCount: Number(cveCount || 0),
    maintenance,
    blocked,
    raw: info && typeof info === 'object' ? undefined : String(info || ''),
  };
}

export function detectDependencyChanges(beforeContent, afterContent) {
  const before = collectDependencies(safeJsonParse(beforeContent) || {});
  const after = collectDependencies(safeJsonParse(afterContent) || {});
  const changed = [];

  for (const [name, nextInfo] of Object.entries(after)) {
    const previous = before[name];
    if (!previous || previous.version !== nextInfo.version || previous.section !== nextInfo.section) {
      changed.push({
        name,
        beforeVersion: previous?.version || null,
        afterVersion: nextInfo.version,
        section: nextInfo.section,
      });
    }
  }

  return changed;
}

export async function inspectManifestRisk({ filePath, beforeContent, afterContent }) {
  if (path.basename(String(filePath || '')).toLowerCase() !== 'package.json') return null;

  const changedDependencies = detectDependencyChanges(beforeContent, afterContent);
  if (!changedDependencies.length) {
    return {
      provider: SOCKET_API_KEY ? 'socket' : 'disabled',
      changedDependencies,
      findings: [],
      blocked: false,
    };
  }

  if (!SOCKET_API_KEY) {
    return {
      provider: 'disabled',
      changedDependencies,
      findings: [],
      blocked: false,
      warning: 'SOCKET_API_KEY missing',
    };
  }

  const findings = await Promise.all(
    changedDependencies.map(async ({ name }) => {
      try {
        const response = await fetch(`https://api.socket.dev/v0/npm/${encodeURIComponent(name)}`, {
          headers: {
            Authorization: `Bearer ${SOCKET_API_KEY}`,
          },
        });
        if (!response.ok) {
          return {
            package: name,
            blocked: false,
            error: `HTTP ${response.status}`,
          };
        }
        const data = await response.json();
        return summarizeSocketFinding(name, data);
      } catch (error) {
        return {
          package: name,
          blocked: false,
          error: error?.message || 'socket_fetch_failed',
        };
      }
    }),
  );

  return {
    provider: 'socket',
    changedDependencies,
    findings,
    blocked: findings.some((entry) => entry?.blocked),
  };
}

export function inspectCommandRisk(command) {
  const normalized = String(command || '').trim().toLowerCase();
  if (!normalized) return null;

  const installLike =
    /\b(npm|pnpm|yarn|bun)\s+(install|add|i)\b/.test(normalized) ||
    /\b(npx|pnpm dlx|bunx)\b/.test(normalized);

  if (!installLike) return null;

  return {
    provider: SOCKET_API_KEY ? 'socket' : 'disabled',
    installLike: true,
    blocked: false,
    warning: SOCKET_API_KEY
      ? 'Install-like command detected. Review dependency risk before approving.'
      : 'Install-like command detected. Socket verification unavailable because SOCKET_API_KEY is missing.',
  };
}
