import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AdminShell } from '../app/admin-shell';

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
});

function ShellLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
