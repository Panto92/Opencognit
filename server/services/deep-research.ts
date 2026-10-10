// =============================================================================
// Deep Research Service
// Multi-step web research with synthesis and citation
// =============================================================================
//
// Flow:
//   1. Decompose query into sub-queries (LLM)
//   2. Web search each sub-query
//   3. Extract content from top results
//   4. Synthesize findings into structured report (LLM)
//   5. Save report to data/research/{companyId}/{runId}.json

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { settings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decryptSetting } from '../utils/crypto.js';

const RESEARCH_DIR = path.resolve(process.cwd(), 'data', 'research');

interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  content: string;
}

interface ResearchRun {
  id: string;
  companyId: string;
  query: string;
  status: 'running' | 'done' | 'error';
  subQueries: string[];
  sources: ResearchSource[];
  report: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// ── Web Search ───────────────────────────────────────────────────────────────

async function searchDuckDuckGo(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const q = encodeURIComponent(query);
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const resultBlocks = html.match(/<a rel="nofollow" class="result__a"[\s\S]*?<\/a>/g) || [];
    const snippetBlocks = html.match(/<a class="result__snippet"[\s\S]*?<\/a>/g) || [];

    for (let i = 0; i < Math.min(resultBlocks.length, snippetBlocks.length, 5); i++) {
      const titleMatch = resultBlocks[i].match(/>([^<]+)</);
      const urlMatch = resultBlocks[i].match(/href="([^"]+)"/);
      const snippetMatch = snippetBlocks[i]?.match(/>([\s\S]*?)</);
      if (titleMatch && urlMatch) {
        results.push({
          title: titleMatch[1].trim(),
          url: decodeURIComponent(urlMatch[1].replace(/^\/l\?kh=-?\d+&uddg=/, '')),
          snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '',
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Content Extraction ───────────────────────────────────────────────────────

async function extractContent(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return '';
    const html = await resp.text();

    // Simple extraction: remove scripts, styles, then get text
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Truncate to ~4000 chars to stay within context limits
    return text.slice(0, 4000);
  } catch {
    return '';
  }
}

// ── LLM Call ─────────────────────────────────────────────────────────────────

async function callLLM(prompt: string, companyId: string): Promise<string> {
  // Try OpenRouter first, then OpenAI, then fallback
  const apiKey = getApiKey(companyId);
  if (!apiKey) {
    throw new Error('No LLM API key configured. Add an OpenRouter or OpenAI key in Settings.');
  }

  const body = {
    model: 'anthropic/claude-sonnet-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.3,
  };

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://opencognit.local',
      'X-Title': 'OpenCognit Deep Research',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LLM error: ${resp.status} ${err}`);
  }

  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

function getApiKey(companyId: string): string | null {
  // Try OpenRouter first
  const or = db.select().from(settings)
    .where(and(eq(settings.key, 'openrouter_api_key'), eq(settings.companyId, companyId))).get()
    ?? db.select().from(settings).where(eq(settings.key, 'openrouter_api_key')).get();
  if (or?.value) {
    try { return decryptSetting(or.value); } catch { /* ignore */ }
  }
  // Try OpenAI
  const oa = db.select().from(settings)
    .where(and(eq(settings.key, 'openai_api_key'), eq(settings.companyId, companyId))).get()
    ?? db.select().from(settings).where(eq(settings.key, 'openai_api_key')).get();
  if (oa?.value) {
    try { return decryptSetting(oa.value); } catch { /* ignore */ }
  }
  return null;
}

// ── Core Research Logic ──────────────────────────────────────────────────────

export function createResearchRun(query: string, companyId: string): ResearchRun {
  const runId = `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const run: ResearchRun = {
    id: runId,
    companyId,
    query,
    status: 'running',
    subQueries: [],
    sources: [],
    report: '',
    createdAt: new Date().toISOString(),
  };
  saveRun(run);
  return run;
}

export async function runDeepResearch(run: ResearchRun): Promise<ResearchRun> {
  const { query, companyId } = run;

  try {
    // Step 1: Generate sub-queries
    const subQueryPrompt = `You are a research assistant. The user wants to research: "${query}"

Break this down into 3-5 specific sub-questions that will help gather comprehensive information.
Return ONLY a JSON array of strings, nothing else.

Example: ["What is X?", "How does Y work?", "Recent developments in Z"]`;

    const subQueryRaw = await callLLM(subQueryPrompt, companyId);
    let subQueries: string[] = [];
    try {
      const match = subQueryRaw.match(/\[[\s\S]*\]/);
      subQueries = match ? JSON.parse(match[0]) : [query];
    } catch {
      subQueries = [query];
    }
    if (subQueries.length === 0) subQueries = [query];
    run.subQueries = subQueries;
    saveRun(run);

    // Step 2: Search each sub-query
    const allResults: Array<{ title: string; url: string; snippet: string }> = [];
    for (const sq of subQueries.slice(0, 4)) {
      const results = await searchDuckDuckGo(sq);
      allResults.push(...results);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Step 3: Extract content from top results
    const sources: ResearchSource[] = [];
    for (const r of unique.slice(0, 8)) {
      const content = await extractContent(r.url);
      if (content.length > 200) {
        sources.push({
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          content: content.slice(0, 3000),
        });
      }
    }
    run.sources = sources;
    saveRun(run);

    // Step 4: Synthesize report
    const sourcesText = sources.map((s, i) =>
      `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content}\n`
    ).join('\n---\n');

    const synthesisPrompt = `You are an expert research analyst. Synthesize the following sources into a comprehensive, well-structured research report.

ORIGINAL QUERY: "${query}"

SOURCES:
${sourcesText}

Write a structured report in Markdown with:
1. Executive Summary (3-5 bullet points)
2. Key Findings (organized by theme)
3. Detailed Analysis
4. Sources Cited (numbered list with URLs)

Be factual, cite sources using [Source N] format, and highlight conflicting information if present.`;

    const report = await callLLM(synthesisPrompt, companyId);
    run.report = report;
    run.status = 'done';
    run.completedAt = new Date().toISOString();
    saveRun(run);

    return run;
  } catch (e: any) {
    run.status = 'error';
    run.error = e.message;
    saveRun(run);
    throw e;
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

function getRunPath(run: ResearchRun): string {
  const dir = path.join(RESEARCH_DIR, run.companyId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${run.id}.json`);
}

function saveRun(run: ResearchRun): void {
  const p = getRunPath(run);
  fs.writeFileSync(p, JSON.stringify(run, null, 2));
}

export function loadRun(companyId: string, runId: string): ResearchRun | null {
  const p = path.join(RESEARCH_DIR, companyId, `${runId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function listRuns(companyId: string): ResearchRun[] {
  const dir = path.join(RESEARCH_DIR, companyId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteRun(companyId: string, runId: string): boolean {
  const p = path.join(RESEARCH_DIR, companyId, `${runId}.json`);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}
