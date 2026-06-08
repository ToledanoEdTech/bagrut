import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getAdminDashboardData } from "@/lib/firestore";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const data = await getAdminDashboardData();
  return NextResponse.json(data);
}
