import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { IconEntry } from '@brisk/shared-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { themeIconsQueryOptions } from './theme-icons-queries';
import { useActiveThemeName } from './use-active-theme-name';

export interface IconPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (icon: IconEntry) => void;
}

/**
 * Griglia con ricerca, non un semplice elenco: il set di default (docs/adr/
 * 0023) è l'intero set Lucide corrente, ~2000 icone — troppe per scorrere
 * senza un filtro testuale, a differenza di PagePickerDialog/
 * MediaPickerDialog che paginano poche decine di elementi.
 */
export function IconPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: IconPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  // Non gated su `open` (a differenza di Page/MediaPickerDialog): il tema
  // attivo non cambia mai a runtime, quindi conviene precaricarla non
  // appena il provider monta, sia per la prima apertura del dialog sia
  // per l'anteprima sincrona che IconPickerField mostra per un'icona già
  // scelta — vedi IconListProvider.
  const { data } = useQuery(themeIconsQueryOptions(useActiveThemeName()));

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((icon) => icon.name.includes(q));
  }, [data, search]);

  function handleOpenChange(next: boolean) {
    if (!next) setSearch('');
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('icons.picker.title')}</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('icons.picker.search') ?? undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('icons.picker.empty')}
          </p>
        ) : (
          <div className="grid max-h-96 grid-cols-8 gap-1 overflow-y-auto py-2">
            {filtered.map((icon) => (
              <button
                key={icon.name}
                type="button"
                title={icon.name}
                onClick={() => onSelect(icon)}
                className="flex aspect-square items-center justify-center rounded-md border border-transparent p-2 hover:border-input hover:bg-accent"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5"
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
