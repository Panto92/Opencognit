import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

export function DailyBriefingWidget({ unternehmenId, lang }: { unternehmenId: string; lang: string }) {
  const de = lang === 'de';
  const cacheKey = `briefing_${unternehmenId}_${new Date().toDateString()}`;
  const [briefing, setBriefing] = useState<string | null>(() => localStorage.getItem(cacheKey));
  const [loading, setLoading] = useState(false);
  const [displayed, setDisplayed] = useState<string>('');
  const [source, setSource] = useState<'ai' | 'template' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect
  useEffect(() => {
    if (!briefing) return;
    setDisplayed('');
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(briefing.slice(0, i));
      if (i >= briefing.length) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 12);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [briefing]);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setBriefing(null);
    setDisplayed('');
    try {
      const token = localStorage.getItem('opencognit_token');
      const resp = await fetch(`/api/unternehmen/${unternehmenId}/briefing`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ language: lang }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setBriefing(data.briefing);
        setSource(data.source);
        localStorage.setItem(cacheKey, data.briefing);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div style={{
      padding: '1.125rem 1.5rem',
      background: 'rgba(197,160,89,0.03)',
      // backdropFilter removed
      borderRadius: 0,
      border: '1px solid rgba(197,160,89,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: briefing ? '0.75rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 0,
            background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} style={{ color: '#c5a059' }} />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#d4d4d8' }}>
            {de ? 'CEO Tagesbriefing' : 'CEO Daily Briefing'}
          </span>
          {source === 'ai' && (
            <span style={{
              padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.5625rem',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: 'rgba(197,160,89,0.1)', color: '#c5a059',
              border: '1px solid rgba(197,160,89,0.2)',
            }}>AI</span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 0.875rem', borderRadius: 0, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)',
            color: '#c5a059', fontSize: '0.75rem', fontWeight: 600,
            opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
          }}
        >
          {loading
            ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> {de ? 'Generiere…' : 'Generating…'}</>
            : <><RefreshCw size={12} /> {briefing ? (de ? 'Neu generieren' : 'Regenerate') : (de ? 'Briefing generieren' : 'Generate Briefing')}</>
          }
        </button>
      </div>

      {displayed && (
        <p style={{
          margin: 0, fontSize: '0.875rem', lineHeight: 1.65,
          color: '#94a3b8', fontStyle: 'normal',
        }}>
          {displayed}
          {displayed.length < (briefing?.length ?? 0) && (
            <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#c5a059', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom', marginLeft: 2 }} />
          )}
        </p>
      )}

      {!briefing && !loading && (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155', fontStyle: 'italic' }}>
          {de ? 'Klicke "Briefing generieren" für eine KI-Zusammenfassung des heutigen Status.' : 'Click "Generate Briefing" for an AI summary of today\'s company status.'}
        </p>
      )}
    </div>
  );
}
