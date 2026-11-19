import { useI18n } from '@/core/i18n';

/**
 * Body/muscle map: front and back figures (a cleaner flat drawing, left and right muscles as separate
 * shapes, no text on the body). Muscle ids are the legacy Arabic keys (FIT_MUSCLES), so legacy workout
 * data (exercise.muscle) maps directly; inner thighs count as «رجل» and obliques as «بطن».
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

const FRONT: Fig = {"fixed": [{"k": "e", "cx": 150, "cy": 34, "rx": 22, "ry": 22}, {"k": "p", "d": "M140 55 L140 76 L160 76 L160 55", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M140 75 Q125 78 112 83 L88 91 Q78 96 78 108 L91 173 Q96 185 107 189 L112 217 L188 217 L193 189 Q204 185 209 173 L222 108 Q222 96 212 91 L188 83 Q175 78 160 75 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M112 83 Q99 80 90 89 Q83 96 80 112 L63 176 Q59 190 67 196 Q75 201 81 189 L103 139 L119 101 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M188 83 Q201 80 210 89 Q217 96 220 112 L237 176 Q241 190 233 196 Q225 201 219 189 L197 139 L181 101 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M67 196 Q60 202 61 216 Q62 230 69 238 L78 235 Q83 228 81 215 L81 189 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M233 196 Q240 202 239 216 Q238 230 231 238 L222 235 Q217 228 219 215 L219 189 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M112 217 Q105 228 103 244 L100 300 Q99 321 109 338 L124 344 L142 344 L147 262 L150 250 L153 262 L158 344 L176 344 L191 338 Q201 321 200 300 L197 244 Q195 228 188 217 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M109 338 Q102 353 103 375 L108 422 L110 458 Q112 471 125 471 L139 468 L144 451 L147 406 L150 352 L153 406 L156 451 L161 468 L175 471 Q188 471 190 458 L192 422 L197 375 Q198 353 191 338 L176 344 L158 344 L150 329 L142 344 L124 344 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M110 458 Q103 470 103 482 L103 491 Q117 499 142 492 L144 476 L139 468 L125 471 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M190 458 Q197 470 197 482 L197 491 Q183 499 158 492 L156 476 L161 468 L175 471 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M103 491 Q96 499 94 510 Q94 518 106 520 L141 520 Q149 517 144 509 L142 492 Q117 499 103 491 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M197 491 Q204 499 206 510 Q206 518 194 520 L159 520 Q151 517 156 509 L158 492 Q183 499 197 491 Z", "fill": "s", "sw": 1.5}], "muscles": [{"id": "ترابس", "d": "M140 78 L150 82 L149 91 L130 91 L119 85 L133 79 Z"}, {"id": "ترابس", "d": "M160 78 L150 82 L151 91 L170 91 L181 85 L167 79 Z"}, {"id": "كتف", "d": "M113 85 Q99 83 91 94 Q85 105 92 119 Q99 129 110 121 L124 103 Z"}, {"id": "كتف", "d": "M187 85 Q201 83 209 94 Q215 105 208 119 Q201 129 190 121 L176 103 Z"}, {"id": "صدر", "d": "M121 95 Q134 91 148 96 L147 135 Q137 144 119 137 Q109 131 111 116 Q113 102 121 95 Z"}, {"id": "صدر", "d": "M179 95 Q166 91 152 96 L153 135 Q163 144 181 137 Q191 131 189 116 Q187 102 179 95 Z"}, {"id": "بايسبس", "d": "M93 126 Q102 123 108 131 L99 166 Q93 174 84 170 L88 145 Z"}, {"id": "بايسبس", "d": "M207 126 Q198 123 192 131 L201 166 Q207 174 216 170 L212 145 Z"}, {"id": "ساعد", "d": "M84 177 Q92 179 98 174 L81 222 Q77 229 70 225 L69 215 Z"}, {"id": "ساعد", "d": "M216 177 Q208 179 202 174 L219 222 Q223 229 230 225 L231 215 Z"}, {"id": "بطن", "d": "M129 146 L148 146 L148 161 L129 161 Z M129 164 L148 164 L148 179 L129 179 Z M129 182 L148 182 L148 197 L129 197 Z"}, {"id": "بطن", "d": "M152 146 L171 146 L171 161 L152 161 Z M152 164 L171 164 L171 179 L152 179 Z M152 182 L171 182 L171 197 L152 197 Z"}, {"id": "بطن", "d": "M112 142 L126 145 L126 185 L115 200 Q108 187 108 169 Z"}, {"id": "بطن", "d": "M188 142 L174 145 L174 185 L185 200 Q192 187 192 169 Z"}, {"id": "رجل", "d": "M137 225 Q143 225 146 232 L145 262 L136 290 Q133 278 135 262 Q137 244 137 225 Z"}, {"id": "رجل", "d": "M163 225 Q157 225 154 232 L155 262 L164 290 Q167 278 165 262 Q163 244 163 225 Z"}, {"id": "فخذ", "d": "M108 229 Q118 219 131 222 Q137 240 135 263 L128 315 Q118 326 108 312 Q102 292 104 264 Z"}, {"id": "فخذ", "d": "M192 229 Q182 219 169 222 Q163 240 165 263 L172 315 Q182 326 192 312 Q198 292 196 264 Z"}, {"id": "ساق", "d": "M112 354 Q122 345 139 351 L140 383 L133 432 Q127 442 118 432 L113 396 Z"}, {"id": "ساق", "d": "M188 354 Q178 345 161 351 L160 383 L167 432 Q173 442 182 432 L187 396 Z"}], "labels": []};
const BACK: Fig = {"fixed": [{"k": "e", "cx": 150, "cy": 34, "rx": 22, "ry": 22}, {"k": "p", "d": "M140 55 L140 76 L160 76 L160 55", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M140 75 Q125 78 112 83 L88 91 Q78 96 78 108 L91 173 Q96 185 107 189 L112 217 L188 217 L193 189 Q204 185 209 173 L222 108 Q222 96 212 91 L188 83 Q175 78 160 75 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M112 83 Q99 80 90 89 Q83 96 80 112 L63 176 Q59 190 67 196 Q75 201 81 189 L103 139 L119 101 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M188 83 Q201 80 210 89 Q217 96 220 112 L237 176 Q241 190 233 196 Q225 201 219 189 L197 139 L181 101 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M67 196 Q60 202 61 216 Q62 230 69 238 L78 235 Q83 228 81 215 L81 189 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M233 196 Q240 202 239 216 Q238 230 231 238 L222 235 Q217 228 219 215 L219 189 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M112 217 Q105 228 103 244 L100 300 Q99 321 109 338 L124 344 L142 344 L147 262 L150 250 L153 262 L158 344 L176 344 L191 338 Q201 321 200 300 L197 244 Q195 228 188 217 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M109 338 Q102 353 103 375 L108 422 L110 458 Q112 471 125 471 L139 468 L144 451 L147 406 L150 352 L153 406 L156 451 L161 468 L175 471 Q188 471 190 458 L192 422 L197 375 Q198 353 191 338 L176 344 L158 344 L150 329 L142 344 L124 344 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M110 458 Q103 470 103 482 L103 491 Q117 499 142 492 L144 476 L139 468 L125 471 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M190 458 Q197 470 197 482 L197 491 Q183 499 158 492 L156 476 L161 468 L175 471 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M103 491 Q96 499 94 510 Q94 518 106 520 L141 520 Q149 517 144 509 L142 492 Q117 499 103 491 Z", "fill": "s", "sw": 1.5}, {"k": "p", "d": "M197 491 Q204 499 206 510 Q206 518 194 520 L159 520 Q151 517 156 509 L158 492 Q183 499 197 491 Z", "fill": "s", "sw": 1.5}], "muscles": [{"id": "ترابس", "d": "M140 79 L150 85 L149 112 L130 111 L119 91 L134 82 Z"}, {"id": "ترابس", "d": "M160 79 L150 85 L151 112 L170 111 L181 91 L166 82 Z"}, {"id": "كتف", "d": "M113 86 Q99 83 91 96 Q85 107 93 122 Q101 130 111 119 L125 104 Z"}, {"id": "كتف", "d": "M187 86 Q201 83 209 96 Q215 107 207 122 Q199 130 189 119 L175 104 Z"}, {"id": "ظهر", "d": "M130 116 Q139 110 148 116 L147 146 Q138 160 129 177 L113 187 Q108 176 110 160 L119 130 Z"}, {"id": "ظهر", "d": "M170 116 Q161 110 152 116 L153 146 Q162 160 171 177 L187 187 Q192 176 190 160 L181 130 Z"}, {"id": "ترايسبس", "d": "M93 128 Q102 122 109 131 L99 174 Q92 181 84 172 L88 145 Z"}, {"id": "ترايسبس", "d": "M207 128 Q198 122 191 131 L201 174 Q208 181 216 172 L212 145 Z"}, {"id": "ساعد", "d": "M84 180 Q92 182 98 176 L81 222 Q77 229 70 225 L69 215 Z"}, {"id": "ساعد", "d": "M216 180 Q208 182 202 176 L219 222 Q223 229 230 225 L231 215 Z"}, {"id": "أسفل الظهر", "d": "M131 180 L148 178 L148 212 Q140 221 130 215 L119 199 Z"}, {"id": "أسفل الظهر", "d": "M169 180 L152 178 L152 212 Q160 221 170 215 L181 199 Z"}, {"id": "أرداف", "d": "M112 218 Q125 211 148 220 L148 250 Q143 272 129 278 Q112 274 107 256 Q104 234 112 218 Z"}, {"id": "أرداف", "d": "M188 218 Q175 211 152 220 L152 250 Q157 272 171 278 Q188 274 193 256 Q196 234 188 218 Z"}, {"id": "خلفي الفخذ", "d": "M108 280 Q119 276 139 282 L141 316 Q137 335 125 340 Q111 335 108 317 L104 300 Z"}, {"id": "خلفي الفخذ", "d": "M192 280 Q181 276 161 282 L159 316 Q163 335 175 340 Q189 335 192 317 L196 300 Z"}, {"id": "ساق", "d": "M110 351 Q119 342 136 349 Q143 361 139 385 L132 414 Q125 430 116 414 L110 390 Z"}, {"id": "ساق", "d": "M190 351 Q181 342 164 349 Q157 361 161 385 L168 414 Q175 430 184 414 L190 390 Z"}], "labels": []};

function Figure({ fig, intensity, fills, selected, onSelect, name }: { fig: Fig; intensity: Record<string, number>; fills?: Record<string, string>; selected?: string | null; onSelect?: (id: string) => void; name: (id: string) => string }) {
  return (
    <svg viewBox="0 0 300 540" className="mx-auto block h-auto w-full max-w-[270px]" role="group">
      {fig.fixed.map((f, i) => {
        if (f.k === 'e') return <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill="color-mix(in oklab, var(--surface-2) 45%, var(--surface))" stroke="var(--border-strong)" strokeWidth={1.5} />;
        if (f.k === 'p') return <path key={i} d={f.d} fill={f.fill === 'none' ? 'none' : 'color-mix(in oklab, var(--surface-2) 45%, var(--surface))'} stroke="var(--border-strong)" strokeWidth={f.sw} strokeLinejoin="round" />;
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
            fill={fills ? (fills[m.id] ?? 'var(--surface-2)') : `color-mix(in oklab, var(--health) ${pct}%, var(--surface-2))`}
            stroke={sel ? 'var(--health-ink)' : 'var(--border-strong)'}
            strokeWidth={sel ? 2.2 : 1.2}
            strokeLinejoin="round"
            style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'fill .15s, stroke .15s' }}
            onClick={() => onSelect?.(m.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(m.id); } }}
          ><title>{name(m.id)}</title></path>
        );
      })}
      {fig.labels.map(([t, x, y, fs], i) => (
        <text key={i} x={x} y={y} fontSize={fs} fontWeight={700} textAnchor="middle" fill="var(--fg-3)" pointerEvents="none">{t}</text>
      ))}
    </svg>
  );
}

/** `fills` (muscle id → CSS colour) overrides the intensity shading, e.g. for recovery colours. */
export function MuscleMap({ intensity, fills, onSelect, selected }: { intensity: Record<string, number>; fills?: Record<string, string>; onSelect?: (muscleId: string) => void; selected?: string | null }) {
  const { L } = useI18n();
  const name = (id: string) => { const m = MUSCLES.find((x) => x.id === id); return m ? L(m.ar, m.en) : id; };
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Figure fig={FRONT} intensity={intensity} fills={fills} selected={selected} onSelect={onSelect} name={name} />
        <div className="mt-1 text-center text-[12px] font-bold text-fg-3">{L('أمام', 'Front')}</div>
      </div>
      <div>
        <Figure fig={BACK} intensity={intensity} fills={fills} selected={selected} onSelect={onSelect} name={name} />
        <div className="mt-1 text-center text-[12px] font-bold text-fg-3">{L('خلف', 'Back')}</div>
      </div>
    </div>
  );
}
