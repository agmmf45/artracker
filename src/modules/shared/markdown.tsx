import { useEffect, useMemo, useState } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Markdown → sanitized HTML.
 * Extensions: [[Note title]] internal links, {{task:ID}} live task references, Obsidian-style
 * callouts (> [!note]), $inline$ / $$block$$ math (KaTeX, loaded only when used), task lists.
 * Output always passes DOMPurify — user content can never inject scripts.
 */

export interface MdContext {
  noteIdByTitle?: Map<string, string>;
  tasks?: Map<string, { title: string; done: boolean }>;
}

const marked = new Marked({ gfm: true, breaks: true });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type Katex = { renderToString: (tex: string, opts: object) => string };
let katex: Katex | null = null;
let katexLoading: Promise<void> | null = null;
function loadKatex(): Promise<void> {
  if (katex) return Promise.resolve();
  katexLoading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => { katex = (m.default ?? m) as Katex; });
  return katexLoading;
}

export function renderMarkdown(src: string, ctx: MdContext = {}): string {
  let text = src ?? '';
  // math first (protect from markdown)
  const math: string[] = [];
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => { math.push(renderTex(tex, true)); return `@@MATH${math.length - 1}@@`; });
  text = text.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, tex) => { math.push(renderTex(tex, false)); return `${pre}@@MATH${math.length - 1}@@`; });
  // internal links
  text = text.replace(/\[\[([^\]\n]{1,120})\]\]/g, (_, title: string) => {
    const t = title.trim();
    const id = ctx.noteIdByTitle?.get(t.toLowerCase());
    return id ? `<a href="#" data-note="${escapeHtml(id)}" class="md-link">${escapeHtml(t)}</a>` : `<a href="#" data-new-note="${escapeHtml(t)}" class="md-link md-missing">${escapeHtml(t)}</a>`;
  });
  // linked tasks
  text = text.replace(/\{\{task:([\w:.\-]{1,160})\}\}/g, (_, id: string) => {
    const t = ctx.tasks?.get(id);
    if (!t) return `<span class="md-task md-missing">(مهمة محذوفة)</span>`;
    return `<button type="button" data-task="${escapeHtml(id)}" class="md-task${t.done ? ' md-done' : ''}" aria-pressed="${t.done}"><span class="md-box">${t.done ? '✓' : ''}</span>${escapeHtml(t.title)}</button>`;
  });
  let html = marked.parse(text, { async: false }) as string;
  // callouts: <blockquote><p>[!note] ...
  html = html.replace(/<blockquote>\s*<p>\[!(note|tip|warning|important|info)\]\s*/gi, (_, k: string) => `<blockquote class="md-callout md-${k.toLowerCase()}"><p>`);
  html = html.replace(/@@MATH(\d+)@@/g, (_, i) => math[Number(i)] ?? '');
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-note', 'data-new-note', 'data-task', 'aria-pressed', 'target'],
    ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'annotation', 'mtext', 'mspace', 'mover', 'munder', 'mtable', 'mtr', 'mtd'],
  });
}

function renderTex(tex: string, block: boolean): string {
  if (!katex) return `<code class="md-tex">${escapeHtml(tex)}</code>`;
  try { return katex.renderToString(tex, { displayMode: block, throwOnError: false, output: 'html' }); } catch { return `<code>${escapeHtml(tex)}</code>`; }
}

export function Markdown({ text, ctx, onNote, onNewNote, onTask, className }: { text: string; ctx?: MdContext; onNote?: (id: string) => void; onNewNote?: (title: string) => void; onTask?: (id: string) => void; className?: string }) {
  const [, setTick] = useState(0);
  const needsMath = /\$[^$\n]+\$/.test(text);
  useEffect(() => { if (needsMath && !katex) void loadKatex().then(() => setTick((t) => t + 1)); }, [needsMath]);
  const html = useMemo(() => renderMarkdown(text, ctx), [text, ctx, katex]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className={`md ${className ?? ''}`}
      // sanitized by DOMPurify in renderMarkdown
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest('[data-note],[data-new-note],[data-task],a[href]') as HTMLElement | null;
        if (!el) return;
        if (el.dataset.note) { e.preventDefault(); onNote?.(el.dataset.note); }
        else if (el.dataset.newNote) { e.preventDefault(); onNewNote?.(el.dataset.newNote); }
        else if (el.dataset.task) { e.preventDefault(); onTask?.(el.dataset.task); }
        else if (el instanceof HTMLAnchorElement && /^https?:/.test(el.href)) { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      }}
    />
  );
}

/** [[links]] inside a note body (titles, lower-cased). */
export function extractLinks(body: string): string[] {
  return [...new Set([...(body ?? '').matchAll(/\[\[([^\]\n]{1,120})\]\]/g)].map((m) => m[1].trim().toLowerCase()))];
}
