export type StudySection = {
  id: string;
  title: string;
  pages: [number, number];
  intro: string;
  paragraphs: string[];
  keyPoints: string[];
  terms: string[];
  table?: { headers: string[]; rows: string[][] };
};
export type StudyGuideDocument = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  sourceFile: string;
  pageCount: number;
  category: string;
  sections: StudySection[];
  glossary: { term: string; definition: string; pages: number[] }[];
  takeaways: string[];
  clarifications?: { title: string; text: string; pages: number[]; sourceUrl?: string; sourceTitle?: string }[];
};
export type SourceSlide = { page: number; text: string; image: string; width: number; height: number };
export const studyDocuments = [
  { slug: 'la-piel', title: 'La piel', category: 'Anatomía', pages: 36, description: 'Capas, células y funciones de la piel.', color: '#e6dbe9' },
  { slug: 'bioquimica', title: 'Bioquímica', category: 'Fundamentos', pages: 41, description: 'Biomoléculas, células y tejidos.', color: '#dee8e5' },
  { slug: 'tipologia-cutanea', title: 'Tipología cutánea', category: 'Valoración cutánea', pages: 69, description: 'Tipos de piel, acné y exploración.', color: '#f2dfd5' },
  { slug: 'fototipos', title: 'Fototipos', category: 'Pigmentación', pages: 111, description: 'Melanina, manchas y piel sensible.', color: '#efe6ce' },
  { slug: 'alta-tecnologia', title: 'Alta tecnología en Cosmetología', category: 'Aparatología', pages: 67, description: 'Equipos, mecanismos y precauciones.', color: '#e4dce9' },
] as const;
export function normalizeStudyText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}
