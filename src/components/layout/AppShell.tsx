import { AuthGuard } from "@/components/AuthGuard";
import { ShellLayout } from "./ShellLayout";
import type { Role } from "@/lib/types";

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: Role;
  title?: string;
  subtitle?: string;
}) {
  return (
    <AuthGuard role={role}>
      <ShellLayout role={role}>{children}</ShellLayout>
    </AuthGuard>
  );
}
