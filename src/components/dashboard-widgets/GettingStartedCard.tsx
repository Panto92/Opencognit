import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Bot, PlayCircle, ListTodo, MonitorPlay, Sparkles, CheckCircle2, BookOpen, ChevronDown, ChevronUp, X as XIcon } from 'lucide-react';

export function GettingStartedCard({
  companyId,
  hasAgents,
  hasCycle,
  hasTasks,
  hasDoneTasks,
  lang,
}: {
  companyId: string;
  hasAgents: boolean;
  hasCycle: boolean;
  hasTasks: boolean;
  hasDoneTasks: boolean;
  lang: string;
}) {
  const navigate = useNavigate();
  const de = lang === 'de';
  const storageKey = `onboarding_dismissed_${companyId}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');
  const [howOpen, setHowOpen] = useState(false);

  const steps = [
    { done: true, icon: Building2, title: de ? 'Workspace erstellt' : 'Workspace created', desc: de ? 'Dein Unternehmen ist eingerichtet.' : 'Your company is set up.', action: null },
    { done: hasAgents, icon: Bot, title: de ? 'Ersten Agenten anlegen' : 'Create your first agent', desc: de ? 'Gib ihm eine Rolle (z.B. "Entwickler") und wähle ein LLM.' : 'Give it a role (e.g. "Developer") and pick an LLM.', action: { label: de ? 'Agenten erstellen →' : 'Create agent →', to: '/experts' } },
    { done: hasCycle, icon: PlayCircle, title: de ? 'Auto-Zyklus aktivieren' : 'Enable auto-cycle', desc: de ? 'Agent wacht automatisch auf und bearbeitet Aufgaben.' : 'Agent wakes up automatically and processes tasks.', action: { label: de ? 'Agenten öffnen →' : 'Open agents →', to: '/experts' } },
    { done: hasTasks, icon: ListTodo, title: de ? 'Erste Aufgabe erstellen' : 'Create your first task', desc: de ? 'Weise sie einem Agenten zu — er erledigt sie eigenständig.' : 'Assign it to an agent — it will handle it autonomously.', action: { label: de ? 'Aufgabe anlegen →' : 'Create task →', to: '/tasks' } },
    { done: hasDoneTasks, icon: MonitorPlay, title: de ? 'Ergebnis beobachten' : 'Watch it run', desc: de ? 'Im Live Room siehst du live, was deine Agenten gerade tun.' : 'The Live Room shows you live what your agents are doing.', action: { label: de ? 'Live Room öffnen →' : 'Open Live Room →', to: '/war-room' } },
  ];

  const completed = steps.filter(s => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);
  const allDone = completed === steps.length;

  useEffect(() => {
    if (allDone && !dismissed) {
      const t = setTimeout(() => {
        localStorage.setItem(storageKey, '1');
        setDismissed(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [allDone, dismissed, storageKey]);

  if (dismissed) return null;

  const HOW_IT_WORKS_DE = `OpenCognit ist ein KI-Agenten-Betriebssystem. So funktioniert es:

① Company (Workspace)
   Alles lebt in deiner Company: Agenten, Aufgaben, Budget, Erinnerungen.

② Agenten = KI-Mitarbeiter
   Jeder Agent hat eine Rolle (z.B. "Backend Developer"), ist mit einem LLM verbunden (Claude, GPT-4, Ollama…) und hat Skills aus der Skill Library.

③ Aufgaben = Arbeitspakete
   Du (oder ein Orchestrator-Agent) erstellst Aufgaben mit Titel + Beschreibung. Der Agent bekommt sie in seine Inbox.

④ Auto-Zyklus = der Herzschlag
   Alle N Sekunden wacht der Agent auf, liest seine Inbox, denkt nach und handelt — er aktualisiert Tasks, erstellt Sub-Tasks, schreibt Dateien, schickt Nachrichten an Kollegen.

⑤ Orchestrator = Team-Lead
   Ein Orchestrator-Agent delegiert Aufgaben, ruft Meetings ein und koordiniert das Team. Du musst nichts manuell zuweisen.

⑥ Memory + Learning Loop
   Agenten speichern Wissen dauerhaft (Memory) und lernen aus ihrer Arbeit neue Skills (Learning Loop), die beim nächsten Zyklus automatisch eingesetzt werden.`;

  const HOW_IT_WORKS_EN = `OpenCognit is an AI agent operating system. Here's how it works:

① Company (Workspace)
   Everything lives inside your company: agents, tasks, budget, memory.

② Agents = AI workers
   Each agent has a role (e.g. "Backend Developer"), is connected to an LLM (Claude, GPT-4, Ollama…) and has skills from the Skill Library.

③ Tasks = work items
   You (or an orchestrator agent) create tasks with a title + description. The agent receives them in its inbox.

④ Auto-cycle = the heartbeat
   Every N seconds the agent wakes up, reads its inbox, thinks, and acts — it updates tasks, creates sub-tasks, writes files, sends messages to colleagues.

⑤ Orchestrator = team lead
   An orchestrator agent delegates tasks, calls meetings, and coordinates the team. You don't need to assign anything manually.

⑥ Memory + Learning Loop
   Agents store knowledge permanently (Memory) and learn new skills from their work (Learning Loop), which are automatically applied in future cycles.`;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(197,160,89,0.04) 0%, rgba(155,135,200,0.04) 100%)',
      border: '1px solid rgba(197,160,89,0.15)',
      borderRadius: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 0,
            background: 'rgba(197,160,89,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a059',
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f4f4f5' }}>
              {de ? 'Erste Schritte' : 'Getting Started'}
            </div>
            <div style={{ fontSize: 11, color: '#52525b', marginTop: 1 }}>
              {completed}/{steps.length} {de ? 'abgeschlossen' : 'completed'}
              {allDone && <span style={{ color: '#c5a059', marginLeft: 6 }}>✓ {de ? 'Alles bereit!' : 'All done!'}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setHowOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0, padding: '5px 10px', cursor: 'pointer',
              fontSize: 11, color: '#71717a', fontWeight: 600,
            }}
          >
            <BookOpen size={12} />
            {de ? 'Wie funktioniert es?' : 'How does it work?'}
            {howOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            onClick={() => { localStorage.setItem(storageKey, '1'); setDismissed(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 4, display: 'flex' }}
            title={de ? 'Schließen' : 'Dismiss'}
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', margin: '0 24px' }}>
        <div style={{
          height: '100%', borderRadius: 0, width: `${pct}%`,
          background: allDone ? '#c5a059' : 'linear-gradient(90deg, #c5a059, #9b87c8)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isNext = !step.done && steps.slice(0, i).every(s => s.done);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 0,
              background: step.done ? 'rgba(197,160,89,0.04)' : isNext ? 'rgba(255,255,255,0.03)' : 'transparent',
              border: step.done ? '1px solid rgba(197,160,89,0.12)' : isNext ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
              opacity: !step.done && !isNext ? 0.45 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 0, flexShrink: 0,
                background: step.done ? 'rgba(197,160,89,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${step.done ? 'rgba(197,160,89,0.25)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step.done ? '#c5a059' : '#52525b',
              }}>
                {step.done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: step.done ? '#a1a1aa' : '#e4e4e7', textDecoration: step.done ? 'line-through' : 'none', textDecorationColor: '#52525b' }}>
                  {step.title}
                </div>
                {!step.done && (
                  <div style={{ fontSize: 11, color: '#52525b', marginTop: 1 }}>{step.desc}</div>
                )}
              </div>
              {!step.done && step.action && (
                <button
                  onClick={() => navigate(step.action!.to)}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 0,
                    background: isNext ? 'rgba(197,160,89,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isNext ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: isNext ? '#c5a059' : '#52525b',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {step.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {howOpen && (
        <div style={{
          margin: '0 24px 20px',
          padding: '16px 18px',
          borderRadius: 0,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <BookOpen size={12} style={{ color: '#c5a059' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#c5a059', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {de ? 'Wie OpenCognit funktioniert' : 'How OpenCognit works'}
            </span>
          </div>
          <pre style={{
            fontSize: 11, color: '#71717a', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            margin: 0, fontFamily: 'inherit',
          }}>
            {de ? HOW_IT_WORKS_DE : HOW_IT_WORKS_EN}
          </pre>
        </div>
      )}
    </div>
  );
}
