import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../hooks/useCompany';
import { useI18n } from '../i18n';
import {
  Search, Loader2, BookOpen, Clock, Trash2, ExternalLink,
  ChevronDown, ChevronUp, Sparkles, AlertCircle,
} from 'lucide-react';

interface ResearchRun {
  id: string;
  query: string;
  status: 'running' | 'done' | 'error';
  subQueries: string[];
  sources: Array<{ url: string; title: string; snippet: string }>;
  report: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export function DeepResearch() {
  const { aktivesUnternehmen } = useCompany();
  const { language } = useI18n();
  const de = language === 'de';

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ResearchRun | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!aktivesUnternehmen) return;
    try {
      const token = localStorage.getItem('opencognit_token');
      const resp = await fetch(`/api/deep-research?companyId=${aktivesUnternehmen.id}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setRuns(data.runs || []);
    } catch { /* ignore */ }
  }, [aktivesUnternehmen?.id]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Poll for running research
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      await loadRuns();
      const run = runs.find(r => r.id === pollingId);
      if (run && run.status !== 'running') {
        setPollingId(null);
        if (run.status === 'done') setSelectedRun(run);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId, runs, loadRuns]);

  const startResearch = async () => {
    if (!query.trim() || !aktivesUnternehmen) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('opencognit_token');
      const resp = await fetch('/api/deep-research', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await resp.json();
      if (data.ok && data.runId) {
        setPollingId(data.runId);
        setQuery('');
        await loadRuns();
      }
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  };

  const deleteRun = async (id: string) => {
    try {
      const token = localStorage.getItem('opencognit_token');
      await fetch(`/api/deep-research/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await loadRuns();
      if (selectedRun?.id === id) setSelectedRun(null);
    } catch { /* ignore */ }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(de ? 'de-DE' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Sparkles size={22} style={{ color: '#c5a059' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
            {de ? 'Tiefenrecherche' : 'Deep Research'}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#475569', margin: 0, maxWidth: 600 }}>
          {de
            ? 'Multi-step Web-Recherche mit Quellenanalyse und Synthese. Gib ein Thema ein und der Agent recherchiert automatisch.'
            : 'Multi-step web research with source analysis and synthesis. Enter a topic and the agent researches automatically.'}
        </p>
      </div>

      {/* Input */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 28,
        padding: 16,
        background: 'rgba(10,8,6,0.5)',
        border: '1px solid rgba(197,160,89,0.15)',
      }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') startResearch(); }}
          placeholder={de
            ? 'Thema eingeben… (z.B. "State of AI Agents 2025")'
            : 'Enter topic… (e.g. "State of AI Agents 2025")'}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e4e4e7',
            fontSize: 14,
            outline: 'none',
          }}
          disabled={loading}
        />
        <button
          onClick={startResearch}
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 20px',
            background: loading ? 'rgba(197,160,89,0.3)' : '#c5a059',
            color: '#000',
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: loading || !query.trim() ? 'default' : 'pointer',
            opacity: loading || !query.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
          {de ? 'Recherchieren' : 'Research'}
        </button>
      </div>

      {/* Active research indicator */}
      {pollingId && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(197,160,89,0.08)',
          border: '1px solid rgba(197,160,89,0.2)',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Loader2 size={14} style={{ color: '#c5a059', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 12, color: '#c5a059' }}>
            {de ? 'Recherche läuft… Quellen werden gesammelt und analysiert.' : 'Research in progress… Collecting and analyzing sources.'}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Sidebar: Run list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            {de ? 'Recherchen' : 'Research Runs'}
          </h3>
          {runs.length === 0 && (
            <div style={{ fontSize: 12, color: '#334155', padding: '20px 0' }}>
              {de ? 'Noch keine Recherchen' : 'No research yet'}
            </div>
          )}
          {runs.map(run => (
            <div
              key={run.id}
              onClick={() => setSelectedRun(run)}
              style={{
                padding: '10px 12px',
                background: selectedRun?.id === run.id ? 'rgba(197,160,89,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedRun?.id === run.id ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {run.status === 'running' && <Loader2 size={10} style={{ color: '#c5a059', animation: 'spin 1s linear infinite' }} />}
                {run.status === 'done' && <BookOpen size={10} style={{ color: '#7cb97a' }} />}
                {run.status === 'error' && <AlertCircle size={10} style={{ color: '#c97b7b' }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {run.query}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: '#334155' }}>
                  <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                  {formatDate(run.createdAt)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                  style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 2 }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Main: Report viewer */}
        <div style={{ minHeight: 400 }}>
          {!selectedRun ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: '#334155',
            }}>
              <Sparkles size={32} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 13 }}>
                {de ? 'Wähle eine Recherche aus der Liste' : 'Select a research run from the list'}
              </div>
            </div>
          ) : selectedRun.status === 'running' ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: '#c5a059',
            }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13 }}>
                {de ? 'Recherche läuft…' : 'Research in progress…'}
              </div>
              {selectedRun.subQueries.length > 0 && (
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {de ? 'Sub-Queries:' : 'Sub-queries:'} {selectedRun.subQueries.join(', ')}
                </div>
              )}
            </div>
          ) : selectedRun.status === 'error' ? (
            <div style={{ color: '#c97b7b', fontSize: 13 }}>
              {selectedRun.error || 'Error'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Report header */}
              <div style={{
                padding: '14px 18px',
                background: 'rgba(10,8,6,0.5)',
                border: '1px solid rgba(197,160,89,0.15)',
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px', color: '#f1f5f9' }}>
                  {selectedRun.query}
                </h2>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  {selectedRun.sources.length} {de ? 'Quellen' : 'sources'} · {formatDate(selectedRun.completedAt || selectedRun.createdAt)}
                </div>
              </div>

              {/* Sources accordion */}
              <div>
                <button
                  onClick={() => setExpandedRun(expandedRun === selectedRun.id ? null : selectedRun.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    color: '#c5a059',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {expandedRun === selectedRun.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {de ? 'Quellen' : 'Sources'} ({selectedRun.sources.length})
                </button>
                {expandedRun === selectedRun.id && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedRun.sources.map((s, i) => (
                      <div key={i} style={{
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: 11,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#c5a059', fontWeight: 700 }}>[{i + 1}]</span>
                          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#7cb97a', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.title || s.url}
                          </a>
                          <ExternalLink size={10} style={{ color: '#475569' }} />
                        </div>
                        <div style={{ color: '#475569', marginTop: 2, fontSize: 10 }}>{s.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Report */}
              <div style={{
                padding: '18px 22px',
                background: 'rgba(10,8,6,0.4)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 13,
                lineHeight: 1.7,
                color: '#cbd5e1',
              }}>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}>
                  {selectedRun.report}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
