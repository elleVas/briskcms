import type { TeamMemberProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { MediaPickerField } from '../fields/media-picker-field.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const teamMemberBlock: BlockDescriptor<TeamMemberProps> = {
  type: 'TeamMember',
  label: 'Membro del team',
  category: 'socialProof',
  defaultProps: {
    photo: null,
    name: 'Nome Cognome',
    role: 'Ruolo',
    bio: '',
  },
  fields: [
    FieldBuilder.custom('photo', 'Foto', MediaPickerField),
    { kind: 'text', key: 'name', label: 'Nome', inlineEditable: true },
    { kind: 'text', key: 'role', label: 'Ruolo', inlineEditable: true },
    { kind: 'textarea', key: 'bio', label: 'Bio', inlineEditable: true },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.TeamMember,
};
