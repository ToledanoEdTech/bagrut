import { NextRequest, NextResponse } from "next/server";
import {
  listClassesSimple,
  listExamPaths,
  listStudents,
  listSubjects,
  upsertGradesBulk,
  listAllGrades,
} from "@/lib/firestore";
import { parseImportWorkbook } from "@/lib/excel-import";
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
  completeWeightOverrides,
  expandObligationMatrixTasks,
  formatWeightPartsBreakdown,
  formatWeightPercent,
  getEffectiveWeightPercent,
  getObligationWeightItems,
  obligationDisplayLabel,
  resolveObligationGradeScore,
  validateObligationEffectiveWeightSum,
  type ObligationWeightKind,
} from "@/lib/grade-components";
import {
  isSocialInvolvementSubject,
  parseQualitativeLevelInput,
} from "@/lib/social-involvement";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { actorFromSession, recordActivity } from "@/lib/activity-log";
import type { QualitativeLevel, SubmissionStatus, Subject, Obligation } from "@/lib/types";

type ImportRow = {
  className: string;
  subjectName: string;
  obligationName: string;
  taskName: string;
  studentName: string;
  score: number | null;
  qualitativeLevel: QualitativeLevel | null;
  status: SubmissionStatus | null;
  hasScoreCol: boolean;
  /** undefined = אין עמודת אחוזים; null = תא ריק (אין הוראה); number = האחוז שהוזן */
  weightPercent: number | null | undefined;
  hasWeightCol: boolean;
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

/**
 * לאיזה פריט שקלול (רכיב / תת-מטלה) מתייחסת שורת הקובץ.
 * שורת «ציון» יחידה מתייחסת לפריט היחיד של המטלה.
 */
function resolveWeightSortOrder(
  target: Exclude<TaskTarget, null | { kind: "ambiguous" }>,
  weightItems: Array<{ sortOrder: number }>
): number | null {
  if (weightItems.length === 0) return null;
  if (target.kind === "single") return weightItems[0]!.sortOrder;
  return weightItems.some((i) => i.sortOrder === target.sortOrder)
    ? target.sortOrder
    : null;
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

  let rawRows: Record<string, string>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rawRows = parseImportWorkbook(buffer, {
      preferredSheetNames: ["ייבוא ציונים"],
      headerHints: [
        "כיתה",
        "מקצוע",
        "מטלה",
        "שם תלמיד",
        "ציון",
        "הערכה",
        "סטטוס",
        "רכיב/תת-מטלה",
        "אחוז שקלול (%)",
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "לא ניתן לקרוא את הקובץ" },
      { status: 400 }
    );
  }

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
    const scoreRaw = findColumn(row, "ציון", "הערכה", "score", "Score");
    const statusRaw = findColumn(row, "סטטוס", "status", "Status");
    const weightRaw = findColumn(
      row,
      "אחוז שקלול (%)",
      "אחוז שקלול",
      "אחוז",
      "weightPercent",
      "weight",
      "Weight"
    );
    const scoreCellEmpty = !scoreRaw || scoreRaw === "-";
    const hasWeightKey = Object.keys(row).some((k) =>
      /אחוז|weight/i.test(k)
    );
    const weightCellEmpty = !weightRaw || weightRaw === "-";

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

    const subjectHint = subjectByName.get(subjectName.trim().toLowerCase());
    const looksSocial =
      (subjectHint && isSocialInvolvementSubject(subjectHint)) ||
      !!parseQualitativeLevelInput(scoreRaw);

    let score: number | null = null;
    let qualitativeLevel: QualitativeLevel | null = null;

    if (!scoreCellEmpty) {
      if (looksSocial) {
        qualitativeLevel = parseQualitativeLevelInput(scoreRaw);
        if (!qualitativeLevel) {
          parsedRows.push({
            rowNum,
            data: null,
            error: `הערכה לא חוקית: ${scoreRaw} (לא עבר / עבר / עבר בהצלחה / עבר בהצטיינות)`,
          });
          return;
        }
      } else {
        score = parseFloat(scoreRaw.replace(",", "."));
        if (isNaN(score) || !validateScore(score)) {
          parsedRows.push({ rowNum, data: null, error: "ציון לא חוקי (0–100)" });
          return;
        }
      }
    }

    const status = statusRaw ? parseStatusInput(statusRaw) : null;
    if (statusRaw && !status) {
      parsedRows.push({ rowNum, data: null, error: `סטטוס לא מזוהה: ${statusRaw}` });
      return;
    }

    let weightPercent: number | null | undefined = undefined;
    if (hasWeightKey) {
      if (weightCellEmpty) {
        weightPercent = null;
      } else {
        const parsed = parseFloat(weightRaw.replace(",", ".").replace(/%/g, ""));
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
          parsedRows.push({
            rowNum,
            data: null,
            error: "אחוז שקלול לא חוקי (0–100)",
          });
          return;
        }
        weightPercent = parsed;
      }
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
        qualitativeLevel,
        status,
        hasScoreCol: !scoreCellEmpty,
        weightPercent,
        hasWeightCol: hasWeightKey,
      },
    });
  });

  const errors: string[] = [];
  let skipped = 0;

  const allGrades = await listAllGrades();
  const existingByKey = new Map(
    allGrades.map((g) => [`${g.studentId}:${g.obligationId}`, g])
  );

  type Aggregate = {
    studentId: string;
    studentName: string;
    obligationId: string;
    classId: string;
    subjectId: string;
    obligation: Obligation;
    isSocial: boolean;
    score: number | null;
    qualitativeLevel: QualitativeLevel | null;
    componentScores: Record<number, number | null>;
    subItemScores: Record<number, number | null>;
    /** אחוזי השקלול המותאמים ששמורים כבר להזנה זו */
    componentWeightOverrides: Record<number, number>;
    subItemWeightOverrides: Record<number, number>;
    weightKind: ObligationWeightKind;
    weightItems: ReturnType<typeof getObligationWeightItems>["items"];
    /** אחוזים שהוזנו בקובץ ושונים מהאחוז שחל כיום */
    explicitWeights: Record<number, number>;
    weightTouched: boolean;
    status: SubmissionStatus;
    explicitStatus: boolean;
    touched: boolean;
    /** שורות בקובץ שתרמו לאגרגציה — להודעות שגיאה */
    rowNums: number[];
  };

  const aggregates = new Map<string, Aggregate>();
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

    const isSocial = isSocialInvolvementSubject(subject);

    if (data.hasScoreCol && isSocial && !data.qualitativeLevel) {
      errors.push(
        `שורה ${rowNum}: למעורבות חברתית יש להזין הערכה (לא עבר / עבר / עבר בהצלחה / עבר בהצטיינות)`
      );
      skipped++;
      continue;
    }

    if (data.hasScoreCol && !isSocial && data.qualitativeLevel != null && data.score == null) {
      errors.push(
        `שורה ${rowNum}: למקצוע זה יש להזין ציון מספרי (0–100), לא הערכה איכותית`
      );
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

    /** ציון ריק + סטטוס «לא התחיל» = איפוס למצב שלא הוזן ציון */
    const clearToUnentered =
      !data.hasScoreCol && data.status === "NOT_STARTED";

    if (target.kind === "ambiguous") {
      if (data.hasScoreCol) {
        errors.push(
          `שורה ${rowNum}: יש לציין רכיב/תת-מטלה עבור מטלה זו (${data.obligationName})`
        );
        skipped++;
        continue;
      }
      // בלי ציון ובלי איפוס מפורש — אפשר להמשיך רק לעדכון סטטוס כללי
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
      const { kind: weightKind, items: weightItems } =
        getObligationWeightItems(obligation);
      agg = {
        studentId: student.id,
        studentName: student.name,
        obligationId: obligation.id,
        classId: cls.id,
        subjectId: subject.id,
        obligation,
        isSocial,
        score: existing?.score ?? null,
        qualitativeLevel: existing?.qualitativeLevel ?? null,
        componentScores: { ...(existing?.componentScores ?? {}) },
        subItemScores: { ...(existing?.subItemScores ?? {}) },
        componentWeightOverrides: { ...(existing?.componentWeightOverrides ?? {}) },
        subItemWeightOverrides: { ...(existing?.subItemWeightOverrides ?? {}) },
        weightKind,
        weightItems,
        explicitWeights: {},
        weightTouched: false,
        status: (existing?.status as SubmissionStatus) ?? "NOT_STARTED",
        explicitStatus: false,
        touched: false,
        rowNums: [],
      };
      aggregates.set(key, agg);
    }
    if (!agg.rowNums.includes(rowNum)) agg.rowNums.push(rowNum);

    if (clearToUnentered) {
      if (isSocial || target.kind === "single" || target.kind === "ambiguous") {
        agg.score = null;
        agg.qualitativeLevel = null;
        agg.componentScores = {};
        agg.subItemScores = {};
        agg.componentWeightOverrides = {};
        agg.subItemWeightOverrides = {};
        agg.explicitWeights = {};
      } else if (target.kind === "component") {
        delete agg.componentScores[target.sortOrder];
        delete agg.componentWeightOverrides[target.sortOrder];
        delete agg.explicitWeights[target.sortOrder];
        if (Object.values(agg.componentScores).every((s) => s == null)) {
          agg.score = null;
        }
      } else {
        delete agg.subItemScores[target.sortOrder];
        delete agg.subItemWeightOverrides[target.sortOrder];
        delete agg.explicitWeights[target.sortOrder];
        if (Object.values(agg.subItemScores).every((s) => s == null)) {
          agg.score = null;
        }
      }
      agg.status = "NOT_STARTED";
      agg.explicitStatus = true;
      agg.touched = true;
    } else if (data.hasScoreCol && target.kind !== "ambiguous") {
      if (isSocial) {
        agg.qualitativeLevel = data.qualitativeLevel;
        agg.score = null;
      } else if (target.kind === "single") {
        agg.score = data.score;
        agg.qualitativeLevel = null;
      } else if (target.kind === "component") {
        if (data.score == null) delete agg.componentScores[target.sortOrder];
        else agg.componentScores[target.sortOrder] = data.score;
      } else {
        if (data.score == null) delete agg.subItemScores[target.sortOrder];
        else agg.subItemScores[target.sortOrder] = data.score;
      }
      agg.touched = true;
    }

    /**
     * אחוז שקלול נחשב «שינוי» רק כשהוא שונה מהאחוז שחל כיום על התלמיד.
     * כך קובץ מלא שהאחוזים בו לא נגעו לא נחשב עריכה, וכל השורות שנותרו
     * בברירת המחדל פנויות לחלוקת היתרה עד 100%.
     */
    if (data.hasWeightCol && !isSocial && data.weightPercent != null) {
      if (target.kind === "ambiguous") {
        errors.push(
          `שורה ${rowNum}: יש לציין רכיב/תת-מטלה כדי לשנות אחוז שקלול במטלה «${data.obligationName}»`
        );
        skipped++;
        continue;
      }

      const weightSortOrder = resolveWeightSortOrder(target, agg.weightItems);
      const weightItem =
        weightSortOrder == null
          ? undefined
          : agg.weightItems.find((i) => i.sortOrder === weightSortOrder);

      if (!weightItem || agg.weightItems.length === 1) {
        // מטלה עם משבצת ציון אחת — אין בין מה לחלק, והאחוז שלה הוא תמיד 100%
        if (Math.abs(data.weightPercent - 100) > 0.01) {
          errors.push(
            `שורה ${rowNum}: למטלה «${obligationDisplayLabel(obligation)}» יש רכיב אחד בלבד, ולכן אחוז השקלול שלו הוא תמיד 100%`
          );
          skipped++;
          continue;
        }
      } else {
        const currentOverrides =
          agg.weightKind === "subItem"
            ? agg.subItemWeightOverrides
            : agg.componentWeightOverrides;
        const currentEffective = getEffectiveWeightPercent(weightItem, currentOverrides);
        if (Math.abs(data.weightPercent - currentEffective) > 0.01) {
          agg.explicitWeights[weightItem.sortOrder] = data.weightPercent;
          agg.weightTouched = true;
          agg.touched = true;
        }
      }
    }

    if (data.status && !clearToUnentered) {
      agg.status = data.status;
      agg.explicitStatus = true;
      agg.touched = true;
    }
  }

  const toUpsert: Array<{
    studentId: string;
    obligationId: string;
    score: number | null;
    qualitativeLevel: QualitativeLevel | null;
    componentScores: Record<number, number | null> | null;
    subItemScores: Record<number, number | null> | null;
    componentWeightOverrides: Record<number, number> | null;
    subItemWeightOverrides: Record<number, number> | null;
    status: SubmissionStatus;
    notes: null;
  }> = [];

  for (const agg of aggregates.values()) {
    if (!agg.touched) continue;

    const componentScores = Object.fromEntries(
      Object.entries(agg.componentScores).filter(([, s]) => s != null)
    ) as Record<number, number | null>;
    const subItemScores = Object.fromEntries(
      Object.entries(agg.subItemScores).filter(([, s]) => s != null)
    ) as Record<number, number | null>;
    if (agg.isSocial) {
      const status = agg.explicitStatus
        ? agg.status
        : agg.qualitativeLevel
          ? autoStatusOnScore(0, agg.status)
          : agg.status;
      toUpsert.push({
        studentId: agg.studentId,
        obligationId: agg.obligationId,
        score: null,
        qualitativeLevel: agg.qualitativeLevel,
        componentScores: null,
        subItemScores: null,
        componentWeightOverrides: null,
        subItemWeightOverrides: null,
        status,
        notes: null,
      });
      continue;
    }

    const rowLabel =
      agg.rowNums.length === 1
        ? `שורה ${agg.rowNums[0]}`
        : `שורות ${agg.rowNums.join(", ")}`;

    const savedOverrides =
      agg.weightKind === "subItem"
        ? agg.subItemWeightOverrides
        : agg.componentWeightOverrides;

    const completed = completeWeightOverrides({
      items: agg.weightItems,
      current: savedOverrides,
      explicit: agg.explicitWeights,
    });

    if (!completed.ok) {
      const detail = formatWeightPartsBreakdown(completed.parts);
      errors.push(
        completed.reason === "exceeds"
          ? `${rowLabel}: אחוזי השקלול שהוזנו במטלה «${obligationDisplayLabel(agg.obligation)}» לתלמיד «${agg.studentName}» מסתכמים ל-${formatWeightPercent(completed.sum)}% — יותר מ-100% (${detail}).`
          : `${rowLabel}: סכום אחוזי השקלול במטלה «${obligationDisplayLabel(agg.obligation)}» לתלמיד «${agg.studentName}» הוא ${formatWeightPercent(completed.sum)}% ולא 100% (${detail}). יש לתקן כך שהסכום יהיה בדיוק 100%.`
      );
      skipped++;
      continue;
    }

    const weightOverridesForCheck = {
      componentWeightOverrides:
        agg.weightKind === "component" ? completed.overrides : null,
      subItemWeightOverrides:
        agg.weightKind === "subItem" ? completed.overrides : null,
    };

    /**
     * בדיקת השפיות מופעלת רק כשהאחוזים שונו בייבוא הזה — אחרת מטלה
     * שברירות המחדל שלה אינן מסתכמות ל-100% הייתה חוסמת גם הזנת ציון רגילה.
     */
    if (agg.weightTouched) {
      const weightCheck = validateObligationEffectiveWeightSum(
        agg.obligation,
        weightOverridesForCheck
      );
      if (weightCheck && !weightCheck.ok) {
        errors.push(
          `${rowLabel}: סכום אחוזי השקלול במטלה «${obligationDisplayLabel(agg.obligation)}» לתלמיד «${agg.studentName}» הוא ${formatWeightPercent(weightCheck.sum)}% ולא 100% (${formatWeightPartsBreakdown(weightCheck.parts)}). יש לתקן כך שהסכום יהיה בדיוק 100%.`
        );
        skipped++;
        continue;
      }
    }

    const resolved = resolveObligationGradeScore(agg.obligation, {
      score: agg.score,
      componentScores,
      subItemScores,
      ...weightOverridesForCheck,
    });
    const status = agg.explicitStatus
      ? agg.status
      : autoStatusOnScore(resolved, agg.status);
    toUpsert.push({
      studentId: agg.studentId,
      obligationId: agg.obligationId,
      score: resolved,
      qualitativeLevel: null,
      componentScores:
        Object.keys(componentScores).length > 0 ? componentScores : null,
      subItemScores:
        Object.keys(subItemScores).length > 0 ? subItemScores : null,
      componentWeightOverrides: weightOverridesForCheck.componentWeightOverrides,
      subItemWeightOverrides: weightOverridesForCheck.subItemWeightOverrides,
      status,
      notes: null,
    });
  }

  let updated = 0;
  if (toUpsert.length > 0) {
    await upsertGradesBulk(toUpsert);
    // כולל מחיקות (איפוס למצב שלא הוזן) — לא רק מסמכים שנותרו
    updated = toUpsert.length;
  }

  if (updated > 0) {
    void recordActivity({
      actor: actorFromSession(session),
      action: "grade.import",
      category: "grades",
      entityType: "grade",
      entityId: "import",
      summaryHe: `ייבוא ציונים מקובץ: ${updated} רשומות עודכנו${
        skipped > 0 ? ` · ${skipped} דולגו` : ""
      }`,
      meta: { updated, skipped, errorCount: errors.length },
    });
  }

  return NextResponse.json({ updated, skipped, errors });
}
