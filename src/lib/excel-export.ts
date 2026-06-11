import ExcelJS from "exceljs";
import { obligationDisplayLabel } from "@/lib/grade-components";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import {
  formatSubjectDisplayName,
  formatSubjectWithPathLinks,
} from "@/lib/subject-display";
import type { SubmissionStatus } from "@/lib/types";

type DataValidationRule = {
  type: string;
  operator?: string;
  allowBlank?: boolean;
  formulae: Array<string | number>;
  showErrorMessage?: boolean;
  errorStyle?: string;
  errorTitle?: string;
  error?: string;
};

type WorksheetWithValidations = ExcelJS.Worksheet & {
  dataValidations: { add: (sqref: string, rule: DataValidationRule) => void };
};

export type ExportColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ExportSheet = {
  name: string;
  title?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number | null | undefined>[];
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4F46E5" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF8FAFC" },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function statusLabel(status: string): string {
  if (status in STATUS_LABELS) {
    return STATUS_LABELS[status as SubmissionStatus].label;
  }
  return status;
}

function autoColumnWidth(header: string, values: (string | number | null | undefined)[]): number {
  const maxLen = Math.max(
    header.length,
    ...values.map((v) => String(v ?? "").length)
  );
  return Math.min(Math.max(maxLen + 4, 10), 50);
}

export async function downloadExcel(filename: string, sheets: ExportSheet[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bagrut Manager";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const headerRowNum = sheet.title ? 2 : 1;
    const freezeRow = headerRowNum;

    const ws = workbook.addWorksheet(sheet.name, {
      views: [{ rightToLeft: true, state: "frozen", ySplit: freezeRow }],
    });

    if (sheet.title) {
      ws.mergeCells(1, 1, 1, sheet.columns.length);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = sheet.title;
      titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
      titleCell.alignment = { horizontal: "right", vertical: "middle" };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEF2FF" },
      };
      ws.getRow(1).height = 30;
    }

    const headerRow = ws.getRow(headerRowNum);
    sheet.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = THIN_BORDER;
    });
    headerRow.height = 24;

    const dataStartRow = headerRowNum + 1;
    sheet.rows.forEach((row, idx) => {
      const excelRow = ws.getRow(dataStartRow + idx);
      sheet.columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        const val = row[col.key];
        cell.value = val === null || val === undefined ? "" : val;
        cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
        cell.border = THIN_BORDER;
        if (idx % 2 === 1) {
          cell.fill = ALT_ROW_FILL;
        }
      });
      excelRow.height = 20;
    });

    sheet.columns.forEach((col, i) => {
      const values = sheet.rows.map((r) => r[col.key]);
      ws.getColumn(i + 1).width =
        col.width ?? autoColumnWidth(col.header, values);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

type StudentExportRow = {
  user: { name: string; email?: string };
  class: { name: string; examPath?: { label: string } } | null;
  tracks?: { name: string }[];
  track?: { name: string } | null;
  mathUnits: number;
  englishUnits: number;
};

export function buildStudentsSheet(students: StudentExportRow[]): ExportSheet {
  const sorted = [...students].sort((a, b) =>
    a.user.name.localeCompare(b.user.name, "he")
  );

  return {
    name: "תלמידים",
    title: `רשימת תלמידים (${sorted.length})`,
    columns: [
      { header: "שם", key: "name" },
      { header: "אימייל", key: "email" },
      { header: "כיתה", key: "className" },
      { header: "מגמות", key: "tracks" },
      { header: 'מתמטיקה (יח"ל)', key: "math" },
      { header: 'אנגלית (יח"ל)', key: "english" },
      { header: "מסלול בגרות", key: "path" },
    ],
    rows: sorted.map((s) => ({
      name: s.user.name,
      email: s.user.email ?? "—",
      className: s.class?.name ?? "—",
      tracks:
        s.tracks?.length
          ? s.tracks.map((t) => t.name).join(", ")
          : s.track?.name ?? "—",
      math: s.mathUnits,
      english: s.englishUnits,
      path: s.class?.examPath?.label ?? "—",
    })),
  };
}

const SUBJECT_CATEGORIES: Record<string, string> = {
  MANDATORY: "חובה",
  MATH: "מתמטיקה",
  ENGLISH: "אנגלית",
  TRACK: "מגמה",
  EXTENSION: "הרחבה",
};

type SubjectExportRow = {
  id: string;
  name: string;
  units: number | null;
  category: string;
  obligations: Array<{
    name: string | null;
    questionnaireNumber: string | null;
    weightPercent: number;
    examType: string;
    studyMaterial: string | null;
    examEvent: string | null;
    gradeYear: string | null;
    components: Array<{ name: string; weightPercent: number }>;
    subItems: Array<{ name: string; weightPercent: number }>;
  }>;
  pathLinks?: Array<{ path: { label: string } }>;
};

export function buildSubjectsSheets(subjects: SubjectExportRow[]): ExportSheet[] {
  const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name, "he"));

  const summary: ExportSheet = {
    name: "מקצועות",
    title: `רשימת מקצועות (${sorted.length})`,
    columns: [
      { header: "שם מקצוע", key: "name" },
      { header: "קטגוריה", key: "category" },
      { header: 'יח"ל', key: "units" },
      { header: "מספר מטלות", key: "obligationCount" },
      { header: "סה״כ משקל", key: "totalWeight" },
      { header: "מסלולים", key: "paths" },
    ],
    rows: sorted.map((s) => ({
      name: formatSubjectWithPathLinks(s.name, s.pathLinks, {
        units: s.units,
        category: s.category,
      }),
      category: SUBJECT_CATEGORIES[s.category] ?? s.category,
      units: s.units ?? "—",
      obligationCount: s.obligations.length,
      totalWeight: `${s.obligations.reduce((sum, o) => sum + o.weightPercent, 0)}%`,
      paths: s.pathLinks?.map((p) => p.path.label).join(", ") ?? "—",
    })),
  };

  const obligations: ExportSheet = {
    name: "מטלות",
    title: "פירוט מטלות לפי מקצוע",
    columns: [
      { header: "מקצוע", key: "subject" },
      { header: "שם מטלה", key: "taskName" },
      { header: "מספר שאלון", key: "questionnaire" },
      { header: "משקל", key: "weight" },
      { header: "סוג היבחנות", key: "examType" },
      { header: "חומר לימוד", key: "material" },
      { header: "אירוע", key: "event" },
      { header: "שכבה", key: "gradeYear" },
      { header: "שקלול פנימי", key: "components" },
      { header: "עבודות", key: "subItems" },
    ],
    rows: sorted.flatMap((s) =>
      s.obligations.map((o) => ({
        subject: formatSubjectWithPathLinks(s.name, s.pathLinks, {
          units: s.units,
          category: s.category,
        }),
        taskName: o.name ?? o.examEvent ?? "—",
        questionnaire: o.questionnaireNumber ?? "—",
        weight: `${o.weightPercent}%`,
        examType: o.examType,
        material: o.studyMaterial ?? "—",
        event: o.examEvent ?? "—",
        gradeYear: o.gradeYear ?? "—",
        components:
          o.components.length > 0
            ? o.components.map((c) => `${c.name}: ${c.weightPercent}%`).join(" · ")
            : "—",
        subItems:
          o.subItems.length > 0
            ? o.subItems.map((si) => `${si.name}: ${si.weightPercent}%`).join(" · ")
            : "—",
      }))
    ),
  };

  return [summary, obligations];
}

type ClassExportRow = {
  name: string;
  gradeYear: string | null;
  examPath: { label: string };
  _count: { students: number };
};

export function buildClassesSheet(classes: ClassExportRow[]): ExportSheet {
  const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name, "he"));

  return {
    name: "כיתות",
    title: `רשימת כיתות (${sorted.length})`,
    columns: [
      { header: "שם כיתה", key: "name" },
      { header: "שכבה", key: "gradeYear" },
      { header: "תוכנית חובה", key: "path" },
      { header: "מספר תלמידים", key: "students" },
    ],
    rows: sorted.map((c) => ({
      name: c.name,
      gradeYear: c.gradeYear ?? "—",
      path: c.examPath.label,
      students: c._count.students,
    })),
  };
}

type StaffExportRow = { name: string; email: string; role: string };

export function buildStaffSheet(staff: StaffExportRow[]): ExportSheet {
  const sorted = [...staff].sort((a, b) => a.name.localeCompare(b.name, "he"));

  return {
    name: "צוות",
    title: `רשימת צוות (${sorted.length})`,
    columns: [
      { header: "שם", key: "name" },
      { header: "אימייל", key: "email" },
      { header: "תפקיד", key: "role" },
    ],
    rows: sorted.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role === "ADMIN" ? "מנהל" : "מורה",
    })),
  };
}

type GradeSubjectExport = {
  name: string;
  displayName?: string;
  pathLabels?: string[];
  category?: string | null;
  units: number | null;
  obligations: Array<{
    id: string;
    name: string | null;
    questionnaireNumber: string | null;
    examType: string;
    weightPercent: number;
  }>;
};

type GradeExportRow = {
  obligationId: string;
  score: number | null;
  status: string;
};

export function buildStudentGradesSheet(
  studentName: string,
  className: string,
  subjects: GradeSubjectExport[],
  grades: GradeExportRow[]
): ExportSheet {
  const gradeMap = new Map(grades.map((g) => [g.obligationId, g]));

  const rows = subjects.flatMap((subject) =>
    subject.obligations.map((o) => {
      const grade = gradeMap.get(o.id);
      return {
        subject:
          subject.displayName ??
          formatSubjectDisplayName(subject.name, {
            pathLabels: subject.pathLabels,
            units: subject.units,
            category: subject.category,
          }),
        units: subject.units ?? "—",
        task: o.name ?? "—",
        questionnaire: o.questionnaireNumber ?? "—",
        examType: o.examType,
        weight: `${o.weightPercent}%`,
        score: grade?.score ?? "—",
        status: grade ? statusLabel(grade.status) : statusLabel("NOT_STARTED"),
      };
    })
  );

  return {
    name: "ציונים",
    title: `ציונים — ${studentName} (${className})`,
    columns: [
      { header: "מקצוע", key: "subject" },
      { header: 'יח"ל', key: "units" },
      { header: "מטלה", key: "task" },
      { header: "שאלון", key: "questionnaire" },
      { header: "סוג", key: "examType" },
      { header: "משקל", key: "weight" },
      { header: "ציון", key: "score" },
      { header: "סטטוס", key: "status" },
    ],
    rows,
  };
}

export function buildMatrixSheet(input: {
  className: string;
  subjectName: string;
  taskLabel: string;
  rows: Array<{ studentName: string; score: number | null; status: string }>;
}): ExportSheet {
  return {
    name: "ציונים",
    title: `${input.className} — ${input.subjectName} — ${input.taskLabel}`,
    columns: [
      { header: "שם תלמיד", key: "studentName" },
      { header: "ציון", key: "score" },
      { header: "סטטוס", key: "status" },
    ],
    rows: input.rows.map((r) => ({
      studentName: r.studentName,
      score: r.score ?? "—",
      status: statusLabel(r.status),
    })),
  };
}

export function buildClassStudentsSheet(
  className: string,
  students: StudentExportRow[]
): ExportSheet {
  const sheet = buildStudentsSheet(students);
  return {
    ...sheet,
    title: `תלמידי כיתה ${className} (${students.length})`,
  };
}

const LISTS_SHEET = "Lists";
const IMPORT_COLUMNS = [
  { header: "כיתה", key: "className", width: 14 },
  { header: "מקצוע", key: "subjectName", width: 18 },
  { header: "מטלה", key: "obligationName", width: 28 },
  { header: "שם תלמיד", key: "studentName", width: 20 },
  { header: "ציון", key: "score", width: 10 },
  { header: "סטטוס", key: "status", width: 14 },
] as const;

export type GradesImportTemplateInput = {
  classes: string[];
  subjects: string[];
  obligations: string[];
  statuses: string[];
  students?: string[];
  prefilledClass?: string;
  prefilledSubject?: string;
  prefilledObligation?: string;
};

function writeListColumn(
  ws: ExcelJS.Worksheet,
  col: number,
  values: string[]
): string {
  values.forEach((value, i) => {
    ws.getCell(i + 1, col).value = value;
  });
  const colLetter = ws.getColumn(col).letter;
  return values.length > 0
    ? `${LISTS_SHEET}!$${colLetter}$1:$${colLetter}$${values.length}`
    : "";
}

function applyListValidation(
  ws: ExcelJS.Worksheet,
  columnLetter: string,
  firstDataRow: number,
  lastDataRow: number,
  range: string
) {
  if (!range) return;
  (ws as WorksheetWithValidations).dataValidations.add(
    `${columnLetter}${firstDataRow}:${columnLetter}${lastDataRow}`,
    {
    type: "list",
    allowBlank: true,
    formulae: [range],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "ערך לא תקין",
    error: "יש לבחור ערך מהרשימה",
    }
  );
}

export function buildObligationLabels(
  subjects: Array<{
    name: string;
    obligations: Array<{ name: string | null; questionnaireNumber: string | null }>;
  }>
): string[] {
  const labels = new Set<string>();
  for (const subject of subjects) {
    for (const ob of subject.obligations) {
      labels.add(obligationDisplayLabel(ob));
    }
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b, "he"));
}

export async function downloadGradesImportTemplate(
  filename: string,
  input: GradesImportTemplateInput
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bagrut Manager";
  workbook.created = new Date();

  const listsWs = workbook.addWorksheet(LISTS_SHEET);
  listsWs.state = "veryHidden";

  const classRange = writeListColumn(listsWs, 1, input.classes);
  const subjectRange = writeListColumn(listsWs, 2, input.subjects);
  const obligationRange = writeListColumn(listsWs, 3, input.obligations);
  const statusRange = writeListColumn(
    listsWs,
    4,
    input.statuses.length > 0
      ? input.statuses
      : SUBMISSION_STATUSES.map((s) => STATUS_LABELS[s].label)
  );
  const studentRange = writeListColumn(listsWs, 5, input.students ?? []);

  const title = input.students?.length
    ? `תבנית ייבוא ציונים — ${input.prefilledClass ?? "כיתה"} (${input.students.length} תלמידים)`
    : "תבנית ייבוא ציונים";

  const ws = workbook.addWorksheet("ייבוא ציונים", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }],
  });

  ws.mergeCells(1, 1, 1, IMPORT_COLUMNS.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEEF2FF" },
  };
  ws.getRow(1).height = 30;

  const headerRow = ws.getRow(2);
  IMPORT_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 24;

  const prefilledRows =
    input.students?.map((studentName) => ({
      className: input.prefilledClass ?? "",
      subjectName: input.prefilledSubject ?? "",
      obligationName: input.prefilledObligation ?? "",
      studentName,
      score: "",
      status: "",
    })) ?? [];

  const rowCount = Math.max(prefilledRows.length, 50);
  const dataStartRow = 3;

  for (let idx = 0; idx < rowCount; idx++) {
    const rowData = prefilledRows[idx];
    const excelRow = ws.getRow(dataStartRow + idx);
    IMPORT_COLUMNS.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      const val = rowData?.[col.key as keyof typeof rowData];
      cell.value = val === null || val === undefined ? "" : val;
      cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
      cell.border = THIN_BORDER;
      if (idx % 2 === 1) {
        cell.fill = ALT_ROW_FILL;
      }
    });
    excelRow.height = 20;
  }

  IMPORT_COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  const lastDataRow = dataStartRow + rowCount - 1;
  applyListValidation(ws, "A", dataStartRow, lastDataRow, classRange);
  applyListValidation(ws, "B", dataStartRow, lastDataRow, subjectRange);
  applyListValidation(ws, "C", dataStartRow, lastDataRow, obligationRange);
  if (studentRange) {
    applyListValidation(ws, "D", dataStartRow, lastDataRow, studentRange);
  }
  applyListValidation(ws, "F", dataStartRow, lastDataRow, statusRange);

  (ws as WorksheetWithValidations).dataValidations.add(
    `E${dataStartRow}:E${lastDataRow}`,
    {
      type: "decimal",
      operator: "between",
      allowBlank: true,
      formulae: [0, 100],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "ציון לא תקין",
      error: "הציון חייב להיות בין 0 ל-100",
    }
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
