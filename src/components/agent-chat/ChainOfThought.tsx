import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { TextShimmer } from './TextShimmer';
import type { ThinkingStep } from './types';

// A vertical dot-and-line timeline of the
// agent's steps, used live while it works and afterwards as the collapsible "Denkprozess" recap.
// OpenCognit steps are Claude Code tool calls, so the orb follows the tool, not a label guess.
// No remote favicons or other fetches: this runs locally and privately.

function orbStateForStep(step: ThinkingStep): OrbState {
  const t = step.tool ?? '';
  if (/^(Read|Grep|Glob|LS|WebSearch|WebFetch)$/.test(t)) return 'searching';
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(t)) return 'weaving';
  if (/^(Bash|BashOutput)$/.test(t)) return 'solving';
  if (t.startsWith('mcp__opencognit')) return 'connecting';
  if (/^(TodoWrite|Task|ExitPlanMode)$/.test(t)) return 'shaping';
  if (!t) return /schreib|writ|antwort/i.test(step.label) ? 'composing' : 'working';
  return 'working';
}

interface ChainOfThoughtProps {
  steps: ThinkingStep[];
  /** While true the newest step is in progress: orb, shimmer, elapsed seconds, older steps fade. */
  live?: boolean;
}

export const ChainOfThought: React.FC<ChainOfThoughtProps> = ({ steps, live = false }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  // A long tool round otherwise looks like a hang — count from when the live timeline appears.
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const anyRunning = steps.some((s) => s.status === 'running');
  useEffect(() => {
    if (!live || !anyRunning) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [live, anyRunning]);

  const toggle = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isOpen = openIds.has(step.id);
        const hasDetail = !!step.summary;
        // While live, keep only the two newest steps on screen; older ones shrink away instead
        // of piling up. The full list stays in state for the recap.
        const isFading = live && steps.length - 1 - idx >= 2;
        return (
          <div
            key={step.id}
            className={`relative pl-6 transition-all duration-500 ease-in-out overflow-hidden ${isFading ? 'max-h-0 opacity-0 pb-0' : 'max-h-60 opacity-100 pb-3 last:pb-0'}`}
          >
            {!isLast && <span className="absolute left-[7px] top-3 bottom-0 w-px bg-white/[0.08]" />}
            <span className="absolute left-0 top-1 w-3.5 h-3.5 flex items-center justify-center">
              {step.status === 'running' ? (
                <span className="relative flex items-center justify-center w-5 h-5">
                  <span className="absolute inset-0 rounded-full bg-brand-500/25 animate-ping motion-reduce:animate-none" />
                  <ThinkingOrb state={orbStateForStep(step)} size={20} theme="dark" color="#c5a059" />
                </span>
              ) : step.status === 'error' ? (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-400/50 flex items-center justify-center">
                  <X size={7} className="text-red-400" />
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
                  <Check size={7} className="text-emerald-400" />
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={() => hasDetail && toggle(step.id)}
              disabled={!hasDetail}
              aria-expanded={hasDetail ? isOpen : undefined}
              className={`flex items-center gap-1.5 text-[12.5px] text-left max-w-full ${hasDetail ? 'cursor-pointer group' : 'cursor-default'}`}
            >
              {step.status === 'running' ? (
                <>
                  <TextShimmer duration={1.4} spread={30} className="text-[12.5px] truncate">{step.label}</TextShimmer>
                  {live && isLast && elapsed >= 3 && (
                    <span className="text-[11px] tabular-nums text-white/35">{elapsed} s</span>
                  )}
                </>
              ) : (
                <span className={`truncate ${step.status === 'error' ? 'text-red-400/70' : 'text-white/45 group-hover:text-white/70 transition-colors'}`}>
                  {step.label}
                </span>
              )}
              {hasDetail && (
                <ChevronDown size={11} className={`shrink-0 text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {hasDetail && isOpen && (
              <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg bg-black/30 border border-white/[0.06] p-2.5 font-mono text-[11px] leading-relaxed text-white/55 whitespace-pre-wrap animate-in fade-in slide-in-from-top-1 duration-150">
                {step.summary}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChainOfThought;
