import { ArrowUpRight, Library } from 'lucide-react';
import { studyDocuments } from '@/lib/study-documents';

export function StudyLibrary() {
  return <section className="pdf-library" id="biblioteca" aria-labelledby="library-title">
    <div className="pdf-library-heading">
      <div><p className="eyebrow"><Library size={15} aria-hidden="true"/> TUS APUNTES, SIEMPRE CONTIGO</p><h2 id="library-title">Tu biblioteca de estudio</h2><p>Elige un PDF y entra a su espacio de estudio.</p></div>
      <span className="library-count">5 PDFs <span>·</span> 324 páginas</span>
    </div>
    <nav className="pdf-library-grid" aria-label="Elegir PDF para estudiar">
      {studyDocuments.map((doc, index) => <a key={doc.slug} href={'/estudio/' + doc.slug} className="pdf-library-card">
        <div className="pdf-card-art" style={{background:doc.color}}><img src={'/study/' + doc.slug + '/cover.webp'} alt="" width={640} height={360} loading="lazy"/><span>{String(index + 1).padStart(2, '0')}</span></div>
        <div className="pdf-card-copy"><span className="pdf-category">{doc.category} · {doc.pages} págs.</span><h3>{doc.title}</h3><p>{doc.description}</p><span className="pdf-card-link">Ir al estudio <ArrowUpRight size={16} aria-hidden="true"/></span></div>
      </a>)}
    </nav>
  </section>;
}
