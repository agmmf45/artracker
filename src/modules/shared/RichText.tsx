import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { Bold, Italic, Heading2, List, ListChecks, Quote, Highlighter, Undo2, Redo2 } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';

/*
 * What-you-see writing for the notebook, journal and notes. Text is still stored as Markdown
 * (so search, previews, exports and everything already written keep working): Markdown → HTML on
 * load, HTML → Markdown on every change.
 */

const marked = new Marked({ gfm: true, breaks: true });

/** Markdown → the HTML TipTap understands (task lists in its own shape, ==highlight== as <mark>). */
export function mdToHtml(md: string): string {
  const src = (md ?? '').replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  const html = DOMPurify.sanitize(marked.parse(src, { async: false }) as string);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('li').forEach((li) => {
    const box = li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]') as HTMLInputElement | null;
    if (!box) return;
    const checked = box.hasAttribute('checked');
    box.remove();
    li.setAttribute('data-type', 'taskItem');
    li.setAttribute('data-checked', String(checked));
    li.parentElement?.setAttribute('data-type', 'taskList');
  });
  return doc.body.firstElementChild?.innerHTML ?? '';
}

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', br: '\n' });
// keep [[links]], {{task:…}} and Arabic punctuation exactly as typed
td.escape = (s: string) => s;
// tight list items ("- item", "1. item") — turndown's default pads them and adds blank lines
td.addRule('listItem', {
  filter: (n) => n.nodeName === 'LI' && (n as HTMLElement).getAttribute('data-type') !== 'taskItem',
  replacement: (content, n) => {
    const li = n as HTMLElement;
    const parent = li.parentElement;
    let prefix = '- ';
    if (parent?.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? 1);
      prefix = `${start + Array.prototype.indexOf.call(parent.children, li)}. `;
    }
    const body = content.replace(/^\n+|\n+$/g, '').replace(/\n{2,}/g, '\n').replace(/\n/g, '\n  ');
    return `${prefix}${body}\n`;
  },
});
td.addRule('taskItem', {
  filter: (n) => n.nodeName === 'LI' && (n as HTMLElement).getAttribute('data-type') === 'taskItem',
  replacement: (content, n) => `- [${(n as HTMLElement).getAttribute('data-checked') === 'true' ? 'x' : ' '}] ${content.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' ')}\n`,
});
td.addRule('mark', { filter: 'mark', replacement: (content) => (content.trim() ? `==${content}==` : '') });

/** Markdown → one line of plain text for previews and lists. */
export function plainText(md: string): string {
  return (md ?? '')
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\*\*|__|==|~~|`/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_]/g, '$1$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();
}

export function htmlToMd(html: string): string {
  return td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

function Toolbar({ editor, sticky }: { editor: Editor; sticky?: boolean }) {
  const { L } = useI18n();
  const btn = (on: boolean, label: string, icon: React.ReactNode, run: () => void) => (
    <button type="button" key={label} onMouseDown={(e) => e.preventDefault()} onClick={run} aria-label={label} title={label} aria-pressed={on}
      className={clsx('grid size-8 shrink-0 place-items-center rounded-[9px] transition-colors sm:size-9', on ? 'bg-fg text-bg' : 'text-fg hover:bg-surface-2')}>
      {icon}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label={L('أدوات التنسيق', 'Formatting')}
      className={clsx('flex items-center gap-0.5 overflow-x-auto rounded-[12px] bg-[color-mix(in_oklab,var(--surface-2)_70%,var(--surface))] p-1 [scrollbar-width:none]', sticky && 'sticky top-0 z-10')}>
      {btn(editor.isActive('bold'), L('عريض', 'Bold'), <Bold size={17} />, () => c().toggleBold().run())}
      {btn(editor.isActive('italic'), L('مائل', 'Italic'), <Italic size={17} />, () => c().toggleItalic().run())}
      {btn(editor.isActive('heading', { level: 2 }), L('عنوان', 'Heading'), <Heading2 size={17} />, () => c().toggleHeading({ level: 2 }).run())}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
      {btn(editor.isActive('bulletList'), L('قائمة', 'List'), <List size={17} />, () => c().toggleBulletList().run())}
      {btn(editor.isActive('taskList'), L('قائمة مهام', 'Checklist'), <ListChecks size={17} />, () => c().toggleTaskList().run())}
      {btn(editor.isActive('blockquote'), L('اقتباس', 'Quote'), <Quote size={17} />, () => c().toggleBlockquote().run())}
      {btn(editor.isActive('highlight'), L('تظليل', 'Highlight'), <Highlighter size={17} />, () => c().toggleHighlight().run())}
      <span className="flex-1" />
      {btn(false, L('تراجع', 'Undo'), <Undo2 size={17} />, () => c().undo().run())}
      {btn(false, L('إعادة', 'Redo'), <Redo2 size={17} />, () => c().redo().run())}
    </div>
  );
}

/**
 * A rich text box: real bold/headings/lists/checklists/quotes/highlight, no symbols to learn.
 * `value` is Markdown; `onChange` gets Markdown back (call sites debounce their own saving).
 * When `value` changes from outside (another device), the content is replaced unless it already matches.
 */
export function RichText({ value, onChange, placeholder, className, autoFocus, sticky = true, ariaLabel }: {
  value: string; onChange: (md: string) => void; placeholder?: string; className?: string; autoFocus?: boolean; sticky?: boolean; ariaLabel?: string;
}) {
  const last = useRef(value);
  const cb = useRef(onChange);
  cb.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: mdToHtml(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'rich-doc', dir: 'auto', 'aria-label': ariaLabel ?? '', 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor: ed }) => {
      const md = htmlToMd(ed.getHTML());
      last.current = md;
      cb.current(md);
    },
  });

  // an outside change (sync, version restore, template) replaces the content
  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value;
    editor.commands.setContent(mdToHtml(value), { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className={clsx('min-h-40', className)} />;
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <Toolbar editor={editor} sticky={sticky} />
      <EditorContent editor={editor} />
    </div>
  );
}
