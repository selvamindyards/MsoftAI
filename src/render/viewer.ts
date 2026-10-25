import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Design } from '../model/types';
import type { Library } from '../model/library';
import { buildCavityObject } from './cavityMesh';

export class Viewer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private blockGroup = new THREE.Group();
  private cavityGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private downAt: [number, number] | null = null;
  onSelect: (cavityId: string | null) => void = () => {};

  constructor(private host: HTMLElement) {
    this.scene.background = new THREE.Color(0xf3f5f8);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(300, 500, 400);
    this.scene.add(sun);
    this.scene.add(this.blockGroup, this.cavityGroup);

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.beginPick(e));
    this.renderer.domElement.addEventListener('pointerup', (e) => this.endPick(e));
    this.resize();
    this.animate();
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private beginPick(e: PointerEvent) {
    this.downAt = [e.clientX, e.clientY];
  }

  private endPick(e: PointerEvent) {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
    this.downAt = null;
    if (moved > 4) return; // it was an orbit drag, not a click
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.cavityGroup.children, true);
    const hit = hits.find((h) => h.object.userData.cavityId);
    this.onSelect(hit ? (hit.object.userData.cavityId as string) : null);
  }

  frameBlock(design: Design) {
    const { length: L, width: W, height: H } = design.block;
    const diag = Math.hypot(L, W, H);
    this.controls.target.set(L / 2, H / 2, W / 2);
    this.camera.position.set(L / 2 + diag * 0.9, H / 2 + diag * 0.7, W / 2 + diag * 1.1);
    this.camera.near = diag / 100;
    this.camera.far = diag * 20;
    this.camera.updateProjectionMatrix();
  }

  update(design: Design, lib: Library, selectedId: string | null) {
    const { length: L, width: W, height: H } = design.block;
    this.blockGroup.clear();
    const geo = new THREE.BoxGeometry(L, H, W);
    geo.translate(L / 2, H / 2, W / 2);
    const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xc9d1db, transparent: true, opacity: 0.28, roughness: 0.8, depthWrite: false,
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x222831 }));
    this.blockGroup.add(solid, edges);
    const axes = new THREE.AxesHelper(Math.max(L, W, H) * 0.35);
    axes.position.set(0, 0, W);
    this.blockGroup.add(axes);

    this.cavityGroup.clear();
    for (const inst of design.cavities) {
      this.cavityGroup.add(buildCavityObject(design, inst, lib, inst.id === selectedId));
    }
  }

  /** Render six orthographic face views to data URLs for the drawing page. */
  snapshotFaces(design: Design): { face: string; url: string }[] {
    const { length: L, width: W, height: H } = design.block;
    const far = Math.max(L, W, H) * 5;
    const views: { face: string; pos: [number, number, number]; up: [number, number, number] }[] = [
      { face: 'A Top', pos: [L / 2, H + far, W / 2], up: [0, 0, -1] },
      { face: 'B Front', pos: [L / 2, H / 2, W + far], up: [0, 1, 0] },
      { face: 'C Bottom', pos: [L / 2, -far, W / 2], up: [0, 0, 1] },
      { face: 'D Left', pos: [-far, H / 2, W / 2], up: [0, 1, 0] },
      { face: 'E Right', pos: [L + far, H / 2, W / 2], up: [0, 1, 0] },
      { face: 'F Back', pos: [L / 2, H / 2, -far], up: [0, 1, 0] },
    ];
    const size = Math.max(L, W, H) * 0.6;
    const cam = new THREE.OrthographicCamera(-size, size, size, -size, 1, far * 3);
    const out: { face: string; url: string }[] = [];
    const prev = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(900, 900, false);
    for (const v of views) {
      cam.position.set(...v.pos);
      cam.up.set(...v.up);
      cam.lookAt(L / 2, H / 2, W / 2);
      cam.updateProjectionMatrix();
      this.renderer.render(this.scene, cam);
      out.push({ face: v.face, url: this.renderer.domElement.toDataURL('image/png') });
    }
    this.renderer.setSize(prev.x, prev.y, false);
    return out;
  }
}
