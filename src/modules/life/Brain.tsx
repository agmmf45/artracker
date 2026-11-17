import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Network, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { Card, Chip, EmptyState, PageHeader, Segmented, Stat } from '@/design/ui';
import { extractLinks } from '@/modules/shared/markdown';
import type { NoteData } from '@/modules/shared/domain';

interface Node { id: string; title: string; x: number; y: number; vx: number; vy: number; deg: number }

/** Knowledge graph of REAL [[links]] between notes (no invented relationships) + PARA overview. */
export default function Brain() {
  const { L } = useI18n();
  const nav = useNavigate();
  const notes = useRecords<NoteData>('note');
  const [view, setView] = useState<'graph' | 'para'>('graph');
  const [orphans, setOrphans] = useState(false);
  const [q, setQ] = useState('');

  const graph = useMemo(() => {
    const ns = notes ?? [];
    const byTitle = new Map(ns.filter((n) => n.data.title).map((n) => [n.data.title.trim().toLowerCase(), n.id]));
    const edges: Array<[string, string]> = [];
    for (const n of ns) for (const t of extractLinks(n.data.body)) { const to = byTitle.get(t); if (to && to !== n.id) edges.push([n.id, to]); }
    const deg = new Map<string, number>();
    for (const [a, b] of edges) { deg.set(a, (deg.get(a) ?? 0) + 1); deg.set(b, (deg.get(b) ?? 0) + 1); }
    const keep = ns.filter((n) => orphans || deg.has(n.id));
    const W = 900; const H = 560;
    const nodes: Node[] = keep.map((n, i) => {
      const a = (i / Math.max(1, keep.length)) * Math.PI * 2;
      return { id: n.id, title: n.data.title || '—', x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 160, vx: 0, vy: 0, deg: deg.get(n.id) ?? 0 };
    });
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const E = edges.filter(([a, b]) => idx.has(a) && idx.has(b));
    // deterministic force layout (Fruchterman–Reingold style)
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]; const b = nodes[j];
          let dx = a.x - b.x; let dy = a.y - b.y;
          const d2 = Math.max(40, dx * dx + dy * dy);
          const f = 2600 / d2;
          dx *= f / Math.sqrt(d2); dy *= f / Math.sqrt(d2);
          a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
        }
      }
      for (const [s, t] of E) {
        const a = nodes[idx.get(s)!]; const b = nodes[idx.get(t)!];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 90) * 0.02;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004;
        n.x = Math.max(30, Math.min(W - 30, n.x + n.vx * 0.6)); n.y = Math.max(20, Math.min(H - 20, n.y + n.vy * 0.6));
        n.vx *= 0.6; n.vy *= 0.6;
      }
    }
    return { nodes, edges: E, idx, total: ns.length, linked: deg.size, W, H };
  }, [notes, orphans]);

  const hit = q.trim().toLowerCase();
  const para = (['project', 'area', 'resource', 'archive'] as const).map((p) => ({ p, list: (notes ?? []).filter((n) => n.data.para === p) }));
  const PARA_L = { project: ['مشاريع', 'Projects'], area: ['مجالات', 'Areas'], resource: ['مصادر', 'Resources'], archive: ['أرشيف', 'Archives'] } as const;

  return (
    <div>
      <PageHeader title={L('العقل الثاني', 'Second Brain')} subtitle={L('علاقات حقيقية بين ملاحظاتك عبر [[الروابط]] فقط.', 'Real relationships between your notes — only via [[links]].')}
        actions={<Segmented value={view} onChange={setView} options={[{ value: 'graph', label: L('الخريطة', 'Graph') }, { value: 'para', label: 'PARA' }]} />} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('ملاحظات', 'Notes')} value={graph.total} /></Card>
        <Card className="p-4"><Stat label={L('مترابطة', 'Linked')} value={graph.linked} /></Card>
        <Card className="p-4"><Stat label={L('روابط', 'Links')} value={graph.edges.length} /></Card>
      </div>

      {view === 'graph' ? (
        !graph.edges.length && !orphans ? (
          <EmptyState icon={<Network size={30} />} title={L('لا روابط بعد', 'No links yet')} hint={L('اكتب [[اسم ملاحظة]] داخل أي ملاحظة لتربطها. الخريطة لا تخترع علاقات.', 'Write [[Note name]] inside any note to link it. The graph never invents relationships.')} />
        ) : (
          <Card className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1"><Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-3" /><input className="field h-9 min-h-0 ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ظلّل ملاحظة', 'Highlight a note')} /></div>
              <Chip active={orphans} onClick={() => setOrphans(!orphans)}>{L('أظهر غير المرتبطة', 'Show unlinked')}</Chip>
            </div>
            <svg viewBox={`0 0 ${graph.W} ${graph.H}`} className="h-auto w-full" role="img" aria-label={L('خريطة الملاحظات', 'Note graph')}>
              {graph.edges.map(([a, b], i) => {
                const A = graph.nodes[graph.idx.get(a)!]; const B = graph.nodes[graph.idx.get(b)!];
                return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--border-strong)" strokeWidth={1.2} />;
              })}
              {graph.nodes.map((n) => {
                const on = hit && n.title.toLowerCase().includes(hit);
                const r = 5 + Math.min(10, n.deg * 1.6);
                return (
                  <g key={n.id} className="cursor-pointer" onClick={() => nav(`/life/notes?open=${n.id}`)}>
                    <circle cx={n.x} cy={n.y} r={r} fill={on ? 'var(--reward)' : 'var(--life)'} opacity={hit && !on ? 0.35 : 1} />
                    <text x={n.x} y={n.y - r - 4} textAnchor="middle" fontSize="11" fill="var(--text-2)" opacity={hit && !on ? 0.35 : 1}>{n.title.slice(0, 24)}</text>
                  </g>
                );
              })}
            </svg>
          </Card>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          {para.map(({ p, list }) => (
            <Card key={p} className="p-3">
              <div className="mb-2 font-bold">{L(PARA_L[p][0], PARA_L[p][1])} <span className="num text-fg-3">{list.length}</span></div>
              <ul className="space-y-1">{list.map((n) => <li key={n.id}><button className="truncate text-start text-sm hover:text-accent" onClick={() => nav(`/life/notes?open=${n.id}`)}>{n.data.title || '—'}</button></li>)}</ul>
              {!list.length && <p className="text-[12px] text-fg-3">{L('عيّن PARA من تفاصيل الملاحظة.', 'Set PARA from note details.')}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
