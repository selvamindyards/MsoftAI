import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './auth/client';
import { LoginView } from './auth/login';
import { CloudDesigns } from './cloud/designs';
import { myProfile } from './cloud/profiles';
import { Library } from './model/library';
import { App } from './ui/app';

/** Full-screen notice for signed-in users whose access has not been approved yet. */
function showPending(sb: SupabaseClient, email: string) {
  const root = document.createElement('div');
  root.id = 'login';
  const card = document.createElement('div');
  card.className = 'login-card';
  card.innerHTML = `
    <h1>MsoftAI <small>Manifold Designer</small></h1>
    <p>Your account <b>${email}</b> is awaiting approval.</p>
    <p class="hint">MindYards reviews each new account before enabling access. You will be able to use the designer as soon as it is approved.</p>
    <div class="actions"><button class="primary" id="recheck">Check again</button><button id="signout">Sign out</button></div>
    <p class="login-foot">MindYards</p>`;
  root.appendChild(card);
  document.body.appendChild(root);
  card.querySelector<HTMLButtonElement>('#recheck')!.onclick = () => location.reload();
  card.querySelector<HTMLButtonElement>('#signout')!.onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

async function boot() {
  const panel = document.getElementById('panel');
  const viewport = document.getElementById('viewport');
  if (!panel || !viewport) return;

  const sb = getSupabase();
  if (!sb) {
    panel.innerHTML = '<h1>MsoftAI</h1><p class="hint">Sign-in is not configured for this build. Set the Supabase project URL and anon key in src/auth/config.ts.</p>';
    return;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') location.reload();
  });

  const login = new LoginView(document.body, sb);
  panel.textContent = 'Checking sign-in...';
  const session = await login.waitForSession();
  const email = session.user.email ?? '';

  panel.textContent = 'Checking access...';
  let profile = null;
  try {
    profile = await myProfile(sb, session.user.id);
  } catch (e) {
    panel.innerHTML = `<h1>MsoftAI</h1><p class="hint">Could not check your access: ${(e as Error).message}</p>`;
    return;
  }
  if (!profile || !profile.approved) {
    panel.textContent = '';
    showPending(sb, email);
    return;
  }

  panel.textContent = 'Loading cavity library...';
  try {
    const lib = await Library.fromSupabase(sb);
    new App(lib, panel, viewport, {
      email,
      isAdmin: profile.role === 'admin',
      sb,
      cloud: new CloudDesigns(sb, session.user.id),
      signOut: async () => { await sb.auth.signOut(); location.reload(); },
    });
  } catch (e) {
    panel.innerHTML = `<h1>MsoftAI</h1><p class="hint">Failed to load the cavity library: ${(e as Error).message}</p>`;
  }
}

boot();
