import { NextResponse } from "next/server";
import { getCurrentUser, destroySession, audit } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) audit(user.id, "logout", "user", user.id);
  await destroySession();
  return NextResponse.json({ ok: true });
}
