import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * robots.txt
 *
 * 站点地址来自 getSiteUrl()：优先环境变量 SITE_URL，
 * 其次从请求头推断访客实际访问的地址（局域网 IP / 域名都能正确跟随）。
 *
 * 不能用 force-static：那会在构建期固化地址，换个地址访问就指向错了。
 */
export async function GET() {
  // 用实际访问地址（环境变量 > 请求头 > 配置兜底）
  const base = await getSiteUrl();

  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${base}/sitemap.xml
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
