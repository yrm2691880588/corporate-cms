import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { listPublished, getTagBySlug } from "@/lib/content";
import ContentCard from "@/components/ContentCard";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = getTagBySlug(slug);
  if (!tag) return { title: "标签不存在" };

  const settings = getSettings();
  return {
    title: `标签：${tag.name}`,
    description: `${settings.shortName}中带有「${tag.name}」标签的全部内容`,
    alternates: { canonical: `/tag/${tag.slug}` },
  };
}

/** 标签聚合页：列出打上该标签的全部内容 */
export default async function TagPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const tag = getTagBySlug(slug);
  if (!tag) notFound();

  const settings = getSettings();
  const { items, total, pageSize } = listPublished({
    tagSlug: slug,
    page,
    pageSize: settings.pageSize,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <nav className="text-sm text-gray-400 mb-6" aria-label="面包屑">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">标签</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          标签：{tag.name}
        </h1>
        <p className="text-gray-500">共 {total} 条相关内容</p>
      </header>

      {items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">该标签下暂无内容</div>
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
          <Pagination page={page} pageSize={pageSize} total={total} basePath={`/tag/${slug}`} />
        </>
      )}
    </div>
  );
}
