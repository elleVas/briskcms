import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { actionErrorMessage } from '../lib/http-client';
import type { UserDto, UserRole } from '../lib/users-api-client';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { IconButton } from './icon-button';
import { InviteUserDialog } from './invite-user-dialog';
import { useCurrentSession } from './use-current-session';
import { USERS_PAGE_SIZE } from './users-queries';
import { useUsers } from './use-users';

export interface UsersListViewProps {
  items: UserDto[];
  page: number;
  total: number;
}

const ROLES: UserRole[] = ['admin', 'publisher', 'editor'];

export function UsersListView({ items, page, total }: UsersListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { inviteUser, updateUserRole, setUserActive } = useUsers();

  const { session } = useCurrentSession();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  // Switching somebody off ends their sessions on the spot. It is one
  // click next to a role dropdown, and it was taking effect on the way
  // down.
  const [pendingDeactivation, setPendingDeactivation] =
    useState<UserDto | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  async function goToPage(target: number) {
    await navigate({ to: '/users', search: { page: target } });
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setActionError('');
    try {
      await updateUserRole(userId, role);
    } catch (err) {
      setActionError(actionErrorMessage(err, t('users.list.actionFailed')));
    }
  }

  async function handleActiveToggle(user: UserDto) {
    if (!user.isActive) {
      await applyActiveChange(user, true);
      return;
    }
    setPendingDeactivation(user);
  }

  async function applyActiveChange(user: UserDto, isActive: boolean) {
    setActionError('');
    try {
      await setUserActive(user.id, isActive);
    } catch (err) {
      setActionError(actionErrorMessage(err, t('users.list.actionFailed')));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('users.list.title')}</h1>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          {t('users.list.invite')}
        </Button>
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('users.list.empty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2"
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">
                  {user.displayName || user.email}
                </span>
                {user.displayName && (
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </div>
              <select
                aria-label={t('users.list.roleLabel', {
                  name: user.displayName || user.email,
                })}
                value={user.role}
                disabled={user.id === session?.userId}
                title={
                  user.id === session?.userId
                    ? t('users.list.notOnYourself')
                    : undefined
                }
                onChange={(event) =>
                  void handleRoleChange(user.id, event.target.value as UserRole)
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`users.role.${role}`)}
                  </option>
                ))}
              </select>
              <Badge variant={user.isActive ? 'default' : 'outline'}>
                {user.isActive
                  ? t('users.list.statusActive')
                  : t('users.list.statusInactive')}
              </Badge>
              {/* Your own row is the one that costs the most and reads
                  the same as every other. Refused server-side too — this
                  only stops the click from being worth making. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={user.id === session?.userId}
                title={
                  user.id === session?.userId
                    ? t('users.list.notOnYourself')
                    : undefined
                }
                onClick={() => void handleActiveToggle(user)}
              >
                {user.isActive
                  ? t('users.list.deactivate')
                  : t('users.list.reactivate')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <IconButton
            label={t('users.list.previousPage')}
            disabled={page <= 1}
            onClick={() => void goToPage(page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <span className="text-sm text-muted-foreground">
            {t('users.list.pageIndicator', { page, totalPages })}
          </span>
          <IconButton
            label={t('users.list.nextPage')}
            disabled={page >= totalPages}
            onClick={() => void goToPage(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      )}
      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onInvite={inviteUser}
      />
      {pendingDeactivation && (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => !open && setPendingDeactivation(null)}
          title={t('users.list.deactivateConfirm.title')}
          description={t('users.list.deactivateConfirm.description', {
            name: pendingDeactivation.displayName || pendingDeactivation.email,
          })}
          actionLabel={t('users.list.deactivate')}
          onConfirm={() => {
            const user = pendingDeactivation;
            setPendingDeactivation(null);
            void applyActiveChange(user, false);
          }}
        />
      )}
    </div>
  );
}
