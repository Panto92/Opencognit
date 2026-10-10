import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, Zap, CheckCircle2, Loader2, ChevronRight, ChevronLeft, AlertCircle, Server, Cloud, Wrench, Sparkles, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { authFetch } from '../utils/api';
import { useNavigate } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectType = 'claude-code' | 'gemini-cli' | 'codex-cli' | 'kimi-cli' | 'openrouter' | 'anthropic' | 'openai' | 'ollama';

interface CliStatus {
  installed: boolean;
  authenticated?: boolean;
  version?: string;
  loading?: boolean;
}

interface OllamaModel {
  name: string;
}

type KeyValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 0, color: '#fff', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.15s',
};

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(197,160,89,0.5)';
    e.target.style.boxShadow = '0 0 0 3px rgba(197,160,89,0.06)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
    e.target.style.boxShadow = 'none';
  },
};

// ─── Step bar ────────────────────────────────────────────────────────────────

function StepBar({ current, labels }: { current: number; labels: [string, string, string] }) {
  const icons = [Building2, Zap, Sparkles];
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
      {labels.map((label, i) => {
        const Icon = icons[i];
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'rgba(197,160,89,0.18)' : active ? 'rgba(197,160,89,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(197,160,89,0.5)' : done ? 'rgba(197,160,89,0.25)' : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.2s',
              }}>
                {done
                  ? <CheckCircle2 size={13} style={{ color: '#c5a059' }} />
                  : <Icon size={13} style={{ color: active ? '#c5a059' : '#3f3f46' }} />}
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: active ? '#c5a059' : done ? '#52525b' : '#3f3f46', transition: 'color 0.2s',
              }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex: 1, height: 1, margin: '0 0.875rem', background: i < current ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.05)', transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0 0.5rem' }}>
      <Icon size={12} style={{ color: '#52525b' }} />
      <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525b' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Connect option card ──────────────────────────────────────────────────────

interface ConnectOptionProps {
  id: ConnectType;
  icon: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  statusText?: string;
  statusColor?: string;
  loading?: boolean;
  selected: boolean;
  onSelect: () => void;
}

function ConnectOption({ icon, label, description, badge, badgeColor, statusText, statusColor, loading, selected, onSelect }: ConnectOptionProps) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', padding: '0.8rem 1rem', textAlign: 'left', cursor: 'pointer',
        background: selected ? 'rgba(197,160,89,0.07)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${selected ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 0, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.875rem',
      }}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: selected ? '#e5e5e5' : '#a1a1aa' }}>{label}</span>
          {badge && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', background: `${badgeColor || '#c5a059'}15`, color: badgeColor || '#c5a059', border: `1px solid ${badgeColor || '#c5a059'}30`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {badge}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {loading && <Loader2 size={10} style={{ color: '#3f3f46', animation: 'spin 1s linear infinite' }} />}
            {statusText && !loading && <span style={{ fontSize: '0.65rem', color: statusColor || '#52525b' }}>{statusText}</span>}
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#52525b', display: 'block', lineHeight: 1.4 }}>{description}</span>
      </div>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: selected ? '#c5a059' : 'transparent', flexShrink: 0, transition: 'background 0.15s' }} />
    </button>
  );
}

// ─── Success Screen ──────────────────────────────────────────────────────────

function SuccessScreen({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), 400 + i * 700));
    });
    timers.push(setTimeout(() => onDone(), 400 + steps.length * 700 + 600));
    return () => timers.forEach(clearTimeout);
  }, [steps, onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(197,160,89,0.07) 0%, transparent 65%), #09090b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem',
    }}>
      <div style={{ width: 64, height: 64, background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={28} style={{ color: '#c5a059' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 320 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            opacity: i < visibleCount ? 1 : 0.15,
            transform: i < visibleCount ? 'translateX(0)' : 'translateX(-8px)',
            transition: 'all 0.4s ease',
          }}>
            <div style={{
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i < visibleCount - 1 ? (
                <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
              ) : i === visibleCount - 1 ? (
                <Loader2 size={14} style={{ color: '#c5a059', animation: 'spin 1s linear infinite' }} />
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
            <span style={{ fontSize: '0.875rem', color: i < visibleCount ? '#d4d4d8' : '#3f3f46', fontWeight: 500 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const { t, language } = useI18n();
  const o = t.onboarding;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0 state
  const [companyName, setCompanyName] = useState('');
  const [companyGoal, setCompanyGoal] = useState('');

  // Step 1 state
  const [connectType, setConnectType] = useState<ConnectType | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);

  // CLI detection state
  const [cliStatus, setCliStatus] = useState<Record<string, CliStatus>>({
    'claude-code': { installed: false, loading: true },
    'gemini-cli': { installed: false, loading: true },
    'codex-cli': { installed: false, loading: true },
    'kimi-cli': { installed: false, loading: true },
  });

  // Ollama state
  const [ollamaDetected, setOllamaDetected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');

  // Validation state
  const [keyValidation, setKeyValidation] = useState<KeyValidationState>('idle');
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Success screen
  const [showSuccess, setShowSuccess] = useState(false);
  const [successSteps, setSuccessSteps] = useState<string[]>([]);

  const isGerman = language === 'de';

  // Detect installed CLIs on mount
  useEffect(() => {
    authFetch('/api/system/cli-detect')
      .then(r => r.json())
      .then((data: any) => {
        const map: Record<string, CliStatus> = {};
        for (const t of data.tools ?? []) {
          map[t.name] = { installed: t.installed, authenticated: t.authenticated, version: t.version };
        }
        setCliStatus({
          'claude-code': { ...(map['claude-code'] ?? { installed: false }), loading: false },
          'gemini-cli': { ...(map['gemini-cli'] ?? { installed: false }), loading: false },
          'codex-cli': { ...(map['codex-cli'] ?? { installed: false }), loading: false },
          'kimi-cli': { ...(map['kimi-cli'] ?? { installed: false }), loading: false },
        });
      })
      .catch(() => {
        setCliStatus({
          'claude-code': { installed: false, loading: false },
          'gemini-cli': { installed: false, loading: false },
          'codex-cli': { installed: false, loading: false },
          'kimi-cli': { installed: false, loading: false },
        });
      });
  }, []);

  // Detect Ollama
  useEffect(() => {
    const detectOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          const models = (data.models ?? []).slice(0, 5);
          setOllamaModels(models);
          setOllamaDetected(true);
          if (models.length > 0) setSelectedOllamaModel(models[0].name);
        } else {
          setOllamaDetected(false);
        }
      } catch {
        setOllamaDetected(false);
      }
    };
    detectOllama();
  }, []);

  // API Key validation
  const validateKey = useCallback(async (key: string, type: ConnectType) => {
    if (!key || key.length < 10) { setKeyValidation('idle'); return; }
    setKeyValidation('checking');
    try {
      const res = await authFetch('/api/onboarding/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, provider: type }),
      });
      const data = await res.json();
      setKeyValidation(data.valid ? 'valid' : 'invalid');
    } catch {
      setKeyValidation('invalid');
    }
  }, []);

  const debouncedValidate = useCallback((key: string, type: ConnectType) => {
    if (validationTimer.current) clearTimeout(validationTimer.current);
    if (!key || key.length < 10) { setKeyValidation('idle'); return; }
    validationTimer.current = setTimeout(() => validateKey(key, type), 800);
  }, [validateKey]);

  useEffect(() => {
    return () => { if (validationTimer.current) clearTimeout(validationTimer.current); };
  }, []);

  // Helpers
  const cliStatusProps = (id: ConnectType): Pick<ConnectOptionProps, 'statusText' | 'statusColor' | 'loading'> => {
    const s = cliStatus[id];
    if (s?.loading) return { loading: true };
    if (!s?.installed) return { statusText: o.connectStatusNotFound, statusColor: '#52525b' };
    if (s.authenticated) return { statusText: o.connectStatusConnected, statusColor: '#22c55e' };
    return { statusText: o.connectStatusInstalled, statusColor: '#f59e0b' };
  };

  const canProceedStep0 = companyName.trim().length >= 1;
  const canProceedStep1 = (() => {
    if (!connectType) return false;
    if (connectType === 'openrouter' || connectType === 'anthropic' || connectType === 'openai') return apiKey.trim().length > 10;
    if (connectType === 'ollama') return ollamaDetected === true && selectedOllamaModel.length > 0;
    return !cliStatus[connectType]?.loading;
  })();

  const handleLaunch = async () => {
    if (!connectType) return;
    setLoading(true);
    setError(null);

    setSuccessSteps([
      o.successCreatingCompany,
      o.successCreatingCeo,
      o.successGeneratingTasks,
    ]);
    setShowSuccess(true);

    try {
      // 1. Create company
      const compRes = await authFetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim(), ziel: companyGoal.trim() || undefined }),
      });
      if (!compRes.ok) throw new Error(o.errorCreateCompany);
      const company = await compRes.json();

      // 2. Save API key / settings if chosen
      if ((connectType === 'openrouter' || connectType === 'anthropic' || connectType === 'openai') && apiKey.trim()) {
        const keyName = connectType === 'openrouter' ? 'openrouter_api_key' : connectType === 'anthropic' ? 'anthropic_api_key' : 'openai_api_key';
        await authFetch(`/api/settings/${keyName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unternehmenId: company.id, value: apiKey.trim() }),
        });
      }

      if (connectType === 'ollama') {
        await authFetch(`/api/settings/ollama_base_url`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unternehmenId: company.id, value: 'http://localhost:11434' }),
        });
        await authFetch(`/api/settings/ollama_default_model`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unternehmenId: company.id, value: selectedOllamaModel }),
        });
      }

      // 3. Create CEO agent
      const agentRes = await authFetch(`/api/companies/${company.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'CEO',
          rolle: 'Chief Executive Officer',
          verbindungsTyp: connectType,
          isOrchestrator: true,
          avatarFarbe: '#c5a059',
        }),
      });
      if (!agentRes.ok) throw new Error(o.errorCreateAgent);
      const agent = await agentRes.json();

      localStorage.removeItem('oc_force_onboarding');
      // Navigate will happen from SuccessScreen onDone callback
      return { company, agent };
    } catch (e: any) {
      setShowSuccess(false);
      setError(e.message || o.errorGeneric);
      setLoading(false);
      return null;
    }
  };

  const [launchResult, setLaunchResult] = useState<any>(null);

  const onSuccessDone = useCallback(() => {
    if (launchResult?.agent?.id && launchResult?.company?.id) {
      navigate(`/chat?agent=${launchResult.agent.id}&company=${launchResult.company.id}&welcome=1`);
    }
  }, [launchResult, navigate]);

  const doLaunch = async () => {
    const result = await handleLaunch();
    if (result) setLaunchResult(result);
  };

  const isApiKeyMode = connectType === 'openrouter' || connectType === 'anthropic' || connectType === 'openai';
  const isOllamaMode = connectType === 'ollama';
  const showCliWarning = (connectType === 'claude-code' || connectType === 'gemini-cli' || connectType === 'codex-cli' || connectType === 'kimi-cli')
    && !cliStatus[connectType]?.loading
    && !cliStatus[connectType]?.installed;

  const stepLabels: [string, string, string] = isGerman
    ? [o.stepWorkspace, o.stepConnect, o.stepSuccess]
    : [o.stepWorkspace, o.stepConnect, o.stepSuccess];

  if (showSuccess) {
    return <SuccessScreen steps={successSteps} onDone={onSuccessDone} />;
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(197,160,89,0.07) 0%, transparent 65%), #09090b',
      padding: '1rem',
    }}>
      {/* Subtle dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <div style={{
        width: '100%', maxWidth: 520, position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
        padding: '2rem 2rem 1.5rem',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 32px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Brand header */}
        <div style={{ marginBottom: '1.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
            <div style={{ width: 22, height: 22, background: 'linear-gradient(135deg,#c5a059,#d4b06a)', borderRadius: 3, flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c5a059', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              OpenCognit
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#3f3f46', margin: 0 }}>{o.tagline}</p>
        </div>

        <StepBar current={step} labels={stepLabels} />

        {/* ─── Step 0: Workspace ─── */}
        {step === 0 && (
          <div key="step0">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: '0 0 0.375rem' }}>
              {o.workspaceTitle}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#71717a', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              {o.workspaceDesc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#a1a1aa', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {o.workspaceNameLabel} *
                </label>
                <input
                  autoFocus
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canProceedStep0 && setStep(1)}
                  placeholder={o.workspaceNamePlaceholder}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#52525b', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {o.workspaceGoalLabel} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.68rem' }}>({o.workspaceGoalOptional})</span>
                </label>
                <textarea
                  value={companyGoal}
                  onChange={e => setCompanyGoal(e.target.value)}
                  placeholder={o.workspaceGoalPlaceholder}
                  rows={2}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                  {...focusHandlers}
                />
                {companyGoal.trim() && (
                  <p style={{ margin: '0.375rem 0 0', fontSize: '0.69rem', color: '#52525b', lineHeight: 1.4 }}>
                    {o.workspaceGoalHint}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 1: Connect ─── */}
        {step === 1 && (
          <div key="step1">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: '0 0 0.375rem' }}>
              {o.connectTitle}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#71717a', margin: '0 0 1.125rem', lineHeight: 1.5 }}>
              {o.connectDesc}
            </p>

            {/* Cloud Providers */}
            <SectionHeader icon={Cloud} label={o.connectSectionCloud} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <ConnectOption
                id="openrouter"
                icon="🔗"
                label="OpenRouter"
                description={o.connectOpenrouterDesc}
                badge={o.connectRecommended}
                selected={connectType === 'openrouter'}
                onSelect={() => { setConnectType('openrouter'); setApiKey(''); setKeyValidation('idle'); }}
              />
              <ConnectOption
                id="anthropic"
                icon="🤖"
                label="Anthropic"
                description={o.connectAnthropicDesc}
                selected={connectType === 'anthropic'}
                onSelect={() => { setConnectType('anthropic'); setApiKey(''); setKeyValidation('idle'); }}
              />
              <ConnectOption
                id="openai"
                icon="🅾️"
                label="OpenAI"
                description={isGerman ? 'Zugriff auf GPT-4o, o3 und mehr über OpenAI API-Key.' : 'Access GPT-4o, o3 and more via OpenAI API key.'}
                selected={connectType === 'openai'}
                onSelect={() => { setConnectType('openai'); setApiKey(''); setKeyValidation('idle'); }}
              />
            </div>

            {/* Local / Free */}
            <SectionHeader icon={Server} label={o.connectSectionLocal} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <ConnectOption
                id="ollama"
                icon="🦙"
                label="Ollama"
                description={o.connectOllamaDesc}
                badge={isGerman ? 'Kostenlos' : 'Free'}
                badgeColor="#22c55e"
                statusText={ollamaDetected === null ? o.connectOllamaDetecting : ollamaDetected ? o.connectOllamaFound(ollamaModels.map(m => m.name).join(', ')) : o.connectOllamaNotFound}
                statusColor={ollamaDetected === true ? '#22c55e' : ollamaDetected === false ? '#ef4444' : undefined}
                loading={ollamaDetected === null}
                selected={connectType === 'ollama'}
                onSelect={() => { setConnectType('ollama'); setApiKey(''); setKeyValidation('idle'); }}
              />
              {isOllamaMode && ollamaDetected === true && ollamaModels.length > 0 && (
                <div style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#a1a1aa', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {o.connectOllamaModelLabel}
                  </label>
                  <select
                    value={selectedOllamaModel}
                    onChange={e => setSelectedOllamaModel(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    {...focusHandlers}
                  >
                    {ollamaModels.map(m => (
                      <option key={m.name} value={m.name} style={{ background: '#09090b', color: '#fff' }}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {isOllamaMode && ollamaDetected === false && (
                <div style={{ padding: '0.75rem 0.875rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', fontSize: '0.78rem', color: '#fca5a5', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {o.connectOllamaNotFound}
                    <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: '#c5a059', textDecoration: 'underline', marginLeft: 4 }}>
                      {o.connectOllamaInstall} ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced — CLI Tools */}
            <button
              onClick={() => setAdvancedMode(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'none', border: 'none', color: '#52525b', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.5rem 0', marginTop: '0.5rem',
              }}
            >
              <Wrench size={12} />
              {advancedMode ? o.connectHideAdvanced : o.connectShowAdvanced}
              <ChevronRight size={12} style={{ transform: advancedMode ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {advancedMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                <ConnectOption
                  id="claude-code"
                  icon="⚡"
                  label="Claude Code"
                  description={o.connectClaudeDesc}
                  {...cliStatusProps('claude-code')}
                  selected={connectType === 'claude-code'}
                  onSelect={() => { setConnectType('claude-code'); setApiKey(''); setKeyValidation('idle'); }}
                />
                <ConnectOption
                  id="gemini-cli"
                  icon="✨"
                  label="Gemini CLI"
                  description={isGerman ? 'Nutzt die lokale Gemini CLI — kostenlos über dein Google-Abo.' : 'Uses local Gemini CLI — free via your Google subscription.'}
                  {...cliStatusProps('gemini-cli')}
                  selected={connectType === 'gemini-cli'}
                  onSelect={() => { setConnectType('gemini-cli'); setApiKey(''); setKeyValidation('idle'); }}
                />
                <ConnectOption
                  id="codex-cli"
                  icon="💻"
                  label="Codex CLI"
                  description={isGerman ? 'Nutzt die lokale Codex CLI — kostenlos über dein OpenAI-Abo.' : 'Uses local Codex CLI — free via your OpenAI subscription.'}
                  {...cliStatusProps('codex-cli')}
                  selected={connectType === 'codex-cli'}
                  onSelect={() => { setConnectType('codex-cli'); setApiKey(''); setKeyValidation('idle'); }}
                />
                <ConnectOption
                  id="kimi-cli"
                  icon="🌙"
                  label="Kimi CLI"
                  description={o.connectKimiDesc}
                  {...cliStatusProps('kimi-cli')}
                  selected={connectType === 'kimi-cli'}
                  onSelect={() => { setConnectType('kimi-cli'); setApiKey(''); setKeyValidation('idle'); }}
                />
              </div>
            )}

            {/* API Key input */}
            {isApiKeyMode && (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#a1a1aa', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {connectType === 'openrouter' ? 'OpenRouter API Key' : connectType === 'anthropic' ? 'Anthropic API Key' : 'OpenAI API Key'} *
                </label>
                <input
                  autoFocus
                  type="password"
                  value={apiKey}
                  onChange={e => {
                    const val = e.target.value;
                    setApiKey(val);
                    if (connectType) debouncedValidate(val, connectType);
                  }}
                  placeholder={
                    connectType === 'openrouter' ? 'sk-or-...' :
                    connectType === 'anthropic' ? 'sk-ant-...' : 'sk-...'
                  }
                  style={inputStyle}
                  {...focusHandlers}
                />
                <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 18 }}>
                  {keyValidation === 'checking' && (
                    <span style={{ fontSize: '0.69rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> {o.connectValidating}
                    </span>
                  )}
                  {keyValidation === 'valid' && (
                    <span style={{ fontSize: '0.69rem', color: '#22c55e' }}>{o.connectValid}</span>
                  )}
                  {keyValidation === 'invalid' && (
                    <span style={{ fontSize: '0.69rem', color: '#ef4444' }}>{o.connectInvalid}</span>
                  )}
                  {keyValidation === 'idle' && (
                    <span style={{ fontSize: '0.69rem', color: '#52525b' }}>
                      {connectType === 'openrouter' ? o.connectOrKeyHint :
                       connectType === 'anthropic' ? o.connectAnthropicKeyHint :
                       'Create a key at platform.openai.com'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CLI not installed notice */}
            {showCliWarning && (
              <div style={{ padding: '0.75rem 0.875rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', fontSize: '0.78rem', color: '#d97706', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginTop: '0.75rem' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ marginBottom: 6 }}>
                    {o.connectCliNotInstalled(
                      connectType === 'claude-code' ? 'Claude Code' :
                      connectType === 'gemini-cli' ? 'Gemini CLI' :
                      connectType === 'codex-cli' ? 'Codex CLI' : 'Kimi CLI'
                    )}
                    {' '}{o.connectCliInstallWith}
                  </div>
                  <code style={{ display: 'block', padding: '4px 8px', background: 'rgba(0,0,0,0.35)', fontFamily: 'monospace', fontSize: '0.72rem', color: '#e2e8f0', marginBottom: 6 }}>
                    {connectType === 'claude-code' ? 'npm install -g @anthropic-ai/claude-code' :
                     connectType === 'gemini-cli' ? 'npm install -g @google/gemini-cli' :
                     connectType === 'codex-cli' ? 'npm install -g @openai/codex' : 'pip install kimi-cli'}
                  </code>
                  <span style={{ fontSize: '0.68rem', color: '#78716c' }}>{o.connectCliSkipHint}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: '1rem', padding: '0.7rem 0.875rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8rem', color: '#fca5a5', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem' }}>
          {step > 0 ? (
            <button
              onClick={() => { setStep(s => s - 1); setError(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 0 }}
            >
              <ChevronLeft size={13} /> {o.back}
            </button>
          ) : <span />}

          {step < 1 ? (
            <button
              disabled={!canProceedStep0}
              onClick={() => setStep(1)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.6rem 1.25rem', borderRadius: 0, fontSize: '0.875rem', fontWeight: 600,
                background: canProceedStep0 ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${canProceedStep0 ? 'rgba(197,160,89,0.38)' : 'rgba(255,255,255,0.06)'}`,
                color: canProceedStep0 ? '#c5a059' : '#3f3f46',
                cursor: canProceedStep0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              }}
            >
              {o.continue} <ChevronRight size={13} />
            </button>
          ) : (
            <button
              disabled={!canProceedStep1 || loading}
              onClick={doLaunch}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.25rem', borderRadius: 0, fontSize: '0.875rem', fontWeight: 600,
                background: (canProceedStep1 && !loading) ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${(canProceedStep1 && !loading) ? 'rgba(197,160,89,0.38)' : 'rgba(255,255,255,0.06)'}`,
                color: (canProceedStep1 && !loading) ? '#c5a059' : '#3f3f46',
                cursor: (canProceedStep1 && !loading) ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              }}
            >
              {loading
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {o.launching}</>
                : <>{o.launch} <ChevronRight size={13} /></>}
            </button>
          )}
        </div>

        {/* Footer hint */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.68rem', color: '#27272a', lineHeight: 1.4 }}>
          {o.footerHint}
        </p>

        {/* Language switcher */}
        <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
          <select
            value={language}
            onChange={e => {
              localStorage.setItem('opencognit_language', e.target.value);
              window.location.reload();
            }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', fontSize: '0.7rem', padding: '2px 4px', cursor: 'pointer', outline: 'none', borderRadius: 0 }}
          >
            <option value="en">EN</option>
            <option value="de">DE</option>
          </select>
        </div>
      </div>
    </div>
  );
}
