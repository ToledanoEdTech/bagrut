import { NextResponse } from "next/server";
import { listExamPaths } from "@/lib/firestore";
import { requireStaff } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return NextResponse.json(await listExamPaths());
}
