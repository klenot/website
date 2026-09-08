import * as THREE from "three";

/**
 * Soft-lit glass "coin" shader for a single logo disc.
 *
 * The quad is larger than the disc so a soft contact shadow can bleed beyond the
 * rim. In UV space (0..1, y-down to match our screen-space ortho camera):
 *  - the logo texture is mapped across the disc's bounding box and clipped to a
 *    circle with an anti-aliased edge,
 *  - a fake spherical-cap normal drives subtle wrap lighting + a top-left rim
 *    highlight for volume without washing out brand colors,
 *  - a blurred, offset dark blob underneath reads as a grounded drop shadow.
 *
 * Straight (non-premultiplied) alpha is emitted; pair with a renderer created
 * with `premultipliedAlpha: false` and `NormalBlending` so edges composite
 * cleanly over the hero gradient / black box.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uDiscFrac;     // disc diameter as fraction of the quad
  uniform float uAA;           // edge softness in uv units
  uniform vec3 uLightDir;      // normalized, points toward the light
  uniform float uShadowStrength;
  uniform float uShadowOffset; // downward shadow shift in uv units
  uniform float uLift;         // 0..1 float height -> shadow spread + rim

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float dist = length(p);
    float discR = 0.5 * uDiscFrac;

    // --- soft drop shadow (behind the disc) ---
    vec2 sp = p - vec2(0.0, uShadowOffset * (0.6 + uLift));
    float sd = length(sp);
    float spread = discR * (1.15 + uLift * 0.5);
    float shadow = (1.0 - smoothstep(discR * 0.35, spread, sd));
    shadow = shadow * shadow * uShadowStrength;

    // --- circular disc mask + logo sample ---
    float mask = 1.0 - smoothstep(discR - uAA, discR + uAA * 0.5, dist);
    vec2 texUv = p / (discR * 2.0) + 0.5;
    vec4 tex = texture2D(uMap, texUv);

    // --- fake spherical-cap shading ---
    float r = clamp(dist / discR, 0.0, 1.0);
    float nz = sqrt(max(0.0, 1.0 - r * r));
    vec3 normal = normalize(vec3(p / max(discR, 1e-4), nz * 0.85 + 0.15));
    vec3 L = normalize(uLightDir);
    float wrap = clamp(dot(normal, L) * 0.5 + 0.5, 0.0, 1.0);
    float shade = mix(0.82, 1.10, wrap);
    vec3 col = tex.rgb * shade;

    // top-left rim highlight for a glassy edge
    float rimBand = smoothstep(discR * 0.80, discR, dist)
                  * (1.0 - smoothstep(discR, discR + uAA, dist));
    float rimLight = clamp(dot(normal, L), 0.0, 1.0);
    col += rimBand * rimLight * (0.22 + uLift * 0.18);

    // gentle contact darkening on the far (lower-right) rim
    float ao = smoothstep(discR * 0.62, discR, dist)
             * (1.0 - clamp(dot(normal, L), 0.0, 1.0));
    col *= 1.0 - ao * 0.16;

    float discA = mask * tex.a;

    // composite: shadow underneath, lit disc on top
    float outA = discA + shadow * (1.0 - discA);
    vec3 shadowCol = vec3(0.0);
    vec3 outCol = mix(shadowCol, col, discA / max(outA, 1e-4));

    gl_FragColor = vec4(outCol, outA * uOpacity);
    if (gl_FragColor.a < 0.001) discard;
  }
`;

export function createDiscMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uDiscFrac: { value: 0.7 },
      uAA: { value: 0.012 },
      uLightDir: { value: new THREE.Vector3(-0.55, -0.7, 0.45).normalize() },
      uShadowStrength: { value: 0.32 },
      uShadowOffset: { value: 0.06 },
      uLift: { value: 0 },
    },
  });
}
