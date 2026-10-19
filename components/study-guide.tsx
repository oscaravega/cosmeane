'use client';
import {useLayoutEffect,useRef} from 'react';
import {BookOpen,Check,ArrowRight,ChevronLeft,ChevronRight,Lightbulb,ExternalLink,ImageIcon} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import lessons from '@/lib/content/lessons.json';
export {lessons};
export type LessonProgress={lessonId:string;completed:boolean;updatedAt:string};
type Props={progress:LessonProgress[];busy:boolean;loading:boolean;onMark:(id:string,completed:boolean)=>Promise<void>;onQuiz:(id:string)=>void;selected:string;onSelect:(id:string)=>void};
export function StudyGuide({progress,busy,loading,onMark,onQuiz,selected,onSelect}:Props){
 const layoutRef=useRef<HTMLDivElement>(null),readerRef=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const layout=layoutRef.current;if(!layout)return;
  const desktop=window.matchMedia('(min-width: 761px)');
  let frame=0;
  function resize(){
   frame=0;
   if(!desktop.matches){layout!.style.removeProperty('--study-panel-height');return;}
   const viewport=window.visualViewport?.height??window.innerHeight;
   const top=Math.max(16,layout!.getBoundingClientRect().top);
   // Fit both scroll regions below the header, including after page scroll or resize.
   layout!.style.setProperty('--study-panel-height',Math.max(240,Math.floor(viewport-top-16))+'px');
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(resize);}
  resize();
  const observer=new ResizeObserver(schedule);
  const main=layout.closest('main');if(main)observer.observe(main);
  window.addEventListener('resize',schedule);
  window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);window.visualViewport?.removeEventListener('resize',schedule);};
 },[]);
 useLayoutEffect(()=>{readerRef.current?.scrollTo({top:0,left:0,behavior:'instant'});},[selected]);
 const index=Math.max(0,lessons.findIndex(l=>l.id===selected)),lesson=lessons[index],done=progress.some(p=>p.lessonId===lesson.id&&p.completed),count=progress.filter(p=>p.completed).length;
 function select(id:string){onSelect(id);}
 return <div className="learning-layout" ref={layoutRef}><aside className="syllabus" tabIndex={0} aria-label="Menú de temas de estudio"><div className="syllabus-heading"><p className="eyebrow">TU GUÍA DE ESTUDIO</p><h2>Módulo 01<br/><em>Cosmetología corporal</em></h2><p>{count} de 8 temas estudiados</p><div className="reading-track" role="progressbar" aria-label="Temas estudiados" aria-valuemin={0} aria-valuemax={8} aria-valuenow={count}><span style={{width:count/8*100+'%'}}/></div></div><nav aria-label="Temas del módulo">{lessons.map((l,i)=><button key={l.id} className={'lesson-nav '+(selected===l.id?'active':'')} aria-current={selected===l.id?'step':undefined} onClick={()=>select(l.id)}><span>{progress.some(p=>p.lessonId===l.id&&p.completed)?<Check size={16}/>:String(i+1).padStart(2,'0')}</span><div>{l.title}<small>{l.minutes} min · pp. {l.pages}</small></div></button>)}</nav><p className="syllabus-note">Lee, explícalo con tus palabras y después haz el quiz. Puedes volver a cualquier tema.</p></aside>
 <article className="lesson-reader" id="lesson-reader" ref={readerRef} tabIndex={0} aria-labelledby="lesson-title"><div className="reader-heading"><div className="reader-meta"><span className="eyebrow">TEMA {String(index+1).padStart(2,'0')} / 08</span><span>{lesson.minutes} min de lectura</span></div><h2 id="lesson-title">{lesson.title}</h2><p>{lesson.intro}</p><span className="source-tag"><BookOpen size={14}/>Módulo original · páginas {lesson.pages}</span></div>
 <div className="reader-body">{lesson.blocks.map((b,i)=><section className="learning-section" key={b.title}><div className="section-number">{String(i+1).padStart(2,'0')}</div><div><h3>{b.title}</h3><ul>{b.items.map(text=><li key={text}>{text}</li>)}</ul></div></section>)}
 {lesson.images.length>0&&<Accordion type="single" collapsible className="illustrations"><AccordionItem value="images"><AccordionTrigger><span><ImageIcon size={18}/>Ver las ocho ilustraciones del módulo</span></AccordionTrigger><AccordionContent><div className="posture-gallery">{lesson.images.map(img=><figure key={img.src}><a href={img.src} target="_blank" rel="noreferrer" aria-label={'Ampliar '+img.caption}><img src={img.src} alt={img.alt} loading="lazy" width="1224" height="689"/></a><figcaption>{img.caption} · toca para ampliar</figcaption></figure>)}</div></AccordionContent></AccordionItem></Accordion>}
 {lesson.notes.map(note=><aside className="study-clarification" key={note.title}><h3>{note.title}</h3><p>{note.text}</p>{'url' in note&&<a href={note.url} target="_blank" rel="noreferrer">{note.label}<ExternalLink size={13}/></a>}</aside>)}
 <div className="remember-box"><Lightbulb size={24}/><div><h3>Quédate con esta idea</h3><p>{lesson.remember}</p></div></div>
 <section className="recall-section"><p className="eyebrow">ANTES DEL QUIZ</p><h3>¿Puedes explicarlo sin mirar?</h3><p>Responde en voz alta y luego abre la explicación para compararla.</p><Accordion type="multiple" key={lesson.id}>{lesson.recall.map((r,i)=><AccordionItem value={String(i)} key={r.question}><AccordionTrigger>{r.question}</AccordionTrigger><AccordionContent>{r.answer}</AccordionContent></AccordionItem>)}</Accordion></section>
 <div className="lesson-actions"><Button variant={done?'secondary':'outline'} disabled={busy||loading} onClick={()=>onMark(lesson.id,!done)}>{done?<Check size={17}/>:<BookOpen size={17}/>} {done?'Estudiado · desmarcar':'Marcar como estudiado'}</Button><Button disabled={busy||loading} onClick={()=>onQuiz('m1-'+lesson.id)}>Hacer quiz de este tema<ArrowRight size={17}/></Button></div><p className="reading-help">Marcar un tema registra tu lectura; tus resultados del quiz se guardan por separado.</p>
 <div className="lesson-pagination"><Button variant="ghost" disabled={index===0} onClick={()=>select(lessons[index-1].id)}><ChevronLeft/>Anterior</Button><span>{index+1} de 8</span><Button variant="ghost" disabled={index===7} onClick={()=>select(lessons[index+1].id)}>Siguiente<ChevronRight/></Button></div>
 <p className="module-credit">Guía elaborada a partir de las 63 páginas de «Módulo #1 Corporal». Las aclaraciones identificadas amplían o matizan el material; las referencias usan el número de página del PDF.</p>
 </div></article></div>;
}
