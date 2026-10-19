import type { ActiveExam, ExamQuestion, ExamResponse, ExamResult, PublicQuestion, SavedAnswer } from './final-exam-types';

export type ExamRow = {
  id: string; status: 'draft' | 'submitted'; questions: string; answers: string;
  assessments: string; cursor: number; revision: number; created_at: string; updated_at: string;
};
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.,;:!?¿¡]/g, '').replace(/\s+/g, ' ');
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (items?: { id: string }[]) => items?.map(item => item.id) ?? [];

export function validResponse(q: PublicQuestion, value: unknown, complete = false): value is ExamResponse {
  if (q.kind === 'single') return typeof value === 'string' && (ids(q.options).includes(value) || (!complete && value === ''));
  if (q.kind === 'open') return typeof value === 'string' && value.length <= 4000 && (!complete || value.trim().length > 0);
  if (q.kind === 'multiple' || q.kind === 'order') {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string') || new Set(value).size !== value.length) return false;
    const allowed = ids(q.kind === 'multiple' ? q.options : q.items);
    return value.every(item => allowed.includes(item)) && (!complete || (q.kind === 'order' ? value.length === allowed.length : value.length > 0));
  }
  if (!record(value)) return false;
  const keys = q.kind === 'blank' ? ids(q.blanks) : ids(q.items);
  if (Object.keys(value).some(key => !keys.includes(key))) return false;
  return keys.every(key => {
    const item = value[key];
    if (item === undefined || item === '') return !complete;
    if (typeof item !== 'string') return false;
    return q.kind === 'blank' ? item.length <= 150 && (!complete || item.trim().length > 0) : ids(q.targets).includes(item);
  });
}

export function publicQuestion(q: ExamQuestion): PublicQuestion {
  // Whitelist fields: never expose solutions, explanations or rubrics before submission.
  return { id: q.id, topicId: q.topicId, kind: q.kind, prompt: q.prompt,
    ...(q.options ? { options: q.options } : {}), ...(q.items ? { items: q.items } : {}),
    ...(q.targets ? { targets: q.targets } : {}), ...(q.blanks ? { blanks: q.blanks } : {}) };
}

export function scoreQuestion(q: ExamQuestion, response: ExamResponse): number | null {
  if (q.kind === 'open') return null;
  if (!validResponse(q, response, true)) return 0;
  if (q.kind === 'single') return response === q.solution ? 4 : 0;
  if (q.kind === 'multiple') {
    const chosen = response as string[], correct = q.solution as string[];
    const hits = chosen.filter(id => correct.includes(id)).length;
    const wrong = chosen.filter(id => !correct.includes(id)).length;
    return Math.max(0, 4 * (hits - wrong) / correct.length);
  }
  if (q.kind === 'order') {
    // Full credit requires the full sequence: accidental positions do not earn points.
    return (q.solution as string[]).every((id, i) => (response as string[])[i] === id) ? 4 : 0;
  }
  const expected = q.solution as Record<string, string>, supplied = response as Record<string, string>;
  const keys = Object.keys(expected);
  const correct = keys.filter(key => q.kind === 'blank'
    ? [expected[key], ...(q.accepted?.[key] ?? [])].some(word => normalize(word) === normalize(supplied[key] ?? ''))
    : expected[key] === supplied[key]).length;
  return 4 * correct / keys.length;
}

export function describeResponse(q: ExamQuestion, value: ExamResponse): string {
  const text = (items: { id: string; text: string }[] | undefined, id: string) => items?.find(item => item.id === id)?.text ?? 'Sin respuesta';
  if (q.kind === 'single') return text(q.options, value as string);
  if (q.kind === 'open') return value as string;
  if (q.kind === 'multiple') return (value as string[]).map(id => text(q.options, id)).join('\n');
  if (q.kind === 'order') return (value as string[]).map((id, i) => `${i + 1}. ${text(q.items, id)}`).join('\n');
  if (q.kind === 'blank') return q.blanks!.map(b => `${b.label}: ${(value as Record<string, string>)[b.id] ?? 'Sin respuesta'}`).join('\n');
  return q.items!.map(item => `${item.text} → ${text(q.targets, (value as Record<string, string>)[item.id])}`).join('\n');
}

export function examView(row: ExamRow): ActiveExam {
  const questions = JSON.parse(row.questions) as ExamQuestion[];
  const answers = JSON.parse(row.answers) as Record<string, SavedAnswer>;
  const assessments = JSON.parse(row.assessments) as Record<string, Record<string, boolean>>;
  const submitted = row.status === 'submitted';
  const open = questions.filter(q => q.kind === 'open');
  const reviewedOpen = open.filter(q => q.rubric!.every(c => typeof assessments[q.id]?.[c.id] === 'boolean')).length;
  const objectivePoints = questions.reduce((sum, q) => sum + (answers[q.id] ? scoreQuestion(q, answers[q.id].response) ?? 0 : 0), 0);
  const openPoints = open.reduce((sum, q) => sum + (q.rubric?.filter(c => assessments[q.id]?.[c.id] === true).length ?? 0), 0);
  const results: ExamResult[] = submitted ? questions.map(q => ({
    id: q.id, topicId: q.topicId, kind: q.kind, prompt: q.prompt,
    selectedText: describeResponse(q, answers[q.id].response), correctText: describeResponse(q, q.solution),
    explanation: q.explanation, source: q.source, maxPoints: 4,
    points: q.kind === 'open' ? (assessments[q.id] ? q.rubric!.filter(c => assessments[q.id][c.id]).length : null) : scoreQuestion(q, answers[q.id].response),
    ...(q.rubric ? { rubric: q.rubric.map(c => ({ ...c, checked: assessments[q.id]?.[c.id] ?? null })) } : {}),
  })) : [];
  return {
    session: { id: row.id, status: row.status, total: questions.length,
      answered: questions.filter(q => answers[q.id] && validResponse(q, answers[q.id].response, true)).length,
      updatedAt: row.updated_at, reviewedOpen, openTotal: open.length,
      objectivePercent: submitted ? Math.round(objectivePoints / ((questions.length - open.length) * 4) * 100) : null,
      overallPercent: submitted && reviewedOpen === open.length ? Math.round((objectivePoints + openPoints) / (questions.length * 4) * 100) : null,
    },
    revision: row.revision, cursor: row.cursor, questions: questions.map(publicQuestion), answers, results,
  };
}

export function completedTopics(topics: { id: string; title: string }[], sessions: { quiz_id: string; completed: number; title: string; questions: string }[]) {
  const finished = sessions.filter(s => s.completed && !s.title.endsWith(' · Repaso'));
  return topics.map(topic => ({ id: topic.id, title: topic.title, completed: finished.some(s => {
    if (s.quiz_id !== `m1-${topic.id}` && s.quiz_id !== 'm1-integral') return false;
    const questions = JSON.parse(s.questions) as { topicId?: string; id: string }[];
    return questions.filter(q => q.topicId === topic.id || q.id.startsWith(`m1-${topic.id}-`)).length >= 8;
  }) }));
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

export function prepareQuestions(bank: ExamQuestion[]): ExamQuestion[] {
  return bank.map(q => ({ ...q,
    ...(q.options ? { options: shuffle(q.options) } : {}),
    ...(q.targets ? { targets: shuffle(q.targets) } : {}),
    ...(q.items ? { items: shuffle(q.items) } : {}),
  }));
}
