// Checks what phones send, and turns the totals into the PRD's success measures.
// No database or Cloudflare code here, so it can be tested in Node.

export const EVENTS = new Set(['visit', 'returned', 'load', 'path', 'level_start', 'level_done', 'day_done', 'quiz', 'challenge', 'cv_click']);
export const MAX_BATCH = 50;

const LABEL = /^[a-z0-9_]{1,24}$/;
const PID = /^[a-z0-9]{16}$/;
const int = (x, lo, hi) => (Number.isInteger(x) && x >= lo && x <= hi ? x : null);

// Keeps only known events and known fields. Anything else a phone sends is dropped.
export function normalize(batch) {
  if (!Array.isArray(batch)) return [];
  const out = [];
  for (const raw of batch.slice(0, MAX_BATCH)) {
    if (!raw || !EVENTS.has(raw.e)) continue;
    const item = { e: raw.e, k: typeof raw.k === 'string' && LABEL.test(raw.k) ? raw.k : '', v: Number.isFinite(raw.v) ? Math.max(0, Math.min(raw.v, 600000)) : 0 };
    if (typeof raw.pid === 'string' && PID.test(raw.pid)) {
      item.pid = raw.pid;
      item.level = int(raw.level, 1, 7);
      item.day = int(raw.day, 1, 100000);
      item.score = int(raw.score, 0, 100);
    }
    out.push(item);
  }
  return out;
}

// rows: [{ event, key, n, sum }] added up over the period.
export function summarize(rows) {
  const count = (event, key) => rows.filter((r) => r.event === event && (key === undefined || r.key === key)).reduce((a, r) => a + r.n, 0);
  const total = (event, key) => rows.filter((r) => r.event === event && (key === undefined || r.key === key)).reduce((a, r) => a + r.sum, 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const visitors = count('visit', 'new');
  const quizzes = count('quiz', 'level');
  const loads = count('load');
  return {
    visits: count('visit'),
    visitors,
    measures: [
      { name: 'Finish Level 1', value: pct(count('level_done', '1'), count('level_start', '1')), unit: '%', target: 60, better: 'high' },
      { name: 'Come back within a week', value: pct(count('returned', 'week'), visitors), unit: '%', target: 30, better: 'high' },
      { name: 'Quiz understanding', value: quizzes ? Math.round(total('quiz', 'level') / quizzes) : null, unit: '%', target: 70, better: 'high' },
      { name: 'Click through to CreditVoice', value: pct(count('cv_click'), visitors), unit: '%', target: 10, better: 'high' },
      { name: 'First load (all connections)', value: loads ? Math.round(total('load') / loads / 100) / 10 : null, unit: 's', target: 5, better: 'low' },
    ],
  };
}

export function statsPage(s) {
  const met = (m) => (m.value == null ? '–' : (m.better === 'high' ? m.value >= m.target : m.value <= m.target) ? 'On target' : 'Below target');
  const rows = s.measures.map((m) => `<tr><td>${m.name}</td><td>${m.value == null ? 'No data yet' : m.value + m.unit}</td><td>${m.better === 'high' ? 'at least' : 'under'} ${m.target}${m.unit}</td><td>${met(m)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Oga Shop numbers</title>
<style>body{font-family:system-ui,sans-serif;margin:0 auto;padding:16px;max-width:720px;color:#17231C;background:#F3F5F2}table{width:100%;border-collapse:collapse;background:#fff}td,th{padding:10px;border-bottom:1px solid #DCE3DD;text-align:left}</style></head>
<body><h1>Oga Shop numbers</h1><p><b>${s.visitors}</b> visitors · <b>${s.visits}</b> visits</p>
<table><tr><th>Measure</th><th>Now</th><th>Target</th><th></th></tr>${rows}</table></body></html>`;
}
