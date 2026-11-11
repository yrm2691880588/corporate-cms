/**
 * URL 别名（slug）规范化 —— 单一真源
 *
 * 【为什么单独成文件】
 * 原先这个逻辑在 API 路由和前端表单里各写了一份，
 * 三处实现一旦漂移，就会出现「前台生成的 slug 后端不接受」这类问题。
 */

/** 规范化为 URL 安全的小写连字符串。中文等非 ASCII 字符会被剥离，可能返回空串。 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 生成 slug；纯中文标题规范化后会变空，此时用时间戳兜底，
 * 保证一定有值且不冲突。
 */
export function makeSlug(input: string): string {
  const normalized = normalizeSlug(input);
  if (normalized.length >= 3) return normalized;
  return `post-${Date.now().toString(36)}`;
}
