import Link from "next/link";

export default function Pagination({
  page,
  pageSize,
  total,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`);

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-12" aria-label="分页">
      {page > 1 && (
        <Link href={href(page - 1)} className="px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          上一页
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={href(1)} className="px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">1</Link>
          {start > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={
            p === page
              ? "px-3.5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold"
              : "px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          }
        >
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
          <Link href={href(totalPages)} className="px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className="px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          下一页
        </Link>
      )}
    </nav>
  );
}
