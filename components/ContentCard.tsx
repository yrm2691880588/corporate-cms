import Link from "next/link";
import type { Content } from "@/lib/content";

/** 内容卡片：用于列表页 */
export default function ContentCard({
  item,
  basePath,
}: {
  item: Content;
  basePath: string;
}) {
  const href = `${basePath}/${item.slug}`;
  const date = item.publishedAt ?? item.createdAt;

  return (
    <Link
      href={href}
      className="group block bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200"
    >
      {item.coverImage ? (
        <div className="aspect-[16/10] bg-gray-50 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverThumb ?? item.coverImage}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-[16/10] bg-gradient-to-br from-indigo-50 to-cyan-50 flex items-center justify-center">
          <span className="text-4xl font-bold text-indigo-200">
            {item.title.slice(0, 1)}
          </span>
        </div>
      )}

      <div className="p-5">
        {item.categoryName && (
          <span className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mb-2">
            {item.categoryName}
          </span>
        )}
        <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-600 transition mb-2">
          {item.title}
        </h3>
        {item.summary && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">
            {item.summary}
          </p>
        )}
        <time className="text-xs text-gray-400">
          {new Date(date).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}
        </time>
      </div>
    </Link>
  );
}
