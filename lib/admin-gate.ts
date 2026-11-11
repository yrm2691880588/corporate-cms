/**
 * 后台访问口令（可选的可配置防护）
 *
 * 【解决什么问题】
 * 后台地址固定为 /admin，上公网后会被自动化工具扫到并尝试登录。
 * 登录本身有密码 + 5 次锁定 15 分钟，但持续扫描仍会造成噪音与日志污染。
 *
 * 这个模块提供一个「额外一层」的可选口令，默认关闭。
 *
 * 【怎么用】
 * 1. 设置环境变量 ADMIN_GATE_TOKEN=你的口令（至少 8 位）
 * 2. 访问 /api/admin-gate?token=你的口令 → 自动写 Cookie 并跳转后台
 * 3. 之后正常访问 /admin 即可
 *
 * 【为什么写 Cookie 放在 Route Handler 而不是页面】
 * Next.js 15 不允许在 Server Component 渲染期间设置 Cookie。
 * 在页面里调 cookies().set() 会抛错——如果被 try/catch 吞掉，
 * 表现就是「带正确口令也进不去」（第一版就是这个 bug）。
 *
 * 【为什么不用 middleware.ts】
 * Next.js 的 middleware 默认编译进 edge runtime，那里没有 fs / path，
 * 而本项目数据层是原生模块（better-sqlite3）。
 * 只要 middleware 存在，整个依赖图就按 edge 规则编译并构建失败。
 *
 * 【为什么失败时返回 404 而不是 403】
 * 403 等于告诉扫描器「这里确实有东西，只是你没权限」，
 * 会诱导它继续尝试。404 让它以为这个路径根本不存在。
 *
 * 【重要：这不是安全屏障的替代品】
 * 真正的防护是密码强度 + 登录限流。这一层只是降低噪音。
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_gate";

/**
 * 是否启用了口令保护。
 *
 * 口令长度不足 8 位时视为未启用，但会打一次警告——
 * 否则用户设了一个 6 位的口令，以为开了，实际后台毫无保护。
 */
let warnedAboutShortToken = false;

export function isGateEnabled(): boolean {
  const token = process.env.ADMIN_GATE_TOKEN?.trim();
  if (!token) return false;

  if (token.length < 8) {
    if (!warnedAboutShortToken) {
      console.warn(
        `[后台口令] ADMIN_GATE_TOKEN 长度只有 ${token.length} 位，` +
          `少于要求的 8 位，口令保护**未启用**。请换一个更长的口令。`
      );
      warnedAboutShortToken = true;
    }
    return false;
  }

  return true;
}

/** 当前请求是否已通过口令（未启用时恒为 true） */
export async function hasGateCookie(): Promise<boolean> {
  if (!isGateEnabled()) return true;
  const expected = process.env.ADMIN_GATE_TOKEN!.trim();
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === expected;
}
