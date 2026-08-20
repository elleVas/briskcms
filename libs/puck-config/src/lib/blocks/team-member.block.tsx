import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  teamMemberPropsSchema,
  type TeamMemberProps,
} from '@brisk/shared-types';
import { MediaPickerField } from '../fields/media-picker-field.js';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { teamMemberPropsSchema, type TeamMemberProps };

const fields: Fields<TeamMemberProps> = {
  photo: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <MediaPickerField value={value} onChange={onChange} />
    ),
  },
  name: { type: 'text', contentEditable: true, visible: false },
  role: { type: 'text', contentEditable: true, visible: false },
  bio: { type: 'textarea', contentEditable: true, visible: false },
};

export const teamMemberConfig: ComponentConfig<TeamMemberProps> = {
  label: 'Membro del team',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    photo: null,
    name: 'Nome Cognome',
    role: 'Ruolo',
    bio: '',
  },
  render: ({ photo, name, role, bio }) => (
    <div style={{ textAlign: 'center' }}>
      {photo ? (
        <img
          src={photo.url}
          alt=""
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            objectFit: 'cover',
            margin: '0 auto',
          }}
        />
      ) : (
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: '#f4f4f5',
            margin: '0 auto',
          }}
        />
      )}
      <div style={{ fontWeight: 600, marginTop: 8 }}>{name}</div>
      <div style={{ fontSize: 13, color: '#71717a' }}>{role}</div>
      {bio && <div style={{ fontSize: 12, marginTop: 4 }}>{bio}</div>}
    </div>
  ),
};
