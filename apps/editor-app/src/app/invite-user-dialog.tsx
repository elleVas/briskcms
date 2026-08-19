import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { ApiError } from '../lib/http-client.js';
import type {
  InviteUserInput,
  UserDto,
  UserRole,
} from '../lib/users-api-client.js';

export interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (input: InviteUserInput) => Promise<UserDto>;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onInvite,
}: InviteUserDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fresh form on every close, whatever caused it — same reasoning as
  // NewPageDialog's own handleOpenChange.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEmail('');
      setDisplayName('');
      setRole('editor');
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onInvite({ email, displayName, role });
      handleOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('users.inviteDialog.emailTaken')
          : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.inviteDialog.title')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">
              {t('users.inviteDialog.emailLabel')}
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-display-name">
              {t('users.inviteDialog.displayNameLabel')}
            </Label>
            <Input
              id="invite-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">
              {t('users.inviteDialog.roleLabel')}
            </Label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            >
              <option value="admin">{t('users.role.admin')}</option>
              <option value="publisher">{t('users.role.publisher')}</option>
              <option value="editor">{t('users.role.editor')}</option>
            </select>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('users.inviteDialog.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t('users.inviteDialog.inviting')
                : t('users.inviteDialog.invite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
