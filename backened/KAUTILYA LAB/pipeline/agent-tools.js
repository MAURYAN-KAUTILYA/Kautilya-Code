const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const EXA_API_KEY = process.env.EXA_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

function toSource(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { title: entry, url: entry, content: '' };
  }
  return {
    title: entry.title || entry.url || 'source',
    url: entry.url || '',
    content: entry.content || entry.text || '',
  };
}

export function uniqueSources(...groups) {
  const seen = new Set();
  const items = [];
  for (const group of groups) {
    for (const entry of group || []) {
      const source = toSource(entry);
      if (!source?.url) continue;
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      items.push(source);
    }
  }
  return items;
}

export function uniqueUrls(...groups) {
  const seen = new Set();
  const items = [];
  for (const group of groups) {
    for (const url of group || []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push(url);
    }
  }
  return items;
}

export function buildDesignRefs(query) {
  const q = encodeURIComponent(query);
  return [
    `https://dribbble.com/search/${q}`,
    `https://www.behance.net/search/projects?search=${q}`,
  ];
}

export async function searchTavily(query) {
  if (!TAVILY_API_KEY) return null;
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      provider: 'tavily',
      summary: d.answer || '',
      sources: (d.results || []).map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content || '',
      })),
    };
  } catch (error) {
    console.error(`  Agent Tavily error: ${error.message}`);
    return null;
  }
}

export async function searchPerplexity(query) {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: query }],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      provider: 'perplexity',
      summary: d.choices?.[0]?.message?.content || '',
      sources: (d.citations || []).map((citation) => ({
        title: citation,
        url: citation,
        content: '',
      })),
    };
  } catch (error) {
    console.error(`  Agent Perplexity error: ${error.message}`);
    return null;
  }
}

export async function searchExa(query) {
  if (!EXA_API_KEY) return null;
  try {
    const r = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EXA_API_KEY}`,
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
    return {
      provider: 'exa',
      summary: d.answer || '',
      sources: (d.results || []).map((result) => ({
        title: result.title,
        url: result.url,
        content: result.text || '',
      })),
    };
  } catch (error) {
    console.error(`  Agent Exa error: ${error.message}`);
    return null;
  }
}

export async function searchUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) return [];
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || []).map((photo) => photo.urls?.regular).filter(Boolean);
  } catch (error) {
    console.error(`  Agent Unsplash error: ${error.message}`);
    return [];
  }
}
