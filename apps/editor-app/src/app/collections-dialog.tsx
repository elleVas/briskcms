import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { actionErrorMessage } from '../lib/http-client';
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from '../lib/collections-api-client';
import { CollectionIcon, COLLECTION_ICON_NAMES } from './collection-icons';
import {
  collectionsQueryKey,
  collectionsQueryOptions,
} from './collections-queries';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { IconButton } from './icon-button';
import { cn } from '../lib/utils';

export interface CollectionsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Where the collections of the editor are created and named.
 *
 * In the settings menu rather than a screen of its own: making a collection
 * is something a site does once or twice, and a permanent entry in the
 * sidebar for it would sit next to the collections it produces, which is
 * where the confusion would start.
 */
export function CollectionsDialog({
  siteId,
  open,
  onOpenChange,
}: CollectionsDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: collections } = useQuery(collectionsQueryOptions(siteId));
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(COLLECTION_ICON_NAMES[0]);
  const [error, setError] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: collectionsQueryKey(siteId) });

  const create = useMutation({
    mutationFn: () => createCollection({ siteId, name: name.trim(), icon }),
    onSuccess: async () => {
      setName('');
      await invalidate();
    },
    onError: (err) =>
      setError(actionErrorMessage(err, t('collections.actionFailed'))),
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      updateCollection(input.id, { name: input.name }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(actionErrorMessage(err, t('collections.actionFailed'))),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: invalidate,
    onError: (err) =>
      setError(actionErrorMessage(err, t('collections.actionFailed'))),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('collections.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('collections.dialog.description')}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {(collections ?? []).map((collection) => (
            <li key={collection.id} className="flex items-center gap-2">
              <CollectionIcon
                name={collection.icon}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <Input
                aria-label={t('collections.dialog.nameOf', {
                  name: collection.name,
                })}
                defaultValue={collection.name}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== collection.name) {
                    rename.mutate({ id: collection.id, name: next });
                  }
                }}
              />
              <IconButton
                label={t('collections.dialog.delete', {
                  name: collection.name,
                })}
                onClick={() =>
                  setPendingDeletion({
                    id: collection.id,
                    name: collection.name,
                  })
                }
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            if (name.trim()) create.mutate();
          }}
        >
          <Label htmlFor="new-collection-name">
            {t('collections.dialog.newLabel')}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="new-collection-name"
              value={name}
              placeholder={t('collections.dialog.newPlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              <Plus className="size-4" />
              {t('collections.dialog.create')}
            </Button>
          </div>
          {/* The icon is picked here and never again: it is what the
              collection is recognised by in a sidebar of eleven entries. */}
          <div className="flex flex-wrap gap-1 pt-1">
            {COLLECTION_ICON_NAMES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-label={candidate}
                aria-pressed={icon === candidate}
                onClick={() => setIcon(candidate)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md border',
                  icon === candidate
                    ? 'border-primary bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                <CollectionIcon name={candidate} className="size-4" />
              </button>
            ))}
          </div>
        </form>
        {pendingDeletion && (
          <ConfirmActionDialog
            open
            onOpenChange={(next) => !next && setPendingDeletion(null)}
            title={t('collections.dialog.confirmDelete.title')}
            description={t('collections.dialog.confirmDelete.description', {
              name: pendingDeletion.name,
            })}
            onConfirm={() => {
              const id = pendingDeletion.id;
              setPendingDeletion(null);
              remove.mutate(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
