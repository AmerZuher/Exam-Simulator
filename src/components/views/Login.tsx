import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Icon } from '../../utils/icons';

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5c3.2 6.5 9.9 10.9 17.8 10.9z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.7 35.9 44 30.4 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

type Mode = 'welcome' | 'email-signin' | 'email-signup';

export function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Supabase redirects away on success; if we're still here, it failed silently.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter both email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'email-signup') {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-page">
        <div className="auth-card">
          {mode === 'welcome' && (
            <>
              <div className="auth-mark brand">
                <Icon name="logo" size={30} strokeWidth={2} />
              </div>
              <h1 className="auth-title">Welcome to ExamPro</h1>
              <p className="auth-sub">
                Sign in to sync your question banks, review streaks and exam
                history to your account.
              </p>

              <button
                type="button"
                className="google-btn"
                onClick={handleGoogle}
                disabled={googleLoading}
              >
                {GOOGLE_G}
                <span className="gbtn-text">
                  <span className="gbtn-line1">
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                  </span>
                </span>
              </button>

              <div className="auth-divider">or</div>

              <button
                type="button"
                className="auth-back"
                style={{ justifyContent: 'center', display: 'flex', width: '100%', marginBottom: '8px' }}
                onClick={() => { setError(null); setMode('email-signin'); }}
              >
                Sign in with email
              </button>

              {error && <p className="auth-fine" style={{ color: 'var(--bad)' }}>{error}</p>}

              <p className="auth-fine">
                By continuing you agree to sync your study data via Supabase.
              </p>
            </>
          )}

          {(mode === 'email-signin' || mode === 'email-signup') && (
            <>
              <button
                type="button"
                className="auth-back"
                onClick={() => { setError(null); setMode('welcome'); }}
              >
                <Icon name="chevL" size={13} strokeWidth={2.4} />
                Back
              </button>

              <div className="auth-mark brand">
                <Icon name="logo" size={30} strokeWidth={2} />
              </div>
              <h1 className="auth-title">
                {mode === 'email-signup' ? 'Create your account' : 'Sign in'}
              </h1>
              <p className="auth-sub">
                {mode === 'email-signup'
                  ? 'Set a password to start syncing your study data.'
                  : 'Enter your email and password to continue.'}
              </p>

              <label className="field-lbl" style={{ textAlign: 'left', display: 'block' }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />

              <label className="field-lbl" style={{ textAlign: 'left', display: 'block', marginTop: '12px' }}>
                Password
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
              />

              {error && (
                <p className="auth-fine" style={{ color: 'var(--bad)', marginTop: '12px' }}>
                  {error}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '18px' }}
                onClick={handleEmailSubmit}
                disabled={submitting}
              >
                {submitting ? 'Please wait…' : mode === 'email-signup' ? 'Create account' : 'Sign in'}
              </button>

              <button
                type="button"
                className="auth-back"
                style={{ justifyContent: 'center', display: 'flex', width: '100%', marginTop: '16px' }}
                onClick={() => {
                  setError(null);
                  setMode(mode === 'email-signup' ? 'email-signin' : 'email-signup');
                }}
              >
                {mode === 'email-signup'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
