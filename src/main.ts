import { getSupabase } from './auth/client';
import { LoginView } from './auth/login';
import { CloudDesigns } from './cloud/designs';
import { Library } from './model/library';
import { App } from './ui/app';

async function boot() {
  const panel = document.getElementById('panel');
  const viewport = document.getElementById('viewport');
  if (!panel || !viewport) return;

  const sb = getSupabase();
  if (!sb) {
    panel.innerHTML = '<h1>MsoftAI</h1><p class="hint">Sign-in is not configured for this build. Set the Supabase project URL and anon key in src/auth/config.ts.</p>';
    return;
  }

  const login = new LoginView(document.body, sb);
  panel.textContent = 'Checking sign-in...';
  const session = await login.waitForSession();

  panel.textContent = 'Loading cavity library...';
  try {
    const lib = await Library.fromSupabase(sb);
    const cloud = new CloudDesigns(sb, session.user.id);
    new App(lib, panel, viewport, {
      email: session.user.email ?? '',
      cloud,
      signOut: async () => { await sb.auth.signOut(); location.reload(); },
    });
  } catch (e) {
    panel.innerHTML = `<h1>MsoftAI</h1><p class="hint">Failed to load the cavity library: ${(e as Error).message}</p>`;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') location.reload();
  });
}

boot();
