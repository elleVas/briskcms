import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { InspectorPanel } from './inspector-panel';

vi.mock('./custom-fields/custom-field-controls', () => ({
  CUSTOM_FIELD_CONTROLS: {
    media: ({ onChange }: { onChange: (value: unknown) => void }) => (
      <button onClick={() => onChange({ mediaId: 'm1', url: '/m1.jpg' })}>
        Scegli immagine
      </button>
    ),
  },
}));

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
        onChangeVariant={vi.fn()}
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
        onChangeVariant={vi.fn()}
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
        onChangeVariant={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);

    expect(onChangeProp).toHaveBeenCalledWith('highlighted', true);
  });

  /*
   * `radio` and `select` used to fall through to the same `<select>`, so
   * a descriptor could say one and get the other. This checks the two are
   * now actually different controls — the point of the fix, and the thing
   * a test asserting "some element with these options" would keep passing
   * through.
   */
  it('renders a radio field as a radio group, one option at a time visible', () => {
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
        onChangeVariant={vi.fn()}
      />,
    );

    expect(screen.getByRole('radiogroup')).toBeTruthy();
    const options = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(options).toHaveLength(2);
    expect(options[0].checked).toBe(true);

    fireEvent.click(options[1]);
    expect(onChangeProp).toHaveBeenCalledWith('layout', 'three-equal');
  });

  it('renders a select field as a dropdown', () => {
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
          kind: 'select',
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
        onChangeVariant={vi.fn()}
      />,
    );

    const select = screen.getByDisplayValue('2 uguali');
    expect(screen.queryByRole('radiogroup')).toBeNull();
    fireEvent.change(select, { target: { value: 'three-equal' } });

    expect(onChangeProp).toHaveBeenCalledWith('layout', 'three-equal');
  });

  // A custom field names its control; the map in custom-field-controls.tsx
  // turns that name into a component. Mocked here so this stays a test of
  // the INDIRECTION — that the right control is picked and its onChange
  // reaches the right prop — rather than of the media picker's own UI,
  // which has its own spec.
  it('renders the control a custom field names, and wires its onChange', () => {
    const block: Block = { id: 'img-1', type: 'Image', props: { media: null } };
    const descriptor: BlockDescriptor = {
      type: 'Image',
      label: 'Immagine',
      category: 'content',
      defaultProps: { media: null },
      fields: [
        { kind: 'custom', key: 'media', label: 'Immagine', control: 'media' },
      ],
    };
    const onChangeProp = vi.fn();
    render(
      <InspectorPanel
        block={block}
        descriptor={descriptor}
        onChangeProp={onChangeProp}
        onChangeVariant={vi.fn()}
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
        onChangeVariant={vi.fn()}
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
        onChangeVariant={vi.fn()}
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
        onChangeVariant={vi.fn()}
      />,
    );

    expect(screen.queryByText('Campo obbligatorio')).toBeNull();
  });
});

describe('InspectorPanel variant picker', () => {
  const buttonDescriptor: BlockDescriptor = {
    type: 'Button',
    label: 'Bottone',
    category: 'conversion',
    defaultProps: { label: '' },
    fields: [{ kind: 'text', key: 'label', label: 'Testo' }],
    variants: [{ value: 'secondary', label: 'Secondario' }],
  };

  it('offers the type default plus every declared variant', () => {
    render(
      <InspectorPanel
        block={{ id: 'b1', type: 'Button', props: { label: '' } }}
        descriptor={buttonDescriptor}
        onChangeProp={vi.fn()}
        onChangeVariant={vi.fn()}
      />,
    );

    const options = [...screen.getAllByRole('option')].map(
      (o) => o.textContent,
    );
    expect(options).toEqual(['Predefinito', 'Secondario']);
  });

  it('shows the variant the block is already wearing', () => {
    render(
      <InspectorPanel
        block={{
          id: 'b1',
          type: 'Button',
          props: { label: '' },
          variant: 'secondary',
        }}
        descriptor={buttonDescriptor}
        onChangeProp={vi.fn()}
        onChangeVariant={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveProperty('value', 'secondary');
  });

  it('reports a chosen variant', () => {
    const onChangeVariant = vi.fn();
    render(
      <InspectorPanel
        block={{ id: 'b1', type: 'Button', props: { label: '' } }}
        descriptor={buttonDescriptor}
        onChangeProp={vi.fn()}
        onChangeVariant={onChangeVariant}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'secondary' },
    });

    expect(onChangeVariant).toHaveBeenCalledWith('secondary');
  });

  /**
   * The type's own look has no variant of its own, so going back to it
   * has to CLEAR the field rather than store the word "default" — which
   * would then be a variant name, and one no descriptor declares.
   */
  it('clears the field when the type default is chosen again', () => {
    const onChangeVariant = vi.fn();
    render(
      <InspectorPanel
        block={{
          id: 'b1',
          type: 'Button',
          props: { label: '' },
          variant: 'secondary',
        }}
        descriptor={buttonDescriptor}
        onChangeProp={vi.fn()}
        onChangeVariant={onChangeVariant}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });

    expect(onChangeVariant).toHaveBeenCalledWith(undefined);
  });

  // A type with variants and no fields still has one thing to show.
  it('renders for a type that has variants and no fields at all', () => {
    const { container } = render(
      <InspectorPanel
        block={{ id: 'b1', type: 'Divider', props: {} }}
        descriptor={{
          type: 'Divider',
          label: 'Separatore',
          category: 'layout',
          defaultProps: {},
          fields: [],
          variants: [{ value: 'thick', label: 'Spesso' }],
        }}
        onChangeProp={vi.fn()}
        onChangeVariant={vi.fn()}
      />,
    );

    expect(container.innerHTML).not.toBe('');
  });
});
