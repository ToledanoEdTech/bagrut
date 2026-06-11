# מערכת מעקב בגרות - ישיבה תיכונית

מערכת Web לניהול פדגוגי ומעקב אחרי בחינות בגרות וחובות תלמידים.

## טכנולוגיה

- **Next.js 15** + TypeScript + Tailwind
- **Firebase Authentication** (Google Sign-In)
- **Cloud Firestore** (מאגר נתונים)
- **Firebase Admin SDK** (שרת)

## הרשאות

| תפקיד | גישה |
|-------|------|
| **מנהל (Admin)** | הרשאות מלאות — ניהול מבנה, ייבוא, צוות, ציונים |
| **מורה (Teacher)** | לפי הרשאות מוגדרות — ציונים ו/או צפייה בתלמידים |
| **תלמיד (Student)** | דשבורד אישי בלבד |

### מנהלי-על (bootstrap)

מוגדרים בקוד (`src/lib/roles.ts`) ואינם ניתנים לעריכה מהאתר:
- `yossitole@gmail.com`
- `yosseftole@zvialod.com`

### ניהול צוות והרשאות

מנהלים מנהלים הרשאות דרך **ניהול צוות והרשאות** (`/admin/staff`):

- **מנהל תיכון** — תפקיד `ADMIN` בצוות (הרשאות מלאות)
- **רכז שכבה** — תפקיד `TEACHER` + הרשאות לפי שכבה (למשל יא')
- **מורה מקצועי** — תפקיד `TEACHER` + הרשאות לפי מקצוע: הזנת ציונים + צפייה בתלמידים הרלוונטיים למקצוע בלבד (ללא עריכת נתוני תלמידים)
- **מורה כיתה** — תפקיד `TEACHER` + הרשאות לפי כיתה
- **עריכת תלמידים** — הרשאה נפרדת (`students:edit`) שניתנת למנהל לפי היקף (כל המערכת / שכבה / כיתה)

הרשאות נאכפות בשרת (API) ולא רק ב-UI. מורים קיימים ללא שדה `permissions` ממשיכים לקבל גישה מלאה (תאימות לאחור).
מורים מקצועיים שהוגדרו לפני העדכון — יש לערוך מחדש את ההרשאות ב"ניהול צוות והרשאות".

API:
- `POST /api/staff` — `{ email, name, role, permissions? }`
- `PATCH /api/staff` — `{ id, name?, role?, permissions? }`
- `DELETE /api/staff?id=...`

## הגדרת Firebase

### 1. צור פרויקט ב-[Firebase Console](https://console.firebase.google.com)

### 2. הפעל Authentication → Google

### 3. צור Firestore Database

### 4. העתק `.env.example` ל-`.env.local` ומלא

> **חשוב ל-GitHub:** קובץ `.env.local` מוגדר ב-`.gitignore` ולא יעלה לריפו. בפריסה (Vercel וכו') הגדר את אותם משתנים ב-Secrets של הפלטפורמה.

```bash
cp .env.example .env.local
```

- **Client config**: Firebase Console → Project Settings → General → Your apps → Web
- **Admin SDK**: Project Settings → Service Accounts → Generate new private key

### 5. התקנה והרצה

```bash
npm install
npm run db:seed
npm run dev
```

## מבנה Firestore

| Collection | תיאור |
|------------|--------|
| `users` | פרופילי משתמשים מחוברים |
| `students` | תלמידים (מקושרים לאימייל) |
| `staff` | מורים מורשים |
| `examPaths` | מסלולי היבחנות |
| `classes` | כיתות |
| `tracks` | מגמות |
| `subjects` | מקצועות + חובות (מוטמע) |
| `grades` | ציונים |

## ייבוא תוכנית לימודים

הנתונים מיובאים מ-`data/curriculum_parsed.json` (מקור: קובץ האקסל המקורי).

```bash
python scripts/parse_curriculum.py   # עדכון מהאקסל
npm run db:seed                       # טעינה ל-Firestore
```
