import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  listClassesSimple,
  listStudents,
  listSubjects,
  upsertGradesBulk,
} from "@/lib/firestore";
import {
  buildStudentWithRelations,
  getRelevantSubjects,
} from "@/lib/student-subjects";
import { parseStatusInput, validateScore } from "@/lib/grade-status";
import { checkPermission, requireStaff } from "@/lib/api-auth";
import type { SubmissionStatus, Subject } from "@/lib/types";

type ImportRow = {
  className: string;
  subjectName: string;
  obligationName: string;
  studentName: string;
  score: number | null;
  status: SubmissionStatus;
};

function findColumn(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return "";
}

function findObligationInSubject(
  subject: Subject,
  obligationName: string
): { id: string } | null {
  const normalized = obligationName.trim().toLowerCase();
  const questionnaireMatch = normalized.match(/שאלון\s*(\d+)/);
  const questionnaireNum = questionnaireMatch?.[1];

  for (const ob of subject.obligations) {
    if (questionnaireNum && ob.questionnaireNumber === questionnaireNum) {
      return ob;
    }
    const obName = (ob.name ?? "").trim().toLowerCase();
    if (obName && (obName === normalized || obName.includes(normalized) || normalized.includes(obName))) {
      return ob;
    }
    const qLabel = ob.questionnaireNumber
      ? `שאלון ${ob.questionnaireNumber}`.toLowerCase()
      : "";
    if (qLabel && (qLabel === normalized || normalized.includes(qLabel))) {
      return ob;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const [classes, students, subjects] = await Promise.all([
    listClassesSimple(),
    listStudents(),
    listSubjects(),
  ]);

  const classByName = new Map(classes.map((c) => [c.name.trim(), c]));
  const subjectByName = new Map(
    subjects.map((s) => [s.name.trim().toLowerCase(), s])
  );

  const parsedRows: Array<{ rowNum: number; data: ImportRow | null; error?: string }> = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;
    const className = findColumn(row, "כיתה", "class", "Class");
    const subjectName = findColumn(row, "מקצוע", "subject", "Subject");
    const obligationName = findColumn(row, "מטלה", "obligation", "Obligation");
    const studentName = findColumn(row, "שם תלמיד", "שם", "name", "Name");
    const scoreRaw = findColumn(row, "ציון", "score", "Score");
    const statusRaw = findColumn(row, "סטטוס", "status", "Status");

    if (!className && !subjectName && !obligationName && !studentName) {
      return;
    }

    if (!className || !subjectName || !obligationName || !studentName) {
      parsedRows.push({
        rowNum,
        data: null,
        error: "חסרות עמודות חובה (כיתה, מקצוע, מטלה, שם תלמיד)",
      });
      return;
    }

    const score =
      scoreRaw === "" || scoreRaw === "-"
        ? null
        : parseFloat(scoreRaw.replace(",", "."));

    if (scoreRaw && (isNaN(score!) || !validateScore(score))) {
      parsedRows.push({ rowNum, data: null, error: "ציון לא חוקי (0–100)" });
      return;
    }

    const status = statusRaw ? parseStatusInput(statusRaw) : score != null ? "GRADED" : "NOT_STARTED";
    if (!status) {
      parsedRows.push({ rowNum, data: null, error: `סטטוס לא מזוהה: ${statusRaw}` });
      return;
    }

    parsedRows.push({
      rowNum,
      data: { className, subjectName, obligationName, studentName, score, status },
    });
  });

  const errors: string[] = [];
  const toUpsert: Array<{
    studentId: string;
    obligationId: string;
    score: number | null;
    status: SubmissionStatus;
    notes: null;
  }> = [];
  let skipped = 0;

  for (const { rowNum, data, error: parseError } of parsedRows) {
    if (parseError) {
      errors.push(`שורה ${rowNum}: ${parseError}`);
      skipped++;
      continue;
    }
    if (!data) continue;

    const cls = classByName.get(data.className.trim());
    if (!cls) {
      errors.push(`שורה ${rowNum}: כיתה לא נמצאה — ${data.className}`);
      skipped++;
      continue;
    }

    const classStudents = students.filter((s) => s.classId === cls.id);
    const student = classStudents.find(
      (s) => s.name.trim() === data.studentName.trim()
    );
    if (!student) {
      errors.push(`שורה ${rowNum}: תלמיד לא נמצא — ${data.studentName}`);
      skipped++;
      continue;
    }

    const subject = subjectByName.get(data.subjectName.trim().toLowerCase());
    if (!subject) {
      errors.push(`שורה ${rowNum}: מקצוע לא נמצא — ${data.subjectName}`);
      skipped++;
      continue;
    }

    const obligation = findObligationInSubject(subject, data.obligationName);
    if (!obligation) {
      errors.push(`שורה ${rowNum}: מטלה לא נמצאה — ${data.obligationName}`);
      skipped++;
      continue;
    }

    const withRelations = await buildStudentWithRelations(student);
    const relevant = await getRelevantSubjects(withRelations);
    const isRelevant = relevant.some((s) =>
      s.obligations.some((o) => o.id === obligation.id)
    );
    if (!isRelevant) {
      errors.push(`שורה ${rowNum}: המטלה לא רלוונטית לתלמיד ${data.studentName}`);
      skipped++;
      continue;
    }

    toUpsert.push({
      studentId: student.id,
      obligationId: obligation.id,
      score: data.score,
      status: data.status,
      notes: null,
    });
  }

  let updated = 0;
  if (toUpsert.length > 0) {
    const results = await upsertGradesBulk(toUpsert);
    updated = results.length;
  }

  return NextResponse.json({ updated, skipped, errors });
}
