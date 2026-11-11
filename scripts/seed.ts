/**
 * 种子数据：初始化账号、栏目、示例内容
 *
 * 运行：npm run db:seed
 * 重复运行是安全的（已存在的数据会跳过）。
 */

import { getRawDb, now } from "../lib/db";
import { hashPassword } from "../lib/password";
import fs from "node:fs";
import path from "node:path";

const db = getRawDb();
const t = now();

// ─────────────────────────────────────────────
// 1. 管理员账号
// ─────────────────────────────────────────────
function ensureUser(username: string, password: string, displayName: string, role: "admin" | "editor") {
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return Number((exists as any).id);
  const res = db
    .prepare("INSERT INTO users (username, password_hash, display_name, role, status, created_at) VALUES (?,?,?,?,?,?)")
    .run(username, hashPassword(password), displayName, role, "active", t);
  console.log(`  ✓ 创建账号 ${username}（${displayName}，${role === "admin" ? "管理员" : "编辑"}）`);
  return Number(res.lastInsertRowid);
}

console.log("→ 初始化账号…");
const adminId = ensureUser("admin", "admin12345", "管理员", "admin");
ensureUser("editor", "editor12345", "内容编辑", "editor");

// ─────────────────────────────────────────────
// 2. 栏目
// ─────────────────────────────────────────────
function ensureCategory(name: string, slug: string, parentId: number | null, sortOrder: number, description?: string) {
  const exists = db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug);
  if (exists) return Number((exists as any).id);
  const res = db
    .prepare("INSERT INTO categories (parent_id, name, slug, description, sort_order, is_visible, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(parentId, name, slug, description ?? null, sortOrder, 1, t);
  return Number(res.lastInsertRowid);
}

console.log("→ 初始化栏目…");
const catNews = ensureCategory("新闻动态", "news", null, 1, "公司动态、行业观察与产品更新");
const catCompany = ensureCategory("公司新闻", "company", catNews, 1);
const catIndustry = ensureCategory("行业观察", "industry", catNews, 2);
const catProducts = ensureCategory("产品与服务", "products", null, 2, "面向中小企业的 AI 能力");
const catWriting = ensureCategory("智能写作", "ai-writing", catProducts, 1);
const catImage = ensureCategory("图像生成", "ai-image", catProducts, 2);
const catData = ensureCategory("数据洞察", "ai-data", catProducts, 3);
console.log(`  ✓ 栏目就绪（含两级）`);

// ─────────────────────────────────────────────
// 3. 内容
// ─────────────────────────────────────────────
function ensureContent(opts: {
  type: "article" | "product" | "page";
  title: string;
  slug: string;
  summary: string;
  body: string;
  categoryId: number | null;
  isFeatured?: boolean;
  sortOrder?: number;
  publishedAt?: string;
}) {
  const exists = db.prepare("SELECT id FROM contents WHERE slug = ?").get(opts.slug);
  if (exists) return Number((exists as any).id);

  const res = db
    .prepare(
      `INSERT INTO contents
       (type, title, slug, summary, body, cover_image, category_id, status, is_featured,
        seo_title, seo_description, author_id, last_editor_id, published_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      opts.type,
      opts.title,
      opts.slug,
      opts.summary,
      opts.body,
      null,
      opts.categoryId,
      "published",
      opts.isFeatured ? 1 : 0,
      null,
      null,
      adminId,
      adminId,
      opts.publishedAt ?? t,
      t,
      t
    );
  return Number(res.lastInsertRowid);
}

console.log("→ 初始化示例内容…");

// —— 产品 ——
const products = [
  {
    title: "智能写作助手",
    slug: "ai-writing-assistant",
    summary:
      "面向市场与运营团队的 AI 写作工具，从选题到成稿一条龙，帮助团队把内容产出效率提升 3 倍以上。",
    body: `<h2>把重复的文字工作交给 AI</h2>
<p>市场部每天都在写：公众号推文、产品说明、活动文案、客户案例。这些工作高度重复，却占用了团队大量时间。智能写作助手把这件事变成「说清楚需求 → 拿到初稿 → 人工精修」的三步流程。</p>

<h2>它具体能做什么</h2>
<ul>
<li><strong>选题建议</strong>：结合行业热点与你的历史内容，给出本周值得写的 5 个选题</li>
<li><strong>多版本初稿</strong>：同一主题一次生成 3 个不同风格的版本，供你挑选</li>
<li><strong>风格统一</strong>：导入 10 篇历史文章，学习你们公司的语气与用词习惯</li>
<li><strong>一键改写</strong>：把长文压缩成摘要，把口语稿改成书面语，把技术文档改成客户能看懂的说法</li>
<li><strong>SEO 优化</strong>：自动补充标题、描述与关键词，提升搜索曝光</li>
</ul>

<h2>适合谁用</h2>
<table>
<thead><tr><th>角色</th><th>典型场景</th><th>效果</th></tr></thead>
<tbody>
<tr><td>市场专员</td><td>每周 3 篇公众号</td><td>从 6 小时降到 1.5 小时</td></tr>
<tr><td>产品经理</td><td>产品说明书、更新日志</td><td>初稿当天完成</td></tr>
<tr><td>销售</td><td>客户定制方案</td><td>10 分钟生成初版</td></tr>
</tbody>
</table>

<h2>如何开始</h2>
<p>注册后导入你们的历史内容，系统会自动学习品牌语气。第一次使用建议从「改写现有文章」开始，比从零生成更容易控制效果。</p>`,
    categoryId: catWriting,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    title: "图像生成工坊",
    slug: "ai-image-studio",
    summary:
      "为电商与品牌团队打造的 AI 出图工具，商品图、场景图、海报素材一次生成，无需专业设计基础。",
    body: `<h2>不用等设计排期，当天就能出图</h2>
<p>电商上新、活动预热、社媒配图——这些图片需求往往急、量大、预算有限。图像生成工坊让运营同学自己就能出可用的图，把设计资源留给真正需要创意的工作。</p>

<h2>核心能力</h2>
<ul>
<li><strong>商品场景图</strong>：上传白底商品图，自动生成客厅、办公室、户外等使用场景</li>
<li><strong>海报模板</strong>：内置 200+ 中文排版模板，替换文案即可使用</li>
<li><strong>批量出图</strong>：一次生成 20 张不同风格的图，挑选后精修</li>
<li><strong>尺寸自适应</strong>：同一张图自动适配公众号首图、朋友圈方图、电商主图</li>
</ul>

<h2>效果说明</h2>
<p>生成图可直接用于社媒与详情页。若用于印刷物料，建议导出高清版本并请设计师做最后校对。系统会保留每次生成的记录，方便回溯与复用。</p>

<h2>常见问题</h2>
<ul>
<li><strong>生成的图能商用吗？</strong> 可以。平台授予商用许可，但请避免生成与真实品牌标识高度相似的内容。</li>
<li><strong>能保持商品外观一致吗？</strong> 能。上传商品图后，系统会锁定商品主体，只改变背景与光线。</li>
</ul>`,
    categoryId: catImage,
    isFeatured: true,
    sortOrder: 2,
  },
  {
    title: "数据洞察平台",
    slug: "ai-data-insight",
    summary:
      "把 Excel 和业务系统里的数据变成看得懂、用得上的结论，业务人员无需写 SQL 即可获得分析结果。",
    body: `<h2>让不懂技术的人也能看懂数据</h2>
<p>大多数中小企业不缺数据，缺的是「把数据翻译成决策」的能力。数据洞察平台让你用自然语言提问，比如「上个月哪个产品线毛利最高」，系统直接给出图表和结论。</p>

<h2>主要功能</h2>
<ul>
<li><strong>自然语言查询</strong>：用中文提问，自动转成分析结果</li>
<li><strong>自动生成图表</strong>：根据问题类型选择最合适的可视化方式</li>
<li><strong>异常提醒</strong>：销售额突然下跌、库存周转异常时主动通知</li>
<li><strong>周报自动生成</strong>：每周一早上把关键指标整理成一页报告</li>
</ul>

<h2>接入方式</h2>
<p>支持 Excel 上传、数据库直连、以及常见 SaaS 系统（如电商后台、CRM）的授权接入。首次接入通常需要 1-2 个工作日完成数据梳理。</p>

<h2>安全说明</h2>
<p>数据在传输与存储过程中加密，不同部门的账号只能看到自己权限范围内的数据。所有查询操作都有日志可追溯。</p>`,
    categoryId: catData,
    isFeatured: true,
    sortOrder: 3,
  },
];

for (const p of products) {
  ensureContent({
    type: "product",
    title: p.title,
    slug: p.slug,
    summary: p.summary,
    body: p.body,
    categoryId: p.categoryId,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
  });
}

// —— 文章 ——
const articles = [
  {
    title: "示例科技 完成产品线升级，三款核心工具全面开放",
    slug: "product-line-upgrade",
    summary:
      "经过半年的打磨，智能写作、图像生成、数据洞察三条产品线完成整合，面向中小企业全面开放使用。",
    body: `<p>今天，我们正式宣布示例科技 三条产品线完成整合升级，面向所有中小企业开放使用。</p>

<h2>这次升级改了什么</h2>
<p>过去半年，我们把原本分散的三款工具整合到同一个账号体系下。现在你只需要注册一次，就能同时使用写作、出图和数据分析能力，不用在多个平台之间来回切换。</p>

<ul>
<li><strong>统一账号</strong>：一个账号，三个工具，共享用量额度</li>
<li><strong>统一素材库</strong>：写作用的图片、生成的图、上传的商品图，全部集中管理</li>
<li><strong>统一计费</strong>：按实际使用量计费，不再需要分别购买</li>
</ul>

<h2>为什么这么做</h2>
<p>在和上百家中小企业沟通后，我们发现一个共同问题：团队不是不需要 AI，而是「工具太多、学不过来」。与其提供十个各自为战的工具，不如提供三个真正能用起来的。</p>

<h2>接下来</h2>
<p>下个季度我们会重点优化团队协作能力，包括内容审批、多人共享素材库、以及与企业微信的打通。如果你有具体需求，欢迎通过官网联系我们。</p>`,
    categoryId: catCompany,
    isFeatured: false,
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    title: "中小企业用 AI，最该先解决的不是「用什么模型」",
    slug: "sme-ai-first-step",
    summary:
      "在服务了几十家中小企业之后，我们发现真正决定成败的往往不是模型选型，而是内容与流程的梳理。",
    body: `<p>每次和客户第一次开会，对方最常问的问题是：「你们用的是哪个模型？比 GPT 强吗？」</p>

<p>这个问题本身没有错，但它通常不是决定项目成败的那一个。</p>

<h2>我们观察到的三种失败模式</h2>
<h3>第一种：工具买了，没人用</h3>
<p>账号开了一堆，三个月后登录记录只剩两个人。原因往往很简单——没有把它嵌进现有流程，员工需要额外打开一个系统，自然就忘了。</p>

<h3>第二种：用起来了，但输出不能用</h3>
<p>生成的文案客户看不懂，生成的图不符合品牌调性。根子在于没有把自己的历史内容喂给系统，AI 不知道「你们公司说话是什么风格」。</p>

<h3>第三种：用了，但没人管</h3>
<p>谁都能发、发什么都不记录。一旦出了问题，找不到责任人也找不到原因。</p>

<h2>所以应该先做什么</h2>
<ol>
<li><strong>先梳理内容资产</strong>：把过去两年真正代表公司的文章、案例、产品说明整理出来，这是喂养 AI 的原料</li>
<li><strong>再定义流程</strong>：谁写、谁审、谁发、出问题找谁，这些先想清楚，工具才有地方插进去</li>
<li><strong>最后才是选工具</strong>：此时你已经知道自己需要什么，选型反而简单</li>
</ol>

<h2>一句话总结</h2>
<p>AI 不解决「不知道自己想要什么」的问题。想清楚要什么，工具才有效。</p>`,
    categoryId: catIndustry,
    isFeatured: false,
    publishedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    title: "如何用 AI 把一篇技术文档改写成客户能看懂的内容",
    slug: "rewrite-tech-doc",
    summary:
      "技术团队写的东西客户看不懂，是很常见的浪费。这篇文章给出一套可复用的改写方法。",
    body: `<p>技术文档写得好，不等于客户看得懂。这两件事需要不同的能力，而 AI 恰好擅长后一件。</p>

<h2>第一步：找出客户真正关心的那三件事</h2>
<p>技术文档关心「怎么实现」，客户关心「这对我有什么用」。改写前先问自己：客户读完最想知道什么？通常答案是：能省多少钱、能省多少时间、会不会出问题。</p>

<h2>第二步：把术语翻译成场景</h2>
<table>
<thead><tr><th>原文</th><th>改写后</th></tr></thead>
<tbody>
<tr><td>支持高并发请求处理</td><td>促销活动当天几万人同时访问也不会卡</td></tr>
<tr><td>采用分布式架构</td><td>一台机器出问题，服务照样能用</td></tr>
<tr><td>数据加密存储</td><td>就算硬盘被拿走，里面的数据也读不出来</td></tr>
</tbody>
</table>

<h2>第三步：让 AI 按你的风格重写</h2>
<p>把上面两步的结果，连同三篇你们公司过往写得好的文章一起交给 AI，要求它「用这些文章的语气重写」。这一步的关键是给样例，而不是给形容词。</p>

<h2>第四步：人工校对，重点看两处</h2>
<ul>
<li><strong>有没有过度承诺</strong>：AI 容易把「通常可以」写成「一定能」</li>
<li><strong>数字是否准确</strong>：所有具体数字都要回到原始资料核对</li>
</ul>

<p>这套方法我们内部用了半年，一篇 3000 字的技术文档通常能在 40 分钟内改写成客户版本。</p>`,
    categoryId: catIndustry,
    isFeatured: false,
    publishedAt: new Date(Date.now() - 16 * 86400000).toISOString(),
  },
];

for (const a of articles) {
  ensureContent({
    type: "article",
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    body: a.body,
    categoryId: a.categoryId,
    isFeatured: a.isFeatured,
    publishedAt: a.publishedAt,
  });
}

// —— 单页 ——
const pages = [
  {
    title: "关于我们",
    slug: "about",
    summary: "示例科技 是一家专注于为中小企业提供实用 AI 工具的公司。",
    body: `<h2>我们是谁</h2>
<p>示例科技 成立于 2024 年，专注做一件事：让中小企业用得起、也用得好 AI。</p>

<p>我们见过太多「看起来很厉害但用不上」的 AI 产品。它们面向大企业，需要专门的团队来部署和维护，对大多数公司来说遥不可及。我们想做的是另一种东西——开箱即用，不需要技术背景，当天就能开始干活。</p>

<h2>我们在做什么</h2>
<p>目前有三条产品线：智能写作、图像生成、数据洞察。它们解决的都是中小企业最日常、最重复、最耗人的工作。</p>

<h2>我们的原则</h2>
<ul>
<li><strong>不做花架子</strong>：功能不以「炫」为标准，以「今天就能用上」为标准</li>
<li><strong>数据是你的</strong>：你的内容只用来服务你自己，不用于训练通用模型</li>
<li><strong>价格透明</strong>：按实际用量计费，没有隐藏条款</li>
<li><strong>出问题有人管</strong>：每个客户都有对接人，不是提交工单等三天</li>
</ul>

<h2>联系我们</h2>
<p>如果你正在考虑让团队用上 AI，欢迎和我们聊聊。我们会先了解你的实际情况，再判断是否真的适合——如果不适合，我们会直说。</p>`,
  },
  {
    title: "联系我们",
    slug: "contact",
    summary: "产品咨询、方案定制、合作洽谈，欢迎联系我们。",
    body: `<p>无论是产品咨询、方案定制还是合作意向，我们都乐意与你聊聊。填写右侧表单，我们会在一个工作日内回复。</p>

<h2>适合联系我们的情况</h2>
<ul>
<li>想了解某款产品是否适合自己的业务</li>
<li>需要针对团队情况做定制方案</li>
<li>已经在用，但遇到问题需要支持</li>
<li>希望成为合作伙伴或渠道商</li>
</ul>

<h2>回复时效</h2>
<p>工作时间内通常 2 小时内回复，非工作时间次日回复。如果情况紧急，建议直接拨打页面上的电话。</p>`,
  },
  {
    title: "服务条款",
    slug: "terms",
    summary: "使用示例科技 服务前，请阅读以下条款。",
    body: `<h2>一、服务内容</h2>
<p>示例科技 向注册用户提供智能写作、图像生成、数据洞察等在线服务。具体功能以产品页面说明为准。</p>

<h2>二、账号与安全</h2>
<p>用户应妥善保管账号与密码。因用户自身原因导致账号泄露所产生的损失，由用户自行承担。</p>

<h2>三、内容与知识产权</h2>
<p>用户上传的内容归用户所有。用户通过本服务生成的内容，平台授予用户商业使用权，但用户应确保不侵犯第三方权益。</p>

<h2>四、使用限制</h2>
<p>用户不得利用本服务生成违法、侵权、虚假或误导性内容。平台有权对违规内容进行处理，并保留终止服务的权利。</p>

<h2>五、数据与隐私</h2>
<p>平台不会将用户上传的内容用于训练通用模型。详细说明见《隐私政策》。</p>

<h2>六、条款变更</h2>
<p>平台可能根据业务需要调整本条款，调整后会在网站公示。继续使用即视为接受变更后的条款。</p>`,
  },
];

for (const p of pages) {
  ensureContent({
    type: "page",
    title: p.title,
    slug: p.slug,
    summary: p.summary,
    body: p.body,
    categoryId: null,
  });
}

console.log(`  ✓ 内容就绪：3 个产品 / 3 篇文章 / 3 个单页`);

// ─────────────────────────────────────────────
// 4. 示例留言
// ─────────────────────────────────────────────
const msgCount = (db.prepare("SELECT COUNT(*) AS n FROM messages").get() as any).n;
if (msgCount === 0) {
  db.prepare(
    "INSERT INTO messages (name, contact, content, source_url, ip_hash, is_read, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(
    "王先生",
    "138****0000",
    "你好，我们是做家居电商的，想了解一下图像生成工坊能不能批量生成商品场景图，大概怎么收费？",
    "/contact",
    "seed",
    0,
    new Date(Date.now() - 3600000).toISOString()
  );
  console.log("  ✓ 示例留言 1 条");
}

// ─────────────────────────────────────────────
// 5. 复制 logo 到 public
// ─────────────────────────────────────────────
const srcLogo = path.join(process.cwd(), "assets", "brand", "logo.png");
const dstDir = path.join(process.cwd(), "public", "brand");
const dstLogo = path.join(dstDir, "logo.png");
if (fs.existsSync(srcLogo)) {
  fs.mkdirSync(dstDir, { recursive: true });
  if (!fs.existsSync(dstLogo)) {
    fs.copyFileSync(srcLogo, dstLogo);
    console.log("  ✓ logo 已复制到 public/brand/");
  }
}

console.log("\n✅ 种子数据完成");
console.log("   管理员：admin / admin12345");
console.log("   编辑：  editor / editor12345");
console.log("   ⚠️  首次登录后请立即修改密码\n");
