/**
 * 测试运行器
 *
 * 【它做三件事】
 * 1. 准备数据库副本（绝不碰 data/site.db）
 * 2. 用 DATABASE_PATH 指向副本、在独立端口 3100 启动生产构建
 * 3. 跑测试，结束后清理进程与副本
 *
 * 【为什么用生产构建而不是 dev】
 * - dev 模式在受限环境会失败（fork IPC 被禁）
 * - 生产构建更接近真实部署，测出的行为更可信
 *
 * 【用法】
 *   npx tsx tests/run.ts
 */

import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { prepareTestDb, cleanupTestDb } from "./helpers/test-env";

const ROOT = process.cwd();
const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * 检查端口是否空闲。
 *
 * 【为什么必须有这个检查】
 * 实测踩过坑：3100 被审查代理留下的假服务占用，
 * 测试仍然打印「服务已就绪」，然后 33 个用例全红且毫无提示。
 * 根因是 waitForServer 只要 / 返回 200 就认为就绪，不校验是不是自己起的进程。
 *
 * 所以启动前先确认端口能绑定，不能就明确报错。
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function waitForServer(timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* 还没起来，继续等 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const testDb = prepareTestDb();
  console.log(`[测试] 数据库副本：${path.relative(ROOT, testDb)}`);

  // 生产构建必须存在
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.error("[测试] 缺少生产构建。请先运行 next build。");
    cleanupTestDb(testDb);
    process.exit(1);
  }

  /**
   * 端口必须空闲。
   *
   * 如果不检查，端口被别的服务占着时，测试会对着那个服务跑，
   * 输出「服务已就绪」然后全部用例失败，且没有任何提示——
   * 实测踩过这个坑（3100 被遗留的假服务占用）。
   */
  if (!(await isPortFree(PORT))) {
    console.error("");
    console.error(`[测试] 端口 ${PORT} 已被占用，无法启动测试服务。`);
    console.error("       请先找出并停止占用该端口的进程：");
    console.error(`       netstat -ano | findstr :${PORT}`);
    console.error("");
    cleanupTestDb(testDb);
    process.exit(1);
  }

  let server: ChildProcess | null = null;

  try {
    // 启动服务：独立端口 + 指向副本
    server = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          // 用绝对路径，不依赖进程 cwd
          DATABASE_PATH: testDb,
          /**
           * 开启可信代理模式，让 x-forwarded-for 生效。
           *
           * 【为什么测试环境需要】
           * 生产环境默认不采信这个头（防伪造，见 lib/client-ip.ts），
           * 导致所有请求共用一个限流桶。多个测试用例连续发请求时，
           * 后跑的用例会被前面用光的配额挡住——测出来的 429 是测试污染，
           * 不是真实缺陷。
           *
           * 开启后每个用例可以用不同的 x-forwarded-for 隔离自己的配额。
           */
          TRUST_PROXY: "1",
          // 定时发布轮询调短，让测试能在几秒内验证到点自动发布
          SCHEDULER_INTERVAL_MS: "1000",
          NODE_ENV: "production",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let serverLog = "";
    server.stdout?.on("data", (d) => (serverLog += d.toString()));
    server.stderr?.on("data", (d) => (serverLog += d.toString()));

    const ready = await waitForServer();
    if (!ready) {
      console.error("[测试] 服务启动超时。日志：");
      console.error(serverLog.slice(-2000));
      throw new Error("服务启动失败");
    }
    console.log(`[测试] 服务已就绪：${BASE}`);

    // 跑测试
    process.env.TEST_BASE_URL = BASE;
    /**
     * 测试进程自身也要指向同一个数据库路径。
     *
     * 原因：测试代码里会调用 getLogsDir() 等函数去读日志文件，
     * 这些函数按 DATABASE_PATH 解析路径。如果测试进程没设这个变量，
     * 它会去 data/logs 找文件，而服务实际写在 tmp/logs —— 两边对不上，
     * 表现为「日志一条都读不到」，用例误报失败。
     */
    process.env.DATABASE_PATH = testDb;
    process.env.TRUST_PROXY = "1";

    const { runAllTests } = await import("./suites/index");
    const result = await runAllTests();

    // 输出结果
    console.log("");
    console.log("════════════════════════════════════════");
    console.log("  测试结果");
    console.log("════════════════════════════════════════");
    for (const t of result.tests) {
      console.log(`${t.ok ? " ✅" : " ❌"} ${t.name}`);
      if (!t.ok && t.error) {
        console.log(`     ${t.error.split("\n")[0]}`);
      }
    }
    console.log("────────────────────────────────────────");
    console.log(`  通过 ${result.passed} / ${result.total}`);
    console.log("════════════════════════════════════════");

    if (result.failed > 0) {
      console.log("");
      console.log("失败详情：");
      for (const t of result.tests.filter((x) => !x.ok)) {
        console.log(`\n【${t.name}】`);
        console.log(t.error);
      }
      process.exitCode = 1;
    }
  } finally {
    if (server) {
      // 用 exit 事件判断是否真的退出，而不是 server.killed
      // （killed 只表示信号已发出，进程可能还活着）
      const exited = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 5000);
        server!.once("exit", () => {
          clearTimeout(timer);
          resolve(true);
        });
      });

      server.kill("SIGTERM");
      const ok = await exited;
      if (!ok) {
        server.kill("SIGKILL");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    cleanupTestDb(testDb);
    cleanupStaleTestDbs();
    console.log("[测试] 已清理测试副本");
  }
}

/**
 * 清理历次测试遗留的副本。
 *
 * 正常情况 finally 会删掉本次的副本。但如果进程被强杀（Ctrl+C、断电），
 * finally 不会执行，副本会一直留在 tmp/ 里。这个函数做兜底清理。
 *
 * 只删形如 test-<数字>.db 的文件，不碰 tmp/ 下的其他东西。
 */
function cleanupStaleTestDbs() {
  try {
    const tmpDir = path.join(ROOT, "tmp");
    if (!fs.existsSync(tmpDir)) return;
    for (const name of fs.readdirSync(tmpDir)) {
      if (!/^test-\d+\.db(-wal|-shm)?$/.test(name)) continue;
      try {
        fs.unlinkSync(path.join(tmpDir, name));
      } catch {
        /* 单个删不掉不影响其他 */
      }
    }
  } catch {
    /* 清理失败不影响测试结果 */
  }
}

main().catch((err) => {
  console.error("[测试] 运行失败：", err);
  process.exit(1);
});
