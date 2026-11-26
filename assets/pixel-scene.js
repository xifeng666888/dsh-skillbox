(() => {
  const canvas = document.querySelector("#pixel-scene");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const status = document.querySelector("#scene-status");
  const snowButton = document.querySelector("#snow-button");
  const feedButton = document.querySelector("#feed-button");
  const resetButton = document.querySelector("#reset-scene-button");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 960;
  let height = 400;
  let groundY = 340;
  let mobileMode = false;
  let snowing = true;
  let elapsed = 0;
  let previousTime = 0;
  let sceneVisible = true;
  let hoverObject = null;
  let previousHover = null;
  let heartCooldown = 0;
  let nearRice = false;
  let bubbleCooldown = 0;
  let mushroomTime = 10;

  const fish = { x: 180, y: 180, vx: 0, vy: 0, targetX: 180, targetY: 180, direction: 1 };
  const cloud = { x: 520, y: 80 };
  const rice = { x: 750, y: 275 };
  const mushroom = { x: 845, y: 315 };
  let snowflakes = [];
  let stars = [];
  let hearts = [];
  let bubbles = [];
  let spores = [];
  let poseOverride = null;
  let poseUntil = 0;
  const characterImages = {};
  const characterPoses = {
    idle: { width: 210, aspect: 889 / 500 },
    moving: { width: 150, aspect: 1 },
    happy: { width: 175, aspect: 360 / 300 },
  };

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function createSnow() {
    const count = reducedMotion ? 35 : Math.round(width / 10);
    snowflakes = Array.from({ length: count }, () => ({
      x: random(0, width),
      y: random(0, groundY),
      speed: random(20, 58),
      drift: random(-10, 10),
      size: Math.random() > 0.75 ? 3 : 2,
      phase: random(0, Math.PI * 2),
    }));
  }

  function createStars() {
    stars = Array.from({ length: Math.round(width / 36) }, () => ({
      x: random(12, width - 12),
      y: random(12, groundY - 65),
      phase: random(0, Math.PI * 2),
      color: Math.random() > 0.5 ? "#68d8d1" : "#b6d8dd",
    }));
  }

  function loadCharacterImages() {
    Object.keys(characterPoses).forEach((pose) => {
      const image = new Image();
      image.src = `assets/characters/${pose}.png`;
      image.onload = () => { image.dataset.loaded = "true"; };
      characterImages[pose] = image;
    });
  }

  function resizeScene() {
    mobileMode = canvas.clientWidth < 600;
    const oldWidth = width;
    const oldHeight = height;
    width = mobileMode ? 600 : 960;
    height = mobileMode ? 460 : 400;
    groundY = height - (mobileMode ? 64 : 58);
    canvas.width = width;
    canvas.height = height;

    fish.x = Math.max(45, Math.min(width - 45, fish.x / oldWidth * width));
    fish.y = Math.max(55, Math.min(groundY - 35, fish.y / oldHeight * height));
    fish.targetX = Math.max(45, Math.min(width - 45, fish.targetX / oldWidth * width));
    fish.targetY = Math.max(55, Math.min(groundY - 35, fish.targetY / oldHeight * height));
    cloud.x = width * 0.55;
    cloud.y = mobileMode ? 75 : 78;
    rice.x = width * 0.78;
    rice.y = groundY - 35;
    mushroom.x = width * 0.91;
    mushroom.y = groundY - 16;
    createSnow();
    createStars();
    draw();
  }

  function spawnHearts(amount = 7) {
    const count = reducedMotion ? Math.min(3, amount) : amount;
    for (let index = 0; index < count; index += 1) {
      hearts.push({
        x: fish.x + random(-12, 12),
        y: fish.y - 22,
        vx: random(-18, 18),
        vy: random(-48, -30),
        life: random(1, 1.5),
        maxLife: 1.5,
        size: random(2, 3.5),
      });
    }
  }

  function spawnSpores() {
    const count = reducedMotion ? 5 : 14;
    for (let index = 0; index < count; index += 1) {
      spores.push({
        x: mushroom.x + random(-8, 8),
        y: mushroom.y - 25,
        vx: random(-45, 45),
        vy: random(-65, -25),
        life: random(0.8, 1.4),
      });
    }
  }

  function toggleSnow() {
    snowing = !snowing;
    snowButton.textContent = snowing ? "暂停下雪" : "继续下雪";
    snowButton.setAttribute("aria-pressed", String(snowing));
    poseOverride = "idle";
    poseUntil = performance.now() + 1400;
    setStatus(snowing ? "云朵开始下雪啦，注意脚下积雪 ❄" : "雪停了，夜空安静下来了");
  }

  function feedFish() {
    fish.targetX = rice.x - 38 * fish.direction;
    fish.targetY = rice.y - 45;
    spawnHearts(9);
    poseOverride = "happy";
    poseUntil = performance.now() + 3500;
    setStatus("蛋炒饭出现！大肥鱼正加速游过去 ♡");
  }

  function summonFish() {
    fish.targetX = width * 0.48;
    fish.targetY = height * 0.42;
    fish.vx *= 0.25;
    fish.vy *= 0.25;
    poseOverride = "moving";
    poseUntil = performance.now() + 4000;
    setStatus("大肥鱼听到呼唤，正在游回画面中央");
    bubbleCooldown = 0;
  }

  function drawBackground() {
    rect(0, 0, width, height, "#0b1929");
    rect(0, groundY - 90, width, 90, "#0d1e2e");
    stars.forEach((star) => {
      const alpha = 0.35 + Math.sin(elapsed * 1.8 + star.phase) * 0.25;
      ctx.globalAlpha = alpha;
      rect(star.x, star.y, 2, 2, star.color);
      if (star.size > 2) rect(star.x - 2, star.y + 1, 6, 1, star.color);
    });
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    rect(0, groundY, width, height - groundY, "#102b3b");
    rect(0, groundY, width, 3, "#2c7f9a");
    rect(0, groundY + 3, width, 5, "#173e50");
    const drifts = [0.03, 0.16, 0.28, 0.43, 0.58, 0.7, 0.84, 0.95];
    drifts.forEach((position, index) => {
      const w = 28 + (index % 3) * 18;
      rect(width * position, groundY - 3, w, 4, "#c9e6e8");
      rect(width * position + 8, groundY - 6, w * 0.5, 3, "#e4f3f2");
    });
    [0.05, 0.2, 0.37, 0.59, 0.72, 0.94].forEach((position, index) => {
      const x = Math.round(width * position);
      rect(x, groundY - 10, 3, 10, "#39795c");
      rect(x + 5, groundY - 7, 3, 7, "#39795c");
      if (index % 2 === 0) {
        rect(x - 3, groundY - 18, 4, 4, "#f1d67a");
        rect(x + 3, groundY - 18, 4, 4, "#f1d67a");
        rect(x, groundY - 21, 4, 4, "#f4e7aa");
      }
    });
  }

  function drawCloud() {
    const drift = reducedMotion ? 0 : Math.sin(elapsed * 0.7) * 8;
    const x = cloud.x + drift;
    const y = cloud.y;
    if (hoverObject === "cloud") {
      ctx.globalAlpha = 0.16;
      rect(x - 58, y - 28, 116, 64, "#b8eff4");
      ctx.globalAlpha = 1;
    }
    rect(x - 45, y, 90, 20, "#678595");
    rect(x - 33, y - 12, 62, 18, "#7d9ba9");
    rect(x - 17, y - 20, 34, 12, "#8eabb7");
    rect(x - 45, y + 14, 90, 7, "#4d6b7c");
    rect(x - 32, y + 21, 64, 3, "#c8e2e7");
    if (hoverObject === "cloud") {
      ctx.fillStyle = "#b8dce3";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(snowing ? "点击停雪" : "点击下雪", x, y - 31);
    }
  }

  function drawSnow() {
    if (!snowing) return;
    snowflakes.forEach((flake) => {
      ctx.globalAlpha = 0.45 + Math.min(flake.speed / 90, 0.45);
      rect(flake.x, flake.y, flake.size, flake.size, "#e8f5f5");
      if (flake.size === 3) {
        rect(flake.x - 2, flake.y + 1, 7, 1, "#e8f5f5");
        rect(flake.x + 1, flake.y - 2, 1, 7, "#e8f5f5");
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawRice() {
    const x = rice.x;
    const y = rice.y;
    if (hoverObject === "rice") {
      ctx.globalAlpha = 0.16;
      rect(x - 48, y - 82, 96, 90, "#f5d36c");
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#f4d66f";
    ctx.font = `bold ${mobileMode ? 14 : 16}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("蛋炒饭", x, y - 69);
    rect(x - 3, y - 61, 6, 4, "#f4d66f");
    for (let layer = 0; layer < 3; layer += 1) {
      const offset = layer * 20;
      const bowlY = y - 48 + offset;
      const bowlWidth = 58 - layer * 8;
      rect(x - bowlWidth / 2, bowlY, bowlWidth, 9, layer === 1 ? "#875f3f" : "#476274");
      rect(x - bowlWidth / 2 - 3, bowlY - 5, bowlWidth + 6, 5, "#93a9ac");
      rect(x - bowlWidth / 2 + 3, bowlY - 13, bowlWidth - 6, 8, "#f2cb58");
      rect(x - bowlWidth / 2 + 9, bowlY - 16, 7, 5, "#fff0a1");
      rect(x - 6, bowlY - 11, 5, 4, "#d78f43");
      rect(x + 10, bowlY - 9, 4, 3, "#6fa875");
    }
  }

  function drawMushroom() {
    const jump = mushroomTime < 0.65 ? Math.sin(mushroomTime / 0.65 * Math.PI) * 24 : 0;
    const x = mushroom.x;
    const y = mushroom.y - jump;
    if (hoverObject === "mushroom") {
      ctx.globalAlpha = 0.16;
      rect(x - 25, y - 45, 50, 50, "#f8a9a1");
      ctx.globalAlpha = 1;
    }
    rect(x - 7, y - 13, 14, 15, "#e8e1c1");
    rect(x - 13, y - 28, 26, 16, "#d96263");
    rect(x - 18, y - 23, 36, 11, "#d96263");
    rect(x - 9, y - 32, 18, 5, "#ee8380");
    rect(x - 8, y - 24, 5, 5, "#fff0da");
    rect(x + 7, y - 19, 5, 5, "#fff0da");
  }

  function currentCharacterPose() {
    if (poseOverride && performance.now() < poseUntil) return poseOverride;
    if (Math.hypot(fish.x - rice.x, fish.y - (rice.y - 35)) < 115) return "happy";
    if (Math.hypot(fish.vx, fish.vy) > 30) return "moving";
    return "idle";
  }

  function drawBlink(pose, w, h) {
    if (reducedMotion || pose === "happy" || elapsed % 5.4 > 0.14) return;
    const points = pose === "moving"
      ? [[0.35, 0.548], [0.535, 0.548]]
      : [[0.427, 0.426], [0.527, 0.426]];
    const eyeWidth = w * (pose === "moving" ? 0.075 : 0.046);
    const eyeHeight = Math.max(2, h * 0.018);
    points.forEach(([px, py]) => {
      const x = (px - 0.5) * w;
      const y = (py - 0.5) * h;
      ctx.fillStyle = "#ffe2d5";
      ctx.beginPath();
      ctx.ellipse(x, y, eyeWidth / 2, eyeHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#392f48";
      ctx.lineWidth = Math.max(1, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(x - eyeWidth / 2, y);
      ctx.quadraticCurveTo(x, y + eyeHeight, x + eyeWidth / 2, y);
      ctx.stroke();
    });
  }

  function drawFloatingHair(pose, w, h) {
    if (reducedMotion) return;
    const colors = ["#2f6fb3", "#54a8df", "#a2d8f6"];
    for (let index = 0; index < 7; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const startX = side * w * (0.22 + (index % 3) * 0.025);
      const startY = -h * 0.08 + index * h * 0.055;
      const wave = Math.sin(elapsed * 2.8 + index * 0.85) * (5 + index);
      const length = h * (0.18 + (index % 3) * 0.055);
      ctx.strokeStyle = colors[index % colors.length];
      ctx.globalAlpha = 0.68;
      ctx.lineWidth = Math.max(1, w * 0.007);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        startX + side * (8 + wave * 0.3), startY + length * 0.3,
        startX + side * (14 + wave), startY + length * 0.7,
        startX + side * (10 + wave), startY + length,
      );
      ctx.stroke();
    }
    const tailWave = Math.sin(elapsed * 3.1) * 8;
    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = "#4e99d5";
    ctx.lineWidth = Math.max(1.5, w * 0.009);
    ctx.beginPath();
    ctx.moveTo(w * 0.23, h * 0.08);
    ctx.bezierCurveTo(w * 0.37, h * 0.12, w * 0.42 + tailWave, h * 0.24, w * 0.5 + tailWave, h * 0.28);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCharacter() {
    const pose = currentCharacterPose();
    const image = characterImages[pose];
    if (!image || !image.complete || !image.naturalWidth) return false;
    const spec = characterPoses[pose];
    const breath = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.2) * 0.014;
    const w = spec.width * breath;
    const h = w / spec.aspect * breath;
    const bob = reducedMotion ? 0 : Math.sin(elapsed * 2.4) * 3;
    const tilt = reducedMotion ? 0 : Math.max(-0.45, Math.min(0.45, fish.vx / 260)) * 0.12 + Math.sin(elapsed * 1.4) * 0.018;

    ctx.save();
    ctx.translate(Math.round(fish.x), Math.round(fish.y + bob));
    ctx.scale(fish.direction, 1);
    ctx.rotate(tilt);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#06121f";
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + 8, w * 0.27, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    drawBlink(pose, w, h);
    drawFloatingHair(pose, w, h);
    ctx.restore();
    return true;
  }

  function drawFish() {
    if (drawCharacter()) return;
    const bob = reducedMotion ? 0 : Math.sin(elapsed * 5) * 2;
    const tail = reducedMotion ? 0 : Math.sin(elapsed * 10) * 4;
    ctx.save();
    ctx.translate(Math.round(fish.x), Math.round(fish.y + bob));
    ctx.scale(fish.direction, 1);

    rect(-40, -9 + tail, 13, 18, "#e99b55");
    rect(-47, -14 + tail, 8, 9, "#f0b667");
    rect(-47, 5 + tail, 8, 9, "#f0b667");
    rect(-29, -17, 43, 34, "#5ec7bd");
    rect(-21, -22, 31, 6, "#73d7c8");
    rect(-31, -11, 54, 23, "#5ec7bd");
    rect(-21, 12, 34, 9, "#e6e6c6");
    rect(-12, 17, 20, 5, "#c8d7bd");
    rect(-8, -27, 15, 7, "#e99b55");
    rect(-5, 17, 14, 8, "#e99b55");
    rect(7, -10, 13, 13, "#f4f2d8");
    rect(11, -7, 5, 6, "#152c39");
    rect(18, 6, 7, 3, "#307b78");
    rect(-17, -9, 7, 7, "#89e0d1");
    rect(-14, 1, 5, 5, "#4ca9a5");
    ctx.restore();
  }

  function drawHeart(x, y, size, alpha) {
    ctx.globalAlpha = alpha;
    rect(x - size * 2, y, size * 2, size * 2, "#ff8f9f");
    rect(x + size, y, size * 2, size * 2, "#ff8f9f");
    rect(x - size * 2, y + size, size * 5, size * 2, "#ff8f9f");
    rect(x - size, y + size * 3, size * 3, size, "#ff8f9f");
    rect(x, y + size * 4, size, size, "#ff8f9f");
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    hearts.forEach((heart) => drawHeart(heart.x, heart.y, heart.size, Math.max(0, heart.life / heart.maxLife)));
    bubbles.forEach((bubble) => {
      ctx.globalAlpha = Math.max(0, bubble.life / 1.4);
      ctx.strokeStyle = "#79cbd4";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(bubble.x), Math.round(bubble.y), bubble.size, bubble.size);
    });
    spores.forEach((spore) => {
      ctx.globalAlpha = Math.max(0, spore.life / 1.4);
      rect(spore.x, spore.y, 3, 3, "#f6d990");
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    drawBackground();
    drawSnow();
    drawCloud();
    drawGround();
    drawRice();
    drawMushroom();
    drawParticles();
    drawFish();
  }

  function updateParticles(dt) {
    hearts.forEach((heart) => {
      heart.x += heart.vx * dt;
      heart.y += heart.vy * dt;
      heart.life -= dt;
    });
    hearts = hearts.filter((heart) => heart.life > 0);
    bubbles.forEach((bubble) => {
      bubble.y -= 25 * dt;
      bubble.x += Math.sin(elapsed * 4 + bubble.phase) * 5 * dt;
      bubble.life -= dt;
    });
    bubbles = bubbles.filter((bubble) => bubble.life > 0);
    spores.forEach((spore) => {
      spore.x += spore.vx * dt;
      spore.y += spore.vy * dt;
      spore.vy += 70 * dt;
      spore.life -= dt;
    });
    spores = spores.filter((spore) => spore.life > 0);
  }

  function update(dt) {
    const dx = fish.targetX - fish.x;
    const dy = fish.targetY - fish.y;
    fish.vx += dx * 7 * dt;
    fish.vy += dy * 7 * dt;
    const drag = Math.exp(-4.5 * dt);
    fish.vx *= drag;
    fish.vy *= drag;
    const speed = Math.hypot(fish.vx, fish.vy);
    const maxSpeed = 250;
    if (speed > maxSpeed) {
      fish.vx = fish.vx / speed * maxSpeed;
      fish.vy = fish.vy / speed * maxSpeed;
    }
    fish.x = Math.max(40, Math.min(width - 40, fish.x + fish.vx * dt));
    fish.y = Math.max(50, Math.min(groundY - 30, fish.y + fish.vy * dt));
    if (Math.abs(fish.vx) > 8) fish.direction = fish.vx > 0 ? 1 : -1;

    bubbleCooldown -= dt;
    if (speed > 45 && bubbleCooldown <= 0) {
      bubbles.push({ x: fish.x + fish.direction * 22, y: fish.y - 5, size: Math.round(random(3, 7)), life: 1.4, phase: random(0, 6) });
      bubbleCooldown = reducedMotion ? 0.5 : 0.18;
    }

    heartCooldown -= dt;
    const riceDistance = Math.hypot(fish.x - rice.x, fish.y - (rice.y - 35));
    const isNearRice = riceDistance < 90;
    if (isNearRice && heartCooldown <= 0) {
      spawnHearts(4);
      heartCooldown = 1.1;
    }
    if (isNearRice && !nearRice) setStatus("大肥鱼吃到蛋炒饭，开心地比心 ♡");
    nearRice = isNearRice;

    mushroomTime += dt;
    if (snowing) {
      snowflakes.forEach((flake) => {
        flake.y += flake.speed * dt;
        flake.x += (flake.drift + Math.sin(elapsed + flake.phase) * 6) * dt;
        if (flake.y > groundY - 4) {
          flake.y = random(-35, -3);
          flake.x = random(0, width);
        }
        if (flake.x < 0) flake.x = width;
        if (flake.x > width) flake.x = 0;
      });
    }
    updateParticles(dt);
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * width / bounds.width,
      y: (event.clientY - bounds.top) * height / bounds.height,
    };
  }

  function hitTest(point) {
    if (point.x > cloud.x - 65 && point.x < cloud.x + 65 && point.y > cloud.y - 42 && point.y < cloud.y + 38) return "cloud";
    if (point.x > mushroom.x - 32 && point.x < mushroom.x + 32 && point.y > mushroom.y - 65 && point.y < mushroom.y + 20) return "mushroom";
    if (point.x > rice.x - 50 && point.x < rice.x + 50 && point.y > rice.y - 90 && point.y < rice.y + 48) return "rice";
    return null;
  }

  function updateHover(nextHover) {
    hoverObject = nextHover;
    canvas.classList.toggle("object-hover", Boolean(hoverObject));
    if (hoverObject === previousHover) return;
    previousHover = hoverObject;
    if (hoverObject === "cloud") setStatus("云朵：点击我可以切换下雪");
    if (hoverObject === "rice") setStatus("蛋炒饭：点击投喂大肥鱼");
    if (hoverObject === "mushroom") setStatus("蘑菇：点击看看我会怎样");
  }

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    fish.targetX = Math.max(45, Math.min(width - 45, point.x));
    fish.targetY = Math.max(55, Math.min(groundY - 35, point.y));
    updateHover(hitTest(point));
  });

  canvas.addEventListener("pointerleave", () => updateHover(null));

  canvas.addEventListener("click", (event) => {
    const point = canvasPoint(event);
    const object = hitTest(point);
    if (object === "cloud") {
      toggleSnow();
      return;
    }
    if (object === "rice") {
      feedFish();
      return;
    }
    if (object === "mushroom") {
      mushroomTime = 0;
      spawnSpores();
      poseOverride = "moving";
      poseUntil = performance.now() + 1500;
      setStatus("蘑菇弹跳了一下，散落出发光孢子 ✦");
      return;
    }
    fish.targetX = Math.max(45, Math.min(width - 45, point.x));
    fish.targetY = Math.max(55, Math.min(groundY - 35, point.y));
    poseOverride = "moving";
    poseUntil = performance.now() + 4000;
    setStatus("大肥鱼收到新目的地，摆尾出发！");
  });

  canvas.addEventListener("keydown", (event) => {
    const movement = 38;
    if (event.key === "Enter") {
      feedFish();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") fish.targetX -= movement;
    else if (event.key === "ArrowRight") fish.targetX += movement;
    else if (event.key === "ArrowUp") fish.targetY -= movement;
    else if (event.key === "ArrowDown") fish.targetY += movement;
    else return;
    fish.targetX = Math.max(45, Math.min(width - 45, fish.targetX));
    fish.targetY = Math.max(55, Math.min(groundY - 35, fish.targetY));
    setStatus("方向键已调整大肥鱼的游动方向");
    event.preventDefault();
  });

  snowButton.addEventListener("click", toggleSnow);
  feedButton.addEventListener("click", feedFish);
  resetButton.addEventListener("click", summonFish);
  window.addEventListener("resize", () => {
    if ((canvas.clientWidth < 600) !== mobileMode) resizeScene();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      sceneVisible = entries[0].isIntersecting;
      previousTime = 0;
    }).observe(canvas);
  }

  function frame(timestamp) {
    const dt = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.04) : 0.016;
    previousTime = timestamp;
    if (sceneVisible && !document.hidden) {
      elapsed += dt;
      update(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  loadCharacterImages();
  resizeScene();
  requestAnimationFrame(frame);
})();
