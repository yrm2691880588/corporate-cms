import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { getCurrentUser, audit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword, checkPassword } from "@/lib/password";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * 修改自己的密码
 *
 * 【为什么单独一个接口】
 * /api/users 的 PUT 需要传目标用户 id，而编辑角色无法进入用户管理页，
 * 也就没有修改自己密码的入口。这个接口固定操作「当前登录用户」，
 * 因此所有已登录角色都能用。
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = String((body as any)?.currentPassword ?? "");
  const newPassword = String((body as any)?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "请填写当前密码和新密码" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "新密码至少 8 位" }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
  }

  const db = getDb();
  const row = db.select().from(users).where(eq(users.id, me.id)).get();
  if (!row) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  // 校验当前密码
  if (!checkPassword(currentPassword, row.passwordHash)) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, me.id)).run();
  audit(me.id, "reset-password", "user", me.id, "修改自己的密码");

  return NextResponse.json({ ok: true });
}
