"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/mixpanel";
import HobbiesTicker from "./HobbiesTicker";

const CONTACT_HREF = "mailto:klenoticmarek@mklenotic.com";

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
    href: "/cv/Marek-Klenotic-CV.pdf",
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

function CtaButton({
  label,
  href,
  variant,
  download,
  external,
  icon,
}: (typeof HERO_CTAS)[number]) {
  const base =
    "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors duration-200";
  const styles =
    variant === "primary"
      ? "bg-black text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.65)] hover:bg-black/85"
      : "border border-black/15 bg-transparent text-black/70 hover:border-black/40 hover:text-black";

  const onClick = () =>
    trackEvent("cv_cta_clicked", { cta: label, href });

  return (
    <a
      href={href}
      className={`${base} ${styles}`}
      onClick={onClick}
      {...(download ? { download: "" } : {})}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span>{label}</span>
      {icon === "download" ? <DownloadIcon /> : null}
      {icon === "external" ? <ExternalIcon /> : null}
    </a>
  );
}

function ShareIcon() {
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const base =
    "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors duration-200";
  const styles =
    "border border-black/15 bg-transparent text-black/70 hover:border-black/40 hover:text-black";

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
    const url =
      typeof window !== "undefined" ? window.location.href : "";
    try {
      await copyToClipboard(url);
      trackEvent("cv_cta_clicked", { cta: "Share", href: url });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions / insecure context); leave label unchanged.
    }
  };

  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      <span>{copied ? "Copied" : "Share"}</span>
      <ShareIcon />
    </button>
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
    <section
      id={id}
      className="mx-auto grid max-w-[1080px] gap-6 px-6 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-10 md:py-20"
    >
      <div>
        <p className="cv-kicker text-2xl text-black/35 md:text-[1.75rem]">
          {kicker}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-black md:text-xl">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function CvContent() {
  return (
    <main className="min-h-dvh bg-[#d8d8d6] text-[#0f0f0f]">
      {/* Minimal header — no marketing nav (page is unlisted / noindex). */}
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <span className="font-mono text-xs tracking-[0.18em] text-black/60 uppercase">
          Marek Klenotič
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-xs text-black/50 transition-colors hover:text-black"
          >
            mklenotic.com
          </Link>
          <span className="rounded-full border border-black/20 px-3 py-1 font-mono text-xs text-black/70">
            CV
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1080px] px-6 pt-8 pb-6 md:pt-14">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          <span className="text-black/35">Hi! I&apos;m </span>
          <span className="text-black">Marek Klenotič</span>
        </h1>

        <p className="mt-8 max-w-2xl text-base leading-relaxed text-black/70 md:text-lg">
          I have been working for digital agencies and companies since my time
          at the university. Always working with passion, exploring new
          opportunities, and delivering impactful ideas to all my clients. I
          tried to code two years ago, and it stuck with me ever since. That&apos;s
          why I offer a rare blend of skills, combining digital marketing and
          technical abilities.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {HERO_CTAS.map((cta) => (
            <CtaButton key={cta.label} {...cta} />
          ))}
        </div>

        <div className="mt-14 overflow-hidden rounded-[2rem] bg-black shadow-[0_40px_90px_-40px_rgba(0,0,0,0.6)] md:max-w-[720px]">
          <Image
            src="/cv/portrait.jpg"
            alt="Portrait of Marek Klenotič wearing a white TALENT INSIDE t-shirt"
            width={910}
            height={946}
            priority
            className="h-auto w-full object-cover"
            sizes="(max-width: 768px) 100vw, 720px"
          />
        </div>
      </section>

      {/* Experience */}
      <Section kicker="Who Gave Me a Chance" title="Experience">
        <ul className="space-y-4">
          {EXPERIENCE.map((item) => (
            <li
              key={`${item.company}-${item.year}`}
              className="text-base text-black/80 md:text-lg"
            >
              <span className="font-medium text-black">{item.company}</span>
              <span className="text-black/45"> / {item.role} / {item.year}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Education */}
      <Section kicker="Who Taught Me What I Know" title="Education">
        <ul className="space-y-5">
          {EDUCATION.map((item) => (
            <li key={item.title} className="text-base text-black/80 md:text-lg">
              <span className="text-black/45">{item.years}</span> /{" "}
              <span className="font-medium text-black">{item.title}</span> /{" "}
              <span className="text-black/60">{item.place}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Certificates / Skills */}
      <Section kicker="Add-ons and Level-ups" title="Certificates & Skills">
        <div className="space-y-4">
          {SKILL_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-2">
              <span className="mr-1 w-full text-xs font-medium tracking-wide text-black/40 uppercase md:w-32 md:shrink-0">
                {group.label}
              </span>
              {group.items.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-black/15 px-3 py-1 text-sm text-black/70"
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
              className="text-base text-black/80 md:text-lg"
            >
              <span className="font-medium text-black">{item.role}</span>
              {item.detail ? (
                <span className="text-black/60"> / {item.detail}</span>
              ) : null}
              <span className="text-black/45"> / {item.years}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Hobbies */}
      <Section kicker="Having Fun" title="Hobbies">
        <div className="space-y-5">
          <p className="max-w-md text-base text-black/60 md:text-lg">
            Chess on Chess.com as{" "}
            <a
              href="https://www.chess.com/member/ZasUtopilDamu"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black underline decoration-black/20 underline-offset-4 hover:decoration-black/60"
            >
              @ZasUtopilDamu
            </a>{" "}
            — always chasing that next brilliant move or dumping my queen in 2s.
          </p>
          <HobbiesTicker />
          <p className="max-w-md text-base text-black/60 md:text-lg">
            And I run and bring Kindle almost everywhere.
          </p>
        </div>
      </Section>

      {/* Footer */}
      <footer className="px-6 py-24 text-center">
        <div className="mx-auto mb-14 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {HERO_CTAS.map((cta) => (
            <CtaButton key={cta.label} {...cta} />
          ))}
          <ShareButton />
        </div>
        <p className="cv-kicker mx-auto max-w-xl text-2xl text-black/55 md:text-3xl">
          Past is the history, the next is a mystery.
        </p>
      </footer>
    </main>
  );
}
