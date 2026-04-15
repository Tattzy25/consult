import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface WreckShaderProps {
  audioLevel: number;
  isAudioPlaying: boolean;
}

export const WreckShader: React.FC<WreckShaderProps> = ({
  audioLevel,
  isAudioPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioLevelRef = useRef(audioLevel);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let sphere: THREE.Mesh | null = null;
    let geometry: THREE.IcosahedronGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vDisplacement;
      uniform float uTime;
      uniform float uAudioLevel;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy * 2.0;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(
          permute(
            permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0)
          )
          + i.x + vec4(0.0, i1.x, i2.x, 1.0)
        );

        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;

        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      void main() {
        vNormal = normalize(normalMatrix * normal);

        float idleFloor = 0.12;
        float reactive = max(uAudioLevel, idleFloor);

        float noise = snoise(position * 1.15 + uTime * 0.32);
        vDisplacement = noise * (0.12 + reactive * 0.42);

        vec3 newPosition = position + normal * vDisplacement;
        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vViewPosition = -mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vDisplacement;
      uniform float uAudioLevel;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        float fresnel = pow(clamp(1.0 - dot(normal, viewDir), 0.0, 1.0), 3.2);
        float spec = pow(clamp(dot(reflect(-viewDir, normal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 24.0);

        vec3 baseColor = vec3(0.18, 0.18, 0.20);
        vec3 reflectionColor = vec3(0.96, 0.97, 1.0);

        float mixValue = clamp(fresnel + spec * 0.65, 0.0, 1.0);
        vec3 finalColor = mix(baseColor, reflectionColor, mixValue);

        finalColor += vec3(0.12, 0.12, 0.18) * vDisplacement;
        finalColor *= (1.05 + max(uAudioLevel, 0.12) * 0.45);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const init = () => {
      if (disposed || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) {
        frameIdRef.current = requestAnimationFrame(init);
        return;
      }

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      camera.position.z = 3.15;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });

      renderer.setClearColor(0x000000, 0);
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      geometry = new THREE.IcosahedronGeometry(1, 18);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uAudioLevel: { value: Math.max(audioLevelRef.current, 0.12) },
        },
        wireframe: true,
        transparent: false,
      });

      sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);

      const handleResize = () => {
        if (!container || !camera || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      handleResize();

      const animate = (time: number) => {
        if (disposed || !renderer || !scene || !camera || !sphere || !material)
          return;

        material.uniforms.uTime.value = time * 0.001;
        material.uniforms.uAudioLevel.value +=
          (Math.max(audioLevelRef.current, 0.12) -
            material.uniforms.uAudioLevel.value) *
          0.12;

        sphere.rotation.y += isAudioPlaying ? 0.006 : 0.0035;
        sphere.rotation.z += isAudioPlaying ? 0.0025 : 0.0015;

        renderer.render(scene, camera);
        frameIdRef.current = requestAnimationFrame(animate);
      };

      frameIdRef.current = requestAnimationFrame(animate);
    };

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameIdRef.current);
      resizeObserver?.disconnect();

      if (renderer?.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
    };
  }, [isAudioPlaying]);

  return (
    <div ref={containerRef} className="w-full h-full pointer-events-none" />
  );
};
