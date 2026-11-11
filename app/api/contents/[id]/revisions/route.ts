import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser, audit } from "@/lib/auth";
import { getDb, now } from "@/lib/db";
import { contents, contentRevisions } from "@/lib/schema";

/** 列出某篇内容的历史版本 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id: idStr } = await params;
  const contentId = Number(idStr);
  if (!contentId) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });

  const rows = getDb()
    .select({
      id: contentRevisions.id,
      title: contentRevisions.title,
      summary: contentRevisions.summary,
      createdAt: contentRevisions.createdAt,
      editorId: contentRevisions.editorId,
    })
    .from(contentRevisions)
    .where(eq(contentRevisions.contentId, contentId))
    .orderBy(desc(contentRevisions.createdAt))
    .all();

  return NextResponse.json({ revisions: rows });
}

/**
 * 回滚到指定版本
 *
 * 调用方式：POST /api/contents/<id>/revisions?revisionId=<版本ID>
 * 行为：把该版本的内容取出来写回主表，并**先把当前内容另存一个新版本**，
 * 因此回滚本身也是可撤销的（不会丢东西）。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id: idStr } = await params;
  const contentId = Number(idStr);
  const revisionId = Number(new URL(req.url).searchParams.get("revisionId"));
  if (!contentId || !revisionId) {
    return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
  }

  const db = getDb();
  const current = db.select().from(contents).where(eq(contents.id, contentId)).get();
  if (!current || current.deletedAt) {
    return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  }

  const rev = db
    .select()
    .from(contentRevisions)
    .where(
      and(eq(contentRevisions.id, revisionId), eq(contentRevisions.contentId, contentId))
    )
    .get();
  if (!rev) {
    return NextResponse.json({ error: "版本不存在或不属于这篇内容" }, { status: 404 });
  }

  const t = now();

  // 先把当前状态存成一个版本，保证「回滚」本身也能被回滚
  db.insert(contentRevisions)
    .values({
      contentId,
      title: current.title,
      summary: current.summary,
      body: current.body,
      editorId: user.id,
      createdAt: t,
    })
    .run();

  // 再写回目标版本
  db.update(contents)
    .set({
      title: rev.title,
      summary: rev.summary,
      body: rev.body,
      lastEditorId: user.id,
      updatedAt: t,
    })
    .where(eq(contents.id, contentId))
    .run();

  audit(user.id, "rollback", "content", contentId, `回滚到版本 #${revisionId}：${rev.title}`);

  return NextResponse.json({ ok: true });
}
