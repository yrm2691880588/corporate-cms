import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getPageBySlug } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const settings = getSettings();
  const item = getPageBySlug(slug);
  if (!item) return { title: "页面不存在" };

  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.summary || settings.seo.defaultDescription,
    alternates: { canonical: `/${item.slug}` },
  };
}

export default async function SinglePage({ params }: Params) {
  const { slug } = await params;
  const item = getPageBySlug(slug);
  if (!item) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <nav className="text-sm text-gray-400 mb-6" aria-label="面包屑">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{item.title}</span>
      </nav>

      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight mb-8">
        {item.title}
      </h1>

      {item.coverImage && (
        // 固定比例容器：竖图不会把正文挤到屏幕外（见 ADR-0006）
        <div className="aspect-[21/9] overflow-hidden rounded-xl mb-8 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="prose-content" dangerouslySetInnerHTML={{ __html: item.body }} />
    </div>
  );
}
