import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 380;
const AZIMUTH = 58;

// The model: a bucket of CAPACITY tokens, refilled at RATES[i] tokens a second.
const CAPACITY = 8;
const RATES = [0.5, 1, 2];
const RATE_AT = 1;

const PLATE = { x: -168, y: -50, w: 322, d: 112, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const TOKEN_R = 13;
const TOKEN_H = 5;
const RODS = [90, 150, 210, 270].map((deg) => [15 * Math.cos((deg * Math.PI) / 180), 15 * Math.sin((deg * Math.PI) / 180)]);
const ROD_R = 1.6;

// Refill side: a pedestal with a supply tube and a pusher on top.
const SX = -112;
const PED = { x: -150, y: -24, w: 62, d: 48, r: 3 };
const PZ = 70;
const SUPPLY_LEVELS = 8;
const HOPPER_Z = 106;
const SHOUSE = { x: -150, y: -12, w: 22, d: 24, r: 2 };
const SBLADE_REST = SX - TOKEN_R - 1;
const STROKE = 27;

// The chute carries one token from the pedestal to the bucket.
const CHUTE = { x: -88, y: -16, w: 76, d: 32, r: 1 };
const CHUTE_WALL_X = -84;
const CHUTE_END = -12 - TOKEN_R;

// The bucket: a coin tube on a dispenser block, capacity 8.
const BLOCK = { x: -22, y: -22, w: 44, d: 44, r: 3 };
const BZ = 20;
const RING_Z = 62;
const RING_H = 4;
const RING_IN = 14;
const RING_OUT = 18;
const RHOUSE = { x: -60, y: -12, w: 32, d: 24, r: 2 };
const RHOUSE_H = 28;
const BUTTON = [-44, 0];
const RBLADE_REST = -TOKEN_R - 1;
const FLAG = { x: -54, y: -13.6, w: 18, d: 1.6, r: 0.4 };
const FLAG_LIFT = 13;

// The way out: a tray to a bin.
const TRAY = { x: 22, y: -16, w: 78, d: 32, r: 1.5 };
const BIN_X = 102;
const BIN_TO = 136;
const BIN_H = 16;

const CLOCK = [-112, 42];
const CLOCK_R = 12.5;
const CLOCK_H = 8;
const CLOCK_TOP = 1.6 + CLOCK_H + 0.2;
const KNOB = [-87, 47];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SX, 0, 134], [SX + 18, 18, 128], [SX - 18, -18, 128]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH },
);
const { sinA, cosA } = k.cameraOf(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth2 = ([x, y]) => x * cosA + y * sinA;
const byDepth = (points) => [...points].sort((a, b) => depth2(a) - depth2(b));
const path = (points, closed) => k.pathOf(points.map(at), closed);
const halo = (plan, z, h, blur = 0) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"${blur ? ` style="filter:blur(${blur}px)"` : ""}/>`;

// A rectangle drawn on a vertical face y = face, as a closed outline.
const panelY = (face, x0, x1, z0, z1) => path([[x0, face, z0], [x1, face, z0], [x1, face, z1], [x0, face, z1]], true);
const panelX = (face, y0, y1, z0, z1) => path([[face, y0, z0], [face, y1, z0], [face, y1, z1], [face, y0, z1]], true);

// Half of a flat ring (front: the half facing the viewer), shaded like extrude.
function ringHalf(cx, cy, rIn, rOut, z, h, front) {
  const view = Math.atan2(sinA, cosA);
  const steps = 48;
  const from = front ? view - Math.PI / 2 : view + Math.PI / 2;
  const span = Math.PI + (front ? 0 : 0.04);
  const angles = Array.from({ length: steps + 1 }, (_, i) => from - (front ? 0 : 0.02) + (span * i) / steps);
  const arc = (r, zz) => angles.map((a) => [cx + r * Math.cos(a), cy + r * Math.sin(a), zz]);
  const outTop = arc(rOut, z + h);
  const outBot = arc(rOut, z);
  const inTop = arc(rIn, z + h);
  const inBot = arc(rIn, z);
  const top = path([...outTop, ...[...inTop].reverse()], true);
  const buckets = [[], [], [], []];
  const wallTop = front ? outTop : inTop;
  const wallBot = front ? outBot : inBot;
  for (let i = 0; i < steps; i++) {
    const a = (angles[i] + angles[i + 1]) / 2;
    const n = front ? [Math.cos(a), Math.sin(a)] : [-Math.cos(a), -Math.sin(a)];
    const lit = (n[0] * -sinA + n[1] * cosA + 1) / 2;
    const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)));
    buckets[shade].push(path([wallTop[i], wallTop[i + 1], wallBot[i + 1], wallBot[i]], true));
  }
  const fill = front
    ? path([...[...inTop].reverse(), ...outTop.slice(-1), ...[...outBot].reverse(), outTop[0]], true)
    : path([...outTop, ...[...inTop].slice(-1), ...[...inBot].reverse(), inTop[0]], true);
  const outline = front ? path(outBot) + path([outTop[0], outBot[0]]) + path([outTop[steps], outBot[steps]]) : path(outTop) + path(inBot);
  const crease = front ? path(outTop) + path(inTop) : path(inTop);
  return { fill, top, shades: buckets.map((list) => list.join("")), outline, crease };
}

// ---------------------------------------------------------------- static art

function plate() {
  const out = [halo(PLATE, -PLATE_H - FOOT_H, PLATE_H)];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -76, y: PLATE.y + PLATE.d - 15, w: 214, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: -74, y: 28, w: 30, d: 14, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 4.5], [label.x + 22, label.y + 4.5], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 7.5], [label.x + 17, label.y + 7.5], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 10.5], [label.x + 24, label.y + 10.5], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.4, label.y + 7, 0.8]), at([label.x + label.w - 2.4, label.y + 7, 0.8])], { size: 0.4 }));
  return out.join("");
}

function pedestal() {
  const out = [halo(k.insetPlan(PED, -2), 0, 1, 3)];
  const seams = L(k.sideSeam(PED, 8, P, 4) + k.sideSeam(PED, PZ - 6, P, 4), { tone: "faint" });
  out.push(S(k.slabOf(PED, 0, PZ, P, 4, 0.8), { tone: "mid", inner: seams }));
  // access panel and vents on the front face
  const fy = PED.y + PED.d;
  out.push(L(panelY(fy, PED.x + 8, PED.x + 34, 16, 54), { tone: "lo" }));
  out.push(D([[PED.x + 10.5, 18.5], [PED.x + 31.5, 18.5], [PED.x + 10.5, 51.5], [PED.x + 31.5, 51.5]].map(([x, z]) => at([x, fy, z])), { size: 0.45 }));
  for (let i = 0; i < 6; i++) {
    const z = 24 + i * 4.4;
    out.push(L(panelY(fy, PED.x + 14, PED.x + 28, z, z + 1.6), { tone: "lo" }));
  }
  // a cable gland on the front face, low, and a side plate with screws
  out.push(L(k.sideRing([PED.x + 48, fy, 18], 3.2, "y", P, 20), { tone: "lo" }));
  out.push(L(k.sideRing([PED.x + 48, fy, 18], 1.6, "y", P, 16), { tone: "faint" }));
  const sx = PED.x + PED.w;
  out.push(L(panelX(sx, PED.y + 8, PED.y + 40, 20, 50), { tone: "lo" }));
  out.push(D([[PED.y + 10.5, 22.5], [PED.y + 37.5, 22.5], [PED.y + 10.5, 47.5], [PED.y + 37.5, 47.5]].map(([y, z]) => at([sx, y, z])), { size: 0.45 }));
  // screws on the top corners
  out.push(D([[PED.x + 4, PED.y + 4], [PED.x + PED.w - 4, PED.y + 4], [PED.x + PED.w - 4, PED.y + PED.d - 4], [PED.x + 4, PED.y + PED.d - 4]].map(([x, y]) => at([x, y, PZ])), { size: 0.45 }));
  return out.join("");
}

const rodSvg = ([dx, dy], cx, z0, z1) =>
  S(k.cylinder(cx + dx, dy, 2.5, z0, 1.6, P, 16), { tone: "mid" }) + S(k.cylinder(cx + dx, dy, ROD_R, z0 + 1.6, z1 - z0 - 1.6, P, 16), { tone: "mid", crease: "none" });
const rodsSplit = () => {
  const back = RODS.filter(([dx, dy]) => depth2([dx, dy]) < -1);
  const front = RODS.filter(([dx, dy]) => depth2([dx, dy]) >= -1);
  return { back: byDepth(back), front: byDepth(front) };
};

// A screen clip that keeps what lies at x >= face: a blade leaving its housing.
function clipBeyond(id, face) {
  const pts = [];
  for (const x of [face, 600]) for (const y of [-400, 400]) for (const z of [-200, 400]) pts.push(at([x, y, z]));
  const hull = convexHull(pts);
  return `<clipPath id="${id}"><path d="${k.pathOf(hull, true)}"/></clipPath>`;
}
function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// A pusher blade, built at rest with its tip at x = 0, as thick as a token.
function blade(length, z) {
  const plan = { x: -length, y: -4, w: length, d: 8, r: 0.8 };
  return (
    S(k.slabOf(plan, z, TOKEN_H, P, 2, 0.4), { tone: "mid" }) +
    L(k.lineOnTop([-length, -1.6], [0, -1.6], z + TOKEN_H, P) + k.lineOnTop([-length, 1.6], [0, 1.6], z + TOKEN_H, P), { tone: "faint" })
  );
}

function token() {
  return (
    S(k.cylinder(0, 0, TOKEN_R, 0, TOKEN_H, P, 56, 0.6), { tone: "hi", crease: "lo", lit: true }) +
    L(k.ring(0, 0, TOKEN_R - 3.4, TOKEN_H, P, 40), { tone: "lo" }) +
    D([at([0, 0, TOKEN_H])], { size: 0.5, tone: "hi" })
  );
}

function supply() {
  const out = [];
  // pusher housing on the pedestal top
  out.push(S(k.slabOf(SHOUSE, PZ, 12, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(SHOUSE, PZ + 3, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SHOUSE, 2.5), PZ + 12, P, 3), { tone: "faint" }));
  out.push(D([[SHOUSE.x + 4.5, -7.5], [SHOUSE.x + 4.5, 7.5], [SHOUSE.x + SHOUSE.w - 4.5, -7.5], [SHOUSE.x + SHOUSE.w - 4.5, 7.5]].map(([x, y]) => at([x, y, PZ + 12])), { size: 0.45 }));
  // the drive spindle on top of the housing
  out.push(S(k.cylinder(SHOUSE.x + 11, 0, 4, PZ + 12, 3, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(SHOUSE.x + 11, 0, 4, PZ + 12, PZ + 15, 24, P), { tone: "lo" }));
  out.push(L(k.ring(SHOUSE.x + 11, 0, 1.4, PZ + 15, P, 16), { tone: "mid" }));
  const { back, front } = rodsSplit();
  for (const rod of back) out.push(rodSvg(rod, SX, PZ, HOPPER_Z));
  out.push(clipBeyond("tb-sclip", SHOUSE.x + SHOUSE.w));
  out.push(`<g clip-path="url(#tb-sclip)"><g data-part="sblade" transform="${k.translateAlong(P, [SBLADE_REST, 0, 0])}">${blade(24, PZ)}</g></g>`);
  out.push(`<g data-slot="supply"></g>`);
  for (const rod of front) out.push(rodSvg(rod, SX, PZ, HOPPER_Z));
  // the hopper: a canister that holds the reserve of tokens
  out.push(S(k.cylinder(SX, 0, 18, HOPPER_Z, 20, P, 64, 0.8), { tone: "mid", crease: "lo", inner: L(k.sideArc(SX, 0, 18, HOPPER_Z + 3, P, 40), { tone: "faint" }) }));
  out.push(L(k.knurl(SX, 0, 18, HOPPER_Z + 15, HOPPER_Z + 20, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(SX, 0, 18, HOPPER_Z + 15, P, 40), { tone: "faint" }));
  out.push(D([0, 1, 2, 3].map((i) => at([SX + 15 * Math.cos((i * Math.PI) / 2 + 0.6), 15 * Math.sin((i * Math.PI) / 2 + 0.6), HOPPER_Z + 20])), { size: 0.45 }));
  out.push(S(k.cylinder(SX, 0, 12, HOPPER_Z + 20, 3, P, 48, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(SX, 0, 4, HOPPER_Z + 23, 4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(SX, 0, 4, HOPPER_Z + 23, HOPPER_Z + 27, 20, P), { tone: "lo" }));
  return out.join("");
}

function clock() {
  const [x, y] = CLOCK;
  const out = [halo({ x: x - CLOCK_R, y: y - CLOCK_R, w: CLOCK_R * 2, d: CLOCK_R * 2, r: CLOCK_R }, 0, 1, 2)];
  out.push(S(k.cylinder(x, y, CLOCK_R + 1.6, 0, 1.6, P, 56), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, CLOCK_R, 1.6, CLOCK_H, P, 64, 0.8), { tone: "mid", crease: "lo", inner: L(k.sideArc(x, y, CLOCK_R, 4.5, P, 40), { tone: "faint" }) }));
  const top = 1.6 + CLOCK_H;
  out.push(L(k.ring(x, y, CLOCK_R - 1.8, top, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, CLOCK_R - 1.8, 20, 5, top, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.4, top, P, 16), { tone: "mid" }));
  // the crown that sets the rate, beside the clock
  const [kx, ky] = KNOB;
  out.push(S(k.cylinder(kx, ky, 6.4, 0, 1.4, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(kx, ky, 5, 1.4, 5, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(kx, ky, 5, 1.4, 6.4, 30, P), { tone: "lo" }));
  // three detents for the three rates
  const dots = RATES.map((_, i) => {
    const a = rateAngle(i);
    return at([kx + Math.sin(a) * 7.6, ky - Math.cos(a) * 7.6, 0]);
  });
  out.push(D(dots, { size: 0.5, tone: "mid" }));
  return out.join("");
}
const rateAngle = (index) => (-0.9 + index * 0.9);
const knobPointer = (index) => {
  const [kx, ky] = KNOB;
  const a = rateAngle(index);
  return k.lineOnTop([kx, ky], [kx + Math.sin(a) * 4.4, ky - Math.cos(a) * 4.4], 6.4, P);
};
const needleAt = (turn) => {
  const [x, y] = CLOCK;
  const a = turn * Math.PI * 2;
  return k.lineOnTop([x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6], [x + Math.sin(a) * (CLOCK_R - 3), y - Math.cos(a) * (CLOCK_R - 3)], CLOCK_TOP, P);
};

function requestGate() {
  const out = [];
  // the reject flag rides on the back face and lifts above the housing
  out.push(
    `<g data-part="flag">${S(k.slabOf(FLAG, 6, 20, P, 2), { tone: "hi", crease: "lo" })}${L(k.segment([FLAG.x + 4, FLAG.y, 6], [FLAG.x + 4, FLAG.y, 26], P) + k.segment([FLAG.x + FLAG.w - 4, FLAG.y, 6], [FLAG.x + FLAG.w - 4, FLAG.y, 26], P), { tone: "faint" })}</g>`,
  );
  out.push(halo(k.insetPlan(RHOUSE, -1), 0, 1, 2));
  const seams = L(k.sideSeam(RHOUSE, 5, P, 3) + k.sideSeam(RHOUSE, RHOUSE_H - 4, P, 3), { tone: "faint" });
  out.push(S(k.slabOf(RHOUSE, 0, RHOUSE_H, P, 3, 0.6), { tone: "mid", inner: seams }));
  const fy = RHOUSE.y + RHOUSE.d;
  out.push(L(panelY(fy, RHOUSE.x + 5, RHOUSE.x + RHOUSE.w - 5, 9, 19), { tone: "lo" }));
  out.push(D([[RHOUSE.x + 7, 11], [RHOUSE.x + RHOUSE.w - 7, 11], [RHOUSE.x + 7, 17], [RHOUSE.x + RHOUSE.w - 7, 17]].map(([x, z]) => at([x, fy, z])), { size: 0.4 }));
  out.push(L(panelX(RHOUSE.x + RHOUSE.w, -5.4, 5.4, BZ - 0.6, BZ + TOKEN_H + 0.6), { tone: "lo" }));
  out.push(D([[RHOUSE.x + 3.5, RHOUSE.y + 3.5], [RHOUSE.x + RHOUSE.w - 3.5, RHOUSE.y + 3.5], [RHOUSE.x + 3.5, RHOUSE.y + RHOUSE.d - 3.5], [RHOUSE.x + RHOUSE.w - 3.5, RHOUSE.y + RHOUSE.d - 3.5]].map(([x, y]) => at([x, y, RHOUSE_H])), { size: 0.45 }));
  const [bx, by] = BUTTON;
  out.push(S(k.cylinder(bx, by, 7, RHOUSE_H, 1.6, P, 40), { tone: "mid" }));
  out.push(L(k.ring(bx, by, 5.4, RHOUSE_H + 1.6, P, 32), { tone: "faint" }));
  out.push(
    `<g data-part="button">${S(k.cylinder(bx, by, 4.8, RHOUSE_H + 1.6, 5, P, 32, 0.4), { tone: "mid" })}${L(k.knurl(bx, by, 4.8, RHOUSE_H + 1.6, RHOUSE_H + 6.6, 26, P), { tone: "lo" })}${L(k.ring(bx, by, 2.4, RHOUSE_H + 6.6, P, 20), { tone: "faint" })}</g>`,
  );
  return out.join("");
}

function scalePost() {
  const plan = { x: 12, y: -16, w: 4, d: 4, r: 0.6 };
  const out = [S(k.slabOf(plan, BZ, RING_Z - BZ, P, 2), { tone: "mid", crease: "none" })];
  const face = plan.y + plan.d;
  const minor = [];
  const major = [];
  for (let i = 0; i <= CAPACITY; i++) {
    const z = BZ + TOKEN_H * i + (i === 0 ? 0.6 : 0);
    const long = i % 4 === 0;
    (long ? major : minor).push(k.segment([plan.x, face, z], [plan.x + (long ? 3 : 1.8), face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}

function bucket() {
  const out = [];
  out.push(halo(k.insetPlan(BLOCK, -2), 0, 1, 3));
  const seams = L(k.sideSeam(BLOCK, 6, P, 4), { tone: "faint" });
  out.push(S(k.slabOf(BLOCK, 0, BZ, P, 4, 0.8), { tone: "mid", inner: seams }));
  // the slot the token leaves by, on the +x face, and the entry slot on the -x side
  out.push(L(panelX(BLOCK.x + BLOCK.w, -TOKEN_R - 1, TOKEN_R + 1, BZ - 2.2, BZ - 0.6), { tone: "lo" }));
  const fy = BLOCK.y + BLOCK.d;
  out.push(L(panelY(fy, BLOCK.x + 8, BLOCK.x + BLOCK.w - 8, 9, 13), { tone: "lo" }));
  out.push(D([[BLOCK.x + 5, 11], [BLOCK.x + BLOCK.w - 5, 11]].map(([x, z]) => at([x, fy, z])), { size: 0.4 }));
  out.push(D([[BLOCK.x + 4, BLOCK.y + 4], [BLOCK.x + BLOCK.w - 4, BLOCK.y + 4], [BLOCK.x + BLOCK.w - 4, BLOCK.y + BLOCK.d - 4], [BLOCK.x + 4, BLOCK.y + BLOCK.d - 4]].map(([x, y]) => at([x, y, BZ])), { size: 0.45 }));
  // the floor seat the stack stands on
  out.push(L(k.ring(0, 0, TOKEN_R + 0.8, BZ, P, 48), { tone: "faint" }));
  return out.join("");
}

function trayFloor() {
  const out = [halo(k.insetPlan(TRAY, -1), 0, 1, 2)];
  out.push(S(k.slabOf(TRAY, 0, BZ, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(TRAY, 6, P, 3), { tone: "faint" }) }));
  out.push(L(k.lineOnTop([TRAY.x, -7], [TRAY.x + TRAY.w, -7], BZ, P) + k.lineOnTop([TRAY.x, 7], [TRAY.x + TRAY.w, 7], BZ, P), { tone: "faint" }));
  const fy = TRAY.y + TRAY.d;
  out.push(D([[TRAY.x + 6, 13], [TRAY.x + TRAY.w - 6, 13]].map(([x, z]) => at([x, fy, z])), { size: 0.4 }));
  return out.join("");
}

function binBack() {
  const out = [];
  out.push(halo({ x: BIN_X - 2, y: -20, w: BIN_TO - BIN_X + 4, d: 40, r: 2 }, 0, 1, 2));
  out.push(S(k.slabOf({ x: BIN_X, y: -18, w: BIN_TO - BIN_X, d: 36, r: 1.5 }, 0, 2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: BIN_X, y: -18, w: BIN_TO - BIN_X, d: 2, r: 0.5 }, 2, BIN_H - 2, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 40, y: TRAY.y, w: TRAY.x + TRAY.w - 40, d: 2, r: 0.5 }, BZ, 4, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([44, TRAY.y + 1, BZ + 4]), at([TRAY.x + TRAY.w - 4, TRAY.y + 1, BZ + 4])], { size: 0.4 }));
  return out.join("");
}

function binFront() {
  const out = [];
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y + TRAY.d - 2, w: TRAY.w, d: 2, r: 0.5 }, BZ, 4, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([TRAY.x + 4, TRAY.y + TRAY.d - 1, BZ + 4]), at([TRAY.x + TRAY.w - 4, TRAY.y + TRAY.d - 1, BZ + 4])], { size: 0.4 }));
  const wall = { x: BIN_X, y: 16, w: BIN_TO - BIN_X, d: 2, r: 0.5 };
  out.push(S(k.slabOf(wall, 2, BIN_H - 2, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: BIN_TO - 2, y: -16, w: 2, d: 32, r: 0.5 }, 2, BIN_H - 2, P, 2, 0.3), { tone: "mid" }));
  out.push(L(panelY(18, BIN_X + 6, BIN_TO - 8, 6, 11), { tone: "lo" }));
  out.push(D([at([BIN_X + 3, 18, 8.5]), at([BIN_TO - 5, 18, 8.5])], { size: 0.4 }));
  return out.join("");
}

function chute() {
  const out = [];
  const floor = S(k.slabOf(CHUTE, PZ - 4, 4, P, 2, 0.4), { tone: "mid" });
  out.push(floor);
  out.push(L(k.lineOnTop([CHUTE.x, 0], [CHUTE.x + CHUTE.w, 0], PZ, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: CHUTE_WALL_X, y: CHUTE.y, w: CHUTE.x + CHUTE.w - CHUTE_WALL_X, d: 2, r: 0.5 }, PZ, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([CHUTE_WALL_X + 4, CHUTE.y + 1, PZ + 5]), at([CHUTE.x + CHUTE.w - 4, CHUTE.y + 1, PZ + 5])], { size: 0.4 }));
  return out.join("");
}

function chuteFront() {
  const out = [];
  const wall = { x: CHUTE_WALL_X, y: CHUTE.y + CHUTE.d - 2, w: CHUTE.x + CHUTE.w - CHUTE_WALL_X, d: 2, r: 0.5 };
  out.push(S(k.slabOf(wall, PZ, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([CHUTE_WALL_X + 4, wall.y + 1, PZ + 5]), at([wall.x + wall.w - 4, wall.y + 1, PZ + 5])], { size: 0.4 }));
  return out.join("");
}

const { back: RODS_BACK, front: RODS_FRONT } = rodsSplit();
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A token bucket rate limiter built as a coin dispenser. A clock on the left pushes one token from a supply hopper down a chute into a tube that holds at most eight. Each request presses a button that slides a pusher under the tube: if a token is there it is pushed out to the tray and the request goes through; if the tube is empty the pusher finds nothing and a flag goes up.",
  body: [
    `<defs>${clipBeyond("tb-rclip", RHOUSE.x + RHOUSE.w)}</defs>`,
    plate(),
    pedestal(),
    supply(),
    clock(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(0)}" style="stroke-width:1"/>`,
    `<path data-part="knob" class="iso-line" data-tone="hi" data-free="end" d="${knobPointer(RATE_AT)}" style="stroke-width:1"/>`,
    requestGate(),
    bucket(),
    trayFloor(),
    scalePost(),
    ...RODS_BACK.map((rod) => rodSvg(rod, 0, BZ, RING_Z)),
    S(ringHalf(0, 0, RING_IN, RING_OUT, RING_Z, RING_H, false), { tone: "mid" }),
    `<g clip-path="url(#tb-rclip)"><g data-part="rblade" transform="${k.translateAlong(P, [RBLADE_REST, 0, 0])}">${blade(40, BZ)}</g></g>`,
    `<g data-slot="eject"></g>`,
    `<g data-slot="stack"></g>`,
    `<g data-slot="drop"></g>`,
    ...RODS_FRONT.map((rod) => rodSvg(rod, 0, BZ, RING_Z)),
    S(ringHalf(0, 0, RING_IN, RING_OUT, RING_Z, RING_H, true), { tone: "mid" }),
    D([45, 135, 225, 315].map((deg) => at([16 * Math.cos((deg * Math.PI) / 180), 16 * Math.sin((deg * Math.PI) / 180), RING_Z + RING_H])).filter((_, i) => i !== 2), { size: 0.4 }),
    binBack(),
    `<g data-slot="out"></g>`,
    binFront(),
    chute(),
    `<g data-slot="chute"></g>`,
    chuteFront(),
    `<template id="tb-token">${token()}</template>`,
  ],
});

const DATA = {
  P,
  CAPACITY,
  RATES,
  RATE_AT,
  TOKEN_H,
  SX,
  PZ,
  SUPPLY_LEVELS,
  SBLADE_REST,
  STROKE,
  CHUTE_END,
  BZ,
  RING_TOP: RING_Z + RING_H,
  RBLADE_REST,
  TRAY_END: TRAY.x + TRAY.w,
  BIN_MID: (BIN_X + BIN_TO) / 2,
  FLAG_LIFT,
  CLOCK,
  CLOCK_R,
  CLOCK_TOP,
  KNOB,
};

const live = `
const DATA = ${JSON.stringify(DATA)};
const { P, CAPACITY, RATES, TOKEN_H, SX, PZ, SUPPLY_LEVELS, SBLADE_REST, STROKE, CHUTE_END, BZ, RING_TOP, RBLADE_REST, TRAY_END, BIN_MID, FLAG_LIFT, CLOCK, CLOCK_R, CLOCK_TOP, KNOB } = DATA;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const slot = { supply: $('[data-slot="supply"]'), chute: $('[data-slot="chute"]'), drop: $('[data-slot="drop"]'), stack: $('[data-slot="stack"]'), eject: $('[data-slot="eject"]'), out: $('[data-slot="out"]') };
const sblade = $('[data-part="sblade"]'), rblade = $('[data-part="rblade"]'), flag = $('[data-part="flag"]'), button = $('[data-part="button"]');
const needle = $('[data-part="needle"]'), knob = $('[data-part="knob"]');
const readout = document.querySelector("[data-readout]");
const art = document.getElementById("tb-token").innerHTML;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const G = 900;

const make = (x, y, z, where) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.innerHTML = art;
  const t = { el, x, y, z, vz: 0, vx: 0, age: 0, alpha: 1, where: null };
  move(t, where);
  place(t);
  return t;
};
const move = (t, where) => {
  if (t.where === where) return;
  t.where = where;
  if (where === "stack" || where === "supply") {
    const list = [...slot[where].children];
    const above = list.find((node) => Number(node.dataset.z) > t.z);
    slot[where].insertBefore(t.el, above || null);
  } else slot[where].appendChild(t.el);
};
const place = (t) => {
  t.el.dataset.z = t.z;
  t.el.setAttribute("transform", translateAlong(P, [t.x, t.y, t.z]));
  if (t.alpha < 1) t.el.setAttribute("opacity", Math.max(0, t.alpha).toFixed(3));
};

// state
let rate = DATA.RATE_AT;
const supplyStack = Array.from({ length: SUPPLY_LEVELS }, (_, i) => make(SX, 0, PZ + TOKEN_H * i, "supply"));
const stack = Array.from({ length: 5 }, (_, i) => make(0, 0, BZ + TOKEN_H * i, "stack"));
let ready = make(CHUTE_END, 0, PZ, "chute");
let kicked = null;      // a token on its way from the supply to the chute end
const falling = [];     // tokens dropping into the tube
const leaving = [];     // tokens pushed out by a request
let phase = 0.25;       // clock: fraction of the way to the next token
let sStroke = null;     // supply pusher stroke age
let rStroke = null;     // request pusher stroke { age, token }
let flagUp = { x: 0, v: 0 }, flagAt = -9;
let allowed = 0, rejected = 0, last = "";
let clockT = 0;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sTip = (age) => {
  if (age < 0.07) return smooth(0, 0.07, age) * STROKE;
  return STROKE * (1 - smooth(0.07, 0.36, age));
};
const rTip = (age) => {
  if (age < 0.14) return smooth(0, 0.14, age) * STROKE;
  return STROKE * (1 - smooth(0.16, 0.38, age));
};
const R_CYCLE = 0.4;

function tick() {
  // one token every 1/rate seconds, if there is room for it
  const room = stack.length + falling.length < CAPACITY;
  if (room && ready) {
    ready.age = 0; ready.vz = 0;
    falling.push(ready);
    ready = null;
    if (!kicked) startSupply();
  }
}
function startSupply() {
  const t = supplyStack.shift();
  t.age = 0;
  kicked = t;
  sStroke = 0;
  supplyStack.push(make(SX, 0, PZ + TOKEN_H * SUPPLY_LEVELS, "supply"));
}
function request() {
  if (rStroke !== null) return false;
  const t = stack.length ? stack.shift() : null;
  rStroke = { age: 0, token: t };
  if (t) { allowed++; last = "allowed"; t.age = 0; t.vx = 0; leaving.push(t); }
  else { rejected++; last = "rejected"; flagAt = clockT; }
  return true;
}

function step(dt, calm) {
  clockT += dt;
  const period = 1 / RATES[rate];
  phase += dt / period;
  while (phase >= 1) { phase -= 1; tick(); }
  const a = calm ? 10 : dt;   // animation time: instant under reduced motion

  // supply pusher and the kicked token
  if (sStroke !== null) {
    sStroke += a;
    if (sStroke > 0.4) sStroke = null;
  }
  const sOut = sStroke === null ? 0 : sTip(sStroke);
  sblade.setAttribute("transform", translateAlong(P, [SBLADE_REST + sOut, 0, 0]));
  if (kicked) {
    kicked.age += a;
    const u = Math.min(1, kicked.age / 0.55);
    kicked.x = SX + (CHUTE_END - SX) * (1 - Math.pow(1 - u, 3));
    move(kicked, kicked.x - SX > 15 ? "chute" : "supply");
    place(kicked);
    if (u >= 1) { ready = kicked; kicked = null; }
  }
  // the supply stack drops once the blade is back out from under it
  const sBlocked = sStroke !== null && sOut > 1;
  supplyStack.forEach((t, i) => fall(t, PZ + TOKEN_H * (i + (sBlocked ? 1 : 0)), a));

  // tokens dropping into the tube
  for (let i = falling.length - 1; i >= 0; i--) {
    const t = falling[i];
    t.age += a;
    t.x = CHUTE_END + (0 - CHUTE_END) * smooth(0, 0.19, t.age);
    const target = BZ + TOKEN_H * (stack.length + i) + (rBlocked() ? TOKEN_H : 0);
    if (t.age > 0.13) { t.vz += G * a; t.z = Math.max(target, t.z - t.vz * a); }
    move(t, t.z < RING_TOP + 0.5 ? "drop" : "chute");
    if (t.age > 0.19 && t.z <= target + 1e-6) {
      falling.splice(i, 1);
      t.vz = 0;
      stack.push(t);
      move(t, "stack");
    }
    place(t);
  }

  // the request pusher, and what it pushes
  let rOut = 0;
  if (rStroke) {
    rStroke.age += a;
    rOut = rTip(Math.min(rStroke.age, 0.38));
    if (rStroke.age > R_CYCLE) rStroke = null;
  }
  rblade.setAttribute("transform", translateAlong(P, [RBLADE_REST + rOut, 0, 0]));
  button.setAttribute("transform", translateAlong(P, [0, 0, -2 * Math.min(1, rOut / 6)]));
  for (let i = leaving.length - 1; i >= 0; i--) {
    const t = leaving[i];
    t.age += a;
    if (t.age < 0.14) t.x = Math.max(t.x, RBLADE_REST + rOut + TOKEN_H * 0 + 14);
    else {
      if (!t.vx) t.vx = 260;
      t.vx = Math.max(90, t.vx - 160 * a);
      t.x = Math.min(BIN_MID, t.x + t.vx * a);
      if (t.x > TRAY_END - 13 + 4) { t.vz += G * a; t.z = Math.max(2, t.z - t.vz * a); }
      if (t.z <= 2) { t.rest = (t.rest || 0) + a; t.alpha = 1 - smooth(0.3, 0.9, t.rest); }
    }
    move(t, t.x > 26 ? "out" : "eject");
    place(t);
    if (t.alpha <= 0) { t.el.remove(); leaving.splice(i, 1); }
  }
  // the stack rests on the blade until it pulls back
  stack.forEach((t, i) => fall(t, BZ + TOKEN_H * i + (rBlocked() ? TOKEN_H : 0), a));

  // the flag
  const up = clockT - flagAt < 0.9 ? 1 : 0;
  if (calm) { flagUp.x = up; flagUp.v = 0; }
  else for (let s = 0; s < 4; s++) { flagUp.v += ((up - flagUp.x) * 260 - flagUp.v * 22) * dt / 4; flagUp.x += flagUp.v * dt / 4; }
  flag.setAttribute("transform", translateAlong(P, [0, 0, FLAG_LIFT * Math.max(0, flagUp.x)]));

  needle.setAttribute("d", needleAt(calm ? 0 : phase));
}
const rBlocked = () => rStroke !== null && rTip(Math.min(rStroke.age, 0.38)) > 1;
function fall(t, want, a) {
  if (t.z > want + 1e-6) { t.vz += G * a; t.z = Math.max(want, t.z - t.vz * a); place(t); }
  else if (t.z < want) { t.z = want; t.vz = 0; place(t); }
  else t.vz = 0;
}
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const knobPointer = ${knobPointer.toString().replace("k.lineOnTop", "lineOnTop")};
const rateAngle = ${rateAngle.toString()};

function say() {
  const n = stack.length;
  const r = RATES[rate];
  const fill = n >= CAPACITY ? "full · " + n + " of " + CAPACITY : n + " of " + CAPACITY + " tokens";
  const text = fill + " · +" + (r < 1 ? "½" : r) + "/s" + (last ? " · last " + last : "");
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(rate));
  stage.setAttribute("aria-valuetext", "Refill " + RATES[rate] + " tokens a second; " + allowed + " requests allowed, " + rejected + " rejected");
}

// idle tour: a few requests, a burst that drains the tube, then a rest that refills it
const TOUR = [1.2, 1.8, 2.4, 18, 18.6];
const FLOOD = [5, 12.5];
const TOUR_LEN = 24;
let touring = !still.matches, tourT = 0, tourI = 0, idleTimer = 0, holding = false, holdT = 0;
let frame = 0, lastNow = 0, visible = false;
function loop(now) {
  const dt = lastNow ? Math.min((now - lastNow) / 1000, 1 / 30) : 1 / 60;
  lastNow = now;
  const calm = still.matches;
  if (touring) {
    tourT += dt;
    while (tourI < TOUR.length && tourT >= TOUR[tourI]) { request(); tourI++; }
    if (tourT >= FLOOD[0] && tourT < FLOOD[1] && rStroke === null) request();
    if (tourT >= TOUR_LEN) { tourT = 0; tourI = 0; }
  }
  if (holding) { holdT += dt; if (rStroke === null) request(); }
  step(dt, calm);
  say();
  frame = visible ? requestAnimationFrame(loop) : 0;
}
const run = () => { if (!frame && visible) { lastNow = 0; frame = requestAnimationFrame(loop); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const quiet = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; tourT = 0; tourI = 0; }, 3600); };
const press = () => { quiet(); request(); describe(); };
const setRate = (to) => { rate = Math.max(0, Math.min(RATES.length - 1, to)); knob.setAttribute("d", knobPointer(rate)); describe(); };
stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  holding = true; holdT = 0;
  quiet(); request();
  stage.setPointerCapture?.(event.pointerId);
});
const release = () => { if (holding) { holding = false; describe(); quiet(); } };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); press(); return; }
  let to = null;
  if (event.key === "ArrowUp" || event.key === "ArrowRight") to = rate + 1;
  if (event.key === "ArrowDown" || event.key === "ArrowLeft") to = rate - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = RATES.length - 1;
  if (to === null) return;
  event.preventDefault();
  quiet();
  setRate(to);
});
stack.forEach(place);
describe();
step(0, still.matches);
say();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Token bucket",
  hint: "Click: request · hold: flood · ↑↓ rate",
  readout: `5 of ${CAPACITY} tokens · +1/s`,
  keys: [
    { mark: "lit", label: "Tokens: one is spent per request that gets through" },
    { mark: "raised", label: "The tube holds 8: the burst the limiter allows" },
  ],
  caption:
    "A token bucket rate limiter as a coin dispenser. The clock on the left drops one token into the tube every second (½, 1 or 2 a second with the arrow keys); while the tube holds eight the clock’s ticks are wasted, so it never holds more. Every request slides the pusher under the tube: if a token is there it goes out to the tray and the request is allowed, if the tube is empty the flag goes up and the request is rejected. Bursts of up to eight pass at once; after that, requests get through only as fast as tokens arrive.",
  body: `<div class="iso-stage" tabindex="0" role="slider" style="touch-action:pan-y;cursor:pointer" aria-label="Token bucket: press Space or click to send a request, hold to send many; arrow keys change the refill rate" aria-valuemin="0" aria-valuemax="${RATES.length - 1}" aria-valuenow="${RATE_AT}">${svg}</div>`,
});

const name = theme === "light" ? "token-bucket-light.html" : "token-bucket.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Token bucket", theme, body, script: kitScript() + live }));
console.log("wrote", name);
