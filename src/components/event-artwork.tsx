import type { CSSProperties } from 'react';
import type { CampusEvent } from '@/lib/domain';

function activity(event: CampusEvent) {
  const title = event.title.toLowerCase();
  if (/pickleball|tennis|paddle|badminton/.test(title)) return 'racket';
  if (/basketball|hoops|pick.up/.test(title)) return 'basketball';
  if (/coffee|café|cafe|tea\b|bagel/.test(title)) return 'coffee';
  if (/board game|cards|chess|trivia|game night/.test(title)) return 'games';
  if (/potluck|dinner|lunch|food|brunch|pizza|cook/.test(title)) return 'food';
  if (/paint|craft|\bart\b|design|make something/.test(title)) return 'art';
  if (/music|concert|karaoke|speaker|panel|talk|conference/.test(title)) return 'stage';
  if (/walk|run|5k|hike|outdoor|sunset|lawn/.test(title)) return 'outdoors';
  if (/yoga|meditat|wellness|slower/.test(title)) return 'wellness';
  if (/network|social|mixer|meet|community/.test(title)) return 'social';
  return ({ 'Food & drink': 'food', 'Sports & outdoors': 'outdoors', 'Arts & culture': 'art', Learning: 'learning', Professional: 'learning', Wellness: 'wellness' } as Record<string, string>)[event.category] || 'social';
}

const palettes: Record<string, string[]> = {
  racket: ['#e6ebd9', '#234c3a', '#bcce8d'],
  basketball: ['#efddd0', '#653f2c', '#d68b56'],
  coffee: ['#eee4d7', '#624932', '#cda875'],
  games: ['#e1dced', '#49395c', '#b2a0cb'],
  food: ['#f0e3c9', '#63472f', '#d9b46e'],
  art: ['#eedbd8', '#724138', '#ce9287'],
  stage: ['#dce3ee', '#354b69', '#91aacb'],
  outdoors: ['#e0e8d9', '#35543e', '#a5bb88'],
  wellness: ['#e1e8e4', '#3e6056', '#a0bdb0'],
  learning: ['#dfe6ec', '#314e60', '#9eb9c9'],
  social: ['#e9e5d7', '#365344', '#afc0a3'],
};

function Illustration({ topic }: { topic: string }) {
  switch (topic) {
    case 'racket': return <><g transform="rotate(-27 177 134)"><rect x="145" y="67" width="66" height="88" rx="28" fill="var(--accent)" /><path d="M169 155v43h18v-43M158 88h40M156 103h44M158 118h40M167 78v60M185 78v60" /></g><g transform="rotate(24 253 143)"><rect x="225" y="78" width="62" height="84" rx="26" fill="var(--paper)" /><path d="M247 162v37h17v-37" /></g><circle cx="292" cy="192" r="17" fill="var(--accent)" /><path d="M287 185h1m9 7h1m-13 6h1" /></>;
    case 'basketball': return <><path d="M254 71h72v59h-72zM271 87h38v28h-38" fill="var(--paper)" /><path d="M269 131h43l-8 31h-26zM278 133l23 28m3-28-22 28M290 162v33" /><circle cx="186" cy="151" r="55" fill="var(--accent)" /><path d="M131 151h110M186 96v110M149 111c42 14 42 66 0 80M223 111c-42 14-42 66 0 80" /></>;
    case 'coffee': return <><ellipse cx="207" cy="190" rx="87" ry="13" fill="var(--accent)" /><path d="M151 114h98v31a49 49 0 0 1-98 0z" fill="var(--paper)" /><path d="M249 121h13a21 21 0 0 1 0 42h-17M174 91c-18-19 16-19 0-37M201 91c-18-19 16-19 0-37M228 91c-18-19 16-19 0-37" /><path d="M283 178l20-19" /></>;
    case 'games': return <><g transform="rotate(-12 188 143)"><rect x="139" y="81" width="79" height="115" rx="8" fill="var(--paper)" /><path d="m178 109 19 31-19 31-19-31z" fill="var(--accent)" /></g><rect x="221" y="133" width="68" height="68" rx="13" fill="var(--accent)" />{[[237,149],[273,149],[255,167],[237,185],[273,185]].map(([x,y])=><circle key={x+':'+y} cx={x} cy={y} r="3" fill="var(--ink)" />)}</>;
    case 'food': return <><circle cx="210" cy="141" r="65" fill="var(--paper)" /><circle cx="210" cy="141" r="47" /><path d="M121 81v45m-12-45v28q0 17 12 17t12-17V81m-12 45v76M300 202V81q-23 20-23 57h23" /><path d="M182 137q25-37 57 2l-27 28z" fill="var(--accent)" /><path d="m192 136 10 6m13-10 12 7" /></>;
    case 'art': return <><path d="M203 77c-78-4-105 107-29 121 36 7 31-24 53-22 42 4 70-7 65-40-5-31-44-57-89-59z" fill="var(--paper)" /><ellipse cx="251" cy="142" rx="12" ry="15" />{[[171,113],[159,146],[183,171],[212,105]].map(([x,y])=><circle key={x} cx={x} cy={y} r="9" fill="var(--accent)" />)}<path d="m251 199 53-108 10 5-48 111z" fill="var(--accent)" /><path d="M251 199q-19 4-12 20 22 1 27-12" /></>;
    case 'stage': return <><g transform="rotate(25 205 117)"><rect x="185" y="64" width="42" height="83" rx="21" fill="var(--accent)" /><path d="M183 117h46M194 77h23m-24 12h26m-26 12h26M204 148v32" /></g><path d="M224 173v27m-34 1h69M268 93q24 19 0 39m14-52q41 32 0 65M143 101l-8-9m5 39-16 2" /></>;
    case 'outdoors': return <><circle cx="271" cy="90" r="25" fill="var(--accent)" /><path d="m106 173 72-91 66 91" fill="var(--accent)" /><path d="m183 180 61-65 76 79H106" fill="var(--paper)" /><path d="m155 112 22 9 14-20M222 155l20 7 14-13M194 195l-20 20m49-20 20 20" /></>;
    case 'wellness': return <><path d="M213 183c-54-8-76-38-66-75 32 0 57 18 66 75z" fill="var(--accent)" /><path d="M213 183c54-8 76-38 66-75-32 0-57 18-66 75z" fill="var(--accent)" /><path d="M213 183c-32-38-33-75 0-109 33 34 32 71 0 109z" fill="var(--paper)" /><path d="M157 198q56 16 112 0M213 115v68" /></>;
    case 'learning': return <><path d="M210 104q-42-29-85-13v100q43-16 85 13 42-29 85-13V91q-43-16-85 13z" fill="var(--paper)" /><path d="M210 104v100M143 117l45 11m-45 10 45 11m-45 10 33 8M232 128l45-11m-45 32 45-11m-45 32 32-8" /><path d="M249 84V60h17v21l-8-6z" fill="var(--accent)" /></>;
    default: return <><path d="M118 77h95q16 0 16 16v41q0 16-16 16h-43l-28 21v-21h-24q-16 0-16-16V93q0-16 16-16z" fill="var(--paper)" /><path d="M243 116h48q15 0 15 15v34q0 15-15 15h-9v20l-27-20h-33q-15 0-15-15" fill="var(--accent)" /><path d="M129 106h71m-71 18h45M238 144h40m-40 17h24" /></>;
  }
}

export default function EventArtwork({ event }: { event: CampusEvent }) {
  const topic = activity(event);
  const [paper, ink, accent] = palettes[topic];
  return <div className="activity-artwork" aria-hidden="true" data-activity-art={topic}
    style={{ '--paper': paper, '--ink': ink, '--accent': accent } as CSSProperties}>
    <svg viewBox="0 0 420 236" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="210" cy="211" rx="103" ry="7" fill="var(--ink)" opacity=".06" stroke="none" />
      <Illustration topic={topic} />
    </svg>
  </div>;
}
