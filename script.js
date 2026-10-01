const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const RAIL_Y = 70;
const PIT = { left: 40, right: 860, floor: 540 };
const DIVIDER = { x: 160, w: 14, h: 120 };

// draw
function drawCabinet(){
    ctx.fillstyle = '#12121c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillstyle = '#1d1d30';
    ctx.fillRect(PIT.left, 30, PIT.right - PIT.left, PIT.floor - 30);
    ctx.fillstyle = '#4a4f68';
    ctx.fillRect(PIT.left, RAIL_Y - 6, PIT.right - PIT.left, 12);
    ctx.fillstyle = '#07070c';
    ctx.fillRect(PIT.left, PIT.floor, DIVIDER.x - PIT.left, H - PIT.floor);
    ctx.fillstyle = '#34344f';
    ctx.fillRect(DIVIDER.x, PIT.floor, PIT.right - DIVIDER.x, H - PIT.floor);
    ctx.fillstyle = '#5b5f80';
    ctx.fillRect(DIVIDER.x, PIT.floor - DIVIDER.h, DIVIDER.w, DIVIDER.h);

    ctx.fillstyle = '#f2c14e';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CHUTE', (PIT.left + DIVIDER.x) / 2, PIT.floor + 40);
}

function draw(){
    drawCabinet();
}

let last = 0;
function frame(now){
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);