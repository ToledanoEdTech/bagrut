import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  buildFullSchoolExportBuffer,
  fullSchoolExportFilename,
} from "@/lib/full-school-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  try {
    const buffer = await buildFullSchoolExportBuffer({
      name: session.name,
      email: session.email,
    });
    const filename = fullSchoolExportFilename();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="school-data.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("full school export failed", err);
    return NextResponse.json({ error: "הייצוא נכשל. נסו שוב." }, { status: 500 });
  }
}
