import ExcelJS from "exceljs";
import { Timestamp, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { resolveBagrutEligibilitySettings } from "@/lib/bagrut-eligibility";
import { obligationDisplayLabel } from "@/lib/grade-components";
import { STATUS_LABELS } from "@/lib/grade-status";
import {
  ACTIVITY_CATEGORY_LABELS,
  type ActivityAction,
  type ActivityCategory,
  type ActivityEntityType,
  type ActivityEvent,
} from "@/lib/activity-log-types";
import { deduplicateObligations, getStudentTrackIds, resolveStaffPermissions } from "@/lib/firestore";
import { getGeneralSettings, type GeneralSettings } from "@/lib/firestore/settings";
import { formatQualitativeLevel } from "@/lib/social-involvement";
import type {
  Class,
  ExamPath,
  ExamPathType,
  Grade,
  Obligation,
  ObligationClassGradeYearOverride,
  Role,
  StaffPermission,
  StaffRecord,
  Student,
  Subject,
  SubjectCategory,
  SubmissionStatus,
  Track,
  UserProfile,
} from "@/lib/types";

const COLOR = {
  primary: "FF4338CA",
  primaryDark: "FF312E81",
  primaryLight: "FFEEF2FF",
  slate900: "FF0F172A",
  slate700: "FF334155",
  slate500: "FF64748B",
  slate200: "FFE2E8F0",
  slate50: "FFF8FAFC",
  white: "FFFFFFFF",
  success: "FF065F46",
  successBg: "FFD1FAE5",
  danger: "FF991B1B",
  dangerBg: "FFFEE2E2",
  warning: "FF92400E",
  warningBg: "FFFEF3C7",
  info: "FF1E40AF",
  infoBg: "FFDBEAFE",
};

const TAB = {
  cover: "FF4338CA",
  people: "FF4338CA",
  curriculum: "FF1E40AF",
  grades: "FF065F46",
  admin: "FF92400E",
  log: "FF334155",
};

const PATH_TYPE_LABELS: Record<ExamPathType, string> = {
  REGULAR: "רגילה",
  BEIT_MIDRASH: "בית מדרש",
  MEUBAR_HINUCH: 'מב"ר / חנ"מ',
};

const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  MANDATORY: "חובה",
  MATH: "מתמטיקה",
  ENGLISH: "אנגלית",
  TRACK: "מגמה",
  EXTENSION: "הרחבה",
  SOCIAL: "מעורבות חברתית",
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "מנהל",
  TEACHER: "מורה",
  STUDENT: "תלמיד",
};

const ACTION_LABELS: Record<ActivityAction, string> = {
  "grade.upsert": "עדכון ציון",
  "grade.bulk": "עדכון ציונים מרוכז",
  "grade.import": "ייבוא ציונים",
  "subject.create": "יצירת מקצוע",
  "subject.update": "עדכון מקצוע",
  "subject.delete": "מחיקת מקצוע",
  "obligation.create": "יצירת מטלה",
  "obligation.update": "עדכון מטלה",
  "obligation.delete": "מחיקת מטלה",
  "obligation.gradeYearOverride.create": "יצירת חריג שכבה",
  "obligation.gradeYearOverride.update": "עדכון חריג שכבה",
  "obligation.gradeYearOverride.delete": "מחיקת חריג שכבה",
  "staff.create": "הוספת איש צוות",
  "staff.update": "עדכון איש צוות",
  "staff.delete": "הסרת איש צוות",
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  grade: "ציון",
  subject: "מקצוע",
  obligation: "מטלה",
  staff: "איש צוות",
  system: "מערכת",
};

type Cell = string | number | null | undefined;

type Column = {
  header: string;
  key: string;
  width?: number;
  wrap?: boolean;
  kind?: "text" | "number" | "status";
};

type Row = Record<string, Cell>;

type TableSpec = {
  name: string;
  title: string;
  description: string;
  tabColor: string;
  columns: Column[];
  rows: Row[];
};

type SheetStat = {
  name: string;
  count: number;
  description: string;
};

type ExportActor = {
  name: string;
  email: string;
};

type ObligationHit = {
  subject: Subject;
  obligation: Obligation;
};

type ExportContext = {
  exportedAt: Date;
  actor: ExportActor | null;
  students: Student[];
  classes: Class[];
  tracks: Track[];
  paths: ExamPath[];
  subjects: Subject[];
  grades: Grade[];
  staff: StaffRecord[];
  overrides: ObligationClassGradeYearOverride[];
  users: UserProfile[];
  settings: GeneralSettings;
  activity: ActivityEvent[];
  classById: Map<string, Class>;
  trackById: Map<string, Track>;
  pathById: Map<string, ExamPath>;
  staffById: Map<string, StaffRecord>;
  studentById: Map<string, Student>;
  obligationById: Map<string, ObligationHit>;
  studentsInClass: Map<string, number>;
};

const fillOf = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLOR.slate200 } },
  left: { style: "thin", color: { argb: COLOR.slate200 } },
  bottom: { style: "thin", color: { argb: COLOR.slate200 } },
  right: { style: "thin", color: { argb: COLOR.slate200 } },
};

function formatIsrael(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "UTC",
    dateStyle: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function asTextDate(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return formatDateOnly(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatIsrael(date);
  }
  if (value instanceof Date) return formatIsrael(value);
  if (value instanceof Timestamp) return formatIsrael(value.toDate());
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return formatIsrael((value as { toDate: () => Date }).toDate());
  }
  return "—";
}

function text(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : "—";
}

function yesNo(value: boolean): string {
  return value ? "כן" : "לא";
}

function categoryLabel(category: string | null | undefined): string {
  if (!category) return "—";
  return CATEGORY_LABELS[category as SubjectCategory] ?? category;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (status in STATUS_LABELS) return STATUS_LABELS[status as SubmissionStatus].label;
  return status;
}

function statusFill(label: string): { bg: string; fg: string } | null {
  if (label === "נבדק") return { bg: COLOR.successBg, fg: COLOR.success };
  if (label === "חסר ציון" || label === "לא עבר") return { bg: COLOR.dangerBg, fg: COLOR.danger };
  if (label === "בתהליך" || label === "הוגש") return { bg: COLOR.warningBg, fg: COLOR.warning };
  if (label === "פטור") return { bg: COLOR.slate50, fg: COLOR.slate700 };
  if (label === "לא התחיל") return { bg: COLOR.infoBg, fg: COLOR.info };
  return null;
}

function compareHe(a: string, b: string): number {
  return a.localeCompare(b, "he");
}

function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function safeSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "גיליון";
  let candidate = cleaned;
  let counter = 2;
  while (used.has(candidate)) {
    const suffix = ` ${counter}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function scopeLabel(
  perm: StaffPermission,
  classNames: Map<string, string>,
  subjectNames: Map<string, string>
): string {
  switch (perm.scope) {
    case "all":
      return "כל המערכת";
    case "gradeYear":
      return `שכבה ${perm.gradeYear}`;
    case "class":
      return classNames.get(perm.classId) ?? perm.classId;
    case "subject":
      return subjectNames.get(perm.subjectId) ?? perm.subjectId;
    default: {
      const unknown: never = perm;
      return String(unknown);
    }
  }
}

function permissionText(
  member: StaffRecord,
  classNames: Map<string, string>,
  subjectNames: Map<string, string>
): string {
  if (member.role === "ADMIN") return "מנהל — הרשאות מלאות";
  const perms = resolveStaffPermissions(member) ?? [];
  if (!perms.length) return "ללא הרשאות מוגדרות";
  const lines = perms
    .map((perm) => {
      const action =
        perm.action === "grades:write"
          ? "עריכת ציונים"
          : perm.action === "students:view"
            ? "צפייה בתלמידים"
            : "עריכת תלמידים";
      return `${action}: ${scopeLabel(perm, classNames, subjectNames)}`;
    })
    .join("\n");
  if (member.role === "TEACHER" && member.permissions === undefined) {
    return `הרשאות ברירת מחדל למורה ותיק\n${lines}`;
  }
  return lines;
}

function metaText(meta: Record<string, unknown> | undefined): string {
  if (!meta || Object.keys(meta).length === 0) return "—";
  try {
    const raw = JSON.stringify(meta);
    return raw.length > 4000 ? `${raw.slice(0, 4000)}…` : raw;
  } catch {
    return "—";
  }
}

function recordEntries(
  value: Record<string | number, number | null> | null | undefined
): Array<[number, number | null]> {
  if (!value) return [];
  return Object.entries(value)
    .map(([key, score]) => [Number(key), score] as [number, number | null])
    .filter(([key]) => !Number.isNaN(key))
    .sort((a, b) => a[0] - b[0]);
}

function docsOf<T>(snap: FirebaseFirestore.QuerySnapshot): T[] {
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
}

async function loadActivity(): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  let last: QueryDocumentSnapshot | null = null;

  for (;;) {
    let query: Query = adminDb.collection("activityLog").orderBy("at", "desc").limit(500);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data();
      events.push({
        id: doc.id,
        at: asTextDate(data.at),
        actorUid: String(data.actorUid ?? ""),
        actorEmail: String(data.actorEmail ?? ""),
        actorName: String(data.actorName ?? ""),
        action: data.action as ActivityAction,
        category: (data.category as ActivityCategory) ?? "other",
        entityType: (data.entityType as ActivityEntityType) ?? "system",
        entityId: String(data.entityId ?? ""),
        summaryHe: String(data.summaryHe ?? ""),
        meta:
          data.meta && typeof data.meta === "object"
            ? (data.meta as Record<string, unknown>)
            : undefined,
      });
    }

    last = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.size < 500 || !last) break;
  }

  return events;
}

async function loadExportContext(actor: ExportActor | null): Promise<ExportContext> {
  const [
    studentSnap,
    classSnap,
    trackSnap,
    pathSnap,
    subjectSnap,
    gradeSnap,
    staffSnap,
    overrideSnap,
    userSnap,
    settings,
    activity,
  ] = await Promise.all([
    adminDb.collection("students").get(),
    adminDb.collection("classes").get(),
    adminDb.collection("tracks").get(),
    adminDb.collection("examPaths").get(),
    adminDb.collection("subjects").get(),
    adminDb.collection("grades").get(),
    adminDb.collection("staff").get(),
    adminDb.collection("obligationGradeYearOverrides").get(),
    adminDb.collection("users").get(),
    getGeneralSettings(),
    loadActivity(),
  ]);

  const students = docsOf<Student>(studentSnap);
  const classes = docsOf<Class>(classSnap);
  const tracks = docsOf<Track>(trackSnap);
  const paths = docsOf<ExamPath>(pathSnap);
  const subjects = subjectSnap.docs.map((doc) => {
    const data = doc.data() as Omit<Subject, "id">;
    const { obligations } = deduplicateObligations(data.obligations ?? []);
    return { ...data, id: doc.id, obligations };
  });
  const grades = docsOf<Grade>(gradeSnap);
  const staff = docsOf<StaffRecord>(staffSnap);
  const overrides = docsOf<ObligationClassGradeYearOverride>(overrideSnap);
  const users = userSnap.docs.map((doc) => {
    const data = doc.data() as UserProfile;
    return { ...data, uid: data.uid || doc.id };
  });

  const obligationById = new Map<string, ObligationHit>();
  for (const subject of subjects) {
    for (const obligation of subject.obligations ?? []) {
      if (!obligationById.has(obligation.id)) {
        obligationById.set(obligation.id, { subject, obligation });
      }
    }
  }

  const studentsInClass = new Map<string, number>();
  for (const student of students) {
    if (!student.classId) continue;
    studentsInClass.set(student.classId, (studentsInClass.get(student.classId) ?? 0) + 1);
  }

  return {
    exportedAt: new Date(),
    actor,
    students,
    classes,
    tracks,
    paths,
    subjects,
    grades,
    staff,
    overrides,
    users,
    settings,
    activity,
    classById: new Map(classes.map((item) => [item.id, item])),
    trackById: new Map(tracks.map((item) => [item.id, item])),
    pathById: new Map(paths.map((item) => [item.id, item])),
    staffById: new Map(staff.map((item) => [item.id, item])),
    studentById: new Map(students.map((item) => [item.id, item])),
    obligationById,
    studentsInClass,
  };
}

function classOf(ctx: ExportContext, classId: string | null | undefined): Class | null {
  if (!classId) return null;
  return ctx.classById.get(classId) ?? null;
}

function pathOfClass(ctx: ExportContext, cls: Class | null): ExamPath | null {
  if (!cls?.examPathId) return null;
  return ctx.pathById.get(cls.examPathId) ?? null;
}

function trackNames(ctx: ExportContext, student: Student): string[] {
  return getStudentTrackIds(student)
    .map((id) => ctx.trackById.get(id)?.name ?? id)
    .filter(Boolean);
}

function studentName(ctx: ExportContext, studentId: string): string {
  return ctx.studentById.get(studentId)?.name ?? "תלמיד שנמחק";
}

function hitOf(ctx: ExportContext, obligationId: string): ObligationHit | null {
  return ctx.obligationById.get(obligationId) ?? null;
}

function componentName(obligation: Obligation | undefined, sortOrder: number): string {
  return obligation?.components?.find((item) => item.sortOrder === sortOrder)?.name ?? `רכיב ${sortOrder}`;
}

function subItemName(obligation: Obligation | undefined, sortOrder: number): string {
  return obligation?.subItems?.find((item) => item.sortOrder === sortOrder)?.name ?? `תת-מטלה ${sortOrder}`;
}

function sortedStudents(ctx: ExportContext): Student[] {
  return [...ctx.students].sort((a, b) => compareHe(a.name ?? "", b.name ?? ""));
}

function sortedSubjects(ctx: ExportContext): Subject[] {
  return [...ctx.subjects].sort((a, b) => compareHe(a.name ?? "", b.name ?? ""));
}

function mandatoryLabel(ctx: ExportContext, student: Student): string {
  if (student.mandatorySubjectIds == null) return "כל מקצועות החובה במסלול";
  if (student.mandatorySubjectIds.length === 0) return "ללא מקצועות חובה";
  return student.mandatorySubjectIds
    .map((id) => ctx.subjects.find((subject) => subject.id === id)?.name ?? id)
    .join(", ");
}

function studentsTable(ctx: ExportContext): TableSpec {
  return {
    name: "תלמידים",
    title: "תלמידים",
    description: "שם, כיתה, מסלול, מגמות, יחידות ומקצועות חובה",
    tabColor: TAB.people,
    columns: [
      { header: "שם", key: "name", width: 24 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "שכבה", key: "gradeYear", width: 12 },
      { header: "כיתה", key: "className", width: 18 },
      { header: "מסלול", key: "path", width: 24 },
      { header: "מגמות", key: "tracks", width: 28 },
      { header: 'מתמטיקה (יח"ל)', key: "math", width: 16, kind: "number" },
      { header: 'אנגלית (יח"ל)', key: "english", width: 16, kind: "number" },
      { header: "הרחבות", key: "extensions", width: 24, wrap: true },
      { header: "מקצועות חובה", key: "mandatory", width: 36, wrap: true },
      { header: "מזהה תלמיד", key: "id", width: 24 },
      { header: "מזהה משתמש", key: "uid", width: 24 },
    ],
    rows: sortedStudents(ctx).map((student) => {
      const cls = classOf(ctx, student.classId);
      return {
        name: text(student.name),
        email: text(student.email),
        gradeYear: text(cls?.gradeYear),
        className: text(cls?.name),
        path: text(pathOfClass(ctx, cls)?.label),
        tracks: text(trackNames(ctx, student).join(", ")),
        math: student.mathUnits ?? null,
        english: student.englishUnits ?? null,
        extensions: text(student.extensions),
        mandatory: mandatoryLabel(ctx, student),
        id: student.id,
        uid: text(student.uid),
      };
    }),
  };
}

function studentTracksTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const student of sortedStudents(ctx)) {
    const ids = getStudentTrackIds(student);
    for (const trackId of ids) {
      const track = ctx.trackById.get(trackId);
      rows.push({
        student: text(student.name),
        email: text(student.email),
        track: text(track?.name ?? trackId),
        units: track?.units ?? null,
        studentId: student.id,
        trackId,
      });
    }
  }
  rows.sort((a, b) => compareHe(String(a.student), String(b.student)) || compareHe(String(a.track), String(b.track)));
  return {
    name: "מגמות תלמיד",
    title: "שיוך תלמידים למגמות",
    description: "שורה לכל מגמה שמשויכת לתלמיד",
    tabColor: TAB.people,
    columns: [
      { header: "תלמיד", key: "student", width: 24 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "מגמה", key: "track", width: 24 },
      { header: 'יח"ל', key: "units", width: 12, kind: "number" },
      { header: "מזהה תלמיד", key: "studentId", width: 24 },
      { header: "מזהה מגמה", key: "trackId", width: 24 },
    ],
    rows,
  };
}

function mandatorySubjectsTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const student of sortedStudents(ctx)) {
    if (student.mandatorySubjectIds == null) continue;
    if (student.mandatorySubjectIds.length === 0) {
      rows.push({
        student: text(student.name),
        subject: "ללא מקצועות חובה",
        studentId: student.id,
        subjectId: "—",
      });
      continue;
    }
    for (const subjectId of student.mandatorySubjectIds) {
      rows.push({
        student: text(student.name),
        subject: text(ctx.subjects.find((subject) => subject.id === subjectId)?.name ?? subjectId),
        studentId: student.id,
        subjectId,
      });
    }
  }
  return {
    name: "מקצועות חובה",
    title: "בחירת מקצועות חובה",
    description: "רק תלמידים עם בחירה מפורשת. בלי בחירה — כל מקצועות החובה במסלול",
    tabColor: TAB.people,
    columns: [
      { header: "תלמיד", key: "student", width: 24 },
      { header: "מקצוע", key: "subject", width: 28 },
      { header: "מזהה תלמיד", key: "studentId", width: 24 },
      { header: "מזהה מקצוע", key: "subjectId", width: 24 },
    ],
    rows,
  };
}

function classesTable(ctx: ExportContext): TableSpec {
  const rows = [...ctx.classes]
    .sort((a, b) => compareHe(a.name ?? "", b.name ?? ""))
    .map((cls) => {
      const path = pathOfClass(ctx, cls);
      const teacher = cls.homeroomTeacherId ? ctx.staffById.get(cls.homeroomTeacherId) : null;
      return {
        name: text(cls.name),
        gradeYear: text(cls.gradeYear),
        path: text(path?.label),
        pathType: path ? PATH_TYPE_LABELS[path.pathType] ?? path.pathType : "—",
        teacher: text(teacher?.name),
        teacherEmail: text(teacher?.email),
        students: ctx.studentsInClass.get(cls.id) ?? 0,
        id: cls.id,
        pathId: text(cls.examPathId),
        teacherId: text(cls.homeroomTeacherId),
      };
    });
  return {
    name: "כיתות",
    title: "כיתות",
    description: "שכבה, מסלול בגרות, מחנך ומספר תלמידים",
    tabColor: TAB.curriculum,
    columns: [
      { header: "כיתה", key: "name", width: 18 },
      { header: "שכבה", key: "gradeYear", width: 12 },
      { header: "מסלול", key: "path", width: 24 },
      { header: "סוג מסלול", key: "pathType", width: 18 },
      { header: "מחנך", key: "teacher", width: 22 },
      { header: "אימייל מחנך", key: "teacherEmail", width: 32 },
      { header: "תלמידים", key: "students", width: 12, kind: "number" },
      { header: "מזהה כיתה", key: "id", width: 24 },
      { header: "מזהה מסלול", key: "pathId", width: 24 },
      { header: "מזהה מחנך", key: "teacherId", width: 24 },
    ],
    rows,
  };
}

function tracksTable(ctx: ExportContext): TableSpec {
  return {
    name: "מגמות",
    title: "מגמות",
    description: "שם המגמה ומספר יחידות הלימוד",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מגמה", key: "name", width: 28 },
      { header: 'יח"ל', key: "units", width: 12, kind: "number" },
      { header: "מזהה", key: "id", width: 24 },
    ],
    rows: [...ctx.tracks]
      .sort((a, b) => compareHe(a.name ?? "", b.name ?? ""))
      .map((track) => ({
        name: text(track.name),
        units: track.units ?? null,
        id: track.id,
      })),
  };
}

function pathsTable(ctx: ExportContext): TableSpec {
  return {
    name: "מסלולים",
    title: "מסלולי בגרות",
    description: "סוג המסלול, תיאור ומספר המקצועות המשויכים",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מסלול", key: "label", width: 28 },
      { header: "מפתח", key: "key", width: 18 },
      { header: "סוג", key: "type", width: 18 },
      { header: "תיאור", key: "description", width: 40, wrap: true },
      { header: "מקצועות", key: "subjects", width: 12, kind: "number" },
      { header: "מזהה", key: "id", width: 24 },
    ],
    rows: [...ctx.paths]
      .sort((a, b) => compareHe(a.label ?? "", b.label ?? ""))
      .map((path) => ({
        label: text(path.label),
        key: text(path.key),
        type: PATH_TYPE_LABELS[path.pathType] ?? path.pathType ?? "—",
        description: text(path.description),
        subjects: path.subjectIds?.length ?? 0,
        id: path.id,
      })),
  };
}

function pathSubjectsTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  const paths = [...ctx.paths].sort((a, b) => compareHe(a.label ?? "", b.label ?? ""));
  for (const path of paths) {
    for (const subjectId of path.subjectIds ?? []) {
      const subject = ctx.subjects.find((item) => item.id === subjectId);
      rows.push({
        path: text(path.label),
        subject: text(subject?.name ?? subjectId),
        category: categoryLabel(subject?.category),
        units: subject?.units ?? null,
        pathId: path.id,
        subjectId,
      });
    }
  }
  return {
    name: "מקצועות במסלול",
    title: "מקצועות לפי מסלול",
    description: "שורה לכל מקצוע שמשויך למסלול בגרות",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מסלול", key: "path", width: 28 },
      { header: "מקצוע", key: "subject", width: 28 },
      { header: "קטגוריה", key: "category", width: 18 },
      { header: 'יח"ל', key: "units", width: 12, kind: "number" },
      { header: "מזהה מסלול", key: "pathId", width: 24 },
      { header: "מזהה מקצוע", key: "subjectId", width: 24 },
    ],
    rows,
  };
}

function subjectsTable(ctx: ExportContext): TableSpec {
  return {
    name: "מקצועות",
    title: "מקצועות",
    description: "קטגוריה, יחידות, מורה ומשקל המטלות",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מקצוע", key: "name", width: 28 },
      { header: "קטגוריה", key: "category", width: 18 },
      { header: 'יח"ל', key: "units", width: 12, kind: "number" },
      { header: "מגמה", key: "track", width: 22 },
      { header: "מורה", key: "teacher", width: 22 },
      { header: "מטלות", key: "obligations", width: 12, kind: "number" },
      { header: "משקל כולל (%)", key: "weight", width: 16, kind: "number" },
      { header: "מזהה", key: "id", width: 24 },
    ],
    rows: sortedSubjects(ctx).map((subject) => {
      const teacher = subject.teacherId ? ctx.staffById.get(subject.teacherId) : null;
      const track = subject.trackId ? ctx.trackById.get(subject.trackId) : null;
      return {
        name: text(subject.name),
        category: categoryLabel(subject.category),
        units: subject.units ?? null,
        track: text(track?.name),
        teacher: text(teacher?.name),
        obligations: subject.obligations?.length ?? 0,
        weight: (subject.obligations ?? []).reduce((sum, item) => sum + (item.weightPercent ?? 0), 0),
        id: subject.id,
      };
    }),
  };
}

function obligationRows(ctx: ExportContext): Array<{ subject: Subject; obligation: Obligation }> {
  const rows: Array<{ subject: Subject; obligation: Obligation }> = [];
  for (const subject of sortedSubjects(ctx)) {
    const obligations = [...(subject.obligations ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    for (const obligation of obligations) rows.push({ subject, obligation });
  }
  return rows;
}

function obligationsTable(ctx: ExportContext): TableSpec {
  return {
    name: "מטלות",
    title: "מטלות ושאלונים",
    description: "כל מטלה ושאלה: מספר שאלון, משקל, סוג היבחנות, מועד ושכבה",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מקצוע", key: "subject", width: 24 },
      { header: "מטלה", key: "name", width: 28 },
      { header: "מספר שאלון", key: "questionnaire", width: 16 },
      { header: "משקל (%)", key: "weight", width: 12, kind: "number" },
      { header: "סוג היבחנות", key: "examType", width: 16 },
      { header: "חומר לימוד", key: "material", width: 36, wrap: true },
      { header: "אירוע", key: "event", width: 18 },
      { header: "שכבה", key: "gradeYear", width: 12 },
      { header: "תאריך אחרון להזנה", key: "due", width: 20 },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "רכיבים", key: "components", width: 12, kind: "number" },
      { header: "תת-מטלות", key: "subItems", width: 12, kind: "number" },
      { header: "מזהה מטלה", key: "id", width: 24 },
      { header: "מזהה מקצוע", key: "subjectId", width: 24 },
    ],
    rows: obligationRows(ctx).map(({ subject, obligation }) => ({
      subject: text(subject.name),
      name: text(obligation.name ?? obligation.examEvent),
      questionnaire: text(obligation.questionnaireNumber),
      weight: obligation.weightPercent ?? null,
      examType: text(obligation.examType),
      material: text(obligation.studyMaterial),
      event: text(obligation.examEvent),
      gradeYear: text(obligation.gradeYear),
      due: asTextDate(obligation.gradeEntryDueDate),
      sort: obligation.sortOrder ?? null,
      components: obligation.components?.length ?? 0,
      subItems: obligation.subItems?.length ?? 0,
      id: obligation.id,
      subjectId: subject.id,
    })),
  };
}

function componentsTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const { subject, obligation } of obligationRows(ctx)) {
    const components = [...(obligation.components ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    for (const component of components) {
      rows.push({
        subject: text(subject.name),
        obligation: obligationDisplayLabel(obligation),
        questionnaire: text(obligation.questionnaireNumber),
        name: text(component.name),
        weight: component.weightPercent ?? null,
        sort: component.sortOrder ?? null,
        obligationId: obligation.id,
      });
    }
  }
  return {
    name: "רכיבי מטלה",
    title: "רכיבי שקלול",
    description: "החלקים הפנימיים של מטלה ואחוז המשקל של כל רכיב",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מקצוע", key: "subject", width: 24 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "רכיב", key: "name", width: 24 },
      { header: "משקל (%)", key: "weight", width: 12, kind: "number" },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "מזהה מטלה", key: "obligationId", width: 24 },
    ],
    rows,
  };
}

function subItemsTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const { subject, obligation } of obligationRows(ctx)) {
    const subItems = [...(obligation.subItems ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    for (const subItem of subItems) {
      rows.push({
        subject: text(subject.name),
        obligation: obligationDisplayLabel(obligation),
        questionnaire: text(obligation.questionnaireNumber),
        name: text(subItem.name),
        weight: subItem.weightPercent ?? null,
        sort: subItem.sortOrder ?? null,
        gradeYear: text(subItem.gradeYear),
        due: asTextDate(subItem.gradeEntryDueDate),
        obligationId: obligation.id,
      });
    }
  }
  return {
    name: "תת-מטלות",
    title: "תת-מטלות",
    description: "עבודות בתוך מטלה, כולל שכבה ותאריך הזנה כשהוגדרו",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מקצוע", key: "subject", width: 24 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "תת-מטלה", key: "name", width: 24 },
      { header: "משקל (%)", key: "weight", width: 12, kind: "number" },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "שכבה", key: "gradeYear", width: 12 },
      { header: "תאריך הזנה", key: "due", width: 18 },
      { header: "מזהה מטלה", key: "obligationId", width: 24 },
    ],
    rows,
  };
}

function gradeBase(ctx: ExportContext, grade: Grade) {
  const student = ctx.studentById.get(grade.studentId);
  const cls = classOf(ctx, student?.classId);
  const hit = hitOf(ctx, grade.obligationId);
  return {
    student: studentName(ctx, grade.studentId),
    email: text(student?.email),
    className: text(cls?.name),
    gradeYear: text(cls?.gradeYear),
    subject: text(hit?.subject.name),
    obligation: hit ? obligationDisplayLabel(hit.obligation) : "מטלה שנמחקה",
    questionnaire: text(hit?.obligation.questionnaireNumber),
  };
}

function gradesTable(ctx: ExportContext): TableSpec {
  const rows = [...ctx.grades]
    .map((grade) => {
      const base = gradeBase(ctx, grade);
      return {
        ...base,
        score: grade.score ?? null,
        qualitative: text(formatQualitativeLevel(grade.qualitativeLevel)),
        status: statusLabel(grade.status),
        notes: text(grade.notes),
        id: grade.id,
        studentId: grade.studentId,
        obligationId: grade.obligationId,
        sortName: base.student,
        sortSubject: base.subject,
      };
    })
    .sort(
      (a, b) =>
        compareHe(String(a.sortName), String(b.sortName)) ||
        compareHe(String(a.sortSubject), String(b.sortSubject)) ||
        compareHe(String(a.obligation), String(b.obligation))
    )
    .map(({ sortName: _name, sortSubject: _subject, ...row }) => row);

  return {
    name: "ציונים",
    title: "ציונים",
    description: "כל הזנת ציון: ציון מספרי או הערכה, סטטוס והערות",
    tabColor: TAB.grades,
    columns: [
      { header: "תלמיד", key: "student", width: 22 },
      { header: "אימייל", key: "email", width: 30 },
      { header: "כיתה", key: "className", width: 16 },
      { header: "שכבה", key: "gradeYear", width: 12 },
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "ציון", key: "score", width: 10, kind: "number" },
      { header: "הערכה", key: "qualitative", width: 18 },
      { header: "סטטוס", key: "status", width: 14, kind: "status" },
      { header: "הערות", key: "notes", width: 32, wrap: true },
      { header: "מזהה ציון", key: "id", width: 24 },
      { header: "מזהה תלמיד", key: "studentId", width: 24 },
      { header: "מזהה מטלה", key: "obligationId", width: 24 },
    ],
    rows,
  };
}

function componentScoresTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const grade of ctx.grades) {
    const hit = hitOf(ctx, grade.obligationId);
    for (const [sortOrder, score] of recordEntries(grade.componentScores)) {
      rows.push({
        ...gradeBase(ctx, grade),
        component: componentName(hit?.obligation, sortOrder),
        sort: sortOrder,
        score,
      });
    }
  }
  return {
    name: "ציוני רכיבים",
    title: "ציוני רכיבים",
    description: "ציון שהוזן לכל רכיב שקלול בתוך מטלה",
    tabColor: TAB.grades,
    columns: [
      { header: "תלמיד", key: "student", width: 22 },
      { header: "כיתה", key: "className", width: 16 },
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "רכיב", key: "component", width: 22 },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "ציון", key: "score", width: 10, kind: "number" },
    ],
    rows,
  };
}

function subItemScoresTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const grade of ctx.grades) {
    const hit = hitOf(ctx, grade.obligationId);
    for (const [sortOrder, score] of recordEntries(grade.subItemScores)) {
      rows.push({
        ...gradeBase(ctx, grade),
        subItem: subItemName(hit?.obligation, sortOrder),
        sort: sortOrder,
        score,
      });
    }
  }
  return {
    name: "ציוני תת-מטלות",
    title: "ציוני תת-מטלות",
    description: "ציון שהוזן לכל תת-מטלה",
    tabColor: TAB.grades,
    columns: [
      { header: "תלמיד", key: "student", width: 22 },
      { header: "כיתה", key: "className", width: 16 },
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "תת-מטלה", key: "subItem", width: 22 },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "ציון", key: "score", width: 10, kind: "number" },
    ],
    rows,
  };
}

function weightOverridesTable(ctx: ExportContext): TableSpec {
  const rows: Row[] = [];
  for (const grade of ctx.grades) {
    const hit = hitOf(ctx, grade.obligationId);
    const base = gradeBase(ctx, grade);
    for (const [sortOrder, weight] of recordEntries(grade.componentWeightOverrides)) {
      const defined = hit?.obligation.components?.find((item) => item.sortOrder === sortOrder);
      rows.push({
        ...base,
        kind: "רכיב",
        item: componentName(hit?.obligation, sortOrder),
        sort: sortOrder,
        defaultWeight: defined?.weightPercent ?? null,
        weight,
      });
    }
    for (const [sortOrder, weight] of recordEntries(grade.subItemWeightOverrides)) {
      const defined = hit?.obligation.subItems?.find((item) => item.sortOrder === sortOrder);
      rows.push({
        ...base,
        kind: "תת-מטלה",
        item: subItemName(hit?.obligation, sortOrder),
        sort: sortOrder,
        defaultWeight: defined?.weightPercent ?? null,
        weight,
      });
    }
  }
  return {
    name: "שקלול חריג",
    title: "שקלול ששונה בהזנה",
    description: "אחוזי משקל ששונו עבור תלמיד מסוים, בלי לשנות את הגדרת המטלה",
    tabColor: TAB.grades,
    columns: [
      { header: "תלמיד", key: "student", width: 22 },
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "סוג", key: "kind", width: 14 },
      { header: "פריט", key: "item", width: 22 },
      { header: "סדר", key: "sort", width: 10, kind: "number" },
      { header: "משקל מקורי (%)", key: "defaultWeight", width: 16, kind: "number" },
      { header: "משקל בפועל (%)", key: "weight", width: 16, kind: "number" },
    ],
    rows,
  };
}

function overridesTable(ctx: ExportContext): TableSpec {
  const rows = ctx.overrides.map((override) => {
    const hit = hitOf(ctx, override.obligationId);
    const subItem =
      override.subItemSortOrder == null
        ? "המטלה כולה"
        : subItemName(hit?.obligation, override.subItemSortOrder);
    return {
      subject: text(hit?.subject.name),
      obligation: hit ? obligationDisplayLabel(hit.obligation) : "מטלה שנמחקה",
      questionnaire: text(hit?.obligation.questionnaireNumber),
      subItem,
      classes: text(
        (override.classIds ?? []).map((id) => ctx.classById.get(id)?.name ?? id).join(", ")
      ),
      gradeYear: text(override.effectiveGradeYear),
      note: text(override.note),
      created: asTextDate(override.createdAt),
      updated: asTextDate(override.updatedAt),
      id: override.id,
      obligationId: override.obligationId,
    };
  });
  rows.sort(
    (a, b) => compareHe(String(a.subject), String(b.subject)) || compareHe(String(a.obligation), String(b.obligation))
  );
  return {
    name: "חריגי שכבה",
    title: "חריגי שכבת היבחנות",
    description: "כיתות שניגשות למטלה או לתת-מטלה בשכבה שונה מברירת המחדל",
    tabColor: TAB.curriculum,
    columns: [
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "היקף", key: "subItem", width: 22 },
      { header: "כיתות", key: "classes", width: 28, wrap: true },
      { header: "שכבה בפועל", key: "gradeYear", width: 14 },
      { header: "הערה", key: "note", width: 28, wrap: true },
      { header: "נוצר", key: "created", width: 18 },
      { header: "עודכן", key: "updated", width: 18 },
      { header: "מזהה", key: "id", width: 24 },
    ],
    rows,
  };
}

function staffTable(ctx: ExportContext): TableSpec {
  const classNames = new Map(ctx.classes.map((cls) => [cls.id, cls.name]));
  const subjectNames = new Map(ctx.subjects.map((subject) => [subject.id, subject.name]));
  return {
    name: "צוות",
    title: "צוות",
    description: "מנהלים ומורים, תפקיד, הרשאות וקבלת תזכורות",
    tabColor: TAB.admin,
    columns: [
      { header: "שם", key: "name", width: 24 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "תפקיד", key: "role", width: 14 },
      { header: "הרשאות", key: "permissions", width: 42, wrap: true },
      { header: "מקבל תזכורות", key: "reminders", width: 16 },
      { header: "נוצר", key: "created", width: 18 },
      { header: "מזהה", key: "id", width: 24 },
    ],
    rows: [...ctx.staff]
      .sort((a, b) => compareHe(a.name ?? "", b.name ?? ""))
      .map((member) => ({
        name: text(member.name),
        email: text(member.email),
        role: ROLE_LABELS[member.role] ?? member.role,
        permissions: permissionText(member, classNames, subjectNames),
        reminders: yesNo(!member.gradeReminderOptOut),
        created: asTextDate(member.createdAt),
        id: member.id,
      })),
  };
}

function usersTable(ctx: ExportContext): TableSpec {
  return {
    name: "משתמשים",
    title: "משתמשי התחברות",
    description: "חשבונות שמחוברים למערכת והתפקיד שלהם",
    tabColor: TAB.admin,
    columns: [
      { header: "שם", key: "name", width: 24 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "תפקיד", key: "role", width: 14 },
      { header: "תלמיד מקושר", key: "student", width: 24 },
      { header: "יש תמונה", key: "photo", width: 12 },
      { header: "מזהה משתמש", key: "uid", width: 28 },
      { header: "מזהה תלמיד", key: "studentId", width: 24 },
    ],
    rows: [...ctx.users]
      .sort((a, b) => compareHe(a.name ?? "", b.name ?? ""))
      .map((user) => ({
        name: text(user.name),
        email: text(user.email),
        role: ROLE_LABELS[user.role] ?? text(user.role),
        student: user.studentId ? studentName(ctx, user.studentId) : "—",
        photo: yesNo(Boolean(user.photoURL)),
        uid: text(user.uid),
        studentId: text(user.studentId),
      })),
  };
}

function settingsTable(ctx: ExportContext): TableSpec {
  const reminders = ctx.settings.gradeReminders ?? {};
  const promotion = ctx.settings.classPromotion ?? {};
  const storedEligibility = ctx.settings.bagrutEligibility ?? {};
  const eligibility = resolveBagrutEligibilitySettings(storedEligibility);
  const stored = "נשמר";
  const fallback = "ברירת מחדל";
  const preDue = reminders.preDueReminders;
  const summary = reminders.lastRunSummary;

  const rows: Row[] = [
    {
      group: "תזכורות ציונים",
      name: "תזכורות פעילות",
      value: yesNo(reminders.enabled ?? false),
      source: reminders.enabled == null ? fallback : stored,
    },
    {
      group: "תזכורות ציונים",
      name: "סף מינימום למטלות",
      value: reminders.minThreshold ?? 1,
      source: reminders.minThreshold == null ? fallback : stored,
    },
    {
      group: "תזכורות ציונים",
      name: "תזכורת אחרי המועד",
      value: yesNo(reminders.postDueEnabled ?? true),
      source: reminders.postDueEnabled == null ? fallback : stored,
    },
    {
      group: "תזכורות ציונים",
      name: "תזכורות לפני המועד",
      value: yesNo(preDue?.enabled ?? false),
      source: preDue?.enabled == null ? fallback : stored,
    },
    {
      group: "תזכורות ציונים",
      name: "ימים לפני המועד",
      value: text((preDue?.daysBefore ?? [7, 3, 1]).join(", ")),
      source: preDue?.daysBefore == null ? fallback : stored,
    },
    {
      group: "תזכורות ציונים",
      name: "ריצה אחרונה",
      value: asTextDate(reminders.lastRunAt),
      source: reminders.lastRunAt ? stored : "—",
    },
    {
      group: "תזכורות ציונים",
      name: "סיכום ריצה אחרונה",
      value: summary
        ? `${summary.dryRun ? "סימולציה" : "שליחה"}: ${summary.sent} נשלחו, ${summary.skipped} דולגו, ${summary.errors} שגיאות`
        : "—",
      source: summary ? stored : "—",
    },
    {
      group: "עליית כיתות",
      name: "שנה אחרונה שבה בוצעה עלייה",
      value: promotion.lastPromotionYear ?? "—",
      source: promotion.lastPromotionYear == null ? "—" : stored,
    },
    {
      group: "עליית כיתות",
      name: "מועד העלייה האחרונה",
      value: asTextDate(promotion.lastPromotionAt),
      source: promotion.lastPromotionAt ? stored : "—",
    },
    {
      group: "עליית כיתות",
      name: "כיתות שעלו",
      value: promotion.lastPromotedCount ?? "—",
      source: promotion.lastPromotedCount == null ? "—" : stored,
    },
    {
      group: "זכאות לבגרות",
      name: "סף כישלון כללי (ציון ומטה)",
      value: eligibility.generalFailMax,
      source: storedEligibility.generalFailMax == null ? fallback : stored,
    },
    {
      group: "זכאות לבגרות",
      name: "סף כישלון בעברית (ציון ומטה)",
      value: eligibility.hebrewFailMax,
      source: storedEligibility.hebrewFailMax == null ? fallback : stored,
    },
    {
      group: "זכאות לבגרות",
      name: "מקסימום מקצועות נכשלים",
      value: eligibility.maxFailedSubjects,
      source: storedEligibility.maxFailedSubjects == null ? fallback : stored,
    },
    {
      group: "זכאות לבגרות",
      name: "מעורבות חברתית נדרשת",
      value: yesNo(eligibility.requireSocialInvolvementPass),
      source: storedEligibility.requireSocialInvolvementPass == null ? fallback : stored,
    },
  ];

  return {
    name: "הגדרות",
    title: "הגדרות מערכת",
    description: "תזכורות ציונים, עליית כיתות וספי זכאות לתעודת בגרות",
    tabColor: TAB.admin,
    columns: [
      { header: "נושא", key: "group", width: 22 },
      { header: "הגדרה", key: "name", width: 36 },
      { header: "ערך", key: "value", width: 42, wrap: true },
      { header: "מקור", key: "source", width: 16 },
    ],
    rows,
  };
}

function parseReminderKey(key: string): {
  recipientId: string;
  obligationId: string;
  subItemSortOrder: number | null;
  dueDate: string;
  variant: string;
} | null {
  const parts = key.split("::");
  if (parts.length < 3) return null;
  let variant = "";
  if (/^pre-\d+$/.test(parts[parts.length - 1] ?? "")) {
    variant = parts.pop() ?? "";
  }
  const dueDate = parts[parts.length - 1] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  parts.pop();
  if (parts.length < 2) return null;
  let subItemSortOrder: number | null = null;
  const tail = parts[parts.length - 1] ?? "";
  if (/^sub:\d+$/.test(tail)) {
    subItemSortOrder = Number(tail.slice(4));
    parts.pop();
  }
  const recipientId = parts[0] ?? "";
  const obligationId = parts.slice(1).join("::");
  if (!recipientId || !obligationId) return null;
  return { recipientId, obligationId, subItemSortOrder, dueDate, variant };
}

function variantLabel(variant: string): string {
  const match = variant.match(/^pre-(\d+)$/);
  if (match) return `לפני המועד (${match[1]} ימים)`;
  return "אחרי המועד";
}

function reminderSendsTable(ctx: ExportContext): TableSpec {
  const sent = ctx.settings.gradeReminders?.lastSentByRecipient ?? {};
  const rows = Object.entries(sent).map(([key, sentOn]) => {
    const parsed = parseReminderKey(key);
    const staff = parsed ? ctx.staffById.get(parsed.recipientId) : null;
    const hit = parsed ? hitOf(ctx, parsed.obligationId) : null;
    return {
      recipient: text(staff?.name),
      email: text(staff?.email),
      subject: text(hit?.subject.name),
      obligation: hit ? obligationDisplayLabel(hit.obligation) : parsed ? "מטלה שנמחקה" : "—",
      questionnaire: text(hit?.obligation.questionnaireNumber),
      subItem:
        parsed?.subItemSortOrder == null
          ? "המטלה כולה"
          : subItemName(hit?.obligation, parsed.subItemSortOrder),
      due: parsed ? formatDateOnly(parsed.dueDate) : "—",
      kind: parsed ? variantLabel(parsed.variant) : "—",
      sentOn: asTextDate(sentOn),
      key,
    };
  });
  rows.sort((a, b) => String(b.sentOn).localeCompare(String(a.sentOn), "he"));
  return {
    name: "שליחות תזכורת",
    title: "תזכורות שכבר נשלחו",
    description: "מפתח מניעת שליחה כפולה: למי נשלחה תזכורת ולאיזו מטלה",
    tabColor: TAB.admin,
    columns: [
      { header: "נמען", key: "recipient", width: 22 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "מקצוע", key: "subject", width: 22 },
      { header: "מטלה", key: "obligation", width: 32 },
      { header: "שאלון", key: "questionnaire", width: 14 },
      { header: "היקף", key: "subItem", width: 18 },
      { header: "תאריך יעד", key: "due", width: 16 },
      { header: "סוג", key: "kind", width: 22 },
      { header: "נשלח בתאריך", key: "sentOn", width: 16 },
      { header: "מפתח", key: "key", width: 42 },
    ],
    rows,
  };
}

function activityTable(ctx: ExportContext): TableSpec {
  return {
    name: "יומן פעילות",
    title: "יומן פעילות",
    description: "מי שינה ציונים, מקצועות, מטלות או צוות, ומתי",
    tabColor: TAB.log,
    columns: [
      { header: "מועד", key: "at", width: 18 },
      { header: "מבצע", key: "actor", width: 22 },
      { header: "אימייל", key: "email", width: 32 },
      { header: "תחום", key: "category", width: 18 },
      { header: "פעולה", key: "action", width: 24 },
      { header: "תיאור", key: "summary", width: 42, wrap: true },
      { header: "סוג רשומה", key: "entity", width: 14 },
      { header: "מזהה רשומה", key: "entityId", width: 24 },
      { header: "פרטים", key: "meta", width: 36, wrap: true },
    ],
    rows: ctx.activity.map((event) => ({
      at: text(event.at),
      actor: text(event.actorName),
      email: text(event.actorEmail),
      category: ACTIVITY_CATEGORY_LABELS[event.category] ?? event.category,
      action: ACTION_LABELS[event.action] ?? event.action,
      summary: text(event.summaryHe),
      entity: ENTITY_LABELS[event.entityType] ?? event.entityType,
      entityId: text(event.entityId),
      meta: metaText(event.meta),
    })),
  };
}

function buildTables(ctx: ExportContext): TableSpec[] {
  return [
    studentsTable(ctx),
    studentTracksTable(ctx),
    mandatorySubjectsTable(ctx),
    classesTable(ctx),
    tracksTable(ctx),
    pathsTable(ctx),
    pathSubjectsTable(ctx),
    subjectsTable(ctx),
    obligationsTable(ctx),
    componentsTable(ctx),
    subItemsTable(ctx),
    gradesTable(ctx),
    componentScoresTable(ctx),
    subItemScoresTable(ctx),
    weightOverridesTable(ctx),
    overridesTable(ctx),
    staffTable(ctx),
    usersTable(ctx),
    settingsTable(ctx),
    reminderSendsTable(ctx),
    activityTable(ctx),
  ];
}

function drawBanner(ws: ExcelJS.Worksheet, title: string, subtitle: string, colCount: number) {
  ws.mergeCells(1, 1, 1, colCount);
  ws.mergeCells(2, 1, 2, colCount);
  ws.mergeCells(3, 1, 3, colCount);

  const brand = ws.getCell(1, 1);
  brand.value = "מערכת מעקב בגרות · ישיבה תיכונית";
  brand.font = { size: 10, color: { argb: "FFC7D2FE" }, bold: true };
  brand.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  brand.fill = fillOf(COLOR.primary);
  ws.getRow(1).height = 20;

  const titleCell = ws.getCell(2, 1);
  titleCell.value = title;
  titleCell.font = { size: 18, color: { argb: COLOR.white }, bold: true };
  titleCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  titleCell.fill = fillOf(COLOR.primary);
  ws.getRow(2).height = 30;

  const subCell = ws.getCell(3, 1);
  subCell.value = subtitle;
  subCell.font = { size: 11, color: { argb: "FFE0E7FF" } };
  subCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  subCell.fill = fillOf(COLOR.primary);
  ws.getRow(3).height = 20;

  ws.getRow(4).height = 8;
}

type Kpi = {
  label: string;
  value: number;
  tone: "primary" | "success" | "info" | "warning";
  subtitle: string;
};

function drawKpis(ws: ExcelJS.Worksheet, startRow: number, kpis: Kpi[], colCount: number) {
  const cardsPerRow = kpis.length;
  const cardWidth = Math.floor(colCount / cardsPerRow);
  const labelRow = startRow;
  const valueRow = startRow + 1;
  const subRow = startRow + 2;
  ws.getRow(labelRow).height = 18;
  ws.getRow(valueRow).height = 28;
  ws.getRow(subRow).height = 18;

  kpis.forEach((kpi, index) => {
    const startCol = index * cardWidth + 1;
    const endCol = startCol + cardWidth - 2;
    ws.mergeCells(labelRow, startCol, labelRow, endCol);
    ws.mergeCells(valueRow, startCol, valueRow, endCol);
    ws.mergeCells(subRow, startCol, subRow, endCol);

    const toneColor =
      kpi.tone === "success" ? COLOR.success : kpi.tone === "warning" ? COLOR.warning : kpi.tone === "info" ? COLOR.info : COLOR.primary;
    const toneBg =
      kpi.tone === "success"
        ? COLOR.successBg
        : kpi.tone === "warning"
          ? COLOR.warningBg
          : kpi.tone === "info"
            ? COLOR.infoBg
            : COLOR.primaryLight;

    const labelCell = ws.getCell(labelRow, startCol);
    labelCell.value = kpi.label;
    labelCell.font = { size: 10, color: { argb: COLOR.slate700 }, bold: true };
    labelCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    labelCell.fill = fillOf(toneBg);
    labelCell.border = {
      top: { style: "medium", color: { argb: toneColor } },
      left: { style: "thin", color: { argb: COLOR.slate200 } },
      right: { style: "thin", color: { argb: COLOR.slate200 } },
    };

    const valueCell = ws.getCell(valueRow, startCol);
    valueCell.value = kpi.value;
    valueCell.numFmt = "#,##0";
    valueCell.font = { size: 20, color: { argb: toneColor }, bold: true };
    valueCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    valueCell.fill = fillOf(toneBg);
    valueCell.border = {
      left: { style: "thin", color: { argb: COLOR.slate200 } },
      right: { style: "thin", color: { argb: COLOR.slate200 } },
    };

    const subCell = ws.getCell(subRow, startCol);
    subCell.value = kpi.subtitle;
    subCell.font = { size: 9, color: { argb: COLOR.slate500 } };
    subCell.alignment = { horizontal: "right", vertical: "middle", indent: 1, wrapText: true };
    subCell.fill = fillOf(toneBg);
    subCell.border = {
      bottom: { style: "thin", color: { argb: COLOR.slate200 } },
      left: { style: "thin", color: { argb: COLOR.slate200 } },
      right: { style: "thin", color: { argb: COLOR.slate200 } },
    };
  });
}

function fillSummary(ws: ExcelJS.Worksheet, ctx: ExportContext, stats: SheetStat[]) {
  const colCount = 12;
  for (let index = 1; index <= colCount; index += 1) {
    ws.getColumn(index).width = 16;
  }

  const actor = ctx.actor
    ? `${ctx.actor.name || "מנהל"} · ${ctx.actor.email}`
    : "מנהל המערכת";
  drawBanner(
    ws,
    "ייצוא מלא של נתוני המערכת",
    `${formatIsrael(ctx.exportedAt)}   ·   הופק עבור ${actor}`,
    colCount
  );

  const obligationCount = ctx.subjects.reduce((sum, subject) => sum + (subject.obligations?.length ?? 0), 0);
  const gradedCount = ctx.grades.filter((grade) => grade.status === "GRADED").length;

  drawKpis(
    ws,
    5,
    [
      { label: "תלמידים", value: ctx.students.length, tone: "primary", subtitle: "רשומות תלמיד" },
      { label: "מקצועות", value: ctx.subjects.length, tone: "info", subtitle: "כולל מטלות ושאלונים" },
      { label: "מטלות", value: obligationCount, tone: "warning", subtitle: "שאלונים ומטלות" },
      {
        label: "ציונים",
        value: ctx.grades.length,
        tone: "success",
        subtitle: `${gradedCount.toLocaleString("he-IL")} בסטטוס נבדק`,
      },
    ],
    colCount
  );

  ws.getRow(8).height = 10;
  drawKpis(
    ws,
    9,
    [
      { label: "כיתות", value: ctx.classes.length, tone: "primary", subtitle: "כולל שכבה ומסלול" },
      { label: "מגמות", value: ctx.tracks.length, tone: "info", subtitle: "יחידות לימוד" },
      { label: "מסלולים", value: ctx.paths.length, tone: "info", subtitle: "מסלולי בגרות" },
      { label: "צוות", value: ctx.staff.length, tone: "warning", subtitle: "מנהלים ומורים" },
    ],
    colCount
  );

  ws.getRow(12).height = 10;
  ws.mergeCells(13, 1, 13, colCount);
  const section = ws.getCell(13, 1);
  section.value = "תוכן הקובץ";
  section.font = { size: 12, bold: true, color: { argb: COLOR.white } };
  section.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  section.fill = fillOf(COLOR.primaryDark);
  ws.getRow(13).height = 24;

  const headerRow = 14;
  const headers: Array<[number, number, string]> = [
    [1, 3, "גיליון"],
    [4, 5, "רשומות"],
    [6, 12, "מה כלול"],
  ];
  for (const [start, end, label] of headers) {
    ws.mergeCells(headerRow, start, headerRow, end);
    const cell = ws.getCell(headerRow, start);
    cell.value = label;
    cell.font = { bold: true, size: 11, color: { argb: COLOR.white } };
    cell.fill = fillOf(COLOR.primary);
    cell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    cell.border = borderThin;
  }
  ws.getRow(headerRow).height = 22;

  stats.forEach((stat, index) => {
    const rowNumber = headerRow + 1 + index;
    const row = ws.getRow(rowNumber);
    row.height = 22;
    const zebra = index % 2 === 1;
    const pairs: Array<[number, number, Cell, boolean]> = [
      [1, 3, stat.name, false],
      [4, 5, stat.count, true],
      [6, 12, stat.description, false],
    ];
    for (const [start, end, value, numeric] of pairs) {
      ws.mergeCells(rowNumber, start, rowNumber, end);
      const cell = ws.getCell(rowNumber, start);
      cell.value = value ?? "";
      if (numeric && typeof value === "number") cell.numFmt = "#,##0";
      cell.font = { size: 11, color: { argb: COLOR.slate900 }, bold: start === 1 };
      cell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      cell.border = borderThin;
      if (zebra) cell.fill = fillOf(COLOR.slate50);
    }
  });

  const noteRow = headerRow + stats.length + 2;
  ws.mergeCells(noteRow, 1, noteRow, colCount);
  const note = ws.getCell(noteRow, 1);
  note.value =
    "הקובץ כולל את הרשומות שנשמרו במערכת בזמן ההורדה. סיסמאות ומפתחות שליחת הדואר אינם נשמרים במסד, ולכן אינם מופיעים כאן.";
  note.font = { size: 10, italic: true, color: { argb: COLOR.slate500 } };
  note.alignment = { horizontal: "right", vertical: "middle", wrapText: true, indent: 1 };
  ws.getRow(noteRow).height = 32;

  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9,
  };
}

function addTableSheet(workbook: ExcelJS.Workbook, spec: TableSpec, usedNames: Set<string>) {
  const ws = workbook.addWorksheet(safeSheetName(spec.name, usedNames), {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { tabColor: { argb: spec.tabColor } },
  });

  const columnCount = spec.columns.length;
  ws.mergeCells(1, 1, 1, columnCount);
  const title = ws.getCell(1, 1);
  title.value = `${spec.title}   ·   ${spec.rows.length.toLocaleString("he-IL")} רשומות`;
  title.font = { bold: true, size: 14, color: { argb: COLOR.white } };
  title.fill = fillOf(COLOR.primary);
  title.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;

  spec.columns.forEach((column, index) => {
    const cell = ws.getRow(2).getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, size: 11, color: { argb: COLOR.white } };
    cell.fill = fillOf(COLOR.primaryDark);
    cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true, indent: 1 };
    cell.border = borderThin;
    ws.getColumn(index + 1).width = column.width ?? 18;
  });
  ws.getRow(2).height = 24;

  spec.rows.forEach((row, rowIndex) => {
    const excelRow = ws.getRow(rowIndex + 3);
    let lines = 1;
    spec.columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      const raw = row[column.key];
      if (column.kind === "number") {
        cell.value = typeof raw === "number" && !Number.isNaN(raw) ? raw : null;
        if (typeof raw === "number") cell.numFmt = Number.isInteger(raw) ? "#,##0" : "#,##0.##";
      } else if (raw == null || raw === "") {
        cell.value = "—";
      } else {
        cell.value = raw;
      }

      const label = column.kind === "status" ? String(cell.value ?? "") : "";
      const tone = column.kind === "status" ? statusFill(label) : null;
      cell.font = {
        size: 11,
        color: { argb: tone?.fg ?? COLOR.slate900 },
        bold: Boolean(tone),
      };
      cell.alignment = {
        horizontal: "right",
        vertical: "middle",
        indent: 1,
        wrapText: Boolean(column.wrap),
      };
      cell.border = borderThin;
      if (tone) cell.fill = fillOf(tone.bg);
      else if (rowIndex % 2 === 1) cell.fill = fillOf(COLOR.slate50);

      if (column.wrap) {
        const content = String(cell.value ?? "");
        const width = column.width ?? 18;
        const wrapped = content.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0);
        lines = Math.max(lines, wrapped);
      }
    });
    excelRow.height = Math.min(22 + (lines - 1) * 16, 96);
  });

  const lastColumn = columnLetter(columnCount);
  const lastRow = Math.max(2, spec.rows.length + 2);
  ws.autoFilter = `A2:${lastColumn}${lastRow}`;
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: "1:2",
  };
}

function buildWorkbook(ctx: ExportContext): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "מערכת מעקב בגרות";
  workbook.company = "ישיבה תיכונית";
  workbook.title = "ייצוא מלא של נתוני המערכת";
  workbook.created = ctx.exportedAt;
  workbook.modified = ctx.exportedAt;

  const usedNames = new Set<string>(["סיכום"]);
  const summary = workbook.addWorksheet("סיכום", {
    views: [{ rightToLeft: true, showGridLines: false }],
    properties: { tabColor: { argb: TAB.cover } },
  });

  const stats: SheetStat[] = [];
  for (const spec of buildTables(ctx)) {
    addTableSheet(workbook, spec, usedNames);
    stats.push({
      name: spec.name,
      count: spec.rows.length,
      description: spec.description,
    });
  }
  fillSummary(summary, ctx, stats);
  return workbook;
}

export function fullSchoolExportFilename(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `נתוני_המערכת_${pick("year")}-${pick("month")}-${pick("day")}_${pick("hour")}${pick("minute")}.xlsx`;
}

export async function buildFullSchoolExportBuffer(actor?: ExportActor | null): Promise<Buffer> {
  const ctx = await loadExportContext(actor ?? null);
  const workbook = buildWorkbook(ctx);
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}
