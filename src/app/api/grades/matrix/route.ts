import { NextRequest, NextResponse } from "next/server";
import {
  findObligation,
  getGradesByStudentsAndObligation,
  getStudentById,
  upsertGradesBulk,
} from "@/lib/firestore";
import { getMatrixData, isObligationRelevantForStudent } from "@/lib/grade-matrix";
import {
  calcWeightedComponentScore,
  calcWeightedSubItemScore,
  hasSeparateComponentGrades,
  hasSubItemGrades,
  normalizeComponents,
  normalizeSubItems,
  validateComponentScores,
  validateSubItemScores,
  type MatrixTaskKind,
} from "@/lib/grade-components";
import { isValidSubmissionStatus, validateScore } from "@/lib/grade-status";
import { checkPermission, requireStaff } from "@/lib/api-auth";
import type { SubmissionStatus } from "@/lib/types";

function parseTaskKind(value: string | null): MatrixTaskKind | undefined {
  if (value === "subItem" || value === "component" || value === "single") return value;
  return undefined;
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const obligationId = searchParams.get("obligationId");
  const taskKind = parseTaskKind(searchParams.get("taskKind"));
  const taskSortOrderRaw = searchParams.get("taskSortOrder");
  const taskSortOrder =
    taskSortOrderRaw != null && taskSortOrderRaw !== "" ? Number(taskSortOrderRaw) : undefined;

  if (!classId || !obligationId) {
    return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await getMatrixData(classId, obligationId, taskKind, taskSortOrder)
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 404 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json();
  const { obligationId, taskKind, taskSortOrder, entries } = body as {
    obligationId: string;
    taskKind?: MatrixTaskKind | null;
    taskSortOrder?: number | null;
    entries: Array<{
      studentId: string;
      score?: number | null;
      componentScores?: Record<number, number | null> | null;
      subItemScores?: Record<number, number | null> | null;
      status: string;
      notes?: string | null;
    }>;
  };

  if (!obligationId || !Array.isArray(entries)) {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const found = await findObligation(obligationId);
  if (!found) {
    return NextResponse.json({ error: "מטלה לא נמצאה" }, { status: 404 });
  }

  const subItems = normalizeSubItems(found.obligation.subItems);
  const components = normalizeComponents(found.obligation.components);
  const usesSubItems = hasSubItemGrades(subItems);
  const multiComponent = hasSeparateComponentGrades(components);
  const editingSingleTask = taskKind != null && taskSortOrder != null;

  const existingGrades = await getGradesByStudentsAndObligation(
    entries.map((e) => e.studentId),
    obligationId
  );

  const validated: Array<{
    studentId: string;
    obligationId: string;
    score: number | null;
    componentScores: Record<number, number | null> | null;
    subItemScores: Record<number, number | null> | null;
    status: SubmissionStatus;
    notes: string | null;
  }> = [];

  for (const entry of entries) {
    if (!entry.studentId) {
      return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
    }

    const student = await getStudentById(entry.studentId);
    if (!student) {
      return NextResponse.json(
        { error: `תלמיד לא נמצא: ${entry.studentId}` },
        { status: 400 }
      );
    }

    if (!(await isObligationRelevantForStudent(student, obligationId))) {
      return NextResponse.json(
        { error: `המטלה לא רלוונטית לתלמיד ${student.name}` },
        { status: 400 }
      );
    }

    if (!isValidSubmissionStatus(entry.status)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }

    const score = entry.score ?? null;
    const existing = existingGrades.get(entry.studentId);

    let componentScores: Record<number, number | null> | null =
      existing?.componentScores ?? null;
    let subItemScores: Record<number, number | null> | null =
      existing?.subItemScores ?? null;

    if (editingSingleTask && taskKind === "subItem") {
      if (!validateScore(score)) {
        return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
      }
      subItemScores = { ...(existing?.subItemScores ?? {}), [taskSortOrder]: score };
    } else if (editingSingleTask && taskKind === "component") {
      if (!validateScore(score)) {
        return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
      }
      componentScores = { ...(existing?.componentScores ?? {}), [taskSortOrder]: score };
    } else if (editingSingleTask && taskKind === "single") {
      if (!validateScore(score)) {
        return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
      }
    } else if (usesSubItems) {
      subItemScores = entry.subItemScores ?? null;
      if (!validateSubItemScores(subItemScores)) {
        return NextResponse.json({ error: "ציון תת-מטלה לא חוקי (0–100)" }, { status: 400 });
      }
    } else if (multiComponent) {
      componentScores = entry.componentScores ?? null;
      if (!validateComponentScores(componentScores)) {
        return NextResponse.json({ error: "ציון רכיב לא חוקי (0–100)" }, { status: 400 });
      }
    } else if (!validateScore(score)) {
      return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
    }

    let resolvedScore: number | null = score;
    if (usesSubItems) {
      resolvedScore = calcWeightedSubItemScore(subItems, subItemScores);
    } else if (multiComponent) {
      resolvedScore = calcWeightedComponentScore(components, componentScores);
    }

    validated.push({
      studentId: entry.studentId,
      obligationId,
      score: resolvedScore,
      componentScores: multiComponent && !usesSubItems ? componentScores : null,
      subItemScores: usesSubItems ? subItemScores : null,
      status: entry.status,
      notes: entry.notes ?? null,
    });
  }

  const grades = await upsertGradesBulk(validated);
  return NextResponse.json({ updated: grades.length, grades });
}
