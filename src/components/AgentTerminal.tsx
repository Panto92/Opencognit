import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Terminal, Square, Loader2, AlertCircle } from 'lucide-react';

interface TerminalLine {
  type: 'stdout' | 'stderr' | 'system' | 'prompt';
  text: string;
  ts: number;
}

// Strip ANSI escape codes (colors, cursor positioning, etc.)
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][0-9;]*\x07/g, '').replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '');
}

export function AgentTerminal({
  agentId,
  agentName,
  de,
}: {
  agentId: string;
  agentName: string;
  de: boolean;
}) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    const clean = stripAnsi(text);
    if (!clean) return;
    setLines(prev => [...prev, { type, text: clean, ts: Date.now() }]);
  }, []);

  const killExecution = useCallback(async () => {
    // Abort the fetch stream first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      const token = localStorage.getItem('opencognit_token');
      await fetch(`/api/agents/${agentId}/execute/kill`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      addLine('system', de ? '\n[Prozess abgebrochen]' : '\n[Process killed]');
    } catch (e) {
      // ignore
    }
    setRunning(false);
  }, [agentId, de, addLine]);

  const execute = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || running) return;

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRunning(true);
    setError(null);
    setHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    addLine('prompt', `$ ${cmd}`);
    setInput('');

    const runStream = async (retryCount = 0) => {
      try {
        const token = localStorage.getItem('opencognit_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const resp = await fetch(`/api/agents/${agentId}/execute`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ command: cmd }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${resp.status}`);
        }

        // Read SSE stream
        const reader = resp.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let receivedExit = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            const eventMatch = chunk.match(/^event: (\w+)/m);
            const dataMatch = chunk.match(/^data: (.+)/m);
            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1];
            let data: any;
            try { data = JSON.parse(dataMatch[1]); } catch { data = { text: dataMatch[1] }; }

            switch (eventType) {
              case 'stdout':
                addLine('stdout', data.text);
                break;
              case 'stderr':
                addLine('stderr', data.text);
                break;
              case 'exit':
                addLine('system', de
                  ? `\n[Beendet — Code ${data.code}, ${data.durationMs}ms]`
                  : `\n[Exit — code ${data.code}, ${data.durationMs}ms]`);
                receivedExit = true;
                setRunning(false);
                break;
              case 'error':
                addLine('stderr', data.text);
                receivedExit = true;
                setRunning(false);
                break;
            }
          }
        }

        // If stream ended without exit event, show warning
        if (!receivedExit) {
          addLine('system', de ? '\n[Stream unterbrochen]' : '\n[Stream interrupted]');
          setRunning(false);
        }
      } catch (e: any) {
        // Don't retry if user aborted
        if (e.name === 'AbortError') {
          addLine('system', de ? '\n[Abgebrochen]' : '\n[Cancelled]');
          setRunning(false);
          return;
        }

        // Retry up to 2 times on network errors
        if (retryCount < 2 && (e.message?.includes('network') || e.message?.includes('fetch'))) {
          addLine('system', de ? `\n[Verbindung verloren — Retry ${retryCount + 1}/2...]` : `\n[Connection lost — retry ${retryCount + 1}/2...]`);
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return runStream(retryCount + 1);
        }

        setError(e.message);
        addLine('stderr', `\n[Error: ${e.message}]`);
        setRunning(false);
      }
    };

    runStream();
  }, [input, running, agentId, de, addLine]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      execute();
      return;
    }
    if (e.key === 'c' && e.ctrlKey && running) {
      e.preventDefault();
      killExecution();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }
  };

  const clear = () => setLines([]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 320,
      background: 'rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={11} style={{ color: '#c5a059' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#c5a059', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {agentName} Terminal
          </span>
          {running && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#c5a059' }}>
              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              {de ? 'läuft…' : 'running…'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {running && (
            <button
              onClick={killExecution}
              title={de ? 'Abbrechen (Ctrl+C)' : 'Kill (Ctrl+C)'}
              style={{
                background: 'rgba(201,123,123,0.15)',
                border: '1px solid rgba(201,123,123,0.3)',
                color: '#c97b7b',
                padding: '2px 6px',
                fontSize: 8,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Square size={8} /> {de ? 'KILL' : 'KILL'}
            </button>
          )}
          <button
            onClick={clear}
            style={{
              background: 'none',
              border: 'none',
              color: '#334155',
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            {de ? 'Leeren' : 'Clear'}
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          color: '#a0a0a0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {lines.length === 0 && (
          <div style={{ color: '#334155', fontStyle: 'italic' }}>
            {de
              ? `Tippe einen Befehl und drücke Enter.\nCtrl+C zum Abbrechen. ↑/↓ für Historie.`
              : `Type a command and press Enter.\nCtrl+C to abort. ↑/↓ for history.`}
          </div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color:
                line.type === 'stderr'
                  ? '#c97b7b'
                  : line.type === 'system'
                    ? '#7cb97a'
                    : line.type === 'prompt'
                      ? '#c5a059'
                      : '#a0a0a0',
            }}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <span style={{ color: '#c5a059', fontWeight: 800, fontSize: 12 }}>$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={de ? 'Befehl eingeben…' : 'Enter command…'}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#e4e4e7',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            caretColor: '#c5a059',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {running ? (
          <Loader2 size={12} style={{ color: '#c5a059', animation: 'spin 1s linear infinite' }} />
        ) : (
          <button
            onClick={execute}
            disabled={!input.trim()}
            style={{
              background: 'none',
              border: 'none',
              color: input.trim() ? '#c5a059' : '#334155',
              cursor: input.trim() ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <Terminal size={12} />
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '4px 10px',
          fontSize: 9,
          color: '#c97b7b',
          background: 'rgba(201,123,123,0.08)',
          borderTop: '1px solid rgba(201,123,123,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <AlertCircle size={10} /> {error}
        </div>
      )}
    </div>
  );
}
