"use client";
import { useEffect, useRef, useState } from "react";
import { availableIncome, SIZE, type Building } from "@/lib/games/frenchie-town/state";
import type { Ghost, TownScene } from "./scene";
import styles from "./town.module.css";

export type SceneCommand = { id: number; type: "left" | "right" | "zoom-in" | "zoom-out" | "reset" | "happy"; dog?: string };
export function TownCanvas({ buildings, ghost, now, command, onCell, onBuilding, onDog }: {
  buildings: readonly Building[]; ghost: Ghost | null; now: number; command: SceneCommand | null;
  onCell: (cell: { x: number; z: number }) => void; onBuilding: (id: string) => void; onDog: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null), scene = useRef<TownScene | null>(null);
  const latest = useRef({ buildings, ghost, now, onCell, onBuilding, onDog });
  latest.current = { buildings, ghost, now, onCell, onBuilding, onDog };
  const [failed, setFailed] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    import("./scene").then(({ TownScene }) => {
      if (!alive || !element.current) return;
      try {
        const current = new TownScene(element.current, {
          onCell: (cell) => latest.current.onCell(cell), onBuilding: (id) => latest.current.onBuilding(id), onDog: (id) => latest.current.onDog(id), onError: () => { if (alive) setFailed(true); },
        });
        scene.current = current; current.setBuildings(latest.current.buildings); current.setGhost(latest.current.ghost); current.setIncome(latest.current.now); setReady(true);
      } catch { setFailed(true); }
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setBuildings(buildings); }, [buildings]);
  useEffect(() => { scene.current?.setGhost(ghost); }, [ghost]);
  useEffect(() => { scene.current?.setIncome(now); }, [now]);
  useEffect(() => {
    if (!command || !scene.current) return;
    if (command.type === "left") scene.current.turn(-1);
    else if (command.type === "right") scene.current.turn(1);
    else if (command.type === "zoom-in") scene.current.zoom(1);
    else if (command.type === "zoom-out") scene.current.zoom(-1);
    else if (command.type === "reset") scene.current.reset();
    else if (command.dog) scene.current.happyDog(command.dog);
  }, [command]);
  return <div ref={element} className={styles.scene} data-town-ready={ready && !failed ? "true" : "false"}>
    {!ready && !failed ? <div className={styles.loading}><span className={styles.loadingDog}>🐾</span><p>小さな街を準備しています…</p></div> : null}
    {failed ? <div className={styles.fallback}><p>3D表示を起動できませんでした。マスを選んで街づくりを続けられます。</p><div className={styles.fallbackGrid}>{Array.from({ length: SIZE * SIZE }, (_, i) => {
      const x = i % SIZE, z = Math.floor(i / SIZE), b = buildings.find((b) => b.x === x && b.z === z);
      return <button key={i} type="button" aria-label={`${x + 1}列${z + 1}行${b ? "の建物" : "の場所"}`} onClick={() => ghost ? onCell({ x, z }) : b ? onBuilding(b.id) : onCell({ x, z })}>{b ? availableIncome(b, now) ? "◉" : "⌂" : x === 4 || z === 4 ? "·" : ""}</button>;
    })}</div></div> : null}
  </div>;
}
