// Converts the legacy nakal.data.js library into clean JSON for MsoftAI.
// Usage: node tools/convert-library.mjs <path-to-nakal.data.js> [outDir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const [src, outDir = 'public/library'] = process.argv.slice(2);
if (!src) { console.error('usage: convert-library.mjs <nakal.data.js> [outDir]'); process.exit(1); }

const ctx = { nakal: {}, console };
vm.createContext(ctx);
vm.runInContext(readFileSync(src, 'utf8'), ctx);
const data = ctx.nakal.data;

const step = (s) => ({ index: s.Index, diameter: s.Diameter, depth: s.Depth, angle: s.Angle });
const port = (p) => ({ diameter: p.Diameter, depth: p.Depth, connectingCavity: p.ConnectingCavity });
const oring = (o) => ({ diameter: o.Diameter, depth: o.Depth, width: o.Width });
const thread = (t) => ({ size: t.Size, step: t.Cricle, cls: t.Class, pitch: t.Pitch });
const machine = (m) => ({ diameter: m.Diameter, depth: m.Depth, operation: m.Operation, tool: m.Tool });

const cavities = data.cavities.map((c) => ({
  id: c.CavityIndex,
  name: c.CavityName,
  type: c.CavityType,
  library: c.LibraryName,
  steps: c.Cricles.map(step),
  ports: c.Ports.map(port),
  numberOfPorts: c.NumberofPorts,
  orings: c.ORings.map(oring),
  threads: c.Threads.map(thread),
  machines: c.Machines.map(machine),
  isFootprint: !!c.IsFootPrint,
  footprintIndex: c.CavityFootPrintIndex ?? null,
  insertionDepth: c.InsertionDepth,
  plugHeadHeight: c.PlugHeadHeight,
  maxPressure: c.MaxPressure,
  portApplicationName: c.PortApplicationName ?? null,
  comments: c.Comments ?? null,
}));

// Footprint child rows: the legacy parser did not pass step indices, so number them in order.
const footprints = data.footprints.map((f) => ({
  footprintIndex: f.FootprintIndex,
  parentCavityId: f.CavityIndex,
  type: f.CavityType,
  library: f.LibraryName,
  portApplicationName: f.PortApplicationName ?? null,
  x: f.CavityXDim,
  y: f.CavityYDim,
  steps: f.Cricles.map((s, i) => ({ ...step(s), index: s.Index ?? i })),
  ports: f.Ports.map(port),
  threads: f.Threads.map(thread),
  machines: f.Machines.map(machine),
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'cavities.json'), JSON.stringify(cavities));
writeFileSync(join(outDir, 'footprints.json'), JSON.stringify(footprints));
console.log(`cavities ${cavities.length}, footprints ${footprints.length} -> ${outDir}`);
