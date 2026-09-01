import { describe, expect, it } from 'vitest';
import type { TrackerScriptEntry } from '@brisk/shared-types';
import {
  partitionTrackerScripts,
  renderGatedScripts,
  renderUngatedScripts,
} from './consent-script-blocking';

const entries: TrackerScriptEntry[] = [
  {
    id: 'a1',
    label: 'Necessary head thing',
    category: 'necessary',
    placement: 'head',
    html: '<script>console.log("necessary")</script>',
  },
  {
    id: 'a2',
    label: 'Google Analytics',
    category: 'measurement',
    placement: 'head',
    html: '<script>gtag("config", "G-XXXX")</script>',
  },
  {
    id: 'a3',
    label: 'Meta Pixel',
    category: 'experience',
    placement: 'body',
    html: '<script>fbq("init", "123")</script>',
  },
];

describe('partitionTrackerScripts', () => {
  it('splits necessary (always-on) from every other category, for the given placement', () => {
    const head = partitionTrackerScripts(entries, 'head');

    expect(head.ungated).toEqual([entries[0]]);
    expect(head.gated).toEqual([entries[1]]);
  });

  it('filters out entries for the other placement', () => {
    const body = partitionTrackerScripts(entries, 'body');

    expect(body.ungated).toEqual([]);
    expect(body.gated).toEqual([entries[2]]);
  });

  it('returns empty arrays when nothing matches', () => {
    const result = partitionTrackerScripts([], 'head');

    expect(result).toEqual({ ungated: [], gated: [] });
  });
});

describe('renderUngatedScripts', () => {
  it('nonce-stamps every entry, same as injectScriptNonce', () => {
    const html = renderUngatedScripts([entries[0]], 'abc123');

    expect(html).toBe(
      '<script nonce="abc123">console.log("necessary")</script>',
    );
  });
});

describe('renderGatedScripts', () => {
  it('wraps each entry in an inert template tagged with its category and id', () => {
    const html = renderGatedScripts([entries[1]]);

    expect(html).toBe(
      '<template data-brisk-consent="measurement" data-brisk-id="a2"><script>gtag("config", "G-XXXX")</script></template>',
    );
  });

  it('does not nonce-stamp the inner script — activation does that client-side', () => {
    const html = renderGatedScripts([entries[1]]);

    expect(html).not.toContain('nonce=');
  });

  it('joins multiple entries with no separator', () => {
    const html = renderGatedScripts([entries[1], entries[2]]);

    expect(html).toBe(
      '<template data-brisk-consent="measurement" data-brisk-id="a2"><script>gtag("config", "G-XXXX")</script></template>' +
        '<template data-brisk-consent="experience" data-brisk-id="a3"><script>fbq("init", "123")</script></template>',
    );
  });
});
