/**
 * Next.js 启动钩子 —— 官方注册后台任务的位置
 *
 * 【为什么用这个文件，而不是在布局里调用】
 * 在 app/layout.tsx 顶层执行副作用是错误的：
 * 构建期 Next.js 会为每个 worker 各加载一次模块，
 * 导致定时器被重复注册、并在构建时就往数据库写。
 *
 * instrumentation.ts 的 register() 只在服务真正启动时跑一次，
 * 且 Node.js 运行时下才执行，构建期不会触发。
 *
 * 【为什么动态 import】
 * 这个钩子同时会在 edge/浏览器环境下被解析，
 * 静态导入 Node 专属模块（better-sqlite3）会直接报错。
 */

export async function register() {
  // 只在 Node.js 运行时执行，避开 edge 运行时
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 构建阶段不启动后台任务
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startScheduledPublisher } = await import("./lib/scheduler");
  startScheduledPublisher();

  // 每日自动备份：只要网站在跑，就保证每天有一份完整备份
  const { startAutoBackup } = await import("./lib/auto-backup");
  startAutoBackup();
}
