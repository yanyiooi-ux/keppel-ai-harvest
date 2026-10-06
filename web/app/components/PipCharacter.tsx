"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

// --- Pip: a voxel pill character built from box meshes ---
// No image files, no model downloads. Just box shapes.

const CUBE = 0.5; // size of each voxel cube

// Voxel positions for the pill body (a blocky capsule)
const BODY_VOXELS: [number, number, number][] = [
  // Top cap (3x3x1)
  ...[-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => [x, y, 1] as [number, number, number])),
  // Middle rows (3x3x2)
  ...[-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => [[x, y, 0] as [number, number, number], [x, y, -1] as [number, number, number]])),
  // Bottom cap (3x3x1)
  ...[-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => [x, y, -2] as [number, number, number])),
];

// Eyes (two small cubes on the front face, z=1.5)
const EYES: [number, number, number][] = [
  [-0.5, 0.3, 0.75],
  [0.5, 0.3, 0.75],
];

// Hard hat (yellow) - a single wider voxel on top
const HARD_HAT: [number, number, number] = [0, 1.2, 0];

// Stamp (held to the side)
const STAMP: [number, number, number] = [1.5, 0, 0.5];

// Notebook (held to the side)
const NOTEBOOK: [number, number, number] = [1.5, -0.2, 0.5];

// Badge (on the chest, flips version)
const BADGE_POS: [number, number, number] = [0, 0, 0.76];

type PipProps = {
  variant: 1 | 2 | 3 | 4 | 5 | 6 | "happy" | "worried" | "stop";
  versionLabel?: string; // for variant 5
};

function VoxelGroup({
  positions,
  color,
  scale = 1,
}: {
  positions: [number, number, number][];
  color: string;
  scale?: number;
}) {
  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos} scale={scale * CUBE}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

function Pip3D({ variant, versionLabel = "v1.0" }: PipProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoverY, setHoverY] = useState(0);

  // Gentle hover bob, can be interrupted (animate from where it is now)
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const targetY = Math.sin(t * 2) * 0.05;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      0.1
    );
    setHoverY(groupRef.current.position.y);
  });

  const bodyColor = "#8B7CFF";
  const hatColor = "#F59E0B"; // amber for hard hat
  const eyeColor = "#FFFFFF";
  const stampColor = "#38BDF8";
  const notebookColor = "#1A1D23";

  // Traffic light for variant 3
  const lightColor =
    variant === 3
      ? variant === "stop" as any
        ? "#EF4444"
        : "#F59E0B"
      : null;

  return (
    <group ref={groupRef}>
      {/* Body */}
      <VoxelGroup positions={BODY_VOXELS} color={bodyColor} />

      {/* Eyes */}
      <VoxelGroup positions={EYES} color={eyeColor} scale={0.6} />

      {/* Pupils (dark) */}
      {EYES.map((pos, i) => (
        <mesh key={`pupil-${i}`} position={[pos[0], pos[1], pos[2] + 0.08]} scale={0.3 * CUBE}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#07080C" />
        </mesh>
      ))}

      {/* Hard hat for variant 2 (daily use) */}
      {variant === 2 && (
        <mesh position={HARD_HAT} scale={CUBE * 1.4}>
          <boxGeometry args={[1, 0.5, 1]} />
          <meshStandardMaterial color={hatColor} />
        </mesh>
      )}

      {/* Notebook for variant 1 (capture) */}
      {variant === 1 && (
        <mesh position={NOTEBOOK} scale={[CUBE * 0.8, CUBE * 1.2, CUBE * 0.3]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={notebookColor} />
        </mesh>
      )}

      {/* Traffic light for variant 3 (safety) */}
      {variant === 3 && (
        <mesh position={[0.8, 0.8, 0]} scale={CUBE * 0.8}>
          <boxGeometry args={[0.5, 1.5, 0.5]} />
          <meshStandardMaterial color="#0D0F14" />
        </mesh>
      )}
      {variant === 3 && (
        <mesh position={[0.8, 1.1, 0.15]} scale={CUBE * 0.3}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial
            color={
              variant === "stop" as any ? "#EF4444" : "#F59E0B"
            }
            emissive={
              variant === "stop" as any ? "#EF4444" : "#F59E0B"
            }
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* Big stamp for variant 4 (decide) */}
      {variant === 4 && (
        <mesh position={STAMP} scale={[CUBE * 0.6, CUBE * 1.5, CUBE * 0.6]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={stampColor} />
        </mesh>
      )}

      {/* Badge for variant 5 (learn) - version flip */}
      {variant === 5 && (
        <mesh position={BADGE_POS} scale={[CUBE * 1.2, CUBE * 0.7, CUBE * 0.2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={versionLabel === "v1.1" ? "#22C55E" : "#8B7CFF"}
            emissive={versionLabel === "v1.1" ? "#22C55E" : "#8B7CFF"}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Second Pip trail for variant 6 (reuse) */}
      {variant === 6 && (
        <group position={[1.8, 0, -0.5]}>
          <VoxelGroup positions={BODY_VOXELS} color="#38BDF8" />
          <VoxelGroup positions={EYES} color={eyeColor} scale={0.6} />
          {EYES.map((pos, i) => (
            <mesh key={`pupil2-${i}`} position={[pos[0] + 1.8, pos[1], pos[2] - 0.5 + 0.08]} scale={0.3 * CUBE}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#07080C" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// --- SVG fallback for no-WebGL or reduced motion ---
function PipSVG({ variant }: PipProps) {
  // A simple isometric voxel-style SVG
  const bodyColor = "#8B7CFF";
  const eyeColor = "#FFFFFF";
  const accent =
    variant === 2 ? "#F59E0B" :
    variant === 3 ? "#EF4444" :
    variant === 4 ? "#38BDF8" :
    variant === 5 ? "#22C55E" :
    variant === 6 ? "#38BDF8" :
    "#8B7CFF";

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      {/* Body: stacked isometric cubes */}
      <g transform="translate(60, 30)">
        {/* Top face */}
        <polygon points="0,-12 20,0 0,12 -20,0" fill={bodyColor} opacity="0.9" />
        {/* Left face */}
        <polygon points="-20,0 0,12 0,40 -20,28" fill={bodyColor} opacity="0.7" />
        {/* Right face */}
        <polygon points="20,0 0,12 0,40 20,28" fill={bodyColor} opacity="0.8" />
        {/* Eyes */}
        <rect x="-8" y="14" width="5" height="5" fill={eyeColor} rx="1" />
        <rect x="3" y="14" width="5" height="5" fill={eyeColor} rx="1" />
        {/* Pupils */}
        <rect x="-6" y="16" width="2" height="2" fill="#07080C" />
        <rect x="5" y="16" width="2" height="2" fill="#07080C" />
      </g>
      {/* Accent indicator */}
      <circle cx="85" cy="45" r="6" fill={accent} opacity="0.8" />
    </svg>
  );
}

// --- Main exported component ---
export function PipCharacter(props: PipProps) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }

    // Check reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fallback to SVG if no WebGL or reduced motion
  if (!hasWebGL || reducedMotion) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <PipSVG {...props} />
      </div>
    );
  }

  return (
    <Canvas style={{ width: "100%", height: "200px" }}>
      <OrthographicCamera makeDefault position={[3, 3, 3]} zoom={40} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Pip3D {...props} />
    </Canvas>
  );
}
