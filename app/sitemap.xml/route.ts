import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getSiteUrl } from "@/lib/site-url";
import { getDb } from "@/lib/db";
import { contents, categories, tags } from "@/lib/schema";

export const dynamic = "force-dynamic";

/**
 * 站点地图
 *
 * 必须包含前台所有可访问的公开页面，否则搜索引擎找不到：
 * 首页、新闻、产品、联系、栏目页、标签页、全部已发布内容。
 *
 * 注意：后台与预览页不在 sitemap 里（robots.txt 也已 Disallow）。
 */
export async function GET() {
  const db = getDb();
  // 用实际访问地址：从局域网 IP 或域名访问 sitemap 时，里面的链接才正确
  const base = await getSiteUrl();

  const published = db
    .select({
      type: contents.type,
      slug: contents.slug,
      updatedAt: contents.updatedAt,
    })
    .from(contents)
    .where(and(eq(contents.status, "published"), isNull(contents.deletedAt)))
    .orderBy(desc(sql`COALESCE(${contents.publishedAt}, ${contents.updatedAt})`))
    .all();

  // 可见栏目（隐藏栏目不提交给搜索引擎）
  const visibleCats = db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.isVisible, 1))
    .orderBy(asc(categories.sortOrder))
    .all();

  // 有内容或被引用过的标签
  const allTags = db.select({ slug: tags.slug }).from(tags).orderBy(asc(tags.name)).all();

  const urls: { loc: string; priority: string }[] = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/news`, priority: "0.9" },
    { loc: `${base}/products`, priority: "0.9" },
    { loc: `${base}/contact`, priority: "0.7" },
  ];

  for (const c of visibleCats) {
    urls.push({ loc: `${base}/category/${c.slug}`, priority: "0.8" });
  }
  for (const t of allTags) {
    urls.push({ loc: `${base}/tag/${t.slug}`, priority: "0.5" });
  }
  for (const r of published) {
    if (r.type === "article") urls.push({ loc: `${base}/news/${r.slug}`, priority: "0.8" });
    else if (r.type === "product") urls.push({ loc: `${base}/products/${r.slug}`, priority: "0.8" });
    else if (r.type === "page") urls.push({ loc: `${base}/${r.slug}`, priority: "0.6" });
  }

  // 去重（同一 slug 可能被栏目和内容各出现一次）
  const seen = new Set<string>();
  const unique = urls.filter((u) => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
