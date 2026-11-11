/**
 * 数据目录路径解析
 *
 * 【为什么需要集中管理】
 * 原先 uploads / logs 目录各自硬编码 `data/xxx`，而数据库支持 DATABASE_PATH。
 * 后果：测试时数据库指向了副本，但日志和上传仍写真实 data/——
 * 实测曾往 data/logs 写入 140 条测试日志、往 data/uploads 上传 10 张图。
 *
 * 这违反了「测试不碰真实数据」的隔离原则，也会让真实数据目录里混入垃圾。
 *
 * 【规则】
 * - 默认：全部在 data/ 下
 * - 设了 DATABASE_PATH：全部跟随该数据库所在目录
 *   这样测试时只要 DATABASE_PATH=tmp/xxx.db，日志和图片也自动落在 tmp/
 */

import path from "node:path";

/** 数据根目录（数据库、上传、日志的共同父目录） */
export function getDataRoot(): string {
  const custom = process.env.DATABASE_PATH?.trim();
  if (custom) {
    const dbFile = path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
    return path.dirname(dbFile);
  }
  return path.join(process.cwd(), "data");
}

/** 上传图片根目录 */
export function getUploadsDir(): string {
  return path.join(getDataRoot(), "uploads");
}

/** 日志目录 */
export function getLogsDir(): string {
  return path.join(getDataRoot(), "logs");
}
