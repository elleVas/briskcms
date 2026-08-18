import { Button } from '../components/ui/button.js';
import { useSession } from './use-session.js';

export function LogoutButton() {
  const { handleLogout } = useSession();

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
      Esci
    </Button>
  );
}
