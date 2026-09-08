"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/mixpanel";
import HobbiesTicker from "./HobbiesTicker";

const CONTACT_HREF = "mailto:klenoticmarek@mklenotic.com";
const CV_PDF_HREF = "/about/cv-klenoticmarek/Marek-Klenotic-CV.pdf";

type CtaVariant = "primary" | "outline";

const HERO_CTAS: {
  label: string;
  href: string;
  variant: CtaVariant;
  download?: boolean;
  external?: boolean;
  icon?: "download" | "external";
}[] = [
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

function CompanyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("cv_bio_company_clicked", { href })}
      className="font-medium text-white underline decoration-white/50 underline-offset-4 transition-colors hover:text-white hover:decoration-[#FF8008]"
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

function CtaButton({
  label,
  href,
  variant,
  download,
  external,
  icon,
}: (typeof HERO_CTAS)[number]) {
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
      <a {...anchorProps} className="group relative inline-flex font-mono">
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
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 font-mono text-sm text-white/70 backdrop-blur-sm transition-colors duration-200 hover:border-white/40 hover:text-white"
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
      <div className="space-y-4 text-base leading-relaxed text-white/65 md:text-lg">
        {visibleParagraphs.map((paragraph) => (
          <p key={paragraph.id}>{paragraph.body}</p>
        ))}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="mt-5 inline-flex items-center gap-1.5 font-mono text-sm font-medium text-white underline decoration-[#FF8008]/50 underline-offset-4 transition-colors hover:text-[#FF8008] hover:decoration-[#FF8008]"
      >
        <span>{expanded ? "Read less" : "Read more"}</span>
        <ToggleChevron expanded={expanded} />
      </button>
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
    <section id={id} className="mx-4 md:mx-auto md:max-w-[1080px]">
      <div className="relative overflow-hidden rounded-4xl border border-blue-900/40 bg-black/20 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/10 to-transparent"
        />
        <div className="relative grid gap-6 px-6 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-10 md:px-10 md:py-14">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-white/40 uppercase">
              {kicker}
            </p>
            <h2 className="mt-2 font-mono text-lg text-white md:text-xl">
              {title}
            </h2>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function CvContent() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05030f] font-mono text-white">
      {/* Brand glow — brings the homepage blue → deep-navy gradient to the page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 75% at 50% -10%, rgba(0,130,255,0.22) 0%, transparent 55%), linear-gradient(to bottom, #0a0724 0%, #05030f 55%, #04020a 100%)",
        }}
      />

      {/* Minimal header — no marketing nav (page is unlisted / noindex). */}
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <span className="text-xs tracking-[0.18em] text-white/60 uppercase">
          Marek Klenotič
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs text-white/45 transition-colors hover:text-white"
          >
            mklenotic.com
          </Link>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
            CV
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1080px] px-6 pt-8 pb-6 md:pt-14">
        <h1 className="max-w-3xl text-3xl leading-tight font-medium tracking-tight break-words md:text-5xl">
          <span className="text-white/40">Hi! I&apos;m </span>
          <span className="text-white">Marek Klenotič</span>
        </h1>

        <HeroBio />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {HERO_CTAS.map((cta) => (
            <CtaButton key={cta.label} {...cta} />
          ))}
        </div>

        <div className="relative mt-14 overflow-hidden rounded-4xl border border-blue-900/40 bg-black/40 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl md:max-w-[720px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/10 to-transparent"
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
      </section>

      <div className="space-y-4 pt-6 pb-4">
        {/* Experience */}
        <Section kicker="Who Gave Me a Chance" title="Experience">
          <ul className="space-y-4">
            {EXPERIENCE.map((item) => (
              <li
                key={`${item.company}-${item.year}`}
                className="text-base text-white/80 md:text-lg"
              >
                <span className="font-medium text-white">{item.company}</span>
                <span className="text-white/40">
                  {" "}
                  / {item.role} / {item.year}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Quote */}
        <section className="mx-auto max-w-[1080px] px-6 py-12 md:py-16">
          <blockquote className="mx-auto max-w-3xl text-center text-2xl leading-snug font-light text-white/80 italic md:text-4xl">
            &ldquo;I am a responsible, creative, and organized team player who
            emphasizes common sense and freedom.&rdquo;
          </blockquote>
        </section>

        {/* Education */}
        <Section kicker="Who Taught Me What I Know" title="Education">
          <ul className="space-y-5">
            {EDUCATION.map((item) => (
              <li key={item.title} className="text-base text-white/80 md:text-lg">
                <span className="text-white/40">{item.years}</span> /{" "}
                <span className="font-medium text-white">{item.title}</span> /{" "}
                <span className="text-white/55">{item.place}</span>
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
                <span className="mr-1 w-full text-xs font-medium tracking-wide text-white/35 uppercase md:w-32 md:shrink-0">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-sm text-white/75"
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
          <ul className="space-y-4">
            {SIDEQUESTS.map((item) => (
              <li
                key={`${item.role}-${item.years}`}
                className="text-base text-white/80 md:text-lg"
              >
                <span className="font-medium text-white">{item.role}</span>
                {item.detail ? (
                  <span className="text-white/55"> / {item.detail}</span>
                ) : null}
                <span className="text-white/40"> / {item.years}</span>
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
                className="font-medium text-white underline decoration-white/50 underline-offset-4 transition-colors hover:decoration-[#FF8008]"
              >
                @ZasUtopilDamu
              </a>{" "}
              — always chasing that next Brilliant Move.
            </p>
            <HobbiesTicker />
          </div>
        </Section>
      </div>

      {/* Footer */}
      <footer className="px-6 py-24 text-center">
        <p className="mx-auto max-w-xl text-2xl font-light text-white/55 italic md:text-3xl">
          Past is the history, the next is a mystery.
        </p>
      </footer>
    </main>
  );
}
