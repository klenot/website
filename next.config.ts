import type { NextConfig } from "next";
import { buildRedirects } from "@/lib/redirects";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "*.notion.so" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return buildRedirects();
  },
  async rewrites() {
    return [
      { source: "/index.html.md", destination: "/md" },
      { source: "/for-machines.md", destination: "/md/for-machines" },
      { source: "/blog.md", destination: "/md/blog" },
      { source: "/blog/:slug.md", destination: "/md/blog/:slug" },
    ];
  },
  async headers() {
    return [
      {
        source: "/blog/preview/:slug*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/about/cv-klenoticmarek",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/about/cv-klenoticmarek/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
