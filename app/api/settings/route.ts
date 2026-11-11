import { NextRequest, NextResponse } from "next/server";
import { withErrorLogging } from "@/lib/api-wrapper";
import { readJson } from "@/lib/http";
import { z } from "zod";
import { getCurrentUser, audit } from "@/lib/auth";
import { getSettings, saveSettings, resetSettings, deriveDarker } from "@/lib/settings";

/** 用 zod 统一定义校验规则，避免散落的手写 if */
const navItemSchema = z.object({
  label: z.string().trim().min(1, "导航名称不能为空").max(20, "导航名称不超过 20 字"),
  href: z.string().trim().min(1, "链接不能为空").max(200),
});

const settingsSchema = z.object({
  legalName: z.string().trim().min(1, "公司全称不能为空").max(100),
  shortName: z.string().trim().min(1, "对外简称不能为空").max(30),
  tagline: z.string().trim().max(100).optional().default(""),
  headline: z.string().trim().max(100).optional().default(""),
  subheadline: z.string().trim().max(300).optional().default(""),
  logo: z.string().trim().max(300).optional().default(""),
  icpNumber: z.string().trim().max(50).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  email: z.string().trim().max(100).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  workTime: z.string().trim().max(100).optional().default(""),
  primary: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "主色需为 #RRGGBB 格式"),
  nav: z.array(navItemSchema).max(10, "导航最多 10 项").optional(),
  titleSuffix: z.string().trim().max(30).optional().default(""),
  defaultDescription: z.string().trim().max(300).optional().default(""),
});

async function handleGET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({ settings: getSettings() });
}

async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限，只有管理员能修改站点设置" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "数据格式不正确", field: first?.path?.join(".") },
      { status: 400 }
    );
  }

  const d = parsed.data;

  saveSettings({
    legalName: d.legalName,
    shortName: d.shortName,
    tagline: d.tagline,
    headline: d.headline,
    subheadline: d.subheadline,
    logo: d.logo || undefined,
    icpNumber: d.icpNumber,
    phone: d.phone,
    email: d.email,
    address: d.address,
    workTime: d.workTime,
    primary: d.primary,
    primaryDark: deriveDarker(d.primary),
    nav: d.nav,
    titleSuffix: d.titleSuffix || d.shortName,
    defaultDescription: d.defaultDescription,
  });

  audit(user.id, "update", "settings", undefined, "修改站点设置");

  return NextResponse.json({ ok: true });
}

/** 恢复为配置文件默认值 */
async function handleDELETE() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  resetSettings();
  audit(user.id, "update", "settings", undefined, "恢复站点设置为文件默认值");

  return NextResponse.json({ ok: true });
}


// ── 统一错误捕获：异常写入 data/logs，客户端收到中文提示 ──
export const GET = withErrorLogging("GET /api/settings", handleGET);
export const PUT = withErrorLogging("PUT /api/settings", handlePUT);
export const DELETE = withErrorLogging("DELETE /api/settings", handleDELETE);
