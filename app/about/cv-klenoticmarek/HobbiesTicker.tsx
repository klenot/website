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
            className="relative aspect-square overflow-hidden rounded-md ring-1 ring-black/10"
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

  // Plain blog figure treatment: 1px black/10 border, ~6px radius, no fade
  // masks — the marquee simply clips at the frame edge.
  return (
    <div className="overflow-hidden rounded-md border border-black/10 p-2">
      <div className="grid h-[380px] grid-cols-2 gap-2 md:h-[460px]">
        <MarqueeColumn images={columnA} dir="up" duration={40} />
        <MarqueeColumn images={columnB} dir="down" duration={46} />
      </div>
    </div>
  );
}
