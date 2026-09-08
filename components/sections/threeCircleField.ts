import * as THREE from "three";

export type LogoSpec = { file: string; size: number };

/** One disc to draw this frame, in viewport pixel space (y grows downward). */
export type InstanceInput = {
  x: number;
  y: number;
  size: number;
  alpha: number;
};

const ATLAS_CELL = 128;
const ATLAS_GUTTER = 2;
const MAX_DPR = 2;

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aOffset;
  attribute vec2 aScale;
  attribute float aAlpha;
  varying vec2 vUv;
  varying vec2 vAtlas;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vAtlas = aOffset + uv * aScale;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform float uMaster;
  varying vec2 vUv;
  varying vec2 vAtlas;
  varying float vAlpha;
  void main() {
    // Circular mask with a small, fixed antialiased rim. A constant feather
    // (rather than fwidth) keeps this portable across WebGL1/2 with no
    // derivative extensions; the softness is sub-pixel at these disc sizes.
    float d = length(vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.95, 1.0, d);
    if (mask <= 0.0) discard;
    vec4 tex = texture2D(uAtlas, vAtlas);
    float a = tex.a * mask * vAlpha * uMaster;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(tex.rgb, a);
  }
`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Imperative Three.js renderer for the logo discs. Owns a single instanced,
 * atlas-textured mesh drawn with an orthographic pixel-space camera, so every
 * disc is one GPU-composited quad in a single draw call. All positions are fed
 * in viewport pixels; the class flips Y internally for the y-up camera.
 */
export class ThreeCircleField {
  private readonly canvas: HTMLCanvasElement;
  private readonly logos: readonly LogoSpec[];
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.InstancedMesh | null = null;
  private geometry: THREE.InstancedBufferGeometry | THREE.PlaneGeometry | null =
    null;
  private material: THREE.ShaderMaterial | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private alphaAttr: THREE.InstancedBufferAttribute | null = null;
  private readonly dummy = new THREE.Object3D();
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, logos: readonly LogoSpec[]) {
    this.canvas = canvas;
    this.logos = logos;
  }

  get ready(): boolean {
    return this.mesh !== null && !this.disposed;
  }

  async init(): Promise<boolean> {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const texture = await this.buildAtlas();
    if (this.disposed) {
      renderer.dispose();
      return false;
    }
    this.texture = texture;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -100, 100);
    camera.position.z = 10;
    this.scene = scene;
    this.camera = camera;

    const count = this.logos.length;
    const base = new THREE.PlaneGeometry(1, 1);

    const offsets = new Float32Array(count * 2);
    const scales = new Float32Array(count * 2);
    const alphas = new Float32Array(count);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      offsets[i * 2] = (c * ATLAS_CELL) / (cols * ATLAS_CELL);
      offsets[i * 2 + 1] = 1 - ((r + 1) * ATLAS_CELL) / (rows * ATLAS_CELL);
      scales[i * 2] = ATLAS_CELL / (cols * ATLAS_CELL);
      scales[i * 2 + 1] = ATLAS_CELL / (rows * ATLAS_CELL);
      alphas[i] = 0;
    }

    base.setAttribute(
      "aOffset",
      new THREE.InstancedBufferAttribute(offsets, 2),
    );
    base.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 2));
    const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    base.setAttribute("aAlpha", alphaAttr);
    this.alphaAttr = alphaAttr;
    this.geometry = base;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uMaster: { value: 1 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.material = material;

    const mesh = new THREE.InstancedMesh(base, material, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Park every instance off-screen until the first pose update.
    for (let i = 0; i < count; i++) {
      this.dummy.position.set(-9999, -9999, 0);
      this.dummy.scale.set(0.001, 0.001, 1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    this.mesh = mesh;

    return true;
  }

  private async buildAtlas(): Promise<THREE.CanvasTexture> {
    const count = this.logos.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const canvas = document.createElement("canvas");
    canvas.width = cols * ATLAS_CELL;
    canvas.height = rows * ATLAS_CELL;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const images = await Promise.all(
        this.logos.map((logo) => loadImage(`/logos/${logo.file}`)),
      );
      for (let i = 0; i < count; i++) {
        const img = images[i];
        if (!img) continue;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const cellX = c * ATLAS_CELL;
        const cellY = r * ATLAS_CELL;
        const inner = ATLAS_CELL - ATLAS_GUTTER * 2;
        // object-cover: scale to fill the inner square, center-crop overflow.
        const scale = Math.max(inner / img.width, inner / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = cellX + ATLAS_GUTTER + (inner - dw) / 2;
        const dy = cellY + ATLAS_GUTTER + (inner - dh) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          cellX + ATLAS_GUTTER,
          cellY + ATLAS_GUTTER,
          inner,
          inner,
        );
        ctx.clip();
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  setMasterOpacity(value: number): void {
    if (this.material) this.material.uniforms.uMaster.value = value;
  }

  setSize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (!this.renderer || !this.camera) return;
    this.width = Math.max(1, cssWidth);
    this.height = Math.max(1, cssHeight);
    this.renderer.setPixelRatio(Math.min(dpr, MAX_DPR));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.left = 0;
    this.camera.right = this.width;
    this.camera.top = this.height;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
  }

  setInstances(items: readonly InstanceInput[]): void {
    if (!this.mesh || !this.alphaAttr) return;
    const count = Math.min(items.length, this.mesh.count);
    const w = this.width;
    const h = this.height;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      const half = it.size * 0.5;
      const offscreen =
        it.alpha <= 0.001 ||
        it.x < -half ||
        it.x > w + half ||
        it.y < -half ||
        it.y > h + half;
      if (offscreen) {
        this.alphaAttr.setX(i, 0);
        this.dummy.position.set(-9999, -9999, 0);
        this.dummy.scale.set(0.001, 0.001, 1);
      } else {
        this.alphaAttr.setX(i, it.alpha);
        // Flip Y: pose space is y-down, the ortho camera is y-up.
        this.dummy.position.set(it.x, h - it.y, 0);
        this.dummy.scale.set(it.size, it.size, 1);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.mesh = null;
    this.alphaAttr = null;
    this.geometry?.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.geometry = null;
    this.material = null;
    this.texture = null;
  }
}
