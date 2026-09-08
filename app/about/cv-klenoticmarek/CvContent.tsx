"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/mixpanel";
import HobbiesTicker from "./HobbiesTicker";

const CONTACT_HREF = "mailto:klenoticmarek@mklenotic.com";
const CV_PDF_HREF = "/about/cv-klenoticmarek/Marek-Klenotic-CV.pdf";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type Cta = {
  label: string;
  href: string;
  download?: boolean;
  external?: boolean;
  icon?: "download" | "external";
};

const HERO_CTAS: Cta[] = [
  {
    label: "Download CV",
    href: CV_PDF_HREF,
    download: true,
    icon: "download",
  },
  { label: "Contact me", href: CONTACT_HREF },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/klenoticmarek",
    external: true,
    icon: "external",
  },
  {
    label: "Product Lasso",
    href: "https://productlasso.com",
    external: true,
    icon: "external",
  },
];

const EXPERIENCE: { company: string; role: string; year: string }[] = [
  { company: "Bandits (Lasso)", role: "COO", year: "2025" },
  { company: "Wonder Makers, s.r.o.", role: "Head of Marketing", year: "2024" },
  {
    company: "Easy Software (Easy Project / Easy Redmine)",
    role: "MarTech Specialist & Project manager",
    year: "2022",
  },
  { company: "Targito.com", role: "Marketing manager", year: "2022" },
  { company: "In creative, s.r.o.", role: "Project manager", year: "2021" },
  { company: "Pria System, s.r.o.", role: "Account manager", year: "2017" },
];

const EDUCATION: { years: string; title: string; place: string }[] = [
  {
    years: "2017 – 2019",
    title: "Master's degree — Entrepreneurship and Business Administration",
    place: "Thomas Bata University in Zlín",
  },
  {
    years: "2014 – 2017",
    title: "Bachelor's degree — Business Economics and Company Management",
    place: "Thomas Bata University in Zlín",
  },
  {
    years: "2006 – 2014",
    title: "General secondary education",
    place: "Gymnázium Šumperk",
  },
];

const SKILL_GROUPS: { label: string; items: string[] }[] = [
  { label: "Certification", items: ["PMI CAPM"] },
  {
    label: "AI & agents",
    items: ["Cursor", "Grok Bot", "multi-agent orchestration"],
  },
  { label: "Analytics", items: ["GA4", "GTM"] },
  { label: "Web", items: ["HTML", "CSS", "React"] },
  {
    label: "Code",
    items: [
      "JavaScript",
      "React Native",
      "Python",
      "Postgres",
      "Expo",
      "Supabase",
    ],
  },
  { label: "Email & CRM", items: ["MailerLite", "Targito"] },
  { label: "Languages", items: ["Czech (native)", "English (C1)"] },
];

const SHIP_GROUPS: {
  label: string;
  items: { title: string; detail?: string }[];
}[] = [
  {
    label: "Technical / builder",
    items: [
      {
        title: "Reverse engineering",
        detail: "VBA→JS logic for Planeo/FAST product formulas",
      },
      {
        title: "Data pipeline architecture",
        detail: "price-parity monitoring: Python, Postgres, Cloudflare",
      },
      {
        title: "Full-stack",
        detail: "Dattoo: React Native/Expo, Supabase",
      },
      { title: "Web scraping / data extraction" },
    ],
  },
  {
    label: "Marketing / GTM",
    items: [
      {
        title: "Competitive positioning",
        detail: "comparison pages vs Akeneo, Salsify, etc.",
      },
      { title: "Analytics implementation", detail: "GA4/GTM" },
      {
        title: "Outbound / sales copy",
        detail: "Apollo sequences, ICP work for DACH/Nordic",
      },
      {
        title: "Event / conference marketing",
        detail: "Reshoper booth, UTM strategy",
      },
    ],
  },
  {
    label: "Management / ops",
    items: [
      {
        title: "Proposal writing & scoping",
        detail: "drum e-commerce, floor-plan app, onboarding system",
      },
      { title: "Client discovery synthesis", detail: "OKIN → action items" },
      { title: "Solo product ownership", detail: "Dattoo end to end" },
    ],
  },
];

const SIDEQUESTS: { role: string; detail?: string; years: string }[] = [
  { role: "Band Manager", detail: "Barbora Poláková", years: "2022" },
  { role: "Production", detail: "majáles Zlín festival", years: "2018" },
  { role: "Photography", years: "2018 – 2019" },
  { role: "Music manager", detail: "Trocha Klidu", years: "2017 – 2021" },
  {
    role: "Music video production",
    detail: "Trocha Klidu – Šoumou, Aiko – Apology, a.o.",
    years: "2017 – 2020",
  },
  { role: "Co-founder", detail: "Šumperský majáles", years: "2017 – 2019" },
  { role: "Student Union UTB", years: "2015 – 2019" },
];

function CompanyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("cv_bio_company_clicked", { href })}
      className={`rounded-sm font-medium text-black underline decoration-black/30 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-500 ${FOCUS_RING}`}
    >
      {children}
    </a>
  );
}

// Full "journey" bio. Company names link out to the authoritative destinations
// for this site. Kept as an ordered list of paragraphs so the Read more toggle
// can reveal them progressively.
const BIO_PARAGRAPHS: { id: string; body: ReactNode }[] = [
  {
    id: "pria-system",
    body: (
      <>
        I started my journey in 2017 by applying for a job at a Czech digital
        marketing agency,{" "}
        <CompanyLink href="https://pria.cz/">Pria System</CompanyLink>. Thanks to
        this opportunity, I was able to work side by side with top digital
        marketing professionals and gain a solid foundation for the future.
      </>
    ),
  },
  {
    id: "graduation",
    body: (
      <>
        Meanwhile, I finished my studies and graduated from Thomas Bata
        University with a master&rsquo;s degree from the Faculty of Management
        and Economics in Business Administration.
      </>
    ),
  },
  {
    id: "in-creative",
    body: (
      <>
        I then continued my journey to the opposite side of the Czech Republic,
        to Brno. There, I joined the team at{" "}
        <CompanyLink href="https://www.increative.cz/">In creative</CompanyLink>,
        a small but well-established digital agency that really helped me
        strengthen my project management skills and critical thinking, as well as
        apply my knowledge of business processes in a growing company
        environment.
      </>
    ),
  },
  {
    id: "targito",
    body: (
      <>
        The next stop on my journey led me to{" "}
        <CompanyLink href="https://www.targito.com/">Targito</CompanyLink>, a
        small but dynamic SaaS company specializing in email marketing
        automation. This experience gave me a more holistic approach to digital
        marketing, and here I also fully opened the doors to technology in
        digital marketing. I started to think in scale.
      </>
    ),
  },
  {
    id: "easy-software",
    body: (
      <>
        After returning to Prague once more, my journey continued at a mid-size
        company,{" "}
        <CompanyLink href="https://www.easy8.com/">Easy Software</CompanyLink>{" "}
        (Easy Project / Easy Redmine; now Easy8), which offers an open-source
        solution for project management and business processes to the whole
        world. Thanks to this opportunity, I was able to focus entirely on
        digital technologies and began experimenting with coding.
      </>
    ),
  },
  {
    id: "wonder-makers",
    body: (
      <>
        My last stop led me to a digital product studio,{" "}
        <CompanyLink href="https://www.wondermakers.digital/">
          Wonder Makers
        </CompanyLink>
        . A small web development company with big US names on its client list,
        which truly tested all my previous skills to the limit and introduced me
        to new ones such as strategic thinking, leadership, and hiring.
      </>
    ),
  },
];

// Paragraphs kept visible while collapsed. The rest are revealed via Read more.
const BIO_COLLAPSED_COUNT = 2;

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function ToggleChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`size-4 transition-transform duration-200 ${
        expanded ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Unified CTA group. Every action shares the same understated blog link
// treatment (mono, underlined, blue on hover) so the buttons read as one set
// instead of scattered, mismatched pills.
function CtaLink({ label, href, download, external, icon }: Cta) {
  const onClick = () => trackEvent("cv_cta_clicked", { cta: label, href });

  return (
    <a
      href={href}
      onClick={onClick}
      {...(download ? { download: "" } : {})}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center gap-1.5 rounded-sm font-mono text-sm font-medium text-black underline decoration-black/30 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-500 ${FOCUS_RING}`}
    >
      <span>{label}</span>
      {icon === "download" ? <DownloadIcon /> : null}
      {icon === "external" ? <ExternalIcon /> : null}
    </a>
  );
}

// Copies the current page URL to the clipboard with brief "Copied" feedback.
// Matches the CtaLink treatment so it reads as part of the same set.
function ShareCta() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (url: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const onClick = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await copyToClipboard(url);
      trackEvent("cv_cta_clicked", { cta: "Share", href: url });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions / insecure context); leave label unchanged.
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-sm font-mono text-sm font-medium text-black underline decoration-black/30 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-500 ${FOCUS_RING}`}
    >
      <span aria-live="polite">{copied ? "Copied" : "Share"}</span>
      <ShareIcon />
    </button>
  );
}

function CtaGroup({ withShare = false }: { withShare?: boolean }) {
  // One wrapping cluster with even gaps. The mobile max-width forces a balanced
  // 2 + 2 wrap (no lone orphan on ~390) and lifts on sm+ to a single row.
  return (
    <div className="mx-auto flex max-w-[320px] flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:max-w-none">
      {HERO_CTAS.map((cta) => (
        <CtaLink key={cta.label} {...cta} />
      ))}
      {withShare ? <ShareCta /> : null}
    </div>
  );
}

function HeroBio() {
  const [expanded, setExpanded] = useState(false);
  const visibleParagraphs = expanded
    ? BIO_PARAGRAPHS
    : BIO_PARAGRAPHS.slice(0, BIO_COLLAPSED_COUNT);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      trackEvent("cv_bio_toggled", { expanded: next });
      return next;
    });
  };

  return (
    <div className="w-full text-left">
      <div className="space-y-6 font-mono text-base font-light leading-relaxed text-black/70">
        {visibleParagraphs.map((paragraph) => (
          <p key={paragraph.id}>{paragraph.body}</p>
        ))}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={`mt-5 inline-flex items-center gap-1.5 rounded-sm font-mono text-sm font-medium text-black transition-colors hover:text-blue-600 ${FOCUS_RING}`}
      >
        <span>{expanded ? "Read less" : "Read more"}</span>
        <ToggleChevron expanded={expanded} />
      </button>
    </div>
  );
}

// Certificates & Skills. The lead line and compact skill table are always
// visible; the deeper "What I ship" breakdown sits behind a Read more toggle
// that mirrors the bio interaction so the section stays quiet on first paint.
function CertificatesSkills() {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      trackEvent("cv_skills_read_more", { expanded: next });
      return next;
    });
  };

  return (
    <div>
      <p className="mb-8 font-mono text-base font-light leading-relaxed text-black/70">
        Today, we don&rsquo;t ship alone. We ship 10× using AI agents. I&rsquo;m
        focusing on that.
      </p>

      <ul className="flex flex-col">
        {SKILL_GROUPS.map((group) => (
          <li
            key={group.label}
            className="grid gap-x-4 border-t border-black/10 py-3 first:border-t-0 first:pt-0 md:grid-cols-[8rem_minmax(0,1fr)]"
          >
            <span className="font-mono text-[0.6875rem] font-medium tracking-wide text-black/40 uppercase">
              {group.label}
            </span>
            <span className="mt-1 font-mono text-base text-black md:mt-0">
              {group.items.join(", ")}
            </span>
          </li>
        ))}
      </ul>

      {expanded ? (
        <div className="mt-10 flex flex-col gap-8">
          {SHIP_GROUPS.map((group) => (
            <div key={group.label}>
              <span className="mb-3 block font-mono text-[0.75rem] font-semibold tracking-wide text-black/60 uppercase">
                {group.label}
              </span>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li
                    key={item.title}
                    className="font-mono text-base leading-relaxed"
                  >
                    <span className="font-medium text-black">{item.title}</span>
                    {item.detail ? (
                      <span className="font-light text-black/55">
                        {" "}
                        — {item.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={`mt-8 inline-flex items-center gap-1.5 rounded-sm font-mono text-sm font-medium text-black transition-colors hover:text-blue-600 ${FOCUS_RING}`}
      >
        <span>{expanded ? "Read less" : "Read more"}</span>
        <ToggleChevron expanded={expanded} />
      </button>
    </div>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="mb-2 block font-mono text-[0.6875rem] tracking-wider text-black/50 uppercase">
        {kicker}
      </span>
      <h2 className="font-mono text-[1.424rem] font-bold leading-[1.35] tracking-[-0.015em] text-black">
        {title}
      </h2>
    </div>
  );
}

function Section({
  kicker,
  title,
  children,
  id,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="w-full border-t border-black/10 pt-16">
      <SectionHeading kicker={kicker} title={title} />
      {children}
    </section>
  );
}

export default function CvContent() {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-white px-4 pt-16 pb-24">
      <div className="flex w-full max-w-[640px] flex-col">
        {/* Top nav — mirrors the blog post breadcrumb. Page is unlisted /
            noindex, so no marketing chrome. */}
        <nav
          aria-label="CV navigation"
          className="mb-16 self-start font-mono text-[0.8125rem] text-black"
        >
          <Link href="/" className="transition-colors hover:text-blue-600">
            ← home
          </Link>
          <span className="text-black/40"> / </span>
          <span className="text-black/40">cv</span>
        </nav>

        {/* Hero — centered editorial header. */}
        <header className="flex flex-col items-center text-center">
          <span className="mb-6 block font-mono text-[0.6875rem] tracking-wider text-black/50 uppercase">
            Curriculum Vitae
          </span>

          <div className="mb-8 w-full max-w-[280px] overflow-hidden rounded-md border border-black/10">
            <Image
              src="/about/cv-klenoticmarek/portrait.jpg"
              alt="Portrait of Marek Klenotič wearing a white TALENT INSIDE t-shirt"
              width={910}
              height={946}
              priority
              className="h-auto w-full object-cover"
              sizes="280px"
            />
          </div>

          <h1 className="font-mono text-[1.802rem] font-bold leading-[1.3] tracking-[-0.02em] text-black md:text-[2.25rem]">
            Hi! I&apos;m Marek Klenotič
          </h1>

          <div className="mt-8">
            <CtaGroup />
          </div>
        </header>

        {/* Bio journey — left-aligned prose in the centered column. */}
        <div className="mt-16">
          <HeroBio />
        </div>

        <div className="mt-16 flex flex-col gap-16">
          {/* Experience */}
          <Section kicker="Who Gave Me a Chance" title="Experience">
            <ul className="flex flex-col">
              {EXPERIENCE.map((item) => (
                <li
                  key={`${item.company}-${item.year}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-black/10 py-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-mono text-base text-black">
                    <span className="font-medium">{item.company}</span>
                    <span className="text-black/50"> / {item.role}</span>
                  </span>
                  <span className="text-right font-mono text-sm text-black/45 tabular-nums">
                    {item.year}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Education */}
          <Section kicker="Who Taught Me What I Know" title="Education">
            <ul className="flex flex-col">
              {EDUCATION.map((item) => (
                <li
                  key={item.title}
                  className="border-t border-black/10 py-4 font-mono text-base first:border-t-0 first:pt-0"
                >
                  <span className="block text-sm text-black/45">
                    {item.years}
                  </span>
                  <span className="mt-1 block font-medium text-black">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-black/55">
                    {item.place}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Certificates / Skills — kept blog-plain: a quiet mono list rather
              than a pill component kit. Deep "What I ship" list sits behind a
              Read more toggle mirroring the bio. */}
          <Section kicker="Add-ons and Level-ups" title="Certificates & Skills">
            <CertificatesSkills />
          </Section>

          {/* Sidequesting */}
          <Section kicker="Sidequesting" title="Other experience">
            <ul className="flex flex-col">
              {SIDEQUESTS.map((item) => (
                <li
                  key={`${item.role}-${item.years}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-black/10 py-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-mono text-base text-black">
                    <span className="font-medium">{item.role}</span>
                    {item.detail ? (
                      <span className="text-black/50"> / {item.detail}</span>
                    ) : null}
                  </span>
                  <span className="text-right font-mono text-sm text-black/45 tabular-nums">
                    {item.years}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Hobbies */}
          <Section kicker="Having Fun" title="Hobbies">
            <div className="space-y-6">
              <p className="font-mono text-base font-light leading-relaxed text-black/70">
                Chess on Chess.com as{" "}
                <a
                  href="https://www.chess.com/member/ZasUtopilDamu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-sm font-medium text-black underline decoration-black/30 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-500 ${FOCUS_RING}`}
                >
                  @ZasUtopilDamu
                </a>{" "}
                — always chasing that next brilliant move or dumping my queen in
                2s.
              </p>
              <HobbiesTicker />
              <p className="font-mono text-base font-light leading-relaxed text-black/70">
                And I run and bring Kindle almost everywhere.
              </p>
            </div>
          </Section>
        </div>

        {/* Closing — unified CTA row above the exact quote. */}
        <footer className="mt-20 w-full border-t border-black/10 pt-16 text-center">
          <div className="mb-12">
            <CtaGroup withShare />
          </div>
          <p className="mx-auto max-w-[34ch] font-mono text-xl font-light leading-snug text-black/70 italic md:text-2xl">
            The past is history, next is a mystery.
          </p>
        </footer>
      </div>
    </main>
  );
}
