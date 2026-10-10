import type { ReactNode } from 'react';
import { ThinkingOrb, type OrbSize, type OrbState } from 'thinking-orbs';

// What an agent is doing, shown as an animated orb — the visible "thinking" of the UI.
// Claude Code does not always stream its reasoning text, but it always streams what it
// DOES (read, edit, run…), so the orb follows the activity rather than the thought.

export type AgentActivity =
  | 'planning'   // CEO decomposes a goal
  | 'reading'    // Read / Grep / Glob / web search
  | 'editing'    // Write / Edit
  | 'running'    // Bash, tests
  | 'writing'    // composing the text answer
  | 'waiting'    // needs the human
  | 'talking'    // board / other agents (MCP)
  | 'working'    // busy, nothing more specific known
  | 'idle';

const ORB_FOR: Record<AgentActivity, OrbState> = {
  planning: 'shaping',
  reading: 'searching',
  editing: 'weaving',
  running: 'solving',
  writing: 'composing',
  waiting: 'listening',
  talking: 'connecting',
  working: 'working',
  idle: 'breathing',
};

export const ACTIVITY_LABEL: Record<AgentActivity, { de: string; en: string }> = {
  planning: { de: 'plant', en: 'planning' },
  reading: { de: 'liest', en: 'reading' },
  editing: { de: 'ändert Code', en: 'editing code' },
  running: { de: 'führt aus', en: 'running' },
  writing: { de: 'schreibt', en: 'writing' },
  waiting: { de: 'wartet auf dich', en: 'waiting for you' },
  talking: { de: 'stimmt sich ab', en: 'coordinating' },
  working: { de: 'arbeitet', en: 'working' },
  idle: { de: 'bereit', en: 'ready' },
};

/** Maps a Claude Code tool name (from the stream) to an activity. */
export function activityForTool(tool: string): AgentActivity {
  if (/^(Read|Grep|Glob|LS|WebSearch|WebFetch|NotebookRead)$/.test(tool)) return 'reading';
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) return 'editing';
  if (/^(Bash|BashOutput)$/.test(tool)) return 'running';
  if (tool.startsWith('mcp__opencognit')) return 'talking';
  if (/^(TodoWrite|ExitPlanMode|Task)$/.test(tool)) return 'planning';
  return 'working';
}

const GOLD = '#c5a059';
const GREY = '#8b8680';

export function AgentOrb({ activity, size = 32, label }: { activity: AgentActivity; size?: OrbSize; label?: string }) {
  return (
    <span role="img" aria-label={label ?? activity} style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, flexShrink: 0 }}>
      <ThinkingOrb
        state={ORB_FOR[activity]}
        size={size}
        theme="dark"
        color={activity === 'idle' ? GREY : GOLD}
        speed={activity === 'idle' ? 0.6 : 1}
      />
    </span>
  );
}

/** Orb + text in a pill — "Claude Code · ändert Code…" */
export function ActivityPill({ activity, lang = 'de', detail }: { activity: AgentActivity; lang?: string; detail?: ReactNode }) {
  const text = ACTIVITY_LABEL[activity][lang === 'de' ? 'de' : 'en'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: 34, padding: '0 0.9rem 0 0.25rem',
      borderRadius: 999, background: 'rgba(29,29,29,0.42)',
      boxShadow: 'inset 0 0 0 1px rgba(44,47,54,0.31), inset 0 0 50px 0 rgba(255,255,255,0.012)',
      fontSize: '0.8125rem', color: 'var(--oc-text-2)', whiteSpace: 'nowrap', maxWidth: '100%',
    }}>
      <AgentOrb activity={activity} size={20} label={text} />
      <span style={{ color: activity === 'waiting' ? 'var(--oc-gold)' : undefined }}>{text}{activity !== 'idle' && activity !== 'waiting' ? '…' : ''}</span>
      {detail && <span style={{ color: 'var(--oc-text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</span>}
    </span>
  );
}
