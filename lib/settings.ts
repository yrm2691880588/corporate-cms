/**
 * 站点设置 —— 数据库优先，配置文件兜底
 *
 * 【为什么这样设计】
 * - config/site.config.ts 是「出厂默认值」：全新安装时用它，换公司时改它
 * - 数据库 settings 表是「运行时覆盖」：同事在后台改的值，优先于配置文件
 * - 两者都有，就能同时满足「非技术人员自己改」和「开发者一键换品牌」
 *
 * 【优先级】数据库 > 配置文件 > 代码内硬编码兜底
 */

import { getDb } from "./db";
import { settings as settingsTable } from "./schema";
import { siteConfig, type SiteConfig, type NavItem } from "@/config/site.config";

export type SiteSettings = SiteConfig;

/** 需要存进数据库的字段（扁平 key） */
const KEYS = {
  legalName: "brand.legalName",
  shortName: "brand.shortName",
  tagline: "brand.tagline",
  headline: "brand.headline",
  subheadline: "brand.subheadline",
  logo: "brand.logo",
  icpNumber: "brand.icpNumber",
  phone: "contact.phone",
  email: "contact.email",
  address: "contact.address",
  workTime: "contact.workTime",
  primary: "theme.primary",
  primaryDark: "theme.primaryDark",
  accent: "theme.accent",
  nav: "nav.items",
  titleSuffix: "seo.titleSuffix",
  defaultDescription: "seo.defaultDescription",
} as const;

function readAll(): Record<string, string> {
  const rows = getDb().select().from(settingsTable).all();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/**
 * 取站点设置（数据库覆盖配置文件）。
 *
 * 每次调用都读数据库 —— 几十行数据，开销可忽略，
 * 换来的是「后台改完立即生效」，不需要重启或缓存失效逻辑。
 */
export function getSettings(): SiteSettings {
  const db = readAll();
  const pick = (key: string, fallback: string) =>
    db[key] !== undefined && db[key] !== "" ? db[key] : fallback;

  let nav: NavItem[] = siteConfig.nav;
  if (db[KEYS.nav]) {
    try {
      const parsed = JSON.parse(db[KEYS.nav]);
      if (Array.isArray(parsed) && parsed.length > 0) nav = parsed;
    } catch {
      // 数据损坏时退回默认导航，不让整个站点挂掉
    }
  }

  return {
    ...siteConfig,
    legalName: pick(KEYS.legalName, siteConfig.legalName),
    shortName: pick(KEYS.shortName, siteConfig.shortName),
    tagline: pick(KEYS.tagline, siteConfig.tagline),
    headline: pick(KEYS.headline, siteConfig.headline),
    subheadline: pick(KEYS.subheadline, siteConfig.subheadline),
    logo: pick(KEYS.logo, siteConfig.logo),
    icpNumber: db[KEYS.icpNumber] ?? siteConfig.icpNumber,
    contact: {
      phone: pick(KEYS.phone, siteConfig.contact.phone),
      email: pick(KEYS.email, siteConfig.contact.email),
      address: pick(KEYS.address, siteConfig.contact.address),
      workTime: pick(KEYS.workTime, siteConfig.contact.workTime),
    },
    theme: {
      primary: pick(KEYS.primary, siteConfig.theme.primary),
      primaryDark: pick(KEYS.primaryDark, siteConfig.theme.primaryDark),
      accent: pick(KEYS.accent, siteConfig.theme.accent),
    },
    nav,
    seo: {
      ...siteConfig.seo,
      titleSuffix: pick(KEYS.titleSuffix, siteConfig.seo.titleSuffix),
      defaultDescription: pick(KEYS.defaultDescription, siteConfig.seo.defaultDescription),
    },
  };
}

/** 保存设置。只写入传入的字段，未传的保持原样。 */
export function saveSettings(patch: Partial<{
  legalName: string;
  shortName: string;
  tagline: string;
  headline: string;
  subheadline: string;
  logo: string;
  icpNumber: string;
  phone: string;
  email: string;
  address: string;
  workTime: string;
  primary: string;
  primaryDark: string;
  accent: string;
  nav: NavItem[];
  titleSuffix: string;
  defaultDescription: string;
}>): void {
  const db = getDb();

  /** 写入或覆盖一条设置（Drizzle upsert） */
  const put = (key: string, value: string) => {
    db.insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } })
      .run();
  };

  const direct: Array<[keyof typeof KEYS, any]> = [
    ["legalName", patch.legalName],
    ["shortName", patch.shortName],
    ["tagline", patch.tagline],
    ["headline", patch.headline],
    ["subheadline", patch.subheadline],
    ["logo", patch.logo],
    ["icpNumber", patch.icpNumber],
    ["phone", patch.phone],
    ["email", patch.email],
    ["address", patch.address],
    ["workTime", patch.workTime],
    ["primary", patch.primary],
    ["primaryDark", patch.primaryDark],
    ["accent", patch.accent],
    ["titleSuffix", patch.titleSuffix],
    ["defaultDescription", patch.defaultDescription],
  ];

  for (const [field, value] of direct) {
    if (value === undefined) continue;
    put(KEYS[field], String(value));
  }

  if (patch.nav !== undefined) {
    put(KEYS.nav, JSON.stringify(patch.nav));
  }
}

/** 恢复为配置文件中的默认值（清空所有覆盖） */
export function resetSettings(): void {
  getDb().delete(settingsTable).run();
}

/** 根据主题色推导次要色（同色系加深），避免用户只填一个颜色时对比度不足 */
export function deriveDarker(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * 0.78));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * 0.78));
  const b = Math.max(0, Math.round((n & 255) * 0.78));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
