export const EXAM_VERSION = 1;
export const KIND_LABELS = {
  single: 'Elige una respuesta', multiple: 'Selecciona varias', blank: 'Completa la frase',
  match: 'Conecta conceptos', order: 'Ordena los pasos', classify: 'Clasifica situaciones', open: 'Caso abierto',
} as const;
export type Kind = keyof typeof KIND_LABELS;
export type Choice = { id: string; text: string };
export type PublicQuestion = {
  id: string; topicId: string; kind: Kind; prompt: string;
  options?: Choice[]; items?: Choice[]; targets?: Choice[];
  blanks?: { id: string; label: string }[];
};
export type ExamQuestion = PublicQuestion & {
  solution: string | string[] | Record<string, string>;
  accepted?: Record<string, string[]>; explanation: string; source: string;
  rubric?: { id: string; text: string }[];
};
export type ExamResponse = string | string[] | Record<string, string>;
export type SavedAnswer = { response: ExamResponse; updatedAt: string };
export type ExamSummary = {
  id: string; status: 'draft' | 'submitted'; total: number; answered: number;
  updatedAt: string; objectivePercent: number | null; overallPercent: number | null;
  reviewedOpen: number; openTotal: number;
};
export type ExamResult = {
  id: string; topicId: string; kind: Kind; prompt: string; selectedText: string;
  correctText: string; explanation: string; source: string; points: number | null; maxPoints: number;
  rubric?: { id: string; text: string; checked: boolean | null }[];
};
export type ActiveExam = {
  session: ExamSummary; revision: number; cursor: number; questions: PublicQuestion[];
  answers: Record<string, SavedAnswer>; results: ExamResult[];
};
export type ExamReadiness = {
  unlocked: boolean; completed: number; total: number;
  topics: { id: string; title: string; completed: boolean }[];
};
export type ExamDashboard = { readiness: ExamReadiness; sessions: ExamSummary[]; questionCount: number };
