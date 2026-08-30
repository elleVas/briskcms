import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockDescriptor } from '@brisk/block-registry';
import { BlockPicker } from './block-picker';

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: '', subtitle: '' },
  fields: [],
};
const textDescriptor: BlockDescriptor = {
  type: 'Text',
  label: 'Testo',
  category: 'content',
  defaultProps: { body: '' },
  fields: [],
};

describe('BlockPicker', () => {
  it('renders one collapsed section per category, expandable to show its registered block types', () => {
    render(
      <BlockPicker
        categories={[{ title: 'Contenuto', types: ['Hero', 'Text'] }]}
        registry={[heroDescriptor, textDescriptor]}
        onInsert={vi.fn()}
      />,
    );

    expect(screen.getByText('Contenuto')).toBeDefined();
    expect(screen.queryByText('Hero')).toBeNull();

    fireEvent.click(screen.getByText('Contenuto'));

    expect(screen.getByText('Hero')).toBeDefined();
    expect(screen.getByText('Testo')).toBeDefined();
  });

  it('calls onInsert with the full descriptor when a block button is clicked', () => {
    const onInsert = vi.fn();
    render(
      <BlockPicker
        categories={[{ title: 'Contenuto', types: ['Hero'] }]}
        registry={[heroDescriptor]}
        onInsert={onInsert}
      />,
    );

    fireEvent.click(screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Hero'));

    expect(onInsert).toHaveBeenCalledWith(heroDescriptor);
  });

  it('skips a category type that has no matching registry entry, instead of crashing', () => {
    render(
      <BlockPicker
        categories={[{ title: 'Contenuto', types: ['Ghost'] }]}
        registry={[heroDescriptor]}
        onInsert={vi.fn()}
      />,
    );

    expect(screen.queryByText('Contenuto')).toBeNull();
  });

  it('keeps multiple categories open at the same time', () => {
    render(
      <BlockPicker
        categories={[
          { title: 'Contenuto', types: ['Hero'] },
          { title: 'Testuale', types: ['Text'] },
        ]}
        registry={[heroDescriptor, textDescriptor]}
        onInsert={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Testuale'));

    expect(screen.getByRole('button', { name: 'Hero' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Testo' })).toBeDefined();
  });
});
