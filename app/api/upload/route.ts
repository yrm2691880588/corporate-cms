import { NextRequest, NextResponse } from "next/server";
import { withErrorLogging } from "@/lib/api-wrapper";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { getUploadsDir } from "@/lib/paths";
import { getDb, now } from "@/lib/db";
import { media } from "@/lib/schema";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未收到文件" }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "只支持 JPG / PNG / WebP / GIF 格式" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 20MB" }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  // 先验证这是不是真的图片，避免坏文件在 sharp 里抛异常变成 500
  try {
    await sharp(input).metadata();
  } catch {
    return NextResponse.json({ error: "文件不是有效的图片" }, { status: 400 });
  }

  // GIF 保留动画，不转 WebP
  const isGif = file.type === "image/gif";

  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });

  const id = crypto.randomBytes(8).toString("hex");
  const stamp = new Date().toISOString().slice(0, 7).replace("-", ""); // YYYYMM
  const subDir = path.join(dir, stamp);
  await fs.mkdir(subDir, { recursive: true });

  let filename: string;
  let outBuf: Buffer;
  let width: number | null = null;
  let height: number | null = null;

  if (isGif) {
    filename = `${id}.gif`;
    outBuf = input;
    try {
      const meta = await sharp(input, { animated: true }).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      /* 忽略元数据失败 */
    }
  } else {
    filename = `${id}.webp`;
    const img = sharp(input, { failOn: "none" }).rotate(); // 按 EXIF 自动转正
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    // 超大图等比缩到最长边 1920
    const MAX_DIM = 1920;
    if (width && height && Math.max(width, height) > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    outBuf = await img
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  }

  await fs.writeFile(path.join(subDir, filename), outBuf);

  // 缩略图（列表页用）
  let thumbPath: string | null = null;
  if (!isGif) {
    const thumbName = `${id}-thumb.webp`;
    await sharp(outBuf).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(subDir, thumbName));
    thumbPath = `/uploads/${stamp}/${thumbName}`;
  }

  const url = `/uploads/${stamp}/${filename}`;

  getDb()
    .insert(media)
    .values({
      filename: `${stamp}/${filename}`,
      originalName: file.name,
      mimeType: isGif ? "image/gif" : "image/webp",
      sizeBytes: outBuf.length,
      width,
      height,
      thumbPath,
      uploadedBy: user.id,
      createdAt: now(),
    })
    .run();

  return NextResponse.json({
    url,
    thumbUrl: thumbPath,
    width,
    height,
    size: outBuf.length,
    originalSize: file.size,
    saved: Math.round((1 - outBuf.length / file.size) * 100),
    alt: file.name.replace(/\.[^.]+$/, ""),
  });
}


// ── 统一错误捕获：异常写入 data/logs，客户端收到中文提示 ──
export const POST = withErrorLogging("POST /api/upload", handlePOST);
