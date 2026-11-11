import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/content";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

/**
 * 前台布局
 *
 * 导航来源有两处，按优先级合并（这是 ADR-0003 的延伸）：
 * 1. 数据库栏目表（isVisible=1 的一级栏目）优先 —— 后台增删/排序/隐藏立即生效
 * 2. 若栏目表为空，退回 config/site.config.ts 的静态 nav —— 保证空库也能看
 *
 * 固定页面（首页、关于我们、联系我们）始终保留在两端。
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const config = getSettings();

  const fromDb = listCategories(false)
    .filter((c) => !c.parentId)
    .map((c) => ({ label: c.name, href: `/category/${c.slug}` }));

  // 首页固定在最前，固定单页固定放在末尾
  const nav =
    fromDb.length > 0
      ? [
          { label: "首页", href: "/" },
          ...fromDb,
          { label: "关于我们", href: "/about" },
          { label: "联系我们", href: "/contact" },
        ]
      : config.nav;

  return (
    <>
      <SiteHeader config={config} nav={nav} />
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter config={config} />
    </>
  );
}
