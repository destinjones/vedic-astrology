import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Chart, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID } from '../data/constants';
import { ART, grahaArt } from '../data/art';
import { fromEngine } from '../engine/adapter';

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

import { useI18n } from '../i18n';
import type { Vocab } from '@vedic/i18n';
import type { PlanetPosition } from '../types/chart';

const skyName = (v: Vocab, p: PlanetPosition) => `${v.planets[p.id].name}${p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' ? ' ℞' : ''}`;

interface PlanetNode { id: PlanetId; group: THREE.Group; halo: THREE.Mesh; label: HTMLDivElement }

type Backdrop = 'art' | 'stars';
const BACKDROP_KEY = 'vedic.skyBackdrop';
const loadBackdrop = (): Backdrop => { try { return localStorage.getItem(BACKDROP_KEY) === 'stars' ? 'stars' : 'art'; } catch { return 'art'; } };

/** Unit direction for an ecliptic longitude/latitude in the wheel's frame. */
const onSphere = (lonDeg: number, latDeg: number, r: number) => {
  const a = THREE.MathUtils.degToRad(lonDeg), b = THREE.MathUtils.degToRad(latDeg);
  return new THREE.Vector3(r * Math.cos(b) * Math.cos(a), r * Math.sin(b), -r * Math.cos(b) * Math.sin(a));
};

/** Real stars and constellation figures on a sphere around the wheel, placed by sidereal longitude and ecliptic latitude. */
async function buildStarSphere(ayanamsaValue: number, jdUt: number): Promise<{ group: THREE.Group; labels: CSS2DObject[] }> {
  const { stars, constellations, starColour, ayanamsaAtJ2000 } = await import('@vedic/sky/stars');
  const ay = ayanamsaAtJ2000(ayanamsaValue, jdUt);
  const R = 140;
  const group = new THREE.Group();
  const list = stars(ay);
  const pos = new Float32Array(list.length * 3);
  const col = new Float32Array(list.length * 3);
  const size = new Float32Array(list.length);
  const c = new THREE.Color();
  list.forEach((st, i) => {
    onSphere(st.longitude, st.latitude, R).toArray(pos, i * 3);
    c.setStyle(starColour(st.bv), THREE.SRGBColorSpace).toArray(col, i * 3);
    size[i] = Math.max(1.4, 7.5 * Math.pow(10, -0.2 * (st.magnitude + 1)) + 1.2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { scale: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: 'attribute float size; uniform float scale; varying vec3 vColor; void main() { vColor = color; gl_PointSize = size * scale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, d)); }',
  });
  group.add(new THREE.Points(geo, mat));
  // constellation figures
  const segs: number[] = [];
  for (const k of constellations(ay)) for (const line of k.lines) for (let i = 1; i < line.length; i++) {
    segs.push(...onSphere(line[i - 1][0], line[i - 1][1], R * 0.999).toArray(), ...onSphere(line[i][0], line[i][1], R * 0.999).toArray());
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x6f7fc0, transparent: true, opacity: 0.32 })));
  // the ecliptic itself, where every graha travels
  const ecl = Array.from({ length: 181 }, (_, i) => onSphere(i * 2, 0, R * 0.998));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ecl), new THREE.LineBasicMaterial({ color: 0xe8b65a, transparent: true, opacity: 0.35 })));
  const labels = list.filter((st) => st.name).map((st) => {
    const el = document.createElement('div');
    el.className = 'star-label';
    el.textContent = st.name!;
    const o = new CSS2DObject(el);
    o.position.copy(onSphere(st.longitude, st.latitude, R));
    return o;
  });
  return { group, labels };
}

export default function SkyView({ chart: natal, selection, onSelect }: Props) {
  const [backdrop, setBackdrop] = useState<Backdrop>(loadBackdrop);
  const [tonight, setTonight] = useState(false);
  // "Sky tonight": the grahas as they stand now, seen from the chart's place
  const [nowChart, setNowChart] = useState<Chart | null>(null);
  useEffect(() => {
    if (!tonight || !natal.engineContext) { setNowChart(null); return; }
    const { engine } = natal.engineContext;
    const i = natal.input;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: i.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((p) => [p.type, p.value]));
    const input = { ...i, date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`, utcOffsetMinutes: undefined, calendar: undefined };
    try {
      const c = engine.computeChart({ date: input.date, time: input.time, place: { latitude: i.latitude, longitude: i.longitude, timezone: i.timezone } }, { ayanamsa: i.ayanamsa, dashaLevels: 1, strength: false, vargas: ['D1'] });
      setNowChart({ ...fromEngine(input, c), engineContext: { engine, chart: c } });
    } catch { setNowChart(null); }
  }, [tonight, natal]);
  const chart = tonight && nowChart ? nowChart : natal;

  const { t, v } = useI18n();
  const namesRef = useRef({ v, lagna: t('sky.lagna') });
  namesRef.current = { v, lagna: t('sky.lagna') };
  const ascLabelRef = useRef<HTMLDivElement | null>(null);
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
    if (backdrop === 'stars') controls.maxPolarAngle = Math.PI * 0.8;
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
          backdrop === 'stars' ? Promise.resolve(new THREE.Texture()) : texLoader.loadAsync(ART.skyEquirect),
          loader.loadAsync(ART.wheelModel),
        ]);
        if (disposed) return;
        sky.mapping = THREE.EquirectangularReflectionMapping;
        sky.colorSpace = THREE.SRGBColorSpace;
        if (backdrop === 'stars') {
          sky.dispose();
          scene.background = new THREE.Color(0x05060f);
          const jd = chart.engineContext?.chart.meta.jdUt ?? 2451545;
          const { group, labels: starLabels } = await buildStarSphere(chart.meta.ayanamsaValue, jd);
          if (disposed) return;
          scene.add(group);
          starLabels.forEach((o) => scene.add(o));
        } else {
          scene.background = sky;
        }
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
          label.textContent = skyName(namesRef.current.v, p);
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
        ascLabel.textContent = namesRef.current.lagna;
        ascLabelRef.current = ascLabel;
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
    const frame = () => {
      const dt = clock.getDelta();
      for (const s of spinners) s.rotation.y += dt * 0.25;
      for (const n of nodesRef.current) if (n.halo.visible) n.halo.rotation.z += dt * 0.8;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    // Only animate while the view is on screen. Drawing the 3D scene every frame while it is
    // scrolled away kept the CPU busy and, without a GPU, made the rest of the page unresponsive.
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { clock.getDelta(); renderer.setAnimationLoop(frame); }
      else renderer.setAnimationLoop(null);
    });
    io.observe(host);
    renderer.setAnimationLoop(frame);

    return () => {
      disposed = true;
      io.disconnect();
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
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      renderer.dispose();
      host.replaceChildren();
      nodesRef.current = [];
    };
  }, [chart, backdrop]);

  // reflect selection without rebuilding the scene
  useEffect(() => {
    const sel = selection?.kind === 'planet' ? selection.id : null;
    for (const n of nodesRef.current) {
      n.halo.visible = n.id === sel;
      n.label.classList.toggle('is-selected', n.id === sel);
    }
  }, [selection, status]);

  useEffect(() => { if (controlsRef.current) controlsRef.current.autoRotate = spin; }, [spin, status]);

  // relabel in place when the language changes
  useEffect(() => {
    for (const n of nodesRef.current) n.label.textContent = skyName(v, chart.planets.find((p) => p.id === n.id)!);
    if (ascLabelRef.current) ascLabelRef.current.textContent = t('sky.lagna');
  }, [v, t, chart, status]);

  return (
    <div className="sky-wrap">
      <div ref={hostRef} className="sky-host" />
      {status === 'loading' && <div className="sky-overlay"><div className="sky-spinner" />{t('sky.loading')}</div>}
      {status === 'error' && <div className="sky-overlay">{t('sky.noWebgl')}</div>}
      <div className="sky-controls">
        <button className="btn-ghost sm" onClick={() => setSpin((s) => !s)}>{spin ? t('sky.pause') : t('sky.rotate')}</button>
        <button className="btn-ghost sm" aria-pressed={backdrop === 'stars'} onClick={() => setBackdrop((b) => {
          const next = b === 'stars' ? 'art' : 'stars';
          try { localStorage.setItem(BACKDROP_KEY, next); } catch { /* ignore */ }
          return next;
        })} title="Swap the painted backdrop for the real stars and constellations">{backdrop === 'stars' ? 'Painted sky' : 'Real stars'}</button>
        {natal.engineContext && (
          <button className="btn-ghost sm" aria-pressed={tonight} onClick={() => setTonight((x) => !x)} title={`The grahas as they stand now, from ${natal.input.place}`}>
            {tonight ? 'Birth sky' : 'Sky tonight'}
          </button>
        )}
      </div>
      <p className="sky-note">
        {tonight && nowChart ? `The sky now from ${natal.input.place}: the lagna beam marks the eastern horizon. ` : ''}
        {backdrop === 'stars'
          ? 'Drag to orbit, scroll to zoom, click a graha. Stars brighter than magnitude 5 and the constellation figures stand at their real sidereal positions; the gold circle is the ecliptic.'
          : t('sky.note')}
      </p>
    </div>
  );
}
