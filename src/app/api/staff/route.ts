import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const snap = await adminDb.collection("staff").orderBy("email").get();
  const staff = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { email, name } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "חסר אימייל" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();
  const existing = await adminDb
    .collection("staff")
    .where("email", "==", normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ error: "מורה כבר קיים" }, { status: 400 });
  }

  const doc = await adminDb.collection("staff").add({
    email: normalized,
    name: name ?? normalized,
    role: "TEACHER",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: doc.id, email: normalized, name, role: "TEACHER" });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });

  await adminDb.collection("staff").doc(id).delete();
  return NextResponse.json({ success: true });
}
