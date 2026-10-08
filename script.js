const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const RAIL_Y = 70;
const PIT = { left: 40, right: 860, floor: 540 };
const GRAVITY = 1000;
const BOUNCE = 0.35;
const CLAW_SPEED = 220;
const DROP_SPEED = 260;
const LIFT_SPEED = 200;
const TIP = 56;
const CLAW_HOME_Y = RAIL_Y + 22;
const CLAW_MAX_Y = PIT.floor - TIP - 6;
const GRAB_RANGE = 40;
const BALL_R = 22;
const BAR_COUNT = 14;
const BAR_W = (PIT.right - PIT.left) / BAR_COUNT;
const BAR_H = 60;

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALE = [0,2,4,7,9];
const ROOT = 48;

const SEQ_STEPS = 8;
const seqState = {
    kick: new Array(SEQ_STEPS).fill(false),
    hat: new Array(SEQ_STEPS).fill(false)
};
let seqStep = 0;
let seqPlaying = false;
let seqTimer = null;
let seqBpm = 110;

function playKick(){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
}

function playHat(){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;

    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < bufferSize; i++){
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
}

function noteFromMidi(midiNote, velocity){
    const freq = noteToFreq(midiNote);
    const v = clamp(velocity / 127, 0.1, 1);
    playNote(freq, 'sawtooth', v);

    let closest = bars[0];
    let closestDist = Math.abs(bars[0].note - midiNote);
    for(const bar of bars){
        const dist = Math.abs(bar.note - midiNote);
        if(dist < closestDist){
            closest = bar;
            closestDist = dist;
        }
    }
    closest.glow = 1;
}

function handleMidiMessage(e){
    const [status, note, velocity] = e.data;
    const command = status & 0xf0;
    const noteOn = command === 0x90 && velocity > 0;
    if(!noteOn) return;

    ensureAudio();
    noteFromMidi(note, velocity);
}

function setMidiStatus(text, connected){
    const el = document.getElementById('midi-status');
    el.textContent = 'MIDI: ' + text;
    el.classList.toggle('on', connected);
}

function wireMidiInputs(midiAccess){
    const inputs = [...midiAccess.inputs.values()];
    if(inputs.length === 0){
        setMidiStatus('no device found', false);
        return;
    }
    for(const input of inputs){
        input.onmidimessage = handleMidiMessage;
    }
    setMidiStatus(inputs[0].name, true);
}

function initMidi(){
    if(!navigator.requestMIDIAccess){
        setMidiStatus(midiAccess);
        midiAccess.onstatechange = () => wireMidiInputs(midiAccess);
    }
    navigation.requestAnimationFrame().then(midiAccess => {
        wireMidiInputs(midiAccess);
        midiAccess.onstatechange = () => wireMidiInputs(midiAccess);
    }).catch(() => {
        setMidiStatus('permission denied', false);
    });
}

function buildSeqUI(){
    for(const track of ['kick', 'hat']){
        const row = document.getElementById('seq-' + track);
        row.innerHTML = '';
        for(let i = 0; i < SEQ_STEPS; i++){
            const cell = document.createElement('div');
            cell.className = 'step';
            cell.addEventListener('click', () => {
                ensureAudio();
                seqState[track][i] = !seqState[track][i];
                cell.classList.toggle('on', seqState[track][i]);
            });
            row.appendChild(cell);
        }
    }
}

function refreshSeqHighlight(){
    for(const track of ['kick', 'hat']){
        const row = document.getElementById('seq-' + track);
        [...row.children].forEach((cell, i) => {
            cell.classList.toggle('current', i === seqStep);
        });
    }
}

function seqTick(){
    if(seqState.kick[seqStep]) playKick();
    if(seqState.hat[seqStep]) playHat();
    refreshSeqHighlight();
    seqStep = (seqStep + 1) % SEQ_STEPS;
}

function seqStart(){
    ensureAudio();
    seqPlaying = true;
    seqStep = 0;
    const stepMs = (60 / seqBpm / 2) * 1000;
    seqTimer = setInterval(seqTick, stepMs);
    document.getElementById('seq-play').textContent = 'STOP';
    document.getElementById('seq-play').classList.add('playing');
}

function seqStop(){
    seqPlaying = false;
    clearInterval(seqTimer);
    seqTimer = null;
    document.getElementById('seq-play').textContent = 'PLAY';
    document.getElementById('seq-play').classList.remove('playing');
    refreshSeqHighlight();
}

document.getElementById('seq-play').addEventListener('click', () => {
    if(seqPlaying) seqStop();
    else seqStart();
});

document.getElementById('seq-bpm').addEventListener('input', e => {
    seqBpm = Number(e.target.value);
    document.getElementById('seq-bpm-val').textContent = seqBpm;
    if(seqPlaying){
        clearInterval(seqTimer);
        const stepMs = (60 / seqBpm / 2) * 1000;
        seqTimer = setInterval(seqTick, stepMs);
    }
});

const BALL_TYPES = [
    { name: 'sine', wave: 'sine', label: 'SIN', hue: 190 },
    { name: 'triangle', wave: 'triangle', label: 'TRI', hue: 130 },
    { name: 'saw', wave: 'sawtooth', label: 'SAW', hue: 30 },
    { name: 'square', wave: 'square', label: 'SQR', hue: 320 },
    { name: 'pluck', wave: 'pluck', label: 'PLK', hue: 80 }
];

function barNote(i){
    return ROOT + SCALE[i % SCALE.length] + 12 * Math.floor(i / SCALE.length);
}

function noteName(n){
    return NOTE_NAMES[n % 12] + (Math.floor(n / 12) -1);
}

const bars = [];
for(let i = 0; i < BAR_COUNT; i++){
    bars.push({ i, x: PIT.left + i * BAR_W, note: barNote(i), glow: 0 });
}

const claw = {
    x: 500,
    y: CLAW_HOME_Y,
    open: 1,
    state: 'idle',
    timer: 0,
    held: null
};

const input = { left: false, right: false };

function updateClaw(dt){
    switch(claw.state){
        case 'idle':
            if(input.left) claw.x -= CLAW_SPEED * dt;
            if(input.right) claw.x += CLAW_SPEED * dt;
            break;
        case 'descending':
            claw.y += DROP_SPEED * dt;
            if(claw.y >= CLAW_MAX_Y || clawTouchesBall()){
                claw.state = 'grabbing';
                claw.timer = 0;
            }
            break;
        case 'grabbing':
            claw.timer += dt;
            claw.open = Math.max(0, 1 - claw.timer / 0.5);
            if(claw.timer >= 0.5){
                claw.held = pickBall();
                claw.state = 'lifting';
            }
            break;
        case 'lifting':
            claw.y -= LIFT_SPEED * dt;
            if(claw.y <= CLAW_HOME_Y){
                claw.y = CLAW_HOME_Y;
                claw.state = 'idle';
                claw.open = claw.held ? 0 : 1;
            }
            break;

    }
    claw.x = clamp(claw.x, PIT.left + 20, PIT.right - 20);

    if(claw.held){
        claw.held.x = claw.x;
        claw.held.y = claw.y + 50;
    }
}

window.addEventListener('keydown', e => {
    ensureAudio();
    if(e.key === 'ArrowLeft' || e.key === 'a'){
        e.preventDefault();
        input.left = true;
    }
    if(e.key === 'ArrowRight' || e.key === 'd'){
        e.preventDefault();
        input.right = true;
    }
    if(e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter'){
        e.preventDefault();
        pressDrop();
    }
});

window.addEventListener('keyup', e => {
    if(e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if(e.key === 'ArrowRight' || e.key === 'd') input.right = false;
});

function holdButton(id, name){
    const el = document.getElementById(id);
    const on = () => { ensureAudio(); input[name] = true; };
    const off = () => { input[name] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
}
holdButton('btn-left', 'left');
holdButton('btn-right', 'right');
document.getElementById('btn-drop').addEventListener('click', pressDrop);

let balls = [];

function randomType(){
    return BALL_TYPES[Math.floor(Math.random() * BALL_TYPES.length)];
}

function barUnder(x){
    const i = clamp(Math.floor((x - PIT.left) / BAR_W), 0, BAR_COUNT - 1);
    return bars[i];
}

function hitBar(b, impact){
    const bar = barUnder(b.x);
    bar.glow = 1;

    const freq = noteToFreq(bar.note);
    const velocity = clamp(impact / 700, 0.1, 1);

    if(b.type.wave === 'pluck'){
        playPluck(freq, velocity);
    } else {
        playNote(freq, b.type.wave, velocity);
    }
}

function makeBall(type, x, y){
    return { type, x, y, vx: 0, vy: 0, r: BALL_R, held: false };
}

function fillPit(count){
    balls = [];
    for(let i = 0; i < count; i++){
        balls.push(makeBall(randomType(), rand(PIT.left + BALL_R, PIT.right - BALL_R), rand(80, 300)));
    }
}

function integrate(p, dt){
    if(p.held) return;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
}

function pressDrop(){
    if(claw.held){
        letGo();
        return;
    }
    if(claw.state !== 'idle') return;
    claw.state = 'descending';
}

function clawTouchesBall(){
    const tipY = claw.y + TIP;
    return balls.some(b => 
        !b.held &&
        b.y > claw.y &&
        Math.abs(b.x - claw.x) < b.r + 14 &&
        b.y - b.r < tipY
    );
}

function pickBall(){
    let best = null;
    let bestDist = GRAB_RANGE;
    for(const b of balls){
        if(b.held) continue;
        const d = Math.hypot(b.x - claw.x, b.y - (claw.y + TIP));
        if(d < bestDist){
            best = b;
            bestDist = d;
        }
    }
    if(best) best.held = true;
    return best;
}

function letGo(){
    if(!claw.held) return;
    claw.held.held = false;
    claw.held.vx = 0;
    claw.held.vy = 0;
    claw.held = null;
    claw.open = 1;
}

function keepInBounds(b){
    if(b.held) return;

    if(b.y + b.r > PIT.floor){
        const impact = b.vy;
        b.y = PIT.floor - b.r;
        b.vy *= -BOUNCE;
        b.vx *= 0.9;

        if(impact > 120) hitBar(b, impact);
        if(Math.abs(b.vy) < 25) b.vy = 0;
    }
    if(b.x - b.r < PIT.left) { 
        b.x = PIT.left + b.r;
        b.vx *= -0.4;
    }
    if(b.x + b.r > PIT.right) {
        b.x = PIT.right - b.r;
        b.vx *= -0.4;
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
    for (let i = 0; i < 2; i++) collideBalls();
    for (const p of balls) keepInBounds(p);
    for(const bar of bars) bar.glow = Math.max(0, bar.glow - dt * 3);
}

// draw
function drawCabinet(){
    ctx.fillStyle = '#12121c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d1d30';
    ctx.fillRect(PIT.left, 30, PIT.right - PIT.left, PIT.floor - 30);
    ctx.fillStyle = '#4a4f68';
    ctx.fillRect(PIT.left, RAIL_Y - 6, PIT.right - PIT.left, 12);
}

function drawBars(){
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    for(const bar of bars){
        const lit = 45 + bar.glow * 25;
        ctx.fillStyle = `hsl(${200 + bar.i * 11}, 55%, ${lit}%)`;
        ctx.fillRect(bar.x + 2, PIT.floor, BAR_W - 4, BAR_H);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillText(noteName(bar.note), bar.x + BAR_W / 2, PIT.floor + BAR_H / 2);
    }
    ctx.fillStyle = '#34344f';
    ctx.fillRect(PIT.left - 8, PIT.floor + BAR_H, PIT.right - PIT.left + 16, H - PIT.floor - BAR_H);
}

function drawClaw(){
    ctx.strokeStyle = '#8a8fa8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(claw.x, RAIL_Y);
    ctx.lineTo(claw.x, claw.y);
    ctx.stroke();

    ctx.fillStyle = '#9aa0bd';
    ctx.fillRect(claw.x - 14, claw.y, 28, 14);

    const spread = 14 + claw.open * 24;
    ctx.strokeStyle = '#c9cde0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for(const side of [-1,1]){
        ctx.beginPath();
        ctx.moveTo(claw.x + side * 12, claw.y + 12);
        ctx.lineTo(claw.x + side * (spread + 8), claw.y + 34);
        ctx.lineTo(claw.x + side * spread, claw.y + TIP);
        ctx.stroke();
    }
}

function drawAimGuide(){
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(claw.x, claw.y + TIP);
    ctx.lineTo(claw.x, PIT.floor);
    ctx.stroke();
    ctx.restore();
}

function draw(){
    drawCabinet();
    drawBars();
    drawAimGuide();
    balls.forEach(drawBall);
    drawClaw();
}

function drawBall(b){
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${b.type.hue}, 65%, 55%)`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - 7, b.y - 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, 0.35)`;
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.type.label, b.x, b.y + 1);
}

function update(dt){
    updateClaw(dt);
    const steps = 3;
    for(let i = 0; i < steps; i++) stepPhysics(dt / steps);
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

let audioCtx = null;

function ensureAudio(){
    if(!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended'){
        audioCtx.resume();
    }
}

function noteToFreq(n){
    return 440 * Math.pow(2, (n - 69) / 12);
}

function playNote(freq, wave, velocity){
    if(!audioCtx) return;

    const now = audioCtx.currentTime;
    const peak = clamp(velocity, 0.08, 1) * 0.5;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 10, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.5);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const detunes = [-6, 0, 6];
    for(const cents of detunes){
        const osc = audioCtx.createOscillator();
        osc.type = wave;
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 0.95);
    }
}

function playPluck(freq, velocity){
    const sampleRate = audioCtx.sampleRate;
    const period = Math.round(sampleRate / freq);
    const duration = 1.2;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);
    const ringBuf = new Float32Array(period);
    for(let i = 0; i < period; i++){
        ringBuf[i] = (Math.random() * 2 - 1) * velocity;
    }
    let ringPos = 0;
    for(let i = 0; i < totalSamples; i++){
        const current = ringBuf[ringPos];
        const next = ringBuf[(ringPos + 1) % period];
        const avg = (current + next) * 0.5 * 0.996;
        ringBuf[ringPos] = avg;
        data[i] = current;
        ringPos = (ringPos + 1) % period;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.value = clamp(velocity, 0.1, 1);

    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);
}

buildSeqUI();
fillPit(16);
initMidi();
requestAnimationFrame(frame);