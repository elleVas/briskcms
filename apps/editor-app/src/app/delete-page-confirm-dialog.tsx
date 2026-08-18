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

export interface DeletePageConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageName: string;
  onConfirm: () => void;
}

export function DeletePageConfirmDialog({
  open,
  onOpenChange,
  pageName,
  onConfirm,
}: DeletePageConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('pages.deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('pages.deleteDialog.description', { name: pageName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('pages.deleteDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('pages.deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
