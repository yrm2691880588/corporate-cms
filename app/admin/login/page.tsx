import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { hasGateCookie } from "@/lib/admin-gate";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录",
  robots: { index: false, follow: false },
};

/**
 * 登录页
 *
 * 口令校验只读取 Cookie（只读操作，页面里可以做）。
 * 写 Cookie 必须走 /api/admin-gate?token=xxx（Route Handler）。
 *
 * 未通过口令时返回 404，不暴露登录框。
 */
export default async function LoginPage() {
  if (!(await hasGateCookie())) notFound();

  const user = await getCurrentUser();
  if (user) redirect("/admin");

  const config = getSettings();
  return <LoginForm logo={config.logo} shortName={config.shortName} />;
}
