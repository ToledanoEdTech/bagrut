import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createStudent,
  listClasses,
  listExamPaths,
  listTracks,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const paths = await listExamPaths();
  const defaultPath = paths.find((p) => p.key === "regular");
  if (!defaultPath) {
    return NextResponse.json({ error: "לא נמצא מסלול ברירת מחדל" }, { status: 500 });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = row["שם"] || row["שם מלא"] || row["name"] || row["Name"];
    const email = row["אימייל"] || row["מייל"] || row["email"] || row["Email"];
    const className = row["כיתה"] || row["class"] || row["Class"] || "י'1";
    const trackName = row["מגמה"] || row["track"] || "";
    const mathUnits = parseInt(row["מתמטיקה"] || row["math"] || "3", 10);
    const englishUnits = parseInt(row["אנגלית"] || row["english"] || "3", 10);

    if (!name || !email) {
      skipped++;
      continue;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await adminDb
      .collection("students")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (!existing.empty) {
      skipped++;
      continue;
    }

    const classes = await listClasses();
    let cls = classes.find((c) => c.name === className);
    if (!cls) {
      const { createClass } = await import("@/lib/firestore");
      cls = await createClass({
        name: className,
        gradeYear: null,
        examPathId: defaultPath.id,
      });
    }

    const trackIds: string[] = [];
    if (trackName) {
      const tracks = await listTracks();
      for (const part of trackName.split(/[,،+]/)) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = tracks.find((t) => t.name.includes(trimmed));
        if (match && !trackIds.includes(match.id)) trackIds.push(match.id);
      }
    }

    try {
      await createStudent({
        email: normalizedEmail,
        name: String(name),
        classId: cls.id,
        trackIds,
        mathUnits: isNaN(mathUnits) ? 3 : mathUnits,
        englishUnits: isNaN(englishUnits) ? 3 : englishUnits,
        extensions: null,
      });
      created++;
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
