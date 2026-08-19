import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  languageSwitcherPropsSchema,
  type LanguageSwitcherProps,
} from '@brisk/shared-types';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export { languageSwitcherPropsSchema, type LanguageSwitcherProps };

const fields: Fields<LanguageSwitcherProps> = {
  position: positionField,
  visibility: visibilityField,
};

export const languageSwitcherConfig: ComponentConfig<LanguageSwitcherProps> = {
  label: 'Selettore lingua',
  fields,
  defaultProps: { position: 'left', visibility: 'always' },
  // Canvas-only placeholder — the real links depend on which page a
  // visitor is looking at (site.enabledLocales/translations of THAT
  // page), a runtime fact never known in the editor canvas. Same
  // principle as the Form block's placeholder (docs/adr/0015).
  render: ({ position }) => (
    <div
      style={{
        marginLeft: position === 'right' ? 'auto' : undefined,
        border: '2px dashed #d4d4d8',
        borderRadius: 8,
        padding: 8,
        textAlign: 'center',
        color: '#71717a',
        fontSize: 14,
      }}
    >
      IT · EN (selettore lingua)
    </div>
  ),
};
