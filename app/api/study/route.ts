import {studyDb} from '@/lib/study-db';
import {quizzes,type Question} from '@/lib/quiz-bank';
import lessons from '@/lib/content/lessons.json';
export const dynamic='force-dynamic';
type Answer={questionId:string;selected:number;correct:boolean;answeredAt?:string};
type Row={id:string;quiz_id:string;title:string;questions:string;answers:string;position:number;completed:number;updated_at:string;revision:number};
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});}
function summary(r:Row){const answers:Answer[]=JSON.parse(r.answers);return {id:r.id,quizId:r.quiz_id,title:r.title,total:JSON.parse(r.questions).length,answered:answers.length,correct:answers.filter(a=>a.correct).length,completed:!!r.completed,updatedAt:r.updated_at};}
function view(r:Row){
 const questions:Question[]=JSON.parse(r.questions),answers:Answer[]=JSON.parse(r.answers),q=questions[r.position],a=answers[r.position];
 return {session:summary(r),question:q&&!r.completed?{id:q.id,topicId:q.topicId,prompt:q.prompt,options:q.options,hint:q.hint}:null,
 feedback:q&&a&&!r.completed?{correct:a.correct,answer:q.answer,selected:a.selected,explanation:q.explanation,selectedExplanation:q.optionExplanations[a.selected],source:q.source}:null,
 results:r.completed?questions.map((item,i)=>({id:item.id,topicId:item.topicId,prompt:item.prompt,selectedText:item.options[answers[i].selected],correctText:item.options[item.answer],correct:answers[i].correct,explanation:item.explanation,selectedExplanation:item.optionExplanations[answers[i].selected],source:item.source})):[]};
}
function missedIds(rows:Row[]){
 const latest=new Map<string,{correct:boolean;at:string}>();
 for(const row of rows)for(const a of JSON.parse(row.answers) as Answer[]){const at=a.answeredAt||row.updated_at;if(!latest.has(a.questionId)||at>latest.get(a.questionId)!.at)latest.set(a.questionId,{correct:a.correct,at});}
 return new Set([...latest].filter(([,v])=>!v.correct).map(([id])=>id));
}
export async function GET(req:Request){try{
 const db=studyDb(),id=new URL(req.url).searchParams.get('session');
 if(id){const r=await db.prepare('SELECT * FROM study_sessions WHERE id = ?').bind(id).first<Row>();return r?json(view(r)):json({error:'No encontramos esta sesión.'},404);}
 const [rows,reading]=await Promise.all([db.prepare('SELECT * FROM study_sessions ORDER BY updated_at DESC').all<Row>(),db.prepare('SELECT * FROM study_lessons').all<{lesson_id:string;completed:number;updated_at:string}>()]);
 const missed=missedIds(rows.results);
 return json({quizzes:quizzes.map(({questions,...q})=>({...q,count:questions.length})),sessions:rows.results.map(summary),lessons:reading.results.map(l=>({lessonId:l.lesson_id,completed:!!l.completed,updatedAt:l.updated_at})),reviewCounts:Object.fromEntries(quizzes.map(q=>[q.id,q.questions.filter(p=>missed.has(p.id)).length]))});
 }catch(e){console.error('study-load',e);return json({error:'No se pudo cargar tu progreso. Puedes leer la guía y volver a intentarlo.'},503);}}
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Solicitud no permitida.'},403);
 let body:Record<string,unknown>;try{const text=await req.text();if(text.length>4096)return json({error:'Solicitud demasiado grande.'},413);body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return json({error:'Solicitud no válida.'},400);}
 try{const db=studyDb();
 if(body.action==='lesson'){
 if(!lessons.some(l=>l.id===body.lessonId)||typeof body.completed!=='boolean')return json({error:'Tema no válido.'},400);
 await db.prepare('INSERT INTO study_lessons (lesson_id,completed,updated_at) VALUES (?,?,?) ON CONFLICT(lesson_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at').bind(body.lessonId,body.completed?1:0,new Date().toISOString()).run();return json({saved:true});
 }
 if(body.action==='start'){
 const quiz=quizzes.find(q=>q.id===body.quizId);if(!quiz||!quiz.questions.length)return json({error:'Este quiz todavía no está disponible.'},404);
 let questions=quiz.questions;
 if(body.review===true){const old=await db.prepare('SELECT * FROM study_sessions ORDER BY updated_at DESC').all<Row>();const missed=missedIds(old.results);questions=questions.filter(q=>missed.has(q.id));if(!questions.length)return json({error:'No tienes errores pendientes en este quiz. Puedes practicarlo completo.'},400);}
 const row:Row={id:crypto.randomUUID(),quiz_id:quiz.id,title:quiz.title+(body.review?' · Repaso':''),questions:JSON.stringify(questions),answers:'[]',position:0,completed:0,updated_at:new Date().toISOString(),revision:0};
 await db.prepare('INSERT INTO study_sessions (id,quiz_id,title,questions,answers,position,completed,updated_at,revision) VALUES (?,?,?,?,?,?,?,?,?)').bind(row.id,row.quiz_id,row.title,row.questions,row.answers,0,0,row.updated_at,0).run();return json(view(row));
 }
 if(typeof body.sessionId!=='string')return json({error:'Falta la sesión.'},400);
 const row=await db.prepare('SELECT * FROM study_sessions WHERE id = ?').bind(body.sessionId).first<Row>();if(!row)return json({error:'No encontramos esta sesión.'},404);
 const questions:Question[]=JSON.parse(row.questions),answers:Answer[]=JSON.parse(row.answers),q=questions[row.position];
 if(body.action==='answer'){
 if(!q||row.completed||q.id!==body.questionId)return json({error:'La sesión cambió. Vuelve a cargarla para continuar.'},409);
 if(!Number.isInteger(body.selected)||(body.selected as number)<0||(body.selected as number)>3)return json({error:'Selecciona una de las cuatro respuestas.'},400);
 if(answers[row.position])return json(view(row));
 answers.push({questionId:q.id,selected:body.selected as number,correct:body.selected===q.answer,answeredAt:new Date().toISOString()});row.answers=JSON.stringify(answers);
 }else if(body.action==='next'){
 if(row.completed||body.questionId!==q?.id)return json(view(row));
 if(!answers[row.position])return json({error:'Responde la pregunta antes de continuar.'},400);row.position++;if(row.position>=questions.length)row.completed=1;
 }else return json({error:'Acción no válida.'},400);
 row.updated_at=new Date().toISOString();const saved=await db.prepare('UPDATE study_sessions SET answers=?,position=?,completed=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(row.answers,row.position,row.completed,row.updated_at,row.id,row.revision).run();
 if(!saved.meta.changes)return json({error:'Esta sesión se actualizó en otra ventana. Vuelve a cargarla para continuar.'},409);return json(view(row));
 }catch(e){console.error('study-save',e);return json({error:'No se pudo guardar. Tu selección sigue aquí; inténtalo otra vez.'},503);}
}
