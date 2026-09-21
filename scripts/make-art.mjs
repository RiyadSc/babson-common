import { writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
await mkdir('public/images', { recursive: true });
const start = (bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360"><rect width="600" height="360" fill="${bg}"/><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".07"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#grain)">`;
const end = '</g></svg>';
const drawings = {
  sunset:
    start('#e9dcc1') +
    `<circle cx="388" cy="116" r="69" fill="#e5ae77"/><path d="M0 233Q133 107 306 218T600 188V360H0Z" fill="#9fa77b"/><path d="M0 284Q173 203 332 278T600 239V360H0Z" fill="#737e58"/><path d="M164 302l110-36 136 40-117 41z" fill="#e1c9a2"/><path d="m190 303 83-26 107 30-85 26z" fill="#d6aa86"/><path d="m230 291 75 33m-40-43 75 33m-128-10 112-9m-93 24 114-11" stroke="#ecdbc0" stroke-width="2"/><ellipse cx="321" cy="286" rx="17" ry="6" fill="#4d5b3b"/><path d="M302 283v-21h34v21q-17 11-34 0" fill="#f5edce"/><path d="M336 265q19 0 7 14h-7" fill="none" stroke="#f5edce" stroke-width="5"/><path d="M62 282Q47 174 72 152M65 230Q20 206 30 186M65 213q42-39 45-23" fill="none" stroke="#566342" stroke-width="7"/><path d="M522 316V214m0 40q-31-25-29-46m29 75q35-27 35-49" stroke="#53613e" stroke-width="6" fill="none"/>` +
    end,
  coffee:
    start('#d9c3a5') +
    `<path d="M0 115 600 29v331H0" fill="#b79171"/><path d="M0 173 600 87M0 257 600 171M0 341 600 255" stroke="#a78363" stroke-width="3"/><ellipse cx="194" cy="239" rx="104" ry="51" fill="#eadbc3"/><ellipse cx="194" cy="232" rx="87" ry="40" fill="#d4bda0"/><path d="M127 139v81q63 52 126 0v-81" fill="#f5ead5"/><ellipse cx="190" cy="139" rx="63" ry="27" fill="#efe1c7"/><ellipse cx="190" cy="141" rx="52" ry="19" fill="#70523a"/><path d="M169 141q10-19 22-5 11-14 21-3-4 15-23 20z" fill="#e5cdae"/><path d="M252 158q66-10 33 48l-33 4" stroke="#f2e7d1" stroke-width="13" fill="none"/><g transform="translate(341 201) rotate(13)"><rect width="132" height="89" fill="#eae5cd"/><path d="M15 23h60m-60 11h97m-97 12h88m-88 12h49" stroke="#9ca080" stroke-width="3"/><path d="m92 70 5-10 5 10 10 3-10 4-5 9-5-9-9-4z" fill="#8d9f73"/></g><path d="M435 117q-10-46 31-49 23 14-1 42" stroke="#4e6243" stroke-width="13" fill="none"/><path d="m431 134 52-30-2 49-41 18z" fill="#e7d5ac"/>` +
    end,
  basketball:
    start('#b1bda9') +
    `<path d="M0 92 600 149v211H0" fill="#a17e61"/><path d="m0 273 600-91M200 360 421 127M0 172 531 360" stroke="#e8d9bd" stroke-width="4"/><ellipse cx="281" cy="282" rx="175" ry="65" fill="none" stroke="#dfcdb0" stroke-width="4"/><path d="M437 174V26" stroke="#57644e" stroke-width="9"/><path d="m378 36 105 6v64l-105-6z" fill="#e4decb" stroke="#6a725d" stroke-width="4"/><path d="m403 62 42 3v27l-42-2z" fill="none" stroke="#9f8b70" stroke-width="3"/><ellipse cx="423" cy="105" rx="31" ry="8" fill="none" stroke="#915f42" stroke-width="5"/><path d="m393 108 11 31 39 1 10-32m-51 3 15 28m28-28-13 28m-21-25 5 25m17-25-5 25" stroke="#e1dcc5" stroke-width="2" fill="none"/><ellipse cx="199" cy="303" rx="61" ry="15" fill="#7d6650"/><circle cx="199" cy="256" r="53" fill="#ce905b" stroke="#755336" stroke-width="3"/><path d="M146 253q59 16 104-7m-61-42q-8 73 33 99m-68-23q42-47 97-43m-78-27q-12 44-24 60m88-51q-10 50 9 55" stroke="#825c3a" stroke-width="3" fill="none"/>` +
    end,
  art:
    start('#d7c6cb') +
    `<path d="M0 260 600 118v242H0" fill="#b89ca1"/><g transform="translate(154 88) rotate(-9)"><rect width="236" height="205" fill="#f1e5cc"/><path d="M35 166V71q43-86 87-2v97" fill="#c18861"/><path d="M74 166v-59q31-52 62-3v62" fill="#ceb99b"/><circle cx="169" cy="64" r="30" fill="#d4a764"/><path d="m124 174 67-76 21 78z" fill="#7c9271"/><path d="m33 185 176-5" stroke="#b6bba0" stroke-width="6"/></g><ellipse cx="467" cy="289" rx="62" ry="39" fill="#e8d2b4"/><circle cx="442" cy="280" r="10" fill="#789073"/><circle cx="470" cy="270" r="11" fill="#bf806b"/><circle cx="493" cy="290" r="10" fill="#c9a25f"/><ellipse cx="456" cy="305" rx="12" ry="7" fill="#b19685"/><path d="m86 321 331-239" stroke="#b49366" stroke-width="8"/><path d="m403 94 35-27" stroke="#555f4d" stroke-width="12"/><path d="m433 70 14-10" stroke="#ba8262" stroke-width="13"/>` +
    end,
  ideas:
    start('#cbd7d4') +
    `<path d="M0 220 600 155v205H0" fill="#96aaa1"/><g transform="translate(103 97) rotate(-5)"><rect width="213" height="167" rx="8" fill="#f3eedb"/><path d="M106 0v167" stroke="#d0c7af" stroke-width="2"/><path d="M18 31h60m-60 15h71m-71 15h60m-60 15h45" stroke="#b6b7a0" stroke-width="3"/><circle cx="158" cy="63" r="23" fill="#e6c47f"/><path d="m149 87 0 17h20V86m-21 24h22" stroke="#869379" stroke-width="3" fill="none"/><path d="M123 133h68m-68 12h51" stroke="#b6b7a0" stroke-width="3"/></g><g transform="translate(352 189) rotate(12)"><rect width="96" height="83" fill="#e8c889"/><path d="m24 39 12 12 33-31" stroke="#8f926a" stroke-width="5" fill="none"/></g><path d="m293 281 73-160" stroke="#dfad72" stroke-width="9"/><path d="m292 284-6 17 13-12" fill="#405743"/><path d="M481 197q-21-86 23-108m-20 48q-47-13-37-48m43 75q51-4 40-43" fill="none" stroke="#668267" stroke-width="9"/><path d="m449 185 70 3-10 72h-47z" fill="#d6c0a0"/>` +
    end,
  walk:
    start('#e1e2ce') +
    `<circle cx="374" cy="87" r="43" fill="#e5cc96"/><path d="M0 208Q158 96 310 195T600 142V360H0Z" fill="#b7c1a0"/><path d="M0 288Q230 165 600 244V360H0Z" fill="#8b9f7d"/><path d="M261 360q-35-61 49-115t34-65q84 28 7 95t19 85" fill="#ddd1b0"/><path d="M74 253V67m0 55-28-28m28 83 42-38m-42 59-42-35M512 271V44m0 65-28-34m28 90 43-42m-43 84-41-38" stroke="#6e8062" stroke-width="9"/><ellipse cx="74" cy="62" rx="47" ry="71" fill="#829471"/><ellipse cx="512" cy="51" rx="51" ry="78" fill="#98a984"/><g transform="translate(302 230)"><circle cx="0" cy="0" r="9" fill="#b38362"/><path d="M-2 11v31" stroke="#e9d5a5" stroke-width="17"/><path d="m-7 41-8 25m23-25 8 25" stroke="#546950" stroke-width="7"/></g>` +
    end,
};
drawings.food = drawings.coffee;
drawings.games = drawings.ideas;
for (const [name, svg] of Object.entries(drawings))
  await writeFile(`public/images/${name}.svg`, svg);
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" fill="#225740"/><g fill="#d7ec85" transform="rotate(-12 256 256)"><rect x="139" y="131" width="67" height="250" rx="33"/><rect x="223" y="169" width="67" height="174" rx="33"/><rect x="307" y="207" width="67" height="98" rx="33"/></g></svg>`;
await writeFile('public/icon.svg', icon);
for (const size of [192, 512])
  await sharp(Buffer.from(icon)).resize(size).png().toFile(`public/icon-${size}.png`);
