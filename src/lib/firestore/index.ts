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

function docsMap<T extends { id: string }>(
  snaps: FirebaseFirestore.QuerySnapshot
): Map<string, T> {
  return new Map(
    snaps.docs.map((d) => {
      const item = { id: d.id, ...d.data() } as T;
      return [item.id, item] as const;
    })
  );
}

function newId() {
  return adminDb.collection("_").doc().id;
}

/** Ensure every obligation in a subject has a unique id (fixes sync duplicates). */
export function deduplicateObligations(
  obligations: Obligation[],
  options?: { assignNewIds?: boolean }
): {
  obligations: Obligation[];
  changed: boolean;
} {
  const seenIds = new Set<string>();
  let changed = false;

  const normalized = obligations.map((o, index) => {
    if (!seenIds.has(o.id)) {
      seenIds.add(o.id);
      return o;
    }
    changed = true;
    const id = options?.assignNewIds
      ? newId()
      : `${o.id}__${o.sortOrder ?? index}`;
    const fixed = { ...o, id };
    seenIds.add(fixed.id);
    return fixed;
  });

  return { obligations: normalized, changed };
}

function normalizeSubject(subject: Subject): Subject {
  const { obligations, changed } = deduplicateObligations(subject.obligations ?? []);
  return changed ? { ...subject, obligations } : subject;
}

export function getStudentTrackIds(student: Pick<Student, "trackIds" | "trackId">): string[] {
  if (student.trackIds?.length) return student.trackIds;
  if (student.trackId) return [student.trackId];
  return [];
}

function normalizeStudent(student: Student): Student {
  return { ...student, trackIds: getStudentTrackIds(student) };
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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return docData<UserProfile>(await adminDb.collection("users").doc(uid).get());
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
    const studentId = role === "STUDENT" ? resolved.studentId : null;

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
  return snap.empty ? null : normalizeStudent(docData<Student>(snap.docs[0]!)!);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const student = docData<Student>(await adminDb.collection("students").doc(id).get());
  return student ? normalizeStudent(student) : null;
}

export async function listStudents(): Promise<Student[]> {
  const snap = await adminDb.collection("students").orderBy("name").get();
  return docsData<Student>(snap).map(normalizeStudent);
}

export async function createStudent(data: Omit<Student, "id" | "uid">) {
  const id = newId();
  const trackIds = getStudentTrackIds(data);
  const student: Student = {
    id,
    uid: null,
    email: data.email.toLowerCase().trim(),
    name: data.name,
    classId: data.classId,
    trackIds,
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
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updates[key] = value;
  }
  if (data.email) updates.email = data.email.toLowerCase().trim();
  if (data.trackIds !== undefined) {
    updates.trackIds = data.trackIds;
    updates.trackId = FieldValue.delete();
  }
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

type EnrichLookup = {
  classes: Map<string, Class>;
  tracks: Map<string, Track>;
  examPaths: Map<string, ExamPath>;
};

function enrichStudentFromLookup(student: Student, lookup: EnrichLookup) {
  const cls = lookup.classes.get(student.classId) ?? null;
  const trackIds = getStudentTrackIds(student);
  const tracks = trackIds
    .map((id) => lookup.tracks.get(id))
    .filter(Boolean) as Track[];
  const examPath = cls ? lookup.examPaths.get(cls.examPathId) ?? null : null;

  return {
    id: student.id,
    mathUnits: student.mathUnits,
    englishUnits: student.englishUnits,
    extensions: student.extensions,
    user: { id: student.uid ?? student.id, name: student.name, email: student.email },
    class: cls
      ? { id: cls.id, name: cls.name, gradeYear: cls.gradeYear, examPath: examPath ?? { id: "", label: "", key: "" } }
      : null,
    tracks,
    track: tracks[0] ?? null,
  };
}

export async function enrichStudent(student: Student) {
  const trackIds = getStudentTrackIds(student);
  const [classesSnap, trackSnaps, pathsSnap] = await Promise.all([
    adminDb.collection("classes").doc(student.classId).get(),
    Promise.all(trackIds.map((id) => adminDb.collection("tracks").doc(id).get())),
    adminDb.collection("classes").doc(student.classId).get().then(async (clsSnap) => {
      if (!clsSnap.exists) return null;
      const examPathId = (clsSnap.data() as Class).examPathId;
      return adminDb.collection("examPaths").doc(examPathId).get();
    }),
  ]);

  const cls = classesSnap.exists ? docData<Class>(classesSnap) : null;
  const tracks = trackSnaps
    .filter((snap) => snap.exists)
    .map((snap) => docData<Track>(snap)!);
  const examPath = pathsSnap?.exists ? docData<ExamPath>(pathsSnap) : null;

  return enrichStudentFromLookup(student, {
    classes: cls ? new Map([[cls.id, cls]]) : new Map(),
    tracks: new Map(tracks.map((t) => [t.id, t])),
    examPaths: examPath ? new Map([[examPath.id, examPath]]) : new Map(),
  });
}

export async function listStudentsEnriched() {
  const [students, classesSnap, tracksSnap, pathsSnap] = await Promise.all([
    listStudents(),
    adminDb.collection("classes").get(),
    adminDb.collection("tracks").get(),
    adminDb.collection("examPaths").get(),
  ]);

  const lookup: EnrichLookup = {
    classes: docsMap<Class>(classesSnap),
    tracks: docsMap<Track>(tracksSnap),
    examPaths: docsMap<ExamPath>(pathsSnap),
  };

  return students.map((student) => enrichStudentFromLookup(student, lookup));
}

// ─── classes ───────────────────────────────────────────────────────────────

export async function getClassById(id: string): Promise<Class | null> {
  return docData<Class>(await adminDb.collection("classes").doc(id).get());
}

export async function listClasses() {
  const [classesSnap, studentsSnap, pathsSnap] = await Promise.all([
    adminDb.collection("classes").orderBy("name").get(),
    adminDb.collection("students").get(),
    adminDb.collection("examPaths").get(),
  ]);

  const classes = docsData<Class>(classesSnap);
  const examPaths = docsMap<ExamPath>(pathsSnap);
  const studentCounts = new Map<string, number>();
  for (const doc of studentsSnap.docs) {
    const classId = (doc.data() as Student).classId;
    studentCounts.set(classId, (studentCounts.get(classId) ?? 0) + 1);
  }

  return classes.map((cls) => ({
    ...cls,
    examPath: examPaths.get(cls.examPathId) ?? null,
    _count: { students: studentCounts.get(cls.id) ?? 0 },
  }));
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
  const [pathsSnap, classesSnap] = await Promise.all([
    adminDb.collection("examPaths").orderBy("label").get(),
    adminDb.collection("classes").get(),
  ]);

  const paths = docsData<ExamPath>(pathsSnap).filter((p) => p.key !== "flexible");
  const classCounts = new Map<string, number>();
  for (const doc of classesSnap.docs) {
    const examPathId = (doc.data() as Class).examPathId;
    classCounts.set(examPathId, (classCounts.get(examPathId) ?? 0) + 1);
  }

  return paths.map((p) => ({
    ...p,
    _count: { classes: classCounts.get(p.id) ?? 0 },
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
  const subject = docData<Subject>(await adminDb.collection("subjects").doc(id).get());
  return subject ? normalizeSubject(subject) : null;
}

export async function listSubjects(): Promise<Subject[]> {
  return docsData<Subject>(await adminDb.collection("subjects").get()).map(normalizeSubject);
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
  const [subjects, pathsSnap] = await Promise.all([
    listSubjects(),
    adminDb.collection("examPaths").orderBy("label").get(),
  ]);

  const paths = docsData<ExamPath>(pathsSnap).filter((p) => p.key !== "flexible");
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
  const ob: Obligation = {
    id: newId(),
    ...obligation,
    sortOrder: obligation.sortOrder ?? subject.obligations.length,
  };
  const { obligations } = deduplicateObligations([...subject.obligations, ob]);
  await adminDb.collection("subjects").doc(subjectId).update({ obligations });
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

export async function getAdminDashboardData() {
  const [counts, paths, allSubjects] = await Promise.all([
    Promise.all([
      adminDb.collection("students").count().get(),
      adminDb.collection("classes").count().get(),
      adminDb.collection("subjects").count().get(),
      adminDb.collection("grades").where("status", "==", "GRADED").count().get(),
      adminDb.collection("examPaths").count().get(),
    ]),
    listExamPaths(),
    listSubjects(),
  ]);

  const [students, classes, subjects, grades, pathsCount] = counts;
  const obligations = allSubjects.reduce((s, sub) => s + sub.obligations.length, 0);

  return {
    counts: {
      students: students.data().count,
      classes: classes.data().count,
      subjects: subjects.data().count,
      paths: pathsCount.data().count,
      obligations,
      gradedCount: grades.data().count,
    },
    paths,
  };
}

export async function getDashboardCounts() {
  const { counts } = await getAdminDashboardData();
  return counts;
}
