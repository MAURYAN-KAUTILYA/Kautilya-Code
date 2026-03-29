import { tavily } from '@tavily/core';
import { getVariantModel, VARIANT_CAPS } from '../models/selector.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || 'http://localhost:5173';
const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE || 'Kautilya';

function normalizeVariant(raw) {
  const cleaned = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '');
  if (!cleaned) return null;
  if (cleaned === '812') return '812';
  if (cleaned === '812hybrid') return '812hybrid';
  if (cleaned === '812+') return '812+';
  if (cleaned === '812+hybrid') return '812+hybrid';
  return null;
}

function resolveVariant(raw, enabledVariants) {
  const normalized = normalizeVariant(raw) || '812hybrid';
  if (!VARIANT_CAPS[normalized]) {
    return { error: `Unknown variant: ${raw || normalized}`, status: 400 };
  }
  if (enabledVariants && !enabledVariants.has(normalized)) {
    return {
      error: `Variant "${normalized}" is disabled. Enabled: ${[...enabledVariants].join(', ')}`,
      status: 403,
    };
  }
  return { variant: normalized, status: 200 };
}

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function handleSseChunk(chunk, onDelta, onDone) {
  const lines = chunk.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const raw = trimmed.replace(/^data:\s*/, '');
    if (!raw) continue;
    if (raw === '[DONE]') {
      onDone?.();
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? '';
      if (typeof delta === 'string' && delta.length) onDelta?.(delta);
      if (parsed?.choices?.[0]?.finish_reason) onDone?.();
    } catch {
      // Ignore malformed chunks from upstream SSE.
    }
  }
}

async function callOpenRouter({ model, messages, system }) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_REFERER,
      'X-Title': OPENROUTER_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function streamOpenRouter({ model, messages, system, onDelta, onDone, signal }) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_REFERER,
      'X-Title': OPENROUTER_TITLE,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenRouter stream error ${response.status}: ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      handleSseChunk(chunk, onDelta, onDone);
      boundary = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) handleSseChunk(buffer, onDelta, onDone);
  onDone?.();
}

export function registerIndicaRoutes(app, { enabledVariants = null } = {}) {
  const tavilyClient = process.env.TAVILY_API_KEY
    ? new tavily({ apiKey: process.env.TAVILY_API_KEY })
    : null;

  app.post('/api/chat', async (req, res) => {
    const { messages, variant } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const { variant: resolved, error, status } = resolveVariant(variant, enabledVariants);
    if (error) return res.status(status).json({ error });

    const model = getVariantModel(resolved, 'G');
    const controller = new AbortController();
    let ended = false;

    const endOnce = () => {
      if (ended) return;
      ended = true;
      res.end();
    };

    res.on('close', () => controller.abort());
    sseHeaders(res);

    try {
      await streamOpenRouter({
        model,
        messages,
        onDelta: (text) => sendSse(res, { text }),
        onDone: () => {
          if (!ended) res.write('data: [DONE]\n\n');
          endOnce();
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({ error: 'OpenRouter API error' });
      }
      sendSse(res, { error: error?.message || 'OpenRouter API error' });
      endOnce();
    }
  });

  app.post('/api/indica/search', async (req, res) => {
    const { query, variant } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    const { variant: resolved, error, status } = resolveVariant(variant, enabledVariants);
    if (error) return res.status(status).json({ error });
    if (!tavilyClient) return res.status(503).json({ error: 'web_search_disabled' });

    try {
      const searchResults = await tavilyClient.search(query, {
        search_depth: 'basic',
        max_results: 6,
        include_answer: true,
      });

      const resultsWithScores = (searchResults.results || []).map((result) => {
        let trustScore = 50;
        if (result.url?.match(/\.(edu|gov|org)$/)) trustScore += 20;
        if (result.url?.includes('wikipedia')) trustScore += 15;
        if (result.published_date) {
          const publishedAt = new Date(result.published_date);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          if (publishedAt > oneYearAgo) trustScore += 10;
        }
        if (result.url?.match(/reddit|quora/)) trustScore -= 20;
        trustScore = Math.max(0, Math.min(100, trustScore));
        return {
          title: result.title,
          url: result.url,
          snippet: result.content,
          trust_score: trustScore,
          domain: result.url ? new URL(result.url).hostname : '',
        };
      });

      const model = getVariantModel(resolved, 'REA');
      const summary = await callOpenRouter({
        model,
        system: 'You are a research assistant. Summarize search results clearly and concisely.',
        messages: [
          {
            role: 'user',
            content: `Summarize these search results about ${query} in 3-4 clear paragraphs. Cite sources by number [1], [2] etc. Be factual and concise.\n\n${JSON.stringify(resultsWithScores, null, 2)}`,
          },
        ],
      });

      res.json({ answer: summary, sources: resultsWithScores });
    } catch {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.post('/api/indica/deep', async (req, res) => {
    const { query, variant } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    const { variant: resolved, error, status } = resolveVariant(variant, enabledVariants);
    if (error) return res.status(status).json({ error });
    if (!tavilyClient) return res.status(503).json({ error: 'web_search_disabled' });

    const controller = new AbortController();
    let ended = false;
    const endOnce = () => {
      if (ended) return;
      ended = true;
      res.end();
    };

    res.on('close', () => controller.abort());
    sseHeaders(res);

    try {
      const model = getVariantModel(resolved, 'REA');
      const questionsRaw = await callOpenRouter({
        model,
        system: 'You are a research analyst. Break topics into specific sub-questions.',
        messages: [
          {
            role: 'user',
            content: `Break this research topic into 4 specific sub-questions that together would fully answer: ${query}. Return as JSON array of strings only.`,
          },
        ],
      });

      let questions = [];
      try {
        questions = JSON.parse(questionsRaw);
      } catch {
        questions = [query];
      }

      sendSse(res, { type: 'questions', questions });

      const allSources = [];
      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        sendSse(res, { type: 'searching', question, index });
        const searchResults = await tavilyClient.search(question, {
          search_depth: 'advanced',
          max_results: 4,
        });
        allSources.push(...(searchResults.results || []));
      }

      sendSse(res, { type: 'compiling' });

      const report = await callOpenRouter({
        model,
        system: 'You are a research analyst. Write comprehensive research reports with proper structure and citations.',
        messages: [
          {
            role: 'user',
            content: `Using these search results, write a comprehensive research report on: ${query}\n\nStructure it with a short executive summary, key findings, practical implications, and a concise closing section. Cite sources inline like [1], [2].\n\n${JSON.stringify(allSources, null, 2)}`,
          },
        ],
      });

      sendSse(res, {
        type: 'done',
        report,
        sources: allSources.map((result, index) => ({
          id: index + 1,
          title: result.title,
          url: result.url,
          content: result.content,
        })),
      });
      endOnce();
    } catch (error) {
      sendSse(res, { type: 'error', message: error?.message || 'Deep research failed' });
      endOnce();
    }
  });
}
