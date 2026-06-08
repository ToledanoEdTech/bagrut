"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { User, Grid, Upload } from "lucide-react";

const TABS = [
  { href: "/admin/grades", label: "לפי תלמיד", exact: true, icon: User },
  { href: "/admin/grades/matrix", label: "לפי מטלה", icon: Grid },
  { href: "/admin/grades/import", label: "ייבוא", icon: Upload },
];

export default function GradesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="הזנת ציונים"
        subtitle="הזנת ציונים וסטטוס הגשה לחובות בגרות"
      />
      <div className="mt-6">
        <Tabs tabs={TABS} />
      </div>
      {children}
    </>
  );
}
