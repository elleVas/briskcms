import type { Page } from '@playwright/test';
import { CanvasEditor } from './support/canvas-editor';
import { expect, test } from './support/test';
import type { Block } from './support/wire-schemas';

function heading(id: string, text: string): Block {
  return { id, type: 'Heading', props: { text, level: 'h2' } };
}

function text(id: string, body: string): Block {
  return { id, type: 'Text', props: { body: `<p>${body}</p>` } };
}

function layerRow(page: Page, blockId: string) {
  return page.locator(`[data-testid="layer-row"][data-block-id="${blockId}"]`);
}

/** Where a row is drawn right now, mid-drag included. */
async function top(page: Page, blockId: string): Promise<number> {
  return (await layerRow(page, blockId).boundingBox())?.y ?? Number.NaN;
}

test('layers reorder by keyboard and by mouse, and the page saves the new order', async ({
  page,
  api,
  cleanup,
  uniqueName,
}) => {
  const site = await api.currentSite();
  const [a, b, c] = ['a', 'b', 'c'].map((suffix) => `${uniqueName}-${suffix}`);
  const { group } = await api.createPage({
    siteId: site.id,
    locale: site.defaultLocale,
    slug: uniqueName,
    title: uniqueName,
    content: [heading(a, 'One'), heading(b, 'Two'), heading(c, 'Three')],
  });
  cleanup.add(() => api.deletePage(group.id));
  const savedOrder = async () =>
    (await api.pageGroup(group.id)).content.map((block) => block.id);

  await page.goto(`page-groups/${group.id}`);
  await new CanvasEditor(page).waitUntilLoaded();

  // Keyboard: the handle beside a row picks it up with Space, the arrows
  // move it, Space puts it down.
  const handle = layerRow(page, c)
    .locator('..')
    .getByRole('button', { name: /^Drag / });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  // One row per press, each waited for: a press that lands while the
  // previous move is still animating is dropped, as it would be for a
  // person pressing that fast.
  for (const passing of [b, a]) {
    const target = await top(page, passing);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => top(page, c)).toBeLessThanOrEqual(target);
  }
  await page.keyboard.press('Space');
  await expect.poll(savedOrder).toEqual([c, a, b]);

  // Mouse: the row itself is dragged, below the last one.
  const from = await layerRow(page, a).boundingBox();
  const last = await layerRow(page, b).boundingBox();
  if (!from || !last) throw new Error('The layer rows are not on screen');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, last.y + last.height + 8, {
    steps: 12,
  });
  await page.mouse.up();
  await expect.poll(savedOrder).toEqual([c, b, a]);

  // The canvas follows the saved order.
  await expect(new CanvasEditor(page).canvas.getByRole('heading')).toHaveText([
    'Three',
    'Two',
    'One',
  ]);
});

test('restoring a header version right after an edit keeps the restored version', async ({
  page,
  api,
  cleanup,
  uniqueName,
}) => {
  const site = await api.currentSite();
  // The header editor draws the header over a real page in its language.
  const { group } = await api.createPage({
    siteId: site.id,
    locale: site.defaultLocale,
    slug: uniqueName,
    title: uniqueName,
    content: [],
  });
  cleanup.add(() => api.deletePage(group.id));

  // The header is the site's own, not the test's: whatever it held goes
  // back when the test ends. Its published version is never touched.
  // Text, not Heading: a header offers its own set of blocks, and Heading
  // is not one of them, so it would not be editable there.
  const header = await api.layoutSection(site.id, site.defaultLocale, 'header');
  // Holding a test's blocks already, it is another run's header, not the
  // site's: putting that back at the end would leave test content behind.
  // Two runs of this test at once cannot share one header.
  const borrowed = header.content.some((block) => block.id?.startsWith('e2e-'));
  if (borrowed) {
    throw new Error(
      'The header draft holds e2e blocks: another run of this test is going on, or one was cut short. ' +
        "Wait for it, or set the draft back to the published header (docs/development.md, 'End-to-end tests').",
    );
  }
  cleanup.add(() => api.saveLayoutSectionDraft(header.id, header.content));
  const blockId = `${uniqueName}-title`;
  const restored = `Restored ${uniqueName}`;
  const current = `Current ${uniqueName}`;
  await api.saveLayoutSectionDraft(header.id, [text(blockId, restored)]);
  await api.saveLayoutSectionDraft(header.id, [text(blockId, current)]);

  await page.goto(`layout/header?locale=${site.defaultLocale}`);
  const editor = new CanvasEditor(page);
  await editor.waitUntilLoaded();
  // Restored straight after typing, the way a person undoes a slip: the
  // edit is still waiting to be saved when the restore is asked for, and
  // must not land on top of it afterwards.
  await editor.replaceText(current, `Edited ${uniqueName}`);
  await page.getByRole('button', { name: 'Version history' }).click();
  // Newest first: "Current version", then the one saved before it.
  await page
    .getByRole('dialog', { name: 'Version history' })
    .getByRole('button', { name: 'Restore' })
    .first()
    .click();

  await expect(
    editor.canvas.getByText(restored, { exact: true }),
  ).toBeVisible();
  await editor.waitUntilSaved();
  const section = await api.layoutSection(
    site.id,
    site.defaultLocale,
    'header',
  );
  expect(section.content.map((block) => block.props.body)).toEqual([
    `<p>${restored}</p>`,
  ]);
});
