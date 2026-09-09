import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  type Light,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
} from "three";

/** Thin chip, not a chunky coin (Marek: "chips are really chunky"). */
const THICKNESS = 0.06;

/** Face inset — more rim visible for frosted craft read (desktop lit chips). */
const FACE_INSET = 0.84;

/** Flat mobile rim tints (MeshBasic — no lighting cost). */
export const FLAT_RIM_COLORS = [0x3a4454, 0x45474c, 0x4a4238] as const;

export type CoinGeometry = {
  blank: CylinderGeometry;
  decal: CircleGeometry;
  shadow: PlaneGeometry;
  flatRim: CircleGeometry;
  flatFace: CircleGeometry;
};

export function createCoinGeometry(): CoinGeometry {
  // Unit-radius chip. Rotate so the circular faces point at the camera (+Z).
  // Low segment counts — the chips are small on screen, so 18 reads round.
  const blank = new CylinderGeometry(1, 1, THICKNESS, 18, 1, false);
  blank.rotateX(Math.PI / 2);
  const decal = new CircleGeometry(FACE_INSET, 20);
  const shadow = new PlaneGeometry(1, 1);
  const flatRim = new CircleGeometry(1, 14);
  const flatFace = new CircleGeometry(FACE_INSET, 14);
  return { blank, decal, shadow, flatRim, flatFace };
}

/**
 * A small palette of rim + one cap material, shared across all chips (only the
 * logo decal is per-chip). Three rim tints break the "identical white rim on
 * every disc" read cheaply — no per-coin materials, no `MeshPhysicalMaterial`.
 */
export type CoinMaterials = {
  rimMats: MeshStandardMaterial[];
  capMat: MeshStandardMaterial;
};

export function createCoinMaterials(): CoinMaterials {
  // Dark frosted-glass rims — low metalness + high roughness = soft, diffuse
  // specular (no chrome-toy glare). Subtle cool/neutral/warm tint variation.
  const rimMats = [
    new MeshStandardMaterial({
      color: new Color(0.28, 0.32, 0.4),
      metalness: 0.1,
      roughness: 0.62,
    }),
    new MeshStandardMaterial({
      color: new Color(0.34, 0.35, 0.38),
      metalness: 0.08,
      roughness: 0.66,
    }),
    new MeshStandardMaterial({
      color: new Color(0.4, 0.36, 0.31),
      metalness: 0.1,
      roughness: 0.6,
    }),
  ];
  // Soft off-white body under the logo (matte, not glossy).
  const capMat = new MeshStandardMaterial({
    color: new Color(0.9, 0.9, 0.93),
    metalness: 0.0,
    roughness: 0.6,
  });
  return { rimMats, capMat };
}

export type Coin = {
  group: Group;
  blank: Mesh;
  logo: Mesh;
  logoMat: MeshBasicMaterial;
  /** `flat` = unlit billboard (mobile); `lit` = Standard cylinder (desktop). */
  mode: "flat" | "lit";
};

/** Desktop-only lit cylinder chip (MeshStandard — shared materials). */
export function createLitCoin(
  geo: CoinGeometry,
  mats: CoinMaterials,
  logoTexture: Texture,
  rimIndex: number,
): Coin {
  const rim = mats.rimMats[rimIndex % mats.rimMats.length];
  // Cylinder groups after rotateX: [side, +Z cap, -Z cap] — shared materials.
  const blank = new Mesh(geo.blank, [rim, mats.capMat, mats.capMat]);

  const logoMat = new MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const logo = new Mesh(geo.decal, logoMat);
  logo.position.z = THICKNESS / 2 + 0.01;
  logo.renderOrder = 2;

  const group = new Group();
  group.add(blank);
  group.add(logo);
  return { group, blank, logo, logoMat, mode: "lit" };
}

/** Mobile-only unlit flat quad — no StandardMaterial, no lights. */
export function createFlatCoin(
  geo: CoinGeometry,
  logoTexture: Texture,
  rimIndex: number,
): Coin {
  const rimColor = FLAT_RIM_COLORS[rimIndex % FLAT_RIM_COLORS.length];
  const blank = new Mesh(
    geo.flatRim,
    new MeshBasicMaterial({ color: rimColor, toneMapped: false }),
  );
  const logoMat = new MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const logo = new Mesh(geo.flatFace, logoMat);
  logo.position.z = 0.01;
  logo.renderOrder = 2;

  const group = new Group();
  group.add(blank);
  group.add(logo);
  return { group, blank, logo, logoMat, mode: "flat" };
}

/** @deprecated Use createLitCoin / createFlatCoin. */
export function createCoin(
  geo: CoinGeometry,
  mats: CoinMaterials,
  logoTexture: Texture,
  rimIndex: number,
): Coin {
  return createLitCoin(geo, mats, logoTexture, rimIndex);
}

export function createShadow(geo: CoinGeometry, texture: Texture): Mesh {
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0,
    color: 0x000000,
    toneMapped: false,
  });
  const mesh = new Mesh(geo.shadow, mat);
  mesh.renderOrder = -10;
  return mesh;
}

/** Soft radial falloff used for the grounded contact shadow. */
export function createShadowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(0.55, "rgba(0,0,0,0.24)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Plain box-colored bar at the services box top edge — NO highlight/lit line
 * (that read as an artifact). It is invisible against the black card and only
 * occludes chips that dip behind it while straddling the "mouth", so they read
 * as tucking under the lip instead of sliding over a color seam.
 */
export function createMouthOccluder(): Mesh {
  const mat = new MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 1;
  return mesh;
}

export function createLights(): Light[] {
  const ambient = new AmbientLight(0xffffff, 0.82);

  const key = new DirectionalLight(0xffffff, 1.45);
  key.position.set(-0.5, 0.9, 1.4);

  const rim = new DirectionalLight(0x9fc6ff, 0.85);
  rim.position.set(0.8, 0.5, -0.4);

  return [ambient, key, rim];
}

export function setLightsEnabled(lights: Light[], enabled: boolean) {
  for (const light of lights) light.visible = enabled;
}

export { THICKNESS };
