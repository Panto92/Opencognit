// War Room ("Lagezentrum") — a full-screen live wall for a second screen, built on the main
// project's task API: the Swarm view (cinematic canvas of the company's task DAG) fills the
// stage, the side column lists what waits for a human (blocked tasks) and what just finished.
// Data comes from useTaskSwarm (React Query polling); the previous implementation lives on as
// WarRoom.legacy.tsx.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, CheckCircle2, Loader2, Hexagon, ArrowRight } from 'lucide-react';
import { useCompany } from '../hooks/useCompany';
import { useI18n } from '../i18n';
import { SwarmView } from '@/components/swarm/SwarmView';
import { useTaskSwarm } from '@/components/swarm/useTaskSwarm';
import type { Aufgabe } from '@/api/types';

export function WarRoom() {
  const navigate = useNavigate();
  const { aktivesUnternehmen } = useCompany();
  const { t, language } = useI18n();
  const [now, setNow] = useState(new Date());

  const companyId = aktivesUnternehmen?.id ?? null;
  const { model, loading, tasks } = useTaskSwarm(companyId, aktivesUnternehmen?.name ?? 'OpenCognit');

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate(-1); };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(clock); window.removeEventListener('keydown', onKey); };
  }, [navigate]);

  const waiting = tasks.filter((task) => task.status === 'blocked');
  const finished = tasks
    .filter((task) => task.status === 'done')
    .sort((a, b) => (b.abgeschlossenAm ?? b.aktualisiertAm).localeCompare(a.abgeschlossenAm ?? a.aktualisiertAm))
    .slice(0, 6);

  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const taskTitle = (task: Aufgabe) => (task as Aufgabe & { title?: string }).title ?? task.titel;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070605] text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-2 w-2 rounded-full ${model?.running ? 'bg-brand-400 animate-pulse' : 'bg-white/25'}`} />
          <span className="text-[15px] font-bold">{t.warroom.title}</span>
          <span className="text-[13px] text-white/40 truncate">· {aktivesUnternehmen?.name ?? 'OpenCognit'}</span>
        </div>
        <div className="text-center">
          <div className="text-[26px] font-extrabold tabular-nums leading-none">{timeStr}</div>
          <div className="text-[12px] text-white/40 mt-1">{dateStr}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/35 hidden md:inline">{t.warroom.escToExit}</span>
          <button type="button" className="oc-iconbtn" onClick={() => navigate(-1)} aria-label={t.warroom.close}><X size={16} /></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Main: the swarm canvas */}
        <main className="min-h-0 flex flex-col px-6 py-4">
          {loading ? (
            <div className="text-white/40 text-[13px] m-auto">
              <Loader2 size={14} className="inline animate-spin mr-2" />{t.warroom.loading}
            </div>
          ) : model && model.nodes.length === 0 ? (
            <div className="oc-card p-10 text-center m-auto max-w-md">
              <Hexagon size={28} className="mx-auto text-white/25" />
              <div className="mt-3 text-[15px] font-semibold text-white/80">{t.warroom.noTasks}</div>
              <div className="mt-1 text-[13px] text-white/45">{t.warroom.noTasksHint}</div>
              <button type="button" className="oc-pill oc-pill--gold mt-4" onClick={() => navigate('/tasks')}>
                <ArrowRight size={14} /> {t.warroom.newTask}
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 -my-1">
              <SwarmView model={model} loading={loading} onNodeClick={() => navigate('/tasks')} />
            </div>
          )}
        </main>

        {/* Side column */}
        <aside className="border-l border-white/5 overflow-y-auto px-5 py-5 space-y-6 hidden lg:block">
          <section>
            <h2 className="m-0 mb-2.5 text-[12px] font-semibold tracking-wide text-white/45">{t.warroom.needsYou}</h2>
            {waiting.length === 0 ? (
              <div className="oc-card px-4 py-3 text-[12.5px] text-white/40">{t.warroom.nothingOpen}</div>
            ) : (
              <div className="space-y-2">
                {waiting.map((task) => (
                  <button key={task.id} type="button" onClick={() => navigate('/tasks')}
                    className="oc-card oc-card--clickable w-full text-left px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-white/85 truncate">{taskTitle(task)}</span>
                      <span className="block text-[12px] text-white/45">{t.swarm.stages.needs_you}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="m-0 mb-2.5 text-[12px] font-semibold tracking-wide text-white/45">{t.warroom.recentlyDone}</h2>
            {finished.length === 0 ? (
              <div className="oc-card px-4 py-3 text-[12.5px] text-white/40">{t.warroom.nothingYet}</div>
            ) : (
              <div className="oc-card p-1.5">
                {finished.map((task) => (
                  <button key={task.id} type="button" onClick={() => navigate('/tasks')}
                    className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-white/[0.04]">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-white/80 truncate">{taskTitle(task)}</span>
                      <span className="block text-[11px] text-white/35">
                        {new Date(task.abgeschlossenAm ?? task.aktualisiertAm).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default WarRoom;
