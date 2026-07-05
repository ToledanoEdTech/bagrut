import {
  formatDueDateHe,
  MAX_ITEMS_IN_EMAIL,
  type OverdueGradeItem,
} from "@/lib/grade-reminders";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function duePhrase(item: OverdueGradeItem): string {
  if (item.kind === "pre_due") {
    const n = item.daysBeforeDue ?? 0;
    if (n === 1) return "מחר";
    return `בעוד ${n} ימים`;
  }
  return "חלף";
}

function formatItemLine(item: OverdueGradeItem): string {
  const timing =
    item.kind === "pre_due"
      ? `— מועד הזנה ${duePhrase(item)} (${formatDueDateHe(item.gradeEntryDueDate)})`
      : `— יעד חלף: ${formatDueDateHe(item.gradeEntryDueDate)}`;
  const parts = [
    item.subjectName,
    item.obligationLabel,
    item.examEvent ? `(${item.examEvent})` : null,
    timing,
    `(${item.missingStudentCount} תלמידים חסרים)`,
  ].filter(Boolean);
  return parts.join(" ");
}

export function renderGradeReminderEmail(options: {
  recipientName: string;
  items: OverdueGradeItem[];
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { recipientName, items, appUrl } = options;
  const shown = items.slice(0, MAX_ITEMS_IN_EMAIL);
  const remaining = items.length - shown.length;
  const gradesUrl = `${appUrl.replace(/\/$/, "")}/admin/grades`;

  const hasOverdue = items.some((i) => i.kind !== "pre_due");

  const subject = hasOverdue
    ? "תזכורת: יש להזין ציונים לאירועי בחינה"
    : "תזכורת מקדימה: מתקרב מועד הזנת ציונים";

  const intro = hasOverdue
    ? "מועד ההזנה לחלק מהציונים הבאים חלף ועדיין חסרים ציונים:"
    : "מתקרב מועד ההזנה לציונים הבאים, שעדיין חסרים:";

  const lines = shown.map((item) => `• ${formatItemLine(item)}`);
  if (remaining > 0) {
    lines.push(`• ועוד ${remaining} מטלות נוספות`);
  }

  const text = [
    `שלום ${recipientName},`,
    "",
    intro,
    "",
    ...lines,
    "",
    `לטיפול באתר: ${gradesUrl}`,
    "",
    "הודעה זו נשלחה אוטומטית ממערכת מעקב בגרות.",
  ].join("\n");

  const listHtml = shown
    .map(
      (item) => `
      <li style="margin-bottom:10px;line-height:1.6;">
        <strong>${escapeHtml(item.subjectName)}</strong> — ${escapeHtml(item.obligationLabel)}
        ${item.examEvent ? `<span style="color:#64748b;"> (${escapeHtml(item.examEvent)})</span>` : ""}
        ${item.kind === "pre_due" ? `<span style="color:#0369a1;font-weight:600;"> · תזכורת מקדימה (${escapeHtml(duePhrase(item))})</span>` : ""}
        <br />
        <span style="color:#475569;font-size:14px;">
          ${item.kind === "pre_due" ? "מועד הזנה" : "יעד הזנה"}: ${escapeHtml(formatDueDateHe(item.gradeEntryDueDate))}
          · ${item.missingStudentCount} תלמידים ללא ציון
          ${item.classNames.length ? `· כיתות: ${escapeHtml(item.classNames.join(", "))}` : ""}
        </span>
      </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:700;">תזכורת הזנת ציונים</h1>
              <p style="margin:8px 0 0;font-size:14px;opacity:0.95;">מערכת מעקב בגרות — ישיבה תיכונית</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#0f172a;">
              <p style="margin:0 0 16px;font-size:16px;">שלום ${escapeHtml(recipientName)},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">
                ${escapeHtml(intro)} נא להשלים את ההזנה בהקדם.
              </p>
              <ul style="margin:0 0 24px;padding-right:20px;color:#0f172a;">
                ${listHtml}
                ${remaining > 0 ? `<li style="color:#64748b;">ועוד ${remaining} מטלות נוספות</li>` : ""}
              </ul>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:8px;background:#2563eb;">
                    <a href="${escapeHtml(gradesUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                      לטיפול באתר
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f1f5f9;color:#64748b;font-size:12px;line-height:1.6;">
              הודעה זו נשלחה אוטומטית. אם כבר הוזנו הציונים, ניתן להתעלם מהודעה זו.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function renderTestEmail(): { subject: string; html: string; text: string } {
  const subject = "בדיקת מערכת מייל — מעקב בגרות";
  const text =
    "זוהי הודעת בדיקה ממערכת מעקב בגרות.\nאם קיבלת מייל זה, הגדרות ה-SMTP תקינות.";
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;direction:rtl;text-align:right;padding:24px;">
  <h2 style="color:#1d4ed8;">בדיקת מערכת מייל</h2>
  <p>זוהי הודעת בדיקה ממערכת מעקב בגרות.</p>
  <p>אם קיבלת מייל זה, הגדרות ה-SMTP תקינות.</p>
</body>
</html>`;
  return { subject, html, text };
}
