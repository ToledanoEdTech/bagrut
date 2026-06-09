import ExcelJS from "exceljs";
import { STATUS_LABELS } from "@/lib/grade-status";
import type { SubmissionStatus } from "@/lib/types";

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
      name: s.name,
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
        subject: s.name,
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
        subject: subject.name,
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
