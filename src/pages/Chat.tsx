import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PanelLeft, Plus, Search, Pin, PinOff, Pencil, Trash2, MessageSquare, ChevronDown, Hammer, Bug, ScanSearch, FlaskConical, BookOpen, Recycle,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useCompany } from '../hooks/useCompany';
import { useAuth } from '../hooks/useAuth';
import { apiAgents } from '@/api/agents';
import type { Experte } from '@/api/types';
import { AgentOrb } from '../components/design-system';
import AnimatedSphere from '../components/agent-chat/AnimatedSphere';
import ChatMessage from '../components/agent-chat/ChatMessage';
import ChatInput, { type ChatInputHandle, type PastedContent } from '../components/agent-chat/ChatInput';
import type { ChatMessage as Message, Conversation, ThinkingStep } from '../components/agent-chat/types';
import { streamChat, stepLabel, ChatUnavailableError } from '../components/agent-chat/streamChat';

// Agent chat — conversation sidebar, header with the agent, welcome screen with sphere and quick
// actions, messages with the live reasoning timeline, Claude-style input.
// Each conversation runs on a real coding CLI (POST /api/agents/:id/cli-chat) — Claude Code resumes
// its session per message; other CLIs get the conversation so far as plain text with every message.
// The list and the rendered messages are kept per browser. Chat turns are read-only — changes to
// code go through tasks with review and approval.
// Ported from the relaunch's Chat page; project picker, roles API and Direct mode are
// relaunch-only and intentionally not part of this port.

const STORE_KEY = 'oc_agent_chat_v1';

interface Stored { conversations: Conversation[]; messages: Record<string, Message[]> }

function loadStore(): Stored {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable or corrupt */ }
  return { conversations: [], messages: {} };
}
function saveStore(s: Stored) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const fill = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);

export function Chat() {
  const { language, t } = useI18n();
  const de = language === 'de';
  const location = useLocation();
  const { aktivesUnternehmen } = useCompany();
  const { benutzer } = useAuth();
  const firstName = (benutzer?.name ?? '').trim().split(/\s+/)[0] || '';

  const [store, setStore] = useState<Stored>(loadStore);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Experte[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [agentMenu, setAgentMenu] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ThinkingStep[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveStore(store), [store]);

  useEffect(() => {
    if (!aktivesUnternehmen) return;
    apiAgents.liste(aktivesUnternehmen.id).then((list) => {
      setAgents(list);
      // The CEO (orchestrator) first, else an agent whose CLI can chat, else the first agent.
      const pick = list.find((a) => a.isOrchestrator) ?? list.find((a) => isChatCli(a.verbindungsTyp)) ?? list[0];
      // An agent handed over from elsewhere (agent view → "Open chat") wins over the default pick.
      const wanted = (location.state as { agentId?: string } | null)?.agentId;
      const handed = wanted && list.some((a) => a.id === wanted) ? wanted : '';
      setAgentId((cur) => handed || cur || pick?.id || '');
    }).catch(() => setAgents([]));
  }, [aktivesUnternehmen?.id]);

  const agent = agents.find((a) => a.id === agentId);
  const activeConv = activeId ? store.conversations.find((c) => c.id === activeId) : undefined;
  const messages = activeId ? store.messages[activeId] ?? [] : [];
  const started = messages.length > 0;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, liveSteps.length]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const greeting = () => {
    const h = new Date().getHours();
    const base = h < 5 || h >= 22 ? t.chat.greetingLate : h < 12 ? t.chat.greetingMorning : h < 18 ? t.chat.greetingDay : t.chat.greetingEvening;
    return firstName ? `${firstName}, ${base}` : base.charAt(0).toUpperCase() + base.slice(1);
  };

  const quickActions = [
    { icon: <Hammer size={14} />, label: t.chat.quickBuild, prompt: t.chat.quickBuildPrompt },
    { icon: <Bug size={14} />, label: t.chat.quickFix, prompt: t.chat.quickFixPrompt },
    { icon: <ScanSearch size={14} />, label: t.chat.quickReview, prompt: t.chat.quickReviewPrompt },
    { icon: <FlaskConical size={14} />, label: t.chat.quickTests, prompt: t.chat.quickTestsPrompt },
    { icon: <BookOpen size={14} />, label: t.chat.quickExplain, prompt: t.chat.quickExplainPrompt },
    { icon: <Recycle size={14} />, label: t.chat.quickRefactor, prompt: t.chat.quickRefactorPrompt },
  ];

  const newChat = () => { setActiveId(null); setInput(''); inputRef.current?.focusEnd(); };

  const patchMessage = (convId: string, msgId: string, patch: (m: Message) => Message) =>
    setStore((s) => ({ ...s, messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).map((m) => (m.id === msgId ? patch(m) : m)) } }));

  const send = async ({ message, pasted }: { message: string; pasted: PastedContent[] }) => {
    const text = [message.trim(), ...pasted.map((p) => '```\n' + p.content + '\n```')].filter(Boolean).join('\n\n');
    if (!text || streamingId || !agentId) return;
    const now = new Date().toISOString();
    // Decide the ids up front: state updaters run later, so ids created inside them would not
    // exist yet when we switch to the conversation.
    const isNew = !activeId;
    const convId = activeId ?? uid();
    const answerId = uid();
    const sessionId = isNew ? undefined : store.conversations.find((c) => c.id === convId)?.sessionId;
    setStore((s) => {
      const next = { conversations: [...s.conversations], messages: { ...s.messages } };
      if (isNew) {
        next.conversations.unshift({ id: convId, title: message.trim().slice(0, 60) || t.chat.newChat, agentId, updatedAt: now });
      } else {
        next.conversations = next.conversations.map((c) => (c.id === convId ? { ...c, updatedAt: now } : c));
      }
      next.messages[convId] = [
        ...(next.messages[convId] ?? []),
        { id: uid(), role: 'user', content: text, createdAt: now },
        { id: answerId, role: 'assistant', content: '', createdAt: now, streaming: true },
      ];
      return next;
    });
    setActiveId(convId);
    setStreamingId(answerId);
    setLiveSteps([]);

    const controller = new AbortController();
    abortRef.current = controller;
    const steps: ThinkingStep[] = [];
    const texts: string[] = [];
    let outcome: { status: string; error: string | null } = { status: 'completed', error: null };
    const syncSteps = () => setLiveSteps(steps.map((st) => ({ ...st })));
    try {
      await streamChat(agentId, {
        message: text, sessionId,
        // CLIs without session resume (kimi/codex/gemini) get the conversation so far as text.
        history: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 20_000) })),
      }, (e) => {
        if (e.type === 'session') {
          setStore((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === convId ? { ...c, sessionId: e.sessionId } : c)) }));
        } else if (e.type === 'step') {
          steps.push({ id: e.id, tool: e.tool, label: stepLabel(e.tool, e.input, de), status: 'running' });
          syncSteps();
        } else if (e.type === 'step_done') {
          const st = steps.find((x) => x.id === e.id);
          if (st) { st.status = e.isError ? 'error' : 'completed'; st.summary = e.output.trim() || undefined; }
          syncSteps();
        } else if (e.type === 'text') {
          texts.push(e.text);
          patchMessage(convId, answerId, (m) => ({ ...m, content: texts.join('\n\n') }));
        } else if (e.type === 'done') {
          outcome = { status: e.status, error: e.error };
        }
      }, controller.signal);
    } catch (err: any) {
      outcome = controller.signal.aborted
        ? { status: 'aborted', error: null }
        : err instanceof ChatUnavailableError
          ? { status: 'unavailable', error: err.message }
          : { status: 'failed', error: err?.message ?? String(err) };
    }

    // Finish the message: keep the steps as the collapsible recap, add a note if something went wrong.
    const note =
      outcome.status === 'completed' ? '' :
      outcome.status === 'aborted' ? t.chat.stopped :
      outcome.status === 'rate_limited' ? fill(t.chat.rateLimited, { error: outcome.error ?? '' }) :
      outcome.status === 'unavailable' ? fill(t.chat.unavailable, { error: outcome.error ?? '' }) :
      fill(t.chat.errorNote, { error: outcome.error ?? (de ? 'unbekannt' : 'unknown') });
    const finalSteps = steps.map((st) => (st.status === 'running' ? { ...st, status: outcome.status === 'completed' ? 'completed' as const : 'error' as const } : st));
    patchMessage(convId, answerId, (m) => ({
      ...m,
      streaming: false,
      steps: finalSteps,
      content: [texts.join('\n\n'), note].filter(Boolean).join('\n\n'),
    }));
    setStreamingId(null);
    setLiveSteps([]);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const togglePin = (id: string) => setStore((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) }));
  const rename = (id: string) => {
    const title = editingTitle.trim();
    if (title) setStore((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) }));
    setEditingId(null);
  };
  const remove = (id: string) => {
    if (!confirm(t.chat.deleteConfirm)) return;
    setStore((s) => {
      const { [id]: _, ...rest } = s.messages;
      return { conversations: s.conversations.filter((c) => c.id !== id), messages: rest };
    });
    if (activeId === id) setActiveId(null);
  };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = store.conversations.filter((c) => !q || c.title.toLowerCase().includes(q));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const out: { label: string; items: Conversation[] }[] = [];
    const push = (label: string, items: Conversation[]) => items.length && out.push({ label, items });
    push(t.chat.pinned, list.filter((c) => c.pinned));
    const rest = list.filter((c) => !c.pinned);
    push(t.chat.today, rest.filter((c) => new Date(c.updatedAt) >= today));
    push(t.chat.yesterday, rest.filter((c) => new Date(c.updatedAt) >= yesterday && new Date(c.updatedAt) < today));
    push(t.chat.older, rest.filter((c) => new Date(c.updatedAt) < yesterday));
    return out;
  }, [store.conversations, search, t]);

  return (
    <div className="relative flex overflow-hidden rounded-3xl border border-white/5 bg-[#0b0a08]" style={{ height: 'calc(100dvh - 120px)' }}>
      {/* ── Conversation sidebar ── */}
      {sidebarOpen && <div className="md:hidden absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}
      <aside className={`z-50 absolute md:relative inset-y-0 left-0 flex flex-col overflow-hidden border-r border-white/5 bg-[#100e0b] transition-all duration-500 ease-in-out ${sidebarOpen ? 'w-72 shadow-2xl' : 'w-0 border-r-0 opacity-0 pointer-events-none'}`}>
        <div className="w-72 flex flex-col h-full flex-shrink-0">
          <div className="p-4">
            <button type="button" onClick={newChat} className="w-full rounded-lg py-3 px-4 flex items-center gap-2 font-semibold text-[#1a1206] bg-gradient-to-b from-brand-300 to-brand-500 hover:from-brand-200 hover:to-brand-400 transition-colors">
              <Plus size={18} /> {t.chat.newChat}
            </button>
            <div className="relative mt-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.chat.searchChats}
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-2.5 py-1.5 text-[12.5px] text-white/75 placeholder:text-white/30 outline-none focus:border-brand-500/40" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {groups.map((g) => (
              <div key={g.label} className="mb-4">
                <div className="text-[10px] font-semibold text-white/35 mb-2 px-2 tracking-wider">{g.label}</div>
                <div className="space-y-0.5">
                  {g.items.map((c) => (
                    <div key={c.id} onClick={() => { setActiveId(c.id); setSidebarOpen(window.innerWidth >= 768); }}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${activeId === c.id ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}>
                      <MessageSquare size={14} className="flex-shrink-0 text-white/35" />
                      {editingId === c.id ? (
                        <input autoFocus value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onBlur={() => rename(c.id)}
                          onKeyDown={(e) => e.key === 'Enter' && rename(c.id)} onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-b border-brand-500 text-sm text-white outline-none" />
                      ) : <span className="flex-1 truncate text-[13px]">{c.title}</span>}
                      <div className={`items-center gap-0.5 flex-shrink-0 ${c.pinned ? 'flex' : 'hidden group-hover:flex'}`}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); togglePin(c.id); }} title={c.pinned ? t.chat.unpin : t.chat.pin}
                          className={`p-1 rounded hover:bg-white/10 ${c.pinned ? 'text-brand-400' : 'text-white/45 hover:text-white'}`}>
                          {c.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditingTitle(c.title); }} title={t.chat.rename}
                          className="p-1 rounded hover:bg-white/10 text-white/45 hover:text-white"><Pencil size={11} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(c.id); }} title={t.chat.delete}
                          className="p-1 rounded hover:bg-red-900/40 text-white/45 hover:text-red-400"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-white/35 px-2 py-4">{search.trim() ? t.chat.noResults : t.chat.noChatsYet}</p>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 z-10 overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button type="button" onClick={() => setSidebarOpen((o) => !o)} aria-label={t.chat.toggleSidebar}
              className="p-1.5 rounded-lg text-white/45 hover:text-white hover:bg-white/10 transition-colors"><PanelLeft size={16} /></button>
            <div className="relative">
              <button type="button" onClick={() => setAgentMenu((m) => !m)} aria-expanded={agentMenu}
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/5 transition-colors">
                <AgentOrb activity={streamingId ? 'working' : 'idle'} size={32} />
                <span className="font-semibold text-sm text-white/85 truncate max-w-[180px]">{agent?.name ?? t.chat.noAgent}</span>
                {agent && <span className="text-[11px] text-white/35 hidden sm:inline truncate max-w-[140px]">{agent.rolle}</span>}
                <ChevronDown size={14} className="text-white/35" />
              </button>
              {agentMenu && agents.length > 0 && (
                <div className="absolute left-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden" role="menu">
                  {agents.map((a) => (
                    <button key={a.id} type="button" role="menuitem" onClick={() => { setAgentId(a.id); setAgentMenu(false); }}
                      className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-white/5 ${a.id === agentId ? 'bg-white/[0.04]' : ''}`}>
                      <AgentOrb activity={a.status === 'running' ? 'working' : 'idle'} size={20} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white/85 truncate">{a.name}</span>
                        <span className="block text-[11px] text-white/35 truncate">
                          {a.rolle} · {a.verbindungsTyp}{!isChatCli(a.verbindungsTyp) && <span className="text-white/25"> · {t.chat.chatSoon}</span>}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {streamingId ? (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 px-3 py-1.5 text-[11px] font-bold text-brand-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" /> {t.chat.working}
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t.chat.ready}
            </span>
          )}
        </header>

        <div className="flex-1 flex flex-col relative isolate min-w-0 bg-white/[0.02] overflow-hidden">
          {!started ? (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-8 w-full max-w-4xl mx-auto">
              <AnimatedSphere />
              <h1 className="mt-4 mb-2 text-[22px] md:text-[28px] font-semibold tracking-[-0.01em] text-white/90">{agent?.name ?? 'OpenCognit'}</h1>
              <p className="text-sm md:text-base text-white/50 mb-8 text-center max-w-lg">{greeting()}</p>
              <div className="w-full max-w-3xl">
                <ChatInput ref={inputRef} value={input} onChange={setInput} onSend={send} lang={language} loading={!!streamingId} onStop={stop}
                  placeholder={agent?.name ? fill(t.chat.messageTo, { name: agent.name }) : t.chat.messageToDefault} />
                <p className="mt-2 text-center text-[11px] text-white/30">{t.chat.disclaimer}</p>
              </div>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {quickActions.map((a) => (
                  <button key={a.label} type="button" onClick={() => { setInput(a.prompt); inputRef.current?.focusEnd(); }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/65 text-sm hover:bg-white/[0.08] hover:text-white hover:border-brand-500/25 transition-colors">
                    <span className="flex-shrink-0 text-brand-400">{a.icon}</span><span className="truncate">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto py-4">
                  {messages.map((m) => (
                    <ChatMessage key={m.id} message={m} lang={language} agentName={agent?.name}
                      liveSteps={m.id === streamingId ? liveSteps : undefined}
                      onQuickReply={(text) => send({ message: text, pasted: [] })} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>
              <div className="px-4 pb-4 pt-2">
                <div className="max-w-3xl mx-auto">
                  <ChatInput ref={inputRef} value={input} onChange={setInput} onSend={send} lang={language} loading={!!streamingId} onStop={stop}
                    placeholder={agent?.name ? fill(t.chat.messageTo, { name: agent.name }) : t.chat.messageToDefault} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** The chat-capable CLI connection types (mirrors CHAT_CLIS in server/services/cli-chat.ts). */
function isChatCli(connectionType: string): boolean {
  return ['claude-code', 'kimi-cli', 'codex-cli', 'gemini-cli'].includes(connectionType);
}
