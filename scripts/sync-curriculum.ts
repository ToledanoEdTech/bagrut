/**
 * Sync obligations from curriculum_parsed.json into existing Firestore subjects.
 * Matches by name + units + category. Does not delete students or grades.
 */
import { readFileSync } from "fs";
import path from "path";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

import { adminDb } from "../src/lib/firebase/admin";
import type { SubjectCategory } from "../src/lib/types";

type ParsedCurriculum = {
  paths: Array<{
    key: string;
    subjects: Array<{
      name: string;
      units: number | null;
      obligations: Array<{
        questionnaireNumber: string | null;
        weightPercent: number;
        eventName: string | null;
        examType: string;
        studyMaterial: string | null;
        examEvent: string | null;
        gradeYear: string | null;
        components: Array<{ name: string; weightPercent: number }>;
        subItems?: Array<{ name: string; weightPercent: number }>;
      }>;
    }>;
  }>;
};

const ELECTIVE_SOURCE_KEYS = new Set(["flexible"]);

function categoryForPath(key: string, subjectName: string): SubjectCategory {
  if (ELECTIVE_SOURCE_KEYS.has(key)) {
    if (subjectName.includes("מתמטיקה")) return "MATH";
    if (subjectName.includes("אנגלית")) return "ENGLISH";
    return "TRACK";
  }
  return "MANDATORY";
}

function subjectKey(name: string, units: number | null, category: SubjectCategory) {
  return `${category}|${name}|${units ?? 0}`;
}

function newId() {
  return adminDb.collection("_").doc().id;
}

function obligationKey(o: {
  questionnaireNumber?: string | null;
  name?: string | null;
  weightPercent?: number;
  examEvent?: string | null;
  gradeYear?: string | null;
}) {
  return [
    o.questionnaireNumber ?? "",
    o.name ?? "",
    o.weightPercent ?? 0,
    o.examEvent ?? "",
    o.gradeYear ?? "",
  ].join("|");
}

function mapObligations(
  parsed: ParsedCurriculum["paths"][0]["subjects"][0]["obligations"],
  existing: Array<{ id: string } & Record<string, unknown>> = []
) {
  const existingByKey = new Map(
    existing.map((o) => [
      obligationKey(
        o as {
          questionnaireNumber?: string | null;
          name?: string | null;
          weightPercent?: number;
          examEvent?: string | null;
          gradeYear?: string | null;
        }
      ),
      o,
    ])
  );
  const usedIds = new Set<string>();

  return parsed.map((o, i) => {
    const key = obligationKey({
      questionnaireNumber: o.questionnaireNumber,
      name: o.eventName,
      weightPercent: o.weightPercent,
      examEvent: o.examEvent,
      gradeYear: o.gradeYear,
    });
    const prev = existingByKey.get(key);
    let id = prev?.id ?? newId();
    if (usedIds.has(id)) {
      id = newId();
    }
    usedIds.add(id);
    return {
      id,
      questionnaireNumber: o.questionnaireNumber,
      name: o.eventName,
      weightPercent: o.weightPercent,
      examType: o.examType,
      studyMaterial: o.studyMaterial,
      examEvent: o.examEvent,
      gradeYear: o.gradeYear,
      sortOrder: i,
      components: o.components.map((c, j) => ({ ...c, sortOrder: j })),
      subItems: (o.subItems ?? []).map((si, j) => ({ ...si, sortOrder: j })),
    };
  });
}

async function main() {
  const dataPath = path.join(process.cwd(), "data", "curriculum_parsed.json");
  const data: ParsedCurriculum = JSON.parse(readFileSync(dataPath, "utf-8"));

  const parsedByKey = new Map<
    string,
    ParsedCurriculum["paths"][0]["subjects"][0]
  >();

  for (const p of data.paths) {
    for (const s of p.subjects) {
      const cat = categoryForPath(p.key, s.name);
      parsedByKey.set(subjectKey(s.name, s.units, cat), s);
    }
  }

  const snap = await adminDb.collection("subjects").get();
  let updated = 0;
  let created = 0;

  for (const doc of snap.docs) {
    const subject = doc.data();
    const key = subjectKey(subject.name, subject.units ?? null, subject.category);
    const parsed = parsedByKey.get(key);
    if (!parsed) continue;

    const obligations = mapObligations(
      parsed.obligations,
      (subject.obligations as Array<{ id: string } & Record<string, unknown>>) ?? []
    );

    await doc.ref.update({ obligations });
    updated++;
    parsedByKey.delete(key);
  }

  // Create subjects that exist in curriculum but not in Firestore (flexible electives)
  for (const [key, s] of parsedByKey) {
    const [category, name, unitsStr] = key.split("|");
    const units = parseInt(unitsStr) || null;
    const id = newId();
    const obligations = mapObligations(s.obligations);

    await adminDb.collection("subjects").doc(id).set({
      id,
      name,
      units,
      category,
      trackId: null,
      obligations,
    });
    created++;
  }

  console.log(`Sync complete: ${updated} subjects updated, ${created} created.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
