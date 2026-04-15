import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WreckShaderProps {
  audioLevel: number;
  visualMode: 'idle' | 'listening' | 'speaking';
}

export const WreckShader: React.FC<WreckShaderProps> = ({ audioLevel, visualMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioLevelRef = useRef(audioLevel);
  const visualModeRef = useRef(visualMode);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    visualModeRef.current = visualMode;
  }, [visualMode]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const frameIdRef = useRef<number>(0);

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement;
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uListening;
    uniform float uSpeaking;

    // Simplex 3D Noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy*2.0;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      float noiseFreq = 1.5 + uListening * 0.5;
      float timeSpeed = 0.4 + uSpeaking * 0.2 + uListening * 0.1;
      
      float noise = snoise(position * noiseFreq + uTime * timeSpeed);
      vDisplacement = noise * (0.15 + uAudioLevel * 0.6);
      
      vec3 newPosition = position + normal * vDisplacement;
      vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement;
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uListening;
    uniform float uSpeaking;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Fresnel effect for chrome-like reflections (clamp prevents NaN on some GPUs)
      float fresnel = pow(clamp(1.0 - dot(normal, viewDir), 0.0001, 1.0), 3.0);
      
      // Chrome colors (Black to White/Silver)
      vec3 baseColor = vec3(0.05);
      vec3 silverColor = vec3(0.9, 0.9, 1.0);
      vec3 cyanColor = vec3(0.4, 0.8, 1.0);
      vec3 goldColor = vec3(1.0, 0.9, 0.7);
      
      // Add some "liquid" movement to the color
      float spec = pow(clamp(dot(reflect(-viewDir, normal), vec3(0.0, 1.0, 0.0)), 0.0001, 1.0), 32.0);
      
      vec3 idleColor = mix(baseColor, silverColor, fresnel + spec);
      vec3 listeningColor = mix(baseColor, cyanColor, fresnel + spec);
      vec3 speakingColor = mix(baseColor, goldColor, fresnel + spec);
      
      vec3 finalColor = mix(idleColor, listeningColor, uListening);
      finalColor = mix(finalColor, speakingColor, uSpeaking);
      
      // Add subtle iridescent shift based on displacement
      finalColor += vec3(0.1, 0.1, 0.2) * vDisplacement;
      if (uListening > 0.0) {
        finalColor += vec3(0.0, 0.2, 0.4) * vDisplacement * uListening;
      }
      if (uSpeaking > 0.0) {
        finalColor += vec3(0.2, 0.1, 0.0) * vDisplacement * uSpeaking;
      }
      
      // Boost brightness slightly based on audio level
      finalColor *= (1.0 + uAudioLevel * 0.5);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    // Safely calculate aspect ratio to prevent NaN on initial layout
    const aspect = width > 0 && height > 0 ? width / height : 1;

    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = window.innerWidth < 768 ? 3.75 : 3.45;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    if (width > 0 && height > 0) {
      renderer.setSize(width, height);
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Geometry & Material
    const geometry = new THREE.IcosahedronGeometry(1, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uListening: { value: 0 },
        uSpeaking: { value: 0 },
      },
      wireframe: true,
      transparent: true,
    });
    materialRef.current = material;

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Animation loop
    const animate = (time: number) => {
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time * 0.001;
        // Smooth transition for audio level
        materialRef.current.uniforms.uAudioLevel.value += (audioLevelRef.current - materialRef.current.uniforms.uAudioLevel.value) * 0.2;
        
        const targetListening = visualModeRef.current === 'listening' ? 1.0 : 0.0;
        const targetSpeaking = visualModeRef.current === 'speaking' ? 1.0 : 0.0;
        
        // Smooth transition for visual modes
        materialRef.current.uniforms.uListening.value += (targetListening - materialRef.current.uniforms.uListening.value) * 0.1;
        materialRef.current.uniforms.uSpeaking.value += (targetSpeaking - materialRef.current.uniforms.uSpeaking.value) * 0.1;
      }
      
      if (sphere) {
        sphere.rotation.y += 0.005;
        sphere.rotation.z += 0.002;
      }

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      
      if (w === 0 || h === 0) return;

      cameraRef.current.aspect = w / h;
      cameraRef.current.position.z = window.innerWidth < 768 ? 3.75 : 3.45;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frameIdRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full pointer-events-auto" />;
};
