/**
 * 301 redirects for the Framer → Next.js migration.
 *
 * How to maintain:
 * 1. Add an entry when an old URL should land somewhere specific.
 * 2. Removed blog posts → `/blog` (keeps link equity on the blog index).
 * 3. Posts kept with the same slug need no entry — they resolve directly.
 * 4. After deploy, verify with: curl -I https://www.mklenotic.com/old-path
 *
 * Source: Framer sitemap at https://www.mklenotic.com/sitemap.xml (Jul 2026)
 */

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent?: boolean;
  note?: string;
};

/** Old Framer blog slugs that are NOT on the new site. */
const removedFramerBlogSlugs = [
  "productivity-framework-that-wont-make-your-eyes-roll",
  "create-custom-automated-report-with-minimal-resources",
  "understand-vector-databases-in-5-minutes",
  "understanding-ai-communication-protocols",
  "value-vs-target-goals-in-personal-management",
  "true-secret-to-google-tag-manager",
  "how-to-measure-the-performance-of-new-channels",
  "framer-mailerlite-integration-you-were-waiting-for",
  "understand-strategy-tactics-operations-and-evaluations-in-5-minutes",
  "marketing-that-goes-beyond-the-expected",
] as const;

const removedBlogRedirects: LegacyRedirect[] = removedFramerBlogSlugs.map(
  (slug) => ({
    source: `/blog/${slug}`,
    destination: "/blog",
    permanent: true,
    note: `Framer post removed — no Notion equivalent`,
  }),
);

export const legacyRedirects: LegacyRedirect[] = [
  // Framer-only pages
  {
    source: "/404",
    destination: "/",
    permanent: true,
    note: "Framer 404 page",
  },

  // Guessable /cv should not reveal the private CV. Shared links to
  // /about/cv-klenoticmarek still resolve directly.
  {
    source: "/cv",
    destination: "/",
    permanent: true,
    note: "Guessable CV path — send to homepage",
  },

  ...removedBlogRedirects,

  /**
   * Add explicit slug migrations here when a post was renamed in Notion.
   * Example:
   * { source: "/blog/old-slug", destination: "/blog/new-slug", permanent: true },
   */
];
