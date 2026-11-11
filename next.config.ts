import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 图片由本机 sharp 处理并输出 WebP，不需要 Next 的图片优化服务
  images: { unoptimized: true },
  // 服务端使用的原生/内置模块不参与打包
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // 上传大图时放宽请求体限制（20MB）
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
