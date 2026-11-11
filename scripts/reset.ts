/**
 * 重置数据库 —— 清空所有内容并重新初始化
 *
 * ⚠️ 危险操作：会删除全部文章、图片记录、留言和账号。
 * 运行前会要求确认。
 *
 * 运行：npx tsx scripts/reset.ts
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const dbPath = path.join(root, "data", "site.db");
const uploadsDir = path.join(root, "data", "uploads");

console.log("");
console.log("========================================");
console.log("  重置数据库");
console.log("========================================");
console.log("");
console.log("⚠️  这个操作会删除：");
console.log("    - 所有文章、产品、单页");
console.log("    - 所有图片记录与已上传的图片");
console.log("    - 所有留言");
console.log("    - 所有账号（会重建默认管理员）");
console.log("");
console.log("⚠️  恢复方法：从 backup/ 目录复制备份文件回 data/site.db");
console.log("   如果你还没备份，请先按 Ctrl+C 退出，运行「备份.bat」。");
console.log("");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const answer = await new Promise<string>((resolve) => {
  rl.question('确认要清空吗？输入 YES 继续：', resolve);
});

rl.close();

if (answer.trim() !== "YES") {
  console.log("");
  console.log("已取消，什么都没有改动。");
  process.exit(0);
}

// 1. 删除数据库文件
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log("✓ 已删除 data/site.db");
}
// WAL 附属文件也要删，否则会残留旧数据
for (const suffix of ["-wal", "-shm"]) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`✓ 已删除 data/site.db${suffix}`);
  }
}

// 2. 清空上传目录
if (fs.existsSync(uploadsDir)) {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  console.log("✓ 已清空 data/uploads/");
}

// 3. 重新初始化
console.log("");
console.log("正在重新初始化…");
console.log("");

const { getDb } = await import("../lib/db");
const { hashPassword } = await import("../lib/password");

// 触发建表
getDb();
console.log("✓ 数据表已重建");

// 4. 提示下一步
console.log("");
console.log("========================================");
console.log("  重置完成");
console.log("========================================");
console.log("");
console.log("下一步：运行 npm run db:seed 灌入示例内容，");
console.log("       或者重新双击「启动.bat」（会自动初始化）。");
console.log("");
