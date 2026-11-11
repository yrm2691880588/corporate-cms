import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull, like, or } from "drizzle-orm";
import { getCurrentUser, audit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { media, contents } from "@/lib/schema";
import { getUploadsDir } from "@/lib/paths";
import { count } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });

  const db = getDb();
  const row = db.select().from(media).where(eq(media.id, id)).get();
  if (!row) return NextResponse.json({ error: "图片不存在" }, { status: 404 });

  // 检查是否被内容引用（正文含该 URL 或用作封面）
  const url = `/uploads/${row.filename}`;
  const used = Number(
    db
      .select({ n: count() })
      .from(contents)
      .where(
        and(
          isNull(contents.deletedAt),
          or(like(contents.body, `%${url}%`), eq(contents.coverImage, url))
        )
      )
      .get()?.n ?? 0
  );

  if (used > 0) {
    return NextResponse.json(
      { error: `这张图片正被 ${used} 篇内容使用，请先移除引用` },
      { status: 400 }
    );
  }

  const base = getUploadsDir();
  const targets = [path.join(base, row.filename)];
  if (row.thumbPath) targets.push(path.join(base, row.thumbPath.replace("/uploads/", "")));

  for (const t of targets) {
    try {
      await fs.unlink(t);
    } catch {
      /* 文件可能已不存在，忽略 */
    }
  }

  db.delete(media).where(eq(media.id, id)).run();
  audit(user.id, "delete", "media", id, row.originalName);

  return NextResponse.json({ ok: true });
}
