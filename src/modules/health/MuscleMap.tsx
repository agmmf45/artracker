import { useI18n } from '@/core/i18n';

/**
 * Body/muscle map ported from the legacy dashboard SVG (geometry unchanged). Muscle ids are the
 * legacy Arabic keys (FIT_MUSCLES), so legacy workout data (exercise.muscle) maps directly.
 * Note: the legacy SVG fired 'باي' for biceps while FIT_MUSCLES used 'بايسبس'; the FIT_MUSCLES key is used here.
 */

export const MUSCLES: Array<{ id: string; ar: string; en: string }> = [
  { id: 'صدر', ar: 'صدر', en: 'Chest' },
  { id: 'ظهر', ar: 'ظهر', en: 'Back' },
  { id: 'كتف', ar: 'كتف', en: 'Shoulders' },
  { id: 'بايسبس', ar: 'بايسبس', en: 'Biceps' },
  { id: 'ترايسبس', ar: 'ترايسبس', en: 'Triceps' },
  { id: 'ساعد', ar: 'ساعد', en: 'Forearms' },
  { id: 'ترابس', ar: 'ترابس', en: 'Traps' },
  { id: 'ساق', ar: 'ساق', en: 'Calves' },
  { id: 'أرداف', ar: 'أرداف', en: 'Glutes' },
  { id: 'خلفي الفخذ', ar: 'خلفي الفخذ', en: 'Hamstrings' },
  { id: 'فخذ', ar: 'فخذ', en: 'Quads' },
  { id: 'أسفل الظهر', ar: 'أسفل الظهر', en: 'Lower back' },
  { id: 'رجل', ar: 'رجل', en: 'Legs' },
  { id: 'بطن', ar: 'بطن', en: 'Abs' },
  { id: 'كارديو', ar: 'كارديو', en: 'Cardio' },
];

type Fixed =
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'p'; d: string; fill: 'none' | 's'; sw: number }
  | { k: 'l'; x1: number; y1: number; x2: number; y2: number };
interface Fig { fixed: Fixed[]; muscles: Array<{ id: string; d: string }>; labels: Array<[string, number, number, number]> }

const FRONT: Fig = {"fixed":[{"k":"e","cx":150,"cy":38,"rx":24,"ry":29},{"k":"p","d":"M140,44 Q150,50 160,44","fill":"none","sw":0.8},{"k":"p","d":"M138,64 L138,82 Q150,88 162,82 L162,64 Z","fill":"s","sw":1.2},{"k":"l","x1":150,"y1":142,"x2":150,"y2":204},{"k":"l","x1":133,"y1":160,"x2":167,"y2":160},{"k":"l","x1":132,"y1":180,"x2":168,"y2":180}],"muscles":[{"id":"ترابس","d":"M120,84 Q135,78 150,80 Q165,78 180,84 Q168,94 150,95 Q132,94 120,84 Z"},{"id":"كتف","d":"M118,86 Q98,86 90,104 Q88,118 96,128 Q110,124 118,110 Q122,96 118,86 Z"},{"id":"كتف","d":"M182,86 Q202,86 210,104 Q212,118 204,128 Q190,124 182,110 Q178,96 182,86 Z"},{"id":"صدر","d":"M120,98 Q132,94 148,98 L148,134 Q132,140 116,134 Q110,116 120,98 Z"},{"id":"صدر","d":"M180,98 Q168,94 152,98 L152,134 Q168,140 184,134 Q190,116 180,98 Z"},{"id":"بايسبس","d":"M94,130 Q86,148 88,172 Q96,180 104,174 Q108,150 102,130 Q98,126 94,130 Z"},{"id":"بايسبس","d":"M206,130 Q214,148 212,172 Q204,180 196,174 Q192,150 198,130 Q202,126 206,130 Z"},{"id":"ساعد","d":"M88,176 Q84,200 82,224 Q90,230 98,224 Q102,200 102,178 Q96,182 88,176 Z"},{"id":"ساعد","d":"M212,176 Q216,200 218,224 Q210,230 202,224 Q198,200 198,178 Q204,182 212,176 Z"},{"id":"بطن","d":"M132,138 L168,138 Q172,170 166,206 Q150,214 134,206 Q128,170 132,138 Z"},{"id":"بطن","d":"M118,138 Q126,136 130,140 Q128,172 132,202 Q122,200 116,188 Q112,162 118,138 Z"},{"id":"بطن","d":"M182,138 Q174,136 170,140 Q172,172 168,202 Q178,200 184,188 Q188,162 182,138 Z"},{"id":"فخذ","d":"M124,212 Q116,260 122,320 Q132,330 144,322 Q148,264 146,212 Q134,218 124,212 Z"},{"id":"فخذ","d":"M176,212 Q184,260 178,320 Q168,330 156,322 Q152,264 154,212 Q166,218 176,212 Z"},{"id":"ساق","d":"M124,330 Q120,386 128,440 Q138,446 144,438 Q146,384 142,332 Q134,338 124,330 Z"},{"id":"ساق","d":"M176,330 Q180,386 172,440 Q162,446 156,438 Q154,384 158,332 Q166,338 176,330 Z"}],"labels":[["ترابس",150,90,8],["كتف",103,110,8],["كتف",197,110,8],["صدر",130,120,9],["صدر",170,120,9],["باي",96,156,8],["باي",204,156,8],["ساعد",91,204,8],["ساعد",209,204,8],["بطن",150,176,9],["جانب",123,170,8],["جانب",177,170,8],["فخذ",134,270,9],["فخذ",166,270,9],["ساق",133,390,8],["ساق",167,390,8]]};
const BACK: Fig = {"fixed":[{"k":"e","cx":150,"cy":38,"rx":24,"ry":29},{"k":"p","d":"M138,64 L138,82 Q150,88 162,82 L162,64 Z","fill":"s","sw":1.2}],"muscles":[{"id":"ترابس","d":"M120,84 Q135,78 150,80 Q165,78 180,84 Q176,104 150,108 Q124,104 120,84 Z"},{"id":"كتف","d":"M118,90 Q98,90 90,108 Q88,122 96,130 Q110,126 118,112 Q122,98 118,90 Z"},{"id":"كتف","d":"M182,90 Q202,90 210,108 Q212,122 204,130 Q190,126 182,112 Q178,98 182,90 Z"},{"id":"ظهر","d":"M120,110 Q134,108 148,112 L148,168 Q132,176 116,166 Q110,138 120,110 Z"},{"id":"ظهر","d":"M180,110 Q166,108 152,112 L152,168 Q168,176 184,166 Q190,138 180,110 Z"},{"id":"ترايسبس","d":"M94,130 Q86,150 88,174 Q96,182 104,176 Q108,150 102,130 Q98,126 94,130 Z"},{"id":"ترايسبس","d":"M206,130 Q214,150 212,174 Q204,182 196,176 Q192,150 198,130 Q202,126 206,130 Z"},{"id":"ساعد","d":"M88,178 Q84,202 82,226 Q90,232 98,226 Q102,202 102,180 Q96,184 88,178 Z"},{"id":"ساعد","d":"M212,178 Q216,202 218,226 Q210,232 202,226 Q198,202 198,180 Q204,184 212,178 Z"},{"id":"أسفل الظهر","d":"M132,170 L168,170 Q170,194 166,214 Q150,222 134,214 Q130,194 132,170 Z"},{"id":"أرداف","d":"M126,218 Q138,212 150,216 Q150,250 134,256 Q122,250 122,232 Q122,222 126,218 Z"},{"id":"أرداف","d":"M174,218 Q162,212 150,216 Q150,250 166,256 Q178,250 178,232 Q178,222 174,218 Z"},{"id":"خلفي الفخذ","d":"M124,256 Q118,300 124,330 Q134,338 144,330 Q148,300 146,258 Q134,262 124,256 Z"},{"id":"خلفي الفخذ","d":"M176,256 Q182,300 176,330 Q166,338 156,330 Q152,300 154,258 Q166,262 176,256 Z"},{"id":"ساق","d":"M124,338 Q120,390 128,442 Q138,448 144,440 Q146,388 142,340 Q134,346 124,338 Z"},{"id":"ساق","d":"M176,338 Q180,390 172,442 Q162,448 156,440 Q154,388 158,340 Q166,346 176,338 Z"}],"labels":[["ترابس",150,96,8],["كتف",103,112,8],["كتف",197,112,8],["ظهر",130,140,9],["ظهر",170,140,9],["ترايسبس",96,156,7],["ترايسبس",204,156,7],["ساعد",91,206,8],["ساعد",209,206,8],["أسفل الظهر",150,194,8],["مؤخرة",150,238,8],["خلفي الفخذ",134,296,8],["خلفي الفخذ",166,296,8],["سمانة",133,396,8],["سمانة",167,396,8]]};

function Figure({ fig, intensity, selected, onSelect, name }: { fig: Fig; intensity: Record<string, number>; selected?: string | null; onSelect?: (id: string) => void; name: (id: string) => string }) {
  return (
    <svg viewBox="0 0 300 540" className="mx-auto block h-auto w-full max-w-[270px]" role="group">
      {fig.fixed.map((f, i) => {
        if (f.k === 'e') return <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.5} />;
        if (f.k === 'p') return <path key={i} d={f.d} fill={f.fill === 'none' ? 'none' : 'var(--surface-2)'} stroke="var(--border-strong)" strokeWidth={f.sw} />;
        return <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} fill="none" stroke="var(--border-strong)" strokeWidth={1.4} opacity={0.5} />;
      })}
      {fig.muscles.map((m, i) => {
        const sel = selected === m.id;
        const pct = Math.round(Math.min(1, intensity[m.id] ?? 0) * 85);
        return (
          <path
            key={i}
            d={m.d}
            role="button"
            tabIndex={0}
            aria-label={name(m.id)}
            aria-pressed={sel}
            fill={`color-mix(in oklab, var(--health) ${pct}%, var(--surface-2))`}
            stroke={sel ? 'var(--health)' : 'var(--border-strong)'}
            strokeWidth={sel ? 2 : 1.6}
            style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'fill .15s, stroke .15s' }}
            onClick={() => onSelect?.(m.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(m.id); } }}
          />
        );
      })}
      {fig.labels.map(([t, x, y, fs], i) => (
        <text key={i} x={x} y={y} fontSize={fs} fontWeight={700} textAnchor="middle" fill="var(--fg-3)" pointerEvents="none">{t}</text>
      ))}
    </svg>
  );
}

export function MuscleMap({ intensity, onSelect, selected }: { intensity: Record<string, number>; onSelect?: (muscleId: string) => void; selected?: string | null }) {
  const { L } = useI18n();
  const name = (id: string) => { const m = MUSCLES.find((x) => x.id === id); return m ? L(m.ar, m.en) : id; };
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Figure fig={FRONT} intensity={intensity} selected={selected} onSelect={onSelect} name={name} />
        <div className="mt-1 text-center text-[12px] font-bold text-fg-3">{L('أمام', 'Front')}</div>
      </div>
      <div>
        <Figure fig={BACK} intensity={intensity} selected={selected} onSelect={onSelect} name={name} />
        <div className="mt-1 text-center text-[12px] font-bold text-fg-3">{L('خلف', 'Back')}</div>
      </div>
    </div>
  );
}
