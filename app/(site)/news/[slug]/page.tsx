import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getPublishedBySlug } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const settings = getSettings();
  const item = getPublishedBySlug(slug);
  if (!item) return { title: "文章不存在" };

  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.summary || settings.seo.defaultDescription,
    alternates: { canonical: `/news/${item.slug}` },
    openGraph: {
      type: "article",
      title: item.title,
      description: item.summary ?? undefined,
      images: item.coverImage ? [item.coverImage] : undefined,
      publishedTime: item.publishedAt ?? undefined,
    },
  };
}

export default async function NewsDetailPage({ params }: Params) {
  const { slug } = await params;
  const settings = getSettings();
  const item = getPublishedBySlug(slug);
  if (!item) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    description: item.summary ?? undefined,
    image: item.coverImage ?? undefined,
    datePublished: item.publishedAt ?? item.createdAt,
    dateModified: item.updatedAt,
    author: { "@type": "Organization", name: settings.legalName },
    publisher: { "@type": "Organization", name: settings.legalName },
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-gray-400 mb-6" aria-label="面包屑">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/news" className="hover:text-gray-600">新闻动态</Link>
        {item.categoryName && (
          <>
            <span className="mx-2">/</span>
            <span className="text-gray-600">{item.categoryName}</span>
          </>
        )}
      </nav>

      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
        {item.title}
      </h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400 pb-6 mb-8 border-b border-gray-100">
        <time dateTime={item.publishedAt ?? item.createdAt}>
          {new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        {item.categoryName && <span>{item.categoryName}</span>}
        {item.tags && item.tags.length > 0 && (
          <span className="flex gap-2">
            {item.tags.map((t) => (
              <Link key={t.slug} href={`/tag/${t.slug}`} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-200">{t.name}</Link>
            ))}
          </span>
        )}
      </div>

      {item.coverImage && (
        // 固定比例容器：竖图不会把正文挤到屏幕外（见 ADR-0006）
        <div className="aspect-[21/9] overflow-hidden rounded-xl mb-8 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="prose-content" dangerouslySetInnerHTML={{ __html: item.body }} />

      <div className="mt-12 pt-8 border-t border-gray-100">
        <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← 返回新闻列表
        </Link>
      </div>
    </article>
  );
}
