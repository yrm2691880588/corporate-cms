import Link from "next/link";
import type { SiteConfig } from "@/config/site.config";

export default function SiteFooter({ config }: { config: SiteConfig }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logo}
                alt={config.shortName}
                className="h-8 w-8 object-contain rounded-md"
              />
              <span className="font-bold text-gray-900">{config.shortName}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              {config.tagline}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">快速导航</h3>
            <ul className="space-y-2">
              {config.footerLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">联系我们</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              {config.contact.phone && <li>电话：{config.contact.phone}</li>}
              {config.contact.email && <li>邮箱：{config.contact.email}</li>}
              {config.contact.address && <li>地址：{config.contact.address}</li>}
              {config.contact.workTime && <li>工作时间：{config.contact.workTime}</li>}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            © {year} {config.legalName} 版权所有
          </p>
          <div className="flex items-center gap-4">
            {config.icpNumber && (
              <a
                href="https://beian.miit.gov.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {config.icpNumber}
              </a>
            )}
            {/*
              后台管理入口。
              放在页脚最底部、字号最小、颜色最浅，访客几乎不会注意到，
              但管理员自己知道位置，点一下就能进。
              注意：隐藏入口不构成安全屏障（/admin/login 这个路径本身可猜），
              真正的防护是登录校验 + 限流 + 密码强度。
            */}
            <Link
              href="/admin/login"
              className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
              title="管理员登录"
            >
              管理入口
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
