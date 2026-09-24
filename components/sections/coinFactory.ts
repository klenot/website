import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  LatheGeometry,
  type Light,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  Vector2,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Half thickness of the unit-radius chip — thin token, not a chunky coin. */
const HALF_T = 0.065;
/** Radial width of the rounded bezel that catches the light. */
const BEVEL = 0.1;
const FACE_R = 1 - BEVEL;
// Emissive carries most of the brand colour; lights only add soft form.
const FACE_EMISSIVE = 0.7;
const EDGE_EMISSIVE = 0.16;
/** Half-size of the flat chip quad (unit radius) — room for thickness + shadow. */
const FLAT_EXTENT = 1.6;

export type CoinGeometry = {
  body: LatheGeometry;
  face: CircleGeometry;
  flatQuad: PlaneGeometry;
  shadow: PlaneGeometry;
};

export function createCoinGeometry(): CoinGeometry {
  // Side wall + quarter-ellipse rounded bezel, revolved. No top cap: the logo
  // face disc sits on top, so the bezel is the only lit geometry.
  const profile: Vector2[] = [new Vector2(1, -HALF_T), new Vector2(1, 0)];
  const steps = 5;
  for (let s = 1; s <= steps; s++) {
    const a = (s / steps) * (Math.PI / 2);
    profile.push(new Vector2(FACE_R + BEVEL * Math.cos(a), HALF_T * Math.sin(a)));
  }
  const body = new LatheGeometry(profile, 28);
  body.rotateX(Math.PI / 2);

  const face = new CircleGeometry(FACE_R + 0.012, 32);
  const flatQuad = new PlaneGeometry(FLAT_EXTENT * 2, FLAT_EXTENT * 2);
  const shadow = new PlaneGeometry(1, 1);
  return { body, face, flatQuad, shadow };
}

export function disposeCoinGeometry(geo: CoinGeometry) {
  geo.body.dispose();
  geo.face.dispose();
  geo.flatQuad.dispose();
  geo.shadow.dispose();
}

type LogoColors = { edge: Color; accent: Color };

/**
 * `edge`: the logo's own outer-ring colour (face backfill).
 * `accent`: dominant saturated brand hue — tints every bezel so all tokens
 * share one language (graphite for monochrome marks).
 */
function analyzeLogo(img: HTMLImageElement): LogoColors {
  const n = 40;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, n, n);
  const data = ctx.getImageData(0, 0, n, n).data;

  let er = 0;
  let eg = 0;
  let eb = 0;
  let ec = 0;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const x = Math.min(n - 1, Math.round(n / 2 + Math.cos(a) * n * 0.45));
    const y = Math.min(n - 1, Math.round(n / 2 + Math.sin(a) * n * 0.45));
    const idx = (y * n + x) * 4;
    if (data[idx + 3] < 200) continue;
    er += data[idx];
    eg += data[idx + 1];
    eb += data[idx + 2];
    ec++;
  }
  const edge = ec
    ? new Color().setRGB(er / ec / 255, eg / ec / 255, eb / ec / 255, SRGBColorSpace)
    : new Color(1, 1, 1);

  const BINS = 12;
  const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2;
      const dy = y + 0.5 - n / 2;
      if (dx * dx + dy * dy > (n / 2) * (n / 2)) continue;
      const idx = (y * n + x) * 4;
      if (data[idx + 3] < 200) continue;
      total++;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;
      if (sat < 0.3 || max < 0.18) continue;
      let h: number;
      if (max === r) h = ((g - b) / (max - min) + 6) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      const bin = bins[Math.floor((h / 6) * BINS) % BINS];
      const w = sat * sat * max;
      bin.w += w;
      bin.r += r * w;
      bin.g += g * w;
      bin.b += b * w;
    }
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  const accent =
    total > 0 && best.w / total > 0.04
      ? new Color().setRGB(best.r / best.w, best.g / best.w, best.b / best.w, SRGBColorSpace)
      : new Color().setRGB(0.22, 0.23, 0.25, SRGBColorSpace);
  return { edge, accent };
}

export type ChipFace = { texture: CanvasTexture; edge: Color; accent: Color };

/**
 * Bakes the logo into a circular face. The flat (mobile) bake also paints the
 * accent bezel ring with its key light so both LODs share one token language;
 * the lit (desktop) bake leaves the bezel to the lathe geometry.
 */
export function bakeChipFace(img: HTMLImageElement, size: number, flat: boolean): ChipFace {
  const { edge, accent } = analyzeLogo(img);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const R = size / 2;
  const hex = (col: Color) => `#${col.getHexString(SRGBColorSpace)}`;

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();

  // Flat: face inset inside a painted bezel ring. Lit: face fills the disc.
  const faceR = flat ? R * FACE_R : R;
  if (flat) {
    const ring = ctx.createLinearGradient(0, 0, size, size);
    const lit = accent.clone().lerp(new Color(1, 1, 1), 0.35);
    const shade = accent.clone().multiplyScalar(0.45);
    ring.addColorStop(0, hex(lit));
    ring.addColorStop(0.5, hex(accent));
    ring.addColorStop(1, hex(shade));
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, faceR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = hex(edge);
  ctx.fillRect(0, 0, size, size);
  // Slight overscan crops the anti-aliased fringe baked into round logos.
  const over = faceR * 0.07;
  ctx.drawImage(img, R - faceR - over, R - faceR - over, (faceR + over) * 2, (faceR + over) * 2);
  const ao = ctx.createRadialGradient(R, R, faceR * 0.8, R, R, faceR);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, size, size);
  if (flat) {
    const key = ctx.createLinearGradient(0, 0, size, size);
    key.addColorStop(0, "rgba(255,255,255,0.07)");
    key.addColorStop(0.5, "rgba(255,255,255,0)");
    key.addColorStop(1, "rgba(0,0,0,0.1)");
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();

  if (flat) {
    // Crisp inner seam where the face meets the bezel.
    ctx.lineWidth = Math.max(1, size / 110);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(R, R, faceR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Chips render near 1:1, so mips only cost memory and soften mid-cross.
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return { texture, edge, accent };
}

export type Coin = {
  group: Group;
  mode: "flat" | "lit";
  /** Lit (desktop) chip: Standard bezel + face; env map attached once baked. */
  faceMat?: MeshStandardMaterial;
  edgeMat?: MeshStandardMaterial;
  bezelColor?: Color;
  /** Flat (mobile) chip: one quad — face, bezel, thickness and shadow. */
  flatMat?: ShaderMaterial;
};

/** Desktop lit token: logo-tinted satin-metal bezel + lit logo face. */
export function createLitCoin(geo: CoinGeometry, face: ChipFace): Coin {
  const bezelColor = face.accent.clone().multiplyScalar(0.85);
  const edgeMat = new MeshStandardMaterial({
    color: bezelColor.clone(),
    emissive: bezelColor.clone(),
    emissiveIntensity: EDGE_EMISSIVE,
    roughness: 0.34,
    metalness: 0.55,
    envMapIntensity: 1,
  });
  // Matte face: no env reflection, broad roughness — kills hotspots on dark marks.
  const faceMat = new MeshStandardMaterial({
    map: face.texture,
    emissiveMap: face.texture,
    emissive: new Color(1, 1, 1),
    emissiveIntensity: FACE_EMISSIVE,
    roughness: 0.85,
    metalness: 0,
    envMapIntensity: 0,
  });
  const edge = new Mesh(geo.body, edgeMat);
  const faceMesh = new Mesh(geo.face, faceMat);
  faceMesh.position.z = HALF_T + 0.004;

  const group = new Group();
  group.add(edge, faceMesh);
  return { group, mode: "lit", faceMat, edgeMat, bezelColor };
}

/** Attach the (deferred) studio env map to a lit chip's bezel. */
export function setCoinEnv(coin: Coin, env: Texture) {
  if (!coin.edgeMat) return;
  coin.edgeMat.envMap = env;
  coin.edgeMat.needsUpdate = true;
}

/**
 * Mobile flat token: ONE unlit quad. Face + bezel come from the baked texture;
 * the thickness sliver and the soft drop/contact shadow are analytic, driven
 * by uniforms — 1 draw per chip, no lights, no extra meshes.
 */
export function createFlatCoin(geo: CoinGeometry, face: ChipFace): Coin {
  const flatMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: face.texture },
      uSide: { value: face.accent.clone().multiplyScalar(0.32) },
      uShade: { value: 1 },
      uShOff: { value: new Vector2(0.04, -0.12) },
      uShScale: { value: 1.15 },
      uShAlpha: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSide;
      uniform float uShade;
      uniform vec2 uShOff;
      uniform float uShScale;
      uniform float uShAlpha;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float aa = max(fwidth(r), 1e-4);
        float face = 1.0 - smoothstep(1.0 - aa, 1.0, r);
        float side = 1.0 - smoothstep(1.0 - aa, 1.0, length(vP - vec2(0.014, -0.085)));
        float sd = length(vP - uShOff) / uShScale;
        float sh = uShAlpha * (1.0 - smoothstep(0.3, 1.0, sd));
        vec4 col = vec4(0.0, 0.0, 0.0, sh);
        col = mix(col, vec4(uSide * uShade, 1.0), side);
        vec3 f = texture2D(uMap, vP * 0.5 + 0.5).rgb * uShade;
        col = mix(col, vec4(f, 1.0), face);
        gl_FragColor = col;
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geo.flatQuad, flatMat);
  const group = new Group();
  group.add(mesh);
  return { group, mode: "flat", flatMat };
}

/** Uniform interior dimming (1 = hero light, <1 = inside the box). */
export function setCoinShade(coin: Coin, k: number) {
  if (coin.flatMat) {
    coin.flatMat.uniforms.uShade.value = k;
    return;
  }
  coin.faceMat!.color.setScalar(k);
  coin.faceMat!.emissiveIntensity = FACE_EMISSIVE * k;
  coin.edgeMat!.color.copy(coin.bezelColor!).multiplyScalar(k);
  coin.edgeMat!.emissiveIntensity = EDGE_EMISSIVE * k;
}

/** Flat chip shadow in chip-local units (offset, radius scale, opacity). */
export function setFlatShadow(coin: Coin, ox: number, oy: number, scale: number, alpha: number) {
  const u = coin.flatMat!.uniforms;
  u.uShOff.value.set(ox, oy);
  u.uShScale.value = scale;
  u.uShAlpha.value = alpha;
}

export function disposeCoin(coin: Coin) {
  if (coin.flatMat) {
    (coin.flatMat.uniforms.uMap.value as Texture).dispose();
    coin.flatMat.dispose();
    return;
  }
  coin.faceMat!.map?.dispose();
  coin.faceMat!.dispose();
  coin.edgeMat!.dispose();
}

export function createShadow(geo: CoinGeometry, texture: Texture): Mesh {
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    color: 0x000000,
    toneMapped: false,
  });
  const mesh = new Mesh(geo.shadow, mat);
  mesh.renderOrder = -10;
  return mesh;
}

/** Soft radial falloff for the desktop drop / contact shadow. */
export function createShadowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(0.5, "rgba(0,0,0,0.32)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const ROUNDED_TOP_MASK = /* glsl */ `
  float roundedTopMask(vec2 p, vec2 size, float radius) {
    vec2 c = vec2(clamp(p.x, radius, size.x - radius), max(p.y, radius));
    return 1.0 - smoothstep(-0.75, 0.75, length(p - c) - radius);
  }
`;

/**
 * The physical mouth, drawn over the chips: an opaque rail at the card's top
 * edge hard-occludes chips as they tuck under the lip, then a soft inner cast
 * shadow falls from it into the card. Inner-only — nothing outside the card.
 */
export function createLipShade(): Mesh<PlaneGeometry, ShaderMaterial> {
  const mat = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: 14 },
      uRail: { value: 16 },
      uShadow: { value: 0.58 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uRadius;
      uniform float uRail;
      uniform float uShadow;
      varying vec2 vUv;
      ${ROUNDED_TOP_MASK}
      void main() {
        vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
        float rail = 1.0 - smoothstep(uRail - 0.6, uRail + 0.6, p.y);
        float t = clamp((p.y - uRail) / max(1.0, uSize.y - uRail), 0.0, 1.0);
        float cast = uShadow * pow(1.0 - t, 1.7);
        gl_FragColor = vec4(0.0, 0.0, 0.0, max(rail, cast) * roundedTopMask(p, uSize, uRadius));
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 20;
  return mesh;
}

/**
 * Faint light spilling in through the mouth onto the card floor, drawn behind
 * the chips (depth-tested). Gives the black card a plane for contact shadows
 * to land on; starts below the lip's cast shadow, fades out by mid-card.
 */
export function createFloorSpill(): Mesh<PlaneGeometry, ShaderMaterial> {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: 14 },
      uStart: { value: 40 },
      uStrength: { value: 0.11 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uRadius;
      uniform float uStart;
      uniform float uStrength;
      varying vec2 vUv;
      ${ROUNDED_TOP_MASK}
      void main() {
        vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
        float rise = smoothstep(uStart * 0.6, uStart * 1.6, p.y);
        float fall = 1.0 - smoothstep(uStart, uSize.y, p.y);
        float cx = (vUv.x - 0.5) * 2.0;
        float a = uStrength * rise * fall * fall * (1.0 - 0.55 * cx * cx);
        gl_FragColor = vec4(0.86, 0.9, 1.0, a * roundedTopMask(p, uSize, uRadius));
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = -30;
  return mesh;
}

export function createLights(): Light[] {
  const ambient = new AmbientLight(0xffffff, 0.12);
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(-0.6, 0.9, 1.2);
  const rim = new DirectionalLight(0xbfd6ff, 1.4);
  rim.position.set(0.9, -0.3, -0.25);
  return [ambient, key, rim];
}

export function setLightsEnabled(lights: Light[], enabled: boolean) {
  for (const light of lights) light.visible = enabled;
}

/** Soft studio IBL for the lit (desktop) bezels only. */
export function createStudioEnvironment(renderer: WebGLRenderer): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return env;
}
