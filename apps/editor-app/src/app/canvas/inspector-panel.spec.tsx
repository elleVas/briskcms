import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { InspectorPanel } from './inspector-panel.js';

describe('InspectorPanel', () => {
  it('renders nothing for a block with no fields (e.g. a pure layout container)', () => {
    const block: Block = { id: 'container-1', type: 'Container', props: {} };
    const descriptor: BlockDescriptor = {
      type: 'Container',
      label: 'Contenitore',
      category: 'layout',
      defaultProps: {},
      fields: [],
    };
    const { container } = render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders a text input pre-filled with the current value, and reports changes', () => {
    const block: Block = {
      id: 'hero-1',
      type: 'Hero',
      props: { title: 'Old' },
    };
    const descriptor: BlockDescriptor = {
      type: 'Hero',
      label: 'Hero',
      category: 'content',
      defaultProps: { title: '' },
      fields: [{ kind: 'text', key: 'title', label: 'Titolo' }],
    };
    const onChangeProp = vi.fn();
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={onChangeProp}
      />,
    );

    const input = screen.getByDisplayValue('Old');
    fireEvent.change(input, { target: { value: 'New' } });

    expect(onChangeProp).toHaveBeenCalledWith('title', 'New');
  });

  it('renders a boolean field as a checkbox', () => {
    const block: Block = {
      id: 'plan-1',
      type: 'PricingPlan',
      props: { highlighted: false },
    };
    const descriptor: BlockDescriptor = {
      type: 'PricingPlan',
      label: 'Piano prezzo',
      category: 'socialProof',
      defaultProps: { highlighted: false },
      fields: [{ kind: 'boolean', key: 'highlighted', label: 'In evidenza' }],
    };
    const onChangeProp = vi.fn();
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={onChangeProp}
      />,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);

    expect(onChangeProp).toHaveBeenCalledWith('highlighted', true);
  });

  it('renders a radio/select field with its own options', () => {
    const block: Block = {
      id: 'columns-1',
      type: 'Columns',
      props: { layout: 'two-equal' },
    };
    const descriptor: BlockDescriptor = {
      type: 'Columns',
      label: 'Colonne',
      category: 'layout',
      defaultProps: { layout: 'two-equal' },
      fields: [
        {
          kind: 'radio',
          key: 'layout',
          label: 'Layout',
          options: [
            { label: '2 uguali', value: 'two-equal' },
            { label: '3 uguali', value: 'three-equal' },
          ],
        },
      ],
    };
    const onChangeProp = vi.fn();
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={onChangeProp}
      />,
    );

    const select = screen.getByDisplayValue('2 uguali');
    fireEvent.change(select, { target: { value: 'three-equal' } });

    expect(onChangeProp).toHaveBeenCalledWith('layout', 'three-equal');
  });

  it('renders a custom field via its own component', () => {
    const block: Block = { id: 'img-1', type: 'Image', props: { media: null } };
    function FakeMediaPicker({
      onChange,
    }: {
      value: unknown;
      onChange: (value: unknown) => void;
    }) {
      return (
        <button onClick={() => onChange({ mediaId: 'm1', url: '/m1.jpg' })}>
          Scegli immagine
        </button>
      );
    }
    const descriptor: BlockDescriptor = {
      type: 'Image',
      label: 'Immagine',
      category: 'content',
      defaultProps: { media: null },
      fields: [
        {
          kind: 'custom',
          key: 'media',
          label: 'Immagine',
          component: FakeMediaPicker as never,
        },
      ],
    };
    const onChangeProp = vi.fn();
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={onChangeProp}
      />,
    );

    fireEvent.click(screen.getByText('Scegli immagine'));

    expect(onChangeProp).toHaveBeenCalledWith('media', {
      mediaId: 'm1',
      url: '/m1.jpg',
    });
  });

  it('shows a required-field warning for an empty required text field', () => {
    const block: Block = {
      id: 'img-1',
      type: 'Image',
      props: { alt: '', isDecorative: false },
    };
    const descriptor: BlockDescriptor = {
      type: 'Image',
      label: 'Immagine',
      category: 'content',
      defaultProps: { alt: '', isDecorative: false },
      fields: [
        {
          kind: 'text',
          key: 'alt',
          label: 'Testo alternativo',
          required: true,
          requiredUnless: 'isDecorative',
        },
      ],
    };
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={vi.fn()}
      />,
    );

    expect(screen.getByText('Campo obbligatorio')).toBeTruthy();
  });

  it('does not warn once the required field has a value', () => {
    const block: Block = {
      id: 'img-1',
      type: 'Image',
      props: { alt: 'Un gatto', isDecorative: false },
    };
    const descriptor: BlockDescriptor = {
      type: 'Image',
      label: 'Immagine',
      category: 'content',
      defaultProps: { alt: '', isDecorative: false },
      fields: [
        {
          kind: 'text',
          key: 'alt',
          label: 'Testo alternativo',
          required: true,
          requiredUnless: 'isDecorative',
        },
      ],
    };
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={vi.fn()}
      />,
    );

    expect(screen.queryByText('Campo obbligatorio')).toBeNull();
  });

  it("does not warn when requiredUnless's sibling prop is true (deliberately decorative)", () => {
    const block: Block = {
      id: 'img-1',
      type: 'Image',
      props: { alt: '', isDecorative: true },
    };
    const descriptor: BlockDescriptor = {
      type: 'Image',
      label: 'Immagine',
      category: 'content',
      defaultProps: { alt: '', isDecorative: false },
      fields: [
        {
          kind: 'text',
          key: 'alt',
          label: 'Testo alternativo',
          required: true,
          requiredUnless: 'isDecorative',
        },
      ],
    };
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={vi.fn()}
      />,
    );

    expect(screen.queryByText('Campo obbligatorio')).toBeNull();
  });
});
