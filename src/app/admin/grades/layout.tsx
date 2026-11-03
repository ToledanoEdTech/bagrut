"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAuth } from "@/components/AuthProvider";
import { hasAnyGradeWrite } from "@/lib/permissions";
import { User, ClipboardList, Upload } from "lucide-react";

const TABS = [
  { href: "/admin/grades", label: "לפי תלמיד", exact: true, icon: User },
  { href: "/admin/grades/matrix", label: "לפי מטלה", icon: ClipboardList },
  { href: "/admin/grades/import", label: "ייבוא", icon: Upload },
];

export default function GradesLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!session || !hasAnyGradeWrite(session)) {
    return (
      <>
        <PageHeader
          title="הזנת ציונים"
          subtitle="הזנת ציונים לפי תלמיד או לפי מטלה"
        />
        <Alert variant="error" className="mt-6">
          אין הרשאה להזנת ציונים. צפייה בכיתה או בשכבה אינה מאפשרת להזין או לערוך ציונים.
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="הזנת ציונים"
        subtitle="הזנת ציונים לפי תלמיד או לפי מטלה"
      />
      <div className="mt-6">
        <Tabs tabs={TABS} />
      </div>
      {children}
    </>
  );
}
