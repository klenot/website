import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
  type Texture,
} from "three";

/** Coin thickness as a fraction of its radius (unit-radius geometry). */
const THICKNESS = 0.17;

export type CoinGeometry = {
  blank: CylinderGeometry;
  decal: CircleGeometry;
  shadow: PlaneGeometry;
};

export function createCoinGeometry(): CoinGeometry {
  // Unit-radius coin. Rotate so the circular caps face the camera (+Z).
  const blank = new CylinderGeometry(1, 1, THICKNESS, 56, 1, false);
  blank.rotateX(Math.PI / 2);
  const decal = new CircleGeometry(0.9, 48);
  const shadow = new PlaneGeometry(1, 1);
  return { blank, decal, shadow };
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
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.55, "rgba(0,0,0,0.28)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export type Coin = {
  group: Group;
  blank: Mesh;
  logo: Mesh;
  rimMat: MeshStandardMaterial;
  capMat: MeshPhysicalMaterial;
  logoMat: MeshBasicMaterial;
};

export function createCoin(geo: CoinGeometry, logoTexture: Texture): Coin {
  // Bright coin edge — kept low-metalness so it reads (real metals need an env
  // map or they render black); the key light gives it a moving specular sheen
  // on tilt, selling the thickness.
  const rimMat = new MeshStandardMaterial({
    color: new Color(0.86, 0.88, 0.92),
    metalness: 0.25,
    roughness: 0.34,
  });
  // Pearl/glass coin body under the logo.
  const capMat = new MeshPhysicalMaterial({
    color: new Color(0.96, 0.96, 0.98),
    metalness: 0.1,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
  });

  // Cylinder groups after rotateX: [side, +Z cap, -Z cap].
  const blank = new Mesh(geo.blank, [rimMat, capMat, capMat]);

  const logoMat = new MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const logo = new Mesh(geo.decal, logoMat);
  logo.position.z = THICKNESS / 2 + 0.014;
  logo.renderOrder = 2;

  const group = new Group();
  group.add(blank);
  group.add(logo);
  return { group, blank, logo, rimMat, capMat, logoMat };
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

/**
 * Opaque box-colored bar at the services box top edge. Coins that dip behind it
 * (negative z during the dock) are occluded → the logos tuck under the "mouth"
 * rim instead of sliding over a color seam.
 */
export function createMouthOccluder(): Mesh {
  const mat = new MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Soft "lip" drawn IN FRONT of the coins at the box top: a faint highlight at
 * the very edge fading into an inner shadow. Reads as a rounded rim overhang and
 * dissolves the hard horizontal seam as coins cross, while also adding top-lit
 * depth to the coins settled in the box's upper band.
 */
export function createLip(): Mesh {
  const w = 8;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  // A lit glass rim: bright specular edge, then a blue interior sheen that stays
  // visible against the near-black box, dissolving the hard color seam and
  // reading as a rounded lip the coins tuck under.
  g.addColorStop(0.0, "rgba(206,226,255,0.0)");
  g.addColorStop(0.03, "rgba(224,238,255,0.85)"); // specular rim line
  g.addColorStop(0.07, "rgba(150,182,240,0.4)");
  g.addColorStop(0.2, "rgba(96,132,200,0.16)"); // interior sheen (reads on black)
  g.addColorStop(0.5, "rgba(60,86,150,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;

  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 4; // in front of the logo decals (renderOrder 2)
  return mesh;
}

export function createLights(): Object3D[] {
  const ambient = new AmbientLight(0xffffff, 0.72);

  const key = new DirectionalLight(0xffffff, 1.55);
  key.position.set(-0.5, 0.9, 1.4);

  const rim = new DirectionalLight(0x9fc6ff, 0.9);
  rim.position.set(0.8, 0.5, -0.6);

  const fill = new DirectionalLight(0xffe9d2, 0.4);
  fill.position.set(0.3, -0.7, 0.9);

  return [ambient, key, rim, fill];
}

export { THICKNESS, DoubleSide };
