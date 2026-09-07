import type { ComponentType } from 'react';
import type { CustomFieldControl } from '@brisk/block-registry';
import { ColorPickerField } from './color-picker-field';
import { FeatureListField } from './feature-list-field';
import { FormPickerField } from './form-picker-field';
import { GalleryPickerField } from './gallery-picker-field';
import { IconPickerField } from './icon-picker-field';
import { MediaPickerField } from './media-picker-field';
import { PagePickerField } from './page-picker-field';
import { TableDataField } from './table-data-field';

type ControlComponent = ComponentType<{
  value: unknown;
  onChange: (value: unknown) => void;
}>;

/**
 * The one place a `kind: 'custom'` field's NAME becomes a component.
 *
 * The name lives in the descriptor, which is data, and the component
 * lives here, which is the editor — so `@brisk/block-registry` no longer
 * carries React and can be read by anything: the API, to find which
 * fields hold rich text (ADR-0046); a theme, whose descriptors have to
 * survive JSON.
 *
 * The cast is here and nowhere else, and it is the honest kind: each
 * picker types `value`/`onChange` to its own domain (`PickedPage | null`,
 * `PickedMedia | null`), while the descriptor array that holds them all
 * is necessarily homogeneous. What guarantees the pairing is the block's
 * own schema, which TypeScript has no way to correlate with a field key
 * inside a heterogeneous array. `custom-field-controls.spec.tsx` checks
 * every control in the union has an entry, so the map cannot silently
 * fall behind the type.
 */
export const CUSTOM_FIELD_CONTROLS: Record<
  CustomFieldControl,
  ControlComponent
> = {
  color: ColorPickerField as ControlComponent,
  'feature-list': FeatureListField as ControlComponent,
  form: FormPickerField as ControlComponent,
  gallery: GalleryPickerField as ControlComponent,
  icon: IconPickerField as ControlComponent,
  media: MediaPickerField as ControlComponent,
  page: PagePickerField as ControlComponent,
  'table-data': TableDataField as ControlComponent,
};
