/**
 * KAUTILYA MODEL SELECTOR
 * Maps the 4 frontend variants (812, 812hybrid, 812+, 812+hybrid)
 * to backend capabilities, division activation, and model pools.
 *
 * Variant → Section unlocks:
 *   812          Simple only
 *   812hybrid    Simple + Think + web search + multi-model routing
 *   812+         Simple + Think + Chanakya Intelligence (paid models)
 *   812+hybrid   Everything + Max Mode (full concurrent tribunal)
 */

// ─── MODEL POOLS ──────────────────────────────────────────────────────────────
// Three pools: G (general/fast), COD (code specialist), REA (deep reasoning)
// Each has a primary + ordered fallbacks.

export const MODEL_POOLS = {
  G: [
    'google/gemini-2.0-flash-001',
    'google/gemini-2.0-flash-lite-001',
    'meta-llama/llama-3.3-70b-instruct:free',
  ],
  COD: [
    'qwen/qwen3-coder:free',
    'deepseek/deepseek-chat:free',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct:free',
  ],
  REA: [
    'google/gemini-2.5-flash-preview-05-20',
    'deepseek/deepseek-r1:free',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct:free',
  ],
  // Paid pools — only activated on 812+ variants
  REA_PAID: [
    'anthropic/claude-sonnet-4-5',
    'google/gemini-2.5-pro-preview',
    'openai/gpt-4o',
    'google/gemini-2.5-flash-preview-05-20',  // fallback to free if paid fails
  ],
  COD_PAID: [
    'anthropic/claude-sonnet-4-5',
    'openai/gpt-4o',
    'qwen/qwen3-coder:free',
  ],
};

// ─── VARIANT CAPABILITY MAP ───────────────────────────────────────────────────

export const VARIANT_CAPS = {
  '812': {
    sections: ['Simple'],
    mediums: ['ask', 'build'],
    webSearch: false,
    multiModel: false,
    maxTier: 3,
    divisions: [],          // no tribunal divisions
    maxMode: false,
    modelPools: { G: 'G', COD: 'COD', REA: 'G' },  // REA falls back to G (cheaper)
    label: 'Standard',
  },
  '812hybrid': {
    sections: ['Simple', 'Think'],
    mediums: ['ask', 'plan', 'build'],
    webSearch: true,
    multiModel: true,       // routes tasks to best free model per type
    maxTier: 3,
    divisions: [],          // hybrid adds search/routing, not tribunal
    maxMode: false,
    modelPools: { G: 'G', COD: 'COD', REA: 'REA' },
    label: 'Hybrid',
  },
  '812+': {
    sections: ['Simple', 'Think', 'Chanakya Intelligence'],
    mediums: ['ask', 'plan', 'build'],
    webSearch: false,       // paid tier, no hybrid search
    multiModel: true,
    maxTier: 5,
    // Divisions run sequentially in paid tier (no Max Mode yet)
    divisions: ['amatya', 'kantaka', 'dharmashta', 'samstha'],
    maxMode: false,
    modelPools: { G: 'G', COD: 'COD_PAID', REA: 'REA_PAID' },
    label: 'Pro',
  },
  '812+hybrid': {
    sections: ['Simple', 'Think', 'Chanakya Intelligence'],
    mediums: ['ask', 'plan', 'build'],
    webSearch: true,
    multiModel: true,
    maxTier: 5,
    // All 6 divisions, concurrent attack layer, full tribunal
    divisions: ['amatya', 'kantaka', 'dharmashta', 'diplomat', 'samstha', 'sanchara'],
    maxMode: true,          // concurrent tribunal
    modelPools: { G: 'G', COD: 'COD_PAID', REA: 'REA_PAID' },
    label: 'Pro Hybrid',
  },
};

// ─── POOL INDEX TRACKER (stateful — lives for server lifetime) ────────────────

const poolIdx = { G: 0, COD: 0, REA: 0, REA_PAID: 0, COD_PAID: 0 };

export function getModel(poolName) {
  const pool = MODEL_POOLS[poolName];
  if (!pool) throw new Error(`Unknown model pool: ${poolName}`);
  return pool[poolIdx[poolName] % pool.length];
}

export function rotateModel(poolName) {
  poolIdx[poolName] = (poolIdx[poolName] + 1) % MODEL_POOLS[poolName].length;
  return getModel(poolName);
}

// ─── VARIANT-AWARE MODEL GETTER ───────────────────────────────────────────────
// Instead of calling getModel('REA') directly, call getVariantModel(variant, 'REA')
// so 812+ automatically uses REA_PAID.

export function getVariantModel(variant, role) {
  const caps = VARIANT_CAPS[variant];
  if (!caps) throw new Error(`Unknown variant: ${variant}`);
  const poolName = caps.modelPools[role] ?? role;
  return getModel(poolName);
}

export function rotateVariantModel(variant, role) {
  const caps = VARIANT_CAPS[variant];
  const poolName = caps.modelPools[role] ?? role;
  return rotateModel(poolName);
}

// ─── SECTION → REASONING DEPTH ────────────────────────────────────────────────

export const SECTION_DEPTH = {
  'Simple':                 { reasoning: false, tribunal: false },
  'Think':                  { reasoning: true,  tribunal: false },
  'Chanakya Intelligence':  { reasoning: true,  tribunal: true  },
};

// ─── VARIANT VALIDATOR ─────────────────────────────────────────────────────────
// Called by the route handler to reject invalid combos early.

export function validateRequest(variant, section, medium) {
  const caps = VARIANT_CAPS[variant];
  if (!caps) {
    return { valid: false, reason: `Unknown variant: ${variant}` };
  }
  if (!caps.sections.includes(section)) {
    return {
      valid: false,
      reason: `Section "${section}" is not available on ${variant}. Available: ${caps.sections.join(', ')}`,
      upgrade: section === 'Chanakya Intelligence' ? '812+' : '812hybrid',
    };
  }
  if (!caps.mediums.includes(medium?.toLowerCase())) {
    return {
      valid: false,
      reason: `Medium "${medium}" is not available on ${variant}`,
    };
  }
  return { valid: true, caps };
}

// ─── TIER GATE ─────────────────────────────────────────────────────────────────
// Clamps the decision engine's tier to what the variant allows.

export function gateTier(variant, requestedTier) {
  const maxTier = VARIANT_CAPS[variant]?.maxTier ?? 3;
  if (requestedTier > maxTier) {
    console.log(`  ↓ Tier ${requestedTier} → ${maxTier} (${variant} cap)`);
    return maxTier;
  }
  return requestedTier;
}

export function logVariantBoot() {
  console.log('  Variants:');
  for (const [name, caps] of Object.entries(VARIANT_CAPS)) {
    const pools = Object.entries(caps.modelPools)
      .map(([role, pool]) => `${role}→${getModel(pool)}`)
      .join(' | ');
    console.log(`    ${name.padEnd(14)} [${caps.label}]  ${pools}`);
  }
}