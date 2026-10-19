// Run with node scripts/test-final-exam.mjs. Tests use an isolated in-memory SQLite database.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'mock:workers', shortCircuit: true };
    if (specifier.startsWith('@/')) specifier = pathToFileURL(resolve(root, specifier.slice(2))).href;
    if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['', '.ts', '.tsx', '.json']) {
        if (existsSync(fileURLToPath(base) + ext)) return next(base.href + ext, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'mock:workers') return { format: 'module', shortCircuit: true, source: 'export const env = { DB: globalThis.__examTestDb };' };
    if (url.startsWith(pathToFileURL(root + '/').href) && /\.(ts|tsx|json)$/.test(url) && !url.includes('/node_modules/')) {
      const raw = readFileSync(new URL(url), 'utf8');
      return { format: 'module', shortCircuit: true, source: url.endsWith('.json') ? `export default ${raw}` : ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    }
    return next(url, context);
  },
});

const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync(resolve(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(resolve(root, 'drizzle', file), 'utf8'));
globalThis.__examTestDb = { prepare(query) {
  const statement = sqlite.prepare(query);
  const wrapper = (args = []) => ({
    bind: (...values) => wrapper(values),
    all: async () => ({ results: statement.all(...args) }),
    first: async () => statement.get(...args) || null,
    run: async () => ({ meta: { changes: statement.run(...args).changes } }),
  });
  return wrapper();
} };

const { finalExamBank: bank } = await import('../lib/final-exam-bank.ts');
const { scoreQuestion, validResponse, publicQuestion, completedTopics } = await import('../lib/final-exam.ts');
const { default: quizzes } = await import('../lib/content/quizzes.json');
const { default: lessons } = await import('../lib/content/lessons.json');
const { GET, POST } = await import('../app/api/final-exam/route.ts');
const study = await import('../app/api/study/route.ts');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
async function post(body, expected = 200) {
  const response = await POST(new Request('https://aneth.test/api/final-exam', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aneth.test' }, body: JSON.stringify(body) }));
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data)); checks++;
  return data;
}
async function get(id) { const response = await GET(new Request('https://aneth.test/api/final-exam' + (id ? '?session=' + id : ''))); assert.equal(response.status, 200); checks++; return response.json(); }

check(bank.length === 32 && new Set(bank.map(q => q.id)).size === 32, '32 unique final IDs');
const oldPrompts = new Set(quizzes.flatMap(q => q.questions.map(p => p.prompt)));
const oldIds = new Set(quizzes.flatMap(q => q.questions.map(p => p.id)));
for (const q of bank) {
  check(!oldPrompts.has(q.prompt) && !oldIds.has(q.id), 'Independent final bank');
  check(validResponse(q, q.solution, true), `Valid solution: ${q.id}`);
  check(scoreQuestion(q, q.solution) === (q.kind === 'open' ? null : 4), `Correct grading: ${q.id}`);
  for (const secret of ['solution', 'accepted', 'rubric', 'explanation', 'source']) check(!(secret in publicQuestion(q)), `No ${secret} in public question`);
  if (q.kind === 'open') check(q.rubric.length === 4, 'Four open criteria');
}
for (const topic of lessons) check(bank.filter(q => q.topicId === topic.id).length === 4, 'Four final questions per topic');
for (const kind of ['single', 'multiple', 'blank', 'match', 'order', 'classify', 'open']) check(bank.filter(q => q.kind === kind).length === (kind === 'open' ? 8 : 4), 'Seven balanced formats');
const blank = bank.find(q => q.kind === 'blank');
check(scoreQuestion(blank, Object.fromEntries(Object.entries(blank.solution).map(([key, value]) => [key, value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()]))) === 4, 'Accents and case do not affect blanks');
const multi = bank.find(q => q.kind === 'multiple');
check(!validResponse(multi, [multi.solution[0], multi.solution[0]], true), 'Reject duplicate choices');
check(scoreQuestion(multi, [...multi.solution, multi.options.find(o => !multi.solution.includes(o.id)).id]) < 4, 'Wrong extra choice costs points');
check(scoreQuestion(multi, multi.options.filter(o => !multi.solution.includes(o.id)).map(o => o.id)) === 0, 'Never negative score');
const match = bank.find(q => q.kind === 'match');
check(scoreQuestion(match, { ...match.solution, a: Object.values(match.solution).find(id => id !== match.solution.a) }) === 3, 'Connections get partial credit');
const ordered = bank.find(q => q.kind === 'order');
check(scoreQuestion(ordered, [...ordered.solution].reverse()) === 0, 'Wrong order does not receive accidental credit');
check(!validResponse(bank.find(q => q.kind === 'open'), ' '.repeat(10), true), 'Blank prose is incomplete');

let dashboard = await get();
check(!dashboard.readiness.unlocked && dashboard.readiness.completed === 0, 'Initially locked');
await post({ action: 'start' }, 403);
const integrated = quizzes.find(q => q.id === 'm1-integral');
check(completedTopics(lessons, [{ quiz_id: integrated.id, title: integrated.title, questions: JSON.stringify(integrated.questions), completed: 1 }]).every(t => t.completed), 'Existing full integral counts');
check(completedTopics(lessons, [{ quiz_id: integrated.id, title: integrated.title + ' · Repaso', questions: JSON.stringify(integrated.questions), completed: 1 }]).every(t => !t.completed), 'Review sessions do not unlock');
const topicQuizzes = quizzes.filter(q => q.id !== 'm1-integral');
const seed = sqlite.prepare('INSERT INTO study_sessions (id,quiz_id,title,questions,answers,position,completed,updated_at,revision) VALUES (?,?,?,?,?,?,?,?,?)');
for (const quiz of topicQuizzes.slice(0, 7)) seed.run(quiz.id, quiz.id, quiz.title, JSON.stringify(quiz.questions), JSON.stringify(quiz.questions.map(q => ({ questionId: q.id, selected: q.answer, correct: true }))), 8, 1, new Date().toISOString(), 0);
check((await get()).readiness.completed === 7, 'Seven topics still locked');
await post({ action: 'start' }, 403);
const lastQuiz = topicQuizzes[7];
seed.run(lastQuiz.id, lastQuiz.id, lastQuiz.title, JSON.stringify(lastQuiz.questions), JSON.stringify(lastQuiz.questions.map(q => ({ questionId: q.id, selected: q.answer, correct: true }))), 8, 1, new Date().toISOString(), 0);
check((await get()).readiness.unlocked, 'Eight topics unlock');
let active = await post({ action: 'start' });
check((await post({ action: 'start' })).session.id === active.session.id, 'Start resumes existing draft');
check(active.results.length === 0 && active.session.objectivePercent === null, 'No draft grading leaks');
for (const q of active.questions) check(!('solution' in q) && !('rubric' in q), 'API hides answer keys');
await post({ action: 'submit', sessionId: active.session.id, revision: active.revision }, 400);
await post({ action: 'assess', sessionId: active.session.id, revision: active.revision, questionId: bank.find(q => q.kind === 'open').id, marks: { a: true, b: true, c: true, d: true } }, 409);
await post({ action: 'save', sessionId: active.session.id, revision: active.revision, questionId: active.questions[0].id, response: 'unknown-choice', cursor: 0 }, 400);
active = await post({ action: 'save', sessionId: active.session.id, revision: active.revision, questionId: active.questions[0].id, response: '', cursor: 2 });
check(active.session.answered === 0 && (await get(active.session.id)).cursor === 2, 'Save partial draft and cursor');
await post({ action: 'save', sessionId: active.session.id, revision: active.revision - 1, questionId: active.questions[0].id, response: '', cursor: 0 }, 409);
for (let i = 0; i < active.questions.length; i++) {
  const question = bank.find(q => q.id === active.questions[i].id);
  active = await post({ action: 'save', sessionId: active.session.id, revision: active.revision, questionId: question.id, response: question.solution, cursor: i });
}
check(active.session.answered === 32, 'All answer formats persisted');
const resumed = await get(active.session.id);
check(JSON.stringify(resumed.answers) === JSON.stringify(active.answers), 'All answers survive reload');
check(resumed.results.length === 0, 'Solutions still hidden after answering everything');
active = await post({ action: 'submit', sessionId: active.session.id, revision: active.revision });
check(active.session.status === 'submitted' && active.results.length === 32, 'Submission reveals full feedback');
check(active.session.objectivePercent === 100 && active.session.overallPercent === null, 'Objective and subjective scores separated');
await post({ action: 'save', sessionId: active.session.id, revision: active.revision, questionId: active.questions[0].id, response: '', cursor: 0 }, 409);
await post({ action: 'assess', sessionId: active.session.id, revision: active.revision, questionId: bank.find(q => q.kind === 'open').id, marks: { a: true } }, 400);
for (const question of bank.filter(q => q.kind === 'open')) active = await post({ action: 'assess', sessionId: active.session.id, revision: active.revision, questionId: question.id, marks: Object.fromEntries(question.rubric.map(c => [c.id, true])) });
check(active.session.overallPercent === 100 && active.session.reviewedOpen === 8, 'Rubrics complete combined score');
active = await post({ action: 'assess', sessionId: active.session.id, revision: active.revision, questionId: bank.find(q => q.kind === 'open').id, marks: { a: false, b: false, c: false, d: false } });
check(active.session.overallPercent === 97 && active.session.objectivePercent === 100, 'Self evaluation changes only its part');
const retry = await post({ action: 'start' });
check(retry.session.id !== active.session.id && (await get()).sessions.length === 2, 'New attempt preserves history');
const crossOrigin = await POST(new Request('https://aneth.test/api/final-exam', { method: 'POST', headers: { Origin: 'https://other.test' }, body: JSON.stringify({ action: 'start' }) }));
check(crossOrigin.status === 403, 'Reject cross-origin mutation');

// Regression: existing topic quizzes and saved feedback still work on the additive schema.
let result = await study.POST(new Request('https://aneth.test/api/study', { method: 'POST', body: JSON.stringify({ action: 'start', quizId: topicQuizzes[0].id }) }));
check(result.status === 200, 'Old quiz can start');
const session = await result.json();
result = await study.POST(new Request('https://aneth.test/api/study', { method: 'POST', body: JSON.stringify({ action: 'answer', sessionId: session.session.id, questionId: session.question.id, selected: topicQuizzes[0].questions[0].answer }) }));
check(result.status === 200 && (await result.json()).feedback.correct, 'Old quiz feedback remains intact');
sqlite.close();
console.log(`PASS: ${checks} checks — content, seven formats, grading, prerequisites, full API flow, resume, conflicts, migrations and legacy quizzes.`);
