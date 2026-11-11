import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { hasGateCookie } from "@/lib/admin-gate";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理后台",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /**
   * 可选的访问口令（环境变量 ADMIN_GATE_TOKEN 控制，默认关闭）。
   *
   * 没通过时返回 404 而不是 403 —— 403 等于告诉扫描器「这里确实有东西」，
   * 404 让它以为路径不存在，降低继续尝试的动机。
   *
   * 口令的换取在登录页完成（Page 组件才能拿到 searchParams）。
   *
   * 注意：这不是安全屏障，真正的防护是密码 + 登录限流。
   */
  if (!(await hasGateCookie())) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const config = getSettings();

  return (
    <AdminShell user={user} config={config}>
      {children}
    </AdminShell>
  );
}
