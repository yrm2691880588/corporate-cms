/**
 * 自动备份
 *
 * 【为什么需要】
 * 备份目前要手动双击「备份.bat」。人会忘，而数据只有一份。
 * 2026-10-31 已发生过一次误删事故，当时唯一的备份还是 4 天前的。
 *
 * 【设计】
 * - 服务启动时检查：今天备份过吗？没有就自动备份一份
 * - 之后每 24 小时检查一次（长期运行的服务也能覆盖）
 * - 只保留最近 N 天，自动清理更早的备份，避免撑满磁盘
 * - 备份失败不能影响网站运行（内部 try/catch）
 *
 * 【备份内容】
 * - data/site.db（先做 WAL checkpoint，保证数据完整）
 * - data/uploads/（图片目录）
 *
 * 【为什么不用系统任务计划】
 * 用户可能不常开电脑，系统任务容易错过。跟着服务生命周期走，
 * 「只要网站在跑，就保证每天有备份」，更贴近实际使用方式。
 */

import fs from "node:fs";
import path from "node:path";
import { getRawDb, getDbPath } from "./db";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const BACKUP_DIR = path.join(ROOT, "backup");

/**
 * 数据库路径必须与 lib/db.ts 一致。
 *
 * 【为什么不能硬编码 data/site.db】
 * 设置了 DATABASE_PATH 时，实际使用的库在别处：
 * - 若仍备份 data/site.db，备份的是一份过时/无关的文件，而真实数据没被备份
 * - 若用 DATABASE_PATH 指向测试副本跑验收，自动备份会去动真实库，违反隔离规则
 *
 * 因此统一从 lib/db.ts 的 getDbPath() 取，保证备份对象与运行中的库一致。
 * 用函数而非模块级常量，是因为环境变量应在实际读取时求值。
 */
function getDbFile(): string {
  return getDbPath();
}

/** 保留最近多少天的备份 */
const KEEP_DAYS = 14;

/**
 * 检查间隔：1 小时。
 *
 * 不用 24 小时：setInterval 从启动时刻算起，
 * 若 23:50 启动，下一次触发就是次日 23:50，中间一整天没有备份。
 * 每小时检查一次成本极低（一次目录列举），能保证最多 1 小时内补上。
 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function hasBackupToday(): boolean {
  if (!fs.existsSync(BACKUP_DIR)) return false;
  const stamp = todayStamp();
  return fs
    .readdirSync(BACKUP_DIR)
    .some((f) => f.startsWith(`site_${stamp}`) && f.endsWith(".db"));
}

/**
 * 清理过期备份。
 *
 * 【只清理自己生成的文件，绝不碰用户的备份】
 * 自动备份的文件名带 `_auto` 后缀（`site_YYYYMMDD_auto.db`、
 * `uploads_YYYYMMDD_auto/`），只删这类。
 *
 * 用户用「备份.bat」生成的 `site_YYYYMMDD_HHmmss.db` 是手动备份，
 * 以及恢复前自动另存的 `before_restore_*`，都**永久保留**——
 * 那是用户自己的安全网，不该被自动任务清掉。
 */
function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const name of fs.readdirSync(BACKUP_DIR)) {
      // 只处理自动备份产物
      const isAuto =
        (name.startsWith("site_") && name.includes("_auto")) ||
        (name.startsWith("uploads_") && name.includes("_auto"));
      if (!isAuto) continue;

      const full = path.join(BACKUP_DIR, name);
      try {
        if (fs.statSync(full).mtimeMs >= cutoff) continue;
        fs.rmSync(full, { recursive: true, force: true });
        removed += 1;
      } catch {
        /* 单个文件删不掉不影响其余 */
      }
    }

    if (removed > 0) {
      console.log(`[自动备份] 已清理 ${removed} 个超过 ${KEEP_DAYS} 天的自动备份`);
    }
  } catch {
    /* 清理失败不影响主流程 */
  }
}

/** 执行一次备份。返回是否成功。 */
export function runBackupOnce(): boolean {
  try {
    if (!fs.existsSync(getDbFile())) {
      console.log("[自动备份] 数据库不存在，跳过（首次运行尚未初始化）");
      return false;
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const stamp = todayStamp();
    const dateStr = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;

    // 1. 先做 WAL checkpoint，否则副本可能缺最新写入
    try {
      // 复用 lib/db.ts 的连接（静态 import，与 scheduler 的做法一致）
      const raw = getRawDb();
      raw.pragma("wal_checkpoint(TRUNCATE)");
      // 不 close，连接由 lib/db.ts 持有并复用
    } catch {
      /* checkpoint 失败时仍继续复制，只是可能少最后几条 */
    }

    // 2. 复制数据库（先写临时文件，成功后再改名）
    //
    // 【为什么不用 copyFileSync 直接写目标文件】
    // 复制不是原子操作。磁盘写满或进程被杀时会留下一个截断的 .db 文件，
    // 而 hasBackupToday() 只按文件名判断——它会把这个残片当成「今天已备份」，
    // 之后每小时的检查全部跳过，备份从此静默失效。
    // 先写 .tmp 再 rename 可以保证：目标文件要么完整，要么不存在。
    const dbTarget = path.join(BACKUP_DIR, `site_${stamp}_auto.db`);
    const dbTmp = `${dbTarget}.tmp`;
    try {
      fs.copyFileSync(getDbFile(), dbTmp);
      fs.renameSync(dbTmp, dbTarget);
    } catch (err) {
      // 失败时清掉残片，避免下次被误认为是有效备份
      try {
        if (fs.existsSync(dbTmp)) fs.unlinkSync(dbTmp);
      } catch {
        /* 清理失败也无妨，.tmp 后缀不会被 hasBackupToday 认作备份 */
      }
      throw err;
    }

    // 3. 复制图片目录（如果有内容）
    let imgCount = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      imgCount = countFiles(UPLOADS_DIR);
      if (imgCount > 0) {
        const imgTarget = path.join(BACKUP_DIR, `uploads_${stamp}_auto`);
        fs.rmSync(imgTarget, { recursive: true, force: true });
        // 不用 fs.cpSync：在 Windows 上处理嵌套目录会静默失败/卡住，
        // 手写递归复制更可靠，也便于统计与报错。
        copyDirRecursive(UPLOADS_DIR, imgTarget);
      }
    }

    // 4. 清理过期备份
    cleanupOldBackups();

    const sizeKB = Math.round(fs.statSync(dbTarget).size / 1024);
    console.log(
      `[自动备份] ${dateStr} 完成：数据库 ${sizeKB} KB` +
        (imgCount > 0 ? `，图片 ${imgCount} 个文件` : "")
    );
    return true;
  } catch (err) {
    // 备份失败绝不能影响网站
    console.error("[自动备份] 失败：", err instanceof Error ? err.message : err);
    return false;
  }
}

function countFiles(dir: string): number {
  let n = 0;
  try {
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else n += 1;
      }
    };
    walk(dir);
  } catch {
    /* 统计失败按 0 处理 */
  }
  return n;
}

/**
 * 递归复制目录。
 *
 * 不用 fs.cpSync：在 Windows 上它处理嵌套目录时会静默失败，
 * 表现为「备份成功但没有图片」，比直接报错更危险。
 */
function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

type Timer = ReturnType<typeof setInterval>;
const g = globalThis as unknown as { __autoBackupTimer?: Timer };

/**
 * 是否启用自动备份。
 *
 * 【默认关闭】
 * 自动备份每天会复制一份完整数据库 + 全部图片，长期累积会占用磁盘。
 * 对于当前"本机验证、内容不多"的阶段，这个开销没必要一直承担，
 * 所以改成显式开启：只有设置了 AUTO_BACKUP=1 才会跑。
 *
 * 【怎么打开】
 * 在项目根目录的 .env 里加一行：
 *   AUTO_BACKUP=1
 * 然后重启服务（双击「停止.bat」再「启动.bat」）。
 *
 * 【关闭后的影响】
 * 数据没有任何自动保护。误删、文件损坏都无法恢复。
 * 需要保护时请手动双击「备份.bat」。
 *
 * 【为什么用环境变量而不是删代码】
 * 删掉功能容易，想恢复得重新写一遍还容易出错。
 * 留一个开关，改一行就能切回来，代码也一直有测试覆盖。
 */
export function isAutoBackupEnabled(): boolean {
  const v = process.env.AUTO_BACKUP?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * 启动自动备份。
 *
 * 用 globalThis 防重复注册——Next.js 可能多次加载模块。
 * 构建期不执行（见 instrumentation.ts 的守卫）。
 */
export function startAutoBackup() {
  // 默认关闭，必须显式设置 AUTO_BACKUP=1 才启动
  if (!isAutoBackupEnabled()) {
    console.log(
      "[自动备份] 已关闭（如需开启：在 .env 里设置 AUTO_BACKUP=1 后重启）"
    );
    return;
  }

  if (g.__autoBackupTimer) return;

  // 启动时先检查一次
  if (hasBackupToday()) {
    console.log("[自动备份] 今天已备份过，跳过");
  } else {
    runBackupOnce();
  }

  /**
   * 检查间隔：每小时一次，而不是每 24 小时。
   *
   * 【为什么不用 24 小时】
   * setInterval 从启动时刻算起。如果服务在 23:50 启动并备份，
   * 下一次触发是次日 23:50 —— 那么「次日」这一整天都没有备份，
   * 但 hasBackupToday() 一直看到的是「昨天备份过」。
   * 结果是整整一天没有新备份，直到接近午夜才补上。
   *
   * 改成每小时检查一次：成本几乎为零（一次目录列举），
   * 但能保证任一时刻重启后，最多 1 小时内补上当天的备份。
   * 真正决定「要不要备份」的是 hasBackupToday()，不是这个间隔。
   */
  g.__autoBackupTimer = setInterval(() => {
    if (!hasBackupToday()) {
      runBackupOnce();
    }
    cleanupOldBackups();
  }, CHECK_INTERVAL_MS);

  console.log(
    `[自动备份] 已启用：每小时检查，每天一份，保留最近 ${KEEP_DAYS} 天`
  );
}
