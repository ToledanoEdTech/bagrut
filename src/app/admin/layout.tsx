import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth-server";
import { isStaffRole } from "@/lib/roles";
import { AppShell } from "@/components/layout/AppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session || !isStaffRole(session.role)) redirect("/login");

  return <AppShell role={session.role}>{children}</AppShell>;
}
