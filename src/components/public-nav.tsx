import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
export default function PublicNav() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="public-nav">
        <Link href="/" className="wordmark" aria-label="Common home">
          common<span>✳</span>
        </Link>
        <nav className="public-links" aria-label="About Common">
          <Link href="/#possibilities">The possibilities</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#community">Our community</Link>
        </nav>
        <nav className="public-actions" aria-label="Account">
          <Link href="/login">Log in</Link>
          <Link className="button primary" href="/signup">
            Sign up <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
    </>
  );
}
