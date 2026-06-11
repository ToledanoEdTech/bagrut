import { adminDb } from "@/lib/firebase/admin";
import { cached, invalidateServerCache } from "@/lib/server-cache";
import type {
  Class,
  ExamPath,
  Grade,
  Obligation,
  Role,
  StaffPermission,
  StaffRecord,
  Student,
  Subject,
  SubmissionStatus,
  Track,
  UserProfile,
} from "@/lib/types";
import { isAdminEmail } from "@/lib/roles";
import { LEGACY_TEACHER_PERMISSIONS } from "@/lib/permissions";
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
  const staff = await getStaffByEmail(email);
  return staff !== null;
}

export async function getStaffByEmail(email: string): Promise<StaffRecord | null> {
  const snap = await adminDb
    .collection("staff")
    .where("email", "==", email.toLowerCase().trim())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as StaffRecord;
}

/** מורים קיימים ללא שדה permissions מקבלים גישה מלאה (תאימות לאחור) */
export function resolveStaffPermissions(staff: StaffRecord | null): StaffPermission[] | undefined {
  if (!staff) return undefined;
  if (staff.role === "ADMIN") return undefined;
  if (staff.permissions === undefined) {
    return LEGACY_TEACHER_PERMISSIONS;
  }
  return staff.permissions;
}

export async function resolveUserRole(email: string): Promise<{
  role: Role | null;
  studentId: string | null;
  permissions?: StaffPermission[];
}> {
  const normalized = email.toLowerCase().trim();
  if (isAdminEmail(normalized)) return { role: "ADMIN", studentId: null };

  const student = await getStudentByEmail(normalized);
  if (student) return { role: "STUDENT", studentId: student.id };

  const staff = await getStaffByEmail(normalized);
  if (staff) {
    if (staff.role === "ADMIN") {
      return { role: "ADMIN", studentId: null };
    }
    return {
      role: "TEACHER",
      studentId: null,
      permissions: resolveStaffPermissions(staff),
    };
  }

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
  return cached("students", 30_000, async () => {
    const snap = await adminDb.collection("students").orderBy("name").get();
    return docsData<Student>(snap).map(normalizeStudent);
  });
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
    ...(data.mandatorySubjectIds !== undefined && {
      mandatorySubjectIds: data.mandatorySubjectIds,
    }),
  };
  await adminDb.collection("students").doc(id).set({
    ...student,
    createdAt: FieldValue.serverTimestamp(),
  });
  invalidateServerCache("students");
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
  if (data.mandatorySubjectIds === null) {
    updates.mandatorySubjectIds = FieldValue.delete();
  }
  if (data.email) updates.email = data.email.toLowerCase().trim();
  if (data.trackIds !== undefined) {
    updates.trackIds = data.trackIds;
    updates.trackId = FieldValue.delete();
  }
  await adminDb.collection("students").doc(id).update(updates);
  invalidateServerCache("students");
  return getStudentById(id);
}

export async function deleteStudent(id: string) {
  const grades = await adminDb.collection("grades").where("studentId", "==", id).get();
  const batch = adminDb.batch();
  grades.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(adminDb.collection("students").doc(id));
  await batch.commit();
  invalidateServerCache("students");
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
    mandatorySubjectIds: student.mandatorySubjectIds ?? null,
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
  return cached("students:enriched", 30_000, async () => {
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
  });
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
  invalidateServerCache("examPaths");
  invalidateServerCache("classes");
  const examPath = await getExamPathById(data.examPathId);
  return { id, ...data, examPath, _count: { students: 0 } };
}

export async function updateClass(id: string, data: Partial<Omit<Class, "id">>) {
  await adminDb.collection("classes").doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  invalidateServerCache("examPaths");
  invalidateServerCache("classes");
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
  invalidateServerCache("examPaths");
  invalidateServerCache("classes");
}

// ─── exam paths ────────────────────────────────────────────────────────────

export async function getExamPathById(id: string): Promise<ExamPath | null> {
  return docData<ExamPath>(await adminDb.collection("examPaths").doc(id).get());
}

export async function listExamPaths() {
  return cached("examPaths", 60_000, async () => {
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
  });
}

// ─── tracks ───────────────────────────────────────────────────────────────

export async function getTrackById(id: string): Promise<Track | null> {
  return docData<Track>(await adminDb.collection("tracks").doc(id).get());
}

export async function listTracks(): Promise<Track[]> {
  return cached("tracks", 60_000, async () =>
    docsData<Track>(await adminDb.collection("tracks").orderBy("name").get())
  );
}

// ─── subjects ──────────────────────────────────────────────────────────────

export async function getSubjectById(id: string): Promise<Subject | null> {
  const subject = docData<Subject>(await adminDb.collection("subjects").doc(id).get());
  return subject ? normalizeSubject(subject) : null;
}

export async function listSubjects(): Promise<Subject[]> {
  return cached("subjects", 60_000, async () =>
    docsData<Subject>(await adminDb.collection("subjects").get()).map(normalizeSubject)
  );
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
  invalidateServerCache("subjects");
  return subject;
}

export async function updateSubject(id: string, data: Partial<Omit<Subject, "id">>) {
  await adminDb.collection("subjects").doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  invalidateServerCache("subjects");
  return getSubjectById(id);
}

export async function deleteSubject(id: string) {
  await adminDb.collection("subjects").doc(id).delete();
  invalidateServerCache("subjects");
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
  invalidateServerCache("subjects");
  return ob;
}

export async function updateObligation(subjectId: string, obligation: Obligation) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new Error("מקצוע לא נמצא");
  subject.obligations = subject.obligations.map((o) =>
    o.id === obligation.id ? obligation : o
  );
  await adminDb.collection("subjects").doc(subjectId).update({ obligations: subject.obligations });
  invalidateServerCache("subjects");
  return obligation;
}

export async function deleteObligation(subjectId: string, obligationId: string) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new Error("מקצוע לא נמצא");
  subject.obligations = subject.obligations.filter((o) => o.id !== obligationId);
  await adminDb.collection("subjects").doc(subjectId).update({ obligations: subject.obligations });
  invalidateServerCache("subjects");
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
    componentScores?: Record<number, number | null> | null;
    subItemScores?: Record<number, number | null> | null;
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
        componentScores: g.componentScores ?? null,
        subItemScores: g.subItemScores ?? null,
        status: g.status,
        notes: g.notes ?? null,
      };
      await adminDb.collection("grades").doc(id).set(grade);
      results.push(grade);
    } else {
      const doc = existing.docs[0]!;
      const updates = {
        score: g.score ?? null,
        componentScores: g.componentScores ?? null,
        subItemScores: g.subItemScores ?? null,
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
        componentScores: g.componentScores ?? null,
        subItemScores: g.subItemScores ?? null,
        status: g.status,
        notes: g.notes ?? null,
      });
    }
  }
  return results;
}

export async function getGradesByStudentsAndObligation(
  studentIds: string[],
  obligationId: string
): Promise<Map<string, Grade>> {
  const result = new Map<string, Grade>();
  if (studentIds.length === 0) return result;

  for (let i = 0; i < studentIds.length; i += 30) {
    const chunk = studentIds.slice(i, i + 30);
    const snap = await adminDb
      .collection("grades")
      .where("studentId", "in", chunk)
      .where("obligationId", "==", obligationId)
      .get();
    for (const doc of snap.docs) {
      const grade = { id: doc.id, ...doc.data() } as Grade;
      result.set(grade.studentId, grade);
    }
  }
  return result;
}

export async function upsertGradesBulk(
  entries: Array<{
    studentId: string;
    obligationId: string;
    score?: number | null;
    componentScores?: Record<number, number | null> | null;
    subItemScores?: Record<number, number | null> | null;
    status: SubmissionStatus;
    notes?: string | null;
  }>
): Promise<Grade[]> {
  if (entries.length === 0) return [];

  const byObligation = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byObligation.get(entry.obligationId) ?? [];
    list.push(entry);
    byObligation.set(entry.obligationId, list);
  }

  const existingMap = new Map<string, Grade>();
  for (const [obligationId, group] of byObligation) {
    const grades = await getGradesByStudentsAndObligation(
      group.map((e) => e.studentId),
      obligationId
    );
    for (const [studentId, grade] of grades) {
      existingMap.set(`${studentId}:${obligationId}`, grade);
    }
  }

  const results: Grade[] = [];
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = adminDb.batch();
  let opCount = 0;

  function commitBatch() {
    if (opCount > 0) {
      batches.push(batch);
      batch = adminDb.batch();
      opCount = 0;
    }
  }

  for (const entry of entries) {
    const key = `${entry.studentId}:${entry.obligationId}`;
    const existing = existingMap.get(key);

    if (existing) {
      batch.update(adminDb.collection("grades").doc(existing.id), {
        score: entry.score ?? null,
        componentScores: entry.componentScores ?? null,
        subItemScores: entry.subItemScores ?? null,
        status: entry.status,
        notes: entry.notes ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({
        ...existing,
        score: entry.score ?? null,
        componentScores: entry.componentScores ?? null,
        subItemScores: entry.subItemScores ?? null,
        status: entry.status,
        notes: entry.notes ?? null,
      });
    } else {
      const id = newId();
      const grade: Grade = {
        id,
        studentId: entry.studentId,
        obligationId: entry.obligationId,
        score: entry.score ?? null,
        componentScores: entry.componentScores ?? null,
        subItemScores: entry.subItemScores ?? null,
        status: entry.status,
        notes: entry.notes ?? null,
      };
      batch.set(adminDb.collection("grades").doc(id), grade);
      results.push(grade);
    }

    opCount++;
    if (opCount >= 500) commitBatch();
  }
  commitBatch();

  await Promise.all(batches.map((b) => b.commit()));
  return results;
}

export async function listClassesSimple() {
  return cached("classes:simple", 30_000, async () => {
    const snap = await adminDb.collection("classes").orderBy("name").get();
    return docsData<Class>(snap).map((cls) => ({
      id: cls.id,
      name: cls.name,
      gradeYear: cls.gradeYear,
    }));
  });
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
