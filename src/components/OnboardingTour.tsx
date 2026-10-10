import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, X, Rocket, LayoutDashboard, MessageSquare, Users, Sparkles, ChevronLeft } from 'lucide-react';
import { useI18n } from '../i18n';

const STORAGE_KEY = 'oc_onboarding_tour_done';

interface TourStep {
  id: string;
  target?: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

interface Rect { top: number; left: number; width: number; height: number; }

export function OnboardingTour() {
  const { t, language } = useI18n();
  const tr = t.tour;
  const de = language === 'de';

  const STEPS: TourStep[] = [
    {
      id: 'welcome',
      icon: Rocket,
      title: tr.welcomeTitle,
      description: tr.welcomeDesc,
    },
    {
      id: 'dashboard',
      target: 'dashboard',
      icon: LayoutDashboard,
      title: tr.dashboardTitle,
      description: tr.dashboardDesc,
    },
    {
      id: 'chat',
      target: 'chat',
      icon: MessageSquare,
      title: tr.chatTitle,
      description: tr.chatDesc,
    },
    {
      id: 'experts',
      target: 'experts',
      icon: Users,
      title: tr.expertsTitle,
      description: tr.expertsDesc,
    },
    {
      id: 'done',
      icon: Sparkles,
      title: tr.doneTitle,
      description: tr.doneDesc,
    },
  ];

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  }, []);

  const current = STEPS[step];
  const isCentered = !current?.target;

  useEffect(() => {
    if (!visible || isCentered) { setTargetRect(null); setTooltipStyle({}); return; }
    const measure = () => {
      const el = document.querySelector(`[data-tour-step="${current.target}"]`);
      if (!el) { setTargetRect(null); setTooltipStyle({}); return; }
      const r = el.getBoundingClientRect();
      const pad = 6;
      setTargetRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
      const tooltipW = 340;
      const spaceRight = window.innerWidth - r.right;
      if (spaceRight > tooltipW + 20) {
        setTooltipStyle({ top: Math.max(12, r.top - 8), left: r.right + 16, width: tooltipW });
      } else {
        setTooltipStyle({ top: r.bottom + 12, left: Math.max(12, Math.min(r.left, window.innerWidth - tooltipW - 12)), width: tooltipW });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [visible, step, isCentered, current?.target]);

  const goNext = () => {
    if (step >= STEPS.length - 1) { complete(); return; }
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 160);
  };
  const goBack = () => {
    if (step <= 0) return;
    setAnimating(true);
    setTimeout(() => { setStep(s => s - 1); setAnimating(false); }, 160);
  };

  if (!visible) return null;

  const progress = step / (STEPS.length - 1);

  const tooltipContent = (
    <div style={{
      background: '#0e0c09', border: '1px solid rgba(197,160,89,0.2)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
      padding: '18px 20px', width: 340,
      opacity: animating ? 0 : 1, transition: 'opacity 0.16s',
      position: 'relative',
    }}>
      {/* Gold top line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #c5a059, transparent)' }} />

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(197,160,89,0.1)', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#c5a059', transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#52463a', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          {tr.stepCounter(step + 1, STEPS.length)}
        </span>
        <button onClick={complete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a342c', padding: 2, display: 'flex' }}>
          <X size={13} />
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f5f0e8', margin: '0 0 7px', lineHeight: 1.3 }}>{current.title}</h3>
      <p style={{ fontSize: 12.5, color: '#7a7268', lineHeight: 1.65, margin: '0 0 14px' }}>{current.description}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={complete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a342c', fontSize: 11, fontWeight: 500 }}>
          {tr.skip}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {step > 0 && (
            <button onClick={goBack} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.1)', color: '#7a7268', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={11} /> {tr.back}
            </button>
          )}
          <button onClick={goNext} style={{ padding: '6px 16px', background: 'rgba(197,160,89,0.14)', border: '1px solid rgba(197,160,89,0.35)', color: '#c5a059', cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            {step === STEPS.length - 1 ? tr.finish : tr.next} <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );

  const centeredModal = (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        pointerEvents: 'auto', width: 460, maxWidth: 'calc(100vw - 32px)',
        background: '#0e0c09', border: '1px solid rgba(197,160,89,0.2)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
        padding: '32px 32px 26px', position: 'relative',
        opacity: animating ? 0 : 1, transition: 'opacity 0.16s',
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #c5a059, transparent)' }} />

        {/* Progress */}
        <div style={{ height: 2, background: 'rgba(197,160,89,0.1)', marginBottom: 18 }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: '#c5a059', transition: 'width 0.4s ease' }} />
        </div>

        <div style={{ width: 56, height: 56, margin: '0 auto 18px', background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <current.icon size={24} style={{ color: '#c5a059' }} />
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#f5f0e8', margin: '0 0 10px', lineHeight: 1.3 }}>{current.title}</h2>
        <p style={{ fontSize: 13.5, color: '#7a7268', lineHeight: 1.7, margin: '0 0 24px' }}>{current.description}</p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={goNext} style={{ padding: '10px 28px', background: 'rgba(197,160,89,0.14)', border: '1px solid rgba(197,160,89,0.4)', color: '#c5a059', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em' }}>
            {step === 0 ? tr.start : tr.finish}
            <ArrowRight size={13} />
          </button>
          {step === 0 && (
            <button onClick={complete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a342c', fontSize: 11 }}>
              {tr.skip}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Overlay */}
      {targetRect ? (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <mask id="oc-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={targetRect.left} y={targetRect.top} width={targetRect.width} height={targetRect.height} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#oc-tour-mask)" />
        </svg>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
      )}

      {/* Highlight ring */}
      {targetRect && (
        <div style={{
          position: 'absolute',
          top: targetRect.top, left: targetRect.left,
          width: targetRect.width, height: targetRect.height,
          border: '2px solid rgba(197,160,89,0.6)',
          boxShadow: '0 0 0 4px rgba(197,160,89,0.08), 0 0 24px rgba(197,160,89,0.2)',
          pointerEvents: 'none', transition: 'all 0.3s ease',
        }} />
      )}

      {isCentered
        ? centeredModal
        : <div style={{ position: 'absolute', ...tooltipStyle, pointerEvents: 'auto' }}>{tooltipContent}</div>
      }
    </div>
  );
}

export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}
