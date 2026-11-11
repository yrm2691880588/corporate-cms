import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { media } from "@/lib/schema";

/** 图库列表（供编辑器选图用） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const items = getDb()
    .select({
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      sizeBytes: media.sizeBytes,
      width: media.width,
      height: media.height,
      thumbPath: media.thumbPath,
    })
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(500)
    .all();

  return NextResponse.json({ items });
}
