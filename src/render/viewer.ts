import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CavityDef, CavityInstance, Design, FaceId } from '../model/types';
import type { Library } from '../model/library';
import { faceFrame, faceFromNormal, faceToWorld, worldToFace } from '../model/faces';
import { buildCavityObject } from './cavityMesh';

export interface PlacementRequest {
  def: CavityDef;
  rotation: number;
  /** Called with the face and face-local point when the user clicks a face. */
  onPlace: (face: FaceId, x: number, y: number) => void;
  /** Called while the pointer moves over a face, or with null when off the block. */
  onHover?: (hit: { face: FaceId; x: number; y: number } | null) => void;
  onCancel?: () => void;
}

/** Snap step for interactive placement, in design units. */
const SNAP = 0.5;

export class Viewer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private blockGroup = new THREE.Group();
  private cavityGroup = new THREE.Group();
  private previewGroup = new THREE.Group();
  private blockSolid: THREE.Mesh | null = null;
  private faceHighlight: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private downAt: [number, number] | null = null;
  private design: Design | null = null;
  private lib: Library | null = null;
  private placement: PlacementRequest | null = null;
  private previewFace: FaceId | null = null;
  private previewBase: THREE.Vector3 = new THREE.Vector3();
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
    this.scene.add(this.blockGroup, this.cavityGroup, this.previewGroup);

    const el = this.renderer.domElement;
    window.addEventListener('resize', () => this.resize());
    el.addEventListener('pointerdown', (e) => this.beginPick(e));
    el.addEventListener('pointerup', (e) => this.endPick(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerleave', () => this.hoverOff());
    el.addEventListener('contextmenu', (e) => { if (this.placement) { e.preventDefault(); this.cancelPlacement(); } });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.placement) this.cancelPlacement(); });
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

  private ndc(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  // ---- selection ----

  private beginPick(e: PointerEvent) {
    this.downAt = [e.clientX, e.clientY];
  }

  private endPick(e: PointerEvent) {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
    this.downAt = null;
    if (moved > 4) return; // it was an orbit drag, not a click
    if (e.button !== 0) return;
    if (this.placement) {
      const hit = this.hitFace(e);
      if (hit) {
        const req = this.placement;
        this.clearPlacement();
        req.onPlace(hit.face, hit.x, hit.y);
      }
      return;
    }
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hits = this.raycaster.intersectObjects(this.cavityGroup.children, true);
    const hit = hits.find((h) => h.object.userData.cavityId);
    this.onSelect(hit ? (hit.object.userData.cavityId as string) : null);
  }

  // ---- interactive placement ----

  /** Enter placement mode: the cavity follows the pointer over block faces until a click. */
  beginPlacement(req: PlacementRequest) {
    this.clearPlacement();
    this.placement = req;
    this.renderer.domElement.style.cursor = 'crosshair';
  }

  cancelPlacement() {
    const req = this.placement;
    this.clearPlacement();
    req?.onCancel?.();
  }

  get isPlacing(): boolean {
    return this.placement !== null;
  }

  private clearPlacement() {
    this.placement = null;
    this.previewFace = null;
    this.previewGroup.clear();
    if (this.faceHighlight) { this.blockGroup.remove(this.faceHighlight); this.faceHighlight = null; }
    this.renderer.domElement.style.cursor = '';
  }

  private hitFace(e: PointerEvent): { face: FaceId; x: number; y: number } | null {
    if (!this.blockSolid || !this.design) return null;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit = this.raycaster.intersectObject(this.blockSolid, false)[0];
    if (!hit || !hit.face) return null;
    const face = faceFromNormal([hit.face.normal.x, hit.face.normal.y, hit.face.normal.z]);
    if (!face) return null;
    const [x, y] = worldToFace(this.design.block, face, [hit.point.x, hit.point.y, hit.point.z]);
    const snap = (v: number) => Math.round(v / SNAP) * SNAP;
    return { face, x: snap(x), y: snap(y) };
  }

  private onMove(e: PointerEvent) {
    if (!this.placement || !this.design || !this.lib) return;
    const hit = this.hitFace(e);
    if (!hit) { this.hoverOff(); return; }
    if (hit.face !== this.previewFace) this.buildPreview(hit.face);
    const p = faceToWorld(this.design.block, hit.face, hit.x, hit.y);
    this.previewGroup.position.set(p[0] - this.previewBase.x, p[1] - this.previewBase.y, p[2] - this.previewBase.z);
    this.previewGroup.visible = true;
    this.placement.onHover?.(hit);
  }

  private hoverOff() {
    if (!this.placement) return;
    this.previewGroup.visible = false;
    this.placement.onHover?.(null);
  }

  /** Build the ghost cavity at the face origin once per face; moving it is then a translation. */
  private buildPreview(face: FaceId) {
    if (!this.placement || !this.design || !this.lib) return;
    this.previewFace = face;
    this.previewGroup.clear();
    const inst: CavityInstance = { id: '__preview', defId: this.placement.def.id, componentId: '', face, x: 0, y: 0, rotation: this.placement.rotation };
    const ghost = buildCavityObject(this.design, inst, this.lib, true);
    ghost.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'opacity' in m) { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }
    });
    this.previewGroup.add(ghost);
    this.previewBase.set(...faceToWorld(this.design.block, face, 0, 0));
    this.previewGroup.position.set(0, 0, 0);

    // Highlight the hovered face with a translucent sheet just above the surface.
    if (this.faceHighlight) this.blockGroup.remove(this.faceHighlight);
    const f = faceFrame(this.design.block, face);
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(f.uLength, f.vLength),
      new THREE.MeshBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    const centre = faceToWorld(this.design.block, face, f.uLength / 2, f.vLength / 2);
    sheet.position.set(centre[0] + f.n[0] * 0.1, centre[1] + f.n[1] * 0.1, centre[2] + f.n[2] * 0.1);
    sheet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...f.n));
    this.faceHighlight = sheet;
    this.blockGroup.add(sheet);
  }

  // ---- scene ----

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
    this.design = design;
    this.lib = lib;
    const { length: L, width: W, height: H } = design.block;
    const keepHighlight = this.faceHighlight;
    this.blockGroup.clear();
    const geo = new THREE.BoxGeometry(L, H, W);
    geo.translate(L / 2, H / 2, W / 2);
    this.blockSolid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xc9d1db, transparent: true, opacity: 0.28, roughness: 0.8, depthWrite: false,
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x222831 }));
    this.blockGroup.add(this.blockSolid, edges);
    const axes = new THREE.AxesHelper(Math.max(L, W, H) * 0.35);
    axes.position.set(0, 0, W);
    this.blockGroup.add(axes);
    if (keepHighlight) this.blockGroup.add(keepHighlight);

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
    const previewWasVisible = this.previewGroup.visible;
    this.previewGroup.visible = false;
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
    this.previewGroup.visible = previewWasVisible;
    return out;
  }
}
