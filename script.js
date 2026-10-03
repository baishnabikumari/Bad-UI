const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const RAIL_Y = 70;
const PIT = { left: 40, right: 860, floor: 540 };
const DIVIDER = { x: 160, w: 14, h: 120 };
const GRAVITY = 1000;
const PRIZE_R = 24;
const PLAY_LEFT = DIVIDER.x + DIVIDER.w;
const BOUNCE = 0.35;

const SPAWN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZEEAAIIOOTNSR'.split('');
SPAWN.push(' ', ' ', 'BACK', 'BACK');

let prizes = [];

function barUnder(x){
    const i = clamp(Math.floor((x - PIT.left) / BAR_W), 0, BAR_COUNT - 1);
    return bars[i];
}

function hitBar(b, impact){
    const bar = barUnder(b.x);
    bar.glow = 1;
}

function makePrize(ch, x, y){
    return { ch, x, y, vx: 0, vy: 0, r: PRIZE_R, hue: rand(0, 360), held: false };
}

function fillPit(){
    prizes = SPAWN.map(ch =>
        makePrize(ch, rand(PLAY_LEFT + PRIZE_R, PIT.right - PRIZE_R), rand(100, 380))
    );
}

function labelFor(ch){
    if(ch === ' ') return '_';
    if(ch === 'BACK') return '\u2190';
    return ch;
}

function integrate(p, dt){
    if(p.held) return;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
}

function keepInBounds(b){
    if(b.held) return;

    if(b.x + b.r > bIT.floor){
        const impact = b.vy;
        b.y = bIT.floor - b.r;
        b.vy *= -BOUNCE;
        b.vx *= 0.9;
        if(impact > 120) hitBar(b, impact);
        if(Math.abs(b.vy) < 25) b.vy = 0;
    }
    if(b.x - b.r < PIT.left) { b.x = PIT.left + b.r; b.vx *= -0.4; }
    if(b.x + b.r > PIT.right) { b.x = PIT.right - b.r; b.vx *= -0.4; }
}

function hitDivider(p){
    if(p.held) return;
    const top = PIT.floor - DIVIDER.h;
    const cx = clamp(p.x, DIVIDER.x, DIVIDER.x + DIVIDER.w);
    const cy = clamp(p.y, top, PIT.floor);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy);
    if(dist >= p.r) return;

    if(dist === 0){
        p.y = top - p.r;
        p.vy = 0;
        return;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    p.x += nx * (p.r - dist);
    p.y += ny * (p.r - dist);

    const vn = p.vx * nx + p.vy * ny;
    if(vn < 0){
        p.vx -= (1 + BOUNCE) * vn * nx;
        p.vy -= (1 + BOUNCE) * vn * ny;
    }
}

function collideBalls(){
    for(let i = 0; i < balls.length; i++){
        for(let j = i + 1; j < balls.length; j++){
            const a = balls[i];
            const b = balls[j];
            if(a.held || b.held) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            if(dist >= minDist || dist === 0)continue;
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap / 2;
            a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2;
            b.y += ny * overlap / 2;

            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if(rel >= 0) continue;
            const e = rel < -40 ? BOUNCE : 0;
            const k = -(1 + e) * rel / 2;
            a.vx -= k * nx;
            a.vy -= k * ny;
            b.vx += k * nx;
            b.vy += k * ny;
        }
    }
}

function stepPhysics(dt){
    for(const p of balls) integrate(p, dt);
    for (let i = 0; i < 2; i++) collideballs();
    for (const p of balls){
        hitDivider(p);
    }
}

function drawPrize(p){
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${p.hue}, 65%, 55%)`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x - 8, p.y - 9, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelFor(p.ch), p.x, p.y + 1);
}
// draw
function drawCabinet(){
    ctx.fillStyle = '#12121c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d1d30';
    ctx.fillRect(PIT.left, 30, PIT.right - PIT.left, PIT.floor - 30);
    ctx.fillStyle = '#4a4f68';
    ctx.fillRect(PIT.left, RAIL_Y - 6, PIT.right - PIT.left, 12);
    ctx.fillStyle = '#07070c';
    ctx.fillRect(PIT.left, PIT.floor, DIVIDER.x - PIT.left, H - PIT.floor);
    ctx.fillStyle = '#34344f';
    ctx.fillRect(DIVIDER.x, PIT.floor, PIT.right - DIVIDER.x, H - PIT.floor);
    ctx.fillStyle = '#5b5f80';
    ctx.fillRect(DIVIDER.x, PIT.floor - DIVIDER.h, DIVIDER.w, DIVIDER.h);

    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CHUTE', (PIT.left + DIVIDER.x) / 2, PIT.floor + 40);
}

function draw(){
    drawCabinet();
    prizes.forEach(drawPrize);
}

function update(dt){
    const steps = 3;
    for(let i = 0; i < steps; i++) stepPhysics(dt / steps);
    for(const bar of bars) bar.glow = Math.max(0, bar.glow - dt * 3);
}

function rand(min, max){
    return min + Math.random() * (max - min);
}

function clamp(v, lo, hi){
    return Math.max(lo, Math.min(hi, v));
}

let last = 0;
function frame(now){
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

fillPit();
requestAnimationFrame(frame);