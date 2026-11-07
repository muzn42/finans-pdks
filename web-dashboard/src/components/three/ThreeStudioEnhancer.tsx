"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSpring } from "framer-motion";

/**
 * Three.js WebGL 3D Anahtar Teslim & Giriş Sahnesi Güçlendiricisi
 * - Mevcut 3D karakter, kırmızı SUV ve anahtar teslim karelerini bozmadan
 *   arkasında gerçek bir Three.js WebGL 3D partikül/ışık halkası oluşturur
 *   ve fare hareketini Emil Kowalski yay fiziğiyle (useSpring) 3D perspektif
 *   eğimine (rotateX / rotateY) dönüştürür.
 * - Performans kuralı (/animation-performance): React state üzerinden değil,
 *   doğrudan DOM ref.style.transform ve WebGL uniform üzerinden 60 FPS çalışır;
 *   #authView gizlendiğinde (in-app) WebGL döngüsü tamamen durdurulur.
 */
export function ThreeStudioEnhancer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const tiltX = useSpring(0, { stiffness: 120, damping: 20, mass: 0.8 });
  const tiltY = useSpring(0, { stiffness: 120, damping: 20, mass: 0.8 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 8;

    // Kurumsal Albayrak Kırmızısı (#E31E24) ve sıcak stüdyo 3D halkası + derinlik partikülleri
    const group = new THREE.Group();
    scene.add(group);

    const ringGeo = new THREE.TorusGeometry(2.65, 0.012, 16, 120);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe31e24,
      transparent: true,
      opacity: 0.16
    });
    const torus = new THREE.Mesh(ringGeo, ringMat);
    torus.rotation.x = Math.PI * 0.38;
    torus.position.set(-1.1, 0.15, -1.2);
    group.add(torus);

    const outerRingGeo = new THREE.RingGeometry(3.1, 3.13, 96);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x1c1d1f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.07
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI * 0.42;
    outerRing.position.set(-1.1, -1.55, -1.5);
    group.add(outerRing);

    const particleCount = 42;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.55) * 11;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3 - 1;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xe31e24,
      size: 0.055,
      transparent: true,
      opacity: 0.22
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    let rafId = 0;
    let isRunning = true;

    const onPointerMove = (e: PointerEvent) => {
      if (document.body.classList.contains("in-app")) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      tiltX.set(nx);
      tiltY.set(ny);
    };

    const onResize = () => {
      if (!renderer) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const animate = () => {
      if (!isRunning || !renderer) return;
      const inApp = document.body.classList.contains("in-app");
      if (inApp) {
        rafId = 0;
        return;
      }

      const tx = tiltX.get();
      const ty = tiltY.get();
      torus.rotation.z += 0.0035;
      outerRing.rotation.z -= 0.002;
      group.rotation.y = tx * 0.18;
      group.rotation.x = -ty * 0.12;
      particles.rotation.y += 0.0008;

      // 3D Anahtar ve SUV sahnesine hafif GPU-accelerated 3D parallax uygula
      const stageWrap = document.getElementById("landingStageWrap");
      if (stageWrap) {
        stageWrap.style.transform = `translate3d(${(tx * -7).toFixed(2)}px, ${(
          ty * -5
        ).toFixed(2)}px, 0)`;
      }

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    const bodyObs = new MutationObserver(() => {
      const inApp = document.body.classList.contains("in-app");
      if (!inApp && isRunning && rafId === 0) {
        rafId = window.requestAnimationFrame(animate);
      } else if (inApp && rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    });
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    rafId = window.requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      bodyObs.disconnect();
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      ringGeo.dispose();
      ringMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer?.forceContextLoss?.();
      renderer?.domElement?.remove();
      renderer?.dispose();
    };
  }, [tiltX, tiltY]);

  return (
    <div
      ref={mountRef}
      id="threeLoginWebgl"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden opacity-90"
    />
  );
}
