import type { TeamMemberProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { MediaPickerField } from '../fields/media-picker-field';
import { BlockStyleRegistry } from '../block-style-registry';

export const teamMemberBlock: BlockDescriptor<TeamMemberProps> = {
  type: 'TeamMember',
  label: 'blocks.teamMember.label',
  category: 'socialProof',
  defaultProps: {
    photo: null,
    name: 'Nome Cognome',
    role: 'Ruolo',
    bio: '',
  },
  fields: [
    FieldBuilder.custom(
      'photo',
      'blocks.teamMember.fields.photo.fieldLabel',
      MediaPickerField,
    ),
    {
      kind: 'text',
      key: 'name',
      label: 'blocks.teamMember.fields.name.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'role',
      label: 'blocks.teamMember.fields.role.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'bio',
      label: 'blocks.teamMember.fields.bio.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.TeamMember,
};
