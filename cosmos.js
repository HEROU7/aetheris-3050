/**
 * AETHERIS 3050 — Aethel Engine (Cosmos)
 * Lienzo dinámico de polvo estelar, nebulosas procedurales,
 * paralaje con inercia y salto hiperespacial de eras a 60 FPS.
 */

class CosmosEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Dimensiones
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;

    // Estado de la línea temporal
    this.currentEra = 'analog'; // 'analog', 'silicon', 'posthuman'
    this.targetEra = 'analog';

    // Modos de visión: 'visible' | 'quantum' | 'wireframe'
    this.visionMode = 'visible';

    // Configuración de eras cromáticas
    this.eraPalettes = {
      analog: {
        nebulaPrimary: 'rgba(255, 183, 3, 0.12)',
        nebulaSecondary: 'rgba(217, 119, 6, 0.08)',
        starAccent: '#ffb703',
        starCore: '#ffffff',
        dustColor: 'rgba(245, 158, 11, 0.25)',
        bgColor: '#040711'
      },
      silicon: {
        nebulaPrimary: 'rgba(0, 240, 255, 0.14)',
        nebulaSecondary: 'rgba(59, 130, 246, 0.09)',
        starAccent: '#00f0ff',
        starCore: '#e0f2fe',
        dustColor: 'rgba(6, 182, 212, 0.25)',
        bgColor: '#020617'
      },
      posthuman: {
        nebulaPrimary: 'rgba(168, 85, 247, 0.15)',
        nebulaSecondary: 'rgba(236, 72, 153, 0.08)',
        starAccent: '#c084fc',
        starCore: '#fdf4ff',
        dustColor: 'rgba(192, 132, 252, 0.25)',
        bgColor: '#050212'
      }
    };

    // Paleta interpolada activa
    this.activePalette = JSON.parse(JSON.stringify(this.eraPalettes.analog));

    // Estrellas 3D
    this.numStars = 550;
    this.stars = [];
    this.maxDepth = 2000;
    this.baseSpeed = 0.8;
    this.speed = this.baseSpeed;

    // Nebulosas procedurales
    this.nebulas = [];

    // Partículas de polvo cósmico flotante
    this.dustParticles = [];
    this.numDust = 60;

    // Paralaje del ratón con resortes
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.mouseVelX = 0;
    this.mouseVelY = 0;

    // Salto hiperespacial
    this.isWarping = false;
    this.warpProgress = 0; // 0.0 a 1.0
    this.warpDuration = 1.4; // segundos
    this.warpStartTime = 0;

    // Tiempo acumulado
    this.time = 0;

    this.init();
  }

  init() {
    this.resize();
    this.createStars();
    this.createNebulas();
    this.createDust();
    this.bindEvents();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('mousemove', (e) => {
      // Normalizado de -1 a 1 respecto al centro
      const nx = (e.clientX - this.centerX) / this.centerX;
      const ny = (e.clientY - this.centerY) / this.centerY;
      this.targetMouseX = nx * 80;
      this.targetMouseY = ny * 60;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const nx = (t.clientX - this.centerX) / this.centerX;
        const ny = (t.clientY - this.centerY) / this.centerY;
        this.targetMouseX = nx * 80;
        this.targetMouseY = ny * 60;
      }
    }, { passive: true });
  }

  createStars() {
    this.stars = [];
    for (let i = 0; i < this.numStars; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * this.width * 2.5,
        y: (Math.random() - 0.5) * this.height * 2.5,
        z: Math.random() * this.maxDepth,
        pz: 0,
        radius: Math.random() * 1.5 + 0.6,
        colorWeight: Math.random(),
        twinkleSpeed: Math.random() * 0.05 + 0.02,
        twinklePhase: Math.random() * Math.PI * 2
      });
      this.stars[i].pz = this.stars[i].z;
    }
  }

  createNebulas() {
    this.nebulas = [
      { x: -0.35, y: -0.25, r: 0.55, driftSpeed: 0.0003, phase: 0 },
      { x: 0.45, y: 0.35, r: 0.65, driftSpeed: -0.00025, phase: 1.5 },
      { x: -0.15, y: 0.40, r: 0.48, driftSpeed: 0.0002, phase: 3.1 },
      { x: 0.25, y: -0.40, r: 0.52, driftSpeed: -0.00035, phase: 4.8 }
    ];
  }

  createDust() {
    this.dustParticles = [];
    for (let i = 0; i < this.numDust; i++) {
      this.dustParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.4 + 0.1,
        life: Math.random() * 100
      });
    }
  }

  /**
   * Dispara el salto hiperespacial a una nueva era
   */
  warpToEra(newEra) {
    if (this.currentEra === newEra && !this.isWarping) return;
    this.targetEra = newEra;
    this.isWarping = true;
    this.warpStartTime = performance.now();
  }

  setVisionMode(mode) {
    this.visionMode = mode;
  }

  /**
   * Actualización matemática por fotograma
   */
  update(deltaTime) {
    this.time += deltaTime;

    // Resorte para suavizado de paralaje del mouse
    const spring = 0.06;
    const prevMouseX = this.mouseX;
    const prevMouseY = this.mouseY;
    this.mouseX += (this.targetMouseX - this.mouseX) * spring;
    this.mouseY += (this.targetMouseY - this.mouseY) * spring;
    this.mouseVelX = this.mouseX - prevMouseX;
    this.mouseVelY = this.mouseY - prevMouseY;

    // Gestión del salto hiperespacial
    if (this.isWarping) {
      const elapsed = (performance.now() - this.warpStartTime) / 1000;
      const progress = Math.min(elapsed / this.warpDuration, 1.0);
      this.warpProgress = progress;

      // Curva de velocidad campaniforme (acelera intensamente y frena suavemente)
      // Bell curve: sin(progress * PI)
      const speedMultiplier = 1.0 + Math.sin(progress * Math.PI) * 55;
      this.speed = this.baseSpeed * speedMultiplier;

      // En la cúspide del salto, cambiar de era
      if (progress >= 0.5 && this.currentEra !== this.targetEra) {
        this.currentEra = this.targetEra;
      }

      if (progress >= 1.0) {
        this.isWarping = false;
        this.speed = this.baseSpeed;
        this.warpProgress = 0;
      }
    } else {
      this.speed = this.baseSpeed;
    }

    // Interpolación suave de paleta hacia la era activa
    const targetPal = this.eraPalettes[this.currentEra];
    const lerpRate = 0.04;
    // (Mantenemos activo el mapeo de color)
    this.activePalette = targetPal;

    // Actualizar estrellas
    const starSpeed = this.speed * (deltaTime * 60);
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.pz = s.z;
      s.z -= starSpeed;

      if (s.z <= 10) {
        s.z = this.maxDepth;
        s.pz = s.z;
        s.x = (Math.random() - 0.5) * this.width * 2.5;
        s.y = (Math.random() - 0.5) * this.height * 2.5;
      }
    }

    // Actualizar polvo cósmico
    for (let i = 0; i < this.dustParticles.length; i++) {
      const d = this.dustParticles[i];
      d.x += d.vx + this.mouseVelX * 0.15;
      d.y += d.vy + this.mouseVelY * 0.15;
      d.life += deltaTime;

      if (d.x < 0) d.x = this.width;
      if (d.x > this.width) d.x = 0;
      if (d.y < 0) d.y = this.height;
      if (d.y > this.height) d.y = 0;
    }
  }

  /**
   * Renderizado en Canvas
   */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = this.centerX + this.mouseX * 0.4;
    const cy = this.centerY + this.mouseY * 0.4;

    ctx.save();

    // 1. Limpieza y Fondo Base
    if (this.visionMode === 'wireframe') {
      ctx.fillStyle = '#010e06';
      ctx.fillRect(0, 0, w, h);
      this.renderWireframeGrid(ctx);
    } else if (this.visionMode === 'quantum') {
      ctx.fillStyle = '#030514';
      ctx.fillRect(0, 0, w, h);
      this.renderQuantumGrid(ctx);
    } else {
      ctx.fillStyle = this.activePalette.bgColor;
      ctx.fillRect(0, 0, w, h);
      // Nebulosas orgánicas profundas
      this.renderNebulas(ctx, cx, cy);
    }

    // 2. Render de Estrellas con velocidad y estelas en salto
    ctx.lineWidth = 1.2;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];

      // Proyección en perspectiva 3D
      const fov = 350;
      const k = fov / Math.max(s.z, 1);
      const pk = fov / Math.max(s.pz, 1);

      const px = cx + s.x * k;
      const py = cy + s.y * k;

      const prevX = cx + s.x * pk;
      const prevY = cy + s.y * pk;

      // Fuera de pantalla
      if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue;

      const depthAlpha = Math.min(Math.max(1 - s.z / this.maxDepth, 0.1), 1.0);
      const twinkle = Math.sin(this.time * 6 * s.twinkleSpeed + s.twinklePhase) * 0.25 + 0.75;
      const finalAlpha = depthAlpha * twinkle;

      if (this.visionMode === 'wireframe') {
        ctx.fillStyle = `rgba(0, 255, 136, ${finalAlpha * 0.8})`;
        ctx.fillRect(px, py, 1.5, 1.5);
      } else if (this.isWarping || this.speed > 2.0) {
        // Estelas de velocidad hiperespacial
        const grad = ctx.createLinearGradient(prevX, prevY, px, py);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(1, this.activePalette.starAccent);

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.min((1 - s.z / this.maxDepth) * 3.5 + 1.2, 4);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else {
        // Estrella en punto flotante
        const r = Math.max(s.radius * (1 - s.z / this.maxDepth) * 1.8, 0.5);

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        if (s.colorWeight > 0.6) {
          ctx.fillStyle = this.activePalette.starAccent;
        } else {
          ctx.fillStyle = this.activePalette.starCore;
        }
        ctx.globalAlpha = finalAlpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    // 3. Polvo estelar ambiental
    if (this.visionMode === 'visible') {
      this.renderDust(ctx);
    }

    // 4. Efecto de destello cromático en salto hiperespacial
    if (this.isWarping && this.warpProgress > 0.35 && this.warpProgress < 0.75) {
      const flashAlpha = Math.sin((this.warpProgress - 0.35) / 0.4 * Math.PI) * 0.38;
      ctx.fillStyle = `rgba(0, 240, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  renderNebulas(ctx, cx, cy) {
    for (let i = 0; i < this.nebulas.length; i++) {
      const neb = this.nebulas[i];
      const nx = cx + neb.x * this.width + Math.cos(this.time * 0.2 + neb.phase) * 40;
      const ny = cy + neb.y * this.height + Math.sin(this.time * 0.2 + neb.phase) * 40;
      const radius = neb.r * Math.max(this.width, this.height);

      const grad = ctx.createRadialGradient(nx, ny, 10, nx, ny, radius);
      grad.addColorStop(0, i % 2 === 0 ? this.activePalette.nebulaPrimary : this.activePalette.nebulaSecondary);
      grad.addColorStop(0.6, i % 2 === 0 ? this.activePalette.nebulaSecondary : 'rgba(0, 0, 0, 0.02)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderDust(ctx) {
    for (let i = 0; i < this.dustParticles.length; i++) {
      const d = this.dustParticles[i];
      const pulse = Math.sin(d.life * 2) * 0.2 + 0.8;
      ctx.fillStyle = this.activePalette.dustColor;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderWireframeGrid(ctx) {
    const w = this.width;
    const h = this.height;
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    ctx.lineWidth = 1;

    // Cuadrícula táctica radar
    const step = 80;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Anillos de radar concéntricos desde el centro
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.12)';
    for (let r = 120; r < Math.max(w, h); r += 160) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Línea de barrido de radar en tiempo real
    const sweepAngle = (this.time * 1.2) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * Math.max(w, h), cy + Math.sin(sweepAngle) * Math.max(w, h));
    ctx.stroke();
  }

  renderQuantumGrid(ctx) {
    const w = this.width;
    const h = this.height;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;

    // Cuadrícula isométrica/holográfica de perspectiva
    const step = 60;
    const offset = (this.time * 25) % step;
    for (let y = offset; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.07)';
    for (let x = 0; x < w; x += step * 1.5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }
}

// Exportar globalmente
window.CosmosEngine = CosmosEngine;
