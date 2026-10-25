import { Library } from './model/library';
import { App } from './ui/app';

async function boot() {
  const panel = document.getElementById('panel');
  const viewport = document.getElementById('viewport');
  if (!panel || !viewport) return;
  panel.textContent = 'Loading cavity library...';
  try {
    const lib = await Library.load(`${import.meta.env.BASE_URL}library/`);
    new App(lib, panel, viewport);
  } catch (e) {
    panel.textContent = `Failed to load library: ${(e as Error).message}`;
  }
}

boot();
