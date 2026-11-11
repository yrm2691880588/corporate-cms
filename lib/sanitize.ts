/**
 * HTML 净化 —— 渲染用户编写的富文本前必须经过这里
 *
 * 【为什么需要】
 * 正文由编辑在富文本编辑器里撰写，最终用 dangerouslySetInnerHTML 注入页面。
 * 如果不过滤，任何能写内容的人（编辑账号、或绕过界面的直接接口调用）
 * 都可以插入 <script>、onerror= 等，对访客形成 XSS。
 *
 * 【策略】白名单，不黑名单：
 * 只允许 Tiptap 编辑器实际会产生的标签与属性，其余一律丢弃。
 * 新增编辑器功能时，需要同步在这里放行对应标签。
 *
 * 【视频为什么用 iframe 白名单，而不是放开任意 iframe】
 * 任意 iframe 可以嵌入钓鱼页、伪装成页面的一部分骗取输入。
 * 因此只放行已知视频平台的域名，其他 iframe 一律丢弃。
 * 视频本身放在 <div class="video-embed"> 里，由 CSS 控制响应式比例。
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "code", "pre",
  "hr",
  "span", "div",
  // 视频：原生 video 标签 + 受控 iframe
  "video", "source", "iframe",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "title", "width", "height",
  "colspan", "rowspan",
  "class",
  // video 需要
  "controls", "poster", "preload", "type", "muted", "loop", "playsinline",
  // iframe 需要（allowfullscreen 是视频全屏所必需）
  "allow", "allowfullscreen", "frameborder", "referrerpolicy",
];

/**
 * 允许被 iframe 嵌入的域名白名单。
 *
 * 只放行主流视频平台。新增平台时在这里加一行，
 * 并在编辑器里同步提供对应的「插入视频」选项。
 */
const ALLOWED_IFRAME_HOSTS = [
  "player.bilibili.com",
  "www.bilibili.com",
  "player.youku.com",
  "v.qq.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
];

/**
 * 判断某个 iframe 的 src 是否属于允许的视频平台。
 * 用 URL 解析而不是字符串包含，避免 `evil.com/?x=player.bilibili.com` 这类绕过。
 */
function isAllowedIframe(src: string): boolean {
  try {
    const u = new URL(src, "https://placeholder.local");
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_IFRAME_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 禁止 javascript: / data: 等危险协议
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });

  // 二次过滤：移除不在白名单里的 iframe
  // DOMPurify 已去掉事件属性，但 iframe 的「目标页面」本身也要管住
  return clean.replace(/<iframe\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc\s*=\s*"([^"]*)"/i) || tag.match(/\bsrc\s*=\s*'([^']*)'/i);
    const src = m ? m[1] : "";
    return isAllowedIframe(src) ? tag : "";
  });
}

/** 供编辑器使用：把用户粘贴的链接规范成可嵌入的 iframe 地址 */
export function toEmbedUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // 已经是 iframe 地址
  if (isAllowedIframe(raw)) return raw;

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    // B 站：BV 号
    if (host.endsWith("bilibili.com")) {
      const bv = u.pathname.match(/\/video\/(BV[\w]+)/i);
      if (bv) return `https://player.bilibili.com/player.html?bvid=${bv[1]}&autoplay=0`;
    }

    // YouTube
    if (host.endsWith("youtube.com") || host === "youtu.be") {
      const id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : u.searchParams.get("v") || u.pathname.match(/\/embed\/([\w-]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }

    // Vimeo
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }

  return null;
}
