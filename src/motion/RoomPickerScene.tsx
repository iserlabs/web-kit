"use client";
/** The three.js half of RoomPicker3D. Only ever loaded through a dynamic import. */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, type Mesh, type MeshStandardMaterial, Vector3 } from "three";
import { FOV_DEG, overviewPose, type Pose, type RoomVolume, roomPose } from "./room-geometry";

export interface SceneProps {
  volumes: RoomVolume[];
  hoverId: string | null;
  activeId: string | null;
  reduced: boolean;
  onHover: (id: string | null, x: number, y: number) => void;
  onPick: (id: string) => void;
  onFlightDone: (id: string | null) => void;
  onReady: () => void;
}

function VolumeMesh({
  v,
  hot,
  onHover,
  onPick,
}: {
  v: RoomVolume;
  hot: boolean;
  onHover: SceneProps["onHover"];
  onPick: SceneProps["onPick"];
}) {
  const mesh = useRef<Mesh>(null);
  const level = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const geo = useMemo(() => new BoxGeometry(...v.size), [v.size]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => {
    const target = hot ? 1 : 0;
    const d = target - level.current;
    if (Math.abs(d) < 0.002) return;
    level.current += d * 0.2;
    const m = mesh.current?.material as MeshStandardMaterial | undefined;
    if (m) {
      m.emissiveIntensity = level.current * 0.6;
      m.opacity = 0.78 + level.current * 0.2;
    }
    invalidate();
  });
  return (
    <group position={[...v.position]}>
      <mesh
        ref={mesh}
        geometry={geo}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(v.id, e.clientX, e.clientY);
        }}
        onPointerOut={() => onHover(null, 0, 0)}
        onClick={(e) => {
          e.stopPropagation();
          onPick(v.id);
        }}
      >
        <meshStandardMaterial
          color={v.color ?? "#d9c7a8"}
          emissive="#e7a14e"
          emissiveIntensity={0}
          transparent
          opacity={0.78}
          roughness={0.9}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color="#8a6f4d" transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

function Rig({
  volumes,
  activeId,
  reduced,
  onFlightDone,
  onReady,
}: Pick<SceneProps, "volumes" | "activeId" | "reduced" | "onFlightDone" | "onReady">) {
  const { camera, size, invalidate } = useThree();
  const state = useRef({ px: 0, py: 0, pz: 30, tx: 0, ty: 0, tz: 0 });
  const swaying = useRef(true);
  const first = useRef(true);
  const look = useMemo(() => new Vector3(), []);
  const aspect = size.width / Math.max(1, size.height);

  const poseFor = (id: string | null): Pose => {
    const v = id ? volumes.find((x) => x.id === id) : undefined;
    return v ? roomPose(v, aspect) : overviewPose(volumes, aspect);
  };
  const apply = (t: number) => {
    const s = state.current;
    const amp = swaying.current && !reduced ? 1 : 0;
    const ang = amp * Math.sin(t * 0.00021) * 0.14;
    const dx = s.px - s.tx;
    const dz = s.pz - s.tz;
    const c = Math.cos(ang);
    const n = Math.sin(ang);
    camera.position.set(
      s.tx + dx * c + dz * n,
      s.py + amp * Math.sin(t * 0.00033) * 0.12,
      s.tz - dx * n + dz * c,
    );
    look.set(s.tx, s.ty, s.tz);
    camera.lookAt(look);
  };

  useEffect(() => {
    let dead = false;
    const p = poseFor(activeId);
    const to = {
      px: p.position[0],
      py: p.position[1],
      pz: p.position[2],
      tx: p.target[0],
      ty: p.target[1],
      tz: p.target[2],
    };
    swaying.current = activeId === null;
    if (reduced || first.current) {
      first.current = false;
      Object.assign(state.current, to);
      apply(0);
      invalidate();
      onReady();
      if (activeId !== null) onFlightDone(activeId);
      return;
    }
    import("gsap").then(({ gsap }) => {
      if (dead) return;
      gsap.killTweensOf(state.current);
      gsap.to(state.current, {
        ...to,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
          apply(performance.now());
          invalidate();
        },
        onComplete: () => onFlightDone(activeId),
      });
      onReady();
    });
    return () => {
      dead = true;
    };
  }, [activeId, aspect, reduced, volumes]);

  useFrame(({ clock }) => {
    if (swaying.current && !reduced && !document.hidden) {
      apply(clock.elapsedTime * 1000);
      invalidate();
    }
  });
  return null;
}

export default function RoomPickerScene(props: SceneProps) {
  const { volumes, hoverId } = props;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: FOV_DEG, near: 0.1, far: 300 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <hemisphereLight args={["#e2e8f5", "#9a7a62", 1.5]} />
      <directionalLight color="#fff0d8" intensity={2} position={[-4, 12, 24]} />
      <group>
        {volumes.map((v) => (
          <VolumeMesh
            key={v.id}
            v={v}
            hot={hoverId === v.id}
            onHover={props.onHover}
            onPick={props.onPick}
          />
        ))}
      </group>
      <Rig
        volumes={volumes}
        activeId={props.activeId}
        reduced={props.reduced}
        onFlightDone={props.onFlightDone}
        onReady={props.onReady}
      />
    </Canvas>
  );
}
