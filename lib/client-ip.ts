/**
 * 客户端 IP 提取
 *
 * 【为什么需要专门的模块】
 * 原实现直接读 `x-forwarded-for` 的第一段。这个头是**客户端可以随意伪造的**：
 *
 *   curl -H "X-Forwarded-For: 1.2.3.4" ...
 *
 * 每次换一个假 IP，就能绕过所有基于 IP 的限流（留言防刷、错误上报防刷、登录防爆破）。
 * 本机开发时无所谓，一旦上公网就是真实的漏洞。
 *
 * 【正确做法】
 * 只有在「请求确实经过了我们信任的反向代理」时，才采信代理写入的头。
 * 不同平台的约定不同，按优先级依次尝试：
 *
 * 1. Cloudflare：`cf-connecting-ip`（Cloudflare 边缘写入，客户端无法伪造）
 * 2. Vercel：`x-vercel-forwarded-for`
 * 3. 通用反代：`x-real-ip`
 * 4. 最后才看 `x-forwarded-for` 的**最后一段**（最靠近我们的代理追加的）
 *
 * 【重要限制】
 * 如果站点**没有**经过反向代理，直接暴露在公网，那么以上头全部不可信。
 * 这种情况下唯一可靠的是 TCP 连接地址，但 Next.js 的 Route Handler
 * 拿不到 socket 信息。因此：
 *
 * - 部署在 Cloudflare / Vercel / nginx 之后：头可信，本模块正常工作
 * - 直接暴露裸端口：限流只能作为「降低噪音」，不能作为安全边界
 *
 * 这个限制写在这里，是为了不让后来者误以为限流绝对可靠。
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

/** 是否配置了可信代理（通过环境变量显式声明） */
function hasTrustedProxy(): boolean {
  return (
    process.env.TRUST_PROXY === "1" ||
    Boolean(process.env.CF_PAGES) ||
    Boolean(process.env.VERCEL)
  );
}

/**
 * 取客户端标识（已哈希，不存原始 IP）。
 *
 * 返回哈希而非原始 IP 的原因：日志与数据库里不该出现可识别个人的信息。
 */
export function getClientKey(req: NextRequest): string {
  const raw = extractIp(req);
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function extractIp(req: NextRequest): string {
  const trusted = hasTrustedProxy();

  /**
   * 【关键：不可信环境一律忽略所有 IP 头】
   *
   * 本机/裸端口部署时，没有任何反向代理替我们追加请求头，
   * 客户端可以随意伪造 cf-connecting-ip / x-forwarded-for / x-real-ip。
   * 此时采信任何一个头 = 限流形同虚设
   * （实测：伪造 15 个不同 IP 就能写 15 条日志）。
   *
   * 所以不可信环境下统一返回固定值，让所有请求共用一个桶。
   * 代价：本地开发时限流是全局的，不是按访客区分——这是可接受的，
   * 因为本地开发本来就没有"多个真实访客"。
   *
   * 注意：cf-connecting-ip 也必须在这个判断之下。
   * 曾经把它放在判断之前（认为「本地伪造这个头走不到真实服务」），
   * 这是错的——裸端口部署时请求直接到本机，伪造照样生效。
   */
  if (!trusted) {
    return "untrusted-shared-bucket";
  }

  // 以下只在明确配置了可信代理（Cloudflare / Vercel / TRUST_PROXY）时才采信
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();

  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    /**
     * 取**最后一段**，不是第一段。
     *
     * XFF 是「客户端, 代理1, 代理2...」的追加链。
     * 左边各段都由客户端自己写，可以随意伪造；
     * 只有最右边一段是我们的代理追加的，相对可信。
     *
     * 取第一段等于采信客户端自报的 IP——这正是伪造能生效的原因。
     */
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown-client";
}
