import { searchExa, searchPerplexity, searchTavily, uniqueSources } from './agent-tools.js';

const AGENT_ID = 'king-web-research';
const AGENT_TYPE = 'webResearch';

function emit(send, type, payload = {}) {
  if (typeof send !== 'function') return;
  send({
    type,
    agentId: AGENT_ID,
    agentType: AGENT_TYPE,
    ...payload,
  });
}

function buildConstraints(query, sources) {
  const constraints = [];
  if (query) constraints.push(`Anchor implementation to the research brief: ${query}.`);
  if (sources.length > 0) constraints.push('Prefer the cited sources over assumptions and generic recollection.');
  if (sources.some((source) => /docs|guide|reference|api/i.test(source.url || source.title || ''))) {
    constraints.push('When a documented behavior conflicts with intuition, trust the docs path.');
  }
  return constraints.slice(0, 3);
}

export async function runWebResearchAgent({ task, send }) {
  emit(send, 'agent_dispatch', {
    status: 'running',
    stage: 'dispatch',
    message: 'King dispatched the web research agent.',
    query: task,
  });

  emit(send, 'agent_status', {
    status: 'running',
    stage: 'search',
    message: 'Checking Tavily, Perplexity, and Exa in parallel.',
    query: task,
  });

  try {
    const [tavily, perplexity, exa] = await Promise.all([
      searchTavily(task),
      searchPerplexity(task),
      searchExa(task),
    ]);

    const primary = perplexity || tavily || exa;
    const sources = uniqueSources(perplexity?.sources, tavily?.sources, exa?.sources);
    const summary = primary?.summary || 'Research tools were unavailable, so the agent could not gather fresh web context.';
    const confidence = primary?.provider === 'perplexity'
      ? 0.9
      : primary?.provider === 'tavily'
        ? 0.8
        : primary?.provider === 'exa'
          ? 0.7
          : 0.15;
    const constraints = buildConstraints(task, sources);

    emit(send, 'agent_step', {
      status: 'running',
      stage: 'synthesis',
      message: primary ? 'Synthesizing the strongest findings for the King.' : 'No live research sources responded; returning a low-confidence result.',
      query: task,
      sources: sources.slice(0, 6),
    });

    const result = {
      agentType: AGENT_TYPE,
      query: task,
      summary,
      sources,
      confidence,
      constraints,
      status: 'completed',
    };

    emit(send, 'agent_result', {
      status: 'completed',
      stage: 'complete',
      message: 'Web research complete.',
      query: task,
      summary,
      sources: sources.slice(0, 8),
      confidence,
    });

    return result;
  } catch (error) {
    emit(send, 'agent_error', {
      status: 'failed',
      stage: 'failed',
      message: error.message || 'Web research failed.',
      query: task,
    });

    return {
      agentType: AGENT_TYPE,
      query: task,
      summary: 'Web research failed before results could be synthesized.',
      sources: [],
      confidence: 0,
      constraints: [],
      status: 'failed',
      error: error.message || 'Web research failed.',
    };
  }
}
