'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRight, ArrowUpRight, Mail, ShieldCheck } from 'lucide-react';
import { signIn } from '@/app/actions';
import PublicNav from './public-nav';
export default function AuthScreen({
  mode,
  available,
  callbackError = false,
  returnTo = '/app',
}: {
  mode: 'login' | 'signup';
  available: boolean;
  callbackError?: boolean;
  returnTo?: string;
}) {
  const signup = mode === 'signup';
  const [error, setError] = useState(
    callbackError
      ? 'That sign-in link could not be verified. Request a new link below in this browser.'
      : '',
  );
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <div className="public-site auth-site">
      <PublicNav />
      <main id="main" className="auth-layout">
        <section className="auth-editorial">
          <span className="eyebrow">BABSON, WITH A LITTLE MORE CONNECTION.</span>
          <h1>
            {signup ? (
              <>
                You belong.
                <br />
                Start <span>here.</span>
              </>
            ) : (
              <>
                Good to
                <br />
                have you <span>back.</span>
              </>
            )}
          </h1>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-circle" />
            <span>c.</span>
            <div className="auth-star">✳</div>
          </div>
          <div className="auth-caption">
            <span>COMMON GROUND. NEW POSSIBILITIES.</span>
            <ArrowUpRight size={20} />
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <span className="eyebrow">{signup ? '01 — YOUR FIRST HELLO' : 'WELCOME BACK'}</span>
            <h2>{sent ? 'Check your inbox.' : signup ? 'Make it Common.' : 'Log in to Common.'}</h2>
            <p>
              {sent
                ? `If this address can ${signup ? 'create an account' : 'log in'}, a secure link is on its way to ${email}. Open it in this browser to continue.`
                : signup
                  ? 'A campus full of people. A place to find yours. Create your account with your Babson email.'
                  : 'Your plans, your people, your campus. Pick up where you left off.'}
            </p>
            {sent ? (
              <div className="email-sent" role="status">
                <Mail size={28} />
                <p>Your link may take a moment to arrive. Check your spam folder too.</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setSent(false);
                    setError('');
                  }}
                >
                  Use a different email <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError('');
                  if (!available) {
                    setError('Email sign-in is not configured in this local preview.');
                    return;
                  }
                  startTransition(async () => {
                    try {
                      const r = await signIn(email, mode, returnTo);
                      if (r.error) setError(r.error);
                      else setSent(true);
                    } catch {
                      setError('We couldn’t send your link. Please try again shortly.');
                    }
                  });
                }}
              >
                <label htmlFor="auth-email">Babson email</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@babson.edu"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="auth-hint">No password to remember. We’ll email you a secure link.</p>
                {signup && (
                  <label className="auth-consent">
                    <input type="checkbox" required />{' '}
                    <span>
                      I’ll help keep Common welcoming: respect others, honor my plans, and report
                      concerns.
                    </span>
                  </label>
                )}
                <button className="button primary" disabled={pending}>
                  {pending ? 'Sending your link…' : signup ? 'Create account' : 'Send login link'}
                  <ArrowUpRight size={18} />
                </button>
              </form>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="auth-switch">
              {signup ? 'Already part of Common?' : 'New around here?'}{' '}
              <Link href={signup ? '/login' : '/signup'}>
                {signup ? 'Log in' : 'Create an account'} <ArrowRight size={14} />
              </Link>
            </div>
            <p className="auth-privacy">
              <ShieldCheck size={17} />
              Your email verifies your account.
              <br />
              It’s never shown to other students.
            </p>
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        <span>COMMON · MADE FOR LIFE AT BABSON</span>
        <Link href="/">
          Back to the possibilities <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
