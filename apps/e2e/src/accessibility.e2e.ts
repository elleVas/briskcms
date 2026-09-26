import AxeBuilder from '@axe-core/playwright';
import { BriskApi } from './support/brisk-api';
import { CanvasEditor } from './support/canvas-editor';
import { Cleanup } from './support/cleanup';
import { environment } from './support/environment';
import { expect, test } from './support/test';

/**
 * Every screen of the editor passes axe's WCAG 2.2 AA rules, in both
 * themes, at desktop and phone width. On 2026-09-26 the count was zero
 * everywhere, so any violation this reports is a new one.
 *
 * Every request a screen makes to the API has to succeed too: walking
 * every screen is the cheapest place to notice one that is refused.
 *
 * The page drawn inside the canvas is not audited here: it is the public
 * site's markup, sits on another origin, and would make every editor
 * screen answer for a theme's choices.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const THEMES = ['light', 'dark'] as const;
const WIDTHS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
] as const;

/** Screens that open on the canvas, which is ready only once its page is loaded. */
const CANVAS_SCREEN = /^(page-groups\/|layout\/(header|footer))/;

// One page and one form of the suite's own, so the screens that edit one
// have something to open. Each is handed to `cleanup` the moment it
// exists: a setup that fails halfway still removes what it made.
let subjects: { pageGroupId: string; formId: string; locale: string };
const cleanup = new Cleanup();

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: environment.apiUrl,
    storageState: environment.storageStatePath,
  });
  cleanup.add(() => request.dispose());
  const api = new BriskApi(request);
  const site = await api.currentSite();
  const name = `e2e-a11y-${test.info().workerIndex}-${Date.now()}`;
  const { group } = await api.createPage({
    siteId: site.id,
    locale: site.defaultLocale,
    slug: name,
    title: name,
    content: [{ type: 'Heading', props: { text: name, level: 'h2' } }],
  });
  cleanup.add(() => api.deletePage(group.id));
  const form = await api.createForm(site.id, name);
  cleanup.add(() => api.deleteForm(form.id));
  subjects = {
    pageGroupId: group.id,
    formId: form.id,
    locale: site.defaultLocale,
  };
});

test.afterAll(() => cleanup.run());

function screens(): string[] {
  return [
    '',
    'pages',
    `page-groups/${subjects.pageGroupId}`,
    'media',
    'forms',
    `forms/${subjects.formId}`,
    'layout',
    `layout/header?locale=${subjects.locale}`,
    `layout/footer?locale=${subjects.locale}`,
    'sections',
    'taxonomies',
    'style',
    'cookies',
    'cookies/legal-documents',
    'integrations',
    'imports',
    'users',
    'account',
  ];
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`every editor screen passes axe and loads without an API error — ${theme} theme, ${width.name}`, async ({
      page,
    }) => {
      // One test walks every screen: about a second and a half each,
      // more on a busy CI runner, well past the 30 seconds one flow gets.
      test.setTimeout(screens().length * 10_000);
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(width.viewport);

      const failures: string[] = [];
      let screenPath = '';
      page.on('response', (response) => {
        if (
          response.url().startsWith(environment.apiUrl) &&
          response.status() >= 400
        ) {
          failures.push(
            `/${screenPath}: ${response.status()} from ${response.request().method()} ${response.url()}`,
          );
        }
      });
      for (const screen of screens()) {
        screenPath = screen;
        await test.step(`/${screen}`, async () => {
          await page.goto(screen);
          await page.waitForLoadState('networkidle');
          // A lapsed session would put every screen on the login form,
          // which passes, and the gate with it.
          await expect(page).not.toHaveURL(/\/login/);
          if (CANVAS_SCREEN.test(screen)) {
            await new CanvasEditor(page).waitUntilLoaded();
          }
          const results = await new AxeBuilder({ page })
            .withTags(WCAG_TAGS)
            .exclude('iframe[title="Page preview"]')
            .analyze();
          for (const violation of results.violations) {
            failures.push(
              `/${screen}: ${violation.id} (${violation.impact}) — ${violation.help} — ${violation.nodes
                .slice(0, 3)
                .map((node) => node.target.join(' '))
                .join(', ')}`,
            );
          }
        });
      }
      expect(failures).toEqual([]);
    });
  }
}
