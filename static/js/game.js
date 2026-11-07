/* ============================
   Jogo Catecismo - Canvas
   ============================ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const elLives = document.getElementById('lives');
const elScore = document.getElementById('score');
const elTimer = document.getElementById('timer');

let W, H;
function resize(){
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

/* Estado */
let score = 0;
let lives = 3;
let gameOver = false;
let paused = false;
let gameTime = 0;

let stoneSpawnTimer = 0;
let powerSpawnTimer = 0;
let quizTimer = 0;
const QUIZ_MS = 15000;

const player = { x: 0, y: 0, w: 54, h: 20, speed: 7, color: '#2ecc71' };
player.x = W/2 - player.w/2;
player.y = H - 44;

const projectiles = [];
const stones = [];
const powerups = [];

let shotInterval = 700;
let lastShot = 0;

/* Controle de toque */
let targetX = player.x + player.w/2;
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
let isDragging = false;
let moveLeft = false, moveRight = false;

/* HUD */
function updateHUD(){
  elLives.textContent = lives;
  elScore.textContent = score;
  const m = Math.floor(gameTime/60);
  const s = Math.floor(gameTime%60);
  elTimer.textContent = (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

/* Tiros */
function shoot(){
  const now = Date.now();
  if (now - lastShot < shotInterval) return;
  lastShot = now;
  projectiles.push({
    x: player.x + player.w/2 - 2,
    y: player.y - 12,
    w: 4, h: 14, speed: 9, active: true
  });
}

/* Pedras */
function spawnStone(){
  const maxN = Math.min(3, 1 + Math.floor(score / 40));
  const number = Math.floor(Math.random() * maxN) + 1;
  const r = 11 + number * 10;
  const x = Math.random() * (W - r*2) + r;
  const speed = 1.5 + number * 0.55 + Math.random() * 1.2;
  stones.push({ x, y: -r, r, number, speed, active: true });
}

/* Power-ups */
const POWER_TYPES = [
  { type:'points', color:'#f1c40f', label:'+' },
  { type:'slow',   color:'#9b59b6', label:'↓' },
  { type:'life',   color:'#e74c3c', label:'❤' },
  { type:'shield', color:'#3498db', label:'◉' }
];
let slowUntil = 0;
let shieldUntil = 0;

function spawnPowerup(){
  const pt = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  const r = 15;
  const x = Math.random() * (W - r*2) + r;
  powerups.push({ x, y: -40, r, type: pt.type, color: pt.color, label: pt.label, speed: 2.2 + Math.random()*1.4, active: true });
}

function applyPowerup(p){
  const now = Date.now();
  if (p.type === 'points'){ score += 20; updateHUD(); }
  else if (p.type === 'life'){ lives += 1; updateHUD(); }
  else if (p.type === 'slow'){ slowUntil = now + 7000; }
  else if (p.type === 'shield'){ shieldUntil = now + 7000; }
}

/* Pergunta de catecismo (pausa o jogo) */
let quizEndTime = 0;
function showQuiz(){
  paused = true;
  fetch('/api/questions/random')
    .then(r => { if(!r.ok) throw new Error('sem pergunta'); return r.json(); })
    .then(q => {
      document.getElementById('quizText').textContent = q.text;
      const box = document.getElementById('quizOptions');
      box.innerHTML = '';
      q.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'quiz-opt';
        b.textContent = opt;
        b.onclick = () => handleQuizAnswer(q.id, opt, b);
        box.appendChild(b);
      });
      document.getElementById('quizFeedback').textContent = '';
      document.getElementById('modalQuiz').classList.remove('hidden');
    })
    .catch(() => { paused = false; });
}

function handleQuizAnswer(id, chosen, btn){
  fetch('/api/answer', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ sub_question_id: id, chosen })
  })
  .then(r => r.json())
  .then(res => {

/* Colisões */
function circleRect(cx, cy, r, rx, ry, rw, rh){
  const cx2 = Math.max(rx, Math.min(cx, rx + rw));
  const cy2 = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - cx2, dy = cy - cy2;
  return dx*dx + dy*dy <= r*r;
}

function update(dt){
  if (gameOver || paused) return;

  if (moveLeft)  player.x -= player.speed;
  if (moveRight) player.x += player.speed;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  const tx = targetX - player.w/2;
  const dx = tx - player.x;
  if (Math.abs(dx) > 1) player.x += Math.sign(dx) * Math.min(Math.abs(dx), player.speed);
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  gameTime += dt / 1000;
  quizTimer += dt;

  const stoneInterval = Math.max(420, 950 - Math.floor(score / 15) * 25);
  stoneSpawnTimer += dt;
  while (stoneSpawnTimer >= stoneInterval) {
    stoneSpawnTimer -= stoneInterval;
    spawnStone();
  }

  powerSpawnTimer += dt;
  if (powerSpawnTimer >= 7000 + Math.random() * 6000) {
    powerSpawnTimer = 0;
    spawnPowerup();
  }

  if (quizTimer >= QUIZ_MS) {
    quizTimer = 0;
    showQuiz();
    return;
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.y -= p.speed;
    if (p.y + p.h < 0) projectiles.splice(i, 1);
  }

  const slowActive = Date.now() < slowUntil;
  for (let i = stones.length - 1; i >= 0; i--) {
    const s = stones[i];
    s.y += slowActive ? s.speed * 0.45 : s.speed;

    let hit = false;
    for (let j = projectiles.length - 1; j >= 0; j--) {
      const p = projectiles[j];
      const pcx = p.x + p.w/2, pcy = p.y + p.h/2;
      if (Math.abs(pcx - s.x) < s.r + 5 && Math.abs(pcy - s.y) < s.r + 5) {
        projectiles.splice(j, 1);
        hit = true;
        break;
      }
    }
    if (hit) {
      if (s.number > 1) {
        const n2 = s.number - 1;
        const r2 = 11 + n2 * 10;
        stones.push({ x: s.x - r2*0.6, y: s.y, r: r2, number: n2, speed: s.speed, active: true });
        stones.push({ x: s.x + r2*0.6, y: s.y, r: r2, number: n2, speed: s.speed, active: true });
      } else {
        score += 10;
        updateHUD();
      }
      stones.splice(i, 1);
      continue;
    }

    if (circleRect(s.x, s.y, s.r, player.x, player.y, player.w, player.h)) {
      const now = Date.now();
      if (now < shieldUntil) { stones.splice(i, 1); continue; }
      lives -= 1;
      updateHUD();
      stones.splice(i, 1);
      if (lives <= 0) { gameOver = true; showGameOver(); }
      continue;
    }
    if (s.y - s.r > H) stones.splice(i, 1);
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.speed;
    if (circleRect(p.x, p.y, p.r, player.x, player.y, player.w, player.h)) {
      applyPowerup(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.y - p.r > H) powerups.splice(i, 1);
  }
}

function draw(){
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let y = 20; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  ctx.fillStyle = shieldUntil > Date.now() ? '#fbbf24' : player.color;
  ctx.shadowColor = player.color; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(player.x, player.y, player.w, player.h, 6);
  ctx.fill();
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(player.x + player.w/2 - 3, player.y - 10, 6, 10);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#f1c40f';
  projectiles.forEach(p => { ctx.fillRect(p.x, p.y, p.w, p.h); });

  stones.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = s.number === 3 ? '#ef4444' : s.number === 2 ? '#f59e0b' : '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = (s.r * 0.85) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.number, s.x, s.y + s.r*0.12);
  });

  powerups.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);

/* ============ Input ============ */
canvas.addEventListener('touchstart', e => {
  if (gameOver) return;
  const t = e.touches[0];
  touchStartX = t.clientX; touchStartY = t.clientY;
  touchStartTime = Date.now(); isDragging = false;
  const r2 = canvas.getBoundingClientRect();
  targetX = t.clientX - r2.left;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (gameOver) return;
  const t = e.touches[0];
  const r2 = canvas.getBoundingClientRect();
  targetX = t.clientX - r2.left;
  const dy = Math.abs(t.clientY - touchStartY);
  const dx = Math.abs(t.clientX - touchStartX);
  if (dx > 12 || dy > 12) isDragging = true;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (gameOver) return;
  if (!isDragging) {
    const now = Date.now();
    if (now - touchStartTime < 320) shoot();
  }
}, { passive: false });

const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');

function pressLeft(){ moveLeft = true; }
function releaseLeft(){ moveLeft = false; }
function pressRight(){ moveRight = true; }
function releaseRight(){ moveRight = false; }

for (const [el, press, release] of [
  [btnLeft, pressLeft, releaseLeft],
  [btnRight, pressRight, releaseRight]
]) {
  el.addEventListener('mousedown', press);
  el.addEventListener('touchstart', e => { e.preventDefault(); press(); }, {passive:false});
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  el.addEventListener('touchend', e => { e.preventDefault(); release(); }, {passive:false});
  el.addEventListener('touchcancel', release);
}
btnShoot.addEventListener('click', shoot);
btnShoot.addEventListener('touchstart', e => { e.preventDefault(); shoot(); }, {passive:false});

/* ============ Game over ============ */
function showGameOver(){
  document.getElementById('finalScore').textContent = score;
  document.getElementById('overlayGameOver').classList.remove('hidden');
  document.getElementById('playerName').value = '';
  document.getElementById('saveMsg').textContent = '';
}

const formScore = document.getElementById('formScore');
formScore.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('playerName').value.trim() || 'Anônimo';
  const btn = formScore.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  fetch('/api/score', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name, points: score })
  })
  .then(r => r.json())
  .then(res => {
    document.getElementById('saveMsg').textContent = '✅ Pontuação salva!';
    document.getElementById('saveMsg').style.color = '#2ecc71';
    btn.textContent = 'Ver placar';
    btn.onclick = () => { location.href = '/scores'; };
  })
  .catch(() => {
    document.getElementById('saveMsg').textContent = '⚠️ Falha ao salvar.';
    document.getElementById('saveMsg').style.color = '#ef4444';
    btn.disabled = false;
    btn.textContent = 'Salvar pontuação';
  });
});

/* Inicia */
updateHUD();
requestAnimationFrame(loop);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = (p.r * 0.75) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x, p.y + p.r*0.1);
  });
}

let lastTime = 0;
function loop(t){
  if (!lastTime) lastTime = t;
  const dt = t - lastTime;
  lastTime = t;
  update(dt);
  draw();
  if (!gameOver) requestAnimationFrame(loop);
  else draw();
}
    const fb = document.getElementById('quizFeedback');
    if (res.correct) {
      score += 25;
      fb.textContent = '✅ Correto! +25 pontos';
      fb.style.color = '#2ecc71';
    } else {
      score = Math.max(0, score - 10);
      fb.textContent = '❌ Errado! −10. Resposta: ' + res.answer;
      fb.style.color = '#e74c3c';
    }
    updateHUD();
    document.querySelectorAll('.quiz-opt').forEach(b => b.disabled = true);
    quizEndTime = Date.now() + 1300;
  });
}