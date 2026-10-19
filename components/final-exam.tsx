'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ClipboardCheck, CloudCheck, LockKeyhole, LoaderCircle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { KIND_LABELS, type ActiveExam, type ExamDashboard, type ExamResponse, type ExamResult, type PublicQuestion } from '@/lib/final-exam-types';
import { validResponse } from '@/lib/final-exam';

const initialValue = (q: PublicQuestion): ExamResponse => q.kind === 'single' || q.kind === 'open' ? '' : q.kind === 'order' || q.kind === 'multiple' ? [] : {};
const draftKey = (sessionId: string, questionId: string) => `aneth-final-draft:${sessionId}:${questionId}`;
const points = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);

async function api<T>(path = '', body?: unknown): Promise<T> {
  const response = await fetch('/api/final-exam' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar. Intenta de nuevo.');
  return data;
}

export function FinalExam({ onQuiz, onStudy, onExitGuard }: { onQuiz: (id: string) => void; onStudy: (id: string) => void; onExitGuard: (busy: boolean) => void }) {
  const [dashboard, setDashboard] = useState<ExamDashboard | null>(null);
  const [active, setActive] = useState<ActiveExam | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<ExamResponse>('');
  const [dirty, setDirty] = useState(false);
  const [localSaved, setLocalSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState('all');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { let live = true; api<ExamDashboard>().then(d => { if (live) setDashboard(d); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  useEffect(() => { onExitGuard(busy); return () => onExitGuard(false); }, [busy, onExitGuard]);
  useEffect(() => {
    if (!dirty || localSaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, localSaved]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function adopt(d: ActiveExam, target = d.cursor) {
    setActive(d); setIndex(target); setConfirm(false); setDirty(false); setLocalSaved(true);
    const q = d.questions[target];
    let next = d.answers[q.id]?.response ?? initialValue(q);
    if (d.session.status === 'draft') {
      try {
        const cached = JSON.parse(localStorage.getItem(draftKey(d.session.id, q.id)) || 'null');
        if (cached && cached.revision === d.revision && validResponse(q, cached.response)) {
          next = cached.response; setDirty(true);
        }
      } catch { /* Server-saved answers remain available when local storage is unavailable. */ }
    }
    setValue(next);
  }
  async function open(id: string) { await run(async () => adopt(await api<ActiveExam>('?session=' + encodeURIComponent(id)))); }
  async function start() { await run(async () => adopt(await api<ActiveExam>('', { action: 'start' }))); }
  function change(next: ExamResponse) {
    setValue(next); setDirty(true); setConfirm(false);
    if (!active) return;
    try { localStorage.setItem(draftKey(active.session.id, active.questions[index].id), JSON.stringify({ revision: active.revision, response: next })); setLocalSaved(true); }
    catch { setLocalSaved(false); }
  }
  async function save(target = index) {
    if (!active) return null;
    const q = active.questions[index];
    const result = await api<ActiveExam>('', { action: 'save', sessionId: active.session.id, revision: active.revision, questionId: q.id, response: value, cursor: target });
    try { localStorage.removeItem(draftKey(active.session.id, q.id)); } catch { /* No cached draft to clear. */ }
    adopt(result, target); return result;
  }
  async function navigate(target: number) { await run(async () => { await save(target); heading.current?.focus(); }); }
  async function back() { await run(async () => { if (active?.session.status === 'draft') await save(); setActive(null); setDashboard(await api<ExamDashboard>()); }); }
  async function reviewSubmission() {
    await run(async () => {
      const saved = await save();
      if (!saved) return;
      if (saved.session.answered < saved.session.total) { setError(`Faltan ${saved.session.total - saved.session.answered} preguntas por completar. Puedes encontrarlas en el mapa de preguntas.`); return; }
      setConfirm(true);
    });
  }
  async function submit() { if (!active) return; await run(async () => adopt(await api<ActiveExam>('', { action: 'submit', sessionId: active.session.id, revision: active.revision }))); }
  async function assess(result: ExamResult, marks: Record<string, boolean>) {
    if (!active) return;
    await run(async () => adopt(await api<ActiveExam>('', { action: 'assess', sessionId: active.session.id, revision: active.revision, questionId: result.id, marks })));
  }
  const q = active?.questions[index];
  const currentComplete = q ? validResponse(q, value, true) : false;
  const count = active && q && active.session.status === 'draft'
    ? active.questions.filter(item => validResponse(item, item.id === q.id ? value : active.answers[item.id]?.response, true)).length
    : active?.session.answered ?? 0;

  return <section className="final-exam" aria-label="Examen final avanzado">
    {error && <div className="error" role="alert"><p>{error}</p><Button variant="outline" disabled={busy} onClick={() => run(async () => { if (active) adopt(await api<ActiveExam>('?session=' + active.session.id)); else setDashboard(await api<ExamDashboard>()); })}>Volver a cargar</Button></div>}
    {!active ? <>
      <div className="exam-hero"><div className="exam-hero-copy"><p className="eyebrow"><Sparkles size={15}/> TU RETO FINAL</p><h2>Conecta lo que sabes.<br/><em>Piensa como profesional.</em></h2><p>Casos nuevos que cruzan los ocho temas. Aquí importa interpretar, decidir y explicar por qué.</p><div className="exam-facts"><span>32 preguntas nuevas</span><span>7 formatos</span><span>Nivel avanzado</span></div></div><div className="exam-emblem" aria-hidden="true"><ClipboardCheck size={60}/><span>ANETH · EXAMEN FINAL</span></div></div>
      {!dashboard ? <div className="empty-state" role="status"><LoaderCircle className="spin"/><p>Cargando tu acceso y tus exámenes…</p></div> : <>
        <div className="exam-intro-grid"><div className="main-panel exam-access">
          <div className="exam-access-title">{dashboard.readiness.unlocked ? <CheckCircle2/> : <LockKeyhole/>}<div><p className="eyebrow">{dashboard.readiness.unlocked ? 'YA PUEDES COMENZAR' : 'PREPARA TU ACCESO'}</p><h3>{dashboard.readiness.unlocked ? 'Examen desbloqueado' : `${dashboard.readiness.completed} de 8 quizzes completados`}</h3></div></div>
          <p>Se desbloquea al completar los ocho quizzes de los temas. No necesitas acertarlo todo. Un quiz integral completo también cuenta; un repaso parcial no.</p>
          <div className="exam-unlock-track" role="progressbar" aria-label="Quizzes necesarios completados" aria-valuemin={0} aria-valuemax={8} aria-valuenow={dashboard.readiness.completed}><span style={{ width: `${dashboard.readiness.completed / 8 * 100}%` }}/></div>
          <div className="exam-topic-checks">{dashboard.readiness.topics.map((t, i) => <div key={t.id}><span className={t.completed ? 'done' : ''}>{t.completed ? <Check size={14}/> : i + 1}</span><p>{t.title}</p>{!t.completed && <Button variant="link" onClick={() => onQuiz('m1-' + t.id)}>Ir al quiz</Button>}</div>)}</div>
          <Button className="exam-start" disabled={!dashboard.readiness.unlocked || busy} onClick={start}>{busy ? 'Cargando…' : dashboard.sessions.some(s => s.status === 'draft') ? 'Continuar mi examen' : 'Comenzar examen final'}<ArrowRight size={17}/></Button>
        </div><aside className="exam-guide"><h3>Un examen para razonar</h3><div className="exam-format-list">{Object.entries(KIND_LABELS).map(([kind, label]) => <span key={kind}>{label}</span>)}</div><ul><li><strong>Banco independiente:</strong> no reutiliza las 64 preguntas de práctica.</li><li><strong>A tu ritmo:</strong> sin cronómetro, con respuestas guardadas y opción de volver atrás.</li><li><strong>Sin pistas:</strong> las soluciones se revelan al entregar.</li><li><strong>Abiertas:</strong> compara tu texto con una respuesta modelo y autoevalúa cuatro criterios. No se califican automáticamente por palabras clave.</li></ul><details><summary>Cómo se calcula el resultado</summary><p>Cada pregunta vale 4 puntos. Conexiones, clasificación y frases dan crédito por cada parte correcta. Ordenar exige la secuencia completa. En selección múltiple, cada opción incorrecta resta el valor de una correcta, con mínimo de 0.</p><p>Las 24 preguntas objetivas se califican automáticamente. Las ocho abiertas aportan hasta 32 puntos de autoevaluación, mostrados por separado. No necesitas copiar literalmente la respuesta modelo.</p></details></aside></div>
        {dashboard.sessions.length > 0 && <section className="main-panel exam-history"><div className="panel-top"><h3>Mis exámenes</h3><span className="pill">{dashboard.sessions.length} intentos</span></div>{dashboard.sessions.map((s, i) => <div className="quiz-row" key={s.id}><div><h3>{s.status === 'draft' ? 'Examen en curso' : 'Examen entregado'}</h3><p>{new Date(s.updatedAt).toLocaleDateString('es-MX')} · {s.answered}/{s.total} preguntas</p>{s.objectivePercent !== null && <small>Objetivas: {s.objectivePercent}% · {s.overallPercent !== null ? `Total con autoevaluación: ${s.overallPercent}%` : `Abiertas revisadas: ${s.reviewedOpen}/${s.openTotal}`}</small>}</div><Button disabled={busy} variant={i ? 'outline' : 'default'} onClick={() => open(s.id)}>{s.status === 'draft' ? 'Retomar examen' : 'Ver resultados'}</Button></div>)}</section>}
      </>}
    </> : active.session.status === 'draft' && q ? <>
      <div className="exam-toolbar"><Button variant="ghost" disabled={busy} onClick={back}><ArrowLeft size={16}/>Guardar y salir</Button><span className="pill">EXAMEN FINAL · AVANZADO</span></div>
      <div className="exam-workspace"><article className="main-panel exam-question-card">
        <div className="panel-top"><span className="eyebrow">PREGUNTA {index + 1} / {active.session.total}</span><span className="pill">{KIND_LABELS[q.kind]}</span></div>
        <div className="exam-question-body"><h2 ref={heading} tabIndex={-1}>{q.prompt}</h2><QuestionInput key={q.id} question={q} value={value} onChange={change} disabled={busy}/>
          <p className="exam-draft-status" role="status"><CloudCheck size={16}/>{busy ? 'Guardando…' : dirty ? localSaved ? 'Borrador guardado en este dispositivo. Al continuar se sincroniza.' : 'Cambios sin guardar. Usa Guardar y continuar.' : active.answers[q.id] ? 'Respuesta sincronizada. Puedes seguir revisándola antes de entregar.' : 'Puedes responder y guardar para continuar en cualquier momento.'}</p>
          {q.kind === 'open' && <p className="exam-help">Explica con tus palabras. La respuesta modelo y la rúbrica aparecerán al entregar. Tu texto original quedará guardado.</p>}
        </div>
        <div className="exam-question-actions"><Button variant="outline" disabled={busy || index === 0} onClick={() => navigate(index - 1)}><ArrowLeft size={16}/>Anterior</Button><Button variant="outline" disabled={busy} onClick={() => run(async () => { await save(); })}>Guardar respuesta</Button>{index < active.session.total - 1 ? <Button disabled={busy} onClick={() => navigate(index + 1)}>Guardar y continuar<ArrowRight size={16}/></Button> : <Button disabled={busy} onClick={reviewSubmission}>Revisar y entregar<Check size={16}/></Button>}</div>
      </article><aside className="exam-map main-panel"><p className="eyebrow">TU RECORRIDO</p><h3>{count} de {active.session.total} completas</h3><p>Puedes cambiar tus respuestas antes de entregar.</p><nav aria-label="Mapa de preguntas"><div className="exam-number-grid">{active.questions.map((item, i) => { const done = item.id === q.id ? currentComplete : validResponse(item, active.answers[item.id]?.response, true); return <button key={item.id} disabled={busy} aria-current={index === i ? 'step' : undefined} aria-label={`Pregunta ${i + 1}, ${done ? 'completa' : 'pendiente'}${i === index ? ', actual' : ''}`} className={`${done ? 'answered' : ''} ${i === index ? 'current' : ''}`} onClick={() => navigate(i)}>{i + 1}</button>; })}</div></nav><p className="exam-map-key"><span/>Rosa: respuesta completa</p><Button disabled={busy} variant="outline" onClick={reviewSubmission}>Revisar y entregar</Button><p className="exam-help">Una respuesta completa aún puede ser incorrecta. Verás la corrección al entregar.</p></aside></div>
      {confirm && <div className="exam-submit-box" role="group" aria-label="Confirmar entrega"><h3>¿Entregar tu examen, Aneth?</h3><p>Las 32 respuestas están completas. Al entregar se cerrarán para este intento y podrás ver las soluciones, explicaciones y rúbricas.</p><div><Button disabled={busy} onClick={submit}>Entregar y ver resultados</Button><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Seguir revisando</Button></div></div>}
    </> : <>
      <div className="exam-toolbar"><Button variant="ghost" disabled={busy} onClick={back}><ArrowLeft size={16}/>Mis exámenes</Button><span className="pill">EXAMEN ENTREGADO</span></div>
      <div className="exam-results-hero"><p className="eyebrow">LO QUE YA SABES, LO QUE PUEDES REFORZAR</p><h2>Cada explicación te lleva más lejos.</h2><div className="exam-score-grid"><div><strong>{active.session.objectivePercent}%</strong><span>Resultado objetivo · 24 preguntas</span></div><div><strong>{active.session.reviewedOpen}/{active.session.openTotal}</strong><span>Casos abiertos autoevaluados</span></div><div><strong>{active.session.overallPercent !== null ? `${active.session.overallPercent}%` : 'Pendiente'}</strong><span>Total con autoevaluación de abiertas</span></div></div><p>El resultado objetivo se calcula automáticamente. El total incorpora los criterios que tú marques al revisar las ocho respuestas abiertas.</p></div>
      <div className="exam-result-controls"><h3>Revisa y entiende tus respuestas</h3><label>Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las preguntas</option><option value="errors">Objetivas por reforzar</option><option value="open">Casos abiertos y rúbricas</option></select></label></div>
      <Accordion type="multiple" className="main-panel exam-results-list">{active.results.filter(r => filter === 'all' || (filter === 'open' ? r.kind === 'open' : r.kind !== 'open' && (r.points ?? 0) < 4)).map(r => <AccordionItem value={r.id} key={r.id}><AccordionTrigger><span className={'exam-result-dot ' + (r.points === 4 ? 'done' : '')}>{r.kind === 'open' ? '✎' : r.points === 4 ? '✓' : '↻'}</span><div><small>{KIND_LABELS[r.kind]} · {r.points === null ? 'Autoevaluación pendiente' : `${points(r.points)}/4 puntos${r.kind === 'open' ? ' · autoevaluación' : ''}`}</small><span>{r.prompt}</span></div></AccordionTrigger><AccordionContent><div className="exam-answer-comparison"><div><h4>Tu respuesta</h4><p>{r.selectedText}</p></div><div><h4>{r.kind === 'open' ? 'Respuesta modelo' : 'Respuesta correcta'}</h4><p>{r.correctText}</p></div></div><div className="exam-explanation"><h4>Por qué</h4><p>{r.explanation}</p><small>{r.source}</small></div>{r.rubric && <Rubric key={r.id + active.revision} result={r} disabled={busy} onSave={marks => assess(r, marks)}/>}<Button variant="link" onClick={() => onStudy(r.topicId)}>Volver al tema para reforzarlo<ArrowRight size={15}/></Button></AccordionContent></AccordionItem>)}</Accordion>
      {filter === 'errors' && !active.results.some(r => r.kind !== 'open' && (r.points ?? 0) < 4) && <div className="empty-state"><CheckCircle2 className="empty-icon"/><p>Acertaste todas las preguntas objetivas. Revisa también tus casos abiertos.</p></div>}
    </>}
  </section>;
}

function QuestionInput({ question: q, value, onChange, disabled }: { question: PublicQuestion; value: ExamResponse; onChange: (value: ExamResponse) => void; disabled: boolean }) {
  if (q.kind === 'open') return <label className="exam-text-label">Tu razonamiento<textarea rows={8} maxLength={4000} value={value as string} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder="Explica tu decisión, sus motivos y las precauciones que tomarías…"/><small>{(value as string).length}/4000 caracteres</small></label>;
  if (q.kind === 'single' || q.kind === 'multiple') return <fieldset className="exam-choices"><legend>{q.kind === 'single' ? 'Selecciona una opción.' : 'Selecciona todas las opciones que correspondan. Las selecciones incorrectas restan puntos dentro de esta pregunta.'}</legend>{q.options!.map((o, i) => { const chosen = q.kind === 'single' ? value === o.id : (value as string[]).includes(o.id); return <label key={o.id} className={chosen ? 'chosen' : ''}><input disabled={disabled} type={q.kind === 'single' ? 'radio' : 'checkbox'} name={q.id} checked={chosen} onChange={() => onChange(q.kind === 'single' ? o.id : chosen ? (value as string[]).filter(id => id !== o.id) : [...value as string[], o.id])}/><span className="exam-choice-letter">{String.fromCharCode(65 + i)}</span><span>{o.text}</span></label>; })}</fieldset>;
  if (q.kind === 'blank') return <div className="exam-blanks"><p className="exam-help">Escribe las palabras faltantes. Se aceptan mayúsculas y respuestas sin tildes.</p>{q.blanks!.map(b => <label key={b.id}>{b.label}<input autoComplete="off" spellCheck={false} maxLength={150} disabled={disabled} value={(value as Record<string, string>)[b.id] ?? ''} onChange={e => onChange({ ...value as Record<string, string>, [b.id]: e.target.value })}/></label>)}</div>;
  if (q.kind === 'match' || q.kind === 'classify') return <div className="exam-connections"><p className="exam-help">{q.kind === 'match' ? 'Elige la conexión de cada elemento. Puedes cambiarla antes de entregar.' : 'Elige la categoría adecuada para cada situación.'}</p>{q.items!.map((item, i) => <label key={item.id}><span><b>{i + 1}</b>{item.text}</span><select disabled={disabled} value={(value as Record<string, string>)[item.id] ?? ''} onChange={e => onChange({ ...value as Record<string, string>, [item.id]: e.target.value })}><option value="">Selecciona {q.kind === 'match' ? 'la conexión' : 'la categoría'}…</option>{q.targets!.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}</select>{(value as Record<string, string>)[item.id] && <small className="exam-selected-connection">{q.targets!.find(t=>t.id===(value as Record<string, string>)[item.id])?.text}</small>}</label>)}</div>;
  const sequence = value as string[];
  function move(position: number, direction: number) { const next = [...sequence]; [next[position], next[position + direction]] = [next[position + direction], next[position]]; onChange(next); }
  return <div className="exam-order"><p className="exam-help">Toca los pasos en el orden que propones. Después puedes moverlos con las flechas.</p><ol aria-label="Tu secuencia">{sequence.map((id, i) => <li key={id}><span className="exam-order-number">{i + 1}</span><p>{q.items!.find(item => item.id === id)!.text}</p><div><Button variant="ghost" size="icon" aria-label={`Subir paso ${i + 1}`} disabled={disabled || i === 0} onClick={() => move(i, -1)}><ArrowUp size={16}/></Button><Button variant="ghost" size="icon" aria-label={`Bajar paso ${i + 1}`} disabled={disabled || i === sequence.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16}/></Button><Button variant="ghost" size="icon" disabled={disabled} aria-label={`Quitar paso ${i + 1}`} onClick={() => onChange(sequence.filter(v => v !== id))}><X size={16}/></Button></div></li>)}</ol>{!sequence.length && <p className="exam-order-empty">Tu secuencia comienza aquí.</p>}<div className="exam-order-pool">{q.items!.filter(item => !sequence.includes(item.id)).map(item => <button disabled={disabled} key={item.id} onClick={() => onChange([...sequence, item.id])}><span>+</span>{item.text}</button>)}</div></div>;
}

function Rubric({ result, disabled, onSave }: { result: ExamResult; disabled: boolean; onSave: (marks: Record<string, boolean>) => Promise<void> }) {
  const [marks, setMarks] = useState<Record<string, boolean | null>>(() => Object.fromEntries(result.rubric!.map(c => [c.id, c.checked])));
  const complete = Object.values(marks).every(v => typeof v === 'boolean');
  return <section className="exam-rubric"><h4>Autoevaluación con criterios</h4><p>Compara tu texto original con el modelo. Marca «Sí» solo si ya explicaste el criterio. Puedes aceptar una redacción distinta con el mismo sentido; esto es tu autoevaluación, no una calificación automática.</p>{result.rubric!.map(c => <fieldset key={c.id}><legend>{c.text}</legend><label><input type="radio" disabled={disabled} name={`${result.id}-${c.id}`} checked={marks[c.id] === true} onChange={() => setMarks({ ...marks, [c.id]: true })}/>Sí, lo incluí</label><label><input type="radio" disabled={disabled} name={`${result.id}-${c.id}`} checked={marks[c.id] === false} onChange={() => setMarks({ ...marks, [c.id]: false })}/>Me faltó</label></fieldset>)}<Button disabled={disabled || !complete} onClick={() => onSave(marks as Record<string, boolean>)}>{result.points === null ? 'Guardar autoevaluación' : 'Actualizar autoevaluación'}</Button>{!complete && <small>Marca una opción en los cuatro criterios.</small>}</section>;
}
