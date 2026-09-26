import { expect, type FrameLocator, type Page } from '@playwright/test';

/**
 * The canvas editor as a person sees it: the page drawn in an iframe
 * served by the public site, with the block palette on the left and the
 * layers on the right.
 */
export class CanvasEditor {
  readonly canvas: FrameLocator;

  constructor(private readonly page: Page) {
    this.canvas = page.frameLocator('iframe[title="Page preview"]');
  }

  /**
   * Waits until the canvas has loaded the page, which the editor shows by
   * taking its "Loading the page…" away and turning the palette on.
   */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.page.getByTitle('Page preview')).toBeVisible();
    await expect(this.page.getByText('Loading the page…')).toBeHidden({
      timeout: 15_000,
    });
  }

  /** Where the editor tells its save is done: "Draft saved at …". */
  async waitUntilSaved(): Promise<void> {
    await expect(this.page.getByText(/saved at/)).toBeVisible();
  }

  async insertBlock(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click();
  }

  /** Double-clicks a text in the canvas, replaces it, and leaves it the way the editor commits it: Escape. */
  async replaceText(current: string, next: string): Promise<void> {
    await this.canvas.getByText(current, { exact: true }).dblclick();
    // The double-click goes to the editor and back before the text turns
    // editable; keys typed in between would land on nothing.
    await expect(this.canvas.locator('[contenteditable="true"]')).toBeFocused();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.type(next);
    await this.page.keyboard.press('Escape');
  }

  async publish(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(
      this.page.getByText('Published', { exact: true }),
    ).toBeVisible();
  }
}
