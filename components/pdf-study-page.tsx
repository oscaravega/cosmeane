'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, Library, Lightbulb, Search, Sparkles, X } from 'lucide-react';
import { normalizeStudyText, studyDocuments, type SourceSlide, type StudyGuideDocument } from '@/lib/study-documents';

type Mode = 'guide' | 'terms' | 'slides';
const modes: { id: Mode; title: string; icon: typeof BookOpen }[] = [
  { id: 'guide', title: 'Guía de estudio', icon: BookOpen },
  { id: 'terms', title: 'Palabras clave', icon: Sparkles },
  { id: 'slides', title: 'PDF completo', icon: FileText },
];
function pageLabel(pages: number[]) {
  if (!pages.length) return '';
  return pages.length === 1 || pages[0] === pages[pages.length - 1] ? `Pág. ${pages[0]}` : `Págs. ${pages[0]}–${pages[pages.length - 1]}`;
}

export function PdfStudyPage({ guide }: { guide: StudyGuideDocument }) {
  const [mode, setMode] = useState<Mode>('guide');
  const [query, setQuery] = useState('');
  const [slides, setSlides] = useState<SourceSlide[] | null>(null);
  const [slidesError, setSlidesError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const readingRef = useRef<HTMLDivElement>(null);
  const pdfUrl = `/study/${guide.slug}/${guide.slug}.pdf`;
  const search = normalizeStudyText(query.trim());
  const sections = useMemo(() => guide.sections.filter(section => !search || normalizeStudyText([section.title, section.intro, ...section.paragraphs, ...section.keyPoints, ...section.terms, ...(section.table?.rows.flat() ?? [])].join(' ')).includes(search)), [guide.sections, search]);
  const terms = useMemo(() => guide.glossary.filter(term => !search || normalizeStudyText(term.term + ' ' + term.definition).includes(search)), [guide.glossary, search]);
  const matchingSlides = useMemo(() => slides?.filter(slide => !search || normalizeStudyText(slide.text).includes(search)) ?? [], [slides, search]);
  const slide = slides?.[page - 1];

  useEffect(() => {
    if (mode !== 'slides' || slides) return;
    const controller = new AbortController();
    setSlidesError('');
    fetch(`/study/${guide.slug}/pages.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('No se pudo cargar el documento.'); return response.json() as Promise<SourceSlide[]>; })
      .then(data => { if (!Array.isArray(data) || data.length !== guide.pageCount) throw new Error('El documento no se cargó completo.'); setSlides(data); })
      .catch(error => { if (!controller.signal.aborted) setSlidesError(error instanceof Error ? error.message : 'No se pudo cargar el documento.'); });
    return () => controller.abort();
  }, [mode, guide.slug, guide.pageCount, slides, loadAttempt]);

  function chooseMode(next: Mode) { setMode(next); }
  function goPage(next: number) {
    const safe = Math.min(guide.pageCount, Math.max(1, Number.isFinite(next) ? Math.trunc(next) : 1));
    setPage(safe); setPageInput(String(safe)); setImageFailed(false);
  }
  function showSource(sourcePage: number) {
    setQuery(''); setMode('slides'); goPage(sourcePage);
    requestAnimationFrame(() => readingRef.current?.scrollIntoView({ block: 'start' }));
  }
  function filterClear() { setQuery(''); }

  return <div className="pdf-study-shell">
    <a className="pdf-skip" href="#study-content">Saltar al contenido de estudio</a>
    <header className="topbar pdf-topbar">
      <a href="/" className="brand"><span className="monogram">a.</span><span>Cosmetóloga <strong>Aneth</strong></span></a>
      <a href="/#biblioteca" className="pdf-back"><ArrowLeft size={17} aria-hidden="true"/>Volver a la biblioteca</a>
    </header>
    <main className="pdf-study-main">
      <nav className="pdf-breadcrumb" aria-label="Ruta de navegación"><a href="/#biblioteca">Biblioteca</a><span aria-hidden="true">/</span><span aria-current="page">{guide.title}</span></nav>
      <section className="pdf-study-hero" aria-labelledby="pdf-title">
        <div className="pdf-hero-copy"><p className="eyebrow">{guide.category} · TU ESPACIO DE ESTUDIO</p><h1 id="pdf-title">{guide.title}</h1><p>{guide.subtitle}</p><div className="pdf-hero-meta"><span><FileText size={15} aria-hidden="true"/>{guide.pageCount} páginas</span><span>{guide.sections.length} apartados</span><span>{guide.glossary.length} palabras clave</span></div></div>
        <div className="pdf-hero-cover"><img src={`/study/${guide.slug}/cover.webp`} alt={`Portada de ${guide.title}`} width={640} height={360}/><a href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir PDF completo <ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (nueva pestaña)</span></a></div>
      </section>
      <div className="pdf-study-toolbar" ref={readingRef}>
        <nav className="pdf-mode-nav" aria-label="Modo de estudio">{modes.map(item => <button key={item.id} type="button" aria-pressed={mode === item.id} aria-controls="study-content" onClick={() => chooseMode(item.id)}><item.icon size={17} aria-hidden="true"/>{item.title}</button>)}</nav>
        <label className="pdf-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Buscar en {mode === 'guide' ? 'la guía' : mode === 'terms' ? 'las palabras clave' : 'el texto de las diapositivas'}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={mode === 'slides' ? 'Buscar en las diapositivas…' : 'Buscar un concepto…'} type="search"/>{query ? <button type="button" aria-label="Borrar búsqueda" onClick={filterClear}><X size={15}/></button> : null}</label>
      </div>
      <div className="pdf-study-layout">
        <aside className="pdf-study-sidebar">
          <details className="pdf-topic-index" open><summary><BookOpen size={17} aria-hidden="true"/>En este documento</summary><nav aria-label="Índice del documento">{guide.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} onClick={event => { event.preventDefault(); setMode('guide'); setQuery(''); requestAnimationFrame(() => document.getElementById(section.id)?.scrollIntoView({ block: 'start' })); }}><span>{String(index + 1).padStart(2, '0')}</span><div>{section.title}<small>{pageLabel(section.pages)}</small></div></a>)}</nav></details>
          <details className="pdf-switcher"><summary><Library size={17} aria-hidden="true"/>Cambiar de PDF</summary><nav aria-label="Otros documentos">{studyDocuments.map(doc => <a key={doc.slug} href={`/estudio/${doc.slug}`} aria-current={doc.slug === guide.slug ? 'page' : undefined}>{doc.title}{doc.slug === guide.slug ? <Check size={14} aria-hidden="true"/> : <ArrowRight size={14} aria-hidden="true"/>}</a>)}</nav></details>
        </aside>
        <div className="pdf-study-content" id="study-content" tabIndex={-1}>
          {mode === 'guide' ? <>
            <section className="pdf-reading-intro"><span className="eyebrow">ENTENDER ANTES DE MEMORIZAR</span><h2>Vamos a estudiarlo, Aneth.</h2><p>{guide.description}</p><div className="pdf-reading-tip"><Lightbulb size={20} aria-hidden="true"/><p>Lee cada apartado y repasa sus ideas clave. Las referencias de página te llevan a las diapositivas completas.</p></div></section>
            {search ? <p className="pdf-search-status" role="status">{sections.length} apartados encontrados para «{query}».</p> : null}
            {sections.length === 0 ? <NoResults onClear={filterClear} onSlides={() => setMode('slides')}/> : null}
            {sections.map(section => <section className="pdf-guide-section" id={section.id} key={section.id}>
              <div className="pdf-section-meta"><span className="eyebrow">APARTADO {String(guide.sections.indexOf(section) + 1).padStart(2, '0')}</span><button type="button" onClick={() => showSource(section.pages[0])}>{pageLabel(section.pages)}<ExternalLink size={13} aria-hidden="true"/></button></div>
              <h2>{section.title}</h2><p className="pdf-section-intro">{section.intro}</p>
              {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {section.table ? <div className="pdf-table-wrap" tabIndex={0} role="region" aria-label={`Tabla: ${section.title}`}><table><thead><tr>{section.table.headers.map((heading, index) => <th key={index} scope="col">{heading}</th>)}</tr></thead><tbody>{section.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
              {section.keyPoints.length ? <div className="pdf-key-points"><h3><Lightbulb size={16} aria-hidden="true"/>Qué debes recordar</h3><ul>{section.keyPoints.map((point, index) => <li key={index}>{point}</li>)}</ul></div> : null}
              <div className="pdf-keyword-chips" aria-label="Conceptos de este apartado">{section.terms.map(term => <span key={term}>{term}</span>)}</div>
            </section>)}
            {!search && guide.clarifications?.length ? <section className="pdf-source-notes" aria-labelledby="source-notes"><p className="eyebrow">LECTURA CON CRITERIO</p><h2 id="source-notes">Aclaraciones del material</h2><p>Estas notas distinguen los apuntes de clase de conceptos que conviene precisar al estudiar.</p>{guide.clarifications.map((note, index) => <div className="pdf-source-note" key={index}><h3>{note.title}</h3><p>{note.text}</p><div><button type="button" onClick={() => showSource(note.pages[0])}>{pageLabel(note.pages)} del PDF</button>{note.sourceUrl ? <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">{note.sourceTitle || 'Consultar referencia'}<ExternalLink size={13} aria-hidden="true"/><span className="sr-only"> (nueva pestaña)</span></a> : null}</div></div>)}</section> : null}
            {!search ? <section className="pdf-takeaways"><Sparkles size={24} aria-hidden="true"/><div><p className="eyebrow">QUÉDATE CON LO ESENCIAL</p><h2>Conecta las ideas.</h2><ul>{guide.takeaways.map((takeaway, index) => <li key={index}>{takeaway}</li>)}</ul><button type="button" onClick={() => { setMode('terms'); readingRef.current?.scrollIntoView({ block: 'start' }); }}>Repasar palabras clave<ArrowRight size={16} aria-hidden="true"/></button></div></section> : null}
          </> : null}
          {mode === 'terms' ? <section className="pdf-glossary"><div className="pdf-reading-intro"><p className="eyebrow">TU DICCIONARIO DEL TEMA</p><h2>Palabras que conectan ideas</h2><p>Definiciones para entender el vocabulario de este PDF y volver a su contexto.</p></div><p className="pdf-search-status" role="status">{terms.length} conceptos{search ? ` para «${query}»` : ''}</p>{terms.length === 0 ? <NoResults onClear={filterClear} onSlides={() => setMode('slides')}/> : <dl>{terms.map(term => <div key={term.term}><dt>{term.term}</dt><dd>{term.definition}<button type="button" onClick={() => showSource(term.pages[0])}>{pageLabel(term.pages)}<ArrowRight size={13} aria-hidden="true"/></button></dd></div>)}</dl>}</section> : null}
          {mode === 'slides' ? <section className="pdf-source-viewer" aria-label="Diapositivas del documento completo"><div className="pdf-reading-intro"><p className="eyebrow">EL MATERIAL, PÁGINA POR PÁGINA</p><h2>Tu PDF completo</h2><p>Consulta todas las diapositivas, incluidas imágenes, esquemas, tablas y fichas de productos.</p><a className="pdf-text-link" href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir el archivo PDF<ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (nueva pestaña)</span></a></div>
            {slidesError ? <div className="pdf-load-error" role="alert"><p>{slidesError}</p><button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Volver a intentar</button><a href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir PDF en otra pestaña</a></div> : !slides ? <p className="pdf-loading" role="status">Cargando las {guide.pageCount} diapositivas…</p> : <>
              {search ? <div className="pdf-slide-matches"><p role="status">{matchingSlides.length} páginas contienen «{query}» en su texto.</p><div>{matchingSlides.map(match => <button type="button" key={match.page} aria-pressed={page === match.page} onClick={() => goPage(match.page)}>Pág. {match.page}</button>)}</div><small>El buscador consulta el texto del documento; los rótulos dentro de imágenes se consultan en la diapositiva.</small></div> : null}
              <div className="pdf-page-navigation"><button type="button" onClick={() => goPage(page - 1)} disabled={page === 1} aria-label="Diapositiva anterior"><ChevronLeft size={20}/></button><form onSubmit={event => { event.preventDefault(); goPage(Number(pageInput)); }}><label htmlFor="pdf-page-number">Página</label><input id="pdf-page-number" type="number" min={1} max={guide.pageCount} value={pageInput} onChange={event => setPageInput(event.target.value)} aria-label="Número de página"/><span>de {guide.pageCount}</span><button type="submit">Ir</button></form><button type="button" onClick={() => goPage(page + 1)} disabled={page === guide.pageCount} aria-label="Diapositiva siguiente"><ChevronRight size={20}/></button></div>
              <p className="sr-only" aria-live="polite">Mostrando página {page} de {guide.pageCount}</p>
              {guide.clarifications?.filter(note => note.pages.includes(page)).map((note, index) => <div className="pdf-source-note pdf-inline-note" key={index}><h3>{note.title}</h3><p>{note.text}</p>{note.sourceUrl ? <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">{note.sourceTitle || 'Consultar referencia'}<ExternalLink size={13} aria-hidden="true"/></a> : null}</div>)}
              {slide ? <><figure className="pdf-slide-figure">{imageFailed ? <div className="pdf-load-error" role="alert"><p>No se pudo cargar esta diapositiva.</p><button type="button" onClick={() => { setImageFailed(false); setImageAttempt(attempt => attempt + 1); }}>Reintentar imagen</button><a href={`${pdfUrl}#page=${page}`} target="_blank" rel="noopener noreferrer">Ver esta página en el PDF</a></div> : <a href={slide.image} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar página ${page} en otra pestaña`}><img key={slide.image + imageAttempt} src={slide.image + (imageAttempt ? `?retry=${imageAttempt}` : '')} width={slide.width} height={slide.height} alt={`${guide.title}, diapositiva ${page}. El texto se puede consultar debajo.`} onError={() => setImageFailed(true)}/></a>}<figcaption>{guide.title} · Página {page}<span>Haz clic en la imagen para ampliarla.</span></figcaption></figure><details className="pdf-slide-text" key={page}><summary>Leer el texto de esta diapositiva</summary>{slide.text ? <p>{slide.text}</p> : <p>Esta diapositiva contiene elementos visuales. Consúltalos en la imagen o abre el PDF para ampliarlos.</p>}</details><div className="pdf-page-bottom"><button type="button" disabled={page === 1} onClick={() => goPage(page - 1)}><ArrowLeft size={16} aria-hidden="true"/>Anterior</button><span>{page} / {guide.pageCount}</span><button type="button" disabled={page === guide.pageCount} onClick={() => goPage(page + 1)}>Siguiente<ArrowRight size={16} aria-hidden="true"/></button></div></> : null}
            </>}
          </section> : null}
          <div className="pdf-document-credit"><FileText size={16} aria-hidden="true"/><p>Material base: {guide.sourceFile}. La guía organiza los conceptos; «PDF completo» conserva todas las páginas para consultar los detalles.</p></div>
        </div>
      </div>
      <footer className="pdf-study-footer"><a href="/#biblioteca"><ArrowLeft size={14} aria-hidden="true"/>Volver a la biblioteca</a><span>Un tema a la vez, a tu ritmo.</span></footer>
    </main>
  </div>;
}
function NoResults({ onClear, onSlides }: { onClear: () => void; onSlides: () => void }) {
  return <div className="pdf-no-results"><Search size={25} aria-hidden="true"/><h3>No encontramos ese concepto aquí.</h3><p>Prueba con otra palabra o busca en las diapositivas completas.</p><div><button type="button" onClick={onClear}>Limpiar búsqueda</button><button type="button" onClick={onSlides}>Buscar en el PDF</button></div></div>;
}
