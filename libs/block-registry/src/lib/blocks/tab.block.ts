import type { BlockDescriptor } from '../field-types.js';

// `label` non fa parte di `TabProps` nel dominio (content-model.ts) — in
// realtà lo fa: TabProps = { label: string }. Nessun tipo Puck-only extra
// serve qui, a differenza di Nav/Column/ecc: Tab non ha un prop "children"
// separato dal Block.children reale, quindi non serve un'interfaccia
// aggiuntiva come le *PuckProps di Puck.
export const tabBlock: BlockDescriptor<{ label: string }> = {
  type: 'Tab',
  label: 'Tab',
  category: 'interactive',
  defaultProps: { label: 'Tab' },
  fields: [{ kind: 'text', key: 'label', label: 'Etichetta tab' }],
  isContainer: true,
  allowedChildTypes: ['Hero', 'Text', 'Image', 'Gallery', 'Form'],
};
