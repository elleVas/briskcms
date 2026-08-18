import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog.js';

export interface DeleteFormConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formName: string;
  onConfirm: () => void;
}

export function DeleteFormConfirmDialog({
  open,
  onOpenChange,
  formName,
  onConfirm,
}: DeleteFormConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('forms.deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('forms.deleteDialog.description', { name: formName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('forms.deleteDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('forms.deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
