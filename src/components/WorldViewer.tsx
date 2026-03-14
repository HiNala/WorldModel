"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";

export interface WorldInfo {
  splatUrl: string | null;
  worldId: string;
  agentName?: string;
}

interface WorldViewerProps {
  splatUrl?: string | null;
  worldId?: string | null;
  /** Multiple worlds shown as a composite scene (spaced along X axis) */
  worlds?: WorldInfo[];
}

export function WorldViewer({ splatUrl, worldId, worlds: worldsProp }: WorldViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  // Normalize to worlds array for unified handling
  const worlds: WorldInfo[] = worldsProp?.length
    ? worldsProp
    : splatUrl || worldId
      ? [{ splatUrl: splatUrl ?? null, worldId: worldId ?? "" }]
      : [];

  const hasSplats = worlds.some((w) => w.splatUrl);
  const expectedSplats = worlds.filter((w) => w.splatUrl).length;
  const loading = hasSplats && expectedSplats > 0 && loadedCount < expectedSplats;

  useEffect(() => {
    if (!containerRef.current) return;
    setLoadedCount(0);

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 1000);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));
    container.appendChild(renderer.domElement);

    const orbit = { rotY: 0, rotX: 0 };
    const target = new THREE.Vector3(0, 1, 0);
    let radius = 8;
    const eyeHeight = 1.6;
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const updateCamera = () => {
      const dx = radius * Math.sin(orbit.rotY) * Math.cos(orbit.rotX);
      const dy = radius * Math.sin(orbit.rotX);
      const dz = radius * Math.cos(orbit.rotY) * Math.cos(orbit.rotX);
      camera.position.set(target.x + dx, target.y + eyeHeight + dy, target.z + dz);
      camera.lookAt(target);
    };

    controlsRef.current = {
      reset: () => {
        orbit.rotX = 0;
        orbit.rotY = 0;
        updateCamera();
      },
    };

    updateCamera();

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const t = "touches" in e ? e.touches[0] : e;
      prevX = t.clientX;
      prevY = t.clientY;
    };
    const onPointerUp = () => { isDragging = false; };
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const t = ("touches" in e ? e.touches[0] : e) as MouseEvent;
      orbit.rotY += (t.clientX - prevX) * 0.005;
      orbit.rotX += (t.clientY - prevY) * 0.005;
      orbit.rotX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, orbit.rotX));
      updateCamera();
      prevX = t.clientX;
      prevY = t.clientY;
    };

    const el = renderer.domElement;
    el.addEventListener("mousedown", onPointerDown as EventListener);
    el.addEventListener("touchstart", onPointerDown as EventListener, { passive: true });
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("mousemove", onPointerMove as EventListener);
    window.addEventListener("touchmove", onPointerMove as EventListener, { passive: true });

    const SPACING = 28;
    const splatsWithUrls = worlds.filter((w) => w.splatUrl) as { splatUrl: string; worldId: string; agentName?: string }[];
    const n = splatsWithUrls.length;
    const splatRefs: SplatMesh[] = [];

    const frameAllSplats = () => {
      if (splatRefs.length === 0) return;
      try {
        const unionBox = new THREE.Box3();
        splatRefs.forEach((splat) => {
          const box = splat.getBoundingBox(true);
          box.applyMatrix4(splat.matrixWorld);
          unionBox.union(box);
        });
        const center = new THREE.Vector3();
        unionBox.getCenter(center);
        target.copy(center);
        const size = new THREE.Vector3();
        unionBox.getSize(size);
        const diagonal = Math.sqrt(size.x ** 2 + size.y ** 2 + size.z ** 2);
        const fovRad = (camera.fov * Math.PI) / 180;
        radius = Math.max(4, (diagonal * 0.6) / Math.tan(fovRad / 2));
        updateCamera();
      } catch {
        // Bounding box not ready
      }
    };

    if (n > 0) {
      queueMicrotask(() => setError(null));
      splatsWithUrls.forEach((w, i) => {
        const offsetX = n === 1 ? 0 : (i - (n - 1) / 2) * SPACING;
        try {
          const splat = new SplatMesh({
            url: w.splatUrl,
            onLoad: () => {
              setError(null);
              splatRefs.push(splat);
              setLoadedCount((c) => c + 1);
              if (splatRefs.length === n) frameAllSplats();
            },
          });
          splat.position.set(offsetX, 0, 0);
          scene.add(splat);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to load splat";
          queueMicrotask(() => setError(msg));
        }
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("mousedown", onPointerDown as EventListener);
      el.removeEventListener("touchstart", onPointerDown as EventListener);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("mousemove", onPointerMove as EventListener);
      window.removeEventListener("touchmove", onPointerMove as EventListener);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [JSON.stringify(worlds.map((w) => ({ u: w.splatUrl, id: w.worldId })))]);

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 rounded-xl bg-gray-900 p-6 text-red-400">
        <span className="text-2xl">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  const firstWorldId = worlds[0]?.worldId ?? worldId;
  if (worlds.length > 0 && !hasSplats && firstWorldId) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-gray-900 p-6">
        <p className="text-gray-400">
          {worlds.length > 1 ? "View generated worlds in Marble" : "View the generated world in Marble"}
        </p>
        <a
          href={`https://marble.worldlabs.ai/world/${firstWorldId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
        >
          Open in Marble Viewer →
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-xl bg-gray-900">
      <div ref={containerRef} className="h-full w-full" />
      {worlds.length > 0 && !loading && (
        <button
          type="button"
          onClick={() => controlsRef.current?.reset()}
          className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/60 px-3 py-2 text-sm text-white/90 backdrop-blur-sm transition hover:bg-black/80"
          title="Reset camera view"
        >
          ⟲ Reset view
        </button>
      )}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/90">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
          <span className="text-sm text-gray-400">
            {expectedSplats > 1
              ? `Loading splats... ${loadedCount}/${expectedSplats}`
              : "Loading 3D splat..."}
          </span>
        </div>
      )}
    </div>
  );
}
