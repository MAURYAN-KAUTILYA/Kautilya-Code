/**
 * KAUTILYA MESSENGER — The External Research Agent
 *
 * Layer 2 Agent.
 * Dispatched by the King only.
 * Research, design inspiration, image references.
 *
 * Tools:
 * - Perplexity Sonar Pro (Technical Research)
 * - Exa.ai (Semantic Discovery)
 * - Tavily (Documentation)
 * - Unsplash (Design Mood Boards)
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const EXA_API_KEY = process.env.EXA_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function searchTavily(query) {
  if (!TAVILY_API_KEY) return null;
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced', // deeper than block's search
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      summary: d.answer,
      sources: d.results.map(r => ({ title: r.title, url: r.url, content: r.content })),
    };
  } catch (e) {
    console.error(`  Messenger Tavily error: ${e.message}`);
    return null;
  }
}

async function searchPerplexity(query) {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: query }],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content ?? '';
    return { summary: content, sources: d.citations ?? [] };
  } catch (e) {
    console.error(`  Messenger Perplexity error: ${e.message}`);
    return null;
  }
}

async function searchExa(query) {
  if (!EXA_API_KEY) return null;
  try {
    const r = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        useAutoprompt: true,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const sources = (d.results || []).map((res) => ({
      title: res.title,
      url: res.url,
      content: res.text,
    }));
    return { summary: d.answer || '', sources };
  } catch (e) {
    console.error(`  Messenger Exa error: ${e.message}`);
    return null;
  }
}

async function searchUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) return [];
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || []).map(p => p.urls?.regular).filter(Boolean);
  } catch (e) {
    console.error(`  Messenger Unsplash error: ${e.message}`);
    return [];
  }
}

function buildDesignRefs(query) {
  const q = encodeURIComponent(query);
  return [
    `https://dribbble.com/search/${q}`,
    `https://www.behance.net/search/projects?search=${q}`,
  ];
}

export async function dispatchMessenger(task, context) {
  console.log(`  ☤ Messenger dispatched: "${task}"`);
  
  // Parallel execution of tools based on task type
  // For now, we rely on Tavily as the primary engine if available
  
  const results = {
    research: null,
    designRefs: [],
    imageUrls: [],
    confidence: 0
  };

  try {
    const [tavily, perplexity, exa, unsplash] = await Promise.all([
      searchTavily(task),
      searchPerplexity(task),
      searchExa(task),
      searchUnsplash(task),
    ]);

    const primary = perplexity || tavily || exa;
    if (primary) {
      const sources = primary.sources || [];
      results.research = `SUMMARY: ${primary.summary || 'n/a'}\n\nSOURCES:\n${sources.map(s => `- ${s.title || s.url || 'source'}: ${s.url || s}`).join('\n')}`;
      results.confidence = perplexity ? 0.9 : tavily ? 0.8 : 0.6;
    } else {
      results.research = "Research tools unavailable or failed.";
      results.confidence = 0.1;
    }

    results.imageUrls = unsplash || [];
    results.designRefs = buildDesignRefs(task);
  } catch (err) {
    console.error(`  Messenger failed: ${err.message}`);
    results.research = "Messenger encountered an error.";
  }

  return results;
}
