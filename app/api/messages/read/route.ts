import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/schema";

/**
 * 更新留言状态
 *
 * 支持两种标记，可单独使用：
 * - isRead：是否看过（影响未读红点）
 * - isProcessed：是否已跟进处理（影响待办感）
 *
 * 两者分开是因为「看过」不等于「办完」：扫一眼没回，仍然要跟进。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const b = body.data as any;
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });

  const patch: { isRead?: number; isProcessed?: number } = {};
  if (typeof b.isRead === "boolean") patch.isRead = b.isRead ? 1 : 0;
  if (typeof b.isProcessed === "boolean") patch.isProcessed = b.isProcessed ? 1 : 0;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有要更新的状态" }, { status: 400 });
  }

  getDb().update(messages).set(patch).where(eq(messages.id, id)).run();
  return NextResponse.json({ ok: true });
}
