import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  LatheGeometry,
  type Light,
  LinearMipmapLinearFilter,
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
const HALF_T = 0.05;
/** Radial width of the rounded edge that catches the light. */
const BEVEL = 0.07;
const FACE_R = 1 - BEVEL;
// Emissive carries most of the brand colour; lights only add soft form.
const FACE_EMISSIVE = 0.66;
const EDGE_EMISSIVE = 0.3;

export type CoinGeometry = {
  body: LatheGeometry;
  face: CircleGeometry;
  flatFace: CircleGeometry;
  flatEdge: CircleGeometry;
  shadow: PlaneGeometry;
};

export function createCoinGeometry(): CoinGeometry {
  // Side wall + quarter-ellipse rounded edge, revolved. No top cap: the logo
  // face disc sits on top, so the edge is the only lit geometry.
  const profile: Vector2[] = [new Vector2(1, -HALF_T), new Vector2(1, 0)];
  const steps = 6;
  for (let s = 1; s <= steps; s++) {
    const a = (s / steps) * (Math.PI / 2);
    profile.push(new Vector2(FACE_R + BEVEL * Math.cos(a), HALF_T * Math.sin(a)));
  }
  const body = new LatheGeometry(profile, 48);
  body.rotateX(Math.PI / 2);

  const face = new CircleGeometry(FACE_R + 0.012, 48);
  const flatFace = new CircleGeometry(1, 40);
  const flatEdge = new CircleGeometry(1, 40);
  const shadow = new PlaneGeometry(1, 1);
  return { body, face, flatFace, flatEdge, shadow };
}

export function disposeCoinGeometry(geo: CoinGeometry) {
  geo.body.dispose();
  geo.face.dispose();
  geo.flatFace.dispose();
  geo.flatEdge.dispose();
  geo.shadow.dispose();
}

/** Average colour of the logo's outer ring, so the edge continues the face. */
function sampleEdgeColor(img: HTMLImageElement): Color {
  const n = 48;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, n, n);
  const data = ctx.getImageData(0, 0, n, n).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const x = Math.round(n / 2 + Math.cos(a) * n * 0.45);
    const y = Math.round(n / 2 + Math.sin(a) * n * 0.45);
    const idx = (Math.min(n - 1, y) * n + Math.min(n - 1, x)) * 4;
    if (data[idx + 3] < 200) continue;
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];
    count++;
  }
  if (count === 0) return new Color(1, 1, 1);
  return new Color().setRGB(r / count / 255, g / count / 255, b / count / 255, SRGBColorSpace);
}

export type ChipFace = { texture: CanvasTexture; edge: Color };

/**
 * Bakes the logo into a circular face. `bakeLight` adds the key-light gradient
 * and bevel highlight into the texture itself — the unlit mobile path gets a
 * believable lit token at zero shading cost; the lit desktop path only gets the
 * soft inner occlusion where the face meets the rounded edge.
 */
export function bakeChipFace(img: HTMLImageElement, size: number, bakeLight: boolean): ChipFace {
  const edge = sampleEdgeColor(img);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const R = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = `#${edge.getHexString(SRGBColorSpace)}`;
  ctx.fillRect(0, 0, size, size);
  // Slight overscan crops the anti-aliased fringe baked into round logos.
  const over = size * 0.035;
  ctx.drawImage(img, -over, -over, size + over * 2, size + over * 2);

  const ao = ctx.createRadialGradient(R, R, R * 0.78, R, R, R);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, bakeLight ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.14)");
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, size, size);

  if (bakeLight) {
    const key = ctx.createLinearGradient(0, 0, size, size);
    key.addColorStop(0, "rgba(255,255,255,0.16)");
    key.addColorStop(0.5, "rgba(255,255,255,0)");
    key.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, size, size);

    const w = R * 0.085;
    const bevel = ctx.createLinearGradient(size * 0.15, size * 0.1, size * 0.85, size * 0.9);
    bevel.addColorStop(0, "rgba(255,255,255,0.62)");
    bevel.addColorStop(0.45, "rgba(255,255,255,0.08)");
    bevel.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.lineWidth = w;
    ctx.strokeStyle = bevel;
    ctx.beginPath();
    ctx.arc(R, R, R - w / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1, size / 128);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(R, R, R - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  return { texture, edge };
}

export type Coin = {
  group: Group;
  face: Mesh;
  edge: Mesh;
  faceMat: MeshStandardMaterial | MeshBasicMaterial;
  edgeMat: MeshStandardMaterial | MeshBasicMaterial;
  edgeColor: Color;
  /** `flat` = unlit baked token (mobile); `lit` = Standard lathe (desktop). */
  mode: "flat" | "lit";
};

/** Desktop lit token: lathe edge in the logo's own colour + lit logo face. */
export function createLitCoin(geo: CoinGeometry, face: ChipFace, envMap: Texture): Coin {
  const edgeMat = new MeshStandardMaterial({
    color: face.edge.clone(),
    emissive: face.edge.clone(),
    emissiveIntensity: EDGE_EMISSIVE,
    roughness: 0.3,
    metalness: 0,
    envMap,
    envMapIntensity: 0.45,
  });
  const faceMat = new MeshStandardMaterial({
    map: face.texture,
    emissiveMap: face.texture,
    emissive: new Color(1, 1, 1),
    emissiveIntensity: FACE_EMISSIVE,
    roughness: 0.62,
    metalness: 0,
    envMap,
    envMapIntensity: 0.12,
  });
  const edge = new Mesh(geo.body, edgeMat);
  const faceMesh = new Mesh(geo.face, faceMat);
  faceMesh.position.z = HALF_T + 0.004;

  const group = new Group();
  group.add(edge, faceMesh);
  return {
    group,
    face: faceMesh,
    edge,
    faceMat,
    edgeMat,
    edgeColor: face.edge.clone(),
    mode: "lit",
  };
}

/** Mobile flat token: baked-lit face + a darker offset disc read as thickness. */
export function createFlatCoin(geo: CoinGeometry, face: ChipFace): Coin {
  const edgeColor = face.edge.clone().multiplyScalar(0.5);
  const edgeMat = new MeshBasicMaterial({ color: edgeColor.clone(), toneMapped: false });
  const faceMat = new MeshBasicMaterial({ map: face.texture, toneMapped: false });
  const edge = new Mesh(geo.flatEdge, edgeMat);
  edge.position.set(0.012, -0.06, -0.01);
  const faceMesh = new Mesh(geo.flatFace, faceMat);

  const group = new Group();
  group.add(edge, faceMesh);
  return { group, face: faceMesh, edge, faceMat, edgeMat, edgeColor, mode: "flat" };
}

/** Uniform interior dimming (1 = hero light, <1 = inside the box). */
export function setCoinShade(coin: Coin, k: number) {
  coin.faceMat.color.setScalar(k);
  coin.edgeMat.color.copy(coin.edgeColor).multiplyScalar(k);
  if (coin.mode === "lit") {
    (coin.faceMat as MeshStandardMaterial).emissiveIntensity = FACE_EMISSIVE * k;
    (coin.edgeMat as MeshStandardMaterial).emissiveIntensity = EDGE_EMISSIVE * k;
  }
}

export function disposeCoin(coin: Coin) {
  coin.faceMat.map?.dispose();
  coin.faceMat.dispose();
  coin.edgeMat.dispose();
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

/** Soft radial falloff for the drop / contact shadow. */
export function createShadowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.45, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Inner-only box shade, drawn over the chips: deep at the lip, falling off into
 * the box, plus soft side walls. A chip crossing the lip passes under it and
 * emerges continuously — a soft half-clip with no depth pop and no exterior
 * rim line. Rounded top corners match the card.
 */
export function createLipShade(): Mesh<PlaneGeometry, ShaderMaterial> {
  const mat = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: 14 },
      uDepth: { value: 90 },
      uSide: { value: 60 },
      uStrength: { value: 0.96 },
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
      uniform float uDepth;
      uniform float uSide;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
        float top = 1.0 - smoothstep(0.0, uDepth, p.y);
        top *= top;
        float sx = min(p.x, uSize.x - p.x);
        float side = 1.0 - smoothstep(0.0, uSide, sx);
        side *= side * 0.5;
        vec2 c = vec2(clamp(p.x, uRadius, uSize.x - uRadius), max(p.y, uRadius));
        float mask = 1.0 - smoothstep(-0.75, 0.75, length(p - c) - uRadius);
        gl_FragColor = vec4(0.0, 0.0, 0.0, max(top, side) * uStrength * mask);
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 20;
  return mesh;
}

export function createLights(): Light[] {
  const ambient = new AmbientLight(0xffffff, 0.12);
  const key = new DirectionalLight(0xffffff, 1.25);
  key.position.set(-0.6, 0.9, 1.2);
  const rim = new DirectionalLight(0xbfd6ff, 1.2);
  rim.position.set(0.9, -0.3, -0.25);
  return [ambient, key, rim];
}

export function setLightsEnabled(lights: Light[], enabled: boolean) {
  for (const light of lights) light.visible = enabled;
}

/** Soft studio IBL for the lit (desktop) path only. */
export function createStudioEnvironment(renderer: WebGLRenderer): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return env;
}
