"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteConfig } from "@/config/site.config";

/**
 * 站点头部
 *
 * 配置由服务端（app/(site)/layout.tsx）通过 props 传入，
 * 这样改动设置后无需在客户端重复读取，也不会出现水合不一致。
 */
export default function SiteHeader({
  config,
  nav,
}: {
  config: SiteConfig;
  nav: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.logo}
              alt={config.shortName}
              className="h-9 w-9 object-contain rounded-md"
            />
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              {config.shortName}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-2 text-sm font-medium text-gray-600 rounded-lg hover:text-gray-900 hover:bg-gray-50 transition"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 -mr-2 text-gray-600"
            aria-label={open ? "关闭菜单" : "打开菜单"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-gray-700 border-b border-gray-50 last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
