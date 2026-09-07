import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { buildPageLinkHref } from '@brisk/shared-types';
import { useTranslation } from 'react-i18next';
import { usePageList } from '../../page-list-context';
import { RICH_TEXT_EXTENSIONS } from '@brisk/rich-text-editor';

export interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const BUTTON_CLASS =
  'rounded px-1.5 py-0.5 text-xs leading-none hover:bg-accent disabled:opacity-40';
const ACTIVE_CLASS = 'bg-accent font-semibold';

function ToolbarButton({
  editor,
  label,
  title,
  isActive,
  onClick,
}: {
  editor: Editor;
  label: string;
  title: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive ?? false}
      className={`${BUTTON_CLASS} ${isActive ? ACTIVE_CLASS : ''}`}
      // The editor loses its selection to a focused button otherwise, and
      // the command then applies to nothing.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={!editor.isEditable}
    >
      {label}
    </button>
  );
}

/**
 * The Inspector control for a `kind: 'richtext'` field (ADR-0046).
 *
 * The value is an HTML string, which is what makes per-locale translation
 * work unchanged — the overlay that carries translations maps a field to
 * a string, and this stays one.
 *
 * "Link to a page" is the reason the whole field kind exists, and it does
 * NOT write a path. It writes a reference the render step resolves in the
 * locale being read, so renaming or moving a page never breaks a link
 * written inside a sentence, and one stored value serves every language.
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
}: RichTextFieldProps) {
  const { t } = useTranslation();
  const { pick } = usePageList();

  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value,
    onUpdate: ({ editor: current }) => {
      // An empty document is `<p></p>`, and every "has this been filled
      // in?" check in the product tests for `''`. Reporting the empty
      // string keeps required-field warnings and defaults working.
      onChange(current.isEmpty ? '' : current.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-20 w-full rounded-b-lg border border-t-0 border-input px-2.5 py-2 text-sm outline-none focus-visible:border-ring',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  // The value can change from outside this field — undo/redo, a rollback,
  // switching language. Without this the editor would keep showing what
  // it had. Guarded on inequality so typing does not reset the caret on
  // every keystroke.
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const current = editor.isEmpty ? '' : editor.getHTML();
      if (current !== value) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  async function handleLinkToPage() {
    if (!editor) return;
    const picked = await pick();
    if (!picked) return;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: buildPageLinkHref(picked.pageGroupId) })
      .run();
  }

  function handleLinkToUrl() {
    if (!editor) return;
    const previous: unknown = editor.getAttributes('link')['href'];
    const url = window.prompt(
      t('canvas.richText.urlPrompt'),
      typeof previous === 'string' && !previous.startsWith('brisk:')
        ? previous
        : 'https://',
    );
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    (url === '' ? chain.unsetLink() : chain.setLink({ href: url })).run();
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-input bg-muted/40 px-1 py-1">
        <ToolbarButton
          editor={editor}
          label="B"
          title={t('canvas.richText.bold')}
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          editor={editor}
          label="I"
          title={t('canvas.richText.italic')}
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          editor={editor}
          label="U"
          title={t('canvas.richText.underline')}
          isActive={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          editor={editor}
          label="S"
          title={t('canvas.richText.strike')}
          isActive={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          editor={editor}
          label="•"
          title={t('canvas.richText.bulletList')}
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          editor={editor}
          label="1."
          title={t('canvas.richText.orderedList')}
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          editor={editor}
          label="¶→"
          title={t('canvas.richText.linkToPage')}
          isActive={editor.isActive('link')}
          onClick={() => void handleLinkToPage()}
        />
        <ToolbarButton
          editor={editor}
          label="↗"
          title={t('canvas.richText.linkToUrl')}
          onClick={handleLinkToUrl}
        />
        <ToolbarButton
          editor={editor}
          label="⊘"
          title={t('canvas.richText.unlink')}
          onClick={() => editor.chain().focus().unsetLink().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
