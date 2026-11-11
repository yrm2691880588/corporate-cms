import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb, now } from "@/lib/db";
import { messages } from "@/lib/schema";
import { getClientKey } from "@/lib/client-ip";

/** 同 IP 限流：10 分钟内最多 3 条 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

const messageSchema = z.object({
  name: z.string().trim().min(1, "请填写正确的称呼").max(50, "称呼过长"),
  contact: z.string().trim().min(1, "请填写正确的联系方式").max(100, "联系方式过长"),
  content: z
    .string()
    .trim()
    .min(2, "留言内容至少 2 个字")
    .max(1000, "留言内容不能超过 1000 字"),
  // 蜜罐字段：正常用户看不见也不会填
  website: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "提交内容不合法" },
      { status: 400 }
    );
  }

  const { name, contact, content, website } = parsed.data;

  // 机器人填了隐藏字段：假装成功，不写入
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  const hash = getClientKey(req);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const recent = db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.ipHash, hash), gt(messages.createdAt, since)))
    .all().length;

  if (recent >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "提交过于频繁，请稍后再试" }, { status: 429 });
  }

  db.insert(messages)
    .values({
      name,
      contact,
      content,
      sourceUrl: req.headers.get("referer") ?? null,
      ipHash: hash,
      isRead: 0,
      createdAt: now(),
    })
    .run();

  return NextResponse.json({ ok: true });
}
