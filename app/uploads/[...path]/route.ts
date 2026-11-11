import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getUploadsDir } from "@/lib/paths";

/**
 * 静态图片服务
 *
 * 数据文件放在 data/uploads/ 而不是 public/，
 * 这样上传图片不需要重新构建，也不会污染源码目录。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segs } = await params;

  // 防目录穿越
  const rel = segs.join("/");
  if (rel.includes("..")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const filePath = path.join(getUploadsDir(), rel);

  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".webp" ? "image/webp" :
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".gif" ? "image/gif" :
      ext === ".svg" ? "image/svg+xml" : "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
