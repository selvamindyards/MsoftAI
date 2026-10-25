import type { Session, SupabaseClient } from '@supabase/supabase-js';

type Mode = 'signin' | 'signup' | 'recover';

/**
 * Full-screen sign-in page. Resolves with a session once the user is signed in.
 * Supports email + password, account creation, magic link and password reset.
 */
export class LoginView {
  private root: HTMLElement;
  private msg!: HTMLElement;
  private email!: HTMLInputElement;
  private password!: HTMLInputElement;
  private mode: Mode = 'signin';
  private resolveSession: ((s: Session) => void) | null = null;

  constructor(host: HTMLElement, private sb: SupabaseClient) {
    this.root = document.createElement('div');
    this.root.id = 'login';
    this.root.hidden = true;
    host.appendChild(this.root);
    this.render();
  }

  /** Returns the current session, or shows the page and waits for a sign-in. */
  async waitForSession(): Promise<Session> {
    const { data } = await this.sb.auth.getSession();
    if (data.session) return data.session;
    this.show();
    return new Promise<Session>((resolve) => {
      this.resolveSession = resolve;
      this.sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') { this.mode = 'recover'; this.show(); this.render(); return; }
        if (session && this.resolveSession && this.mode !== 'recover') {
          const r = this.resolveSession;
          this.resolveSession = null;
          this.hide();
          r(session);
        }
      });
    });
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
  }

  private note(text: string, isError = false) {
    this.msg.textContent = text;
    this.msg.className = isError ? 'login-msg error' : 'login-msg';
  }

  private render() {
    const emailVal = this.email?.value ?? '';
    this.root.replaceChildren();
    const card = this.el('div', { class: 'login-card' });
    card.append(this.el('h1', {}, 'MsoftAI', this.el('small', {}, 'Manifold Designer')));

    const tabs = this.el('div', { class: 'login-tabs' });
    for (const [m, label] of [['signin', 'Sign in'], ['signup', 'Create account']] as [Mode, string][]) {
      const b = this.el('button', { class: this.mode === m ? 'active' : '' }, label);
      b.onclick = () => { this.mode = m; this.render(); };
      tabs.append(b);
    }
    if (this.mode !== 'recover') card.append(tabs);
    else card.append(this.el('p', { class: 'hint' }, 'Choose a new password for your account.'));

    this.msg = this.el('div', { class: 'login-msg' });
    this.email = this.el('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', value: emailVal });
    this.password = this.el('input', {
      type: 'password',
      placeholder: this.mode === 'recover' ? 'New password' : 'Password',
      autocomplete: this.mode === 'signin' ? 'current-password' : 'new-password',
    });
    const form = this.el('form', { class: 'login-form' });
    if (this.mode !== 'recover') form.append(this.email);
    form.append(this.password);

    const primary = this.el('button', { type: 'submit', class: 'primary' },
      this.mode === 'signin' ? 'Sign in' : this.mode === 'signup' ? 'Create account' : 'Set password');
    form.append(primary);
    form.onsubmit = (e) => { e.preventDefault(); void this.submit(); };
    form.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.submit(); } };

    if (this.mode === 'signin') {
      const magic = this.el('button', { type: 'button' }, 'Email me a sign-in link');
      magic.onclick = () => void this.magicLink();
      const forgot = this.el('button', { type: 'button', class: 'link' }, 'Forgot password?');
      forgot.onclick = () => void this.resetPassword();
      form.append(magic, forgot);
    }
    card.append(form, this.msg, this.el('p', { class: 'login-foot' }, 'MindYards'));
    this.root.append(card);
  }

  private redirectTo() {
    return `${location.origin}${location.pathname}`;
  }

  private async submit() {
    const email = this.email.value.trim();
    const password = this.password.value;
    try {
      if (this.mode === 'recover') {
        if (password.length < 8) return this.note('Use at least 8 characters.', true);
        const { error } = await this.sb.auth.updateUser({ password });
        if (error) throw error;
        this.mode = 'signin';
        const { data } = await this.sb.auth.getSession();
        if (data.session && this.resolveSession) { const r = this.resolveSession; this.resolveSession = null; this.hide(); r(data.session); }
        return;
      }
      if (!email) return this.note('Enter your email.', true);
      if (this.mode === 'signin') {
        if (!password) return this.note('Enter your password.', true);
        this.note('Signing in...');
        const { error } = await this.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (password.length < 8) return this.note('Use at least 8 characters.', true);
        this.note('Creating account...');
        const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: this.redirectTo() } });
        if (error) throw error;
        if (!data.session) this.note('Account created. Check your email and click the confirmation link, then sign in.');
      }
    } catch (e) {
      this.note((e as Error).message, true);
    }
  }

  private async magicLink() {
    const email = this.email.value.trim();
    if (!email) return this.note('Enter your email first.', true);
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirectTo() } });
    this.note(error ? error.message : 'Sign-in link sent. Check your email.', !!error);
  }

  private async resetPassword() {
    const email = this.email.value.trim();
    if (!email) return this.note('Enter your email first.', true);
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.redirectTo() });
    this.note(error ? error.message : 'Password reset link sent. Check your email.', !!error);
  }
}
