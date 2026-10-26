/**
 * חישוב ממוצע בגרות משוקלל לפי יחידות לימוד.
 *
 * הממוצע מחושב כך שכל ציון מקצוע נשקל לפי מספר יחידות הלימוד שלו:
 *   ממוצע = Σ(ציון_מקצוע × יח"ל_מקצוע) / Σ(יח"ל_מקצוע)
 *
 * לדוגמה: תלמיד עם 5 יח"ל מתמטיקה בציון 100 ו-2 יח"ל אנגלית בציון 80
 * מקבל ממוצע (5×100 + 2×80) / (5+2) = 660/7 ≈ 94.3
 *
 * מקצועות ללא ציון (estimatedGrade == null) אינם נכללים במונה ובמכנה.
 * מעורבות חברתית (קטגוריה SOCIAL) ומקצועות עם 0 יח"ל
 * (השכלה כללית, מבוא למדעים, חינוך גופני) אינם נכללים בממוצע.
 * כישלון בהם עדיין שולל זכאות — זה נבדק בנפרד בזכאות לבגרות.
 */

import { isSocialCategory } from "@/lib/social-involvement";

export type WeightedAverageSubject = {
  units: number | null;
  category?: string | null;
  progress: { estimatedGrade: number | null };
};

export type WeightedBagrutAverage = {
  average: number | null;
  totalUnits: number;
  gradedSubjectsCount: number;
};

/**
 * מספר יחידות אפקטיבי למקצוע לצורך שקלול.
 * 0 יח"ל (או מעורבות חברתית) = לא נכנס לממוצע.
 * יחידות שלא הוגדרו (null) נספרות כ-1.
 */
export function resolveSubjectUnits(subject: {
  units: number | null;
  category?: string | null;
}): number {
  if (isSocialCategory(subject.category)) return 0;
  if (subject.units === 0) return 0;
  if (subject.units != null && subject.units > 0) return subject.units;
  return 1;
}

export function calcWeightedBagrutAverage(
  subjects: WeightedAverageSubject[]
): WeightedBagrutAverage {
  let weightedSum = 0;
  let totalUnits = 0;
  let gradedSubjectsCount = 0;

  for (const subject of subjects) {
    if (isSocialCategory(subject.category)) continue;
    const grade = subject.progress.estimatedGrade;
    if (grade == null) continue;
    const units = resolveSubjectUnits(subject);
    if (units <= 0) continue;
    weightedSum += grade * units;
    totalUnits += units;
    gradedSubjectsCount += 1;
  }

  const average = totalUnits > 0 ? Math.round((weightedSum / totalUnits) * 10) / 10 : null;

  return { average, totalUnits, gradedSubjectsCount };
}
