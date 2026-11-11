/**
 * 站点品牌配置 —— 全站唯一真源
 *
 * 【换公司怎么改】
 * 只需要改这个文件里的内容，前台所有品牌信息（名称、logo、配色、
 * 联系方式、导航、SEO 默认值）会一起变化，不需要改任何其他代码。
 *
 * 【注意】
 * 这里只放"品牌与展示"信息，不放业务逻辑。
 * 内容（文章、产品、单页）在 content/ 目录，账号在数据库。
 */

export type NavItem = {
  /** 显示名称 */
  label: string;
  /** 链接地址 */
  href: string;
};

export type SiteConfig = {
  /** 公司全称（用于页脚版权、SEO） */
  legalName: string;
  /** 对外简称（用于导航栏、页面标题后缀） */
  shortName: string;
  /** 一句话定位（用于首页主标题下方、SEO 默认描述） */
  tagline: string;
  /** 首页主标题 */
  headline: string;
  /** 首页副标题 */
  subheadline: string;
  /** Logo 图片路径（放在 public/ 下） */
  logo: string;
  /** 站点根地址（用于生成 sitemap 绝对链接；一期为本机地址） */
  siteUrl: string;
  /** 品牌主色（CSS 颜色值） */
  theme: {
    primary: string;
    primaryDark: string;
    accent: string;
  };
  /** 联系方式 */
  contact: {
    phone: string;
    email: string;
    address: string;
    workTime: string;
  };
  /** 顶部导航（栏目页由数据库驱动，这里放固定页面） */
  nav: NavItem[];
  /** 页脚链接 */
  footerLinks: NavItem[];
  /** 备案号（有则显示，没有就留空） */
  icpNumber: string;
  /** SEO 默认值 */
  seo: {
    /** 页面标题后缀，如「Demo CMS」 */
    titleSuffix: string;
    /** 默认描述 */
    defaultDescription: string;
    /** 默认关键词 */
    keywords: string[];
  };
  /** 首页推荐位数量 */
  featuredCount: number;
  /** 列表页每页条数 */
  pageSize: number;
};

export const siteConfig: SiteConfig = {
  legalName: "示例科技有限公司",
  shortName: "Demo CMS",
  tagline: "让每一家企业都用得上、用得好的 AI",
  headline: "把 AI 变成你公司真正在用的工具",
  subheadline:
    "一个可复用的企业官网内容管理系统，开箱即用，支持文章、产品与单页的发布与管理。",
  logo: "/brand/logo.png",
  siteUrl: "http://localhost:3000",

  theme: {
    primary: "#4F46E5",
    primaryDark: "#3730A3",
    accent: "#06B6D4",
  },

  contact: {
    phone: "400-000-0000",
    email: "hello@example.com",
    address: "上海市浦东新区示例路 100 号",
    workTime: "周一至周五 9:00 - 18:00",
  },

  nav: [
    { label: "首页", href: "/" },
    { label: "产品与服务", href: "/products" },
    { label: "新闻动态", href: "/news" },
    { label: "关于我们", href: "/about" },
    { label: "联系我们", href: "/contact" },
  ],

  footerLinks: [
    { label: "关于我们", href: "/about" },
    { label: "联系我们", href: "/contact" },
    { label: "新闻动态", href: "/news" },
  ],

  icpNumber: "",

  seo: {
    titleSuffix: "Demo CMS",
    defaultDescription:
      "一个可复用的企业官网内容管理系统，支持内容发布、SEO 优化与后台管理。",
    keywords: ["企业官网", "内容管理系统", "CMS", "Next.js"],
  },

  featuredCount: 3,
  pageSize: 10,
};
