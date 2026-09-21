import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ShieldCheck,
} from 'lucide-react';
import PublicNav from './public-nav';
export default function Landing() {
  return (
    <div className="public-site">
      <PublicNav />
      <main id="main">
        <section className="landing-hero">
          <div className="hero-index">
            <span className="status-dot" /> BUILT FOR BABSON.
            <br />
            OPEN TO SOMETHING NEW.
          </div>
          <div className="landing-headline">
            <h1>
              Your campus.
              <br />
              Your{' '}
              <span className="inline-symbol" aria-hidden="true">
                ✳
              </span>{' '}
              people.
              <br />
              <span className="green-text">More in common.</span>
            </h1>
            <div className="hero-bottom">
              <p>
                Good things happen when you show up.
                <br />
                Find campus events, make a small plan,
                <br />
                and turn familiar faces into friends.
              </p>
              <Link className="button primary" href="/signup">
                Find your people <ArrowUpRight size={19} />
              </Link>
            </div>
          </div>
        </section>
        <div className="section-rule">
          <span>LESS SCROLLING. MORE SHOWING UP.</span>
          <a href="#possibilities" aria-label="Explore Common">
            <ArrowDown size={18} />
          </a>
          <span>01 — THE POSSIBILITIES</span>
        </div>
        <section
          id="possibilities"
          className="landing-bento"
          aria-label="What you can do on Common"
        >
          <div className="bento-discover">
            <div className="bento-label">
              ALL YOUR CAMPUS PLANS <ArrowUpRight size={23} />
            </div>
            <h2>
              Out of the group chat.
              <br />
              Into your day.
            </h2>
            <p>
              Campus events and student hangouts.
              <br />
              Finally, in one place.
            </p>
            <div className="plan-stack" aria-label="Illustrative plan examples">
              <div>
                <span className="plan-icon">↗</span>
                <span>
                  <b>A coffee. A new connection.</b>
                  <small>FOOD & DRINK · STUDENT HANGOUT</small>
                </span>
                <ArrowUpRight size={18} />
              </div>
              <div>
                <span className="plan-icon blue">✳</span>
                <span>
                  <b>Make room for a little creativity.</b>
                  <small>ARTS & CULTURE · CAMPUS EVENT</small>
                </span>
                <ArrowUpRight size={18} />
              </div>
              <span className="example-caption">A FEW IDEAS. YOUR PLANS ARE NEXT.</span>
            </div>
          </div>
          <div className="bento-connect">
            <div className="bento-label">
              COME AS YOU ARE <span>02</span>
            </div>
            <div className="connection-art" aria-hidden="true">
              <i />
              <i />
              <span>+</span>
            </div>
            <div>
              <h2>No crew required.</h2>
              <p>Show up solo. Leave with a familiar face.</p>
            </div>
          </div>
          <div className="bento-schedule">
            <div className="bento-label">
              MAKE IT A PLAN <CalendarDays size={22} />
            </div>
            <div className="mini-week" aria-hidden="true">
              {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
                <span key={i} className={i === 2 ? 'day-picked' : ''}>
                  {d}
                  <b>{i === 2 ? <Check size={21} /> : i + 14}</b>
                </span>
              ))}
            </div>
            <h2>
              In your week.
              <br />
              Off your mind.
            </h2>
            <p>Save a plan, join in, and keep your calendar close.</p>
          </div>
          <Link href="/signup" className="bento-host">
            <div className="bento-label">
              START SOMETHING <ArrowUpRight size={24} />
            </div>
            <div className="big-plus" aria-hidden="true">
              +
            </div>
            <h2>
              A small plan.
              <br />A good beginning.
            </h2>
            <p>Host a study break, a pickup game, or whatever you’re into.</p>
          </Link>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="section-rule">
            <span>02 — HOW IT WORKS</span>
            <span>FROM “MAYBE” TO “SEE YOU THERE.”</span>
          </div>
          <div className="how-intro">
            <h2>
              Less effort.
              <br />
              More out of campus.
            </h2>
            <p>
              A little structure for spontaneous connections.
              <br />
              Three steps to your next good plan.
            </p>
          </div>
          <div className="steps-grid">
            {[
              [
                '01',
                'Make it official.',
                'Sign up with your Babson email. Verify your account and make yourself at home.',
              ],
              [
                '02',
                'Find your kind of thing.',
                'Explore events and open hangouts. Save what catches your eye, or host something yourself.',
              ],
              [
                '03',
                'See you there.',
                'Join a plan, add it to your calendar, and show up. A first hello goes a long way.',
              ],
            ].map(([n, title, copy]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="community" className="community-strip">
          <ShieldCheck size={32} />
          <h2>
            A shared campus.
            <br />A little common ground.
          </h2>
          <div>
            <p>
              Verified Babson accounts. Open invitations. Clear expectations. A community with room
              for you.
            </p>
            <Link href="/signup">
              Come be part of it <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">YOUR NEXT “GLAD I WENT” STARTS HERE.</span>
          <h2>
            Make yourself
            <br />a little more <span>at home.</span>
          </h2>
          <Link className="button primary" href="/signup">
            Join Common <ArrowUpRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <Link className="wordmark" href="/">
          common<span>✳</span>
        </Link>
        <p>
          Made for life at Babson.
          <br />
          <small>An independent student community.</small>
        </p>
        <div>
          <Link href="/login">Log in</Link>
          <Link href="/signup">
            Sign up <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
