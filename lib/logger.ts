/**
 * 错误日志
 *
 * 【为什么要落文件】
 * 生产环境下 console.error 的输出会随进程消失，
 * 用户报「打不开」时没有任何线索可查。
 *
 * 【设计取舍】
 * - 写入 data/logs/error-YYYY-MM-DD.log，按天分文件，便于定位时段
 * - 单文件超过上限自动截断，避免长期运行把磁盘写满
 * - 写日志失败不能影响主流程：内部 try/catch 吞掉自身异常
 * - 不记录请求体与密码等敏感字段，只记方法、路径、错误
 *
 * 【为什么不用 winston / pino】
 * 当前是单机单进程、日志量极小。引入日志框架会多一层配置和依赖，
 * 收益不足以抵消维护成本。等真的需要结构化日志或多输出目标时再换。
 */

import fs from "node:fs";
import path from "node:path";

import { getLogsDir } from "./paths";

const LOG_DIR = getLogsDir();
/** 单文件上限 5MB，超过后轮转为 .1 文件（只保留一代） */
const MAX_BYTES = 5 * 1024 * 1024;

function todayFile(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return path.join(LOG_DIR, `error-${ymd}.log`);
}

/** 超过上限时轮转：把当前文件改名为 .1（覆盖旧的一代），再重新开始 */
function rotateIfNeeded(file: string) {
  try {
    const st = fs.statSync(file);
    if (st.size < MAX_BYTES) return;
    const backup = `${file}.1`;
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(file, backup);
  } catch {
    // 文件不存在或无法访问，忽略
  }
}

export type ErrorContext = {
  /** 出错位置，如 "POST /api/contents" 或 "页面 /news/[slug]" */
  where: string;
  /** 错误对象或消息 */
  error: unknown;
  /** 附加信息（不要放密码、token） */
  extra?: Record<string, string | number | undefined>;
};

/** 记录一条错误日志 */
export function logError(ctx: ErrorContext): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = todayFile();
    rotateIfNeeded(file);

    // 错误可能是 Error 实例、字符串，或普通对象（客户端上报时就是对象）。
    // 直接用 String() 处理对象会得到 "[object Object]"，什么信息都没有，
    // 因此这里分情况处理。
    const err = ctx.error;
    let message: string;
    let stack = "";

    if (err instanceof Error) {
      message = `${err.name}: ${err.message}`;
      stack = err.stack ? `\n${err.stack}` : "";
    } else if (typeof err === "string") {
      message = err;
    } else if (err && typeof err === "object") {
      const o = err as { name?: unknown; message?: unknown; stack?: unknown };
      const name = typeof o.name === "string" ? o.name : "Error";
      const msg = typeof o.message === "string" ? o.message : "";
      message = msg ? `${name}: ${msg}` : JSON.stringify(err);
      stack = typeof o.stack === "string" && o.stack ? `\n${o.stack}` : "";
    } else {
      message = String(err);
    }

    const extra = ctx.extra
      ? " " +
        Object.entries(ctx.extra)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")
      : "";

    const line = `[${new Date().toISOString()}] ${ctx.where}${extra}\n  ${message}${stack}\n\n`;

    fs.appendFileSync(file, line, "utf8");
  } catch {
    // 日志系统自身出错绝不能影响业务，静默失败
  }
}

/** 读取最近的日志（供后台查看） */
export function readRecentLogs(limit = 200): { file: string; lines: string[] }[] {
  try {
    if (!fs.existsSync(LOG_DIR)) return [];
    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith(".log"))
      .sort()
      .reverse()
      .slice(0, 3);

    return files.map((f) => {
      const full = path.join(LOG_DIR, f);
      const content = fs.readFileSync(full, "utf8");
      const lines = content.trim().split("\n").slice(-limit);
      return { file: f, lines };
    });
  } catch {
    return [];
  }
}
