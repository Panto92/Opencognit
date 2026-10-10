import { Router } from 'express';
import { db } from '../db/client.js';
import { settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptSetting } from '../utils/crypto.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/api/onboarding/generate-team', authMiddleware, async (req, res) => {
  const { businessDescription, language = 'de', apiKeys: inlineKeys } = req.body;
  if (!businessDescription?.trim()) return res.status(400).json({ error: 'businessDescription required' });

  const inlineOR = inlineKeys?.openrouter?.trim();
  const inlineAnthropic = inlineKeys?.anthropic?.trim();
  const inlineOpenAI = inlineKeys?.openai?.trim();
  const inlineOllamaUrl = inlineKeys?.ollamaUrl?.trim();
  const inlineOllamaModel = inlineKeys?.ollamaModel?.trim();

  const orKey = db.select().from(settings).where(eq(settings.key, 'openrouter_api_key')).get();
  const anthropicKey = db.select().from(settings).where(eq(settings.key, 'anthropic_api_key')).get();
  const ollamaUrlRow = db.select().from(settings).where(eq(settings.key, 'ollama_base_url')).get();
  const ollamaModelRow = db.select().from(settings).where(eq(settings.key, 'ollama_default_model')).get();

  const effectiveOR = inlineOR || (orKey?.value ? decryptSetting('openrouter_api_key', orKey.value) : '');
  const effectiveAnthropic = inlineAnthropic || (anthropicKey?.value ? decryptSetting('anthropic_api_key', anthropicKey.value) : '');
  const effectiveOllamaUrl = inlineOllamaUrl || (ollamaUrlRow?.value ? decryptSetting('ollama_base_url', ollamaUrlRow.value) : '');
  const effectiveOllamaModel = inlineOllamaModel || (ollamaModelRow?.value ? decryptSetting('ollama_default_model', ollamaModelRow.value) : '');

  let apiKey = '';
  let model = 'openrouter/auto';
  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let isOllama = false;

  let agentVerbindungsTyp = 'openrouter';
  let agentDefaultModel = 'openrouter/auto';

  if (effectiveOR) {
    apiKey = effectiveOR;
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://opencognit.mytherrablockchain.org';
    model = 'openrouter/auto';
    agentVerbindungsTyp = 'openrouter';
    agentDefaultModel = 'openrouter/auto';
  } else if (effectiveAnthropic) {
    apiKey = effectiveAnthropic;
    endpoint = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    model = 'claude-3-5-haiku-20241022';
    agentVerbindungsTyp = 'anthropic';
    agentDefaultModel = 'claude-3-haiku-20240307';
  } else if (inlineOpenAI) {
    apiKey = inlineOpenAI;
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    model = 'gpt-4o-mini';
    agentVerbindungsTyp = 'openai';
    agentDefaultModel = 'gpt-4o-mini';
  } else if (effectiveOllamaUrl && effectiveOllamaModel) {
    const base = effectiveOllamaUrl.endsWith('/') ? effectiveOllamaUrl : effectiveOllamaUrl + '/';
    endpoint = `${base}api/chat`;
    model = effectiveOllamaModel;
    isOllama = true;
    agentVerbindungsTyp = 'ollama';
    agentDefaultModel = effectiveOllamaModel;
  } else {
    const defaultTeams = buildDefaultTeam(businessDescription, language);
    return res.json({ team: defaultTeams, source: 'default' });
  }

  const isDE = language === 'de';
  const systemPrompt = isDE
    ? `Du bist ein Unternehmensberater der KI-Agenten-Teams für kleine und mittlere Unternehmen zusammenstellt.\nAnalysiere die Geschäftsbeschreibung und erstelle ein optimales Team aus 3-5 KI-Agenten.\nAntworte NUR mit einem JSON-Objekt, kein anderer Text.`
    : `You are a business consultant designing AI agent teams for small and medium businesses.\nAnalyze the business description and create an optimal team of 3-5 AI agents.\nRespond ONLY with a JSON object, no other text.`;

  const userPrompt = isDE
    ? `Geschäftsbeschreibung: "${businessDescription}"\n\nErstelle ein KI-Agenten-Team. Antworte mit folgendem JSON:\n{\n  "companyGoal": "Kurzes übergeordnetes Ziel in einem Satz",\n  "agents": [\n    {\n      "name": "Vorname des Agenten",\n      "rolle": "Rollenbezeichnung (kurz)",\n      "faehigkeiten": "Komma-getrennte Fähigkeiten",\n      "verbindungsTyp": "openrouter",\n      "zyklusIntervallSek": 300,\n      "systemPromptHint": "1-2 Sätze was dieser Agent hauptsächlich tut"\n    }\n  ]\n}`
    : `Business description: "${businessDescription}"\n\nCreate an AI agent team. Reply with this JSON:\n{\n  "companyGoal": "Short overarching goal in one sentence",\n  "agents": [\n    {\n      "name": "Agent first name",\n      "rolle": "Role title (short)",\n      "faehigkeiten": "Comma-separated skills",\n      "verbindungsTyp": "openrouter",\n      "zyklusIntervallSek": 300,\n      "systemPromptHint": "1-2 sentences what this agent mainly does"\n    }\n  ]\n}`;

  try {
    let responseText = '';
    if (endpoint.includes('anthropic.com')) {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      const d = await r.json() as any;
      responseText = d.content?.[0]?.text ?? '';
    } else if (isOllama) {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
        signal: AbortSignal.timeout(120000),
      });
      const d = await r.json() as any;
      responseText = d.message?.content ?? d.choices?.[0]?.message?.content ?? '';
    } else {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
      });
      const d = await r.json() as any;
      responseText = d.choices?.[0]?.message?.content ?? '';
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const team = JSON.parse(jsonMatch[0]);
    if (Array.isArray(team.agents)) {
      team.agents = team.agents.map((a: any) => ({
        ...a,
        verbindungsTyp: agentVerbindungsTyp,
        verbindungsConfig: JSON.stringify({ model: agentDefaultModel }),
      }));
    }
    res.json({ team, source: 'ai', verbindungsTyp: agentVerbindungsTyp, defaultModel: agentDefaultModel });
  } catch (e: any) {
    res.json({ team: buildDefaultTeam(businessDescription, language), source: 'default', warning: e.message });
  }
});

// ─── API Key Validation ──────────────────────────────────────────────────────

router.post('/api/onboarding/validate-key', authMiddleware, async (req, res) => {
  const { key, provider } = req.body;
  if (!key?.trim() || !provider) return res.status(400).json({ valid: false, error: 'key and provider required' });

  try {
    if (provider === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key.trim()}` },
        signal: AbortSignal.timeout(8000),
      });
      return res.json({ valid: r.status === 200 });
    }

    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
        signal: AbortSignal.timeout(8000),
      });
      // 401 = invalid key; 400 with validation error could also mean invalid key format
      return res.json({ valid: r.status !== 401 && r.status !== 403 });
    }

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models?limit=1', {
        headers: { Authorization: `Bearer ${key.trim()}` },
        signal: AbortSignal.timeout(8000),
      });
      return res.json({ valid: r.status === 200 });
    }

    return res.json({ valid: false, error: 'unsupported provider' });
  } catch (e: any) {
    return res.json({ valid: false, error: e.message });
  }
});

function buildDefaultTeam(description: string, language: string): any {
  const lower = description.toLowerCase();
  const isDE = language === 'de';

  const hasMarketing = /market|seo|content|social|ads|blog|werbung|social media|linkedin|outreach|kaltakquise|cold.?outreach|nachrichten|personali/i.test(lower);
  const hasFinance = /buchhal|steuer|finan|invoice|rechnung|kosten|budget/i.test(lower);
  const hasSales = /verkauf|sales|kunde|client|crm|angebot|kaltakquise|outreach|linkedin|lead|akquise|b2b|prospect/i.test(lower);
  const hasSupport = /support|kundenservice|helpdesk|service|hilfe/i.test(lower);
  const hasTech = /software|entwickl|code|api|tool|saas|app|plattform|automatisier|ki.?tool|ai.?tool/i.test(lower);

  const agents: any[] = [
    {
      name: isDE ? 'Max' : 'Max',
      rolle: isDE ? 'Projektmanager' : 'Project Manager',
      faehigkeiten: isDE ? 'Planung, Koordination, Strategie, Überblick' : 'Planning, Coordination, Strategy',
      verbindungsTyp: 'openrouter',
      zyklusIntervallSek: 300,
      systemPromptHint: isDE ? 'Koordiniert das Team und priorisiert Aufgaben.' : 'Coordinates the team and prioritizes tasks.',
    }
  ];

  if (hasMarketing) agents.push({
    name: isDE ? 'Lisa' : 'Lisa',
    rolle: isDE ? 'Marketing Expertin' : 'Marketing Expert',
    faehigkeiten: isDE ? 'SEO, Content, Social Media, Texten' : 'SEO, Content, Social Media, Copywriting',
    verbindungsTyp: 'openrouter',
    zyklusIntervallSek: 600,
    systemPromptHint: isDE ? 'Erstellt Marketingmaterialien und analysiert Online-Präsenz.' : 'Creates marketing materials and analyzes online presence.',
  });

  if (hasFinance) agents.push({
    name: isDE ? 'Felix' : 'Felix',
    rolle: isDE ? 'Finanz-Assistent' : 'Finance Assistant',
    faehigkeiten: isDE ? 'Buchführung, Rechnungen, Kostenanalyse' : 'Bookkeeping, Invoices, Cost Analysis',
    verbindungsTyp: 'openrouter',
    zyklusIntervallSek: 900,
    systemPromptHint: isDE ? 'Überwacht Ausgaben und erstellt Finanzberichte.' : 'Monitors expenses and creates financial reports.',
  });

  if (hasSales) agents.push({
    name: isDE ? 'Sophie' : 'Sophie',
    rolle: isDE ? 'Vertriebs-Assistentin' : 'Sales Assistant',
    faehigkeiten: isDE ? 'CRM, Angebote, Kundenpflege, Nachfassen' : 'CRM, Proposals, Client Relations',
    verbindungsTyp: 'openrouter',
    zyklusIntervallSek: 600,
    systemPromptHint: isDE ? 'Unterstützt im Vertrieb und pflegt Kundenbeziehungen.' : 'Supports sales and maintains client relationships.',
  });

  if (hasTech) agents.push({
    name: isDE ? 'Alex' : 'Alex',
    rolle: isDE ? 'Produkt-Spezialist' : 'Product Specialist',
    faehigkeiten: isDE ? 'Produktentwicklung, API, Automatisierung, Testing' : 'Product, API, Automation, Testing',
    verbindungsTyp: 'openrouter',
    zyklusIntervallSek: 600,
    systemPromptHint: isDE ? 'Analysiert Produktfeedback und koordiniert technische Verbesserungen.' : 'Analyzes product feedback and coordinates technical improvements.',
  });

  if (hasSupport || agents.length < 3) agents.push({
    name: isDE ? 'Tom' : 'Tom',
    rolle: isDE ? 'Assistent' : 'Assistant',
    faehigkeiten: isDE ? 'Recherche, E-Mail, Texte, Dokumentation' : 'Research, Email, Writing, Documentation',
    verbindungsTyp: 'openrouter',
    zyklusIntervallSek: 600,
    systemPromptHint: isDE ? 'Erledigt allgemeine Assistenzaufgaben.' : 'Handles general assistant tasks.',
  });

  const goal = isDE
    ? `${description.slice(0, 80).trim()}…`
    : `${description.slice(0, 80).trim()}…`;

  return {
    companyGoal: goal,
    agents: agents.slice(0, 5),
  };
}

export default router;
