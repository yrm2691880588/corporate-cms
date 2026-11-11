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
  if (!item) return { title: "产品不存在" };

  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.summary || settings.seo.defaultDescription,
    alternates: { canonical: `/products/${item.slug}` },
    openGraph: {
      title: item.title,
      description: item.summary ?? undefined,
      images: item.coverImage ? [item.coverImage] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Params) {
  const { slug } = await params;
  const item = getPublishedBySlug(slug);
  if (!item) notFound();

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <nav className="text-sm text-gray-400 mb-6" aria-label="面包屑">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-gray-600">产品与服务</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{item.title}</span>
      </nav>

      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
        {item.title}
      </h1>

      {item.summary && (
        <p className="text-lg text-gray-600 leading-relaxed mb-8">{item.summary}</p>
      )}

      {item.coverImage && (
        // 产品图用 object-contain：不裁切，保证产品完整可见（见 ADR-0006）
        <div className="aspect-[16/9] overflow-hidden rounded-xl mb-10 bg-gray-50 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      <div className="prose-content" dangerouslySetInnerHTML={{ __html: item.body }} />

      <div className="mt-14 p-8 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-xl text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">对「{item.title}」感兴趣？</h2>
        <p className="text-gray-600 mb-6 text-sm">留下联系方式，我们会为你安排一次针对性的演示。</p>
        <Link href="/contact" className="btn btn-primary">
          获取方案与报价
        </Link>
      </div>

      <div className="mt-10">
        <Link href="/products" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← 返回产品列表
        </Link>
      </div>
    </article>
  );
}
