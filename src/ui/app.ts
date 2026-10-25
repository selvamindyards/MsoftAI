import type { CavityDef, CavityInstance, Design, FaceId, Units } from '../model/types';
import { FACES } from '../model/types';
import { FACE_LABEL, faceFrame } from '../model/faces';
import { addCavity, deserialize, newDesign, nextComponentId, removeCavity, serialize, setBlock } from '../model/design';
import type { Library } from '../model/library';
import type { CloudDesigns, DesignSummary } from '../cloud/designs';
import { Viewer } from '../render/viewer';

const STORAGE_KEY = 'msoftai.design';
const ROTATIONS = [0, 90, 180, 270];

type Attrs = Record<string, string>;

/** Signed-in user context: account email, cloud design storage, and sign-out. */
export interface Account {
  email: string;
  cloud: CloudDesigns;
  signOut: () => Promise<void>;
}

export class App {
  design: Design;
  selectedId: string | null = null;
  private viewer: Viewer;
  private panel: HTMLElement;
  private status: HTMLElement;
  private insertState = { library: '', defId: 0, face: 'top' as FaceId, x: 50, y: 50, rotation: 0, componentId: '' };
  private cloudList: DesignSummary[] = [];
  private cloudBusy = '';

  constructor(private lib: Library, panel: HTMLElement, viewport: HTMLElement, private account?: Account) {
    this.panel = panel;
    this.viewer = new Viewer(viewport);
    this.status = this.el('div', { class: 'status' });
    viewport.appendChild(this.status);
    viewport.appendChild(this.el('div', { id: 'drawing' }));

    this.design = this.restore() ?? newDesign('Manifold 1');
    this.viewer.onSelect = (id) => { this.selectedId = id; this.refresh(); };
    this.viewer.frameBlock(this.design);
    this.refresh();
    void this.refreshCloudList();
  }

  private async refreshCloudList() {
    if (!this.account) return;
    try {
      this.cloudList = await this.account.cloud.list();
    } catch (e) {
      this.cloudBusy = `Cloud error: ${(e as Error).message}`;
    }
    this.renderPanel();
  }

  private async cloudSave() {
    if (!this.account) return;
    this.cloudBusy = 'Saving...';
    this.renderPanel();
    try {
      await this.account.cloud.save(this.design);
      this.cloudBusy = `Saved "${this.design.name}" to your account.`;
      this.persist();
    } catch (e) {
      this.cloudBusy = `Save failed: ${(e as Error).message}`;
    }
    await this.refreshCloudList();
  }

  private async cloudOpen(id: string) {
    if (!this.account) return;
    this.cloudBusy = 'Opening...';
    this.renderPanel();
    try {
      this.design = await this.account.cloud.load(id);
      this.selectedId = null;
      this.viewer.frameBlock(this.design);
      this.cloudBusy = '';
      this.refresh();
    } catch (e) {
      this.cloudBusy = `Open failed: ${(e as Error).message}`;
      this.renderPanel();
    }
  }

  private async cloudDelete(id: string, name: string) {
    if (!this.account || !confirm(`Delete "${name}" from your account? This cannot be undone.`)) return;
    try {
      await this.account.cloud.remove(id);
      if (this.design.id === id) delete this.design.id;
      this.cloudBusy = `Deleted "${name}".`;
    } catch (e) {
      this.cloudBusy = `Delete failed: ${(e as Error).message}`;
    }
    await this.refreshCloudList();
  }

  private restore(): Design | null {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      return t ? deserialize(t) : null;
    } catch {
      return null;
    }
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, serialize(this.design)); } catch { /* storage unavailable */ }
  }

  refresh() {
    this.viewer.update(this.design, this.lib, this.selectedId);
    this.persist();
    this.renderPanel();
    const d = this.design;
    if (this.viewer.isPlacing) return; // placement mode owns the status line
    const sel = d.cavities.find((c) => c.id === this.selectedId);
    this.status.textContent = sel
      ? `${sel.componentId}: ${this.lib.get(sel.defId)?.name ?? '?'} on ${FACE_LABEL[sel.face]} at X ${sel.x} Y ${sel.y} ${d.units}`
      : `${d.name} | ${d.block.length} x ${d.block.width} x ${d.block.height} ${d.units} | ${d.cavities.length} cavities | click a cavity to select, drag to orbit`;
  }

  /** Interactive placement: hover a face, the cavity follows the pointer, click to confirm. */
  private startPlacement(def: CavityDef, rotation: number, label: string, onPlace: (face: FaceId, x: number, y: number) => void) {
    const idle = `${label}: hover a face of the block, click to place. Right-click or Esc to cancel.`;
    this.status.textContent = idle;
    this.viewer.beginPlacement({
      def,
      rotation,
      onHover: (hit) => {
        this.status.textContent = hit
          ? `${label} on ${FACE_LABEL[hit.face]} at X ${hit.x} Y ${hit.y} ${this.design.units}. Click to place, Esc to cancel.`
          : idle;
      },
      onPlace: (face, x, y) => { onPlace(face, x, y); this.refresh(); },
      onCancel: () => this.refresh(),
    });
  }

  // ---- small DOM helpers ----

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
  }

  private row(label: string, control: HTMLElement) {
    return this.el('div', { class: 'row' }, this.el('label', {}, label), control);
  }

  private num(value: number, onChange: (v: number) => void, step = '1') {
    const i = this.el('input', { type: 'number', step, value: String(value) });
    i.onchange = () => onChange(parseFloat(i.value) || 0);
    return i;
  }

  private select(options: { value: string; label: string }[], value: string, onChange: (v: string) => void) {
    const s = this.el('select');
    for (const o of options) s.append(this.el('option', { value: o.value }, o.label));
    s.value = value;
    s.onchange = () => onChange(s.value);
    return s;
  }

  private section(title: string, open: boolean, ...body: Node[]) {
    return this.el('details', open ? { open: '' } : {}, this.el('summary', {}, title), this.el('div', { class: 'body' }, ...body));
  }

  private rotationSelect(value: number, onChange: (v: number) => void) {
    return this.select(ROTATIONS.map((r) => ({ value: String(r), label: `${r} deg` })), String(value), (v) => onChange(Number(v)));
  }

  private faceSelect(value: FaceId, onChange: (f: FaceId) => void) {
    return this.select(FACES.map((f) => ({ value: f, label: FACE_LABEL[f] })), value, (v) => onChange(v as FaceId));
  }

  // ---- panel ----

  renderPanel() {
    const openState = new Map<string, boolean>();
    this.panel.querySelectorAll('details').forEach((x) => openState.set(x.querySelector('summary')?.textContent ?? '', x.open));
    const isOpen = (title: string) => openState.get(title) ?? true;

    this.panel.replaceChildren();
    this.panel.append(this.el('h1', {}, 'MsoftAI', this.el('small', {}, 'Manifold Designer')));
    if (this.account) this.panel.append(this.accountBar());
    this.panel.append(this.fileSection(isOpen('File')));
    if (this.account) this.panel.append(this.cloudSection(isOpen('My designs')));
    this.panel.append(this.blockSection(isOpen('Block')));
    this.panel.append(this.insertSection(isOpen('Insert')));
    const title = `Cavities (${this.design.cavities.length})`;
    this.panel.append(this.cavitiesSection(title, isOpen(title)));
  }

  private accountBar() {
    const out = this.el('button', { class: 'link' }, 'Sign out');
    out.onclick = () => void this.account?.signOut();
    return this.el('div', { class: 'account' }, this.el('span', {}, this.account?.email ?? ''), out);
  }

  private cloudSection(open: boolean) {
    const save = this.el('button', { class: 'primary' }, this.design.id ? 'Save to account' : 'Save to account as new');
    save.onclick = () => void this.cloudSave();
    const tbody = this.el('tbody');
    for (const d of this.cloudList) {
      const open = this.el('button', { class: 'link' }, d.name);
      open.onclick = () => void this.cloudOpen(d.id);
      const del = this.el('button', { class: 'link danger' }, 'x');
      del.title = 'Delete';
      del.onclick = () => void this.cloudDelete(d.id, d.name);
      const when = new Date(d.updated_at).toLocaleString();
      tbody.append(this.el('tr', d.id === this.design.id ? { class: 'sel' } : {},
        this.el('td', {}, open), this.el('td', {}, when), this.el('td', { style: 'width:28px' }, del)));
    }
    const table = this.el('table', {}, tbody);
    return this.section('My designs', open,
      this.el('div', { class: 'actions' }, save),
      this.el('div', { class: 'hint' }, this.cloudBusy || (this.cloudList.length ? 'Click a design to open it.' : 'No designs saved to your account yet.')),
      table);
  }

  private fileSection(open: boolean) {
    const d = this.design;
    const name = this.el('input', { value: d.name });
    name.onchange = () => { d.name = name.value; this.refresh(); };

    const btnNew = this.el('button', {}, 'New');
    btnNew.onclick = () => {
      if (!confirm('Start a new design? The current one is only kept in this browser unless downloaded.')) return;
      this.design = newDesign('Manifold 1');
      this.selectedId = null;
      this.viewer.frameBlock(this.design);
      this.refresh();
    };

    const btnDown = this.el('button', {}, 'Download JSON');
    btnDown.onclick = () => {
      const url = URL.createObjectURL(new Blob([serialize(d)], { type: 'application/json' }));
      this.el('a', { href: url, download: `${d.name.replace(/\s+/g, '_')}.msoftai.json` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const btnDraw = this.el('button', {}, 'Six views');
    btnDraw.onclick = () => this.showDrawing();

    const file = this.el('input', { type: 'file', accept: '.json,application/json' });
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        this.design = deserialize(await f.text());
        this.selectedId = null;
        this.viewer.frameBlock(this.design);
        this.refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    };

    return this.section('File', open,
      this.row('Name', name),
      this.el('div', { class: 'actions' }, btnNew, btnDown, btnDraw),
      this.row('Open', file));
  }

  private blockSection(open: boolean) {
    const d = this.design;
    const units = this.select([{ value: 'mm', label: 'mm' }, { value: 'in', label: 'inch' }], d.units, (v) => { d.units = v as Units; this.refresh(); });
    const mat = this.el('input', { value: d.block.material });
    mat.onchange = () => { setBlock(d, { material: mat.value }); this.refresh(); };
    const dim = (key: 'length' | 'width' | 'height') =>
      this.num(d.block[key], (v) => { setBlock(d, { [key]: v }); this.viewer.frameBlock(d); this.refresh(); });
    const dims = this.el('div', { class: 'row3' }, dim('length'), dim('width'), dim('height'));
    return this.section('Block', open,
      this.row('Units', units),
      this.row('Material', mat),
      this.row('L x W x H', dims),
      this.el('div', { class: 'hint' }, 'Length along X, width along Z, height along Y (up).'));
  }

  private insertSection(open: boolean) {
    const d = this.design;
    const st = this.insertState;
    if (!st.library) st.library = this.lib.libraries[0] ?? '';
    const cavs = this.lib.inLibrary(st.library);
    if (!cavs.some((c) => c.id === st.defId)) st.defId = cavs[0]?.id ?? 0;
    const def = this.lib.get(st.defId);

    const libSel = this.select(this.lib.libraries.map((l) => ({ value: l, label: l })), st.library, (v) => { st.library = v; st.defId = 0; this.renderPanel(); });
    const cavSel = this.select(
      cavs.map((c) => ({ value: String(c.id), label: `${c.name}${c.isFootprint ? ' [footprint]' : ''}` })),
      String(st.defId), (v) => { st.defId = Number(v); this.renderPanel(); });
    const faceSel = this.faceSelect(st.face, (f) => { st.face = f; this.renderPanel(); });
    const frame = faceFrame(d.block, st.face);
    const xy = this.el('div', { class: 'row3' },
      this.num(st.x, (v) => { st.x = v; }, '0.1'),
      this.num(st.y, (v) => { st.y = v; }, '0.1'),
      this.rotationSelect(st.rotation, (v) => { st.rotation = v; }));

    const prefix = def ? ({ Port: 'P', BH: 'BH', DH: 'D', LP: 'LP' }[def.type] ?? 'V') : 'C';
    const cid = this.el('input', { value: st.componentId || nextComponentId(d, prefix), placeholder: 'Component ID' });
    cid.onchange = () => { st.componentId = cid.value; };

    const place = (face: FaceId, x: number, y: number) => {
      if (!def) return;
      const inst = addCavity(d, def.id, face, x, y, cid.value || nextComponentId(d, prefix), st.rotation);
      st.componentId = '';
      this.selectedId = inst.id;
    };
    const btnInsert = this.el('button', { class: 'primary' }, 'Insert on model');
    btnInsert.onclick = () => {
      if (!def) return;
      this.startPlacement(def, st.rotation, `Placing ${cid.value || nextComponentId(d, prefix)} (${def.name})`, place);
    };
    const btnTyped = this.el('button', {}, 'Insert at X, Y');
    btnTyped.onclick = () => { place(st.face, st.x, st.y); this.refresh(); };

    const info = def
      ? `${def.type} | ${def.steps.length} steps | dia ${def.steps[0]?.diameter ?? '?'} | ${def.ports.length} ports${def.comments ? ' | ' + def.comments : ''}`
      : '';
    return this.section('Insert', open,
      this.row('Library', libSel),
      this.row('Cavity', cavSel),
      this.el('div', { class: 'hint' }, info),
      this.row('Face', faceSel),
      this.row(`X, Y, rot (face ${frame.uLength} x ${frame.vLength})`, xy),
      this.row('ID', cid),
      this.el('div', { class: 'actions' }, btnInsert, btnTyped),
      this.el('div', { class: 'hint' }, 'Insert on model: hover a face, the cavity follows the pointer, click to place.'));
  }

  private cavitiesSection(title: string, open: boolean) {
    const d = this.design;
    const tbody = this.el('tbody');
    for (const c of d.cavities) {
      const tr = this.el('tr', c.id === this.selectedId ? { class: 'sel' } : {},
        this.el('td', {}, c.componentId),
        this.el('td', {}, this.lib.get(c.defId)?.name ?? '?'),
        this.el('td', {}, FACE_LABEL[c.face].slice(0, 1)),
        this.el('td', {}, `${c.x}, ${c.y}`));
      tr.onclick = () => { this.selectedId = c.id; this.refresh(); };
      tbody.append(tr);
    }
    const head = this.el('thead', {}, this.el('tr', {}, this.el('th', {}, 'ID'), this.el('th', {}, 'Cavity'), this.el('th', {}, 'Face'), this.el('th', {}, 'X, Y')));
    const table = this.el('table', {}, head, tbody);
    const sel = d.cavities.find((c) => c.id === this.selectedId);
    const parts: Node[] = [table];
    if (sel) parts.push(this.selectedEditor(sel));
    return this.section(title, open, ...parts);
  }

  private selectedEditor(sel: CavityInstance): HTMLElement {
    const d = this.design;
    const id = this.el('input', { value: sel.componentId });
    id.onchange = () => { sel.componentId = id.value; this.refresh(); };
    const face = this.faceSelect(sel.face, (f) => { sel.face = f; this.refresh(); });
    const xy = this.el('div', { class: 'row3' },
      this.num(sel.x, (v) => { sel.x = v; this.refresh(); }, '0.1'),
      this.num(sel.y, (v) => { sel.y = v; this.refresh(); }, '0.1'),
      this.rotationSelect(sel.rotation, (v) => { sel.rotation = v; this.refresh(); }));
    const move = this.el('button', {}, 'Move on model');
    move.onclick = () => {
      const def = this.lib.get(sel.defId);
      if (!def) return;
      this.startPlacement(def, sel.rotation, `Moving ${sel.componentId}`, (face, x, y) => { sel.face = face; sel.x = x; sel.y = y; });
    };
    const del = this.el('button', { class: 'danger' }, 'Delete');
    del.onclick = () => { removeCavity(d, sel.id); this.selectedId = null; this.refresh(); };
    const dup = this.el('button', {}, 'Copy');
    dup.onclick = () => {
      const prefix = sel.componentId.replace(/\d+$/, '') || 'C';
      const c = addCavity(d, sel.defId, sel.face, sel.x + 20, sel.y, nextComponentId(d, prefix), sel.rotation);
      this.selectedId = c.id;
      this.refresh();
    };
    return this.el('div', { style: 'margin-top:10px;border-top:1px solid var(--line);padding-top:8px' },
      this.el('div', { class: 'hint' }, `Selected: ${this.lib.get(sel.defId)?.name ?? '?'}`),
      this.row('ID', id),
      this.row('Face', face),
      this.row('X, Y, rot', xy),
      this.el('div', { class: 'actions' }, move, dup, del));
  }

  private showDrawing() {
    const host = document.getElementById('drawing');
    if (!host) return;
    const d = this.design;
    const views = this.viewer.snapshotFaces(d);
    host.replaceChildren();
    const close = this.el('button', {}, 'Back to model');
    close.onclick = () => host.classList.remove('show');
    const print = this.el('button', { style: 'margin-left:8px' }, 'Print');
    print.onclick = () => window.print();
    host.append(
      this.el('div', { style: 'margin-bottom:10px' }, close, print),
      this.el('h2', {}, `${d.name} - ${d.block.length} x ${d.block.width} x ${d.block.height} ${d.units}, ${d.block.material}`));
    const grid = this.el('div', { class: 'grid' });
    for (const v of views) grid.append(this.el('div', {}, this.el('h3', {}, v.face), this.el('img', { src: v.url })));
    host.append(grid);
    host.classList.add('show');
  }
}
