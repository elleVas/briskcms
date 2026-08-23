import type { TeamProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const teamBlock: BlockDescriptor<TeamProps> = {
  type: 'Team',
  label: 'Team/staff',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['TeamMember'],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
