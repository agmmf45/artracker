import { useState } from 'react';
import { FlaskConical, ExternalLink } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { Segmented } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

const opt = (v: string, ar: string, en: string) => ({ value: v, ar, en });

const STAGES = [
  opt('idea', 'فكرة', 'Idea'), opt('proposal', 'مقترح', 'Proposal'), opt('ethics', 'موافقة أخلاقية', 'Ethics'), opt('data_collection', 'جمع البيانات', 'Data collection'),
  opt('analysis', 'تحليل', 'Analysis'), opt('writing', 'كتابة', 'Writing'), opt('submitted', 'مُقدَّم', 'Submitted'), opt('published', 'منشور', 'Published'),
];

/** Research projects and the references that back them. */
export default function Research() {
  const { L } = useI18n();
  const [tab, setTab] = useState<'research' | 'reference'>('research');
  const projects = useRecords('research');

  const research: EntityConfig = {
    type: 'research', ar: 'الأبحاث', en: 'Research', icon: <FlaskConical size={30} />,
    titleKey: 'title', dateKey: 'deadline', statusKey: 'status', filterKey: 'status',
    emptyAr: 'لا مشاريع بحثية بعد.', emptyEn: 'No research projects yet.',
    defaults: { status: 'idea' },
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'question', ar: 'سؤال البحث', en: 'Research question', type: 'textarea' },
      { key: 'hypothesis', ar: 'الفرضية', en: 'Hypothesis', type: 'textarea' },
      { key: 'design', ar: 'تصميم الدراسة', en: 'Study design', type: 'select', options: [
        opt('cross_sectional', 'مقطعية', 'Cross-sectional'), opt('cohort', 'أتراب (Cohort)', 'Cohort'), opt('case_control', 'حالة وشاهد', 'Case-control'),
        opt('rct', 'تجربة عشوائية مضبوطة', 'RCT'), opt('systematic_review', 'مراجعة منهجية', 'Systematic review'), opt('case_report', 'تقرير حالة', 'Case report'),
        opt('lab', 'مخبرية', 'Laboratory'), opt('other', 'أخرى', 'Other')] },
      { key: 'status', ar: 'المرحلة', en: 'Stage', type: 'select', options: STAGES },
      { key: 'supervisor', ar: 'المشرف', en: 'Supervisor', type: 'text' },
      { key: 'deadline', ar: 'الموعد النهائي', en: 'Deadline', type: 'date' },
      { key: 'manuscript', ar: 'المخطوطة', en: 'Manuscript', type: 'select', options: [
        opt('not_started', 'لم تبدأ', 'Not started'), opt('draft', 'مسودة', 'Draft'), opt('revision', 'مراجعة', 'Revision'), opt('submitted', 'مُقدَّمة', 'Submitted'), opt('accepted', 'مقبولة', 'Accepted')] },
      { key: 'conference', ar: 'المؤتمر', en: 'Conference', type: 'text' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    meta: (r) => {
      const s = STAGES.find((o) => o.value === r.data.status);
      return [s ? L(s.ar, s.en) : '', r.data.supervisor, r.data.deadline].filter(Boolean).join(' · ');
    },
  };

  const reference: EntityConfig = {
    type: 'reference', ar: 'المراجع', en: 'References', icon: <FlaskConical size={30} />,
    titleKey: 'title',
    emptyAr: 'لا مراجع بعد.', emptyEn: 'No references yet.',
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'authors', ar: 'المؤلفون', en: 'Authors', type: 'text', full: true },
      { key: 'year', ar: 'السنة', en: 'Year', type: 'number' },
      { key: 'journal', ar: 'المجلة', en: 'Journal', type: 'text' },
      { key: 'doi', ar: 'DOI', en: 'DOI', type: 'text', hint: { ar: '10.xxxx/…', en: '10.xxxx/…' } },
      { key: 'pmid', ar: 'PMID', en: 'PMID', type: 'text' },
      { key: 'url', ar: 'رابط', en: 'URL', type: 'url' },
      { key: 'research_id', ar: 'المشروع', en: 'Project', type: 'select', options: (projects ?? []).map((p) => ({ value: p.id, ar: String(p.data.title ?? ''), en: String(p.data.title ?? '') })) },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    meta: (r) => [r.data.authors, r.data.year, r.data.journal].filter(Boolean).join(' · '),
    extraActions: (r: Rec) => (
      <div className="flex items-center gap-2 text-[12px] font-bold text-accent" dir="ltr">
        {Boolean(r.data.doi) && <a className="inline-flex items-center gap-1" href={`https://doi.org/${encodeURI(String(r.data.doi).trim())}`} target="_blank" rel="noopener noreferrer">DOI <ExternalLink size={13} /></a>}
        {Boolean(r.data.pmid) && <a className="inline-flex items-center gap-1" href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(r.data.pmid).trim())}/`} target="_blank" rel="noopener noreferrer">PubMed <ExternalLink size={13} /></a>}
      </div>
    ),
  };

  return (
    <div>
      <Segmented className="mb-3" value={tab} onChange={setTab} options={[
        { value: 'research', label: L('المشاريع', 'Projects') },
        { value: 'reference', label: L('المراجع', 'References') },
      ]} />
      {tab === 'reference' && (
        <p className="mb-3 text-[13px] text-fg-2">{L('لا نختلق مراجع: أدخل DOI أو PMID من المصدر الأصلي.', 'We never fabricate citations: enter the DOI or PMID from the original source.')}</p>
      )}
      {tab === 'research' ? <EntityPage key="research" config={research} /> : <EntityPage key="reference" config={reference} />}
    </div>
  );
}
