import React, { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { ChainOfThought } from './ChainOfThought';
import { TextShimmer } from './TextShimmer';
import { AgentOrb } from '../design-system';
import type { ChatMessage as Message, ThinkingStep } from './types';

// The user's message sits in a bubble; the agent's answer flows on the page like
// ChatGPT/Claude, rendered as Markdown, with room for code blocks.
// (Ported from the relaunch; the Auftrag/plan cards and DirectRun mode are
// relaunch-only and intentionally not part of this port.)

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    const external = href?.startsWith('http://') || href?.startsWith('https://');
    return (
      <a href={href} {...props} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        className="text-brand-400 hover:text-brand-300 hover:underline break-all">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto w-full rounded-xl border border-white/10 bg-black/20">
      <table className="min-w-full divide-y divide-white/10 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04] text-xs font-semibold text-white/60 uppercase tracking-wider">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/5">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>,
  th: ({ children, style }) => <th className="px-4 py-3 text-left font-semibold text-white/80" style={style}>{children}</th>,
  td: ({ children, style }) => <td className="px-4 py-2.5 text-white/70" style={style}>{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 pl-4 border-l-4 border-brand-500 text-white/50 italic bg-white/[0.02] py-2 pr-4 rounded-r-lg">{children}</blockquote>
  ),
  ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-white/75">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1.5 text-white/75">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    if (!className || !className.includes('language-')) {
      return <code className="px-1.5 py-0.5 rounded bg-white/[0.08] text-brand-300 font-mono text-[0.85em] border border-white/5 break-words">{children}</code>;
    }
    return <code className={`${className} font-mono text-[12.5px]`}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-4 p-4 rounded-xl bg-black/40 border border-white/10 overflow-x-auto text-white/85 leading-relaxed">{children}</pre>
  ),
  h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-6 mb-2 tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-white/95 mt-5 mb-2 tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-white/90 mt-4 mb-1.5 tracking-tight">{children}</h3>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-white/80">{children}</p>,
  hr: () => <hr className="my-5 border-white/10" />,
};

interface ChatMessageProps {
  message: Message;
  lang?: string;
  /** Steps of the turn currently running for this message. */
  liveSteps?: ThinkingStep[];
  agentName?: string;
  onQuickReply?: (text: string) => void;
}

export function ChatMessage({ message, lang = 'de', liveSteps, agentName, onQuickReply }: ChatMessageProps) {
  const de = lang === 'de';
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  if (message.role === 'system') {
    return <div className="px-4 py-2 text-center text-xs text-white/35">{message.content}</div>;
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4 md:px-5 py-3">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  const recap = message.steps ?? [];
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  // ── Agent message: plain text on the page background, no bubble — the answer is the page. ──
  return (
    <div className="group/msg px-4 md:px-5 py-4">
      {message.streaming && !message.content && (!liveSteps || liveSteps.length === 0) && (
        <div className="flex items-center gap-2 mb-2" aria-live="polite">
          <AgentOrb activity="working" size={20} />
          <TextShimmer duration={1.6} spread={30} className="text-[13px]">
            {agentName ? `${agentName} ${de ? 'denkt nach …' : 'is thinking …'}` : (de ? 'denkt nach …' : 'thinking …')}
          </TextShimmer>
        </div>
      )}
      {liveSteps && liveSteps.length > 0 && (
        <div className="mb-3"><ChainOfThought live steps={liveSteps} /></div>
      )}

      {message.content && (
        <div className="max-w-none text-[15px] text-white/80">
          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}

      {!message.streaming && message.content && (
        <div className="mt-1.5 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="button" onClick={copy} title={copied ? (de ? 'Kopiert' : 'Copied') : (de ? 'Kopieren' : 'Copy')}
            aria-label={de ? 'Antwort kopieren' : 'Copy answer'}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      )}

      {!message.streaming && message.quickReplies && message.quickReplies.length > 0 && onQuickReply && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.quickReplies.map((reply, i) => (
            <button key={i} type="button" onClick={() => onQuickReply(reply)}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-brand-600/10 text-brand-400 border border-brand-500/20 hover:bg-brand-600/20 hover:border-brand-500/40 transition-colors">
              {reply}
            </button>
          ))}
        </div>
      )}

      {!message.streaming && recap.length > 0 && (
        <div className="mt-2.5">
          <button type="button" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/65 transition-colors">
            {showSteps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{showSteps ? (de ? 'Denkprozess ausblenden' : 'Hide reasoning') : (de ? 'Denkprozess anzeigen' : 'Show reasoning')}</span>
            <span className="text-white/25 ml-0.5">· {recap.length} {de ? 'Schritte' : 'steps'}</span>
          </button>
          {showSteps && <div className="mt-2.5 animate-in fade-in duration-150"><ChainOfThought steps={recap} /></div>}
        </div>
      )}
    </div>
  );
}

export default ChatMessage;
