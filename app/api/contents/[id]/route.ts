import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser, audit } from "@/lib/auth";
import { getDb, now } from "@/lib/db";
import { contents } from "@/lib/schema";

/** 软删除时给 slug 加的后缀，用于释放原 slug 并标记回收站条目 */
const TRASH_SUFFIX = "--trash-";

/** 从路径参数取 ID（与前端 /api/contents/[id] 的调用方式一致） */
async function resolveId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  return Number(id);
}

/**
 * 软删除内容（进回收站，可恢复）
 *
 * 【为什么删除时要改 slug】
 * slug 上有 UNIQUE 约束。如果删除后仍保留原值，
 * 这个 URL 会被永久占用，无法再创建同名内容，即使原内容已经删了。
 * 因此删除时把 slug 改成 `原slug--trash-<id>`，既释放原 slug，也留下可追溯标记。
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const id = await resolveId(params);
  if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });

  const db = getDb();
  const row = db.select().from(contents).where(eq(contents.id, id)).get();
  if (!row) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (row.deletedAt) return NextResponse.json({ error: "内容已在回收站中" }, { status: 400 });

  const t = now();
  // slug 已被加过回收站后缀时不要重复添加
  const trashedSlug = row.slug.includes(TRASH_SUFFIX)
    ? row.slug
    : `${row.slug}${TRASH_SUFFIX}${id}`;

  db.update(contents)
    .set({ deletedAt: t, updatedAt: t, slug: trashedSlug })
    .where(eq(contents.id, id))
    .run();

  audit(user.id, "delete", "content", id, row.title);
  return NextResponse.json({ ok: true });
}

/**
 * 回收站操作：action=restore 恢复 / purge 永久删除
 * 调用方式：PATCH /api/contents/<id>?action=restore
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const id = await resolveId(params);
  const action = new URL(req.url).searchParams.get("action");
  if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
  if (action !== "restore" && action !== "purge") {
    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  }

  const db = getDb();
  const row = db.select().from(contents).where(eq(contents.id, id)).get();
  if (!row) return NextResponse.json({ error: "内容不存在" }, { status: 404 });

  if (action === "purge") {
    // 永久删除不可撤销，必须管理员；回收站页面虽有前端限制，
    // 但接口必须自己校验，否则编辑可绕过界面直接调用
    if (user.role !== "admin") {
      return NextResponse.json({ error: "永久删除需要管理员权限" }, { status: 403 });
    }
    if (!row.deletedAt) {
      return NextResponse.json({ error: "只有回收站中的内容才能永久删除" }, { status: 400 });
    }
    db.delete(contents).where(eq(contents.id, id)).run();
    audit(user.id, "purge", "content", id, row.title);
    return NextResponse.json({ ok: true });
  }

  // restore
  if (!row.deletedAt) return NextResponse.json({ error: "内容不在回收站" }, { status: 400 });

  const marker = `${TRASH_SUFFIX}${id}`;
  let slug = row.slug.endsWith(marker) ? row.slug.slice(0, -marker.length) : row.slug;
  if (!slug) slug = `restored-${id}`;

  // 原 slug 可能已被新内容占用，此时加后缀避免冲突
  const taken = db
    .select({ id: contents.id })
    .from(contents)
    .where(and(eq(contents.slug, slug), ne(contents.id, id)))
    .get();
  if (taken) slug = `${slug}-restored-${id}`;

  const t = now();
  db.update(contents)
    .set({ deletedAt: null, updatedAt: t, slug, status: "draft" })
    .where(eq(contents.id, id))
    .run();

  audit(user.id, "restore", "content", id, row.title);
  return NextResponse.json({ ok: true, slug });
}
