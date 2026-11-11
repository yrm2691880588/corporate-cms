"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * 全局错误边界
 *
 * 没有它时，任何渲染异常都会显示 Next.js 的英文调试页，
 * 用户看不懂，也不知道能做什么。
 *
 * 客户端边界只负责「把错误显示成人话」+ 上报到服务端。
 * 真正的写文件在 /api/log 里做，因为浏览器没有文件系统权限。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        where: "客户端渲染",
        message: error.message,
        stack: error.stack?.slice(0, 2000),
        digest: error.digest,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">页面出了点问题</h1>
        <p className="text-sm text-gray-500 mb-6">
          这不是你的操作有误。可以点下面的按钮重试，如果一直不行，请联系管理员。
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>重试</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            回到首页
          </Button>
        </div>
      </div>
    </div>
  );
}
