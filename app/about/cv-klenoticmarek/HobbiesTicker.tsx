"use client";

import Image from "next/image";

// Final assets: pre-rendered Chess.com "Brilliant Move" game-review collages for
// ZasUtopilDamu (10 square JPGs). They already contain the diagonal teal mosaic,
// so the ticker just scrolls them vertically inside a dark glass frame — no extra
// rotation. To refresh: replace/extend the files in
// public/about/cv-klenoticmarek/chess/ and adjust COLLAGE_COUNT.
const COLLAGE_COUNT = 10;
const COLLAGES = Array.from(
  { length: COLLAGE_COUNT },
  (_, i) => `/about/cv-klenoticmarek/chess/${i + 1}.jpg`,
);

function MarqueeColumn({
  images,
  dir,
  duration,
}: {
  images: string[];
  dir: "up" | "down";
  duration: number;
}) {
  // The track renders the set twice so the -50% keyframe loops seamlessly.
  const loop = [...images, ...images];

  return (
    <div className="h-full overflow-hidden">
      <div
        className="cv-ticker-track flex flex-col gap-3"
        data-dir={dir}
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10"
          >
            <Image
              src={src}
              alt="Chess.com Game Review — ZasUtopilDamu played a Brilliant Move"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 44vw, 300px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HobbiesTicker() {
  const half = Math.ceil(COLLAGES.length / 2);
  const columnA = COLLAGES.slice(0, half);
  const columnB = COLLAGES.slice(half);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-900/40 bg-black/40 p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="grid h-[380px] grid-cols-2 gap-3 md:h-[460px]">
        <MarqueeColumn images={columnA} dir="up" duration={40} />
        <MarqueeColumn images={columnB} dir="down" duration={46} />
      </div>

      {/* Fade the scrolling tiles into the page canvas at the card edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-3xl bg-linear-to-b from-[#05030f] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-3xl bg-linear-to-t from-[#05030f] to-transparent"
      />
    </div>
  );
}
