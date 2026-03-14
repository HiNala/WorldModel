"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";

interface WorldViewerProps {
  splatUrl?: string | null;
  worldId?: string | null;
}

export function WorldViewer({ splatUrl, worldId }: WorldViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedForUrl, setLoadedForUrl] = useState<string | null>(null);
  const loading = splatUrl ? loadedForUrl !== splatUrl : false;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    let rotY = 0;
    let rotX = 0;
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

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
      rotY += (t.clientX - prevX) * 0.005;
      rotX += (t.clientY - prevY) * 0.005;
      rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX));
      camera.position.set(
        3 * Math.sin(rotY) * Math.cos(rotX),
        1.6 + 3 * Math.sin(rotX),
        3 * Math.cos(rotY) * Math.cos(rotX)
      );
      camera.lookAt(0, 1, 0);
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

    if (splatUrl) {
      queueMicrotask(() => setError(null));
      try {
        const url = splatUrl;
        const splat = new SplatMesh({
          url,
          onLoad: () => {
            setError(null);
            setLoadedForUrl(url);
          },
        });
        scene.add(splat);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load splat";
        queueMicrotask(() => {
          setError(msg);
          setLoadedForUrl(splatUrl);
        });
      }
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
  }, [splatUrl]);

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 rounded-xl bg-gray-900 p-6 text-red-400">
        <span className="text-2xl">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!splatUrl && worldId) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-gray-900 p-6">
        <p className="text-gray-400">View the generated world in Marble</p>
        <a
          href={`https://marble.worldlabs.ai/world/${worldId}`}
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
      {loading && splatUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/90">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
          <span className="text-sm text-gray-400">Loading 3D splat...</span>
        </div>
      )}
    </div>
  );
}
