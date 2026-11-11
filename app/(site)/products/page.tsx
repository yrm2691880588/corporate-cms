import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { listPublished } from "@/lib/content";
import ContentCard from "@/components/ContentCard";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    title: "产品与服务",
    description: `${s.shortName}提供的产品与服务一览。`,
    alternates: { canonical: "/products" },
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const { items, total, pageSize } = listPublished({
    type: "product",
    page,
    pageSize: 12,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">产品与服务</h1>
        <p className="text-gray-500">
          为企业提供可直接使用的 AI 能力，开箱即用，按需扩展
        </p>
      </header>

      {items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">暂无产品</div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} basePath="/products" />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/products" />
        </>
      )}
    </div>
  );
}
