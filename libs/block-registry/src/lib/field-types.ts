import type { ComponentType } from 'react';

/**
 * Sostituisce Puck's `Fields<T>` (docs/adr/0007) — niente `resolveFields`/
 * `contentEditable`+`visible` fallback: `inlineEditable` vale uniformemente,
 * la reconciliazione del cursore che costringeva Puck a nascondere
 * l'editing inline quando annidato non esiste più con TipTap montato "sul
 * posto" (Giorno 4). Vedi il piano dell'editor visuale, Giorno 3.
 */
export type FieldDescriptor =
  | {
      kind: 'text';
      key: string;
      label: string;
      inlineEditable?: boolean;
      placeholder?: string;
    }
  | {
      kind: 'textarea';
      key: string;
      label: string;
      inlineEditable?: boolean;
      placeholder?: string;
    }
  | {
      kind: 'radio' | 'select';
      key: string;
      label: string;
      options: { label: string; value: string }[];
    }
  | {
      kind: 'number';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { kind: 'boolean'; key: string; label: string }
  | {
      kind: 'custom';
      key: string;
      label: string;
      component: ComponentType<{
        value: unknown;
        onChange: (v: unknown) => void;
      }>;
    };

/**
 * Un unico punto per il cast che un campo `kind: 'custom'` richiede per
 * costruzione: ogni picker concreto (PagePickerField, MediaPickerField...)
 * ha un `value`/`onChange` tipizzato sul proprio dominio (es.
 * `PickedPage | null`), ma l'array `FieldDescriptor[]` è eterogeneo e deve
 * restare omogeneo — TypeScript non può esprimere "questo componente è
 * usato solo per la prop X, che lo schema di dominio garantisce essere
 * V" dentro un array di questo tipo. Concentrato qui, con un solo
 * commento, invece che ripetuto ad ogni singolo utilizzo nei descrittori
 * di blocco.
 */
export function customField<V>(
  key: string,
  label: string,
  component: ComponentType<{ value: V; onChange: (value: V) => void }>,
): FieldDescriptor {
  return {
    kind: 'custom',
    key,
    label,
    component: component as unknown as ComponentType<{
      value: unknown;
      onChange: (value: unknown) => void;
    }>,
  };
}

export interface BlockDescriptor<Props = Record<string, unknown>> {
  type: string;
  label: string;
  category: string;
  defaultProps: Props;
  fields: FieldDescriptor[];
  /** `Block.children` è reale (nessun mapper "slot" alla Puck serve) — presente solo sui blocchi che possono contenere altri blocchi. */
  isContainer?: boolean;
  /** Nessuna lista = qualunque blocco registrato può entrarci (es. Column/Container). */
  allowedChildTypes?: string[];
}
