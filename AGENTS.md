<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mixpanel analytics

- **Platform:** Next.js App Router (web)
- **SDK:** `mixpanel-browser` (client-side)
- **Tracking method:** Direct SDK alongside Google Tag Manager / GA4
- **Token:** `NEXT_PUBLIC_MIXPANEL_TOKEN` (falls back to project token in `lib/mixpanel.ts`)
- **Init:** `lib/mixpanel.ts` via `components/analytics/MixpanelProvider.tsx` in `app/layout.tsx`
- **Identity:** Anonymous only — no login/signup; do not call `identify()` or `reset()`

### Events

| Event | Trigger | Properties |
| --- | --- | --- |
| `page_viewed` | Route change (all pages) | `page`, `path`, `search`, `url` |
| `page_engagement_completed` | Leave page, tab hide, or route change | `path`, `duration_seconds`, `max_scroll_depth_percent` |
| `scroll_depth_reached` | Scroll milestones on non-blog pages (25/50/75/90/100%) | `path`, `depth_percent` |
| `section_viewed` | Homepage section enters viewport (35% visible) | `section`, `path` |
| `blog_post_scroll_depth` | Scroll milestones on `/blog/[slug]` | `path`, `depth_percent`, `slug`, `title`, `category` |
| `blog_post_engagement_completed` | Leave blog post page | `path`, `duration_seconds`, `max_scroll_depth_percent`, `slug`, `title`, `category` |
| `blog_post_clicked` | Blog list item click | `slug`, `title`, `category`, `source` |
| `contact_email_copied` | Footer “get in touch” click | `email` |
| `experience_logo_clicked` | Experience logo outbound link | `company`, `href` |

### Engagement tracking

- Scroll depth and duration: `hooks/usePageEngagement.ts` via `MixpanelPageEngagement`
- Homepage sections: `hooks/useSectionViews.ts` tracks `projects`, `blog`, `services`, `experiences`, `reviews`, `contact-footer`
- Blog post metadata: `BlogPostAnalytics` on `/blog/[slug]` pages sets context in `lib/mixpanel-page-meta.ts`

### Adding new events

Use `trackEvent(name, properties)` from `@/lib/mixpanel`. Use `snake_case` event names and property keys. Call from client components only.

