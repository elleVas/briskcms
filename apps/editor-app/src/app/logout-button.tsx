import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.js';
import { useSession } from './use-session.js';

export function LogoutButton() {
  const { t } = useTranslation();
  const { handleLogout } = useSession();

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
      {t('auth.logout')}
    </Button>
  );
}
