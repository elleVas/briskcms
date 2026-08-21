import type { BlockDescriptor } from '@brisk/block-registry';

export interface BlockPickerCategory {
  title: string;
  types: string[];
}

export interface BlockPickerProps {
  categories: BlockPickerCategory[];
  registry: BlockDescriptor[];
  onInsert: (descriptor: BlockDescriptor) => void;
}

/**
 * Click-per-inserire nel contenitore selezionato o alla radice (il
 * chiamante, non ancora canvas-editor-shell.tsx, decide il target passando
 * il risultato a use-block-tree.ts's insertBlock) — categorie da
 * @brisk/block-registry's config.ts/layout-config.ts. "Non registrato =
 * non droppabile": un tipo che non compare in `registry` per la categoria
 * corrente semplicemente non ha un bottone qui, nessuna deny-list a parte.
 */
export function BlockPicker({
  categories,
  registry,
  onInsert,
}: BlockPickerProps) {
  return (
    <div>
      {categories.map((category) => {
        const descriptors = category.types
          .map((type) => registry.find((block) => block.type === type))
          .filter((descriptor): descriptor is BlockDescriptor => !!descriptor);

        if (descriptors.length === 0) {
          return null;
        }

        return (
          <section key={category.title}>
            <h4>{category.title}</h4>
            <ul>
              {descriptors.map((descriptor) => (
                <li key={descriptor.type}>
                  <button type="button" onClick={() => onInsert(descriptor)}>
                    {descriptor.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
