import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PdfStudyPage } from '@/components/pdf-study-page';
import type { StudyGuideDocument } from '@/lib/study-documents';
import guides from '@/lib/content/study-guides.json';

type Props = { params: Promise<{ slug: string }> };
function findGuide(slug: string) {
  return (guides as StudyGuideDocument[]).find(guide => guide.slug === slug);
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  return { title: guide ? `${guide.title} · Cosmetóloga Aneth` : 'Tema no encontrado · Cosmetóloga Aneth', description: guide?.description };
}
export default async function StudyPage({ params }: Props) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  return <PdfStudyPage key={guide.slug} guide={guide}/>;
}
