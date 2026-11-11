import type { Metadata } from "next";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  // 用实际访问地址，而非写死的 localhost —— 否则局域网/公网访问时
  // og:image 等绝对地址会指向错误主机，微信分享缩略图会裂。
  const base = await getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: {
      default: `${s.shortName} - ${s.tagline}`,
      template: `%s | ${s.seo.titleSuffix}`,
    },
    description: s.seo.defaultDescription,
    keywords: s.seo.keywords,
    openGraph: {
      type: "website",
      siteName: s.shortName,
      title: s.shortName,
      description: s.seo.defaultDescription,
      images: [s.logo],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 主题色注入：后台改完立即生效（每次请求重新读取）
  const s = getSettings();

  return (
    <html lang="zh-CN">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--brand:${s.theme.primary};--brand-dark:${s.theme.primaryDark};--accent:${s.theme.accent};}`,
          }}
        />
      </head>
      <body>
        {children}
        {/* 全站 Toast 容器（sonner），替换浏览器原生 alert */}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
