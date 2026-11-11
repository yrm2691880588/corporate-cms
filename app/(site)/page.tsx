import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listPublished } from "@/lib/content";
import ContentCard from "@/components/ContentCard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const settings = getSettings();

  const featured = listPublished({ pageSize: settings.featuredCount, featuredOnly: true });
  const latest = listPublished({ type: "article", pageSize: 6 });
  const products = listPublished({ type: "product", pageSize: 3 });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {settings.tagline}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-5">
              {settings.headline}
            </h1>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8">
              {settings.subheadline}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="btn btn-primary">
                免费咨询
              </Link>
              <Link href="/products" className="btn btn-secondary">
                查看产品
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 推荐内容 */}
      {featured.items.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">精选内容</h2>
              <p className="text-sm text-gray-500">值得一看的产品与动态</p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                basePath={item.type === "product" ? "/products" : "/news"}
              />
            ))}
          </div>
        </section>
      )}

      {/* 产品 */}
      {products.items.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">产品与服务</h2>
                <p className="text-sm text-gray-500">为企业提供可直接使用的 AI 能力</p>
              </div>
              <Link href="/products" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                全部产品 →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.items.map((item) => (
                <ContentCard key={item.id} item={item} basePath="/products" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 新闻 */}
      {latest.items.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">新闻动态</h2>
              <p className="text-sm text-gray-500">了解我们的最新进展</p>
            </div>
            <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              全部文章 →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.items.map((item) => (
              <ContentCard key={item.id} item={item} basePath="/news" />
            ))}
          </div>
        </section>
      )}

      {/* 空站提示：不暴露后台地址，只给一句中性提示 */}
      {featured.items.length === 0 && latest.items.length === 0 && products.items.length === 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <p className="text-gray-400">站点内容正在准备中</p>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-cyan-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            准备好让 AI 帮你干活了吗？
          </h2>
          <p className="text-indigo-100 mb-8">
            留下联系方式，我们的顾问会在一个工作日内与你联系。
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-8 py-3.5 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-indigo-50 transition"
          >
            立即咨询
          </Link>
        </div>
      </section>
    </>
  );
}
