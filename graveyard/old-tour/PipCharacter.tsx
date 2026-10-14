"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

// ===================================================================
// Pip: a voxel pill character built from box meshes.
// No image files, no model downloads. Just box shapes.
//
// The model is built in a small coordinate space:
//   - body is 4 cubes tall, 2 wide, 2 deep
//   - centered at origin so the camera always frames it
//   - one cube = 0.5 units
// ===================================================================

const C = 0.5; // one voxel cube edge length

// Pill body: a 2x2x4 block (width x depth x height)
// Centered at origin, so y ranges from -1 to +1
function BodyVoxels(): [number, number, number][] {
  const pos: [number, number, number][] = [];
  for (let x = -0.5; x <= 0.5; x += 1) {
    for (let z = -0.5; z <= 0.5; z += 1) {
      for (let y = -1.5; y <= 1.5; y += 1) {
        pos.push([x * C, y * C, z * C]);
      }
    }
  }
  return pos;
}

const BODY = BodyVoxels();

// Eyes: two small white cubes on the +Z face
const EYE_L: [number, number, number] = [-0.2, 0.15, 0.55];
const EYE_R: [number, number, number] = [0.2, 0.15, 0.55];

export type PipVariant = 1 | 2 | 3 | 4 | 5 | 6 | "happy" | "worried" | "stop";

interface PipProps {
  variant: PipVariant;
  versionLabel?: string;
  position?: [number, number]; // [x, y] in screen px for overlay positioning
}

// --- A single voxel box ---
function Voxel({
  pos,
  color,
  size = C,
}: {
  pos: [number, number, number];
  color: string;
  size?: number;
}) {
  return (
    <mesh position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// --- The 3D Pip model ---
function Pip3D({
  variant,
  versionLabel = "v1.0",
}: {
  variant: PipVariant;
  versionLabel?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Gentle hover bob — animate from current position (interruptible)
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const targetY = Math.sin(t * 1.5) * 0.04;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      0.08
    );
  });

  const bodyColor = "#8B7CFF";
  const eyeWhite = "#FFFFFF";
  const pupil = "#07080C";

  return (
    <group ref={groupRef}>
      {/* Body */}
      {BODY.map((p, i) => (
        <Voxel key={`b-${i}`} pos={p} color={bodyColor} />
      ))}

      {/* Eyes */}
      <Voxel pos={EYE_L} color={eyeWhite} size={0.18} />
      <Voxel pos={EYE_R} color={eyeWhite} size={0.18} />
      {/* Pupils */}
      <mesh position={[EYE_L[0], EYE_L[1], EYE_L[2] + 0.1]}>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color={pupil} />
      </mesh>
      <mesh position={[EYE_R[0], EYE_R[1], EYE_R[2] + 0.1]}>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color={pupil} />
      </mesh>

      {/* Variant 1: notebook in hand */}
      {variant === 1 && (
        <mesh position={[0.6, -0.2, 0]}>
          <boxGeometry args={[0.3, 0.4, 0.08]} />
          <meshStandardMaterial color="#1A1D23" />
        </mesh>
      )}

      {/* Variant 2: yellow hard hat on top */}
      {variant === 2 && (
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.7, 0.3, 0.7]} />
          <meshStandardMaterial color="#F59E0B" />
        </mesh>
      )}

      {/* Variant 3: traffic light beside */}
      {variant === 3 && (
        <>
          <mesh position={[0.7, 0.2, 0]}>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
            <meshStandardMaterial color="#0D0F14" />
          </mesh>
          <mesh position={[0.7, 0.45, 0.12]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              emissive="#F59E0B"
              emissiveIntensity={0.6}
            />
          </mesh>
        </>
      )}

      {/* Variant 4: big stamp in hand */}
      {variant === 4 && (
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[0.25, 0.5, 0.25]} />
          <meshStandardMaterial color="#38BDF8" />
        </mesh>
      )}

      {/* Variant 5: version badge on chest, flips colour */}
      {variant === 5 && (
        <mesh position={[0, 0.05, 0.55]}>
          <boxGeometry args={[0.4, 0.2, 0.05]} />
          <meshStandardMaterial
            color={versionLabel === "v1.1" ? "#22C55E" : "#8B7CFF"}
            emissive={versionLabel === "v1.1" ? "#22C55E" : "#8B7CFF"}
            emissiveIntensity={0.4}
          />
        </mesh>
      )}

      {/* Variant 6: second Pip (cyan) walking to Building B */}
      {variant === 6 && (
        <group position={[1.2, 0, 0.3]}>
          {BODY.map((p, i) => (
            <Voxel key={`b2-${i}`} pos={p} color="#38BDF8" />
          ))}
          <Voxel pos={EYE_L} color={eyeWhite} size={0.18} />
          <Voxel pos={EYE_R} color={eyeWhite} size={0.18} />
          <mesh position={[EYE_L[0] + 1.2, EYE_L[1], EYE_L[2] + 0.3 + 0.1]}>
            <boxGeometry args={[0.08, 0.08, 0.05]} />
            <meshStandardMaterial color={pupil} />
          </mesh>
          <mesh position={[EYE_R[0] + 1.2, EYE_R[1], EYE_R[2] + 0.3 + 0.1]}>
            <boxGeometry args={[0.08, 0.08, 0.05]} />
            <meshStandardMaterial color={pupil} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ===================================================================
// SVG fallback — a clear isometric voxel Pip, same size as the 3D
// ===================================================================
function PipSVG({ variant, size = 160 }: { variant: PipVariant; size?: number }) {
  const body = "#8B7CFF";
  const accent =
    variant === 2 ? "#F59E0B" :
    variant === 3 ? "#EF4444" :
    variant === 4 ? "#38BDF8" :
    variant === 5 ? "#22C55E" :
    variant === 6 ? "#38BDF8" : "#8B7CFF";

  // Isometric voxel art
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Body: 3 stacked isometric cubes */}
      <g transform="translate(50, 20)">
        {/* Top face of top cube */}
        <polygon points="0,6 18,12 0,18 -18,12" fill={body} opacity="0.95" />
        <polygon points="0,18 18,12 18,30 0,36" fill={body} opacity="0.75" />
        <polygon points="0,18 -18,12 -18,30 0,36" fill={body} opacity="0.85" />
        {/* Middle cube */}
        <polygon points="0,30 18,36 0,42 -18,36" fill={body} opacity="0.95" />
        <polygon points="0,42 18,36 18,54 0,60" fill={body} opacity="0.75" />
        <polygon points="0,42 -18,36 -18,54 0,60" fill={body} opacity="0.85" />
        {/* Bottom cube */}
        <polygon points="0,54 18,60 0,66 -18,60" fill={body} opacity="0.95" />
        <polygon points="0,66 18,60 18,78 0,84" fill={body} opacity="0.75" />
        <polygon points="0,66 -18,60 -18,78 0,84" fill={body} opacity="0.85" />
        {/* Eyes on middle cube, right face */}
        <rect x="4" y="40" width="4" height="4" fill="#FFFFFF" rx="0.5" />
        <rect x="12" y="44" width="4" height="4" fill="#FFFFFF" rx="0.5" />
        <rect x="5" y="41.5" width="2" height="2" fill="#07080C" />
        <rect x="13" y="45.5" width="2" height="2" fill="#07080C" />
      </g>
      {/* Accent indicator (hat, stamp, badge, second pip) */}
      {variant === 2 && (
        <polygon points="50,18 68,24 50,30 32,24" fill={accent} opacity="0.95" />
      )}
      {variant === 4 && (
        <rect x="62" y="40" width="8" height="14" fill={accent} rx="1" opacity="0.9" />
      )}
      {variant === 5 && (
        <rect x="44" y="44" width="12" height="6" fill={accent} rx="1" opacity="0.9" />
      )}
      {variant === 6 && (
        <g transform="translate(72, 38)">
          <polygon points="0,6 12,10 0,14 -12,10" fill={accent} opacity="0.95" />
          <polygon points="0,14 12,10 12,22 0,26" fill={accent} opacity="0.75" />
          <polygon points="0,14 -12,10 -12,22 0,26" fill={accent} opacity="0.85" />
        </g>
      )}
      {variant === 3 && (
        <g transform="translate(70, 50)">
          <rect x="0" y="0" width="6" height="16" fill="#0D0F14" rx="1" />
          <circle cx="3" cy="4" r="2.5" fill={accent} />
        </g>
      )}
    </svg>
  );
}

// ===================================================================
// Main exported component
// height prop controls the canvas height (default 160px)
// ===================================================================
export function PipCharacter({
  variant,
  versionLabel,
  height = 160,
}: {
  variant: PipVariant;
  versionLabel?: string;
  height?: number;
}) {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Still checking WebGL — show SVG immediately (no "Loading..." stuck)
  if (hasWebGL === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height }}>
        <PipSVG variant={variant} size={height} />
      </div>
    );
  }

  // Fallback to SVG if no WebGL or reduced motion
  if (!hasWebGL || reducedMotion) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height }}>
        <PipSVG variant={variant} size={height} />
      </div>
    );
  }

  // 3D Canvas
  // Camera: orthographic, positioned to frame the ~2.5 unit tall model.
  // zoom=55 makes each unit ~55px. Model is ~2.5 units tall → ~137px.
  // With camera at [4,3,4] looking at [0,0,0], the model fills the frame.
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Canvas
        style={{ width: "100%", height: "100%" }}
        dpr={[1, 2]}
      >
        <OrthographicCamera makeDefault position={[4, 3, 4]} zoom={55} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 3]} intensity={0.6} />
        <Pip3D variant={variant} versionLabel={versionLabel} />
      </Canvas>
    </div>
  );
}
