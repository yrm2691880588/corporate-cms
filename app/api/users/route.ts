import { NextRequest, NextResponse } from "next/server";
import { withErrorLogging } from "@/lib/api-wrapper";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, audit, hashPassword } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { getDb, now } from "@/lib/db";
import { users } from "@/lib/schema";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, "账号需 3-20 位字母、数字或下划线"),
  password: z.string().min(8, "密码至少 8 位"),
  displayName: z.string().trim().min(1, "请填写显示名称"),
  role: z.enum(["admin", "editor"]).default("editor"),
});

const updateSchema = z.object({
  id: z.number().int().positive(),
  password: z.string().min(8, "密码至少 8 位").optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

async function handlePOST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const { username, password, displayName, role } = parsed.data;

  const db = getDb();
  const exists = db.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
  if (exists) {
    return NextResponse.json({ error: "该账号已存在" }, { status: 400 });
  }

  const res = db
    .insert(users)
    .values({
      username,
      passwordHash: hashPassword(password),
      displayName,
      role,
      status: "active",
      createdAt: now(),
    })
    .run();

  const id = Number(res.lastInsertRowid);
  audit(me.id, "create", "user", id, username);

  return NextResponse.json({ ok: true, id });
}

async function handlePUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = updateSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const { id, password, status } = parsed.data;

  const db = getDb();
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  if (password) {
    if (me.id !== id && me.role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, id)).run();
    audit(me.id, "reset-password", "user", id, target.username);
    return NextResponse.json({ ok: true });
  }

  if (status) {
    if (me.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
    if (id === me.id) {
      return NextResponse.json({ error: "不能停用自己的账号" }, { status: 400 });
    }
    db.update(users).set({ status }).where(eq(users.id, id)).run();
    audit(me.id, status === "disabled" ? "disable-user" : "enable-user", "user", id, target.username);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "没有要修改的字段" }, { status: 400 });
}


// ── 统一错误捕获：异常写入 data/logs，客户端收到中文提示 ──
export const POST = withErrorLogging("POST /api/users", handlePOST);
export const PUT = withErrorLogging("PUT /api/users", handlePUT);
