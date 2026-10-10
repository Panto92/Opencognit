import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2, Zap, FileText, Settings2, Rocket, X } from 'lucide-react';

interface MissionPromptProps {
  de: boolean;
  companyId: string;
  onBootstrap: (result: { ceoId: string; agents: any[]; projects: any[]; tasks: any[] }) => void;
  onDismiss?: () => void;
}

const QUICK_STARTS = [
  { icon: <Rocket size={16} />, label: { de: 'Startup bauen', en: 'Build a startup' }, prompt: { de: 'Ich will ein Tech-Startup gründen mit einem digitalen Produkt.', en: 'I want to build a tech startup with a digital product.' } },
  { icon: <FileText size={16} />, label: { de: 'Content erstellen', en: 'Create content' }, prompt: { de: 'Ich brauche einen Content-Plan und regelmäßige Blog-Artikel für meine Marke.', en: 'I need a content plan and regular blog posts for my brand.' } },
  { icon: <Settings2 size={16} />, label: { de: 'Prozess automatisieren', en: 'Automate a process' }, prompt: { de: 'Ich will meinen Kundensupport und E-Mail-Workflow automatisieren.', en: 'I want to automate my customer support and email workflow.' } },
];

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

export function MissionPrompt({ de, companyId, onBootstrap, onDismiss }: MissionPromptProps) {
  const [goal, setGoal] = useState('');
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleQuickStart = (prompt: string) => {
    setGoal(prompt);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!goal.trim() || goal.trim().length < 3) {
      setError(de ? 'Bitte beschreibe dein Ziel (mindestens 3 Zeichen).' : 'Please describe your goal (at least 3 characters).');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('opencognit_token');
      const res = await fetch(`/api/companies/${companyId}/bootstrap`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ goal: goal.trim(), provider, apiKey: apiKey.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Bootstrap failed');
      }
      onBootstrap(data);
    } catch (e: any) {
      setError(e.message || (de ? 'Fehler beim Aufsetzen' : 'Setup failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,12,0.85)', backdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%', maxWidth: 580,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(197,160,89,0.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(197,160,89,0.05)',
          padding: '2.5rem',
          position: 'relative',
        }}
      >
        {/* Dismiss (optional) */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Sparkles size={22} style={{ color: '#c5a059' }} />
          </div>
          <h2 style={{
            fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc',
            margin: '0 0 0.5rem', letterSpacing: '-0.01em',
          }}>
            {de ? 'Was möchtest du bauen?' : 'What do you want to build?'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
            {de
              ? 'Der CEO analysiert dein Ziel, stellt ein Team zusammen und startet die erste Aufgabe.'
              : 'The CEO will analyze your goal, assemble a team, and start the first task.'}
          </p>
        </div>

        {/* Quick starts */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {QUICK_STARTS.map((q, i) => (
            <button
              key={i}
              onClick={() => handleQuickStart(de ? q.prompt.de : q.prompt.en)}
              style={{
                flex: 1, minWidth: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#a1a1aa', fontSize: '0.8125rem', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.3)'; e.currentTarget.style.color = '#c5a059'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#a1a1aa'; }}
            >
              {q.icon}
              {de ? q.label.de : q.label.en}
            </button>
          ))}
        </div>

        {/* Goal textarea */}
        <div style={{ marginBottom: '1.25rem' }}>
          <textarea
            ref={textareaRef}
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={de
              ? 'Beschreibe dein Ziel… z.B. "Ich will eine SaaS für Zahnärzte, die Termine automatisch verwaltet"'
              : 'Describe your goal… e.g. "I want a SaaS for dentists that automates appointments"'}
            style={{
              width: '100%', minHeight: 100,
              padding: '1rem',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: '#f8fafc', fontSize: '0.9375rem', lineHeight: 1.6,
              outline: 'none', resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 8, marginBottom: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Provider + API Key */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Provider
            </label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              style={{
                width: '100%', padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#d4d4d8', fontSize: '0.875rem',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value} style={{ background: '#1a1a1a' }}>{p.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {de ? 'API Key (optional)' : 'API Key (optional)'}
            </label>
            <div style={{ display: 'flex' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={de ? 'sk-...' : 'sk-...'}
                style={{
                  flex: 1, padding: '0.625rem 0.875rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRight: 'none',
                  color: '#d4d4d8', fontSize: '0.875rem',
                  outline: 'none', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  padding: '0.625rem 0.75rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#71717a', fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {showKey ? (de ? 'Verbergen' : 'Hide') : (de ? 'Zeigen' : 'Show')}
              </button>
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#52525b', marginTop: 4, marginBottom: 0 }}>
              {de
                ? 'Ohne Key wird das Team erstellt, aber die Agents können nicht arbeiten. Du kannst den Key später in Einstellungen hinzufügen.'
                : 'Without a key, the team will be created but agents cannot work. You can add the key later in Settings.'}
            </p>
          </div>
        </div>

        {/* Submit button */}
        <motion.button
          onClick={handleSubmit}
          disabled={loading || !goal.trim()}
          whileHover={!loading && goal.trim() ? { scale: 1.01 } : {}}
          whileTap={!loading && goal.trim() ? { scale: 0.98 } : {}}
          style={{
            width: '100%', padding: '0.875rem 1.5rem',
            background: goal.trim() && !loading ? '#c5a059' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${goal.trim() && !loading ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: goal.trim() && !loading ? '#0a0a0a' : 'rgba(255,255,255,0.25)',
            fontSize: '0.9375rem', fontWeight: 700,
            cursor: goal.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              {de ? 'Der CEO analysiert und stellt das Team auf…' : 'The CEO is analyzing and assembling the team…'}
            </>
          ) : (
            <>
              <Zap size={18} />
              {de ? 'Team aufsetzen & loslegen' : 'Assemble team & start'}
              <ArrowRight size={18} />
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
