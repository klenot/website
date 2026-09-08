"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { trackEvent } from "@/lib/mixpanel";
import HobbiesTicker from "./HobbiesTicker";

const CONTACT_HREF = "mailto:klenoticmarek@mklenotic.com";
const CV_PDF_HREF = "/about/cv-klenoticmarek/Marek-Klenotic-CV.pdf";

// Tiled fractal-noise grain, layered under the content to give the near-black
// canvas the same textured depth as the homepage hero (which uses image grain).
const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

type CtaVariant = "primary" | "outline";

type Cta = {
  label: string;
  href: string;
  variant: CtaVariant;
  download?: boolean;
  external?: boolean;
  icon?: "download" | "external";
};

const HERO_CTAS: Cta[] = [
  {
    label: "Download cv",
    href: CV_PDF_HREF,
    variant: "primary",
    download: true,
    icon: "download",
  },
  { label: "Contact me", href: CONTACT_HREF, variant: "outline" },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/klenoticmarek",
    variant: "outline",
    external: true,
    icon: "external",
  },
  {
    label: "Product Lasso",
    href: "https://productlasso.com",
    variant: "outline",
    external: true,
    icon: "external",
  },
];

const EXPERIENCE: { company: string; role: string; year: string }[] = [
  { company: "Bandits (Product Lasso)", role: "COO", year: "2025" },
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
  { label: "Analytics", items: ["GA4", "GTM"] },
  { label: "Web", items: ["HTML", "CSS", "React"] },
  { label: "Code", items: ["JavaScript", "React Native (assisted)"] },
  { label: "Email & CRM", items: ["MailerLite", "Targito"] },
  { label: "Languages", items: ["Czech (native)", "English (C1)"] },
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

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030f]";

function CompanyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("cv_bio_company_clicked", { href })}
      className={`rounded-sm font-medium text-white underline decoration-blue-400/50 underline-offset-4 transition-colors hover:text-white hover:decoration-blue-300 ${FOCUS_RING}`}
    >
      {children}
    </a>
  );
}

// Full "journey" bio shown in the hero. Company names link out to the
// authoritative destinations for this site. Kept as an ordered list of
// paragraphs so the Read more toggle can reveal them progressively.
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

function CtaButton({ label, href, variant, download, external, icon }: Cta) {
  const onClick = () => trackEvent("cv_cta_clicked", { cta: label, href });
  const anchorProps = {
    href,
    onClick,
    ...(download ? { download: "" } : {}),
    ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  };

  // Primary — the site's signature black pill with an offset warm-gradient
  // shadow that snaps in on hover (see the homepage footer CTA).
  if (variant === "primary") {
    return (
      <a
        {...anchorProps}
        className={`group relative inline-flex rounded-full font-mono ${FOCUS_RING}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 translate-x-[2px] translate-y-[5px] rounded-full"
          style={{ background: "linear-gradient(to right, #FF8008, #FFC837)" }}
        />
        <span className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-black px-6 py-3 text-sm text-white transition-transform duration-150 ease-out group-hover:translate-x-[2px] group-hover:translate-y-[5px]">
          <span>{label}</span>
          {icon === "download" ? <DownloadIcon /> : null}
          {icon === "external" ? <ExternalIcon /> : null}
        </span>
      </a>
    );
  }

  return (
    <a
      {...anchorProps}
      className={`inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/[0.10] px-6 py-3 font-mono text-sm text-white/80 backdrop-blur-sm transition-colors duration-200 hover:border-blue-300/60 hover:bg-blue-500/[0.18] hover:text-white ${FOCUS_RING}`}
    >
      <span>{label}</span>
      {icon === "external" ? <ExternalIcon /> : null}
    </a>
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
    <div className="mt-8 max-w-2xl">
      <div className="space-y-4 text-base leading-relaxed text-white/70 md:text-lg">
        {visibleParagraphs.map((paragraph) => (
          <p key={paragraph.id}>{paragraph.body}</p>
        ))}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={`mt-5 inline-flex items-center gap-1.5 rounded-md font-mono text-sm font-medium text-white underline decoration-blue-400/60 underline-offset-4 transition-colors hover:text-blue-200 hover:decoration-blue-300 ${FOCUS_RING}`}
      >
        <span>{expanded ? "Read less" : "Read more"}</span>
        <ToggleChevron expanded={expanded} />
      </button>
    </div>
  );
}

const revealProps = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-4xl border border-blue-800/40 bg-black/20 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-[3px] hover:border-blue-500/50 hover:shadow-[0_44px_100px_-32px_rgba(0,110,255,0.28)] ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/10 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative">{children}</div>
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
    <motion.section
      id={id}
      className="mx-4 md:mx-auto md:max-w-[1080px]"
      {...revealProps}
    >
      <GlassCard>
        <div className="grid gap-5 px-6 py-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] md:gap-8 md:px-10 md:py-14">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-blue-200/50 uppercase">
              {kicker}
            </p>
            <h2 className="mt-2 font-mono text-lg text-white md:text-xl">
              {title}
            </h2>
          </div>
          <div>{children}</div>
        </div>
      </GlassCard>
    </motion.section>
  );
}

export default function CvContent() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05030f] font-mono text-white">
      {/* Brand glow — stronger homepage blue → deep-navy fade. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -8%, rgba(0,130,255,0.5) 0%, rgba(20,4,110,0.24) 32%, transparent 64%), linear-gradient(to bottom, #0b0e40 0%, #080628 24%, #05030f 56%, #04020a 100%)",
        }}
      />
      {/* Fine grain for texture/depth. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_SVG, backgroundSize: "180px 180px" }}
      />

      {/* Minimal header — lowercase mono, matches homepage chrome. Page is
          unlisted / noindex, so no marketing nav. */}
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <span className="font-mono text-sm text-white/80">
          marek klenotič
        </span>
        <div className="flex items-center gap-3 font-mono text-sm">
          <Link
            href="/"
            className={`rounded-sm text-white/50 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            mklenotic.com
          </Link>
          <span aria-hidden className="text-white/25">
            /
          </span>
          <span className="text-white/40">cv</span>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        className="relative isolate mx-auto max-w-[1080px] px-6 pt-8 pb-6 md:pt-14"
        {...revealProps}
      >
        {/* Hero-local electric blue field — pushes the above-the-fold canvas to
            homepage intensity rather than near-black. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-48 -z-10 h-[760px]"
          style={{
            background:
              "radial-gradient(68% 60% at 50% 4%, rgba(0,130,255,0.55) 0%, rgba(44,18,155,0.32) 38%, transparent 72%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-48 -z-10 h-[760px] opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage: GRAIN_SVG,
            backgroundSize: "180px 180px",
          }}
        />

        <h1 className="max-w-3xl font-mono text-3xl leading-tight font-medium break-words md:text-5xl">
          <span className="text-white/40">Hi! I&apos;m </span>
          <span className="text-white">Marek Klenotič</span>
        </h1>

        <HeroBio />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {HERO_CTAS.map((cta) => (
            <CtaButton key={cta.label} {...cta} />
          ))}
        </div>

        <div className="relative mt-14 overflow-hidden rounded-4xl border border-blue-800/40 bg-black/40 shadow-[0_40px_90px_-40px_rgba(0,60,200,0.35)] backdrop-blur-xl md:max-w-[720px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 bg-linear-to-b from-white/10 to-transparent"
          />
          <Image
            src="/about/cv-klenoticmarek/portrait.jpg"
            alt="Portrait of Marek Klenotič wearing a white TALENT INSIDE t-shirt"
            width={910}
            height={946}
            priority
            className="h-auto w-full object-cover"
            sizes="(max-width: 768px) 100vw, 720px"
          />
        </div>
      </motion.section>

      <div className="space-y-4 pt-6 pb-4">
        {/* Experience */}
        <Section kicker="Who Gave Me a Chance" title="Experience">
          <ul className="-mt-1 divide-y divide-white/5">
            {EXPERIENCE.map((item) => (
              <li
                key={`${item.company}-${item.year}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-base text-white/80 md:text-lg">
                  <span className="font-medium text-white">{item.company}</span>
                  <span className="text-white/55"> / {item.role}</span>
                </span>
                <span className="text-right font-mono text-sm text-white/60 tabular-nums md:text-base">
                  {item.year}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Quote */}
        <motion.section
          className="mx-auto max-w-[1080px] px-6 py-12 md:py-16"
          {...revealProps}
        >
          <blockquote className="mx-auto max-w-3xl text-center text-2xl leading-snug font-light text-white/85 italic md:text-4xl">
            &ldquo;I am a responsible, creative, and organized team player who
            emphasizes common sense and freedom.&rdquo;
          </blockquote>
        </motion.section>

        {/* Education */}
        <Section kicker="Who Taught Me What I Know" title="Education">
          <ul className="space-y-5">
            {EDUCATION.map((item) => (
              <li key={item.title} className="text-base text-white/80 md:text-lg">
                <span className="text-white/55">{item.years}</span> /{" "}
                <span className="font-medium text-white">{item.title}</span> /{" "}
                <span className="text-white/65">{item.place}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Certificates / Skills */}
        <Section kicker="Add-ons and Level-ups" title="Certificates & Skills">
          <div className="space-y-4">
            {SKILL_GROUPS.map((group) => (
              <div
                key={group.label}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="mr-1 w-full text-xs font-medium tracking-wide text-blue-200/45 uppercase md:w-32 md:shrink-0">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-blue-400/40 bg-blue-500/[0.10] px-3 py-1 text-sm text-white/85 transition-colors hover:border-blue-300/60 hover:bg-blue-500/[0.18] hover:text-white"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Sidequesting */}
        <Section kicker="Sidequesting" title="Other experience">
          <ul className="-mt-1 divide-y divide-white/5">
            {SIDEQUESTS.map((item) => (
              <li
                key={`${item.role}-${item.years}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-base text-white/80 md:text-lg">
                  <span className="font-medium text-white">{item.role}</span>
                  {item.detail ? (
                    <span className="text-white/55"> / {item.detail}</span>
                  ) : null}
                </span>
                <span className="text-right font-mono text-sm text-white/60 tabular-nums md:text-base">
                  {item.years}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Hobbies */}
        <Section kicker="Having Fun" title="Hobbies">
          <div className="space-y-5">
            <p className="max-w-md text-base text-white/60 md:text-lg">
              Chess on Chess.com as{" "}
              <a
                href="https://www.chess.com/member/ZasUtopilDamu"
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-sm font-medium text-white underline decoration-blue-400/50 underline-offset-4 transition-colors hover:decoration-blue-300 ${FOCUS_RING}`}
              >
                @ZasUtopilDamu
              </a>{" "}
              — always chasing that next Brilliant Move.
            </p>
            <HobbiesTicker />
          </div>
        </Section>

        {/* Closing — pair the quote with a clear action instead of a lone line. */}
        <motion.section
          className="mx-4 pt-2 md:mx-auto md:max-w-[1080px]"
          {...revealProps}
        >
          <GlassCard>
            <div className="flex flex-col items-center gap-6 px-6 py-14 text-center md:py-20">
              <p className="max-w-xl text-2xl leading-snug font-light text-white/80 italic md:text-3xl">
                Past is the history, the next is a mystery.
              </p>
              <p className="max-w-md text-sm text-white/55 md:text-base">
                Open to the next chapter — grab the CV or say hello.
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                <CtaButton {...HERO_CTAS[0]} />
                <CtaButton {...HERO_CTAS[1]} />
              </div>
            </div>
          </GlassCard>
        </motion.section>
      </div>

      {/* Footer bar — lowercase mono, mirrors the homepage footer. */}
      <footer className="mx-auto flex max-w-[1080px] items-center justify-center gap-3 px-6 py-10 font-mono text-xs text-white/35">
        <span>mklenotic.com</span>
        <span aria-hidden>|</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
