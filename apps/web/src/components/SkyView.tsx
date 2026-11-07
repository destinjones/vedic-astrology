import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Chart, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID } from '../data/constants';
import { ART, grahaArt } from '../data/art';

interface Props {
  chart: Chart;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}

/** Relative display size of each graha model (models are radius 1). */
const SIZE: Record<PlanetId, number> = {
  sun: 0.85, moon: 0.45, mars: 0.34, mercury: 0.28, jupiter: 0.62, venus: 0.38, saturn: 0.42, rahu: 0.36, ketu: 0.32,
};

/** Wheel convention: (r·cos(lon), h, −r·sin(lon)), lon in degrees */
const onWheel = (lonDeg: number, r: number, h: number) => {
  const a = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(r * Math.cos(a), h, -r * Math.sin(a));
};

interface PlanetNode { id: PlanetId; group: THREE.Group; halo: THREE.Mesh; label: HTMLDivElement }

export default function SkyView({ chart, selection, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<PlanetNode[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [spin, setSpin] = useState(true);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    setStatus('loading');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.domElement.className = 'sky-labels';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    camera.position.set(0, 13, 19);

    const controls = new OrbitControls(camera, labels.domElement);
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = true;
    controls.minDistance = 7;
    controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.PointLight(0xffe0b0, 260, 0, 1.6);
    sun.position.set(0, 4, 0);
    scene.add(sun);
    const key = new THREE.DirectionalLight(0xcfd8ff, 0.9);
    key.position.set(-8, 12, 10);
    scene.add(key);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    // portrait screens need the camera further back to fit the wheel
    if (camera.aspect < 0.9) camera.position.multiplyScalar(1.45);
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const spinners: THREE.Object3D[] = [];
    const nodes: PlanetNode[] = [];

    // lay grahas out above the rashi band; neighbours within 12° step outward/upward
    const sorted = [...chart.planets].sort((a, b) => a.longitude - b.longitude);
    const lane: Record<string, number> = {};
    let prev = -99, l = 0;
    for (const p of sorted) {
      l = p.longitude - prev < 12 ? (l + 1) % 3 : 0;
      lane[p.id] = l;
      prev = p.longitude;
    }

    (async () => {
      try {
        const [sky, wheel] = await Promise.all([
          texLoader.loadAsync(ART.skyEquirect),
          loader.loadAsync(ART.wheelModel),
        ]);
        if (disposed) return;
        sky.mapping = THREE.EquirectangularReflectionMapping;
        sky.colorSpace = THREE.SRGBColorSpace;
        scene.background = sky;
        scene.add(wheel.scene);

        const track = (ART.radii.grahaTrackInner + ART.radii.grahaTrackOuter) / 2;

        await Promise.all(chart.planets.map(async (p) => {
          const gltf = await loader.loadAsync(grahaArt(p.id).model);
          if (disposed) return;
          const L = lane[p.id];
          const r = 5.3 + L * 1.35;
          const h = 1.35 + L * 0.55 + (p.id === 'sun' ? 0.4 : 0);
          const group = new THREE.Group();
          group.position.copy(onWheel(p.longitude, r, h));
          const model = gltf.scene;
          model.scale.setScalar(SIZE[p.id]);
          model.userData.planet = p.id;
          model.traverse((o) => { o.userData.planet = p.id; });
          group.add(model);
          spinners.push(model);

          const glow = new THREE.Color(grahaArt(p.id).glow);
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(SIZE[p.id] * (p.id === 'saturn' ? 2.6 : 1.45), 0.035, 8, 64),
            new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.95 }),
          );
          halo.rotation.x = Math.PI / 2;
          halo.visible = false;
          group.add(halo);

          // exact-longitude tether down to the graha track
          const base = onWheel(p.longitude, track, 0.12);
          const tether = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([group.position.clone().setY(h - SIZE[p.id]), base]),
            new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: 0.7 }),
          );
          scene.add(tether);
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: glow }));
          dot.position.copy(base);
          scene.add(dot);

          const info = PLANET_BY_ID[p.id];
          const label = document.createElement('div');
          label.className = 'sky-label';
          label.style.setProperty('--c', info.color);
          label.textContent = `${info.name}${p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' ? ' ℞' : ''}`;
          label.addEventListener('pointerdown', (e) => e.stopPropagation());
          label.addEventListener('click', (e) => { e.stopPropagation(); onSelectRef.current({ kind: 'planet', id: p.id }); });
          const lab = new CSS2DObject(label);
          lab.position.set(0, SIZE[p.id] * (p.id === 'saturn' ? 1.2 : 1) + 0.45, 0);
          group.add(lab);

          scene.add(group);
          nodes.push({ id: p.id, group, halo, label });
        }));

        // Lagna beam at the rim
        const ascPos = onWheel(chart.ascendant.longitude, ART.radii.rim - 0.3, 0);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 4, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.85 }),
        );
        beam.position.copy(ascPos).setY(2);
        scene.add(beam);
        const ascLabel = document.createElement('div');
        ascLabel.className = 'sky-label sky-label-asc';
        ascLabel.textContent = 'Lagna';
        ascLabel.addEventListener('pointerdown', (e) => e.stopPropagation());
        ascLabel.addEventListener('click', (e) => { e.stopPropagation(); onSelectRef.current({ kind: 'asc' }); });
        const ascObj = new CSS2DObject(ascLabel);
        ascObj.position.copy(ascPos).setY(4.3);
        scene.add(ascObj);

        nodesRef.current = nodes;
        if (!disposed) setStatus('ready');
      } catch (err) {
        console.error('Sky view failed to load', err);
        if (!disposed) setStatus('error');
      }
    })();

    // click a planet model
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // was a drag
      const rect = labels.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(spinners, true).find((h) => h.object.userData.planet);
      if (hit) onSelectRef.current({ kind: 'planet', id: hit.object.userData.planet as PlanetId });
    };
    labels.domElement.addEventListener('pointerdown', onDown);
    labels.domElement.addEventListener('pointerup', onUp);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      for (const s of spinners) s.rotation.y += dt * 0.25;
      for (const n of nodesRef.current) if (n.halo.visible) n.halo.rotation.z += dt * 0.8;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      labels.domElement.removeEventListener('pointerdown', onDown);
      labels.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      (scene.background as THREE.Texture | null)?.dispose();
      renderer.dispose();
      host.replaceChildren();
      nodesRef.current = [];
    };
  }, [chart]);

  // reflect selection without rebuilding the scene
  useEffect(() => {
    const sel = selection?.kind === 'planet' ? selection.id : null;
    for (const n of nodesRef.current) {
      n.halo.visible = n.id === sel;
      n.label.classList.toggle('is-selected', n.id === sel);
    }
  }, [selection, status]);

  useEffect(() => { if (controlsRef.current) controlsRef.current.autoRotate = spin; }, [spin, status]);

  return (
    <div className="sky-wrap">
      <div ref={hostRef} className="sky-host" />
      {status === 'loading' && <div className="sky-overlay"><div className="sky-spinner" />Loading the grahas…</div>}
      {status === 'error' && <div className="sky-overlay">The 3D view needs WebGL, which this browser didn't provide.</div>}
      <div className="sky-controls">
        <button className="btn-ghost sm" onClick={() => setSpin((s) => !s)}>{spin ? 'Pause rotation' : 'Rotate'}</button>
      </div>
      <p className="sky-note">Drag to orbit, scroll to zoom, click a graha. Each graha's line touches the wheel at its exact sidereal longitude. The starry backdrop is artwork, not real star positions.</p>
    </div>
  );
}
