import { adminDb } from "@/lib/firebase/admin";
import type {
  Class,
  ExamPath,
  Grade,
  Obligation,
  Role,
  Student,
  Subject,
  SubmissionStatus,
  Track,
  UserProfile,
} from "@/lib/types";
import { isAdminEmail } from "@/lib/roles";
import { FieldValue } from "firebase-admin/firestore";

// ─── helpers ───────────────────────────────────────────────────────────────

function docData<T>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}

function docsData<T>(snaps: FirebaseFirestore.QuerySnapshot): T[] {
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

function newId() {
  return adminDb.collection("_").doc().id;
}

// ─── users ─────────────────────────────────────────────────────────────────

export async function isStaffEmail(email: string): Promise<boolean> {
  const snap = await adminDb
    .collection("staff")
    .where("email", "==", email.toLowerCase().trim())
    .limit(1)
    .get();
  return !snap.empty;
}

export async function resolveUserRole(email: string): Promise<{
  role: Role | null;
  studentId: string | null;
}> {
  const normalized = email.toLowerCase().trim();
  if (isAdminEmail(normalized)) return { role: "ADMIN", studentId: null };

  const student = await getStudentByEmail(normalized);
  if (student) return { role: "STUDENT", studentId: student.id };

  if (await isStaffEmail(normalized)) return { role: "TEACHER", studentId: null };

  return { role: null, studentId: null };
}

export async function getOrCreateUserProfile(input: {
  uid: string;
  email: string;
  name: string;
  photoURL: string | null;
}): Promise<UserProfile> {
  const ref = adminDb.collection("users").doc(input.uid);
  const snap = await ref.get();
  const resolved = await resolveUserRole(input.email);

  if (snap.exists) {
    const data = snap.data() as UserProfile;
    const role = isAdminEmail(input.email) ? "ADMIN" : (resolved.role ?? data.role);
    const studentId = resolved.studentId ?? data.studentId;

    await ref.update({
      name: input.name,
      photoURL: input.photoURL,
      email: input.email,
      role,
      studentId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (resolved.studentId) {
      await adminDb.collection("students").doc(resolved.studentId).update({ uid: input.uid });
    }

    return { ...data, uid: input.uid, name: input.name, photoURL: input.photoURL, role, studentId };
  }

  const profile: UserProfile = {
    uid: input.uid,
    email: input.email,
    name: input.name,
    photoURL: input.photoURL,
    role: resolved.role ?? "STUDENT",
    studentId: resolved.studentId,
  };

  await ref.set({ ...profile, createdAt: FieldValue.serverTimestamp() });

  if (resolved.studentId) {
    await adminDb.collection("students").doc(resolved.studentId).update({ uid: input.uid });
  }

  return profile;
}

export async function setUserRole(uid: string, role: Role) {
  await adminDb.collection("users").doc(uid).update({ role });
}

// ─── students ──────────────────────────────────────────────────────────────

export async function getStudentByEmail(email: string): Promise<Student | null> {
  const snap = await adminDb
    .collection("students")
    .where("email", "==", email.toLowerCase().trim())
    .limit(1)
    .get();
  return snap.empty ? null : docData<Student>(snap.docs[0]!);
}

export async function getStudentById(id: string): Promise<Student | null> {
  return docData<Student>(await adminDb.collection("students").doc(id).get());
}

export async function listStudents(): Promise<Student[]> {
  const snap = await adminDb.collection("students").orderBy("name").get();
  return docsData<Student>(snap);
}

export async function createStudent(data: Omit<Student, "id" | "uid">) {
  const id = newId();
  const student: Student = {
    id,
    uid: null,
    email: data.email.toLowerCase().trim(),
    name: data.name,
    classId: data.classId,
    trackId: data.trackId,
    mathUnits: data.mathUnits,
    englishUnits: data.englishUnits,
    extensions: data.extensions ?? null,
  };
  await adminDb.collection("students").doc(id).set({
    ...student,
    createdAt: FieldValue.serverTimestamp(),
  });
  return student;
}

export async function updateStudent(
  id: string,
  data: Partial<Omit<Student, "id">>
) {
  const updates: Record<string, unknown> = { ...data, updatedAt: FieldValue.serverTimestamp() };
  if (data.email) updates.email = data.email.toLowerCase().trim();
  await adminDb.collection("students").doc(id).update(updates);
  return getStudentById(id);
}

export async function deleteStudent(id: string) {
  const grades = await adminDb.collection("grades").where("studentId", "==", id).get();
  const batch = adminDb.batch();
  grades.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(adminDb.collection("students").doc(id));
  await batch.commit();
}

export async function enrichStudent(student: Student) {
  const [cls, track, examPath] = await Promise.all([
    getClassById(student.classId),
    student.trackId ? getTrackById(student.trackId) : null,
    getClassById(student.classId).then(async (c) =>
      c ? getExamPathById(c.examPathId) : null
    ),
  ]);

  return {
    id: student.id,
    mathUnits: student.mathUnits,
    englishUnits: student.englishUnits,
    extensions: student.extensions,
    user: { id: student.uid ?? student.id, name: student.name, email: student.email },
    class: cls
      ? { id: cls.id, name: cls.name, gradeYear: cls.gradeYear, examPath: examPath ?? { id: "", label: "", key: "" } }
      : null,
    track,
  };
}

export async function listStudentsEnriched() {
  const students = await listStudents();
  return Promise.all(students.map(enrichStudent));
}

// ─── classes ───────────────────────────────────────────────────────────────

export async function getClassById(id: string): Promise<Class | null> {
  return docData<Class>(await adminDb.collection("classes").doc(id).get());
}

export async function listClasses() {
  const snap = await adminDb.collection("classes").orderBy("name").get();
  const classes = docsData<Class>(snap);
  const students = await listStudents();

  return Promise.all(
    classes.map(async (cls) => {
      const examPath = await getExamPathById(cls.examPathId);
      const count = students.filter((s) => s.classId === cls.id).length;
      return {
        ...cls,
        examPath,
        _count: { students: count },
      };
    })
  );
}

export async function createClass(data: Omit<Class, "id">) {
  const id = newId();
  await adminDb.collection("classes").doc(id).set({ id, ...data, createdAt: FieldValue.serverTimestamp() });
  const examPath = await getExamPathById(data.examPathId);
  return { id, ...data, examPath, _count: { students: 0 } };
}

export async function updateClass(id: string, data: Partial<Omit<Class, "id">>) {
  await adminDb.collection("classes").doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  const cls = await getClassById(id);
  const examPath = cls ? await getExamPathById(cls.examPathId) : null;
  const students = await listStudents();
  return {
    ...cls,
    examPath,
    _count: { students: students.filter((s) => s.classId === id).length },
  };
}

export async function deleteClass(id: string) {
  const students = await listStudents();
  if (students.some((s) => s.classId === id)) {
    throw new Error("לא ניתן למחוק כיתה עם תלמידים");
  }
  await adminDb.collection("classes").doc(id).delete();
}

// ─── exam paths ────────────────────────────────────────────────────────────

export async function getExamPathById(id: string): Promise<ExamPath | null> {
  return docData<ExamPath>(await adminDb.collection("examPaths").doc(id).get());
}

export async function listExamPaths() {
  const snap = await adminDb.collection("examPaths").orderBy("label").get();
  const paths = docsData<ExamPath>(snap);
  const classes = await adminDb.collection("classes").get();

  return paths.map((p) => ({
    ...p,
    _count: {
      classes: classes.docs.filter((d) => d.data().examPathId === p.id).length,
    },
  }));
}

// ─── tracks ───────────────────────────────────────────────────────────────

export async function getTrackById(id: string): Promise<Track | null> {
  return docData<Track>(await adminDb.collection("tracks").doc(id).get());
}

export async function listTracks(): Promise<Track[]> {
  return docsData<Track>(await adminDb.collection("tracks").orderBy("name").get());
}

// ─── subjects ──────────────────────────────────────────────────────────────

export async function getSubjectById(id: string): Promise<Subject | null> {
  return docData<Subject>(await adminDb.collection("subjects").doc(id).get());
}

export async function listSubjects(): Promise<Subject[]> {
  return docsData<Subject>(await adminDb.collection("subjects").get());
}

export async function listSubjectsByPath(pathId: string): Promise<Subject[]> {
  const path = await getExamPathById(pathId);
  if (!path) return [];
  const subjects = await Promise.all(path.subjectIds.map(getSubjectById));
  return subjects.filter(Boolean) as Subject[];
}

export async function createSubject(data: Omit<Subject, "id">) {
  const id = newId();
  const subject = { id, ...data };
  await adminDb.collection("subjects").doc(id).set({ ...subject, createdAt: FieldValue.serverTimestamp() });
  return subject;
}

export async function updateSubject(id: string, data: Partial<Omit<Subject, "id">>) {
  await adminDb.collection("subjects").doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  return getSubjectById(id);
}

export async function deleteSubject(id: string) {
  await adminDb.collection("subjects").doc(id).delete();
  const paths = await listExamPaths();
  for (const p of paths) {
    if (p.subjectIds.includes(id)) {
      await adminDb.collection("examPaths").doc(p.id).update({
        subjectIds: p.subjectIds.filter((sid) => sid !== id),
      });
    }
  }
}

export async function listSubjectsEnriched() {
  const subjects = await listSubjects();
  const paths = await listExamPaths();
  return subjects.map((s) => ({
    ...s,
    pathLinks: paths
      .filter((p) => p.subjectIds.includes(s.id))
      .map((p) => ({ path: { label: p.label, key: p.key, id: p.id } })),
  }));
}

// ─── obligations (embedded in subjects) ────────────────────────────────────

export async function addObligation(subjectId: string, obligation: Omit<Obligation, "id">) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new Error("מקצוע לא נמצא");
  const ob: Obligation = { id: newId(), ...obligation };
  subject.obligations.push(ob);
  await adminDb.collection("subjects").doc(subjectId).update({ obligations: subject.obligations });
  return ob;
}

export async function updateObligation(subjectId: string, obligation: Obligation) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new Error("מקצוע לא נמצא");
  subject.obligations = subject.obligations.map((o) =>
    o.id === obligation.id ? obligation : o
  );
  await adminDb.collection("subjects").doc(subjectId).update({ obligations: subject.obligations });
  return obligation;
}

export async function deleteObligation(subjectId: string, obligationId: string) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new Error("מקצוע לא נמצא");
  subject.obligations = subject.obligations.filter((o) => o.id !== obligationId);
  await adminDb.collection("subjects").doc(subjectId).update({ obligations: subject.obligations });
}

export async function findObligation(obligationId: string) {
  const subjects = await listSubjects();
  for (const s of subjects) {
    const ob = s.obligations.find((o) => o.id === obligationId);
    if (ob) return { subject: s, obligation: ob };
  }
  return null;
}

// ─── grades ────────────────────────────────────────────────────────────────

export async function getGradesByStudent(studentId: string): Promise<Grade[]> {
  return docsData<Grade>(
    await adminDb.collection("grades").where("studentId", "==", studentId).get()
  );
}

export async function upsertGrades(
  studentId: string,
  grades: Array<{
    obligationId: string;
    score?: number | null;
    status: SubmissionStatus;
    notes?: string;
  }>
) {
  const results: Grade[] = [];
  for (const g of grades) {
    const existing = await adminDb
      .collection("grades")
      .where("studentId", "==", studentId)
      .where("obligationId", "==", g.obligationId)
      .limit(1)
      .get();

    if (existing.empty) {
      const id = newId();
      const grade: Grade = {
        id,
        studentId,
        obligationId: g.obligationId,
        score: g.score ?? null,
        status: g.status,
        notes: g.notes ?? null,
      };
      await adminDb.collection("grades").doc(id).set(grade);
      results.push(grade);
    } else {
      const doc = existing.docs[0]!;
      const updates = {
        score: g.score ?? null,
        status: g.status,
        notes: g.notes ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await doc.ref.update(updates);
      const gradeData = doc.data() as Grade;
      results.push({
        id: doc.id,
        studentId: gradeData.studentId,
        obligationId: gradeData.obligationId,
        score: g.score ?? null,
        status: g.status,
        notes: g.notes ?? null,
      });
    }
  }
  return results;
}

// ─── counts ────────────────────────────────────────────────────────────────

export async function getDashboardCounts() {
  const [students, classes, subjects, paths, grades] = await Promise.all([
    adminDb.collection("students").count().get(),
    adminDb.collection("classes").count().get(),
    adminDb.collection("subjects").count().get(),
    adminDb.collection("examPaths").count().get(),
    adminDb.collection("grades").where("status", "==", "GRADED").count().get(),
  ]);

  const allSubjects = await listSubjects();
  const obligations = allSubjects.reduce((s, sub) => s + sub.obligations.length, 0);

  return {
    students: students.data().count,
    classes: classes.data().count,
    subjects: subjects.data().count,
    paths: paths.data().count,
    obligations,
    gradedCount: grades.data().count,
  };
}
