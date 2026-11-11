import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { listPublished } from "@/lib/content";
import ContentCard from "@/components/ContentCard";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    title: "新闻动态",
    description: `${s.shortName}的最新动态、行业观察与产品更新。`,
    alternates: { canonical: "/news" },
  };
}

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const config = getSettings();

  const { items, total, pageSize } = listPublished({
    type: "article",
    page,
    pageSize: config.pageSize,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">新闻动态</h1>
        <p className="text-gray-500">
          {config.shortName}的最新动态、行业观察与产品更新
        </p>
      </header>

      {items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">暂无文章</div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} basePath="/news" />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/news" />
        </>
      )}
    </div>
  );
}
