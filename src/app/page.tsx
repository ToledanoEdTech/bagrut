import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth-server";
import { isStaffRole } from "@/lib/roles";

export default async function Home() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (isStaffRole(session.role)) redirect("/admin");
  redirect("/student");
}
