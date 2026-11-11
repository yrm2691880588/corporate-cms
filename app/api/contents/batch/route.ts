import { NextRequest, NextResponse } from "next/server";
import { inArray, eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, audit } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { getDb, now } from "@/lib/db";
import { contents } from "@/lib/schema";
import { withErrorLogging } from "@/lib/api-wrapper";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "请至少选择一条").max(100, "一次最多 100 条"),
  action: z.enum(["publish", "offline", "delete"]),
});

/**
 * 批量操作
 *
 * 支持三种：发布、下线、删除（软删除进回收站）。
 * 一次最多 100 条 —— 防止误操作一次影响太多内容，
 * 也避免单次请求耗时过长。
 *
 * 删除时会像单条删除一样释放 slug（加回收站后缀），
 * 否则批量删除后这些 URL 会被永久占用。
 */
async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不正确" },
      { status: 400 }
    );
  }

  const { ids, action } = parsed.data;
  const db = getDb();
  const t = now();

  // 只处理未删除的内容
  const rows = db
    .select({ id: contents.id, title: contents.title, slug: contents.slug })
    .from(contents)
    .where(and(inArray(contents.id, ids), isNull(contents.deletedAt)))
    .all();

  if (rows.length === 0) {
    return NextResponse.json({ error: "没有可操作的内容" }, { status: 400 });
  }

  if (action === "publish") {
    db.update(contents)
      .set({ status: "published", publishedAt: t, updatedAt: t, lastEditorId: user.id })
      .where(inArray(contents.id, rows.map((r) => r.id)))
      .run();
  } else if (action === "offline") {
    db.update(contents)
      .set({ status: "offline", updatedAt: t, lastEditorId: user.id })
      .where(inArray(contents.id, rows.map((r) => r.id)))
      .run();
  } else {
    // 删除：逐条处理，因为每条要生成不同的回收站 slug
    for (const r of rows) {
      const trashed = r.slug.includes("--trash-") ? r.slug : `${r.slug}--trash-${r.id}`;
      db.update(contents)
        .set({ deletedAt: t, updatedAt: t, slug: trashed })
        .where(eq(contents.id, r.id))
        .run();
    }
  }

  audit(
    user.id,
    action === "delete" ? "delete" : "update",
    "content",
    undefined,
    `批量${action === "publish" ? "发布" : action === "offline" ? "下线" : "删除"} ${rows.length} 条`
  );

  return NextResponse.json({ ok: true, affected: rows.length });
}

export const POST = withErrorLogging("POST /api/contents/batch", handlePOST);
