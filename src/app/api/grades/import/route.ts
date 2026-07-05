import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  listClassesSimple,
  listExamPaths,
  listStudents,
  listSubjects,
  upsertGradesBulk,
} from "@/lib/firestore";
import {
  buildPathLabelsBySubjectId,
  formatSubjectDisplayName,
} from "@/lib/subject-display";
import {
  buildStudentWithRelations,
  getRelevantSubjects,
} from "@/lib/student-subjects";
import { parseStatusInput, validateScore, autoStatusOnScore } from "@/lib/grade-status";
import {
  expandObligationMatrixTasks,
  resolveObligationGradeScore,
} from "@/lib/grade-components";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { listAllGrades } from "@/lib/firestore";
import type { SubmissionStatus, Subject, Obligation } from "@/lib/types";

type ImportRow = {
  className: string;
  subjectName: string;
  obligationName: string;
  taskName: string;
  studentName: string;
  score: number | null;
  status: SubmissionStatus | null;
  hasScoreCol: boolean;
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
): Obligation | null {
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

type TaskTarget =
  | { kind: "single" | "component" | "subItem"; sortOrder: number }
  | { kind: "ambiguous" }
  | null;

/**
 * מזהה לאיזו תת-מטלה/רכיב הציון בשורה שייך.
 * אם עמודת "רכיב/תת-מטלה" ריקה ולמטלה יש מטלה בודדת — זהו הציון הכללי.
 * אם ריקה ולמטלה כמה רכיבים/תתי-מטלה — לא ניתן לקבוע (ambiguous).
 */
function resolveTaskTarget(ob: Obligation, taskName: string): TaskTarget {
  const options = expandObligationMatrixTasks(ob, 0);
  const trimmed = taskName.trim().toLowerCase();

  if (!trimmed) {
    if (options.length === 1) {
      const only = options[0]!;
      return { kind: only.taskKind, sortOrder: only.sortOrder };
    }
    return { kind: "ambiguous" };
  }

  const match = options.find((o) => o.taskName.trim().toLowerCase() === trimmed);
  if (match) return { kind: match.taskKind, sortOrder: match.sortOrder };
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

  const [classes, students, subjects, examPaths] = await Promise.all([
    listClassesSimple(),
    listStudents(),
    listSubjects(),
    listExamPaths(),
  ]);

  const classByName = new Map(classes.map((c) => [c.name.trim(), c]));
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(examPaths);
  const subjectByName = new Map<string, Subject>();
  for (const subject of subjects) {
    const pathLabels = pathLabelsBySubjectId.get(subject.id) ?? [];
    const displayName = formatSubjectDisplayName(subject.name, {
      pathLabels,
      units: subject.units,
      category: subject.category,
    });
    subjectByName.set(subject.name.trim().toLowerCase(), subject);
    subjectByName.set(displayName.trim().toLowerCase(), subject);
  }

  const parsedRows: Array<{ rowNum: number; data: ImportRow | null; error?: string }> = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;
    const className = findColumn(row, "כיתה", "class", "Class");
    const subjectName = findColumn(row, "מקצוע", "subject", "Subject");
    const obligationName = findColumn(row, "מטלה", "obligation", "Obligation");
    const taskName = findColumn(row, "רכיב/תת-מטלה", "תת-מטלה", "רכיב", "task", "Task");
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

    const status = statusRaw ? parseStatusInput(statusRaw) : null;
    if (statusRaw && !status) {
      parsedRows.push({ rowNum, data: null, error: `סטטוס לא מזוהה: ${statusRaw}` });
      return;
    }

    parsedRows.push({
      rowNum,
      data: {
        className,
        subjectName,
        obligationName,
        taskName,
        studentName,
        score,
        status,
        hasScoreCol: scoreRaw !== "",
      },
    });
  });

  const errors: string[] = [];
  let skipped = 0;

  // מפת ציונים קיימים כדי לשמר שדות שלא עודכנו (רכיבים/תתי-מטלה נפרדים)
  const allGrades = await listAllGrades();
  const existingByKey = new Map(
    allGrades.map((g) => [`${g.studentId}:${g.obligationId}`, g])
  );

  type Aggregate = {
    studentId: string;
    obligationId: string;
    classId: string;
    subjectId: string;
    obligation: Obligation;
    score: number | null;
    componentScores: Record<number, number | null>;
    subItemScores: Record<number, number | null>;
    status: SubmissionStatus;
    explicitStatus: boolean;
    touched: boolean;
  };

  const aggregates = new Map<string, Aggregate>();
  // מטמון בדיקות רלוונטיות/הרשאה לכל (תלמיד, מטלה)
  const relevanceCache = new Map<string, boolean>();

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

    const target = resolveTaskTarget(obligation, data.taskName);
    if (target === null) {
      errors.push(
        `שורה ${rowNum}: רכיב/תת-מטלה לא נמצא — ${data.taskName}`
      );
      skipped++;
      continue;
    }
    if (target.kind === "ambiguous") {
      if (data.hasScoreCol) {
        errors.push(
          `שורה ${rowNum}: יש לציין רכיב/תת-מטלה עבור מטלה זו (${data.obligationName})`
        );
        skipped++;
        continue;
      }
      // שורה ללא ציון וללא רכיב — נחיל רק סטטוס ברמת המטלה
    }

    const relevanceKey = `${student.id}:${obligation.id}`;
    let isRelevant = relevanceCache.get(relevanceKey);
    if (isRelevant === undefined) {
      const withRelations = await buildStudentWithRelations(student);
      const relevant = await getRelevantSubjects(withRelations);
      isRelevant = relevant.some((s) =>
        s.obligations.some((o) => o.id === obligation.id)
      );
      relevanceCache.set(relevanceKey, isRelevant);
    }
    if (!isRelevant) {
      errors.push(`שורה ${rowNum}: המטלה לא רלוונטית לתלמיד ${data.studentName}`);
      skipped++;
      continue;
    }

    const writeError = await requireGradeWrite(session, {
      classId: cls.id,
      subjectId: subject.id,
      obligationId: obligation.id,
    });
    if (writeError) {
      const errBody = await writeError.json();
      errors.push(`שורה ${rowNum}: ${errBody.error ?? "אין הרשאה"}`);
      skipped++;
      continue;
    }

    const key = relevanceKey;
    let agg = aggregates.get(key);
    if (!agg) {
      const existing = existingByKey.get(key);
      agg = {
        studentId: student.id,
        obligationId: obligation.id,
        classId: cls.id,
        subjectId: subject.id,
        obligation,
        score: existing?.score ?? null,
        componentScores: { ...(existing?.componentScores ?? {}) },
        subItemScores: { ...(existing?.subItemScores ?? {}) },
        status: (existing?.status as SubmissionStatus) ?? "NOT_STARTED",
        explicitStatus: false,
        touched: false,
      };
      aggregates.set(key, agg);
    }

    if (data.hasScoreCol && target.kind !== "ambiguous") {
      if (target.kind === "single") {
        agg.score = data.score;
      } else if (target.kind === "component") {
        agg.componentScores[target.sortOrder] = data.score;
      } else {
        agg.subItemScores[target.sortOrder] = data.score;
      }
      agg.touched = true;
    }

    if (data.status) {
      agg.status = data.status;
      agg.explicitStatus = true;
      agg.touched = true;
    }
  }

  const toUpsert = Array.from(aggregates.values())
    .filter((agg) => agg.touched)
    .map((agg) => {
      const resolved = resolveObligationGradeScore(agg.obligation, {
        score: agg.score,
        componentScores: agg.componentScores,
        subItemScores: agg.subItemScores,
      });
      const status = agg.explicitStatus
        ? agg.status
        : autoStatusOnScore(resolved, agg.status);
      return {
        studentId: agg.studentId,
        obligationId: agg.obligationId,
        score: agg.score,
        componentScores:
          Object.keys(agg.componentScores).length > 0 ? agg.componentScores : null,
        subItemScores:
          Object.keys(agg.subItemScores).length > 0 ? agg.subItemScores : null,
        status,
        notes: null as null,
      };
    });

  let updated = 0;
  if (toUpsert.length > 0) {
    const results = await upsertGradesBulk(toUpsert);
    updated = results.length;
  }

  return NextResponse.json({ updated, skipped, errors });
}
