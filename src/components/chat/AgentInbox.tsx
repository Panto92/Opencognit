// Agent Inbox — A2A Message Bus UI
// Displays peer-to-peer messages between agents inside the Chat page.

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mail, MailOpen, MessageSquare, Hash, CornerDownRight, Loader2, AlertCircle } from 'lucide-react';
import { useWebSocketEvent } from '../../hooks/useWebSocket';

const C = {
  bg: '#0a0a0a',
  surface: 'rgba(255,255,255,0.03)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.06)',
  gold: '#c5a059',
  goldDim: 'rgba(197,160,89,0.15)',
  text: '#e8e4dc',
  textMuted: '#7a7268',
  textDim: '#3a342c',
  success: '#7cb97a',
};

const flex = (dir: 'row' | 'column' = 'row', opts?: { center?: boolean; between?: boolean; end?: boolean }) => ({
  display: 'flex', flexDirection: dir,
  ...(opts?.center ? { alignItems: 'center', justifyContent: 'center' } : {}),
  ...(opts?.between ? { alignItems: 'center', justifyContent: 'space-between' } : {}),
  ...(opts?.end ? { alignItems: 'flex-end' } : {}),
});

function authHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('opencognit_token');
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

interface A2AMessage {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string | null;
  channel: string | null;
  threadId: string | null;
  type: string;
  payload: { text: string; metadata?: Record<string, unknown>; urgency?: 'low' | 'normal' | 'high' };
  readAt: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatarColor?: string;
}

interface AgentInboxProps {
  agentId: string;
  companyId: string;
  agents: Agent[];
  de?: boolean;
}

export default function AgentInbox({ agentId, companyId, agents, de = false }: AgentInboxProps) {
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'direct' | 'channel'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const t = {
    inbox: de ? 'Posteingang' : 'Inbox',
    unread: de ? 'Ungelesen' : 'Unread',
    direct: de ? 'Direkt' : 'Direct',
    channels: de ? 'Kanäle' : 'Channels',
    all: de ? 'Alle' : 'All',
    noMessages: de ? 'Keine Nachrichten' : 'No messages',
    compose: de ? 'Neue Nachricht' : 'New message',
    to: de ? 'An' : 'To',
    send: de ? 'Senden' : 'Send',
    loading: de ? 'Laden…' : 'Loading…',
    error: de ? 'Fehler beim Laden' : 'Error loading',
    from: de ? 'Von' : 'From',
    markRead: de ? 'Als gelesen markieren' : 'Mark as read',
    reply: de ? 'Antworten' : 'Reply',
  };

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const unreadOnly = filter === 'unread' ? 'true' : 'false';
      const res = await fetch(`/api/agents/${agentId}/inbox?unreadOnly=${unreadOnly}&limit=50`, {
        credentials: 'include',
        headers: authHeaders({ 'x-company-id': companyId }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        let msgs = data.messages as A2AMessage[];
        if (filter === 'direct') msgs = msgs.filter(m => m.type === 'direct' || m.type === 'request' || m.type === 'response');
        if (filter === 'channel') msgs = msgs.filter(m => m.type === 'channel' || m.type === 'broadcast');
        setMessages(msgs);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId, companyId, filter]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Real-time updates via WebSocket
  useWebSocketEvent('agent_message', (msg) => {
    const data = (msg.data ?? msg) as A2AMessage;
    setMessages(prev => {
      if (prev.some(m => m.id === data.id)) return prev;
      return [data, ...prev];
    });
  });

  const markRead = async (msgIds: string[]) => {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders({ 'x-company-id': companyId }), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: msgIds }),
      });
      setMessages(prev => prev.map(m => msgIds.includes(m.id) ? { ...m, readAt: new Date().toISOString() } : m));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const sendMessage = async () => {
    if (!recipientId || !composeText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders({ 'x-company-id': companyId }), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          payload: { text: composeText.trim() },
        }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setMessages(prev => [data.message, ...prev]);
        setComposeText('');
        setComposeOpen(false);
      }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter(m => !m.readAt).length;

  const agentMap = new Map(agents.map(a => [a.id, a]));

  return (
    <div style={{ ...flex('column'), height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '10px 20px', borderBottom: `1px solid ${C.border}`, ...flex('row', { between: true }), alignItems: 'center' }}>
        <div style={{ ...flex('row'), gap: 10, alignItems: 'center' }}>
          <Mail size={16} style={{ color: C.gold }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.inbox}</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: C.goldDim, color: C.gold, borderRadius: 9999, minWidth: 18, textAlign: 'center' }}>
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          style={{ ...flex('row'), gap: 6, alignItems: 'center', padding: '5px 12px', background: C.goldDim, border: `1px solid ${C.goldDim}`, color: C.gold, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
        >
          <Send size={12} />
          {t.compose}
        </button>
      </div>

      {/* Filters */}
      <div style={{ flexShrink: 0, padding: '8px 20px', borderBottom: `1px solid ${C.border}`, ...flex('row'), gap: 8 }}>
        {(['all', 'unread', 'direct', 'channel'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              background: filter === f ? C.goldDim : 'transparent',
              color: filter === f ? C.gold : C.textMuted,
            }}
          >
            {f === 'all' ? t.all : f === 'unread' ? t.unread : f === 'direct' ? t.direct : t.channels}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading && messages.length === 0 && (
          <div style={{ ...flex('column', { center: true }), gap: 8, padding: 40, color: C.textMuted }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12 }}>{t.loading}</span>
          </div>
        )}

        {error && (
          <div style={{ ...flex('column', { center: true }), gap: 8, padding: 40, color: '#ef4444' }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: 12 }}>{t.error}: {error}</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ ...flex('column', { center: true }), gap: 8, padding: 40, color: C.textMuted }}>
            <MailOpen size={24} />
            <span style={{ fontSize: 13 }}>{t.noMessages}</span>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => {
            const isUnread = !msg.readAt;
            const sender = agentMap.get(msg.senderId);
            const isSelf = msg.senderId === agentId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginBottom: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: isUnread ? 'rgba(197,160,89,0.04)' : C.surface,
                  border: `1px solid ${isUnread ? C.goldDim : C.border}`,
                  ...flex('column'),
                  gap: 6,
                }}
              >
                <div style={{ ...flex('row', { between: true }), alignItems: 'flex-start' }}>
                  <div style={{ ...flex('row'), gap: 8, alignItems: 'center' }}>
                    {isUnread ? <Mail size={12} style={{ color: C.gold, flexShrink: 0 }} /> : <MailOpen size={12} style={{ color: C.textDim, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSelf ? C.textMuted : C.text }}>
                      {isSelf ? (de ? 'Du' : 'You') : (sender?.name || msg.senderName || 'Agent')}
                    </span>
                    {msg.channel && (
                      <span style={{ ...flex('row'), gap: 3, alignItems: 'center', fontSize: 10, color: C.gold, background: C.goldDim, padding: '1px 6px', borderRadius: 4 }}>
                        <Hash size={9} />
                        {msg.channel}
                      </span>
                    )}
                    {msg.type === 'request' && (
                      <span style={{ fontSize: 9, color: C.gold, background: C.goldDim, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>REQUEST</span>
                    )}
                    {msg.type === 'response' && (
                      <span style={{ fontSize: 9, color: C.success, background: 'rgba(124,185,122,0.15)', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>REPLY</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{fmtTime(msg.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, paddingLeft: 20 }}>
                  {msg.payload.text}
                </div>
                <div style={{ ...flex('row'), gap: 8, paddingLeft: 20 }}>
                  {isUnread && (
                    <button
                      onClick={() => markRead([msg.id])}
                      style={{ fontSize: 10, color: C.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {t.markRead}
                    </button>
                  )}
                  {!isSelf && (
                    <button
                      onClick={() => { setRecipientId(msg.senderId); setComposeOpen(true); }}
                      style={{ fontSize: 10, color: C.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, ...flex('row'), gap: 3, alignItems: 'center' }}
                    >
                      <CornerDownRight size={9} />
                      {t.reply}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Compose overlay */}
      <AnimatePresence>
        {composeOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              background: 'rgba(10,10,10,0.98)',
              borderTop: `1px solid ${C.border}`,
              padding: '14px 20px',
              ...flex('column'),
              gap: 10,
              zIndex: 20,
            }}
          >
            <div style={{ ...flex('row', { between: true }), alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.compose}</span>
              <button onClick={() => setComposeOpen(false)} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ ...flex('row'), gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>{t.to}</span>
              <select
                value={recipientId}
                onChange={e => setRecipientId(e.target.value)}
                style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: '6px 10px', borderRadius: 6, fontSize: 12 }}
              >
                <option value="">{de ? 'Agent wählen…' : 'Select agent…'}</option>
                {agents.filter(a => a.id !== agentId).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <textarea
              value={composeText}
              onChange={e => setComposeText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage(); }}
              placeholder={de ? 'Nachricht schreiben…' : 'Write a message…'}
              rows={3}
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: '8px 12px', borderRadius: 6, fontSize: 12, resize: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ ...flex('row', { end: true }) }}>
              <button
                onClick={sendMessage}
                disabled={sending || !recipientId || !composeText.trim()}
                style={{
                  ...flex('row'), gap: 6, alignItems: 'center',
                  padding: '6px 14px',
                  background: sending || !recipientId || !composeText.trim() ? C.textDim : C.goldDim,
                  border: `1px solid ${sending || !recipientId || !composeText.trim() ? C.textDim : C.goldDim}`,
                  color: sending || !recipientId || !composeText.trim() ? C.textMuted : C.gold,
                  borderRadius: 6,
                  cursor: sending || !recipientId || !composeText.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {sending ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                {t.send}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
