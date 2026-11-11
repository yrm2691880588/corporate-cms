import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { listPublished, listCategories, getCategoryBySlug } from "@/lib/content";
import ContentCard from "@/components/ContentCard";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

/**
 * 栏目列表页
 *
 * 按栏目 slug 展示该栏目下的内容（文章 + 产品都算内容，
 * 因此同一入口可服务业务上不同类型的栏目）。
 *
 * 隐藏栏目（isVisible=0）仍可访问，只是不出现在导航里 —— 需求 T-03。
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) return { title: "栏目不存在" };

  const settings = getSettings();
  return {
    title: cat.name,
    description: cat.description || `${settings.shortName}的${cat.name}栏目`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Params) {

  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const cat = getCategoryBySlug(slug);
  if (!cat) notFound();

  const settings = getSettings();
  // includeChildren：父栏目要能看到子栏目里的内容。
  // 不然「产品与服务」这种只挂子栏目的父栏目，点进去就是空的。
  const { items, total, pageSize } = listPublished({
    categorySlug: slug,
    includeChildren: true,
    page,
    pageSize: settings.pageSize,
  });

  // 子栏目（用于栏目页内的二级导航）
  const children = listCategories(false).filter((c) => c.parentId === cat.id);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <nav className="text-sm text-gray-400 mb-6" aria-label="面包屑">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{cat.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{cat.name}</h1>
        {cat.description && <p className="text-gray-500">{cat.description}</p>}
      </header>

      {children.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {/* 「全部」是当前状态：父栏目页展示所有子栏目的内容 */}
          <span className="px-3 py-1.5 text-sm rounded-lg bg-brand text-white font-medium">
            全部
          </span>
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">该栏目暂无内容</div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                basePath={item.type === "product" ? "/products" : "/news"}
              />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath={`/category/${slug}`} />
        </>
      )}
    </div>
  );
}
