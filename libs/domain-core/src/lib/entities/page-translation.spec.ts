import { describe, expect, it } from 'vitest';
import { PageTranslation } from './page-translation';

describe('PageTranslation entity', () => {
  const baseInput = {
    id: 'translation-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    pageGroupId: 'group-1',
    locale: 'it',
    slug: 'home',
    seoMeta: { title: 'Home', description: 'La home' },
  };

  it('starts as a draft, not diverged, with no field-value overrides and no published snapshot', () => {
    const translation = PageTranslation.create(baseInput);
    expect(translation.status).toBe('draft');
    expect(translation.isDiverged).toBe(false);
    expect(translation.divergedContent).toBeNull();
    expect(translation.publishedSnapshot).toBeNull();
    expect(translation.fieldValues).toEqual({});
  });

  it('creation is lightweight — no full content copy, just an empty overlay by default', () => {
    const translation = PageTranslation.create(baseInput);
    expect(translation.fieldValues).toEqual({});
  });

  it('create() accepts an initial fieldValues overlay', () => {
    const translation = PageTranslation.create({
      ...baseInput,
      fieldValues: { 'hero-1': { title: 'Ciao' } },
    });
    expect(translation.fieldValues).toEqual({ 'hero-1': { title: 'Ciao' } });
  });

  it('saveFieldValues replaces the overlay for this locale only', () => {
    const translation = PageTranslation.create(baseInput);
    translation.saveFieldValues({ 'hero-1': { title: 'Ciao' } });
    expect(translation.fieldValues).toEqual({ 'hero-1': { title: 'Ciao' } });
  });

  it('publish freezes the caller-computed merged content and flips status', () => {
    const translation = PageTranslation.create(baseInput);
    const merged = [{ id: 'hero-1', type: 'Hero', props: { title: 'Ciao' } }];

    translation.publish(merged);

    expect(translation.status).toBe('published');
    expect(translation.publishedSnapshot).toEqual(merged);
  });

  it('saveFieldValues after publish never touches the already-published snapshot', () => {
    const translation = PageTranslation.create(baseInput);
    translation.publish([
      { id: 'hero-1', type: 'Hero', props: { title: 'v1' } },
    ]);

    translation.saveFieldValues({ 'hero-1': { title: 'v2' } });

    expect(translation.publishedSnapshot).toEqual([
      { id: 'hero-1', type: 'Hero', props: { title: 'v1' } },
    ]);
  });

  it('diverge forks the current merged content and flips isDiverged', () => {
    const translation = PageTranslation.create(baseInput);
    const merged = [{ id: 'hero-1', type: 'Hero', props: { title: 'Ciao' } }];

    translation.diverge(merged);

    expect(translation.isDiverged).toBe(true);
    expect(translation.divergedContent).toEqual(merged);
  });

  it('saveDivergedContent updates the independent content of an already-diverged translation', () => {
    const translation = PageTranslation.create(baseInput);
    translation.diverge([
      { id: 'hero-1', type: 'Hero', props: { title: 'v1' } },
    ]);

    translation.saveDivergedContent([
      { id: 'hero-1', type: 'Hero', props: { title: 'v2' } },
      { id: 'text-1', type: 'Text', props: { body: 'nuovo' } },
    ]);

    expect(translation.divergedContent).toEqual([
      { id: 'hero-1', type: 'Hero', props: { title: 'v2' } },
      { id: 'text-1', type: 'Text', props: { body: 'nuovo' } },
    ]);
  });

  it('updateSeoMeta/updateSlug update independently of publish state', () => {
    const translation = PageTranslation.create(baseInput);
    translation.publish([]);

    translation.updateSeoMeta({ title: 'Nuovo titolo', description: 'Nuova' });
    translation.updateSlug('nuovo-slug');

    expect(translation.seoMeta).toEqual({
      title: 'Nuovo titolo',
      description: 'Nuova',
    });
    expect(translation.slug).toBe('nuovo-slug');
    expect(translation.status).toBe('published');
  });

  it('create() exposes every prop via its getters', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const translation = PageTranslation.create({ ...baseInput, now });

    expect(translation.id).toBe('translation-1');
    expect(translation.tenantId).toBe('tenant-1');
    expect(translation.siteId).toBe('site-1');
    expect(translation.pageGroupId).toBe('group-1');
    expect(translation.locale).toBe('it');
    expect(translation.slug).toBe('home');
    expect(translation.seoMeta).toEqual({
      title: 'Home',
      description: 'La home',
    });
    expect(translation.createdAt).toEqual(now);
    expect(translation.updatedAt).toEqual(now);
  });

  it('fromProps/toProps round-trip without loss', () => {
    const props = {
      ...baseInput,
      fieldValues: { 'hero-1': { title: 'Ciao' } },
      status: 'published' as const,
      publishedSnapshot: [{ type: 'Hero', props: { title: 'Ciao' } }],
      isDiverged: false,
      divergedContent: null,
      createdBy: 'user-1',
      createdAt: new Date('2025-12-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const translation = PageTranslation.fromProps(props);

    expect(translation.toProps()).toEqual(props);
  });
});
