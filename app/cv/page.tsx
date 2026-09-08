import type { Metadata } from "next";
import CvContent from "./CvContent";

// Private, unlisted CV page. Explicitly excluded from indexing, the sitemap,
// site navigation and robots crawling (see app/robots.ts).
export const metadata: Metadata = {
  title: "CV — Marek Klenotič",
  description: "Private curriculum vitae of Marek Klenotič.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: undefined },
};

export default function CvPage() {
  return <CvContent />;
}
