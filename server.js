import express from "express";
import cors from "cors";
import "dotenv/config";
import { tavily } from "@tavily/core";
import { getVariantModel, VARIANT_CAPS } from "./models/selector.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || "http://localhost:5173";
const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE || "Kautilya";
const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const ENABLED_VARIANTS = new Set(["812hybrid"]);

if (!OPENROUTER_API_KEY) {
  console.error("\n  FATAL: OPENROUTER_API_KEY is not set\n");
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

const tavilyClient = process.env.TAVILY_API_KEY ? new tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

function normalizeVariant(raw) {
  const cleaned = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "");
  if (!cleaned) return null;
  if (cleaned === "812") return "812";
  if (cleaned === "812hybrid") return "812hybrid";
  if (cleaned === "812+") return "812+";
  if (cleaned === "812+hybrid") return "812+hybrid";
  return null;
}

function resolveVariant(raw) {
  const normalized = normalizeVariant(raw) || "812hybrid";
  if (!VARIANT_CAPS[normalized]) {
    return { error: `Unknown variant: ${raw || normalized}`, status: 400 };
  }
  if (!ENABLED_VARIANTS.has(normalized)) {
    return {
      error: `Variant "${normalized}" is disabled. Enabled: ${[...ENABLED_VARIANTS].join(", ")}`,
      status: 403,
    };
  }
  return { variant: normalized, status: 200 };
}

function sseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function callOpenRouter({ model, messages, system }) {
  const payload = {
    model,
    messages: system ? [{ role: "system", content: system }, ...messages] : messages,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function handleSseChunk(chunk, onDelta, onDone) {
  const lines = chunk.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.replace(/^data:\s*/, "");
    if (!data) continue;
    if (data === "[DONE]") {
      if (onDone) onDone();
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? "";
    if (typeof delta === "string" && delta.length && onDelta) onDelta(delta);
    const finish = parsed?.choices?.[0]?.finish_reason;
    if (finish && onDone) onDone();
  }
}

async function streamOpenRouter({ model, messages, system, onDelta, onDone, signal }) {
  const payload = {
    model,
    stream: true,
    messages: system ? [{ role: "system", content: system }, ...messages] : messages,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter stream error ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleSseChunk(chunk, onDelta, onDone);
      idx = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) handleSseChunk(buffer, onDelta, onDone);
  if (onDone) onDone();
}

app.post("/api/chat", async (req, res) => {
  const { messages, variant } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages are required" });
  }

  const { variant: resolved, error, status } = resolveVariant(variant);
  if (error) return res.status(status).json({ error });

  const model = getVariantModel(resolved, "G");
  const controller = new AbortController();
  let ended = false;

  const endOnce = () => {
    if (ended) return;
    ended = true;
    res.end();
  };

  res.on("close", () => controller.abort());
  sseHeaders(res);

  try {
    await streamOpenRouter({
      model,
      messages,
      onDelta: (text) => sendSse(res, { text }),
      onDone: () => {
        if (!ended) res.write("data: [DONE]\n\n");
        endOnce();
      },
      signal: controller.signal,
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "OpenRouter API error" });
    }
    sendSse(res, { error: err?.message || "OpenRouter API error" });
    endOnce();
  }
});

app.post("/api/indica/search", async (req, res) => {
  const { query, variant } = req.body || {};
  if (!query) return res.status(400).json({ error: "query is required" });

  const { variant: resolved, error, status } = resolveVariant(variant);
  if (error) return res.status(status).json({ error });

  if (!tavilyClient) return res.status(503).json({ error: "web_search_disabled" });

  try {
    const searchResults = await tavilyClient.search(query, {
      search_depth: "basic",
      max_results: 6,
      include_answer: true,
    });

    const resultsWithScores = searchResults.results.map((result) => {
      let trustScore = 50;
      if (result.url.match(/\.(edu|gov|org)$/)) trustScore += 20;
      if (result.url.includes("wikipedia")) trustScore += 15;
      if (result.published_date) {
        const pubDate = new Date(result.published_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (pubDate > oneYearAgo) trustScore += 10;
      }
      if (result.url.match(/reddit|quora/)) trustScore -= 20;
      trustScore = Math.max(0, Math.min(100, trustScore));
      return {
        title: result.title,
        url: result.url,
        snippet: result.content,
        trust_score: trustScore,
        domain: new URL(result.url).hostname,
      };
    });

    const model = getVariantModel(resolved, "REA");
    const summary = await callOpenRouter({
      model,
      system: "You are a research assistant. Summarize search results clearly and concisely.",
      messages: [
        {
          role: "user",
          content: `Summarize these search results about ${query} in 3-4 clear paragraphs. Cite sources by number [1], [2] etc. Be factual and concise.\n\n${JSON.stringify(
            resultsWithScores,
            null,
            2
          )}`,
        },
      ],
    });

    res.json({ answer: summary, sources: resultsWithScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.post("/api/indica/deep", async (req, res) => {
  const { query, variant } = req.body || {};
  if (!query) return res.status(400).json({ error: "query is required" });

  const { variant: resolved, error, status } = resolveVariant(variant);
  if (error) return res.status(status).json({ error });

  if (!tavilyClient) return res.status(503).json({ error: "web_search_disabled" });

  const controller = new AbortController();
  let ended = false;
  const endOnce = () => {
    if (ended) return;
    ended = true;
    res.end();
  };

  res.on("close", () => controller.abort());
  sseHeaders(res);

  try {
    const model = getVariantModel(resolved, "REA");
    const questionsRaw = await callOpenRouter({
      model,
      system: "You are a research analyst. Break topics into specific sub-questions.",
      messages: [
        {
          role: "user",
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

    sendSse(res, { type: "questions", questions });

    const allSources = [];
    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i];
      sendSse(res, { type: "searching", question, index: i });
      const searchResults = await tavilyClient.search(question, {
        search_depth: "advanced",
        max_results: 4,
      });
      allSources.push(...searchResults.results);
    }

    sendSse(res, { type: "compiling" });

    const reportSystem = "You are a research analyst. Write comprehensive research reports with proper structure and citations.";
    const reportPrompt = `You are a research analyst. Using these search results, write a comprehensive research report on: ${query}

Structure it as:
## Executive Summary
## Key Findings
## Detailed Analysis
## Sources & Credibility
## Conclusion

Cite sources as [1], [2] etc. Be thorough and analytical.

Sources: ${JSON.stringify(allSources, null, 2)}`;

    let doneCalled = false;
    const doneOnce = () => {
      if (doneCalled) return;
      doneCalled = true;
      const sourcesWithScores = allSources.map((source) => {
        let trustScore = 50;
        if (source.url?.match?.(/\.(edu|gov|org)$/)) trustScore += 20;
        if (source.url?.includes?.("wikipedia")) trustScore += 15;
        if (source.url?.match?.(/reddit|quora/)) trustScore -= 20;
        return {
          title: source.title,
          url: source.url,
          snippet: source.content,
          trust_score: Math.max(0, Math.min(100, trustScore)),
          domain: source.url ? new URL(source.url).hostname : "",
        };
      });
      sendSse(res, { type: "done", sources: sourcesWithScores });
      endOnce();
    };

    await streamOpenRouter({
      model,
      system: reportSystem,
      messages: [{ role: "user", content: reportPrompt }],
      onDelta: (text) => sendSse(res, { type: "report", text }),
      onDone: doneOnce,
      signal: controller.signal,
    });
  } catch (err) {
    console.error(err);
    sendSse(res, { type: "error", message: err?.message || "Deep research failed" });
    endOnce();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
