export function detectProvider(apiKey) {
  const key = String(apiKey || '');
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-') || key.startsWith('sk-proj-')) return 'openai';
  if (key.startsWith('AIza')) return 'google';
  return 'unknown';
}

export function defaultModelForProvider(provider) {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-latest';
    case 'google':
      return 'gemini-1.5-flash';
    default:
      return 'gpt-4o-mini';
  }
}

export function capabilityTierForModel(model = '') {
  const m = model.toLowerCase();
  if (m.includes('opus') || m.includes('sonnet') || m.includes('gpt-4o') || m.includes('gemini-1.5-pro') || m.includes('gemini-2.5')) {
    return 'full';
  }
  if (m.includes('mini') || m.includes('haiku') || m.includes('flash')) {
    return 'core';
  }
  return 'basic';
}

export async function callProvider({ provider, apiKey, model, messages, system }) {
  if (!apiKey) throw new Error('API key missing');
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      }),
    });
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content;
    return content || '';
  }

  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: system || undefined,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const d = await r.json();
    const content = d.content?.[0]?.text;
    return content || '';
  }

  if (provider === 'google') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      }),
    });
    const d = await r.json();
    const content = d.candidates?.[0]?.content?.parts?.[0]?.text;
    return content || '';
  }

  throw new Error('Unknown provider');
}
