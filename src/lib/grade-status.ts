import type { SubmissionStatus } from "@/lib/types";

export const STATUS_LABELS: Record<
  SubmissionStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: { label: "לא התחיל", className: "badge-muted" },
  IN_PROGRESS: { label: "בתהליך", className: "badge-warning" },
  SUBMITTED: { label: "הוגש", className: "badge-info" },
  GRADED: { label: "נבדק", className: "badge-success" },
  EXEMPT: { label: "פטור", className: "badge-muted" },
};

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "GRADED",
  "EXEMPT",
];

export function isValidSubmissionStatus(value: string): value is SubmissionStatus {
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus);
}

export function validateScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return true;
  return typeof score === "number" && !isNaN(score) && score >= 0 && score <= 100;
}

const STATUS_ALIASES: Record<string, SubmissionStatus> = {
  "לא התחיל": "NOT_STARTED",
  "not started": "NOT_STARTED",
  not_started: "NOT_STARTED",
  "בתהליך": "IN_PROGRESS",
  "in progress": "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  "הוגש": "SUBMITTED",
  submitted: "SUBMITTED",
  "נבדק": "GRADED",
  graded: "GRADED",
  "פטור": "EXEMPT",
  exempt: "EXEMPT",
};

export function parseStatusInput(value: string): SubmissionStatus | null {
  const trimmed = value.trim();
  if (isValidSubmissionStatus(trimmed)) return trimmed;
  const normalized = trimmed.toLowerCase();
  return STATUS_ALIASES[trimmed] ?? STATUS_ALIASES[normalized] ?? null;
}

/** When a score is entered, auto-upgrade status from NOT_STARTED/IN_PROGRESS to GRADED */
export function autoStatusOnScore(
  score: number | null,
  currentStatus: SubmissionStatus
): SubmissionStatus {
  if (score != null && (currentStatus === "NOT_STARTED" || currentStatus === "IN_PROGRESS")) {
    return "GRADED";
  }
  return currentStatus;
}
