// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { RICH_TEXT_EXTENSIONS } from '@brisk/rich-text-editor';
import type { RichTextMenuLabels } from '@brisk/shared-types';
import { createRichTextBubbleMenu } from './rich-text-bubble-menu';

const labels: RichTextMenuLabels = {
  bold: 'Grassetto',
  italic: 'Corsivo',
  underline: 'Sottolineato',
  strike: 'Barrato',
  bulletList: 'Elenco puntato',
  orderedList: 'Elenco numerato',
  linkToPage: 'Collega a una pagina',
  linkToUrl: 'Collega a un indirizzo web',
  unlink: 'Rimuovi il collegamento',
  urlPrompt: 'Indirizzo web',
};

function build(onRequestPageLink = vi.fn()) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: RICH_TEXT_EXTENSIONS,
    content: '<p>ciao mondo</p>',
  });
  const menu = createRichTextBubbleMenu(
    document,
    editor,
    labels,
    onRequestPageLink,
  );
  return { editor, menu, onRequestPageLink };
}

function menuElement(): HTMLElement {
  const el = document.getElementById('brisk-rich-text-menu');
  if (!el) throw new Error('the menu was not added to the document');
  return el;
}

describe('createRichTextBubbleMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('stays hidden while nothing is selected', () => {
    const { menu } = build();
    menu.refresh();

    expect(menuElement().style.display).toBe('none');
  });

  it('appears once there is a selection', () => {
    const { editor, menu } = build();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    menu.refresh();

    expect(menuElement().style.display).toBe('flex');
  });

  it('labels every button in the editor language, not the site one', () => {
    const { menu } = build();
    menu.refresh();

    const titles = [...menuElement().querySelectorAll('button')].map(
      (button) => button.title,
    );
    expect(titles).toContain('Grassetto');
    expect(titles).toContain('Collega a una pagina');
  });

  // The menu lives in the preview iframe, which is a rendered SITE
  // carrying the theme's own CSS. Inheriting it would make the menu look
  // different on every theme, and a theme could make it unreadable.
  it('opts out of the theme stylesheet around it', () => {
    build().menu.refresh();

    expect(menuElement().style.all).toBe('initial');
    for (const button of menuElement().querySelectorAll('button')) {
      expect((button as HTMLElement).style.all).toBe('initial');
    }
  });

  // The picker is editor chrome and cannot be opened from inside the
  // iframe, so the button asks the parent instead of doing it itself.
  it('asks the parent to pick a page rather than trying to', () => {
    const { editor, menu, onRequestPageLink } = build();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    menu.refresh();

    const button = [...menuElement().querySelectorAll('button')].find(
      (b) => b.title === labels.linkToPage,
    );
    button?.click();

    expect(onRequestPageLink).toHaveBeenCalledTimes(1);
  });

  it('formats the selection, and shows the button as active afterwards', () => {
    const { editor, menu } = build();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    menu.refresh();

    const bold = [...menuElement().querySelectorAll('button')].find(
      (b) => b.title === labels.bold,
    );
    bold?.click();
    menu.refresh();

    expect(editor.getHTML()).toContain('<strong>');
    expect(bold?.style.background).not.toBe('transparent');
  });

  it('takes itself out of the document when destroyed', () => {
    const { menu } = build();
    menu.destroy();

    expect(document.getElementById('brisk-rich-text-menu')).toBeNull();
  });
});
