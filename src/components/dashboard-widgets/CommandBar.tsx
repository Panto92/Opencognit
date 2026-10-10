import { useState, useRef } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { LiveAgent } from './shared';

export function CommandBar({ agents, companyId, lang }: { agents: LiveAgent[]; companyId: string; lang: string }) {
  const de = lang === 'de';
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const orchestrator = agents.find(a => (a as any).isOrchestrator) || agents[0];

  const submit = async () => {
    if (!command.trim() || !orchestrator || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem('opencognit_token');
      const resp = await fetch(`/api/experten/${orchestrator.id}/chat/direct`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-unternehmen-id': companyId,
        },
        body: JSON.stringify({ nachricht: command }),
      });
      const data = await resp.json();
      setResult({ text: data.reply || (de ? 'Erledigt.' : 'Done.'), ok: true });
      setCommand('');
    } catch (e: any) {
      setResult({ text: e.message, ok: false });
    }
    setLoading(false);
  };

  if (!orchestrator) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.625rem 0.875rem',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${focused ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 0,
        transition: 'border-color 0.2s',
      }}>
        {/* Agent avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 0, flexShrink: 0,
          background: `${orchestrator.avatarFarbe}18`,
          border: `1px solid ${orchestrator.avatarFarbe}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6875rem', fontWeight: 700, color: orchestrator.avatarFarbe,
        }}>
          {orchestrator.avatar || orchestrator.name.slice(0, 2).toUpperCase()}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => { setCommand(e.target.value); setResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={de
            ? `${orchestrator.name} beauftragen… (z.B. "Erstelle einen täglichen Report-Task für das Marketing-Team")`
            : `Task ${orchestrator.name}… (e.g. "Create a daily report task for the marketing team")`}
          style={{
            flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
            color: '#e4e4e7', fontSize: '0.875rem', cursor: 'text',
          }}
          disabled={loading}
        />

        <button
          onClick={submit}
          disabled={!command.trim() || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 0.875rem', borderRadius: 0, border: 'none',
            background: command.trim() && !loading ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.04)',
            color: command.trim() && !loading ? '#c5a059' : '#3f3f46',
            fontSize: '0.75rem', fontWeight: 700, cursor: command.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {loading
            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            : <Zap size={12} />
          }
          {loading ? (de ? 'Sendet…' : 'Sending…') : (de ? 'Senden' : 'Send')}
        </button>
      </div>

      {/* Inline result */}
      {result && (
        <div style={{
          padding: '0.625rem 0.875rem', borderRadius: 0,
          background: result.ok ? 'rgba(197,160,89,0.04)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${result.ok ? 'rgba(197,160,89,0.15)' : 'rgba(239,68,68,0.15)'}`,
          fontSize: '0.8125rem', color: result.ok ? '#94a3b8' : '#fca5a5',
          lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 200, overflowY: 'auto',
        }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: result.ok ? '#c5a059' : '#ef4444', display: 'block', marginBottom: '0.25rem' }}>
            {orchestrator.name}
          </span>
          {result.text}
        </div>
      )}
    </div>
  );
}
