/**
 * 站点地址解析
 *
 * 【解决什么问题】
 * 原来 `siteUrl` 写死在 config/site.config.ts 里，值是 `http://localhost:3000`。
 * 一旦用局域网地址访问（如 http://192.168.1.15:3000），页面里的
 * og:image / og:url / sitemap 仍然输出 localhost —— 后果是：
 *
 * - 手机微信分享出去，缩略图裂（因为 localhost 在手机上指向手机自己）
 * - sitemap 全是 localhost，搜索引擎抓不到正确地址
 *
 * 【解决思路】
 * 按优先级依次取：
 * 1. 环境变量 SITE_URL —— 部署到公网时显式指定（如 https://www.example.com）
 * 2. 请求头里的 Host —— 自动跟随访客实际访问的地址（局域网 IP、域名都行）
 * 3. 配置里的默认值 —— 兜底（构建期、无请求上下文时）
 *
 * 【为什么优先用请求头而不是配置】
 * 同一份代码，你从 localhost 访问就是 localhost，从 192.168.1.15 访问
 * 就是 192.168.1.15，不用改任何配置。这是局域网测试最省事的方式。
 *
 * 【安全注意】
 * Host 头可以被客户端伪造。这里只用它拼展示用的 URL（og:image 等），
 * 不用于鉴权或跳转，所以风险可接受。真要严格，就在公网部署时设 SITE_URL。
 */

import { headers } from "next/headers";
import { siteConfig } from "@/config/site.config";

/** 兜底地址（无请求上下文时使用） */
function fallbackUrl(): string {
  return siteConfig.siteUrl.replace(/\/$/, "");
}

/**
 * 取当前请求的站点根地址（不带末尾斜杠）。
 *
 * 只能在服务端调用（用了 next/headers）。
 * 在构建期或没有请求上下文时，会回落到配置里的默认值。
 */
export async function getSiteUrl(): Promise<string> {
  // 1. 显式配置优先（公网部署时设 SITE_URL 最稳妥）
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // 2. 跟随访客实际访问的地址
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      // 判断协议：反代后面看 x-forwarded-proto，本机就是 http
      const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
      return `${proto}://${host}`;
    }
  } catch {
    /* 没有请求上下文（构建期），走兜底 */
  }

  // 3. 兜底
  return fallbackUrl();
}

/**
 * 同步版本，给无法用 async 的场景用。
 *
 * 只读环境变量与配置，不碰请求头 —— 拿不到真实访问地址，
 * 但至少能保证 SITE_URL 生效。
 */
export function getSiteUrlSync(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return fallbackUrl();
}
