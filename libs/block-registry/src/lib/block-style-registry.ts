import type { BlockStyleOverride } from '@brisk/shared-types';

/**
 * Punto unico per i preset di `stylableProperties` (docs/adr/0022) condivisi
 * da più blocchi — prima ognuno ripeteva l'array letterale, con il rischio
 * che un blocco restasse indietro in silenzio quando il set cambiava (vedi
 * il commento "Sostituisce il vecchio backgroundColor" rimasto in
 * banner.block.ts, già successo una volta). Un blocco con un set diverso
 * (es. Container: solo `textColor`+`borderRadius`) dichiara comunque il
 * proprio array letterale — questa classe copre solo il caso comune,
 * riutilizzato dalla maggioranza dei blocchi, non ogni combinazione
 * possibile.
 */
export class BlockStyleRegistry {
  /** Sfondo, colore testo, bordi, padding orizzontale/verticale. */
  static readonly STANDARD: readonly (keyof BlockStyleOverride)[] = [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ];
}
