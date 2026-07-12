import { NextRequest, NextResponse } from "next/server";
import {
  findObligation,
  getGradesByStudentsAndObligation,
  getStudentById,
  listClassesSimple,
  upsertGradesBulk,
} from "@/lib/firestore";
import {
  getMatrixData,
  getMatrixDataByGradeYear,
  isObligationRelevantForStudent,
} from "@/lib/grade-matrix";
import {
  calcPartialWeightedSubItemScore,
  calcWeightedComponentScore,
  calcWeightedSubItemScore,
  hasSeparateComponentGrades,
  hasSubItemGrades,
  isObligationSubItemsComplete,
  normalizeComponents,
  normalizeSubItems,
  validateComponentScores,
  validateSubItemScores,
  type MatrixTaskKind,
} from "@/lib/grade-components";
import { isValidSubmissionStatus, validateScore } from "@/lib/grade-status";
import {
  isSocialInvolvementSubject,
  isValidQualitativeLevel,
} from "@/lib/social-involvement";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { getAllowedClassIds } from "@/lib/permissions";
import { normalizeGradeYear } from "@/lib/grade-year";
import type { QualitativeLevel, SubmissionStatus } from "@/lib/types";

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
  const gradeYearRaw = searchParams.get("gradeYear");
  const gradeYear = normalizeGradeYear(gradeYearRaw);
  const obligationId = searchParams.get("obligationId");
  const taskKind = parseTaskKind(searchParams.get("taskKind"));
  const taskSortOrderRaw = searchParams.get("taskSortOrder");
  const taskSortOrder =
    taskSortOrderRaw != null && taskSortOrderRaw !== "" ? Number(taskSortOrderRaw) : undefined;

  if ((!classId && !gradeYear) || !obligationId) {
    return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
  }

  try {
    if (classId) {
      const readError = await requireGradeWrite(session, { classId, obligationId });
      if (readError) return readError;
      return NextResponse.json(
        await getMatrixData(classId, obligationId, taskKind, taskSortOrder)
      );
    }

    const classes = await listClassesSimple();
    const allowedClassIds = getAllowedClassIds(session, classes);
    const layerClasses = classes.filter(
      (c) => normalizeGradeYear(c.gradeYear) === gradeYear
    );
    const accessible =
      allowedClassIds === null
        ? layerClasses
        : layerClasses.filter((c) => allowedClassIds.includes(c.id));

    if (accessible.length === 0) {
      return NextResponse.json(
        { error: "אין הרשאה או אין כיתות בשכבה זו" },
        { status: 403 }
      );
    }

    const accessError = await requireGradeWrite(session, {
      gradeYear,
      obligationId,
    });
    if (accessError) {
      const classAccess = await Promise.all(
        accessible.map((c) =>
          requireGradeWrite(session, { classId: c.id, obligationId })
        )
      );
      if (classAccess.every((e) => e != null)) return accessError;
    }

    return NextResponse.json(
      await getMatrixDataByGradeYear(
        gradeYear!,
        obligationId,
        taskKind,
        taskSortOrder,
        allowedClassIds
      )
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
      qualitativeLevel?: QualitativeLevel | null;
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

  const isSocial = isSocialInvolvementSubject(found.subject);
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
    qualitativeLevel: QualitativeLevel | null;
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

    const entryWriteError = await requireGradeWrite(session, {
      classId: student.classId,
      obligationId,
      subjectId: found.subject.id,
    });
    if (entryWriteError) return entryWriteError;

    if (!isValidSubmissionStatus(entry.status)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }

    if (isSocial) {
      const qualitativeLevel = entry.qualitativeLevel ?? null;
      if (qualitativeLevel != null && !isValidQualitativeLevel(qualitativeLevel)) {
        return NextResponse.json({ error: "רמת הערכה לא חוקית" }, { status: 400 });
      }
      validated.push({
        studentId: entry.studentId,
        obligationId,
        score: null,
        qualitativeLevel,
        componentScores: null,
        subItemScores: null,
        status: entry.status as SubmissionStatus,
        notes: entry.notes ?? null,
      });
      continue;
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
      const nextSubItems = { ...(existing?.subItemScores ?? {}) };
      if (score == null) delete nextSubItems[taskSortOrder];
      else nextSubItems[taskSortOrder] = score;
      subItemScores =
        Object.values(nextSubItems).some((s) => s != null) ? nextSubItems : null;
    } else if (editingSingleTask && taskKind === "component") {
      if (!validateScore(score)) {
        return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
      }
      const nextComponents = { ...(existing?.componentScores ?? {}) };
      if (score == null) delete nextComponents[taskSortOrder];
      else nextComponents[taskSortOrder] = score;
      componentScores =
        Object.values(nextComponents).some((s) => s != null) ? nextComponents : null;
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
      const complete = isObligationSubItemsComplete(
        { subItems: found.obligation.subItems },
        { subItemScores }
      );
      resolvedScore = complete
        ? calcWeightedSubItemScore(subItems, subItemScores)
        : calcPartialWeightedSubItemScore(subItems, subItemScores);
    } else if (multiComponent) {
      resolvedScore = calcWeightedComponentScore(components, componentScores);
    }

    validated.push({
      studentId: entry.studentId,
      obligationId,
      score: resolvedScore,
      qualitativeLevel: null,
      componentScores: multiComponent && !usesSubItems ? componentScores : null,
      subItemScores: usesSubItems ? subItemScores : null,
      status: entry.status as SubmissionStatus,
      notes: entry.notes ?? null,
    });
  }

  const grades = await upsertGradesBulk(validated);
  return NextResponse.json({ updated: grades.length, grades });
}
