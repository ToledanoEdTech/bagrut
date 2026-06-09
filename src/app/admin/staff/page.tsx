"use client";

import { useState } from "react";
import { Plus, Trash2, UserCog } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  buildStaffSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";

type StaffMember = { id: string; email: string; name: string; role: string };

export default function StaffPage() {
  const { data: staff = [], loading, mutate: refreshStaff } = useApi<StaffMember[]>("/api/staff");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  async function load() {
    await refreshStaff();
  }

  async function addStaff() {
    if (!email) return;
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || email }),
    });
    if (res.ok) {
      setEmail("");
      setName("");
      load();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  }

  async function remove(id: string) {
    if (!confirm("להסיר מורה זה?")) return;
    await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
    load();
  }

  async function handleExport() {
    await downloadExcel(`צוות_${exportTimestamp()}.xlsx`, [buildStaffSheet(staff)]);
  }

  if (loading && staff.length === 0) {
    return <PageLoader />;
  }

  return (
    <>
      <PageHeader
        title="ניהול צוות מורים"
        subtitle="הוספת מורים שיוכלו להתחבר עם Google ולהזין ציונים"
      >
        <ExportButton onExport={handleExport} disabled={staff.length === 0} />
      </PageHeader>

      <div className="mt-8 card p-6">
        <h2 className="font-semibold">הוספת מורה</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">אימייל Google</label>
            <input
              className="input"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@zvialod.com"
            />
          </div>
          <div>
            <label className="label">שם (אופציונלי)</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <button onClick={addStaff} className="btn-primary mt-4">
          <Plus className="h-4 w-4" />
          הוספה
        </button>
      </div>

      <div className="mt-6 card overflow-hidden">
        {loading ? (
          <p className="p-6 text-slate-500">טוען...</p>
        ) : staff.length === 0 ? (
          <p className="p-6 text-slate-500">אין מורים מוגדרים</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">שם</th>
                <th className="px-4 py-3 text-right font-medium">אימייל</th>
                <th className="px-4 py-3 text-right font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {s.email}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remove(s.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-xl bg-primary-50 p-4 text-sm text-primary-800">
        <div className="flex items-center gap-2 font-medium">
          <UserCog className="h-4 w-4" />
          מנהלים מוגדרים בקוד
        </div>
        <p className="mt-1 text-primary-600">
          yossitole@gmail.com, yosseftole@zvialod.com — הרשאות מנהל מלאות
        </p>
      </div>
    </>
  );
}
