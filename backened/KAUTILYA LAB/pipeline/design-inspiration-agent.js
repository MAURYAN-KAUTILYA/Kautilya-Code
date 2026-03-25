import { buildDesignRefs, searchUnsplash, uniqueUrls } from './agent-tools.js';

const AGENT_ID = 'king-design-inspiration';
const AGENT_TYPE = 'designInspiration';

function emit(send, type, payload = {}) {
  if (typeof send !== 'function') return;
  send({
    type,
    agentId: AGENT_ID,
    agentType: AGENT_TYPE,
    ...payload,
  });
}

function buildStyleNotes(query, references, imageUrls) {
  const notes = [
    `Use the inspiration brief as the north star: ${query}.`,
    'Favor clean hierarchy, generous spacing, and a restrained accent system unless the brief explicitly asks for louder motion.',
  ];

  if (references.length > 0) {
    notes.push('Cross-check the visual language against the supplied reference links before final styling decisions.');
  }

  if (imageUrls.length > 0) {
    notes.push('Translate the mood of the selected imagery into surfaces, contrast, and pacing rather than copying literal compositions.');
  }

  return notes.slice(0, 3);
}

export async function runDesignInspirationAgent({ task, send }) {
  emit(send, 'agent_dispatch', {
    status: 'running',
    stage: 'dispatch',
    message: 'King dispatched the design inspiration agent.',
    query: task,
  });

  emit(send, 'agent_status', {
    status: 'running',
    stage: 'collecting',
    message: 'Collecting image references and design boards.',
    query: task,
  });

  try {
    const [unsplash] = await Promise.all([
      searchUnsplash(task),
    ]);

    const imageUrls = uniqueUrls(unsplash).slice(0, 6);
    const references = buildDesignRefs(task);
    const styleNotes = buildStyleNotes(task, references, imageUrls);
    const confidence = imageUrls.length > 0 ? 0.82 : 0.46;
    const summary = imageUrls.length > 0
      ? 'Collected fresh image inspiration plus design-board entry points for the King.'
      : 'Collected design-board entry points, but no live image results were available.';

    emit(send, 'agent_step', {
      status: 'running',
      stage: 'curating',
      message: 'Curating reference links and translating them into design notes.',
      query: task,
      imageUrls,
      sources: references.map((url) => ({ title: url.includes('dribbble') ? 'Dribbble' : 'Behance', url })),
    });

    const result = {
      agentType: AGENT_TYPE,
      query: task,
      summary,
      references,
      imageUrls,
      styleNotes,
      confidence,
      status: 'completed',
    };

    emit(send, 'agent_result', {
      status: 'completed',
      stage: 'complete',
      message: 'Design inspiration ready.',
      query: task,
      summary,
      sources: references.map((url) => ({ title: url.includes('dribbble') ? 'Dribbble' : 'Behance', url })),
      imageUrls,
      confidence,
    });

    return result;
  } catch (error) {
    emit(send, 'agent_error', {
      status: 'failed',
      stage: 'failed',
      message: error.message || 'Design inspiration failed.',
      query: task,
    });

    return {
      agentType: AGENT_TYPE,
      query: task,
      summary: 'Design inspiration failed before references could be assembled.',
      references: [],
      imageUrls: [],
      styleNotes: [],
      confidence: 0,
      status: 'failed',
      error: error.message || 'Design inspiration failed.',
    };
  }
}
