import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import type { FormDto } from '../lib/forms-api-client';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { FORMS_PAGE_SIZE } from './forms-queries';
import { IconButton } from './icon-button';
import { NewFormDialog } from './new-form-dialog';
import { useFormsList } from './use-forms-list';

export interface FormsListViewProps {
  siteId: string;
  forms: FormDto[];
  page: number;
  total: number;
}

export function FormsListView({
  siteId,
  forms,
  page,
  total,
}: FormsListViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { createForm, deleteForm } = useFormsList(siteId);

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [isNewFormDialogOpen, setIsNewFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / FORMS_PAGE_SIZE));

  function toggleSelected(formId: string) {
    setSelectedFormId((current) => (current === formId ? null : formId));
    setActionError('');
  }

  async function goToPage(target: number) {
    await navigate({ to: '/forms', search: { page: target } });
  }

  async function handleOpenEditor() {
    if (!selectedForm) return;
    await navigate({
      to: '/forms/$formId',
      params: { formId: selectedForm.id },
    });
  }

  async function handleConfirmDelete() {
    if (!selectedForm) return;
    setActionError('');
    try {
      await deleteForm(selectedForm.id);
      setSelectedFormId(null);
    } catch (err) {
      setActionError(String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('forms.list.title')}</h1>
        <div className="flex items-center gap-1">
          {selectedForm && (
            <>
              <IconButton
                label={t('forms.list.actions.edit')}
                onClick={() => void handleOpenEditor()}
              >
                <Pencil />
              </IconButton>
              <IconButton
                label={t('forms.list.actions.delete')}
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 />
              </IconButton>
            </>
          )}
          <Button onClick={() => setIsNewFormDialogOpen(true)}>
            {t('forms.list.newForm')}
          </Button>
        </div>
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {forms.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('forms.list.empty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {forms.map((f) => {
            const isSelected = f.id === selectedFormId;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => toggleSelected(f.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted',
                    isSelected && 'bg-muted',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'size-3 shrink-0 rounded-full border',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground',
                      )}
                    />
                    <span className="font-medium">{f.name}</span>
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      {t('forms.list.fieldCount', { count: f.fields.length })}
                    </span>
                    <span>
                      {new Date(f.updatedAt).toLocaleDateString(i18n.language)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <IconButton
            label={t('forms.list.previousPage')}
            disabled={page <= 1}
            onClick={() => void goToPage(page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <span className="text-sm text-muted-foreground">
            {t('forms.list.pageIndicator', { page, totalPages })}
          </span>
          <IconButton
            label={t('forms.list.nextPage')}
            disabled={page >= totalPages}
            onClick={() => void goToPage(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      )}
      <NewFormDialog
        open={isNewFormDialogOpen}
        onOpenChange={setIsNewFormDialogOpen}
        onCreate={createForm}
      />
      {selectedForm && (
        <ConfirmActionDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={t('forms.deleteDialog.title')}
          description={t('forms.deleteDialog.description', {
            name: selectedForm.name,
          })}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}
