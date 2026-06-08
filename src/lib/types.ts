export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type ExamPathType = "REGULAR" | "BEIT_MIDRASH" | "MEUBAR_HINUCH";

export type SubjectCategory = "MANDATORY" | "MATH" | "ENGLISH" | "TRACK" | "EXTENSION";

export type SubmissionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "GRADED"
  | "EXEMPT";

export interface ObligationComponent {
  name: string;
  weightPercent: number;
  sortOrder: number;
}

export interface ObligationSubItem {
  name: string;
  weightPercent: number;
  sortOrder: number;
}

export interface Obligation {
  id: string;
  questionnaireNumber: string | null;
  name: string | null;
  weightPercent: number;
  examType: string;
  studyMaterial: string | null;
  examEvent: string | null;
  gradeYear: string | null;
  sortOrder: number;
  components: ObligationComponent[];
  subItems: ObligationSubItem[];
}

export interface Subject {
  id: string;
  name: string;
  units: number | null;
  category: SubjectCategory;
  trackId: string | null;
  obligations: Obligation[];
}

export interface ExamPath {
  id: string;
  key: string;
  label: string;
  pathType: ExamPathType;
  description: string | null;
  subjectIds: string[];
}

export interface Class {
  id: string;
  name: string;
  gradeYear: string | null;
  examPathId: string;
}

export interface Track {
  id: string;
  name: string;
  units: number;
}

export interface Student {
  id: string;
  email: string;
  name: string;
  uid: string | null;
  classId: string;
  /** @deprecated use trackIds */
  trackId?: string | null;
  trackIds: string[];
  mathUnits: number;
  englishUnits: number;
  extensions: string | null;
}

export interface Grade {
  id: string;
  studentId: string;
  obligationId: string;
  score: number | null;
  status: SubmissionStatus;
  notes: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL: string | null;
  role: Role;
  studentId: string | null;
}

export interface AuthSession {
  uid: string;
  email: string;
  name: string;
  role: Role;
  studentId: string | null;
  photoURL: string | null;
}
