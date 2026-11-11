/**
 * 内容类型与状态的展示映射 —— 单一真源
 *
 * 【为什么集中】
 * 原先「文章/产品/单页」和三档状态的文案在列表页、编辑页各写一份，
 * 加一种类型要改好几处，容易漏。
 * 现在只在这里定义，其他地方引用。
 */

import type { ContentType, ContentStatus } from "./content";

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  article: "文章",
  product: "产品",
  page: "单页",
};

/** 内容类型对应的前台路径前缀 */
export const CONTENT_TYPE_PATH: Record<ContentType, string> = {
  article: "/news",
  product: "/products",
  page: "/",
};

export const CONTENT_STATUS_META: Record<
  ContentStatus,
  { label: string; variant: "default" | "success" | "warning" | "info" }
> = {
  draft: { label: "草稿", variant: "default" },
  published: { label: "已发布", variant: "success" },
  offline: { label: "已下线", variant: "warning" },
  scheduled: { label: "定时", variant: "info" },
};
