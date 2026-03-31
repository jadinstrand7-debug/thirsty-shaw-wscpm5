import { useEffect, useRef, useState } from "react";

const CW = 800;
const CH = 400;
const GRAVITY = 0.42;
const BALL_R = 12;
const HEAD_R = 10;
const PW = 30;
const PH = 82;
const FLOOR_Y = CH - 4;
const CHARGE_RATE = 2.8; // fills in ~0.6 seconds

const HOOPS = [
  {
    side: "left" as const,
    bx1: 14,
    bx2: 23,
    by1: 118,
    by2: 202,
    rimY: 170,
    rimX1: 23,
    rimX2: 72,
    aimX: 47,
  },
  {
    side: "right" as const,
    bx1: 777,
    bx2: 786,
    by1: 118,
    by2: 202,
    rimY: 170,
    rimX1: 728,
    rimX2: 777,
    aimX: 753,
  },
];

type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  skinColor: string;
  speed: number;
  vy: number;
  vx: number;
};

type Ball = {
  x: number;
  y: number;
  prevY: number;
  r: number;
  vx: number;
  vy: number;
  scoringThrough: boolean;
  scoringHoopY: number;
  shotFromX: number;
  guidedMake: "left" | "right" | null;
};

type ShotAnim = {
  active: boolean;
  type: "jump" | "fadeaway" | "layup" | "dunk";
  phase: number;
  leanDir: number;
};
type CrossoverState = {
  active: boolean;
  phase: number;
  fromSide: number;
  type: "crossover" | "btb";
};

type GameState = {
  player1: Player;
  player2: Player;
  ball: Ball;
  score: { p1: number; p2: number };
  ballHolder: "p1" | "p2" | null;
  dribblePhase: number;
  keys: Record<string, boolean>;
  animId: number;
  lastShot: { p1: number; p2: number };
  p1Charging: boolean;
  p1Charge: number;
  p2Charging: boolean;
  p2Charge: number;
  p1Anim: ShotAnim;
  p2Anim: ShotAnim;
  pickupCooldown: number;
  // Crossover
  p1Crossover: CrossoverState;
  p2Crossover: CrossoverState;
  dribbleSide: number; // +1 or -1, flips on crossover
  // Reach-in steal
  p1Reaching: boolean;
  p1ReachPhase: number;
  p1ReachCooldown: number;
  p2Reaching: boolean;
  p2ReachPhase: number;
  p2ReachCooldown: number;
  // Run phase (for stride animation when not holding ball)
  p1RunPhase: number;
  p2RunPhase: number;
  // Follow-through pose after shooting (held until ball contacts something)
  p1FollowThrough: boolean;
  p2FollowThrough: boolean;
  // Stamina
  p1Stamina: number;
  p2Stamina: number;
  p1Exhausted: boolean;
  p2Exhausted: boolean;
  // Ankle breaker
  p1AnkleBroken: boolean;
  p1AnkleBrokenFrames: number;
  p2AnkleBroken: boolean;
  p2AnkleBrokenFrames: number;
  anklePopup: { active: boolean; frames: number; x: number; y: number };
  dunkPopup: { active: boolean; frames: number; x: number; y: number };
  greenPopup: { active: boolean; frames: number; x: number; y: number };
  foulPopup: { active: boolean; frames: number; x: number; y: number };
  blockPopup: { active: boolean; frames: number; x: number; y: number };
  p1BlockCooldown: number;
  p2BlockCooldown: number;
  lastScorer: "p1" | "p2" | null;
};

function makeShotAnim(): ShotAnim {
  return { active: false, type: "jump", phase: 0, leanDir: 0 };
}

function createState(): GameState {
  return {
    player1: {
      x: 120,
      y: FLOOR_Y - PH,
      w: PW,
      h: PH,
      color: "#3b82f6",
      skinColor: "#fcd9b4",
      speed: 4,
      vy: 0,
      vx: 0,
    },
    player2: {
      x: 640,
      y: FLOOR_Y - PH,
      w: PW,
      h: PH,
      color: "#ef4444",
      skinColor: "#fcd9b4",
      speed: 4,
      vy: 0,
      vx: 0,
    },
    ball: {
      x: CW / 2,
      y: 30,
      prevY: 30,
      r: BALL_R,
      vx: 0,
      vy: 0,
      scoringThrough: false,
      scoringHoopY: 0,
      shotFromX: CW / 2,
      guidedMake: null,
    },
    score: { p1: 0, p2: 0 },
    ballHolder: null,
    dribblePhase: 0,
    keys: {},
    animId: 0,
    lastShot: { p1: 0, p2: 0 },
    p1Charging: false,
    p1Charge: 0,
    p2Charging: false,
    p2Charge: 0,
    p1Anim: makeShotAnim(),
    p2Anim: makeShotAnim(),
    pickupCooldown: 0,
    p1Crossover: {
      active: false,
      phase: 0,
      fromSide: 1,
      type: "crossover" as const,
    },
    p2Crossover: {
      active: false,
      phase: 0,
      fromSide: -1,
      type: "crossover" as const,
    },
    dribbleSide: 1,
    p1Reaching: false,
    p1ReachPhase: 0,
    p1ReachCooldown: 0,
    p2Reaching: false,
    p2ReachPhase: 0,
    p2ReachCooldown: 0,
    p1RunPhase: 0,
    p2RunPhase: 0,
    p1FollowThrough: false,
    p2FollowThrough: false,
    p1Stamina: 100,
    p2Stamina: 100,
    p1Exhausted: false,
    p2Exhausted: false,
    p1AnkleBroken: false,
    p1AnkleBrokenFrames: 0,
    p2AnkleBroken: false,
    p2AnkleBrokenFrames: 0,
    anklePopup: { active: false, frames: 0, x: 0, y: 0 },
    dunkPopup: { active: false, frames: 0, x: 0, y: 0 },
    greenPopup: { active: false, frames: 0, x: 0, y: 0 },
    foulPopup: { active: false, frames: 0, x: 0, y: 0 },
    blockPopup: { active: false, frames: 0, x: 0, y: 0 },
    p1BlockCooldown: 0,
    p2BlockCooldown: 0,
    lastScorer: null,
  };
}

function defenderDist(holder: Player, defender: Player) {
  return Math.sqrt((defender.x - holder.x) ** 2 + (defender.y - holder.y) ** 2);
}

function calcGreenZone(dist: number): { start: number; end: number } {
  const t = Math.max(0, Math.min(1, (dist - 40) / 260));
  const width = 6 + t * 14;
  return { start: 65 - width / 2, end: 65 + width / 2 };
}

function calcBasePct(dist: number): number {
  const t = Math.max(0, Math.min(1, (dist - 40) / 260));
  return 0.15 + t * 0.72;
}

// Calculates shot velocity, adaptively increasing vx to keep arc inside canvas
function calcShootVelocity(
  cx: number,
  launchY: number,
  aimX: number,
  aimY: number,
  startSpeed = 6
) {
  const dx = aimX - cx;
  const sign = dx >= 0 ? 1 : -1;
  let speed = startSpeed;
  for (let attempt = 0; attempt < 12; attempt++) {
    const vx = sign * speed;
    const T = Math.abs(dx / vx);
    const vy = (aimY - launchY - 0.5 * GRAVITY * T * T) / T;
    // Peak y = launchY - vy²/(2g). Must stay >= BALL_R+2
    const peakY = vy < 0 ? launchY - (vy * vy) / (2 * GRAVITY) : launchY;
    if (peakY >= BALL_R + 2) return { vx, vy };
    speed *= 1.3;
  }
  const vx = sign * speed;
  const T = Math.abs(dx / vx);
  return { vx, vy: (aimY - launchY - 0.5 * GRAVITY * T * T) / T };
}

const NET_COLS = 8;
const NET_RINGS = 4;
const NET_H = 28;
const SPRING_DAMP = 0.8;
// Pre-built strings — avoids template-literal allocation every frame
const NET_VERT = "rgba(220,220,220,0.35)";
const NET_DIM = "rgba(220,220,220,0.25)";
const NET_BOLD = "rgba(220,220,220,0.45)";
// Pre-allocated node-position cache: [hoop 0/1][ring][col] = {x, y}
// Filled each frame in drawHoops, read by both vertical and horizontal loops
const _netCache: Array<Array<Array<{ x: number; y: number }>>> = [
  Array.from({ length: NET_RINGS }, () =>
    Array.from({ length: NET_COLS + 1 }, () => ({ x: 0, y: 0 }))
  ),
  Array.from({ length: NET_RINGS }, () =>
    Array.from({ length: NET_COLS + 1 }, () => ({ x: 0, y: 0 }))
  ),
];

function useGame(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onWin: (winner: "p1" | "p2") => void
) {
  const stateRef = useRef<GameState>(createState());
  const netRef = useRef({
    left: Array.from({ length: NET_RINGS }, () =>
      Array.from({ length: NET_COLS + 1 }, () => ({ dy: 0, vy: 0 }))
    ),
    right: Array.from({ length: NET_RINGS }, () =>
      Array.from({ length: NET_COLS + 1 }, () => ({ dy: 0, vy: 0 }))
    ),
  });
  const [score, setScore] = useState({ p1: 0, p2: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    // Guard against missing fields after hot-reload
    if (!s.dunkPopup) s.dunkPopup = { active: false, frames: 0, x: 0, y: 0 };
    if (!s.greenPopup) s.greenPopup = { active: false, frames: 0, x: 0, y: 0 };
    if (!s.foulPopup) s.foulPopup = { active: false, frames: 0, x: 0, y: 0 };
    if (!s.blockPopup) s.blockPopup = { active: false, frames: 0, x: 0, y: 0 };
    if (s.p1BlockCooldown === undefined) s.p1BlockCooldown = 0;
    if (s.p2BlockCooldown === undefined) s.p2BlockCooldown = 0;
    if (!s.lastScorer) s.lastScorer = null;
    // Re-init netRef if it's in the old flat format (hot-reload shape mismatch)
    if (!Array.isArray(netRef.current.left[0])) {
      netRef.current.left = Array.from({ length: NET_RINGS }, () =>
        Array.from({ length: NET_COLS + 1 }, () => ({ dy: 0, vy: 0 }))
      );
      netRef.current.right = Array.from({ length: NET_RINGS }, () =>
        Array.from({ length: NET_COLS + 1 }, () => ({ dy: 0, vy: 0 }))
      );
    }

    // ── Static offscreen canvas — court background + hoop structure drawn once ──
    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = CW;
    staticCanvas.height = CH;
    const sc = staticCanvas.getContext("2d")!;
    // Court
    sc.fillStyle = "#1a1a2e";
    sc.fillRect(0, 0, CW, CH);
    sc.fillStyle = "#16213e";
    sc.fillRect(0, FLOOR_Y, CW, CH - FLOOR_Y);
    sc.strokeStyle = "#f59e0b44";
    sc.lineWidth = 2;
    sc.setLineDash([12, 8]);
    sc.beginPath();
    sc.moveTo(CW / 2, 0);
    sc.lineTo(CW / 2, FLOOR_Y);
    sc.stroke();
    sc.setLineDash([]);
    sc.beginPath();
    sc.arc(CW / 2, FLOOR_Y / 2 + 30, 60, 0, Math.PI * 2);
    sc.stroke();
    sc.fillStyle = "#f59e0b";
    sc.fillRect(0, FLOOR_Y, CW, 4);
    // Hoop structure (pole, backboard, bracket, rim — net is dynamic)
    for (const h of HOOPS) {
      const poleX = (h.bx1 + h.bx2) / 2;
      sc.fillStyle = "#374151";
      sc.fillRect(poleX - 3, h.by2, 6, FLOOR_Y - h.by2);
      sc.fillStyle = "#94a3b8";
      sc.fillRect(h.bx1, h.by1, h.bx2 - h.bx1, h.by2 - h.by1);
      sc.strokeStyle = "#cbd5e1";
      sc.lineWidth = 1.5;
      sc.strokeRect(h.bx1, h.by1, h.bx2 - h.bx1, h.by2 - h.by1);
      sc.strokeStyle = "#f97316";
      sc.lineWidth = 1;
      sc.strokeRect(h.bx1 + 2, h.by1 + 14, h.bx2 - h.bx1 - 4, 22);
      const bracketX = h.side === "left" ? h.bx2 : h.bx1;
      sc.fillStyle = "#6b7280";
      sc.fillRect(bracketX - 1, h.rimY - 4, 3, 8);
      sc.strokeStyle = "#f97316";
      sc.lineWidth = 4;
      sc.lineCap = "round";
      sc.beginPath();
      sc.moveTo(h.rimX1, h.rimY);
      sc.lineTo(h.rimX2, h.rimY);
      sc.stroke();
    }
    // ── 60fps cap — prevents doubling work on 120/144Hz displays ──
    let _lastFrameTime = 0;

    const PREVENT = [
      " ",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "/",
      "f",
      "F",
      "c",
      "C",
      ".",
      "v",
      "V",
      "l",
      "L",
    ];

    const onKeyDown = (e: KeyboardEvent) => {
      if (PREVENT.includes(e.key)) e.preventDefault();
      const wasDown = s.keys[e.key];
      s.keys[e.key] = true;
      if (!wasDown) {
        // Shoot charge
        if (
          (e.key === "f" || e.key === "F") &&
          s.ballHolder === "p1" &&
          !s.p1Charging
        ) {
          s.p1Charging = true;
          s.p1Charge = 0;
          if (s.player1.y >= FLOOR_Y - PH - 1) s.player1.vy = -10;
        }
        if (e.key === "/" && s.ballHolder === "p2" && !s.p2Charging) {
          s.p2Charging = true;
          s.p2Charge = 0;
          if (s.player2.y >= FLOOR_Y - PH - 1) s.player2.vy = -10;
        }
        // C = crossover/behind-the-back (if P1 has ball) OR reach-in (if P1 doesn't)
        if (e.key === "c" || e.key === "C") {
          if (s.ballHolder === "p1" && !s.p1Crossover.active) {
            const moveType =
              Math.random() < 0.38 ? ("btb" as const) : ("crossover" as const);
            s.p1Crossover = {
              active: true,
              phase: 0,
              fromSide: s.dribbleSide,
              type: moveType,
            };
          } else if (
            s.ballHolder !== "p1" &&
            s.p1ReachCooldown <= 0 &&
            !s.p1AnkleBroken &&
            !s.p1Reaching
          ) {
            s.p1Reaching = true;
            s.p1ReachPhase = 0;
          }
        }
        // . = crossover/behind-the-back (if P2 has ball) OR reach-in (if P2 doesn't)
        if (e.key === ".") {
          if (s.ballHolder === "p2" && !s.p2Crossover.active) {
            const moveType =
              Math.random() < 0.38 ? ("btb" as const) : ("crossover" as const);
            s.p2Crossover = {
              active: true,
              phase: 0,
              fromSide: -s.dribbleSide,
              type: moveType,
            };
          } else if (
            s.ballHolder !== "p2" &&
            s.p2ReachCooldown <= 0 &&
            !s.p2AnkleBroken &&
            !s.p2Reaching
          ) {
            s.p2Reaching = true;
            s.p2ReachPhase = 0;
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      s.keys[e.key] = false;
      if ((e.key === "f" || e.key === "F") && s.p1Charging) {
        if (s.ballHolder === "p1") shoot("p1", s.p1Charge);
        s.p1Charging = false;
        s.p1Charge = 0;
      }
      if (e.key === "/" && s.p2Charging) {
        if (s.ballHolder === "p2") shoot("p2", s.p2Charge);
        s.p2Charging = false;
        s.p2Charge = 0;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    function resetAfterFoul(fouledPlayer: "p1" | "p2") {
      // Reset players to default positions
      s.player1.x = 120;
      s.player1.y = FLOOR_Y - PH;
      s.player1.vy = 0;
      s.player1.vx = 0;
      s.player2.x = 640;
      s.player2.y = FLOOR_Y - PH;
      s.player2.vy = 0;
      s.player2.vx = 0;
      // Clear all shot / reach / anim state
      s.p1Charging = false;
      s.p1Charge = 0;
      s.p1Anim.active = false;
      s.p1Anim.phase = 0;
      s.p2Charging = false;
      s.p2Charge = 0;
      s.p2Anim.active = false;
      s.p2Anim.phase = 0;
      s.p1FollowThrough = false;
      s.p2FollowThrough = false;
      s.p1Reaching = false;
      s.p1ReachPhase = 0;
      s.p2Reaching = false;
      s.p2ReachPhase = 0;
      s.p1Crossover.active = false;
      s.p2Crossover.active = false;
      // Lob ball from center court to the fouled player (same arc as post-score inbound)
      const spawnY = 100;
      s.ball.x = CW / 2;
      s.ball.y = spawnY;
      s.ball.prevY = spawnY;
      s.ball.scoringThrough = false;
      s.ball.scoringHoopY = 0;
      s.ball.guidedMake = null;
      s.ballHolder = null;
      const receiver = fouledPlayer === "p1" ? s.player1 : s.player2;
      const targetX = receiver.x + receiver.w / 2;
      const tFrames = 38;
      s.ball.vx = (targetX - CW / 2) / tFrames;
      const targetY = FLOOR_Y - PH * 0.5;
      s.ball.vy =
        (targetY - spawnY - 0.5 * GRAVITY * tFrames * tFrames) / tFrames;
      s.pickupCooldown = 50;
    }

    function resetBall() {
      const spawnY = 100;
      s.ball.x = CW / 2;
      s.ball.y = spawnY;
      s.ball.prevY = spawnY;
      s.ball.scoringThrough = false;
      s.ball.scoringHoopY = 0;
      s.ball.guidedMake = null;
      s.ballHolder = null;
      s.p1Charging = false;
      s.p1Charge = 0;
      s.p2Charging = false;
      s.p2Charge = 0;
      // Reset players to starting positions
      s.player1.x = 120;
      s.player1.y = FLOOR_Y - PH;
      s.player1.vy = 0;
      s.player1.vx = 0;
      s.player2.x = 640;
      s.player2.y = FLOOR_Y - PH;
      s.player2.vy = 0;
      s.player2.vx = 0;

      // Send ball toward the player who did NOT score
      if (s.lastScorer) {
        const receiver = s.lastScorer === "p1" ? s.player2 : s.player1;
        const targetX = receiver.x + receiver.w / 2;
        const dx = targetX - CW / 2;
        // Arc: launch upward slightly then let gravity bring it down to the player
        // Use kinematic: at what vx/vy does ball reach (targetX, receiver.y + PH*0.5) in ~tFrames?
        const tFrames = 38;
        s.ball.vx = dx / tFrames;
        // vy: solve y + vy*t + 0.5*g*t^2 = targetY  =>  vy = (targetY - spawnY - 0.5*g*t^2) / t
        const targetY = FLOOR_Y - PH * 0.5;
        s.ball.vy =
          (targetY - spawnY - 0.5 * GRAVITY * tFrames * tFrames) / tFrames;
      } else {
        s.ball.vx = (Math.random() > 0.5 ? 1 : -1) * 2.5;
        s.ball.vy = 1;
      }
    }

    function shoot(who: "p1" | "p2", chargeValue: number) {
      const now = Date.now();
      if (now - s.lastShot[who] < 400) return;
      s.lastShot[who] = now;

      const p = who === "p1" ? s.player1 : s.player2;
      const defender = who === "p1" ? s.player2 : s.player1;
      const dist = defenderDist(p, defender);
      const { start, end } = calcGreenZone(dist);
      const basePct = calcBasePct(dist);

      const inGreen = chargeValue >= start && chargeValue <= end;
      if (inGreen) {
        const cx = p.x + p.w / 2;
        s.greenPopup = { active: true, frames: 90, x: cx, y: p.y - 30 };
        // Guaranteed make: flag the ball to force-score when it reaches the rim
        s.ball.guidedMake = who === "p1" ? "right" : "left";
      }
      let shotProb: number;
      if (inGreen) {
        shotProb = 1.0;
      } else {
        // Raw distance from the nearest edge of the green zone (in charge units)
        const distFromGreen =
          chargeValue < start ? start - chargeValue : chargeValue - end;
        // Normalize over 50 units: 0 = touching green edge, 1 = far away
        const t = Math.min(1, distFromGreen / 50);
        // Smooth linear falloff: edge of green → basePct, far away → 3%
        shotProb = basePct * (1 - t) + 0.03 * t;
      }

      const targetHoop = who === "p1" ? HOOPS[1] : HOOPS[0];
      const cx = p.x + p.w / 2;
      const launchY = p.y + 18;
      const distToHoop = Math.abs(cx - targetHoop.aimX);
      const isDunk = distToHoop < 45;

      let bvx: number, bvy: number;
      if (isDunk) {
        // Dunk: ball rises straight up and slams down through the hoop — guaranteed make
        const ballX = cx;
        bvx = (targetHoop.aimX - ballX) / 30; // gentle drift to center
        bvy = -15; // straight up with power
      } else {
        // Closer to hoop → aim higher above the rim so the ball arcs over and drops in
        // Loft: aim above the rim so the ball arcs and drops in cleanly.
        // Keep it modest (40-70px) so the ball never sails over the backboard.
        const loft =
          distToHoop < 150
            ? 30 + distToHoop * 0.25 // ~30–68 for close shots
            : 65; // flat 65px above rim for all mid/long range
        const closeSpeed =
          distToHoop < 200
            ? Math.max(3, 6 * (distToHoop / 200))
            : Math.min(12, 7 + (distToHoop - 200) * 0.01);
        const vel = calcShootVelocity(
          cx,
          launchY,
          targetHoop.aimX,
          targetHoop.rimY - loft,
          closeSpeed
        );
        bvx = vel.vx;
        bvy = vel.vy;
      }

      const success = isDunk ? true : Math.random() < shotProb;
      const errScale =
        isDunk || success ? 0 : Math.min(1.2, 1.2 - shotProb) * 1.5;
      const vxErr = isDunk ? 0 : (Math.random() - 0.5) * 7 * errScale;
      const vyErr = isDunk ? 0 : (Math.random() - 0.4) * 4 * errScale;

      s.ball.x = cx + (bvx > 0 ? 16 : bvx < 0 ? -16 : 0);
      s.ball.y = launchY;
      s.ball.prevY = launchY - 1;
      s.ball.shotFromX = cx; // remember shooter position for 3-point check

      // Green shot: compute a clean rainbow arc aimed precisely at the rim center
      if (inGreen && !isDunk) {
        const rimCenterX = (targetHoop.rimX1 + targetHoop.rimX2) / 2;
        // Target peak: 80px above rim, but clamped so it never hits the ceiling or goes below launchY
        // Scale arc height with distance: close=65px, half-court≈110px, full-court≈150px
        const arcHeight = Math.min(150, 65 + distToHoop * 0.12);
        const idealPeakY = targetHoop.rimY - arcHeight;
        const targetPeakY = Math.max(
          BALL_R + 8,
          Math.min(idealPeakY, launchY - 20)
        );
        const vy0 = -Math.sqrt(
          2 * GRAVITY * Math.max(1, launchY - targetPeakY)
        );
        const tPeak = -vy0 / GRAVITY; // frames to reach peak
        const peakY = launchY + vy0 * tPeak + 0.5 * GRAVITY * tPeak * tPeak;
        const tDown = Math.sqrt(
          (2 * Math.max(1, targetHoop.rimY - peakY)) / GRAVITY
        );
        const tTotal = tPeak + tDown;
        bvx = (rimCenterX - s.ball.x) / tTotal;
        bvy = vy0;
        // No error on green shots
        s.ball.vx = bvx;
        s.ball.vy = bvy;
      } else {
        s.ball.vx = bvx + vxErr;
        s.ball.vy = bvy + vyErr;
      }
      s.ballHolder = null;
      s.pickupCooldown = 50;
      // Prevent shooter from immediately blocking their own shot while still airborne
      if (who === "p1") s.p1BlockCooldown = 45;
      else s.p2BlockCooldown = 45;

      if (isDunk) {
        s.dunkPopup = { active: true, frames: 100, x: cx, y: p.y - 10 };
      }

      // Trigger shot animation
      const anim = who === "p1" ? s.p1Anim : s.p2Anim;
      const movingAway = who === "p1" ? p.vx < -0.5 : p.vx > 0.5;
      anim.active = true;
      anim.phase = 0;
      if (isDunk) {
        anim.type = "dunk";
        anim.leanDir = who === "p1" ? 1 : -1;
      } else if (distToHoop < 130) {
        anim.type = "layup";
        anim.leanDir = who === "p1" ? 1 : -1;
      } else {
        anim.type = movingAway ? "fadeaway" : "jump";
        anim.leanDir = movingAway ? (who === "p1" ? -1 : 1) : 0;
      }
    }

    function updatePlayers() {
      const p1 = s.player1,
        p2 = s.player2;
      const fp1 = FLOOR_Y - PH,
        fp2 = FLOOR_Y - PH;
      const oldX1 = p1.x,
        oldX2 = p2.x;

      if (s.keys["a"] || s.keys["A"]) p1.x -= p1.speed;
      if (s.keys["d"] || s.keys["D"]) p1.x += p1.speed;
      if (
        (s.keys["w"] || s.keys["W"]) &&
        !s.p1Charging &&
        s.ballHolder !== "p1" &&
        p1.y >= fp1 - 1
      )
        p1.vy = -10;

      if (s.keys["ArrowLeft"]) p2.x -= p2.speed;
      if (s.keys["ArrowRight"]) p2.x += p2.speed;
      if (
        s.keys["ArrowUp"] &&
        !s.p2Charging &&
        s.ballHolder !== "p2" &&
        p2.y >= fp2 - 1
      )
        p2.vy = -10;

      // Track horizontal velocity for animation type detection
      p1.vx = p1.x - oldX1;
      p2.vx = p2.x - oldX2;

      // Advance charges
      if (s.p1Charging && s.ballHolder === "p1")
        s.p1Charge = Math.min(100, s.p1Charge + CHARGE_RATE);
      if (s.p2Charging && s.ballHolder === "p2")
        s.p2Charge = Math.min(100, s.p2Charge + CHARGE_RATE);

      // Cancel if ball stolen mid-charge
      if (s.p1Charging && s.ballHolder !== "p1") {
        s.p1Charging = false;
        s.p1Charge = 0;
      }
      if (s.p2Charging && s.ballHolder !== "p2") {
        s.p2Charging = false;
        s.p2Charge = 0;
      }

      // Advance shot animations
      if (s.p1Anim.active) {
        const spd1 = s.p1Anim.type === "fadeaway" ? 1 / 44 : 1 / 28;
        s.p1Anim.phase += spd1;
        if (s.p1Anim.phase >= 1) {
          s.p1Anim.active = false;
          s.p1Anim.phase = 0;
          s.p1FollowThrough = true;
        }
      }
      if (s.p2Anim.active) {
        const spd2 = s.p2Anim.type === "fadeaway" ? 1 / 44 : 1 / 28;
        s.p2Anim.phase += spd2;
        if (s.p2Anim.phase >= 1) {
          s.p2Anim.active = false;
          s.p2Anim.phase = 0;
          s.p2FollowThrough = true;
        }
      }
      if (s.pickupCooldown > 0) s.pickupCooldown--;

      // Crossover animation (ball swings side to side)
      if (s.p1Crossover.active) {
        s.p1Crossover.phase += 1 / 16;
        if (s.p1Crossover.phase >= 1) {
          s.p1Crossover.active = false;
          s.p1Crossover.phase = 0;
          s.dribbleSide *= -1;
          drainStaminaDribble("p1");
        }
      }
      if (s.p2Crossover.active) {
        s.p2Crossover.phase += 1 / 16;
        if (s.p2Crossover.phase >= 1) {
          s.p2Crossover.active = false;
          s.p2Crossover.phase = 0;
          s.dribbleSide *= -1;
          drainStaminaDribble("p2");
        }
      }

      // Stamina regen (drain happens per-dribble bounce in updateBall / crossover completion)
      const ST_REGEN = 0.25; // regen per frame without ball
      const ST_EXHAUST_CLR = 20; // stamina level at which exhaustion lifts

      for (const who of ["p1", "p2"] as const) {
        const hasB = s.ballHolder === who;
        if (!hasB) {
          if (who === "p1") {
            s.p1Stamina = Math.min(100, s.p1Stamina + ST_REGEN);
            if (s.p1Exhausted && s.p1Stamina >= ST_EXHAUST_CLR)
              s.p1Exhausted = false;
          } else {
            s.p2Stamina = Math.min(100, s.p2Stamina + ST_REGEN);
            if (s.p2Exhausted && s.p2Stamina >= ST_EXHAUST_CLR)
              s.p2Exhausted = false;
          }
        }
      }

      // Reach-in progress
      if (s.p1Reaching) {
        s.p1ReachPhase += 1 / 18;
        if (s.p1ReachPhase >= 0.5 && s.p1ReachPhase - 1 / 18 < 0.5) {
          // Peak of reach — attempt steal or foul
          const dist = defenderDist(s.player1, s.player2);
          if (dist < 60 && s.ballHolder === "p2") {
            if (s.p2Crossover.active) {
              // ANKLE BREAKER — crossover cooks the reach
              s.p1AnkleBroken = true;
              s.p1AnkleBrokenFrames = 100;
              s.p1Reaching = false;
              s.p1ReachPhase = 0;
              s.p1ReachCooldown = 90;
              s.anklePopup = {
                active: true,
                frames: 90,
                x: s.player1.x + PW / 2,
                y: s.player1.y - 20,
              };
            } else if (s.p2Charging) {
              // FOUL — reaching into a shooter while touching them
              const midX = (s.player1.x + s.player2.x) / 2 + PW / 2;
              s.foulPopup = {
                active: true,
                frames: 100,
                x: midX,
                y: Math.min(s.player2.y, s.player1.y) - 40,
              };
              s.p1ReachCooldown = 150;
              resetAfterFoul("p2");
            } else {
              // Guaranteed steal when not crossing over and not shooting
              s.ballHolder = "p1";
              s.dribblePhase = 0;
              s.p1FollowThrough = false;
              s.p2FollowThrough = false;
              s.p2Charging = false;
              s.p2Charge = 0;
              s.p2Crossover.active = false;
            }
          }
        }
        if (s.p1ReachPhase >= 1) {
          s.p1Reaching = false;
          s.p1ReachPhase = 0;
          s.p1ReachCooldown = 90;
        }
      }
      if (s.p2Reaching) {
        s.p2ReachPhase += 1 / 18;
        if (s.p2ReachPhase >= 0.5 && s.p2ReachPhase - 1 / 18 < 0.5) {
          const dist = defenderDist(s.player2, s.player1);
          if (dist < 60 && s.ballHolder === "p1") {
            if (s.p1Crossover.active) {
              // ANKLE BREAKER — the reaching player (p2) gets cooked
              s.p2AnkleBroken = true;
              s.p2AnkleBrokenFrames = 100;
              s.p2Reaching = false;
              s.p2ReachPhase = 0;
              s.p2ReachCooldown = 90;
              s.anklePopup = {
                active: true,
                frames: 90,
                x: s.player2.x + PW / 2,
                y: s.player2.y - 20,
              };
            } else if (s.p1Charging) {
              // FOUL — reaching into a shooter while touching them
              const midX = (s.player1.x + s.player2.x) / 2 + PW / 2;
              s.foulPopup = {
                active: true,
                frames: 100,
                x: midX,
                y: Math.min(s.player1.y, s.player2.y) - 40,
              };
              s.p2ReachCooldown = 150;
              resetAfterFoul("p1");
            } else {
              // Guaranteed steal when not crossing over and not shooting
              s.ballHolder = "p2";
              s.dribblePhase = 0;
              s.p1FollowThrough = false;
              s.p2FollowThrough = false;
              s.p1Charging = false;
              s.p1Charge = 0;
              s.p1Crossover.active = false;
            }
          }
        }
        if (s.p2ReachPhase >= 1) {
          s.p2Reaching = false;
          s.p2ReachPhase = 0;
          s.p2ReachCooldown = 90;
        }
      }
      if (s.p1ReachCooldown > 0) s.p1ReachCooldown--;
      if (s.p2ReachCooldown > 0) s.p2ReachCooldown--;

      // Ankle broken countdown — player is on the floor
      if (s.p1AnkleBroken) {
        s.p1AnkleBrokenFrames--;
        if (s.p1AnkleBrokenFrames <= 0) {
          s.p1AnkleBroken = false;
        }
        // Can't move while broken
        p1.x = oldX1;
        p1.vx = 0;
      }
      if (s.p2AnkleBroken) {
        s.p2AnkleBrokenFrames--;
        if (s.p2AnkleBrokenFrames <= 0) {
          s.p2AnkleBroken = false;
        }
        p2.x = oldX2;
        p2.vx = 0;
      }
      // Tick run phase for stride animation (advances when player moves on the ground)
      const p1OnGround = p1.y >= FLOOR_Y - PH - 1;
      const p2OnGround = p2.y >= FLOOR_Y - PH - 1;
      if (Math.abs(p1.vx) > 0.5 && p1OnGround) s.p1RunPhase += 0.14;
      else s.p1RunPhase = 0;
      if (Math.abs(p2.vx) > 0.5 && p2OnGround) s.p2RunPhase += 0.14;
      else s.p2RunPhase = 0;

      if (s.anklePopup.active) {
        s.anklePopup.frames--;
        if (s.anklePopup.frames <= 0) s.anklePopup.active = false;
      }
      if (s.dunkPopup.active) {
        s.dunkPopup.frames--;
        if (s.dunkPopup.frames <= 0) s.dunkPopup.active = false;
      }
      if (s.greenPopup.active) {
        s.greenPopup.frames--;
        if (s.greenPopup.frames <= 0) s.greenPopup.active = false;
      }
      if (s.foulPopup.active) {
        s.foulPopup.frames--;
        if (s.foulPopup.frames <= 0) s.foulPopup.active = false;
      }
      if (s.blockPopup.active) {
        s.blockPopup.frames--;
        if (s.blockPopup.frames <= 0) s.blockPopup.active = false;
      }

      p1.vy += GRAVITY;
      p1.y += p1.vy;
      if (p1.y >= fp1) {
        p1.y = fp1;
        p1.vy = 0;
      }
      p2.vy += GRAVITY;
      p2.y += p2.vy;
      if (p2.y >= fp2) {
        p2.y = fp2;
        p2.vy = 0;
      }
      p1.x = Math.max(2, Math.min(p1.x, CW - PW - 2));
      p2.x = Math.max(2, Math.min(p2.x, CW - PW - 2));
    }

    function tryPickup() {
      if (
        s.ballHolder !== null ||
        s.pickupCooldown > 0 ||
        s.ball.scoringThrough
      )
        return;
      const b = s.ball;
      for (const [who, p] of [
        ["p1", s.player1],
        ["p2", s.player2],
      ] as Array<["p1" | "p2", Player]>) {
        const cx = p.x + p.w / 2,
          cy = p.y + p.h / 2;
        if (Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2) < 38) {
          s.ballHolder = who;
          s.dribblePhase = 0;
          s.p1FollowThrough = false;
          s.p2FollowThrough = false;
          // Clear exhausted on pickup and restore a tiny stamina buffer so they don't instantly re-drop
          if (who === "p1" && s.p1Exhausted) {
            s.p1Exhausted = false;
            s.p1Stamina = Math.max(s.p1Stamina, 5);
          }
          if (who === "p2" && s.p2Exhausted) {
            s.p2Exhausted = false;
            s.p2Stamina = Math.max(s.p2Stamina, 5);
          }
          break;
        }
      }
    }

    // Block detection: airborne player's raised arms reject a free ball
    function checkBlocks() {
      if (s.ballHolder !== null || s.ball.scoringThrough) return;
      const b = s.ball;
      const fp = FLOOR_Y - PH;
      for (const [who, p, cooldownKey] of [
        ["p1", s.player1, "p1BlockCooldown"] as [
          "p1",
          Player,
          "p1BlockCooldown"
        ],
        ["p2", s.player2, "p2BlockCooldown"] as [
          "p2",
          Player,
          "p2BlockCooldown"
        ],
      ]) {
        if (s[cooldownKey] > 0) {
          s[cooldownKey]--;
          continue;
        }
        // Block zone only active while actively in the air going upward — never on the ground
        const isJumping = p.y < fp - 8 && p.vy < 0;
        if (!isJumping) continue;
        // Block zone: two small circles right at each hand tip
        const cx = p.x + PW / 2;
        const handY = p.y - 6; // approximate hand height in canvas coords
        const handR = 9; // tight radius — must actually hit the hands
        const dLeft = Math.sqrt((b.x - (cx - 9)) ** 2 + (b.y - handY) ** 2);
        const dRight = Math.sqrt((b.x - (cx + 9)) ** 2 + (b.y - handY) ** 2);
        if (dLeft < BALL_R + handR || dRight < BALL_R + handR) {
          // Reject: flip vx direction backward, send downward (no chance of arcing into a hoop)
          b.vx = -b.vx * 1.3 + (who === "p1" ? -3 : 3);
          b.vy = Math.abs(b.vy) * 0.5 + 4;
          s[cooldownKey] = 55;
          s.pickupCooldown = 30;
          s.blockPopup = { active: true, frames: 90, x: cx, y: p.y - 18 };
        }
      }
    }

    // Steal is now manual via reach-in (V / L keys) — no auto-steal on contact

    // Deduct 10% stamina per dribble bounce — triggers drop if gassed
    function drainStaminaDribble(who: "p1" | "p2") {
      const p = who === "p1" ? s.player1 : s.player2;
      if (who === "p1") {
        s.p1Stamina = Math.max(0, s.p1Stamina - 10);
        if (s.p1Stamina <= 0 && !s.p1Exhausted) {
          s.p1Exhausted = true;
          s.ball.x = p.x + p.w / 2;
          s.ball.y = p.y;
          s.ball.vx = p.vx * 1.5 + (Math.random() - 0.5) * 2;
          s.ball.vy = -3;
          s.ballHolder = null;
          s.p1Charging = false;
          s.p1Charge = 0;
          s.p1Crossover.active = false;
          s.pickupCooldown = 30;
        }
      } else {
        s.p2Stamina = Math.max(0, s.p2Stamina - 10);
        if (s.p2Stamina <= 0 && !s.p2Exhausted) {
          s.p2Exhausted = true;
          s.ball.x = p.x + p.w / 2;
          s.ball.y = p.y;
          s.ball.vx = p.vx * 1.5 + (Math.random() - 0.5) * 2;
          s.ball.vy = -3;
          s.ballHolder = null;
          s.p2Charging = false;
          s.p2Charge = 0;
          s.p2Crossover.active = false;
          s.pickupCooldown = 30;
        }
      }
    }

    function checkWin(sc: { p1: number; p2: number }) {
      const p1Done = sc.p1 >= 30 && sc.p1 - sc.p2 >= 2;
      const p2Done = sc.p2 >= 30 && sc.p2 - sc.p1 >= 2;
      if (p1Done || p2Done) {
        cancelAnimationFrame(s.animId);
        onWin(p1Done ? "p1" : "p2");
      }
    }

    function updateBall() {
      if (s.ballHolder) {
        const p = s.ballHolder === "p1" ? s.player1 : s.player2;
        const cx = p.x + p.w / 2;
        s.dribblePhase += 0.07;
        const crossover = s.ballHolder === "p1" ? s.p1Crossover : s.p2Crossover;
        const handY = p.y + 35;
        const bounceT = Math.abs(Math.sin(s.dribblePhase * 2.5));
        s.ball.prevY = s.ball.y;

        if (crossover.active && crossover.type === "crossover") {
          // Simple floor-bounce crossover: x slides side-to-side, y dips to floor at midpoint
          const t = crossover.phase; // 0→1 linear
          const side = crossover.fromSide * (1 - t) + -crossover.fromSide * t;
          const yFrac = 2 * Math.abs(t - 0.5); // 1 at ends, 0 at mid (ball lowest at center)
          s.ball.x = cx + side * 22;
          s.ball.y = handY + (FLOOR_Y - BALL_R - handY) * (1 - yFrac);
        } else if (crossover.active && crossover.type === "btb") {
          // Behind-the-back: ball rises to waist height, tucked close to body
          const swing = Math.sin(crossover.phase * Math.PI); // 0→1→0
          const side =
            crossover.fromSide * (1 - swing) + -crossover.fromSide * swing;
          const normalX = cx + side * 22;
          const normalY = handY + (FLOOR_Y - BALL_R - handY) * bounceT;
          s.ball.x = normalX + (cx + side * 6 - normalX) * swing;
          s.ball.y = normalY + (p.y + 52 - normalY) * swing;
        } else {
          // Normal dribble: ball bounces on dribble side
          const side = s.ballHolder === "p1" ? s.dribbleSide : -s.dribbleSide;
          s.ball.x = cx + side * 22;
          s.ball.y = handY + (FLOOR_Y - BALL_R - handY) * bounceT;
        }

        // While charging a shot, smoothly pull the ball up in front of the face
        if (!crossover.active) {
          const isCharging =
            s.ballHolder === "p1" ? s.p1Charging : s.p2Charging;
          const charge = s.ballHolder === "p1" ? s.p1Charge : s.p2Charge;
          if (isCharging) {
            const chargeT = Math.min(1, charge / 55); // 0→1 as meter fills ~60%
            const hoopDir = s.ballHolder === "p1" ? 1 : -1; // toward own shooting hoop
            const faceX = cx + hoopDir * 13; // just in front of face
            const faceY = p.y - HEAD_R + 2; // above chin, forehead/above-head level
            s.ball.x += (faceX - s.ball.x) * chargeT;
            s.ball.y += (faceY - s.ball.y) * chargeT;
          }
        }

        s.ball.vx = 0;
        s.ball.vy = 0;
        return;
      }

      const b = s.ball;
      b.prevY = b.y;
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;

      if (b.y + b.r > FLOOR_Y) {
        b.y = FLOOR_Y - b.r;
        b.vy *= -0.52;
        b.vx *= 0.93;
        if (Math.abs(b.vy) < 1) b.vy = 0;
        s.p1FollowThrough = false;
        s.p2FollowThrough = false;
      }
      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx *= -0.7;
        s.p1FollowThrough = false;
        s.p2FollowThrough = false;
      }
      if (b.x + b.r > CW) {
        b.x = CW - b.r;
        b.vx *= -0.7;
        s.p1FollowThrough = false;
        s.p2FollowThrough = false;
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy *= -0.65;
        s.p1FollowThrough = false;
        s.p2FollowThrough = false;
      }

      for (const h of HOOPS) {
        // Backboard bounce — skipped for guided (green) shots so they swish cleanly
        const hitBoard =
          !b.guidedMake &&
          (h.side === "left"
            ? b.x - b.r < h.bx2 && b.x > h.bx1 && b.y > h.by1 && b.y < h.by2
            : b.x + b.r > h.bx1 && b.x < h.bx2 && b.y > h.by1 && b.y < h.by2);
        if (hitBoard) {
          b.vx *= -0.55;
          b.x = h.side === "left" ? h.bx2 + b.r : h.bx1 - b.r;
          s.p1FollowThrough = false;
          s.p2FollowThrough = false;
        }

        // Rim tip bounce (outer/inner edge)
        // Only collide with rim tip when ball is coming DOWN, and not a guided (green) swish
        if (b.vy > 0 && !b.guidedMake) {
          const tipX = h.side === "left" ? h.rimX2 : h.rimX1;
          const tipY = h.rimY;
          const tdx = b.x - tipX,
            tdy = b.y - tipY;
          const tipDist = Math.sqrt(tdx * tdx + tdy * tdy);
          if (tipDist < b.r + 4 && tipDist > 0) {
            const nx = tdx / tipDist,
              ny = tdy / tipDist;
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.5;
            b.vy = (b.vy - 2 * dot * ny) * 0.5;
            b.x = tipX + nx * (b.r + 4);
            b.y = tipY + ny * (b.r + 4);
            s.p1FollowThrough = false;
            s.p2FollowThrough = false;
          }
        }

        // Scoring: ball crosses rim from above within the opening
        const rimMinX = Math.min(h.rimX1, h.rimX2);
        const rimMaxX = Math.max(h.rimX1, h.rimX2);
        const scoreMinX = rimMinX + b.r * 0.6;
        const scoreMaxX = rimMaxX - b.r * 0.6;

        // If already in scoring-through mode, wait until ball exits the net then reset
        if (b.scoringThrough) {
          if (b.y + b.r >= FLOOR_Y) {
            resetBall();
            return;
          }
          // skip all other hoop collisions while falling through
          continue;
        }

        // Guided (green) make: force score when ball crosses rim level, no x-check needed
        if (b.guidedMake === h.side && b.vy > 0 && b.y + b.r >= h.rimY) {
          b.guidedMake = null;
          const isThree =
            h.side === "left" ? b.shotFromX > CW / 2 : b.shotFromX < CW / 2;
          const pts = isThree ? 3 : 2;
          if (h.side === "left") {
            s.score.p2 += pts;
            s.lastScorer = "p2";
          } else {
            s.score.p1 += pts;
            s.lastScorer = "p1";
          }
          setScore({ p1: s.score.p1, p2: s.score.p2 });
          checkWin(s.score);
          b.scoringThrough = true;
          b.scoringHoopY = h.rimY;
          b.vy = Math.max(b.vy, 2);
          continue;
        }

        if (
          b.vy > 0 &&
          b.prevY - b.r < h.rimY &&
          b.y + b.r >= h.rimY &&
          b.x > scoreMinX &&
          b.x < scoreMaxX
        ) {
          // 3 points if shot from beyond half court (CW/2 = 400)
          const isThree =
            h.side === "left" ? b.shotFromX > CW / 2 : b.shotFromX < CW / 2;
          const pts = isThree ? 3 : 2;
          if (h.side === "left") {
            s.score.p2 += pts;
            s.lastScorer = "p2";
          } else {
            s.score.p1 += pts;
            s.lastScorer = "p1";
          }
          setScore({ p1: s.score.p1, p2: s.score.p2 });
          checkWin(s.score);
          // Let ball fall visually through the net before resetting
          b.scoringThrough = true;
          b.scoringHoopY = h.rimY;
          b.vx *= 0.2; // nearly straight down through the net
          s.ballHolder = null;
          continue;
        }

        // Rim surface bounce (ball lands on top of rim bar) — skip when scoring through
        if (
          b.x > rimMinX - b.r &&
          b.x < rimMaxX + b.r &&
          b.y + b.r > h.rimY &&
          b.y + b.r < h.rimY + 16 &&
          b.y - b.r < h.rimY &&
          b.vy > 0
        ) {
          b.y = h.rimY - b.r;
          b.vy *= -0.5;
          b.vx *= 0.75;
        }
      }
    }

    // ─── DRAWING ─────────────────────────────────────────────────────────────

    function drawCourt() {
      // Blit the pre-rendered static scene (court + hoop structure) in one GPU copy
      ctx.drawImage(staticCanvas, 0, 0);
    }

    function drawHoops() {
      // Only the net is dynamic — static parts live on staticCanvas
      for (let hi = 0; hi < HOOPS.length; hi++) {
        const h = HOOPS[hi];
        const rMinX = Math.min(h.rimX1, h.rimX2),
          rMaxX = Math.max(h.rimX1, h.rimX2);
        const netW = rMaxX - rMinX;
        const rings = hi === 0 ? netRef.current.left : netRef.current.right;
        const cache = _netCache[hi];

        // Fill cache once — avoids repeating the math in both loops below
        for (let r = 0; r < NET_RINGS; r++) {
          const rowFrac = (r + 1) / NET_RINGS;
          const taper = 1 - 0.22 * rowFrac;
          const indent = (netW * (1 - taper)) / 2;
          const effW = netW - 2 * indent;
          const row = cache[r];
          const rings_r = rings[r];
          for (let i = 0; i <= NET_COLS; i++) {
            const nd = row[i];
            nd.x = rMinX + indent + effW * (i / NET_COLS);
            nd.y = h.rimY + rowFrac * NET_H + rings_r[i].dy;
          }
        }

        ctx.lineCap = "round";
        // Vertical strands
        ctx.strokeStyle = NET_VERT;
        ctx.lineWidth = 0.9;
        for (let i = 0; i <= NET_COLS; i++) {
          ctx.beginPath();
          ctx.moveTo(rMinX + netW * (i / NET_COLS), h.rimY);
          for (let r = 0; r < NET_RINGS; r++)
            ctx.lineTo(cache[r][i].x, cache[r][i].y);
          ctx.stroke();
        }
        // Horizontal rings
        for (let r = 0; r < NET_RINGS; r++) {
          ctx.strokeStyle = r === NET_RINGS - 1 ? NET_BOLD : NET_DIM;
          ctx.lineWidth = r === NET_RINGS - 1 ? 1.2 : 0.8;
          ctx.beginPath();
          const row = cache[r];
          ctx.moveTo(row[0].x, row[0].y);
          for (let i = 1; i <= NET_COLS; i++) ctx.lineTo(row[i].x, row[i].y);
          ctx.stroke();
        }
      }
    }

    function drawShotMeter(p: Player, charge: number, dist: number) {
      const cx = p.x + p.w / 2;
      const barW = 76,
        barH = 11;
      const bx = cx - barW / 2,
        by = p.y - 36;
      const { start, end } = calcGreenZone(dist);
      const inGreen = charge >= start && charge <= end;

      // Live shot percentage
      const basePct = calcBasePct(dist);
      const distFromGreen = inGreen
        ? 0
        : Math.min(Math.abs(charge - start), Math.abs(charge - end));
      const livePct = inGreen
        ? 1.0
        : Math.max(0, basePct * (1 - distFromGreen / 100));
      const pctLabel = `${Math.round(livePct * 100)}%`;

      // Percentage above head (above the meter bar)
      const pctY = by - 20;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(pctLabel, cx + 1, pctY + 1);
      // Colour: green when 100%, yellow when mid, red when low
      const pctColor =
        livePct >= 1.0 ? "#4ade80" : livePct > 0.5 ? "#fbbf24" : "#f87171";
      ctx.fillStyle = pctColor;
      ctx.fillText(pctLabel, cx, pctY);

      // Meter bar background
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.beginPath();
      ctx.roundRect(bx - 3, by - 3, barW + 6, barH + 6, 4);
      ctx.fill();

      // Base
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(bx, by, barW, barH);
      // Green zone
      ctx.fillStyle = "#15803d";
      ctx.fillRect(
        bx + (start / 100) * barW,
        by,
        ((end - start) / 100) * barW,
        barH
      );
      // Charge fill
      const fillW = (charge / 100) * barW;
      ctx.fillStyle = inGreen ? "#86efac" : "#fbbf24";
      ctx.fillRect(bx, by, fillW, barH);
      // Needle
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx + fillW - 1.5, by - 2, 3, barH + 4);

      // "GREEN" popup when in the zone
      if (inGreen) {
        const pulse = 1 + 0.08 * Math.sin(Date.now() / 80);
        const greenY = by - 38;
        ctx.save();
        ctx.translate(cx, greenY);
        ctx.scale(pulse, pulse);
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 4;
        ctx.strokeText("GREEN", 0, 0);
        ctx.fillStyle = "#22c55e";
        ctx.fillText("GREEN", 0, 0);
        ctx.restore();
      }
    }

    function drawStaminaBar(p: Player, stamina: number, exhausted: boolean) {
      const cx = p.x + p.w / 2;
      const barW = 50;
      const barH = 5;
      const bx = cx - barW / 2;
      const by = p.y - 50;

      // Background pill
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(bx - 2, by - 2, barW + 4, barH + 4, 3);
      ctx.fill();
      // Track
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(bx, by, barW, barH);
      // Fill — green > 60%, yellow > 25%, red below
      const pct = stamina / 100;
      ctx.fillStyle =
        pct > 0.6 ? "#22c55e" : pct > 0.25 ? "#facc15" : "#ef4444";
      if (pct > 0) ctx.fillRect(bx, by, barW * pct, barH);

      // "GASSED" warning when exhausted — flashes above the bar
      if (exhausted && Math.sin(Date.now() / 110) > 0) {
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText("GASSED", cx + 1, by - 5);
        ctx.fillStyle = "#fb923c";
        ctx.fillText("GASSED", cx, by - 5);
      }
    }

    function drawPlayerChar(
      p: Player,
      hasBall: boolean,
      isCharging: boolean,
      charge: number,
      anim: ShotAnim,
      runPhase: number
    ) {
      const cx = p.x + p.w / 2;
      const isP1 = p === s.player1;

      // Shot animation offsets
      // Arms RISE from charge position into peak over the first 40% of phase, then stay held —
      // no dip at release and no snap at follow-through handoff
      const isFadeaway = anim.active && anim.type === "fadeaway";
      const isJumpShot = anim.active && anim.type === "jump";
      const leanX = 0;
      // smoothstep rise: 0→1 over first 40% of phase, then locked at 1
      const _rawRise = anim.active ? Math.min(1, anim.phase / 0.4) : 0;
      const riseT = _rawRise * _rawRise * (3 - 2 * _rawRise);
      const animT = anim.active ? Math.sin(anim.phase * Math.PI) : 0; // kept for dunk/layup
      const CHARGE_BASE = 8; // matches isCharging arm raise
      const PEAK_FADE = 30;
      const PEAK_JUMP = 22;
      // For jump/fadeaway: arm rises from charge base to peak, then stays. For others: symmetric sine.
      const armRaise =
        isFadeaway || isJumpShot
          ? CHARGE_BASE +
            ((isFadeaway ? PEAK_FADE : PEAK_JUMP) - CHARGE_BASE) * riseT
          : anim.active
          ? animT * 20
          : isCharging
          ? CHARGE_BASE
          : 0;

      // Dunk: lift the entire player up to hoop height during animation
      // Body stays well below the rim — arms reach up to it via rimDrawY calculation
      const dunkJump =
        anim.active && anim.type === "dunk"
          ? Math.sin(anim.phase * Math.PI) * 80
          : 0;
      ctx.save();
      ctx.translate(0, -dunkJump);
      // Visual height scale — stretch upward from feet so physics box is unchanged
      const VISUAL_SCALE = 1.28;
      const footAbs = p.y + p.h;
      ctx.translate(cx, footAbs);
      ctx.scale(1, VISUAL_SCALE);
      ctx.translate(-cx, -footAbs);
      // Fadeaway: rotate whole body backward, anchored at feet
      // Use riseT (already smoothstepped, monotonically rises to max then holds) for a clean lean
      if (isFadeaway) {
        const maxLean = 0.3; // ~17 degrees — slightly reduced from 0.34 for a crisper look
        const fadeAngle = riseT * maxLean * anim.leanDir;
        ctx.translate(cx, footAbs);
        ctx.rotate(fadeAngle);
        ctx.translate(-cx, -footAbs);
      }

      // Body part positions
      const headCY = p.y + HEAD_R;
      const neckY = p.y + HEAD_R * 2 + 2;
      const shoulderY = neckY + 3;
      const waistY = shoulderY + 22;
      const kneeY = waistY + 18;
      const footY = p.y + p.h;
      const lw = 3;

      // Use dribble phase when holding ball, run phase otherwise
      const activePhase = hasBall ? s.dribblePhase * 3 : runPhase;
      const isRunning = runPhase > 0 && !hasBall && !anim.active;
      const walkSwing = hasBall ? Math.sin(activePhase) * 6 : 0; // kept for dribble arm swing
      const strideT = isRunning ? Math.sin(activePhase) : 0; // -1 to 1, drives leg/arm alternation
      const isLayup = anim.active && anim.type === "layup";
      const isDunkAnim = anim.active && anim.type === "dunk";
      const layupT = isLayup ? Math.sin(anim.phase * Math.PI) : 0;
      // Dunk phase: 0→0.5 arms rise, 0.5→1 slam down
      const dunkRiseT = isDunkAnim ? Math.min(1, anim.phase * 2) : 0;
      const dunkSlamT = isDunkAnim ? Math.max(0, (anim.phase - 0.5) * 2) : 0;
      const hoopDir = anim.leanDir; // +1 = hoop to right, -1 = hoop to left
      const layupLeanX = isLayup ? hoopDir * layupT * 10 : leanX;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, footY + 2, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = p.color;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      if (isDunkAnim) {
        // Both knees tuck up during dunk jump
        const tuck = dunkRiseT * 28;
        ctx.beginPath();
        ctx.moveTo(cx - 4, waistY);
        ctx.lineTo(cx - 10, kneeY - tuck);
        ctx.lineTo(cx - 8, footY - tuck * 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 4, waistY);
        ctx.lineTo(cx + 10, kneeY - tuck);
        ctx.lineTo(cx + 8, footY - tuck * 1.2);
        ctx.stroke();
      } else if (isLayup) {
        // Shooting-side leg (hoop side) raises like a running layup
        const raiseKneeY = kneeY - layupT * 32;
        const raiseFootY = footY - layupT * 44;
        ctx.beginPath();
        ctx.moveTo(cx + 4 * hoopDir, waistY);
        ctx.lineTo(cx + 10 * hoopDir, raiseKneeY);
        ctx.lineTo(cx + 8 * hoopDir, raiseFootY);
        ctx.stroke();
        // Plant leg stays down
        ctx.beginPath();
        ctx.moveTo(cx - 4 * hoopDir, waistY);
        ctx.lineTo(cx - 6 * hoopDir, kneeY);
        ctx.lineTo(cx - 8 * hoopDir, footY);
        ctx.stroke();
      } else if (isRunning) {
        // Running stride: legs alternate forward/back, knees lift on forward swing
        const legSwing = strideT * 14; // forward/back swing amount
        const kneeRaise = Math.max(0, strideT) * 12; // front knee lifts
        const backKneeRaise = Math.max(0, -strideT) * 12; // back knee lifts
        // Left leg (swings back when right is forward)
        ctx.beginPath();
        ctx.moveTo(cx - 4, waistY);
        ctx.lineTo(cx - 6 + legSwing * 0.5, kneeY - backKneeRaise);
        ctx.lineTo(cx - 8 + legSwing, footY - backKneeRaise * 1.4);
        ctx.stroke();
        // Right leg (swings forward)
        ctx.beginPath();
        ctx.moveTo(cx + 4, waistY);
        ctx.lineTo(cx + 6 - legSwing * 0.5, kneeY - kneeRaise);
        ctx.lineTo(cx + 8 - legSwing, footY - kneeRaise * 1.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - 4, waistY);
        ctx.lineTo(cx - 6 - walkSwing * 0.5, kneeY);
        ctx.lineTo(cx - 8 - walkSwing, footY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 4, waistY);
        ctx.lineTo(cx + 6 + walkSwing * 0.5, kneeY);
        ctx.lineTo(cx + 8 + walkSwing, footY);
        ctx.stroke();
      }

      // Body
      ctx.strokeStyle = p.color;
      ctx.lineWidth = lw + 1;
      ctx.beginPath();
      ctx.moveTo(cx + layupLeanX * 0.3, shoulderY);
      ctx.lineTo(cx + layupLeanX * 0.6, waistY);
      ctx.stroke();

      // Arms
      const sx = cx + layupLeanX * 0.3;
      const sy = shoulderY - armRaise * 0.4;
      ctx.lineWidth = lw;
      ctx.strokeStyle = p.skinColor;

      if (isDunkAnim) {
        // Compute where rimY=170 appears in drawing-space (accounting for dunkJump translate + VISUAL_SCALE)
        const footAbs2 = p.y + p.h;
        const rimDrawY = footAbs2 + (170 - footAbs2 + dunkJump) / VISUAL_SCALE;

        if (dunkSlamT < 0.01) {
          // RISE: arms sweep up and toward the hoop, hands converge on rim level
          const r = dunkRiseT;
          // Primary (dunking) arm — hoop side, wide arc
          ctx.beginPath();
          ctx.moveTo(sx, shoulderY);
          ctx.lineTo(sx + hoopDir * 14 * r, shoulderY - 18 * r);
          ctx.lineTo(
            sx + hoopDir * 22 * r,
            shoulderY + (rimDrawY - shoulderY) * r
          );
          ctx.stroke();
          // Guide arm — follows up slightly behind
          ctx.beginPath();
          ctx.moveTo(sx, shoulderY);
          ctx.lineTo(sx + hoopDir * 8 * r, shoulderY - 12 * r);
          ctx.lineTo(
            sx + hoopDir * 16 * r,
            shoulderY + (rimDrawY - shoulderY + 6) * r
          );
          ctx.stroke();
        } else {
          // SLAM / HANG: arms drop through the rim — follow-through downward
          const h2 = dunkSlamT;
          const dropY = rimDrawY + h2 * 28;
          // Primary arm pushes through
          ctx.beginPath();
          ctx.moveTo(sx, shoulderY);
          ctx.lineTo(sx + hoopDir * (22 - h2 * 8), shoulderY + 8 * h2);
          ctx.lineTo(sx + hoopDir * (18 - h2 * 6), dropY);
          ctx.stroke();
          // Guide arm follows
          ctx.beginPath();
          ctx.moveTo(sx, shoulderY);
          ctx.lineTo(sx + hoopDir * (14 - h2 * 5), shoulderY + 6 * h2);
          ctx.lineTo(sx + hoopDir * (12 - h2 * 4), dropY + 8);
          ctx.stroke();
          // Slam flash at rim
          if (h2 > 0.05 && h2 < 0.65) {
            ctx.fillStyle = `rgba(255,200,50,${(0.65 - h2) * 2.0})`;
            ctx.beginPath();
            ctx.arc(sx + hoopDir * 18, rimDrawY, 9 * (1 - h2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (isLayup) {
        // Shooting arm (hoop side) extends straight up
        ctx.beginPath();
        ctx.moveTo(sx, shoulderY);
        ctx.lineTo(
          sx + hoopDir * 10 + layupLeanX * 0.5,
          shoulderY - 18 * layupT
        );
        ctx.lineTo(sx + hoopDir * 12 + layupLeanX, shoulderY - 34 * layupT);
        ctx.stroke();
        // Balance arm extends out to the opposite side
        ctx.beginPath();
        ctx.moveTo(sx, shoulderY);
        ctx.lineTo(sx - hoopDir * 14, shoulderY + 6);
        ctx.lineTo(sx - hoopDir * 18, shoulderY + 16);
        ctx.stroke();
      } else if (isFadeaway || isJumpShot) {
        // Fadeaway & jump shot: shooting arm rises toward peak; guide arm cradles
        // armRaise already encodes the smooth rise via riseT so these lines stay constant
        const shootDir = isP1 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + shootDir * 8, sy - armRaise * 0.6);
        ctx.lineTo(sx + shootDir * 14, sy - armRaise);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - shootDir * 6, sy - armRaise * 0.35);
        ctx.lineTo(sx - shootDir * 10, sy - armRaise * 0.55);
        ctx.stroke();
      } else if (isRunning) {
        // Running: arms swing opposite to legs (left arm forward when right leg forward)
        const armSwing = -strideT * 12; // opposite to legSwing
        // Left arm swings forward when right leg is back
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 10 - armSwing * 0.5, sy + 10 + armSwing * 0.4);
        ctx.lineTo(sx - 13 - armSwing, sy + 20 + armSwing * 0.7);
        ctx.stroke();
        // Right arm swings back
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 10 + armSwing * 0.5, sy + 10 - armSwing * 0.4);
        ctx.lineTo(sx + 13 + armSwing, sy + 20 - armSwing * 0.7);
        ctx.stroke();
      } else if (!hasBall) {
        const followThrough = isP1 ? s.p1FollowThrough : s.p2FollowThrough;
        if (followThrough) {
          // Hold the exact same arm pose as the shot peak — match sy offset to eliminate any snap
          const shootDir = isP1 ? 1 : -1;
          // anim.type still holds the last shot type even after anim.active = false
          const holdRaise = anim.type === "fadeaway" ? PEAK_FADE : PEAK_JUMP;
          // Mirror the sy offset that was active at peak (sy = shoulderY - armRaise * 0.4)
          const ftSy = shoulderY - holdRaise * 0.4;
          ctx.beginPath();
          ctx.moveTo(sx, ftSy);
          ctx.lineTo(sx + shootDir * 8, ftSy - holdRaise * 0.6);
          ctx.lineTo(sx + shootDir * 14, ftSy - holdRaise);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx, ftSy);
          ctx.lineTo(sx - shootDir * 6, ftSy - holdRaise * 0.35);
          ctx.lineTo(sx - shootDir * 10, ftSy - holdRaise * 0.55);
          ctx.stroke();
        } else {
          const isJumping = p.y < FLOOR_Y - PH - 8 && p.vy < 0;
          if (isJumping && !anim.active) {
            // Contest / block pose: both arms spike straight up overhead
            const jumpRise = Math.max(0, (FLOOR_Y - PH - p.y) / (PH * 0.8)); // 0→1 as player rises
            const armExt = 16 + jumpRise * 14; // arms extend more at peak of jump
            ctx.beginPath();
            ctx.moveTo(sx - 5, shoulderY);
            ctx.lineTo(sx - 8, shoulderY - armExt * 0.55);
            ctx.lineTo(sx - 9, shoulderY - armExt);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + 5, shoulderY);
            ctx.lineTo(sx + 8, shoulderY - armExt * 0.55);
            ctx.lineTo(sx + 9, shoulderY - armExt);
            ctx.stroke();
          } else {
            // Defensive stance: arms flared wide from chest level, hands active
            const opponent = isP1 ? s.player2 : s.player1;
            const defDir = opponent.x + opponent.w / 2 > cx ? 1 : -1; // toward ball handler
            // Pulse makes hands look alive — oscillates between arms slightly
            const pulse = Math.sin(Date.now() / 220) * 2;
            // Anchor at upper-chest (below neck so arms don't clip through head)
            const chestY = shoulderY + 5;
            // Front arm (toward ball): elbow flares wide, wrist at shoulder level
            ctx.beginPath();
            ctx.moveTo(sx, chestY);
            ctx.lineTo(sx + defDir * 17, chestY - 2 + pulse);
            ctx.lineTo(sx + defDir * 27, chestY + 4 + pulse * 0.6);
            ctx.stroke();
            // Back arm: spread behind for balance, roughly horizontal
            ctx.beginPath();
            ctx.moveTo(sx, chestY);
            ctx.lineTo(sx - defDir * 15, chestY + 1 - pulse * 0.6);
            ctx.lineTo(sx - defDir * 23, chestY + 6 - pulse);
            ctx.stroke();
          } // end else (defensive stance)
        } // end else (!airborne)
      } else if (hasBall && !anim.active && !isCharging) {
        // Dribbling: active arm reaches down to ball, other arm hangs
        const activeCrossover = isP1 ? s.p1Crossover : s.p2Crossover;
        const isBTB = activeCrossover.active && activeCrossover.type === "btb";

        if (isBTB) {
          // Ball is behind back — both arms hang naturally, ball hidden behind torso
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 6, sy + 12);
          ctx.lineTo(sx - 8, sy + 22);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 6, sy + 12);
          ctx.lineTo(sx + 8, sy + 22);
          ctx.stroke();
        } else {
          // Convert ball canvas position into drawing-space Y (accounting for VISUAL_SCALE transform)
          const ballDrawX = s.ball.x;
          const ballDrawY =
            (s.ball.y - BALL_R - footAbs + dunkJump) / VISUAL_SCALE + footAbs;
          const dribSide = s.ball.x > cx ? 1 : -1; // which side ball is on

          // bounceT: 0 = ball at hand, 1 = ball at floor — recompute from dribble phase
          const bounceT = Math.abs(Math.sin(s.dribblePhase * 2.5));
          // armContact: 1 = hand touching ball (top of bounce), 0 = hand released (ball in flight)
          const armContact = Math.max(0, 1 - bounceT * 3.2);

          // Wrist lerps between ball-contact position and a relaxed follow-through hang
          const releaseX = sx + dribSide * 10;
          const releaseY = shoulderY + 20; // arm hangs ready while ball is in flight
          const wristX = ballDrawX * armContact + releaseX * (1 - armContact);
          const wristY = ballDrawY * armContact + releaseY * (1 - armContact);

          const elbowX = sx + dribSide * 9;
          const elbowY = shoulderY + (wristY - shoulderY) * 0.5;
          ctx.beginPath();
          ctx.moveTo(sx, shoulderY);
          ctx.lineTo(elbowX, elbowY);
          ctx.lineTo(wristX, wristY);
          ctx.stroke();
          // Rest arm hangs on opposite side
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - dribSide * 7, sy + 10);
          ctx.lineTo(sx - dribSide * 9, sy + 20);
          ctx.stroke();
        }
      } else {
        // Shooting / charging: arms rise into shot form
        const shootDir = isP1 ? 1 : -1;
        // chargeRiseT: 0 = fully resting, 1 = full shot form (kicks in once arm starts raising)
        const chargeRiseT = Math.min(1, armRaise / 10);
        // Shooting arm: hangs down at rest, extends toward hoop overhead when shooting
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + shootDir * 8 * chargeRiseT,
          sy + 14 * (1 - chargeRiseT) - armRaise * 0.6 * chargeRiseT
        );
        ctx.lineTo(
          sx + shootDir * 14 * chargeRiseT,
          sy + 24 * (1 - chargeRiseT) - armRaise * chargeRiseT
        );
        ctx.stroke();
        // Guide arm: hangs down at rest, cradles lower when shooting
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx - shootDir * 6 * chargeRiseT,
          sy + 12 * (1 - chargeRiseT) - armRaise * 0.35 * chargeRiseT
        );
        ctx.lineTo(
          sx - shootDir * 10 * chargeRiseT,
          sy + 22 * (1 - chargeRiseT) - armRaise * 0.55 * chargeRiseT
        );
        ctx.stroke();
      }

      // Jersey
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(
        cx - 9 + leanX * 0.3,
        shoulderY - armRaise * 0.1,
        18,
        waistY - shoulderY,
        3
      );
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isP1 ? "1" : "2", cx + leanX * 0.3, shoulderY + 14);

      // Head (leans with body)
      const hx = cx + leanX;
      ctx.fillStyle = p.skinColor;
      ctx.beginPath();
      ctx.arc(hx, headCY - armRaise * 0.05, HEAD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(hx, headCY - 2 - armRaise * 0.05, HEAD_R, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(hx + (isP1 ? 4 : -4), headCY + 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cx - 13, p.y - 18, 26, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isP1 ? "P1" : "P2", cx, p.y - 7);

      // Shot meter (only while charging)
      if (isCharging && hasBall) {
        const defender = isP1 ? s.player2 : s.player1;
        drawShotMeter(p, charge, defenderDist(p, defender));
      }

      // Stamina bar (visible when holding ball or while exhausted)
      const stamina = isP1 ? s.p1Stamina : s.p2Stamina;
      const exhausted = isP1 ? s.p1Exhausted : s.p2Exhausted;
      if (hasBall || exhausted) drawStaminaBar(p, stamina, exhausted);

      ctx.restore(); // end dunk jump translate
    }

    function drawBall() {
      const b = s.ball;
      const grad = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, b.r);
      grad.addColorStop(0, "#fde68a");
      grad.addColorStop(0.5, "#f59e0b");
      grad.addColorStop(1, "#b45309");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x - b.r + 1, b.y);
      ctx.lineTo(b.x + b.r - 1, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
    }

    function drawReachArm(
      p: Player,
      reaching: boolean,
      reachPhase: number,
      targetP: Player
    ) {
      if (!reaching) return;
      const cx = p.x + p.w / 2;
      const shoulderY = p.y + HEAD_R * 2 + 5;
      const tx = targetP.x + targetP.w / 2;
      const dir = tx > cx ? 1 : -1;
      const reach = Math.sin(reachPhase * Math.PI); // 0→1→0
      const ARM_MAX = 38; // fixed max arm length — never stretches across court
      const ex = cx + dir * ARM_MAX * reach;
      const ey = shoulderY + 10 - reach * 6;
      ctx.strokeStyle = p.skinColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, shoulderY + 4);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Hand glow
      if (reach > 0.3) {
        ctx.fillStyle = `rgba(255,200,50,${reach * 0.7})`;
        ctx.beginPath();
        ctx.arc(ex, ey, 6 * reach, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawAnkleBroken(p: Player, frames: number) {
      const cx = p.x + p.w / 2;
      const fy = FLOOR_Y;
      const t = Math.min(1, frames / 30); // tilt in quickly, stay down
      const angle = (Math.PI / 2) * t; // rotate 90° to lay flat
      ctx.save();
      ctx.translate(cx, fy);
      ctx.rotate(angle * (p === s.player1 ? -1 : 1));
      // Draw lying figure
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-PH * 0.5, 0);
      ctx.stroke();
      ctx.fillStyle = p.skinColor;
      ctx.beginPath();
      ctx.arc(-PH * 0.5 - HEAD_R, 0, HEAD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(-PH * 0.5 - HEAD_R, 0, HEAD_R, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      // Legs splayed
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 12);
      ctx.stroke();
      ctx.restore();
    }

    function drawAnklePopup() {
      if (!s.anklePopup.active) return;
      const fade = Math.min(1, s.anklePopup.frames / 30);
      const rise = (90 - s.anklePopup.frames) * 0.5;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(
        "💀 ANKLE BREAKER!",
        s.anklePopup.x,
        s.anklePopup.y - rise
      );
      ctx.fillStyle = "#fde047";
      ctx.fillText("💀 ANKLE BREAKER!", s.anklePopup.x, s.anklePopup.y - rise);
      ctx.restore();
    }

    function drawDunkPopup() {
      if (!s.dunkPopup.active) return;
      const fade = Math.min(1, s.dunkPopup.frames / 30);
      const rise = (100 - s.dunkPopup.frames) * 0.6;
      ctx.save();
      ctx.globalAlpha = fade;
      // Pulsing scale for impact
      const scale = 1 + Math.sin(s.dunkPopup.frames * 0.3) * 0.08;
      ctx.translate(s.dunkPopup.x, s.dunkPopup.y - rise);
      ctx.scale(scale, scale);
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 5;
      ctx.strokeText("🏀 SLAM DUNK!", 0, 0);
      ctx.fillStyle = "#f97316";
      ctx.fillText("🏀 SLAM DUNK!", 0, 0);
      ctx.restore();
    }

    function drawGreenPopup() {
      if (!s.greenPopup.active) return;
      const TOTAL = 90;
      const f = s.greenPopup.frames;
      // Fade in fast (first 10 frames), hold, then fade out over last 30
      const fade = f > TOTAL - 10 ? (TOTAL - f) / 10 : Math.min(1, f / 30);
      const rise = (TOTAL - f) * 0.45;
      ctx.save();
      ctx.globalAlpha = fade;
      const pulse = 1 + Math.sin(f * 0.25) * 0.06;
      ctx.translate(s.greenPopup.x, s.greenPopup.y - rise);
      ctx.scale(pulse, pulse);
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 4;
      ctx.strokeText("GREEN", 0, 0);
      ctx.fillStyle = "#4ade80";
      ctx.fillText("GREEN", 0, 0);
      ctx.restore();
    }

    function drawBlockPopup() {
      if (!s.blockPopup.active) return;
      const TOTAL = 90;
      const f = s.blockPopup.frames;
      const fade = f > TOTAL - 10 ? (TOTAL - f) / 10 : Math.min(1, f / 20);
      const rise = (TOTAL - f) * 0.5;
      ctx.save();
      ctx.globalAlpha = fade;
      const pulse = 1 + Math.sin(f * 0.35) * 0.08;
      ctx.translate(s.blockPopup.x, s.blockPopup.y - rise);
      ctx.scale(pulse, pulse);
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 5;
      ctx.strokeText("✋ BLOCKED!", 0, 0);
      ctx.fillStyle = "#60a5fa";
      ctx.fillText("✋ BLOCKED!", 0, 0);
      ctx.restore();
    }

    function drawFoulPopup() {
      if (!s.foulPopup.active) return;
      const TOTAL = 100;
      const f = s.foulPopup.frames;
      const fade = f > TOTAL - 10 ? (TOTAL - f) / 10 : Math.min(1, f / 20);
      const rise = (TOTAL - f) * 0.4;
      ctx.save();
      ctx.globalAlpha = fade;
      const pulse = 1 + Math.sin(f * 0.3) * 0.07;
      ctx.translate(s.foulPopup.x, s.foulPopup.y - rise);
      ctx.scale(pulse, pulse);
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 5;
      ctx.strokeText("🚨 FOUL!", 0, 0);
      ctx.fillStyle = "#fb923c";
      ctx.fillText("🚨 FOUL!", 0, 0);
      ctx.restore();
    }

    function updateNet() {
      // Spring constants per ring: stiffer near rim, softer at bottom
      const ringK = [0.5, 0.36, 0.26, 0.16];
      const b = s.ball;

      for (let hIdx = 0; hIdx < HOOPS.length; hIdx++) {
        const h = HOOPS[hIdx];
        const rings = hIdx === 0 ? netRef.current.left : netRef.current.right;
        const rMinX = Math.min(h.rimX1, h.rimX2);
        const rMaxX = Math.max(h.rimX1, h.rimX2);
        const netW = rMaxX - rMinX;

        // Spring physics per ring
        for (let r = 0; r < NET_RINGS; r++) {
          const k = ringK[r];
          for (const nd of rings[r]) {
            nd.vy += -k * nd.dy;
            nd.vy *= SPRING_DAMP;
            nd.dy += nd.vy;
          }
        }

        // Ball impulse
        if (
          b.x > rMinX - b.r &&
          b.x < rMaxX + b.r &&
          b.y + b.r > h.rimY &&
          b.y - b.r < h.rimY + NET_H + 6
        ) {
          const force =
            (Math.abs(b.vy) * 0.18 + 0.8) * (b.scoringThrough ? 2.8 : 1);
          for (let r = 0; r < NET_RINGS; r++) {
            const rowFrac = (r + 1) / NET_RINGS;
            const taper = 1 - 0.24 * rowFrac;
            const indent = (netW * (1 - taper)) / 2;
            const effW = netW - 2 * indent;
            for (let i = 0; i <= NET_COLS; i++) {
              const nx = rMinX + indent + effW * (i / NET_COLS);
              const influence = Math.max(
                0,
                1 - Math.abs(nx - b.x) / (netW * 0.75)
              );
              rings[r][i].vy += force * influence * rowFrac;
            }
          }
        }

        // Player foot impulse
        for (const p of [s.player1, s.player2]) {
          const px = p.x + p.w / 2;
          const footY = p.y + p.h;
          if (
            px > rMinX - 8 &&
            px < rMaxX + 8 &&
            footY > h.rimY - 4 &&
            footY < h.rimY + NET_H + 14
          ) {
            for (let r = 0; r < NET_RINGS; r++) {
              const rowFrac = (r + 1) / NET_RINGS;
              for (let i = 0; i <= NET_COLS; i++) {
                const nx = rMinX + netW * (i / NET_COLS);
                const influence = Math.max(0, 1 - Math.abs(nx - px) / 24);
                rings[r][i].vy += 1.8 * influence * rowFrac;
              }
            }
          }
        }
      }
    }

    function loop(ts: number) {
      s.animId = requestAnimationFrame(loop);
      // 60fps cap — skip frames on 120/144Hz displays to keep physics dt consistent
      if (ts - _lastFrameTime < 15.5) return;
      _lastFrameTime = ts;

      updatePlayers();
      tryPickup();
      checkBlocks();
      updateBall();
      updateNet();
      drawCourt();
      drawHoops();

      // Detect active BTB dribble — ball must render behind the player so legs layer over it
      const p1BTB =
        s.ballHolder === "p1" &&
        s.p1Crossover.active &&
        s.p1Crossover.type === "btb";
      const p2BTB =
        s.ballHolder === "p2" &&
        s.p2Crossover.active &&
        s.p2Crossover.type === "btb";
      const btbActive = p1BTB || p2BTB;

      // During BTB: draw ball first so the player body + legs paint over it
      if (btbActive) drawBall();

      // Draw fallen players behind standing ones
      if (s.p1AnkleBroken) drawAnkleBroken(s.player1, s.p1AnkleBrokenFrames);
      if (s.p2AnkleBroken) drawAnkleBroken(s.player2, s.p2AnkleBrokenFrames);
      if (!s.p1AnkleBroken)
        drawPlayerChar(
          s.player1,
          s.ballHolder === "p1",
          s.p1Charging,
          s.p1Charge,
          s.p1Anim,
          s.p1RunPhase
        );
      if (!s.p2AnkleBroken)
        drawPlayerChar(
          s.player2,
          s.ballHolder === "p2",
          s.p2Charging,
          s.p2Charge,
          s.p2Anim,
          s.p2RunPhase
        );

      // Reach arms drawn on top
      drawReachArm(s.player1, s.p1Reaching, s.p1ReachPhase, s.player2);
      drawReachArm(s.player2, s.p2Reaching, s.p2ReachPhase, s.player1);

      // Normal: draw ball on top (already drawn above for BTB)
      if (!btbActive) drawBall();
      drawAnklePopup();
      drawDunkPopup();
      drawGreenPopup();
      drawFoulPopup();
      drawBlockPopup();
    }

    s.animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(s.animId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [canvasRef]);

  return score;
}

function GameInner({ onRestart }: { onRestart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [winner, setWinner] = useState<"p1" | "p2" | null>(null);
  const score = useGame(canvasRef, setWinner);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 select-none">
      <h1 className="text-3xl font-bold text-yellow-400 mb-3 tracking-wide">
        🏀 2-Player Basketball
      </h1>
      <div className="flex items-center gap-28 mb-3">
        <div className="text-center">
          <div className="text-blue-400 font-bold">Player 1</div>
          <div className="text-white text-5xl font-mono font-bold">
            {score.p1}
          </div>
          <div className="text-gray-500 text-xs mt-1">
            A/D move · W jump · F shoot · C crossover/reach
          </div>
        </div>
        <div className="text-gray-600 text-2xl font-bold">VS</div>
        <div className="text-center">
          <div className="text-red-400 font-bold">Player 2</div>
          <div className="text-white text-5xl font-mono font-bold">
            {score.p2}
          </div>
          <div className="text-gray-500 text-xs mt-1">
            ← → move · ↑ jump · / shoot · . crossover/reach
          </div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="border-2 border-yellow-600 rounded-xl shadow-2xl shadow-yellow-900/30"
          tabIndex={0}
        />

        {winner && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
            style={{
              background: "rgba(3,7,18,0.88)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div className="text-6xl mb-4">{winner === "p1" ? "🔵" : "🔴"}</div>
            <div
              className="text-4xl font-black mb-2 tracking-tight"
              style={{ color: winner === "p1" ? "#60a5fa" : "#f87171" }}
            >
              {winner === "p1" ? "Player 1" : "Player 2"} wins!
            </div>
            <div className="text-yellow-300 text-xl font-bold mb-1">
              {score.p1} — {score.p2}
            </div>
            <div className="text-white text-2xl font-extrabold mb-8 italic">
              "{winner === "p1" ? "Player 1" : "Player 2"} is js better"
            </div>
            <button
              onClick={onRestart}
              className="px-8 py-3 rounded-xl font-bold text-lg text-gray-950 bg-yellow-400 hover:bg-yellow-300 active:scale-95 transition-all shadow-lg"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-xs mt-3">
        Pick up ball · Hold shoot key to charge (auto-jumps!) · Release in the{" "}
        <span className="text-green-500 font-semibold">green zone</span> for a
        guaranteed make · Steal by running into opponent
      </p>
    </div>
  );
}

export default function Game() {
  const [gameKey, setGameKey] = useState(0);
  return <GameInner key={gameKey} onRestart={() => setGameKey((k) => k + 1)} />;
}
