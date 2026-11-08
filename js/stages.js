// Each level is split into 3 short stages, one idea each. Stages move on by day and never block the player.
// On the learning path new ideas arrive stage by stage; "I run a business" has everything from Day 1.

import { isGuided, isJunior, JUNIOR_STAGE_GOALS } from './junior.js';

export const STAGE_ENDS = [2, 4, 7]; // last day of each stage in a level

export const STAGES = {
  1: [
    { name: 'Sell and count', learn: 'Customers pay you, and your cash grows. Count your money carefully.', goal: { type: 'sales', n: 6, text: 'Serve 6 customers' } },
    { name: 'Record every sale', learn: 'A sale you record is a sale you can trust. Your records answer your questions.', goal: { type: 'recorded', n: 5, text: 'Record 5 sales yourself' } },
    { name: 'Cash vs profit', learn: 'Cash is what you hold. Profit is what you keep after paying for your goods and bills.', goal: { type: 'profit', n: 2000, text: 'Make ₦2,000 profit' } },
  ],
  2: [
    { name: 'Keep the shelves full', learn: 'Running out loses sales. Buy what sells, and only a little of what spoils.', goal: { type: 'clean', n: 1, text: 'End a day with no goods run out' } },
    { name: 'Credit and reminders', learn: 'Credit brings sales only if you record it and remind people on the due day.', goal: { type: 'credit', n: 2, text: 'Give credit and record it 2 times' } },
    { name: 'Rent and bills', learn: 'Big bills come. Keep cash aside for them before you spend it all on stock.', goal: { type: 'bills', n: 1, text: 'Pay a bill' } },
  ],
};

const dayInLevel = (s) => s.day - s.levelStartDay + 1;

export function stageIndex(s) {
  const d = dayInLevel(s);
  return d <= STAGE_ENDS[0] ? 0 : d <= STAGE_ENDS[1] ? 1 : 2;
}

export function currentStage(s) {
  const def = STAGES[s.level]?.[stageIndex(s)];
  return def ? { ...def, goal: goalFor(s, s.level, stageIndex(s)), index: stageIndex(s) } : null;
}

function goalFor(s, level, index) {
  const goal = STAGES[level][index].goal;
  return isJunior(s) ? { ...goal, ...(JUNIOR_STAGE_GOALS[level]?.[index] || {}) } : goal;
}

// Learning path only: which ideas are held back until a later stage.
const learning = (s) => isGuided(s) && !!STAGES[s.level];
export const tiTiRecordsForYou = (s) => learning(s) && s.level === 1 && stageIndex(s) === 0;
export const creditAllowed = (s) => !learning(s) || stageIndex(s) >= 1;
export const supplierCreditOpen = (s) => !learning(s) || s.level !== 2 || stageIndex(s) >= 2;

export function enterStage(s) {
  if (!STAGES[s.level]) return;
  const index = stageIndex(s);
  if (s.stage?.level === s.level && s.stage.index === index) return;
  s.stage = { level: s.level, index, progress: 0, billsBase: s.stats.billsPaid, done: false };
}

function todaysProgress(s) {
  const t = s.today;
  switch (STAGES[s.level][s.stage.index].goal.type) {
    case 'sales': return t.sales;
    case 'recorded': return t.recordedSales - (t.autoRecorded || 0);
    case 'profit': return t.profit;
    case 'clean': return t.sales > 0 && t.stockouts.length === 0 ? 1 : 0;
    case 'credit': return t.creditRecorded || 0;
    default: return 0;
  }
}

// In the evening: add up today, and report the stage if it has just ended.
export function finishStageDay(s) {
  if (!s.stage || !STAGES[s.level] || s.stage.done) return null;
  const def = STAGES[s.level][s.stage.index];
  const goal = goalFor(s, s.level, s.stage.index);
  s.stage.progress += todaysProgress(s);
  const progress = goal.type === 'bills' ? s.stats.billsPaid - s.stage.billsBase : s.stage.progress;
  const ended = s.today.levelUp || dayInLevel(s) === STAGE_ENDS[s.stage.index];
  if (!ended) return null;
  s.stage.done = true;
  const met = progress >= goal.n;
  const stars = met ? 3 : progress >= goal.n / 2 ? 2 : 1;
  s.stageLog.push({ level: s.level, index: s.stage.index, stars, met });
  const next = STAGES[s.level][s.stage.index + 1];
  return { level: s.level, index: s.stage.index, name: def.name, learn: def.learn, goal: goal.text, progress: Math.max(0, progress), target: goal.n, met, stars, next: s.today.levelUp ? null : next?.name || null };
}

// Progress so far today's morning shows (bills are counted from the stage's start).
export function stageProgress(s) {
  if (!s.stage || !STAGES[s.level]) return 0;
  const def = STAGES[s.level][s.stage.index];
  return Math.max(0, def.goal.type === 'bills' ? s.stats.billsPaid - s.stage.billsBase : s.stage.progress);
}
