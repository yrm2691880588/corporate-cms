import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, audit } from "@/lib/auth";
import { getUploadsDir } from "@/lib/paths";
import { readJson } from "@/lib/http";
import { getDb, now } from "@/lib/db";
import { media } from "@/lib/schema";
import { cropToWebp } from "@/lib/crop";
import { withErrorLogging } from "@/lib/api-wrapper";

const schema = z.object({
  mediaId: z.number().int().positive(),
  crop: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  rotate: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .default(0),
});

/**
 * 裁剪已有图片
 *
 * 总是另存为新图片，不覆盖原图。
 * 原因：原图可能已被多篇内容引用，覆盖会让那些地方突然变形，
 * 而用户通常只是想「另做一个版本」。
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
  const { mediaId, crop, rotate } = parsed.data;

  const db = getDb();
  const row = db.select().from(media).where(eq(media.id, mediaId)).get();
  if (!row) return NextResponse.json({ error: "图片不存在" }, { status: 404 });

  const uploadsRoot = getUploadsDir();
  const srcPath = path.join(uploadsRoot, row.filename);

  let input: Buffer;
  try {
    input = await fs.readFile(srcPath);
  } catch {
    return NextResponse.json({ error: "原始图片文件不存在" }, { status: 404 });
  }

  let outBuf: Buffer;
  try {
    outBuf = await cropToWebp(input, {
      crop,
      rotate,
      outputWidth: 1920,
      quality: 82,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "裁剪失败" },
      { status: 400 }
    );
  }

  // 存到与原图相同的月份目录
  const dir = path.dirname(row.filename);
  const id = crypto.randomBytes(8).toString("hex");
  const filename = `${id}.webp`;
  const subDir = path.join(uploadsRoot, dir);
  await fs.mkdir(subDir, { recursive: true });
  await fs.writeFile(path.join(subDir, filename), outBuf);

  // 缩略图
  const thumbName = `${id}-thumb.webp`;
  await sharp(outBuf)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(path.join(subDir, thumbName));

  const meta = await sharp(outBuf).metadata();

  const res = db
    .insert(media)
    .values({
      filename: `${dir}/${filename}`,
      originalName: `${row.originalName.replace(/\.[^.]+$/, "")}-裁剪.webp`,
      mimeType: "image/webp",
      sizeBytes: outBuf.length,
      width: meta.width ?? null,
      height: meta.height ?? null,
      thumbPath: `/uploads/${dir}/${thumbName}`,
      uploadedBy: user.id,
      createdAt: now(),
    })
    .run();

  const newId = Number(res.lastInsertRowid);
  audit(user.id, "create", "media", newId, `裁剪自 #${mediaId}`);

  return NextResponse.json({
    ok: true,
    id: newId,
    url: `/uploads/${dir}/${filename}`,
    thumbUrl: `/uploads/${dir}/${thumbName}`,
    width: meta.width ?? null,
    height: meta.height ?? null,
    size: outBuf.length,
  });
}

export const POST = withErrorLogging("POST /api/media/crop", handlePOST);
