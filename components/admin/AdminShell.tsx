"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Trash2,
  UserCircle,
  FileText,
  FolderTree,
  Images,
  MessageSquare,
  Users,
  ScrollText,
  FileWarning,
  Settings2,
  ExternalLink,
  LogOut,
  Menu,
} from "lucide-react";
import type { SiteConfig } from "@/config/site.config";
import type { SessionUser } from "@/lib/auth";

/**
 * 后台外壳
 *
 * 图标统一用 lucide-react（shadcn/ui 官方配套），不再手绘 SVG path。
 * 品牌信息由服务端传入，避免客户端重复读库。
 */
const NAV = [
  { href: "/admin", label: "概览", icon: LayoutDashboard },
  { href: "/admin/contents", label: "内容管理", icon: FileText },
  { href: "/admin/categories", label: "栏目管理", icon: FolderTree },
  { href: "/admin/media", label: "图片库", icon: Images },
  { href: "/admin/messages", label: "留言", icon: MessageSquare },
  { href: "/admin/trash", label: "回收站", icon: Trash2, adminOnly: true },
  { href: "/admin/users", label: "用户", icon: Users, adminOnly: true },
  { href: "/admin/settings", label: "站点设置", icon: Settings2, adminOnly: true },
  { href: "/admin/logs", label: "操作日志", icon: ScrollText, adminOnly: true },
  { href: "/admin/errors", label: "错误日志", icon: FileWarning, adminOnly: true },
  { href: "/admin/profile", label: "我的账号", icon: UserCircle },
];

export default function AdminShell({
  user,
  config,
  children,
}: {
  user: SessionUser;
  config: SiteConfig;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || user.role === "admin");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 flex flex-col transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.logo} alt="" className="h-8 w-8 object-contain rounded" />
          <span className="font-bold text-gray-900 text-sm truncate">{config.shortName}</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
            <p className="text-xs text-gray-400">
              {user.role === "admin" ? "管理员" : "编辑"}
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            查看官网
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden h-14 bg-white border-b border-gray-100 flex items-center px-4">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-gray-600" aria-label="打开菜单">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm ml-2">管理后台</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
