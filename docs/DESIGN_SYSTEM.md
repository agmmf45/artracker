# Design system

Source: `src/design/tokens.css` (tokens), `src/design/index.css` (Tailwind mapping), `src/design/ui.tsx`, `overlay.tsx`, `charts.tsx`.

- **Colour**: neutral foundation; light = warm off-white (`--bg #F6F4EF`), dark = graphite (`--bg #101113`, `--surface #16181B`, `--elevated #1D2024`, `--border #292D32`). Section accents: Life `#A69BCB`/`#6E62A8`, Study `#799FCB`/`#3B6BA3`, Health `#83B89C`/`#357F5B`, Reward `#D5B178`/`#9C6F22` (dark/light). `[data-section]` on `<main>` switches `--accent`. v4 themes are accent/background overrides (`data-legacy-theme`); dark ones force the dark palette.
- **Type**: Thmanyah Sans (UI, Arabic + Latin) and Thmanyah Serif Display (brand); tabular numerals via `.num`.
- **Spacing** 8-pt (`--sp-*`, 4 px for tight spots); **radius** 6/10/14/20; **elevation** 3 shadow levels; **motion** 120/200/320 ms with `--ease-out`; all disabled under `prefers-reduced-motion`.
- **Direction**: logical properties only (`ms-/me-/ps-/pe-/start/end`), so Arabic RTL and English LTR share one layout.
- **Components**: Button, IconButton (always labelled), Card, PageHeader, Section, EmptyState (encouraging copy), Input/Textarea/Select/Switch/Segmented/Chip, Bar/Ring/Stat, CheckCircle (pop + haptic), Modal (bottom sheet on phones, dialog on desktop; focus trap, Esc), Menu, confirm/prompt, Toast with Undo.
- **Charts**: Bars, Line, Heatmap, Donut, Legend — SVG, data-only, accessible labels, empty states instead of decorative placeholders.
- **Icons**: lucide-react.
