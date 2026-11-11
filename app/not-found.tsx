import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">页面不存在</h1>
      <p className="text-gray-500 mb-8">
        你访问的页面可能已被移除，或者链接地址有误。
      </p>
      <Link href="/" className="btn btn-primary">
        返回首页
      </Link>
    </div>
  );
}
