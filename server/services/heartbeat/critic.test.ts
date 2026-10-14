import { describe, it, expect } from 'vitest';
import { detectFailureOutput } from './critic.js';

describe('Critic — detectFailureOutput', () => {
  // ── must REJECT (deterministic, no LLM involved) ──────────────────────────

  it('rejects empty / near-empty output', () => {
    expect(detectFailureOutput('')).toBeTruthy();
    expect(detectFailureOutput('   ')).toBeTruthy();
    expect(detectFailureOutput('ok')).toBeTruthy();
  });

  it('rejects rate-limit notices (the original incident)', () => {
    expect(detectFailureOutput('Error: rate limit reached. Please try again later.')).toBeTruthy();
    expect(detectFailureOutput('429 Too Many Requests — usage limit exceeded for this week.')).toBeTruthy();
  });

  it('rejects auth failures', () => {
    expect(detectFailureOutput('Error: authentication failed — invalid api key')).toBeTruthy();
    expect(detectFailureOutput('401 Unauthorized')).toBeTruthy();
  });

  it('rejects CLI usage dumps and bad invocations', () => {
    expect(detectFailureOutput('usage: kimi [options] <prompt>')).toBeTruthy();
    expect(detectFailureOutput('error: unknown option --auto')).toBeTruthy();
    expect(detectFailureOutput('bash: foo: command not found')).toBeTruthy();
  });

  it('rejects network errors', () => {
    expect(detectFailureOutput('fetch failed: connect ECONNREFUSED 127.0.0.1:3201')).toBeTruthy();
  });

  it('rejects stack traces at any length', () => {
    const jsTrace = 'Error: boom\n' + '    at foo (/app/x.ts:1:1)\n    at bar (/app/y.ts:2:2)\n    at baz (/app/z.ts:3:3)\n'.repeat(3);
    expect(detectFailureOutput(jsTrace)).toBeTruthy();
    expect(detectFailureOutput('Traceback (most recent call last):\n  File "a.py", line 1\nZeroDivisionError')).toBeTruthy();
  });

  it('rejects package manager errors', () => {
    expect(detectFailureOutput('npm ERR! code ELIFECYCLE')).toBeTruthy();
  });

  // ── must PASS through to the LLM review (no false positives) ─────────────

  it('passes a normal deliverable', () => {
    const deliverable = 'Ich habe die Datei hello.txt angelegt und den Inhalt geprüft. Die Aufgabe ist vollständig erledigt.';
    expect(detectFailureOutput(deliverable)).toBeNull();
  });

  it('passes long output that merely mentions errors (e.g. log analysis)', () => {
    const analysis = 'Analyse des Fehlerlogs:\n\n' +
      'Die Logdatei enthält mehrere Einträge mit "ECONNREFUSED" und "rate limit". ' +
      'Ursache ist der Proxy. Empfehlung: Retry-Logik mit Backoff einbauen. '.repeat(14);
    expect(analysis.length).toBeGreaterThan(800);
    expect(detectFailureOutput(analysis)).toBeNull();
  });

  it('passes a long bug report that starts with quoted error text', () => {
    const report = 'Fehleranalyse der Anwendung:\n\n' +
      'Der Nutzer meldet "Error: invalid api key" beim Login. ' +
      'Nach Untersuchung liegt das Problem im Key-Rotation-Prozess. '.repeat(12);
    expect(report.length).toBeGreaterThan(800);
    expect(detectFailureOutput(report)).toBeNull();
  });

  it('passes code output containing error handling', () => {
    const code = `Hier ist die Implementierung:\n\n\`\`\`ts\nif (!key) throw new Error('invalid api key');\n\`\`\`\n\nDie Funktion validiert den Key vor dem Request und wirft einen verständlichen Fehler.`;
    expect(detectFailureOutput(code)).toBeNull();
  });
});
