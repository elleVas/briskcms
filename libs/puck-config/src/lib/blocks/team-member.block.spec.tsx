import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  teamMemberConfig,
  teamMemberPropsSchema,
} from './team-member.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('teamMemberPropsSchema', () => {
  it('accepts valid TeamMember props', () => {
    const result = teamMemberPropsSchema.safeParse({
      name: 'Luca Bianchi',
      role: 'Sviluppatore',
      bio: 'Lavora da 5 anni nel team.',
      photo: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without a name', () => {
    const result = teamMemberPropsSchema.safeParse({
      role: 'Sviluppatore',
      bio: '',
      photo: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('teamMemberConfig.render', () => {
  it('renders name, role and bio', () => {
    render(
      teamMemberConfig.render({
        id: 'test-id',
        name: 'Luca Bianchi',
        role: 'Sviluppatore',
        bio: 'Lavora da 5 anni nel team.',
        photo: null,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Luca Bianchi')).toBeTruthy();
    expect(screen.getByText('Sviluppatore')).toBeTruthy();
    expect(screen.getByText('Lavora da 5 anni nel team.')).toBeTruthy();
  });

  it('renders the photo image when picked, a placeholder circle otherwise', () => {
    // The photo is decorative (alt="", the name/role text right below it is
    // the real accessible label) — same reasoning as
    // media-picker-field.spec.tsx's own thumbnail, so it has no accessible
    // "img" role; query the DOM directly instead of by role.
    const { rerender, container } = render(
      teamMemberConfig.render({
        id: 'test-id',
        name: 'Luca Bianchi',
        role: 'Sviluppatore',
        bio: '',
        photo: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
        puck: puckContext,
      }),
    );
    expect(container.querySelector('img')).toHaveProperty(
      'src',
      'http://localhost/a.webp',
    );

    rerender(
      teamMemberConfig.render({
        id: 'test-id',
        name: 'Luca Bianchi',
        role: 'Sviluppatore',
        bio: '',
        photo: null,
        puck: puckContext,
      }),
    );
    expect(screen.queryByRole('img')).toBeFalsy();
    expect(container.querySelector('div')).toBeTruthy();
  });
});

describe('teamMemberConfig.fields', () => {
  it('edits name, role and bio inline on the canvas', () => {
    expect(teamMemberConfig.fields?.name).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(teamMemberConfig.fields?.role).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(teamMemberConfig.fields?.bio).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
  });
});
