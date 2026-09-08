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

export type CoinGeometry = {
  blank: CylinderGeometry;
  decal: CircleGeometry;
  shadow: PlaneGeometry;
};

export function createCoinGeometry(): CoinGeometry {
  // Unit-radius chip. Rotate so the circular faces point at the camera (+Z).
  // Low segment counts — the chips are small on screen, so 18 reads round.
  const blank = new CylinderGeometry(1, 1, THICKNESS, 18, 1, false);
  blank.rotateX(Math.PI / 2);
  const decal = new CircleGeometry(0.9, 20);
  const shadow = new PlaneGeometry(1, 1);
  return { blank, decal, shadow };
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
  const rimMats = [
    // cool steel
    new MeshStandardMaterial({
      color: new Color(0.78, 0.82, 0.9),
      metalness: 0.3,
      roughness: 0.3,
    }),
    // neutral silver
    new MeshStandardMaterial({
      color: new Color(0.88, 0.89, 0.9),
      metalness: 0.22,
      roughness: 0.4,
    }),
    // warm brass-ish
    new MeshStandardMaterial({
      color: new Color(0.9, 0.85, 0.74),
      metalness: 0.28,
      roughness: 0.34,
    }),
  ];
  const capMat = new MeshStandardMaterial({
    color: new Color(0.95, 0.95, 0.97),
    metalness: 0.0,
    roughness: 0.45,
  });
  return { rimMats, capMat };
}

export type Coin = {
  group: Group;
  blank: Mesh;
  logo: Mesh;
  logoMat: MeshBasicMaterial;
};

export function createCoin(
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
  return { group, blank, logo, logoMat };
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

export function createLights(): Light[] {
  const ambient = new AmbientLight(0xffffff, 0.82);

  const key = new DirectionalLight(0xffffff, 1.45);
  key.position.set(-0.5, 0.9, 1.4);

  const rim = new DirectionalLight(0x9fc6ff, 0.85);
  rim.position.set(0.8, 0.5, -0.4);

  return [ambient, key, rim];
}

export { THICKNESS };
