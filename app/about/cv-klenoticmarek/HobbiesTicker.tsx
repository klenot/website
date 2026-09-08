"use client";

import Image from "next/image";

type Tile = { src: string; move: string };

// TEMPORARY PLACEHOLDER ART. The final chess "Brilliant Move" tiles will be
// supplied later. To swap: drop the new images in
// public/about/cv-klenoticmarek/ticker/ and update the src/move entries below
// (portrait ~132×182 works best). No other layout changes needed.
const TILES: Tile[] = [
  { src: "/about/cv-klenoticmarek/ticker/bd5.png", move: "Bd5" },
  { src: "/about/cv-klenoticmarek/ticker/qxd4.png", move: "Qxd4" },
  { src: "/about/cv-klenoticmarek/ticker/cxb3.png", move: "cxb3" },
];

const TILE_W = 132;
const TILE_H = 182;

function TickerColumn({
  dir,
  duration,
  order,
}: {
  dir: "up" | "down";
  duration: number;
  order: Tile[];
}) {
  // The track renders the tile set twice so the -50% keyframe loops seamlessly.
  const loop = [...order, ...order];

  return (
    <div className="overflow-hidden" style={{ width: TILE_W }}>
      <div
        className="cv-ticker-track flex flex-col gap-3"
        data-dir={dir}
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((tile, i) => (
          <div
            key={`${tile.move}-${i}`}
            className="overflow-hidden rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
            style={{ width: TILE_W, height: TILE_H }}
          >
            <Image
              src={tile.src}
              alt={`Chess.com Brilliant Move — ${tile.move} by ZasUtopilDamu`}
              width={TILE_W}
              height={TILE_H}
              className="h-full w-full object-cover"
              sizes="132px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerCard({
  columns,
}: {
  columns: { dir: "up" | "down"; duration: number; order: Tile[] }[];
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-blue-900/40 bg-black/40 ring-1 ring-white/10">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Rotated + scaled layer produces the diagonal mosaic clipped by the card. */}
        <div className="rotate-[-24deg] scale-[1.7]">
          <div className="flex gap-3">
            {columns.map((col, i) => (
              <TickerColumn
                key={i}
                dir={col.dir}
                duration={col.duration}
                order={col.order}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Soft edge vignette to blend the clipped tiles into the dark card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          boxShadow: "inset 0 0 60px 16px rgba(5,3,15,0.85)",
        }}
      />
    </div>
  );
}

export default function HobbiesTicker() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TickerCard
        columns={[
          { dir: "up", duration: 26, order: [TILES[0], TILES[1], TILES[2]] },
          { dir: "down", duration: 32, order: [TILES[2], TILES[0], TILES[1]] },
        ]}
      />
      <TickerCard
        columns={[
          { dir: "down", duration: 30, order: [TILES[1], TILES[2], TILES[0]] },
          { dir: "up", duration: 24, order: [TILES[0], TILES[2], TILES[1]] },
        ]}
      />
    </div>
  );
}
