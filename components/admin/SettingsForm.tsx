"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SiteConfig, NavItem } from "@/config/site.config";

type Props = { initial: SiteConfig };

const TABS = [
  { id: "brand", label: "品牌信息" },
  { id: "home", label: "首页文案" },
  { id: "contact", label: "联系方式" },
  { id: "nav", label: "导航菜单" },
  { id: "seo", label: "SEO" },
] as const;

export default function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("brand");
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    legalName: initial.legalName,
    shortName: initial.shortName,
    tagline: initial.tagline,
    headline: initial.headline,
    subheadline: initial.subheadline,
    logo: initial.logo,
    icpNumber: initial.icpNumber,
    phone: initial.contact.phone,
    email: initial.contact.email,
    address: initial.contact.address,
    workTime: initial.contact.workTime,
    primary: initial.theme.primary,
    titleSuffix: initial.seo.titleSuffix,
    defaultDescription: initial.seo.defaultDescription,
  });
  const [nav, setNav] = useState<NavItem[]>(initial.nav);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "上传失败");
        return;
      }
      setForm((f) => ({ ...f, logo: json.url }));
      toast.success("Logo 已上传，保存后生效");
    } catch {
      toast.error("上传失败，请检查网络");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nav }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "保存失败");
        return;
      }
      toast.success("已保存，前台立即生效");
      router.refresh();
    } catch {
      toast.error("网络异常，保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    setResetOpen(false);
    const res = await fetch("/api/settings", { method: "DELETE" });
    if (!res.ok) {
      toast.error("恢复失败");
      return;
    }
    toast.success("已恢复为默认值");
    router.refresh();
  }

  function addNav() {
    if (nav.length >= 10) {
      toast.error("导航最多 10 项");
      return;
    }
    setNav([...nav, { label: "新菜单", href: "/" }]);
  }

  function updateNav(i: number, patch: Partial<NavItem>) {
    setNav(nav.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }

  function removeNav(i: number) {
    setNav(nav.filter((_, idx) => idx !== i));
  }

  function moveNav(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= nav.length) return;
    const next = [...nav];
    [next[i], next[j]] = [next[j], next[i]];
    setNav(next);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">站点设置</h1>
          <p className="text-sm text-gray-500 mt-1">
            修改后前台立即生效，不需要重启服务
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 品牌信息 */}
      {tab === "brand" && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>显示在导航栏、页脚和浏览器标签</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="legalName">公司全称</Label>
                  <Input
                    id="legalName"
                    value={form.legalName}
                    onChange={set("legalName")}
                    className="mt-1.5"
                    placeholder="用于页脚版权"
                  />
                </div>
                <div>
                  <Label htmlFor="shortName">对外简称</Label>
                  <Input
                    id="shortName"
                    value={form.shortName}
                    onChange={set("shortName")}
                    className="mt-1.5"
                    placeholder="显示在导航栏"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tagline">一句话介绍</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={set("tagline")}
                  className="mt-1.5"
                  placeholder="显示在导航栏下方、页脚"
                />
              </div>
              <div>
                <Label htmlFor="icpNumber">备案号（选填）</Label>
                <Input
                  id="icpNumber"
                  value={form.icpNumber}
                  onChange={set("icpNumber")}
                  className="mt-1.5"
                  placeholder="如：沪ICP备12345678号"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo 与主题色</CardTitle>
              <CardDescription>Logo 建议正方形，主题色影响全站按钮和强调元素</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {form.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.logo} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400">无</span>
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 h-9 rounded-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    {uploading ? "上传中…" : "更换 Logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  建议 PNG 或 SVG，透明底色，上传后自动压缩
                </p>
              </div>

              <div>
                <Label htmlFor="primary">主题色</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary}
                    onChange={set("primary")}
                    className="h-9 w-14 rounded-md border border-gray-300 cursor-pointer"
                    aria-label="选择主题色"
                  />
                  <Input
                    id="primary"
                    value={form.primary}
                    onChange={set("primary")}
                    className="w-32 font-mono text-sm"
                    placeholder="#4F46E5"
                  />
                  <span
                    className="h-9 px-4 rounded-md flex items-center text-sm font-medium text-white"
                    style={{ background: form.primary }}
                  >
                    预览按钮
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 首页文案 */}
      {tab === "home" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">首页首屏文案</CardTitle>
            <CardDescription>访客打开首页第一眼看到的内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="headline">主标题</Label>
              <Input
                id="headline"
                value={form.headline}
                onChange={set("headline")}
                className="mt-1.5"
                placeholder="如：把 AI 变成你公司真正在用的工具"
              />
              <p className="text-xs text-gray-400 mt-1">建议 15-25 字，太长会换行</p>
            </div>
            <div>
              <Label htmlFor="subheadline">副标题</Label>
              <Textarea
                id="subheadline"
                value={form.subheadline}
                onChange={set("subheadline")}
                className="mt-1.5"
                rows={3}
                placeholder="补充说明你们做什么、为谁解决什么问题"
              />
              <p className="text-xs text-gray-400 mt-1">建议 40-80 字</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 联系方式 */}
      {tab === "contact" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">联系方式</CardTitle>
            <CardDescription>显示在页脚和「联系我们」页面</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">电话</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" value={form.email} onChange={set("email")} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="address">地址</Label>
              <Input id="address" value={form.address} onChange={set("address")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="workTime">工作时间</Label>
              <Input
                id="workTime"
                value={form.workTime}
                onChange={set("workTime")}
                className="mt-1.5"
                placeholder="如：周一至周五 9:00 - 18:00"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导航 */}
      {tab === "nav" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">顶部导航菜单</CardTitle>
            <CardDescription>最多 10 项，顺序即显示顺序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nav.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveNav(i, -1)}
                    disabled={i === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                    aria-label="上移"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveNav(i, 1)}
                    disabled={i === nav.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                    aria-label="下移"
                  >
                    ▼
                  </button>
                </div>
                <Input
                  value={item.label}
                  onChange={(e) => updateNav(i, { label: e.target.value })}
                  placeholder="显示名称"
                  className="max-w-[160px]"
                  aria-label={`第 ${i + 1} 项名称`}
                />
                <Input
                  value={item.href}
                  onChange={(e) => updateNav(i, { href: e.target.value })}
                  placeholder="/news"
                  className="font-mono text-sm"
                  aria-label={`第 ${i + 1} 项链接`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeNav(i)}
                  aria-label={`删除第 ${i + 1} 项`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addNav} className="mt-2">
              <Plus className="h-4 w-4" />
              添加菜单项
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              提示：链接填站内路径（如 /news、/about）或完整网址
            </p>
          </CardContent>
        </Card>
      )}

      {/* SEO */}
      {tab === "seo" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">搜索引擎优化</CardTitle>
            <CardDescription>影响页面在百度、谷歌搜索结果中的样子</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="titleSuffix">标题后缀</Label>
              <Input
                id="titleSuffix"
                value={form.titleSuffix}
                onChange={set("titleSuffix")}
                className="mt-1.5"
                placeholder="显示在每页标题后面"
              />
              <p className="text-xs text-gray-400 mt-1">
                效果：页面标题 | {form.titleSuffix || "（未设置）"}
              </p>
            </div>
            <div>
              <Label htmlFor="defaultDescription">默认描述</Label>
              <Textarea
                id="defaultDescription"
                value={form.defaultDescription}
                onChange={set("defaultDescription")}
                className="mt-1.5"
                rows={3}
                placeholder="没有单独设置描述的页面会使用这段文字"
              />
              <p className="text-xs text-gray-400 mt-1">建议 80-120 字</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 恢复默认确认框：用 Radix Dialog，支持 Esc 关闭和焦点管理 */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>恢复为默认设置？</DialogTitle>
            <DialogDescription>
              你在后台做过的所有修改都会被清除，恢复为配置文件
              <code className="mx-1 px-1 bg-gray-100 rounded text-xs">config/site.config.ts</code>
              中的值。文章、产品等内容不受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={doReset}>
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
