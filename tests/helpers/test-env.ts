/**
 * 测试环境准备
 *
 * 【为什么必须先复制数据库】
 * 2026-10-31 发生过一次事故：验收脚本直接跑在真实库上，
 * 用 `title LIKE '%测试%'` 清理时误删了用户真实文章，不可恢复。
 * 所有测试必须跑在副本上，绝不碰 data/site.db。
 *
 * 【工作方式】
 * 1. 把真实库复制到 tmp/test-<时间戳>.db
 * 2. 返回该副本路径，测试用 DATABASE_PATH 指向它
 * 3. 测试结束由调用方删除
 *
 * 【为什么不直接用一个空的测试库】
 * 用真实库的副本更接近生产状态（有内容、有栏目、有账号），
 * 能测出"数据存在时"的行为，而不是真空环境下的理想行为。
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const REAL_DB = path.join(ROOT, "data", "site.db");
const TMP_DIR = path.join(ROOT, "tmp");

/** 准备一份测试用数据库副本，返回其路径 */
export function prepareTestDb(): string {
  if (!fs.existsSync(REAL_DB)) {
    throw new Error(
      "找不到真实数据库 data/site.db。请先运行 npm run db:seed 初始化。"
    );
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });

  // 先让真实库把 WAL 合并回主文件，否则副本会缺最新数据
  try {
    const real = new Database(REAL_DB);
    real.pragma("wal_checkpoint(TRUNCATE)");
    real.close();
  } catch {
    /* 合并失败也继续，副本可能少最后几条，不影响测试 */
  }

  const testDb = path.join(TMP_DIR, `test-${Date.now()}.db`);
  fs.copyFileSync(REAL_DB, testDb);

  // 副本不要带 WAL 附属文件
  for (const suffix of ["-wal", "-shm"]) {
    const p = testDb + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  return testDb;
}

/** 清理测试数据库 */
export function cleanupTestDb(testDb: string) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = testDb + suffix;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* 清理失败不影响测试结果 */
    }
  }
}
