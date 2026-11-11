/**
 * 图片裁剪 —— 服务端处理
 *
 * 前端用 react-easy-crop 让用户选裁剪区域，把区域参数传给这里，
 * 由 sharp 在服务端做真实裁剪。这样：
 * - 不依赖浏览器画布，输出质量稳定
 * - 裁剪逻辑与上传逻辑在同一处，压缩规则统一
 * - 前端不需要处理大图，省内存
 */

import sharp from "sharp";

export type CropArea = { x: number; y: number; width: number; height: number };

export type CropOptions = {
  /** 裁剪区域（原图坐标系，单位像素） */
  crop: CropArea;
  /** 旋转角度（0/90/180/270） */
  rotate?: number;
  /** 输出宽度（等比缩放，默认不缩放） */
  outputWidth?: number;
  /** WebP 质量 */
  quality?: number;
};

/**
 * 裁剪并输出 WebP。
 *
 * 注意执行顺序：先 rotate 再 extract。
 * 因为 rotate 会改变图像尺寸，如果先 extract 再 rotate，
 * 用户选的区域会和最终结果对不上。
 */
export async function cropToWebp(input: Buffer, opts: CropOptions): Promise<Buffer> {
  const rotate = ((opts.rotate ?? 0) % 360 + 360) % 360;

  let img = sharp(input, { failOn: "none" }).rotate(rotate);

  // 旋转后重新取尺寸，保证裁剪区域合法
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  const left = Math.max(0, Math.round(opts.crop.x));
  const top = Math.max(0, Math.round(opts.crop.y));
  const width = Math.min(Math.round(opts.crop.width), w - left);
  const height = Math.min(Math.round(opts.crop.height), h - top);

  if (width <= 0 || height <= 0) {
    throw new Error("裁剪区域无效");
  }

  img = img.extract({ left, top, width, height });

  if (opts.outputWidth && opts.outputWidth > 0 && opts.outputWidth < width) {
    img = img.resize({ width: opts.outputWidth, withoutEnlargement: true });
  }

  return img.webp({ quality: opts.quality ?? 82, effort: 4 }).toBuffer();
}
