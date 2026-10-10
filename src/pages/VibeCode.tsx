import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../hooks/useCompany';
import { useI18n } from '../i18n';
import { apiAgents } from '@/api/agents';
import { AgentTerminal } from '../components/AgentTerminal';
import { Code2, Zap, Loader2, Terminal } from 'lucide-react';

interface CoderAgent {
  id: string;
  name: string;
  rolle: string;
  avatar: string | null;
  avatarFarbe: string;
  status: string;
  verbindungsTyp: string;
}

const CODING_TYPES = new Set([
  'claude-code', 'codex-cli', 'gemini-cli', 'kimi-cli',
  'bash', 'cursor', 'claude', 'anthropic', 'openai', 'openrouter',
]);

export function VibeCode() {
  const { aktivesUnternehmen } = useCompany();
  const { language } = useI18n();
  const de = language === 'de';

  const [agents, setAgents] = useState<CoderAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState('');
  const [starting, setStarting] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!aktivesUnternehmen) return;
    setLoading(true);
    try {
      const list = await apiAgents.liste(aktivesUnternehmen.id);
      const coders = list
        .filter((a: any) => CODING_TYPES.has(a.verbindungsTyp || ''))
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          rolle: a.rolle,
          avatar: a.avatar,
          avatarFarbe: a.avatarFarbe,
          status: a.status,
          verbindungsTyp: a.verbindungsTyp,
        }));
      setAgents(coders);
    } catch (e) {
      console.error('Failed to load coder agents:', e);
    }
    setLoading(false);
  }, [aktivesUnternehmen?.id]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const startMission = async () => {
    if (!mission.trim() || !aktivesUnternehmen || agents.length === 0) return;
    setStarting(true);
    try {
      const token = localStorage.getItem('opencognit_token');
      const ceo = agents.find(a => a.rolle.toLowerCase().includes('ceo') || a.rolle.toLowerCase().includes('director')) || agents[0];
      await fetch(`/api/experten/${ceo.id}/chat/direct`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-unternehmen-id': aktivesUnternehmen.id,
        },
        body: JSON.stringify({
          nachricht: `[VIBE-CODING-MISSION] ${mission.trim()}\n\nTeam: ${agents.map(a => `${a.name} (${a.rolle}, ${a.verbindungsTyp})`).join(', ')}`,
        }),
      });
      setMission('');
    } catch (e) {
      console.error('Failed to start mission:', e);
    }
    setStarting(false);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(197,160,89,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        background: 'rgba(10,8,6,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Code2 size={22} style={{ color: '#c5a059' }} />
          <span style={{
            fontSize: 18,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #c5a059, #e8d4a8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            VibeCode
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#c5a059',
            background: 'rgba(197,160,89,0.12)',
            border: '1px solid rgba(197,160,89,0.25)',
            padding: '2px 6px',
            letterSpacing: '0.08em',
          }}>
            BETA
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Mission input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 2,
          maxWidth: 600,
        }}>
          <input
            type="text"
            value={mission}
            onChange={e => setMission(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') startMission(); }}
            placeholder={de
              ? 'Beschreibe das Coding-Projekt… (z.B. "Baue eine React Login-Seite mit OAuth")'
              : 'Describe the coding project… (e.g. "Build a React login page with OAuth")'}
            style={{
              flex: 1,
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(197,160,89,0.2)',
              color: '#e4e4e7',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={startMission}
            disabled={starting || !mission.trim() || agents.length === 0}
            style={{
              padding: '8px 18px',
              background: starting ? 'rgba(197,160,89,0.3)' : '#c5a059',
              color: '#000',
              border: 'none',
              fontSize: 12,
              fontWeight: 800,
              cursor: starting || !mission.trim() ? 'default' : 'pointer',
              opacity: starting || !mission.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {starting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
            {de ? 'Mission starten' : 'Start Mission'}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={12} />
          {agents.length} {de ? 'Coder' : 'Coders'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 16 }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: '#475569',
          }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            {de ? 'Lade Coder-Team…' : 'Loading coder team…'}
          </div>
        ) : agents.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 16,
            color: '#475569',
          }}>
            <Code2 size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>{de ? 'Keine Coder-Agenten gefunden' : 'No coder agents found'}</div>
            <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center' }}>
              {de
                ? 'Erstelle Agenten mit CLI-Verbindungen (Claude Code, Codex, Kimi, Bash) um VibeCode zu nutzen.'
                : 'Create agents with CLI connections (Claude Code, Codex, Kimi, Bash) to use VibeCode.'}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
            gap: 14,
            height: '100%',
            overflowY: 'auto',
            alignContent: 'start',
          }}>
            {agents.map(agent => (
              <div
                key={agent.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(10,8,6,0.6)',
                  border: '1px solid rgba(197,160,89,0.12)',
                  overflow: 'hidden',
                }}
              >
                {/* Agent header */}
                <div style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(0,0,0,0.3)',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 32, height: 32,
                    background: (agent.avatarFarbe || '#c5a059') + '18',
                    border: `1px solid ${(agent.avatarFarbe || '#c5a059')}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: agent.avatarFarbe || '#c5a059',
                    flexShrink: 0,
                  }}>
                    {agent.avatar || agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>{agent.rolle}</div>
                  </div>
                  <div style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 6px',
                    background: agent.status === 'running' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.04)',
                    color: agent.status === 'running' ? '#c5a059' : '#475569',
                    border: `1px solid ${agent.status === 'running' ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    letterSpacing: '0.08em',
                  }}>
                    {agent.status.toUpperCase()}
                  </div>
                </div>

                {/* Terminal */}
                <div style={{ flex: 1, minHeight: 280 }}>
                  <AgentTerminal agentId={agent.id} agentName={agent.name} de={de} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
