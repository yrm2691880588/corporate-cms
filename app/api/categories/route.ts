import { NextRequest, NextResponse } from "next/server";
import { withErrorLogging } from "@/lib/api-wrapper";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, audit } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { getDb, now } from "@/lib/db";
import { categories } from "@/lib/schema";
import { normalizeSlug } from "@/lib/slug";


const categorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "名称不能为空").max(50, "名称不超过 50 字"),
  slug: z.string().trim().min(1, "URL 别名不能为空"),
  parentId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = categorySchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const slug = normalizeSlug(d.slug);
  if (!slug) {
    return NextResponse.json({ error: "URL 别名只能包含字母、数字、连字符" }, { status: 400 });
  }

  const db = getDb();

  if (db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get()) {
    return NextResponse.json({ error: `别名「${slug}」已被占用` }, { status: 400 });
  }

  // 只允许两级
  if (d.parentId) {
    const parent = db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, d.parentId))
      .get();
    if (!parent) return NextResponse.json({ error: "上级栏目不存在" }, { status: 400 });
    if (parent.parentId) return NextResponse.json({ error: "栏目最多两级" }, { status: 400 });
  }

  const res = db
    .insert(categories)
    .values({
      parentId: d.parentId ?? null,
      name: d.name,
      slug,
      description: d.description ?? null,
      sortOrder: d.sortOrder,
      isVisible: d.isVisible ? 1 : 0,
      createdAt: now(),
    })
    .run();

  const id = Number(res.lastInsertRowid);
  audit(user.id, "create", "category", id, d.name);
  return NextResponse.json({ ok: true, id });
}

async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = categorySchema.safeParse(body.data);
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json(
      { error: parsed.success ? "缺少 ID" : parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const id = d.id!;

  const db = getDb();
  const old = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!old) return NextResponse.json({ error: "栏目不存在" }, { status: 404 });

  const slug = normalizeSlug(d.slug);
  if (!slug) return NextResponse.json({ error: "URL 别名不合法" }, { status: 400 });

  const dup = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, slug), ne(categories.id, id)))
    .get();
  if (dup) return NextResponse.json({ error: `别名「${slug}」已被占用` }, { status: 400 });

  const parentId = d.parentId ?? null;
  if (parentId === id) {
    return NextResponse.json({ error: "上级栏目不能是自己" }, { status: 400 });
  }
  if (parentId) {
    const parent = db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, parentId))
      .get();
    if (!parent) return NextResponse.json({ error: "上级栏目不存在" }, { status: 400 });
    if (parent.parentId) return NextResponse.json({ error: "栏目最多两级" }, { status: 400 });

    const hasChild = db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, id))
      .get();
    if (hasChild) {
      return NextResponse.json({ error: "该栏目下有子栏目，不能再设为二级" }, { status: 400 });
    }
  }

  db.update(categories)
    .set({
      parentId,
      name: d.name,
      slug,
      description: d.description ?? null,
      sortOrder: d.sortOrder,
      isVisible: d.isVisible ? 1 : 0,
    })
    .where(eq(categories.id, id))
    .run();

  audit(user.id, "update", "category", id, d.name);
  return NextResponse.json({ ok: true });
}

async function handleDELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });

  const db = getDb();
  const hasChild = db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, id))
    .get();
  if (hasChild) {
    return NextResponse.json({ error: "请先删除子栏目" }, { status: 400 });
  }

  const row = db.select({ name: categories.name }).from(categories).where(eq(categories.id, id)).get();
  db.delete(categories).where(eq(categories.id, id)).run();
  audit(user.id, "delete", "category", id, row?.name ?? "");
  return NextResponse.json({ ok: true });
}


// ── 统一错误捕获：异常写入 data/logs，客户端收到中文提示 ──
export const POST = withErrorLogging("POST /api/categories", handlePOST);
export const PUT = withErrorLogging("PUT /api/categories", handlePUT);
export const DELETE = withErrorLogging("DELETE /api/categories", handleDELETE);
