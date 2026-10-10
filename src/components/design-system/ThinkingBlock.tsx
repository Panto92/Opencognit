import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AgentOrb, type AgentActivity } from './AgentOrb';

// Live "thinking" block for an agent turn: shimmering label with a real seconds counter, and a
// faded window that follows what the agent actually does (tool steps, text, and reasoning text
// when the model provides it). Collapses to "Thought for 14s ▸" once the turn is done.
// Never shows placeholder text: the window only contains lines from the real event stream.

export interface ThinkingLine {
  kind: 'step' | 'text' | 'thinking';
  text: string;
}

interface ThinkingBlockProps {
  agentName: string;
  activity: AgentActivity;
  lines: ThinkingLine[];
  /** ISO time the turn started — the counter is derived from it, so it survives re-renders. */
  startedAt: string;
  /** ISO time the turn ended; while unset the block is live. */
  finishedAt?: string | null;
  lang?: string;
}

const seconds = (from: string, to?: string | null) =>
  Math.max(0, Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000));

export function ThinkingBlock({ agentName, activity, lines, startedAt, finishedAt, lang = 'de' }: ThinkingBlockProps) {
  const de = lang === 'de';
  const live = !finishedAt;
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  // Re-render once a second while live so the counter moves.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  // Follow the newest line (smoothly, unless the user prefers reduced motion).
  useEffect(() => {
    const el = windowRef.current;
    if (!el || (!live && !open)) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [lines.length, live, open]);

  const secs = seconds(startedAt, finishedAt);

  if (!live) {
    return (
      <div className="oc-thinking">
        <button className="oc-thinking-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          {de ? `Gearbeitet · ${secs}s` : `Worked for ${secs}s`}
          <span style={{ color: 'var(--oc-text-3)' }}>· {lines.filter((l) => l.kind === 'step').length} {de ? 'Schritte' : 'steps'}</span>
        </button>
        {open && <div className="oc-thinking-window oc-thinking-window--open" ref={windowRef}>{lines.map(renderLine)}</div>}
      </div>
    );
  }

  return (
    <div className="oc-thinking" aria-live="polite">
      <div className="oc-thinking-head">
        <AgentOrb activity={activity} size={20} />
        <span className="oc-shimmer">{agentName} {de ? 'denkt nach' : 'is thinking'}</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--oc-text-3)', fontVariantNumeric: 'tabular-nums' }}>{secs}s</span>
      </div>
      <div className="oc-thinking-card">
        <div className="oc-thinking-fade oc-thinking-fade--top" />
        <div className="oc-thinking-fade oc-thinking-fade--bottom" />
        <div className="oc-thinking-window" ref={windowRef}>
          {lines.length === 0
            ? <span style={{ color: 'var(--oc-text-3)' }}>{de ? 'startet …' : 'starting …'}</span>
            : lines.map(renderLine)}
        </div>
      </div>
    </div>
  );
}

function renderLine(line: ThinkingLine, i: number) {
  if (line.kind === 'step') {
    return <div key={i} className="oc-thinking-step"><span aria-hidden style={{ color: 'var(--oc-gold)' }}>▸</span> {line.text}</div>;
  }
  return <p key={i} className={line.kind === 'thinking' ? 'oc-thinking-thought' : 'oc-thinking-text'}>{line.text}</p>;
}
