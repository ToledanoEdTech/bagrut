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
| **מנהל (Admin)** | הרשאות מלאות — ניהול מבנה, ייבוא, ציונים |
| **מורה (Teacher)** | צפייה בתלמידים + הזנת ציונים |
| **תלמיד (Student)** | דשבורד אישי בלבד |

מנהלים מוגדרים לפי אימייל:
- `yossitole@gmail.com`
- `yosseftole@zvialod.com`

מורים נוספים נוספים דרך API: `POST /api/staff` עם `{ "email": "...", "name": "..." }`

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
