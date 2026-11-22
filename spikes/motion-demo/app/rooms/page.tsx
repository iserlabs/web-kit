import { RoomPicker3D, type RoomVolume } from "@iserlabs/web-kit/motion";
import { scene } from "../scene";

const volumes: RoomVolume[] = [201, 202, 203, 301, 302, 303].map((n, i) => ({
  id: String(n),
  label: `Room ${n}`,
  sublabel: `Floor ${Math.floor(n / 100)}`,
  position: [(i % 3) * 1.55, Math.floor(i / 3) * 1.55, 0],
  size: [1.5, 1.5, 2.4],
  photos: [1, 2].map((k) => ({ src: scene(k === 1 ? "#cfc2a8" : "#a89878", "#6b5237", k + i % 3), alt: `Placeholder view of room ${n}, photo ${k}` })),
  summary: "Placeholder room.",
}));

export default function Page() {
  return <RoomPicker3D label="Rooms in the building" volumes={volumes} hint="Hover a room. Click to fly in." />;
}
