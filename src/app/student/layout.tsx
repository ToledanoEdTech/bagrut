import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth-server";
import { AppShell } from "@/components/layout/AppShell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  return <AppShell role="STUDENT">{children}</AppShell>;
}
