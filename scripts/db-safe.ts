/**
 * 安全的数据操作工具
 *
 * 【为什么需要这个脚本】
 * 2026-10-31 一次验收清理用了 `title LIKE '%测试%'` 模糊匹配，
 * 误删了用户真实发布的文章，且不可恢复。
 * 根因不是操作不小心，而是「验收测试直接跑在真实数据库上」。
 *
 * 这个脚本提供两个安全操作：
 *
 *   npx tsx scripts/db-safe.ts copy     → 复制真实库到 tmp/test-site.db
 *   npx tsx scripts/db-safe.ts stats    → 打印真实库的数据统计（只读）
 *
 * 复制之后，验收脚本用 DATABASE_PATH 指向副本，就完全不碰真实数据：
 *
 *   DATABASE_PATH=tmp/test-site.db npx tsx scripts/xxx-test.ts
 *
 * 【设计约束】
 * - 只读模式打开真实库，绝不写入
 * - 副本路径固定为 tmp/，不会误覆盖 data/
 * - 不提供任何删除功能，删除必须按 id 精确操作
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const REAL_DB = path.join(ROOT, "data", "site.db");
const TEST_DIR = path.join(ROOT, "tmp");
const TEST_DB = path.join(TEST_DIR, "test-site.db");

function ensureRealDbExists() {
  if (!fs.existsSync(REAL_DB)) {
    console.error("[错误] 找不到真实数据库 data/site.db");
    console.error("       请先运行 npm run db:seed 或双击「启动.bat」初始化。");
    process.exit(1);
  }
}

/** 复制真实库到测试副本 */
function copy() {
  ensureRealDbExists();

  fs.mkdirSync(TEST_DIR, { recursive: true });

  // 先让真实库把 WAL 合并回主文件，否则副本会缺最新数据
  try {
    const real = new Database(REAL_DB);
    real.pragma("wal_checkpoint(TRUNCATE)");
    real.close();
    console.log("✓ 已把真实库的 WAL 合并回主文件");
  } catch (err) {
    console.warn("⚠ WAL 合并失败，副本可能缺少最新数据：", err);
  }

  fs.copyFileSync(REAL_DB, TEST_DB);

  // 副本不要带 WAL 附属文件，避免旧数据混进来
  for (const suffix of ["-wal", "-shm"]) {
    const p = TEST_DB + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const sizeKB = Math.round(fs.statSync(TEST_DB).size / 1024);
  console.log("");
  console.log("✓ 测试副本已创建");
  console.log(`  路径：${path.relative(ROOT, TEST_DB)}`);
  console.log(`  大小：${sizeKB} KB`);
  console.log("");
  console.log("用法：验收脚本前加环境变量，让它只读副本：");
  console.log(`  DATABASE_PATH=tmp/test-site.db npx tsx scripts/你的测试.ts`);
  console.log("");
  console.log("⚠ 副本是独立文件，怎么改都不影响真实数据。");
}

/** 打印真实库统计（只读，用于确认操作范围） */
function stats() {
  ensureRealDbExists();

  const db = new Database(REAL_DB, { readonly: true });

  const count = (table: string) => {
    try {
      return (db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as any).n as number;
    } catch {
      return -1;
    }
  };

  console.log("");
  console.log("=== 真实数据库统计（只读） ===");
  console.log(`  路径：data/site.db`);
  console.log(`  内容：${count("contents")} 条（其中已删除 ${countDeleted(db)} 条）`);
  console.log(`  栏目：${count("categories")} 个`);
  console.log(`  标签：${count("tags")} 个`);
  console.log(`  留言：${count("messages")} 条`);
  console.log(`  图片：${count("media")} 张`);
  console.log(`  账号：${count("users")} 个`);
  console.log(`  日志：${count("audit_logs")} 条`);

  const rows = db
    .prepare("SELECT id, title, status FROM contents WHERE deleted_at IS NULL ORDER BY id")
    .all() as any[];

  console.log("");
  console.log("=== 现有内容（未删除） ===");
  for (const r of rows) {
    console.log(`  ${String(r.id).padStart(3)} | ${r.status.padEnd(9)} | ${r.title}`);
  }

  db.close();
  console.log("");
}

function countDeleted(db: Database.Database): number {
  try {
    return (db.prepare("SELECT COUNT(*) n FROM contents WHERE deleted_at IS NOT NULL").get() as any)
      .n as number;
  } catch {
    return 0;
  }
}

const action = process.argv[2];

if (action === "copy") {
  copy();
} else if (action === "stats") {
  stats();
} else {
  console.log("");
  console.log("数据安全工具");
  console.log("");
  console.log("  npx tsx scripts/db-safe.ts copy    复制真实库到 tmp/ 作为测试副本");
  console.log("  npx tsx scripts/db-safe.ts stats   查看真实库统计（只读）");
  console.log("");
  console.log("⚠ 本脚本不提供删除功能。删除内容请在后台操作，");
  console.log("  或按具体 id 精确删除，禁止模糊匹配。");
  console.log("");
  process.exit(1);
}
