"use client";

import { useEffect, useState } from "react";

const TEXTS = [
  "Hi, my name is Marek.",
  "I do digital.",
  "Currently, I work at a startup.",
  "I know some neat ops tricks I can share.",
  "Sometimes, I write code.",
  "Or, nowdays instruct agents.",
  "I'll do my best to make your company better.",
  "I also like chess.",
  "If you wanna play.",
];

const TYPING_SPEED = 55;
const ERASING_SPEED = 30;
const HOLD_DURATION = 2500;
/** Hide headline once the services mouth enters view — kills mid-scroll typewriter chrome. */
const HEADLINE_HIDE_SCROLL_PX = 48;
const CAPTURE_IDLE_KEY = "hero-capture-idle";

function readCaptureIdle() {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(CAPTURE_IDLE_KEY) === "1";
}

export default function Hero() {
  const [captureIdle] = useState(readCaptureIdle);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(() => (readCaptureIdle() ? TEXTS[0] : ""));
  const [phase, setPhase] = useState<"typing" | "holding" | "erasing">(() =>
    readCaptureIdle() ? "holding" : "typing",
  );
  const [headlineVisible, setHeadlineVisible] = useState(true);
  const [typingPaused, setTypingPaused] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const hide = window.scrollY > HEADLINE_HIDE_SCROLL_PX;
      setHeadlineVisible(!hide);
      setTypingPaused(hide);
      if (hide) {
        setText(TEXTS[0]);
        setIndex(0);
        setPhase("holding");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (captureIdle) return;
    if (typingPaused) return;

    const current = TEXTS[index];

    if (phase === "typing") {
      if (text === current) {
        const timer = setTimeout(() => setPhase("holding"), HOLD_DURATION);
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(() => {
        setText(current.slice(0, text.length + 1));
      }, TYPING_SPEED);
      return () => clearTimeout(timer);
    }

    if (phase === "holding") {
      const timer = setTimeout(() => setPhase("erasing"), 0);
      return () => clearTimeout(timer);
    }

    // erasing
    if (text === "") {
      const timer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % TEXTS.length);
        setPhase("typing");
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setText(current.slice(0, text.length - 1));
    }, ERASING_SPEED);
    return () => clearTimeout(timer);
  }, [text, phase, index, typingPaused, captureIdle]);

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] overflow-hidden rounded-t-3xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/abstract-gradient-texture-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          background: "linear-gradient(to bottom, #0082FF, #110058)",
          maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        }}
      />
      <div className="relative flex w-full flex-1 items-center justify-center px-6">
        <h2
          className={`mx-auto max-w-[16rem] text-balance text-center font-mono text-lg leading-snug text-white transition-opacity duration-300 sm:max-w-xs sm:text-xl md:max-w-md md:text-xl ${
            headlineVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {text}
          {headlineVisible ? (
            <span
              className="ml-0.5 inline-block h-[1em] w-[3px] animate-pulse rounded-full align-middle"
              style={{ backgroundColor: "#FF8008" }}
            />
          ) : null}
        </h2>
      </div>
    </section>
  );
}
