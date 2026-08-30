import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import type { UserDto, UserRole } from '../lib/users-api-client';
import { IconButton } from './icon-button';
import { InviteUserDialog } from './invite-user-dialog';
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

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  async function goToPage(target: number) {
    await navigate({ to: '/users', search: { page: target } });
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setActionError('');
    try {
      await updateUserRole(userId, role);
    } catch (err) {
      setActionError(String(err));
    }
  }

  async function handleActiveToggle(user: UserDto) {
    setActionError('');
    try {
      await setUserActive(user.id, !user.isActive);
    } catch (err) {
      setActionError(String(err));
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
                onChange={(event) =>
                  void handleRoleChange(user.id, event.target.value as UserRole)
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
              <Button
                type="button"
                variant="outline"
                size="sm"
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
    </div>
  );
}
