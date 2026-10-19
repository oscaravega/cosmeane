import { studyDb } from '@/lib/study-db';
import lessons from '@/lib/content/lessons.json';
import { finalExamBank } from '@/lib/final-exam-bank';
import { completedTopics, examView, prepareQuestions, validResponse, type ExamRow } from '@/lib/final-exam';
import type { ExamQuestion, SavedAnswer } from '@/lib/final-exam-types';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function readiness(db: D1Database) {
  const sessions = await db.prepare('SELECT quiz_id,completed,title,questions FROM study_sessions WHERE completed = 1').all<{ quiz_id: string; completed: number; title: string; questions: string }>();
  const topics = completedTopics(lessons, sessions.results);
  return { topics, completed: topics.filter(t => t.completed).length, total: topics.length, unlocked: topics.every(t => t.completed) };
}

export async function GET(req: Request) {
  try {
    const db = studyDb(), id = new URL(req.url).searchParams.get('session');
    if (id) {
      const row = await db.prepare('SELECT * FROM final_exam_sessions WHERE id = ?').bind(id).first<ExamRow>();
      return row ? json(examView(row)) : json({ error: 'No encontramos este examen.' }, 404);
    }
    const [ready, rows] = await Promise.all([readiness(db), db.prepare('SELECT * FROM final_exam_sessions ORDER BY updated_at DESC').all<ExamRow>()]);
    return json({ readiness: ready, sessions: rows.results.map(r => examView(r).session), questionCount: finalExamBank.length });
  } catch (e) {
    console.error('final-exam-load', e);
    return json({ error: 'No se pudo cargar el examen. Intenta de nuevo; tu progreso sigue guardado.' }, 503);
  }
}

export async function POST(req: Request) {
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return json({ error: 'Solicitud no permitida.' }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 24000) return json({ error: 'La respuesta es demasiado larga.' }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch { return json({ error: 'Solicitud no válida.' }, 400); }
  try {
    const db = studyDb();
    if (body.action === 'start') {
      const ready = await readiness(db);
      if (!ready.unlocked) return json({ error: `Completa primero los ocho quizzes. Llevas ${ready.completed} de ${ready.total}.` }, 403);
      // Reuse an unfinished exam so repeated clicks never create competing drafts.
      const pending = await db.prepare("SELECT * FROM final_exam_sessions WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 1").first<ExamRow>();
      if (pending) return json(examView(pending));
      const now = new Date().toISOString();
      const row: ExamRow = { id: crypto.randomUUID(), status: 'draft', questions: JSON.stringify(prepareQuestions(finalExamBank)), answers: '{}', assessments: '{}', cursor: 0, revision: 0, created_at: now, updated_at: now };
      // The partial unique index also protects against simultaneous starts in two tabs.
      await db.prepare('INSERT OR IGNORE INTO final_exam_sessions (id,status,questions,answers,assessments,cursor,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(row.id, row.status, row.questions, row.answers, row.assessments, 0, 0, now, now).run();
      const active = await db.prepare("SELECT * FROM final_exam_sessions WHERE status = 'draft' LIMIT 1").first<ExamRow>();
      return json(examView(active!));
    }
    if (typeof body.sessionId !== 'string') return json({ error: 'Falta el examen.' }, 400);
    const row = await db.prepare('SELECT * FROM final_exam_sessions WHERE id = ?').bind(body.sessionId).first<ExamRow>();
    if (!row) return json({ error: 'No encontramos este examen.' }, 404);
    if (body.revision !== row.revision) return json({ error: 'Este examen cambió en otra ventana. Vuelve a cargarlo antes de seguir.' }, 409);
    const questions = JSON.parse(row.questions) as ExamQuestion[];
    const answers = JSON.parse(row.answers) as Record<string, SavedAnswer>;
    if (body.action === 'save') {
      if (row.status !== 'draft') return json({ error: 'El examen ya se entregó; sus respuestas están cerradas.' }, 409);
      const q = questions.find(q => q.id === body.questionId);
      if (!q || !validResponse(q, body.response)) return json({ error: 'Revisa el formato de tu respuesta.' }, 400);
      if (!Number.isInteger(body.cursor) || (body.cursor as number) < 0 || (body.cursor as number) >= questions.length) return json({ error: 'Pregunta no válida.' }, 400);
      answers[q.id] = { response: body.response, updatedAt: new Date().toISOString() };
      row.answers = JSON.stringify(answers); row.cursor = body.cursor as number;
    } else if (body.action === 'submit') {
      if (row.status === 'submitted') return json(examView(row));
      const missing = questions.filter(q => !answers[q.id] || !validResponse(q, answers[q.id].response, true));
      if (missing.length) return json({ error: `Faltan ${missing.length} preguntas completas. Revisa el mapa antes de entregar.`, missingIds: missing.map(q => q.id) }, 400);
      row.status = 'submitted';
    } else if (body.action === 'assess') {
      if (row.status !== 'submitted') return json({ error: 'Entrega el examen antes de revisar las respuestas abiertas.' }, 409);
      const q = questions.find(q => q.id === body.questionId && q.kind === 'open');
      const marks = body.marks;
      if (!q || !marks || typeof marks !== 'object' || Array.isArray(marks)) return json({ error: 'Rúbrica no válida.' }, 400);
      const fields = marks as Record<string, unknown>;
      if (Object.keys(fields).length !== q.rubric!.length || !q.rubric!.every(c => typeof fields[c.id] === 'boolean')) return json({ error: 'Revisa los cuatro criterios antes de guardar.' }, 400);
      const assessments = JSON.parse(row.assessments) as Record<string, unknown>;
      assessments[q.id] = fields; row.assessments = JSON.stringify(assessments);
    } else return json({ error: 'Acción no válida.' }, 400);
    row.updated_at = new Date().toISOString();
    const saved = await db.prepare('UPDATE final_exam_sessions SET status=?,answers=?,assessments=?,cursor=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?')
      .bind(row.status, row.answers, row.assessments, row.cursor, row.updated_at, row.id, row.revision).run();
    if (!saved.meta.changes) return json({ error: 'El examen se actualizó en otra ventana. Vuelve a cargarlo para continuar.' }, 409);
    row.revision++;
    return json(examView(row));
  } catch (e) {
    console.error('final-exam-save', e);
    return json({ error: 'No se pudo guardar. Conservamos tu borrador en esta pantalla; vuelve a intentarlo.' }, 503);
  }
}
