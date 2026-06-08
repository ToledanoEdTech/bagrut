@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   מערכת מעקב בגרות - הרצה מקומית
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo שגיאה: Node.js לא מותקן.
    echo הורד מ: https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo מתקין תלויות...
    call npm install
    if errorlevel 1 (
        echo שגיאה בהתקנת התלויות.
        pause
        exit /b 1
    )
    echo.
)

if not exist ".env.local" (
    echo אזהרה: קובץ .env.local לא נמצא.
    if exist ".env.example" (
        echo מעתיק מ-.env.example...
        copy ".env.example" ".env.local" >nul
        echo נוצר .env.local - מלא את פרטי Firebase ואז הרץ שוב.
        pause
        exit /b 1
    ) else (
        echo צור קובץ .env.local עם הגדרות Firebase.
        pause
        exit /b 1
    )
)

echo מפעיל שרת פיתוח...
echo.
echo   האתר: http://localhost:3000
echo   לעצירה: Ctrl+C
echo.
call npm run dev

pause
