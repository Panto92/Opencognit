import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowUp, FileText, Mic, Square, X } from 'lucide-react';

// Chat input for a coding agent: auto-growing text field, long pastes become cards (logs,
// stack traces), browser dictation, one button that sends or stops.

export interface PastedContent { id: string; content: string }

export interface ChatInputHandle {
  /** Focus the field with the cursor at the end (after a quick action filled it in). */
  focusEnd: () => void;
}

export interface ChatInputProps {
  onSend: (data: { message: string; pasted: PastedContent[] }) => void;
  onStop?: () => void;
  loading?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lang?: string;
}

const PASTE_AS_CARD_CHARS = 200;

function PastedCard({ content, onRemove, de }: { content: PastedContent; onRemove: () => void; de: boolean }) {
  const preview = content.content.slice(0, 80).replace(/\n/g, ' ');
  return (
    <div className="relative group flex-shrink-0 max-w-[260px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center">
        <FileText className="w-3.5 h-3.5 text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-white/80 truncate">
          {de ? 'Eingefügter Text' : 'Pasted text'} · {content.content.split('\n').length} {de ? 'Zeilen' : 'lines'}
        </p>
        <p className="text-[10px] text-white/50 truncate" title={content.content.slice(0, 1000)}>
          {preview}{content.content.length > 80 ? '…' : ''}
        </p>
      </div>
      <button type="button" onClick={onRemove} aria-label={de ? 'Entfernen' : 'Remove'}
        className="flex-shrink-0 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onStop, loading, value, onChange, placeholder, lang = 'de' }, ref,
) {
  const de = lang === 'de';
  const [pasted, setPasted] = useState<PastedContent[]>([]);
  const [dictating, setDictating] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = el.scrollHeight;
    el.style.height = `${Math.max(48, Math.min(h, 384))}px`;
    setOverflowing(h > 384);
  }, []);
  useEffect(adjustHeight, [value, adjustHeight]);
  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [adjustHeight]);

  useImperativeHandle(ref, () => ({
    focusEnd: () => setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0),
  }), []);

  // Browser dictation (Chrome/Edge). Hidden where the Web Speech API is missing.
  const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const toggleDictation = () => {
    if (!speechSupported) return;
    if (dictating) { recognitionRef.current?.stop(); return; }
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = de ? 'de-DE' : 'en-US';
    rec.onstart = () => setDictating(true);
    rec.onend = () => setDictating(false);
    rec.onerror = () => setDictating(false);
    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      const prev = valueRef.current;
      if (transcript.trim()) onChange(prev + (prev.trim() ? ' ' : '') + transcript.trim());
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { setDictating(false); }
  };
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text && text.length > PASTE_AS_CARD_CHARS) {
      e.preventDefault();
      setPasted((p) => [...p, { id: Math.random().toString(36).slice(2, 11), content: text }]);
    }
  };

  const hasContent = !!value.trim() || pasted.length > 0;
  const send = () => {
    if (!hasContent || loading) return;
    onSend({ message: value, pasted });
    onChange('');
    setPasted([]);
    requestAnimationFrame(() => requestAnimationFrame(() => textareaRef.current?.focus()));
  };

  return (
    <div className="relative w-full font-sans">
      <div className="flex flex-col items-stretch relative z-10 rounded-2xl cursor-text border border-white/10 bg-zinc-900/80 hover:border-brand-500/30 focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/10 shadow-lg shadow-black/20 transition-all duration-200">
        <div className="flex flex-col px-3 sm:px-4 pt-2 sm:pt-3 pb-2 sm:pb-3">
          <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: pasted.length ? '1fr' : '0fr' }}>
            <div className="overflow-hidden">
              <div className="flex gap-3 overflow-x-auto pb-3.5 px-1 pt-0.5">
                {pasted.map((c) => (
                  <PastedCard key={c.id} content={c} de={de} onRemove={() => setPasted((p) => p.filter((x) => x.id !== c.id))} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0 pl-1">
              {dictating ? (
                <div className="flex items-center gap-[3px] h-[48px] px-1" aria-live="polite" aria-label={de ? 'Diktat läuft' : 'Dictating'}>
                  {Array.from({ length: 36 }, (_, i) => (
                    <div key={i} className="rounded-full bg-brand-400/75 flex-shrink-0 motion-reduce:!animate-none"
                      style={{ width: 3, height: 3, animation: `voiceBar ${0.6 + (i % 6) * 0.12}s ease-in-out ${(i % 8) * 0.08}s infinite alternate` }} />
                  ))}
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  rows={1}
                  disabled={loading}
                  className={`block w-full bg-transparent border-0 outline-none resize-none py-3 text-[15px] leading-relaxed text-white/90 placeholder:text-white/35 caret-brand-400 min-h-[1.6em] ${overflowing ? 'overflow-y-auto' : 'overflow-y-hidden'}`}
                />
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {speechSupported && (
                <button type="button" onClick={toggleDictation} disabled={loading}
                  title={dictating ? (de ? 'Aufnahme stoppen' : 'Stop dictation') : (de ? 'Diktieren' : 'Dictate')}
                  aria-label={dictating ? (de ? 'Aufnahme stoppen' : 'Stop dictation') : (de ? 'Diktieren' : 'Dictate')}
                  className={`inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors ${dictating ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-white/40 hover:text-white hover:bg-white/10'}`}>
                  {dictating ? <Square className="w-4 h-4 fill-red-400" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
              <button type="button"
                onClick={loading ? onStop : send}
                disabled={loading ? !onStop : !hasContent}
                title={loading ? (de ? 'Stoppen' : 'Stop') : (de ? 'Senden' : 'Send')}
                aria-label={loading ? (de ? 'Stoppen' : 'Stop') : (de ? 'Senden' : 'Send')}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 hover:from-brand-200 hover:to-brand-500 text-[#1a1206] shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-default">
                {loading ? <Square className="w-4 h-4 fill-current" /> : <ArrowUp className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
