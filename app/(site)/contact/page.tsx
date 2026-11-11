import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getPageBySlug } from "@/lib/content";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    title: "联系我们",
    description: `联系${s.shortName}：${s.contact.phone}，${s.contact.email}`,
    alternates: { canonical: "/contact" },
  };
}

export default function ContactPage() {
  const siteConfig = getSettings();
  // 如果后台建了 slug 为 contact 的单页，用它的正文；否则用默认联系方式
  const custom = getPageBySlug("contact");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">联系我们</h1>
        <p className="text-gray-500">
          无论是产品咨询、方案定制还是合作意向，我们都乐意与你聊聊。
        </p>
      </header>

      <div className="grid gap-10 md:grid-cols-5">
        {/* 左：联系信息 */}
        <div className="md:col-span-2">
          <div className="bg-gray-50 rounded-xl p-6 space-y-5">
            {siteConfig.contact.phone && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">电话</p>
                <p className="text-gray-900 font-medium">{siteConfig.contact.phone}</p>
              </div>
            )}
            {siteConfig.contact.email && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">邮箱</p>
                <p className="text-gray-900 font-medium break-all">{siteConfig.contact.email}</p>
              </div>
            )}
            {siteConfig.contact.address && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">地址</p>
                <p className="text-gray-900 font-medium">{siteConfig.contact.address}</p>
              </div>
            )}
            {siteConfig.contact.workTime && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">工作时间</p>
                <p className="text-gray-900 font-medium">{siteConfig.contact.workTime}</p>
              </div>
            )}
          </div>

          {custom && (
            <div
              className="prose-content mt-8 text-sm"
              dangerouslySetInnerHTML={{ __html: custom.body }}
            />
          )}
        </div>

        {/* 右：留言表单 */}
        <div className="md:col-span-3">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
