/**
 * AETHERIS 3050 — Zero-G Studio & 3D Relic Renderer
 * Motor de Proyección 3D matricial, Físicas de Gravedad Cero,
 * Colisiones elásticas y Vista Explosionada técnica a 60 FPS.
 */

class RelicsEngine {
  constructor(canvas, soundEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.soundEngine = soundEngine;

    // Dimensiones
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;

    // Reliquia activa ('voyager' | 'quantum' | 'genesis')
    this.currentRelic = 'voyager';

    // Modos de visión ('visible' | 'quantum' | 'wireframe')
    this.visionMode = 'visible';

    // Modos de gravedad: '0g', '1g', 'hyper'
    this.gravityMode = '0g';
    this.gravityValues = {
      '0g': 0,
      '1g': 0.42,
      'hyper': 1.15
    };

    // Estado físico del objeto en la cámara de contención
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.rot = { x: 0.35, y: -0.4, z: 0 };
    this.vrot = { x: 0.005, y: 0.009, z: 0.003 };

    // Límites de la cámara de contención 3D
    this.bounds = {
      minX: -280, maxX: 280,
      minY: -220, maxY: 200,
      minZ: -200, maxZ: 250
    };

    // Parámetros de interacción con el ratón
    this.isDragging = false;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartPos = { x: 0, y: 0 };
    this.mouseHistory = [];
    this.isRotatingView = false;
    this.rotStartMouse = { x: 0, y: 0 };
    this.rotStartAngles = { x: 0, y: 0, z: 0 };

    // Vista explosionada (Exploded View)
    this.isExploded = false;
    this.explodeProgress = 0; // 0.0 a 1.0
    this.explodeTarget = 0;

    // Cámara y proyección
    this.fov = 480;
    this.cameraDistance = 550;
    this.scale = 1.0;

    // Tiempo acumulado
    this.time = 0;

    this.init();
  }

  init() {
    this.resize();
    this.bindEvents();
    this.resetRelicPosition();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.cx = this.width / 2;
    this.cy = this.height / 2;

    // Adaptar los límites de la cámara según el tamaño de la ventana
    const halfW = Math.min(this.width * 0.38, 360);
    const halfH = Math.min(this.height * 0.32, 260);
    this.bounds.minX = -halfW;
    this.bounds.maxX = halfW;
    this.bounds.minY = -halfH;
    this.bounds.maxY = halfH;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Eventos de ratón / táctiles para arrastre y física de lanzamiento
    const canvas = this.canvas;

    const onPointerDown = (clientX, clientY, button = 0) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      // Calcular proximidad al centro del objeto 2D
      const screenPos = this.project3D(this.pos.x, this.pos.y, this.pos.z);
      const dist = Math.hypot(mouseX - screenPos.x, mouseY - screenPos.y);

      if (dist < 180 && button === 0) {
        // Iniciar arrastre del objeto
        this.isDragging = true;
        this.dragStartMouse = { x: mouseX, y: mouseY };
        this.dragStartPos = { x: this.pos.x, y: this.pos.y };
        this.mouseHistory = [{ x: mouseX, y: mouseY, t: performance.now() }];
        this.vel = { x: 0, y: 0, z: 0 };
        canvas.style.cursor = 'grabbing';
      } else {
        // Iniciar rotación de perspectiva 3D
        this.isRotatingView = true;
        this.rotStartMouse = { x: mouseX, y: mouseY };
        this.rotStartAngles = { ...this.rot };
        canvas.style.cursor = 'crosshair';
      }
    };

    const onPointerMove = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      if (this.isDragging) {
        const dx = mouseX - this.dragStartMouse.x;
        const dy = mouseY - this.dragStartMouse.y;

        // Sensibilidad ajustada a la profundidad Z
        const k = (this.fov + this.pos.z + this.cameraDistance) / this.fov;
        this.pos.x = this.dragStartPos.x + dx * k;
        this.pos.y = this.dragStartPos.y + dy * k;

        // Historial para calcular inercia y velocidad de lanzamiento
        const now = performance.now();
        this.mouseHistory.push({ x: mouseX, y: mouseY, t: now });
        if (this.mouseHistory.length > 5) this.mouseHistory.shift();

        // Leve torsión inducida por el arrastre
        this.rot.y += dx * 0.002;
        this.rot.x += dy * 0.002;
      } else if (this.isRotatingView) {
        const dx = mouseX - this.rotStartMouse.x;
        const dy = mouseY - this.rotStartMouse.y;
        this.rot.y = this.rotStartAngles.y + dx * 0.01;
        this.rot.x = this.rotStartAngles.x + dy * 0.01;
      } else {
        // Cursor hover
        const screenPos = this.project3D(this.pos.x, this.pos.y, this.pos.z);
        const dist = Math.hypot(mouseX - screenPos.x, mouseY - screenPos.y);
        canvas.style.cursor = dist < 180 ? 'grab' : 'default';
      }
    };

    const onPointerUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        canvas.style.cursor = 'grab';

        // Calcular velocidad final a partir del historial del ratón (FLING)
        if (this.mouseHistory.length >= 2) {
          const first = this.mouseHistory[0];
          const last = this.mouseHistory[this.mouseHistory.length - 1];
          const dt = Math.max((last.t - first.t) / 1000, 0.016);
          const k = (this.fov + this.pos.z + this.cameraDistance) / this.fov;

          const vx = ((last.x - first.x) / dt) * 0.018 * k;
          const vy = ((last.y - first.y) / dt) * 0.018 * k;

          this.vel.x = Math.min(Math.max(vx, -28), 28);
          this.vel.y = Math.min(Math.max(vy, -28), 28);

          // Impartir rotación angular con el lanzamiento
          this.vrot.x = this.vel.y * 0.002;
          this.vrot.y = this.vel.x * 0.002;
        }
      }
      this.isRotatingView = false;
    };

    canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY, e.button));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    // Soporte táctil móvil
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        onPointerDown(t.clientX, t.clientY, 0);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        onPointerMove(t.clientX, t.clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', onPointerUp);

    // Evitar menú contextual al rotar con clic derecho
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setRelic(relicId) {
    if (this.currentRelic === relicId) return;
    this.currentRelic = relicId;
    this.resetRelicPosition();
    if (this.soundEngine) {
      this.soundEngine.playScanSweep();
    }
  }

  setVisionMode(mode) {
    this.visionMode = mode;
  }

  setGravity(mode) {
    this.gravityMode = mode;
    if (this.soundEngine) {
      this.soundEngine.playClick();
    }
  }

  toggleExploded() {
    this.isExploded = !this.isExploded;
    this.explodeTarget = this.isExploded ? 1.0 : 0.0;
    if (this.soundEngine) {
      this.soundEngine.playScanSweep();
    }
    return this.isExploded;
  }

  resetRelicPosition() {
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.rot = { x: 0.35, y: -0.4, z: 0 };
    this.vrot = { x: 0.004, y: 0.007, z: 0.002 };
  }

  /**
   * Proyección matemática 3D a pantalla 2D
   */
  project3D(x, y, z) {
    const totalZ = z + this.cameraDistance;
    const scale = this.fov / Math.max(totalZ, 50);
    return {
      x: this.cx + x * scale,
      y: this.cy + y * scale,
      scale: scale
    };
  }

  /**
   * Rotación 3D matricial de un vector (X, Y, Z) aplicando los ángulos Euler de la reliquia
   */
  rotatePoint(p, rx, ry, rz) {
    // Rotación Yaw (Y)
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x1 = p.x * cosY + p.z * sinY;
    const y1 = p.y;
    const z1 = -p.x * sinY + p.z * cosY;

    // Rotación Pitch (X)
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    // Rotación Roll (Z)
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const x3 = x2 * cosZ - y2 * sinZ;
    const y3 = x2 * sinZ + y2 * cosZ;
    const z3 = z2;

    return { x: x3, y: y3, z: z3 };
  }

  /**
   * Actualización física en gravedad cero / 1G / Hiper-Masa
   */
  update(deltaTime) {
    this.time += deltaTime;

    // Interpolación elástica para la vista explosionada
    const springK = 0.12;
    this.explodeProgress += (this.explodeTarget - this.explodeProgress) * springK;

    // Físicas solo cuando el usuario no está arrastrando directamente
    if (!this.isDragging) {
      // 1. Gravedad
      const g = this.gravityValues[this.gravityMode] || 0;
      this.vel.y += g * (deltaTime * 60);

      // 2. Fricción / Amortiguación
      let friction = 0.993;
      if (this.gravityMode === '1g') friction = 0.985;
      if (this.gravityMode === 'hyper') friction = 0.96;

      this.vel.x *= friction;
      this.vel.y *= friction;
      this.vel.z *= friction;

      // 3. Integración de posición
      this.pos.x += this.vel.x * (deltaTime * 60);
      this.pos.y += this.vel.y * (deltaTime * 60);
      this.pos.z += this.vel.z * (deltaTime * 60);

      // 4. Oscilación armónica de levitación en gravedad 0G
      if (this.gravityMode === '0g' && Math.hypot(this.vel.x, this.vel.y) < 1.0) {
        this.pos.y += Math.sin(this.time * 1.5) * 0.35;
        this.pos.x += Math.cos(this.time * 1.1) * 0.2;
      }

      // 5. Colisiones elásticas contra los límites de la cámara de contención
      const restitution = this.gravityMode === 'hyper' ? 0.45 : 0.72;
      let collided = false;
      let impactSpeed = 0;

      // Pared izquierda / derecha
      if (this.pos.x < this.bounds.minX) {
        this.pos.x = this.bounds.minX;
        impactSpeed = Math.abs(this.vel.x);
        this.vel.x = -this.vel.x * restitution;
        this.vrot.y += this.vel.y * 0.005;
        collided = true;
      } else if (this.pos.x > this.bounds.maxX) {
        this.pos.x = this.bounds.maxX;
        impactSpeed = Math.abs(this.vel.x);
        this.vel.x = -this.vel.x * restitution;
        this.vrot.y -= this.vel.y * 0.005;
        collided = true;
      }

      // Techo / Suelo
      if (this.pos.y < this.bounds.minY) {
        this.pos.y = this.bounds.minY;
        impactSpeed = Math.max(impactSpeed, Math.abs(this.vel.y));
        this.vel.y = -this.vel.y * restitution;
        this.vrot.x += this.vel.x * 0.005;
        collided = true;
      } else if (this.pos.y > this.bounds.maxY) {
        this.pos.y = this.bounds.maxY;
        impactSpeed = Math.max(impactSpeed, Math.abs(this.vel.y));
        this.vel.y = -this.vel.y * restitution;
        this.vrot.x -= this.vel.x * 0.005;
        collided = true;
      }

      // Profundidad Z
      if (this.pos.z < this.bounds.minZ) {
        this.pos.z = this.bounds.minZ;
        impactSpeed = Math.max(impactSpeed, Math.abs(this.vel.z));
        this.vel.z = -this.vel.z * restitution;
        collided = true;
      } else if (this.pos.z > this.bounds.maxZ) {
        this.pos.z = this.bounds.maxZ;
        impactSpeed = Math.max(impactSpeed, Math.abs(this.vel.z));
        this.vel.z = -this.vel.z * restitution;
        collided = true;
      }

      // Sonido procedimental de choque si la velocidad es perceptible
      if (collided && impactSpeed > 1.2 && this.soundEngine) {
        const normVel = Math.min(impactSpeed / 18, 1.0);
        this.soundEngine.playCollision(normVel, this.currentRelic);
      }

      // 6. Rotación libre continua
      this.rot.x += this.vrot.x * (deltaTime * 60);
      this.rot.y += this.vrot.y * (deltaTime * 60);
      this.rot.z += this.vrot.z * (deltaTime * 60);

      // Amortiguar rotaciones excesivas hacia una velocidad orbital suave
      this.vrot.x += (0.003 - this.vrot.x) * 0.02;
      this.vrot.y += (0.006 - this.vrot.y) * 0.02;
      this.vrot.z += (0.002 - this.vrot.z) * 0.02;
    }
  }

  /**
   * Renderizado en Canvas del espacio de contención y la reliquia seleccionada
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    // 1. Dibujar la Cámara de Contención Antigravedad (HUD Reticles y barreras)
    this.renderChamberBounds(ctx);

    // 2. Renderizar la reliquia 3D activa
    if (this.currentRelic === 'voyager') {
      this.renderVoyagerRecord(ctx);
    } else if (this.currentRelic === 'quantum') {
      this.renderQuantumCore(ctx);
    } else {
      this.renderGenesisCrystal(ctx);
    }

    // 3. Renderizar las etiquetas técnicas de la Vista Explosionada si está activa
    if (this.explodeProgress > 0.05) {
      this.renderExplodedLabels(ctx);
    }

    ctx.restore();
  }

  /**
   * Dibuja los límites geométricos y retículas de la cámara de gravedad cero
   */
  renderChamberBounds(ctx) {
    const minX = this.bounds.minX;
    const maxX = this.bounds.maxX;
    const minY = this.bounds.minY;
    const maxY = this.bounds.maxY;
    const minZ = this.bounds.minZ;
    const maxZ = this.bounds.maxZ;

    // Color según modo de visión
    let strokeColor = 'rgba(0, 240, 255, 0.15)';
    let cornerColor = 'rgba(0, 240, 255, 0.4)';
    if (this.visionMode === 'wireframe') {
      strokeColor = 'rgba(0, 255, 136, 0.16)';
      cornerColor = 'rgba(0, 255, 136, 0.55)';
    } else if (this.visionMode === 'quantum') {
      strokeColor = 'rgba(168, 85, 247, 0.18)';
      cornerColor = 'rgba(0, 240, 255, 0.6)';
    }

    // Proyectar las 8 esquinas de la caja de contención
    const corners = [
      { x: minX, y: minY, z: minZ },
      { x: maxX, y: minY, z: minZ },
      { x: maxX, y: maxY, z: minZ },
      { x: minX, y: maxY, z: minZ },
      { x: minX, y: minY, z: maxZ },
      { x: maxX, y: minY, z: maxZ },
      { x: maxX, y: maxY, z: maxZ },
      { x: minX, y: maxY, z: maxZ }
    ].map(p => this.project3D(p.x, p.y, p.z));

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;

    // Aristas de la caja
    const edges = [
      [0,1], [1,2], [2,3], [3,0], // Fondo
      [4,5], [5,6], [6,7], [7,4], // Frente
      [0,4], [1,5], [2,6], [3,7]  // Conectores
    ];

    edges.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[j].x, corners[j].y);
      ctx.stroke();
    });

    // Marcadores de esquina holográficos reforzados (brackets sci-fi)
    ctx.strokeStyle = cornerColor;
    ctx.lineWidth = 2;
    [4, 5, 6, 7].forEach(idx => {
      const p = corners[idx];
      const size = 12;
      ctx.beginPath();
      ctx.moveTo(p.x - size, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - size);
      ctx.stroke();
    });

    // Retícula en el suelo de la cámara (para notar la gravedad)
    if (this.gravityMode !== '0g') {
      ctx.strokeStyle = this.gravityMode === 'hyper' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 1;
      const floorY = maxY;
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const tz = minZ + ((maxZ - minZ) / steps) * i;
        const p1 = this.project3D(minX, floorY, tz);
        const p2 = this.project3D(maxX, floorY, tz);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // ==========================================================
  // RELIQUIA 1: EL DISCO DE ORO DE LAS VOYAGER (1977)
  // ==========================================================
  renderVoyagerRecord(ctx) {
    const rx = this.rot.x;
    const ry = this.rot.y;
    const rz = this.rot.z;
    const ox = this.pos.x;
    const oy = this.pos.y;
    const oz = this.pos.z;

    const explode = this.explodeProgress;
    const radius = 135;

    // Capas explosionadas a lo largo del eje Z local
    // Capa 0: Carcasa frontal de aluminio con pulsadores
    // Capa 1: Disco de oro con ranuras fonográficas
    // Capa 2: Placa de respaldo de uranio 238
    const layers = [
      { name: 'COVER', zOffset: 65 * explode, color: '#f59e0b', wire: '#fbbf24' },
      { name: 'RECORD', zOffset: 0, color: '#ffd700', wire: '#fef08a' },
      { name: 'CALIBRATION', zOffset: -65 * explode, color: '#b45309', wire: '#d97706' }
    ];

    // Ordenar capas por profundidad proyectada
    layers.forEach(layer => {
      const centerP = this.rotatePoint({ x: 0, y: 0, z: layer.zOffset }, rx, ry, rz);
      layer.depth = centerP.z + oz;
      layer.centerWorld = { x: ox + centerP.x, y: oy + centerP.y, z: oz + centerP.z };
    });

    layers.sort((a, b) => b.depth - a.depth);

    layers.forEach(layer => {
      const c = layer.centerWorld;

      // Normal de la cara para iluminación y sombreado
      const normal = this.rotatePoint({ x: 0, y: 0, z: 1 }, rx, ry, rz);
      const isFacingCamera = normal.z < 0; // en sistema de coordenadas visual

      // Dibujar anillos del disco
      const ringSteps = 36;
      const numRings = layer.name === 'RECORD' ? 7 : 3;

      for (let rIdx = 0; rIdx < numRings; rIdx++) {
        const ringR = radius * (1 - rIdx * 0.12);
        const pts = [];

        for (let i = 0; i <= ringSteps; i++) {
          const theta = (i / ringSteps) * Math.PI * 2;
          const localP = {
            x: Math.cos(theta) * ringR,
            y: Math.sin(theta) * ringR,
            z: layer.zOffset
          };
          const rotP = this.rotatePoint(localP, rx, ry, rz);
          pts.push(this.project3D(ox + rotP.x, oy + rotP.y, oz + rotP.z));
        }

        ctx.beginPath();
        pts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });

        if (this.visionMode === 'wireframe') {
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
          ctx.lineWidth = 1;
        } else if (this.visionMode === 'quantum') {
          ctx.strokeStyle = rIdx === 0 ? '#00f0ff' : 'rgba(168, 85, 247, 0.4)';
          ctx.lineWidth = rIdx === 0 ? 2 : 1;
        } else {
          // Modo óptico visible: metal dorado
          ctx.strokeStyle = rIdx === 0 ? '#fbbf24' : 'rgba(217, 119, 6, 0.45)';
          ctx.lineWidth = rIdx === 0 ? 2.5 : 1;
          if (rIdx === 0) {
            ctx.fillStyle = layer.name === 'RECORD' ? 'rgba(20, 16, 8, 0.82)' : 'rgba(30, 24, 10, 0.65)';
            ctx.fill();
          }
        }
        ctx.stroke();
      }

      // Diagramas vectoriales grabados (Mapa de Púlsares y Transición de Hidrógeno)
      if (layer.name === 'COVER' || layer.name === 'RECORD') {
        this.renderVoyagerEngravings(ctx, ox, oy, oz, rx, ry, rz, layer.zOffset);
      }
    });

    // Si está en vista explosionada, trazar líneas guía de eje entre capas
    if (explode > 0.05) {
      this.renderExplodeAxis(ctx, ox, oy, oz, rx, ry, rz, -75 * explode, 75 * explode);
    }
  }

  /**
   * Dibuja los diagramas icónicos del disco de oro proyectados en 3D
   */
  renderVoyagerEngravings(ctx, ox, oy, oz, rx, ry, rz, zOffset) {
    const strokeColor = this.visionMode === 'wireframe' ? '#00ff88' : '#fbbf24';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;

    // 1. Mapa de los 14 Púlsares (líneas radiales con marcas de pulso)
    const pulsars = [
      { angle: 0.1, len: 65, ticks: 4 },
      { angle: 0.55, len: 80, ticks: 6 },
      { angle: 1.1, len: 45, ticks: 3 },
      { angle: 1.6, len: 75, ticks: 5 },
      { angle: 2.05, len: 90, ticks: 8 },
      { angle: 2.6, len: 55, ticks: 4 },
      { angle: 3.14, len: 100, ticks: 9 }, // Dirección hacia el centro galáctico
      { angle: 3.7, len: 70, ticks: 5 },
      { angle: 4.2, len: 85, ticks: 6 },
      { angle: 4.75, len: 60, ticks: 4 },
      { angle: 5.2, len: 78, ticks: 7 },
      { angle: 5.65, len: 50, ticks: 3 },
      { angle: 6.0, len: 68, ticks: 5 },
      { angle: 0.85, len: 92, ticks: 7 }
    ];

    pulsars.forEach(p => {
      const p1 = this.rotatePoint({ x: 0, y: 0, z: zOffset }, rx, ry, rz);
      const px = Math.cos(p.angle) * p.len;
      const py = Math.sin(p.angle) * p.len;
      const p2 = this.rotatePoint({ x: px, y: py, z: zOffset }, rx, ry, rz);

      const sp1 = this.project3D(ox + p1.x, oy + p1.y, oz + p1.z);
      const sp2 = this.project3D(ox + p2.x, oy + p2.y, oz + p2.z);

      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();

      // Muescas binarias en el final del rayo
      const tickP = this.rotatePoint({
        x: px + Math.cos(p.angle + Math.PI / 2) * 4,
        y: py + Math.sin(p.angle + Math.PI / 2) * 4,
        z: zOffset
      }, rx, ry, rz);
      const sTick = this.project3D(ox + tickP.x, oy + tickP.y, oz + tickP.z);

      ctx.beginPath();
      ctx.moveTo(sp2.x, sp2.y);
      ctx.lineTo(sTick.x, sTick.y);
      ctx.stroke();
    });

    // 2. Símbolo de la transición hiperfina del átomo de hidrógeno (esquina superior)
    const hCenter = { x: -55, y: -55 };
    const h1 = this.rotatePoint({ x: hCenter.x - 14, y: hCenter.y, z: zOffset }, rx, ry, rz);
    const h2 = this.rotatePoint({ x: hCenter.x + 14, y: hCenter.y, z: zOffset }, rx, ry, rz);

    const sh1 = this.project3D(ox + h1.x, oy + h1.y, oz + h1.z);
    const sh2 = this.project3D(ox + h2.x, oy + h2.y, oz + h2.z);

    ctx.beginPath();
    ctx.arc(sh1.x, sh1.y, 6 * sh1.scale, 0, Math.PI * 2);
    ctx.arc(sh2.x, sh2.y, 6 * sh2.scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sh1.x, sh1.y);
    ctx.lineTo(sh2.x, sh2.y);
    ctx.stroke();

    // Orificio central del disco
    const centerProj = this.project3D(ox, oy, oz);
    ctx.beginPath();
    ctx.arc(centerProj.x, centerProj.y, 10 * centerProj.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ==========================================================
  // RELIQUIA 2: EL NÚCLEO CUÁNTICO TERRA-1 (2088)
  // ==========================================================
  renderQuantumCore(ctx) {
    const rx = this.rot.x;
    const ry = this.rot.y;
    const rz = this.rot.z;
    const ox = this.pos.x;
    const oy = this.pos.y;
    const oz = this.pos.z;

    const explode = this.explodeProgress;

    // 1. Cubo Hiperdimensional Exterior (Tesseract / Jaula Cuántica)
    const cageScale = 110 * (1 + explode * 0.95);
    const cubeVertices = [
      { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
      { x: 1, y: 1, z: -1 },   { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },  { x: 1, y: -1, z: 1 },
      { x: 1, y: 1, z: 1 },    { x: -1, y: 1, z: 1 }
    ].map(v => {
      const rot = this.rotatePoint({
        x: v.x * cageScale,
        y: v.y * cageScale,
        z: v.z * cageScale
      }, rx, ry, rz);
      return this.project3D(ox + rot.x, oy + rot.y, oz + rot.z);
    });

    const cubeEdges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7]
    ];

    let cageColor = this.visionMode === 'wireframe' ? '#00ff88' : '#00f0ff';
    ctx.strokeStyle = cageColor;
    ctx.lineWidth = 1.6;

    cubeEdges.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(cubeVertices[i].x, cubeVertices[i].y);
      ctx.lineTo(cubeVertices[j].x, cubeVertices[j].y);
      ctx.stroke();
    });

    // Nodos en los vértices del cubo
    cubeVertices.forEach(v => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 4 * v.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Anillos cardán concéntricos giratorios (Gimbal Rings)
    const ringRadius = 75 * (1 + explode * 0.4);
    const ringColors = ['#00f0ff', '#a855f7', '#38bdf8'];

    [0, 1, 2].forEach(axis => {
      const ringSteps = 32;
      const pts = [];
      const ringAngle = this.time * (1.2 + axis * 0.4);

      for (let i = 0; i <= ringSteps; i++) {
        const theta = (i / ringSteps) * Math.PI * 2;
        let p = { x: 0, y: 0, z: 0 };

        if (axis === 0) {
          p = { x: 0, y: Math.cos(theta) * ringRadius, z: Math.sin(theta) * ringRadius };
        } else if (axis === 1) {
          p = { x: Math.cos(theta) * ringRadius, y: 0, z: Math.sin(theta) * ringRadius };
        } else {
          p = { x: Math.cos(theta) * ringRadius, y: Math.sin(theta) * ringRadius, z: 0 };
        }

        // Desplazamiento por explosión en capas
        if (explode > 0) {
          if (axis === 0) p.x += 45 * explode;
          if (axis === 1) p.y += 45 * explode;
          if (axis === 2) p.z += 45 * explode;
        }

        const rot = this.rotatePoint(p, rx + ringAngle * 0.3, ry + ringAngle * 0.2, rz);
        pts.push(this.project3D(ox + rot.x, oy + rot.y, oz + rot.z));
      }

      ctx.strokeStyle = this.visionMode === 'wireframe' ? '#00ff88' : ringColors[axis];
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    });

    // 3. Singularidad Cuántica Central (Cubo palpitante de energía)
    const corePulse = Math.sin(this.time * 6) * 0.12 + 0.88;
    const coreSize = 35 * corePulse;
    const innerVertices = [
      { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
      { x: 1, y: 1, z: -1 },   { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },  { x: 1, y: -1, z: 1 },
      { x: 1, y: 1, z: 1 },    { x: -1, y: 1, z: 1 }
    ].map(v => {
      const rot = this.rotatePoint({
        x: v.x * coreSize,
        y: v.y * coreSize,
        z: v.z * coreSize
      }, -rx * 1.5, -ry * 1.5, rz);
      return this.project3D(ox + rot.x, oy + rot.y, oz + rot.z);
    });

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    cubeEdges.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(innerVertices[i].x, innerVertices[i].y);
      ctx.lineTo(innerVertices[j].x, innerVertices[j].y);
      ctx.stroke();
    });

    // Relleno de resplandor cuántico central
    const center = this.project3D(ox, oy, oz);
    const grad = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, 45 * center.scale);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.6)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 45 * center.scale, 0, Math.PI * 2);
    ctx.fill();

    // Si está en vista explosionada, conectar rayos de energía
    if (explode > 0.05) {
      this.renderExplodeAxis(ctx, ox, oy, oz, rx, ry, rz, -cageScale, cageScale);
    }
  }

  // ==========================================================
  // RELIQUIA 3: CRISTAL BIO-SINTÉTICO GÉNESIS (2540)
  // ==========================================================
  renderGenesisCrystal(ctx) {
    const rx = this.rot.x;
    const ry = this.rot.y;
    const rz = this.rot.z;
    const ox = this.pos.x;
    const oy = this.pos.y;
    const oz = this.pos.z;

    const explode = this.explodeProgress;

    // 1. Geometría Polihédrica del Cristal (Bipirámide Hexagonal Facetada)
    const crystalH = 140;
    const crystalR = 75;

    // Vértices del prisma cristalino
    const topV = { x: 0, y: -crystalH, z: 0 };
    const bottomV = { x: 0, y: crystalH, z: 0 };
    const middleV = [];
    const numFacets = 6;

    for (let i = 0; i < numFacets; i++) {
      const theta = (i / numFacets) * Math.PI * 2;
      middleV.push({
        x: Math.cos(theta) * crystalR,
        y: (i % 2 === 0 ? -1 : 1) * 20,
        z: Math.sin(theta) * crystalR
      });
    }

    // Caras facetadas
    const faces = [];
    for (let i = 0; i < numFacets; i++) {
      const next = (i + 1) % numFacets;
      // Cara piramidal superior
      faces.push({
        pts: [topV, middleV[i], middleV[next]],
        type: 'top',
        id: i
      });
      // Cara piramidal inferior
      faces.push({
        pts: [bottomV, middleV[next], middleV[i]],
        type: 'bottom',
        id: i + numFacets
      });
    }

    // Calcular normales y proyección con explosión a lo largo de las normales
    const projectedFaces = faces.map(face => {
      // Normal aproximada del triángulo
      const v0 = face.pts[0];
      const v1 = face.pts[1];
      const v2 = face.pts[2];

      const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
      const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;

      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      const normal = { x: nx / len, y: ny / len, z: nz / len };

      // Desplazamiento por vista explosionada a lo largo de la normal
      const explodeOffset = 55 * explode;

      const rotatedPts = face.pts.map(p => {
        const offsetP = {
          x: p.x + normal.x * explodeOffset,
          y: p.y + normal.y * explodeOffset,
          z: p.z + normal.z * explodeOffset
        };
        const rot = this.rotatePoint(offsetP, rx, ry, rz);
        return {
          world: { x: ox + rot.x, y: oy + rot.y, z: oz + rot.z },
          proj: this.project3D(ox + rot.x, oy + rot.y, oz + rot.z),
          z: rot.z + oz
        };
      });

      const rotNormal = this.rotatePoint(normal, rx, ry, rz);
      const avgZ = (rotatedPts[0].z + rotatedPts[1].z + rotatedPts[2].z) / 3;

      return {
        pts: rotatedPts,
        normal: rotNormal,
        avgZ: avgZ,
        id: face.id
      };
    });

    // Ordenar caras de atrás hacia adelante (Algoritmo del pintor)
    projectedFaces.sort((a, b) => b.avgZ - a.avgZ);

    // Dibujar caras del cristal
    projectedFaces.forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f.pts[0].proj.x, f.pts[0].proj.y);
      ctx.lineTo(f.pts[1].proj.x, f.pts[1].proj.y);
      ctx.lineTo(f.pts[2].proj.x, f.pts[2].proj.y);
      ctx.closePath();

      // Iluminación difusa con luz virtual frontal superior
      const lightDot = Math.max(f.normal.x * 0.4 - f.normal.y * 0.7 + f.normal.z * 0.6, 0.1);

      if (this.visionMode === 'wireframe') {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.fillStyle = 'rgba(0, 40, 20, 0.2)';
        ctx.fill();
        ctx.stroke();
      } else if (this.visionMode === 'quantum') {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.4;
        ctx.fillStyle = `rgba(168, 85, 247, ${0.15 + lightDot * 0.25})`;
        ctx.fill();
        ctx.stroke();
      } else {
        // Óptico: Cuarzo amatista y refracciones internas
        const alpha = 0.25 + lightDot * 0.45;
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(236, 72, 153, ${0.4 + lightDot * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // 2. Núcleo Bio-Sintético: Doble Hélice de ADN / Neuronas 3D interna
    this.renderInternalHelix(ctx, ox, oy, oz, rx, ry, rz, explode);
  }

  /**
   * Renderiza la doble hélice bioluminiscente suspendida en el cristal
   */
  renderInternalHelix(ctx, ox, oy, oz, rx, ry, rz, explode) {
    const helixH = 110;
    const helixR = 24 * (1 + explode * 0.8);
    const numPairs = 18;
    const turns = 2.5;

    const strand1 = [];
    const strand2 = [];

    for (let i = 0; i < numPairs; i++) {
      const frac = i / (numPairs - 1);
      const y = (frac - 0.5) * helixH * 2;
      const angle = frac * Math.PI * 2 * turns + this.time * 2.0;

      const p1 = { x: Math.cos(angle) * helixR, y: y, z: Math.sin(angle) * helixR };
      const p2 = { x: Math.cos(angle + Math.PI) * helixR, y: y, z: Math.sin(angle + Math.PI) * helixR };

      const r1 = this.rotatePoint(p1, rx, ry, rz);
      const r2 = this.rotatePoint(p2, rx, ry, rz);

      const sp1 = this.project3D(ox + r1.x, oy + r1.y, oz + r1.z);
      const sp2 = this.project3D(ox + r2.x, oy + r2.y, oz + r2.z);

      strand1.push(sp1);
      strand2.push(sp2);

      // Peldaño / puente de pares de bases nitrogenadas sintéticas
      ctx.strokeStyle = this.visionMode === 'wireframe' ? '#00ff88' : '#10b981';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();

      // Nodos moleculares brillantes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sp1.x, sp1.y, 2.5 * sp1.scale, 0, Math.PI * 2);
      ctx.arc(sp2.x, sp2.y, 2.5 * sp2.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hebras continuas de la hélice
    ctx.strokeStyle = this.visionMode === 'wireframe' ? '#00ff88' : '#34d399';
    ctx.lineWidth = 1.8;

    [strand1, strand2].forEach(strand => {
      ctx.beginPath();
      strand.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }

  /**
   * Eje de explosión y acotaciones técnicas
   */
  renderExplodeAxis(ctx, ox, oy, oz, rx, ry, rz, minZ, maxZ) {
    const p1 = this.rotatePoint({ x: 0, y: 0, z: minZ }, rx, ry, rz);
    const p2 = this.rotatePoint({ x: 0, y: 0, z: maxZ }, rx, ry, rz);

    const sp1 = this.project3D(ox + p1.x, oy + p1.y, oz + p1.z);
    const sp2 = this.project3D(ox + p2.x, oy + p2.y, oz + p2.z);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sp1.x, sp1.y);
    ctx.lineTo(sp2.x, sp2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Etiquetas flotantes de diagrama técnico cuando la vista explosionada está activa
   */
  renderExplodedLabels(ctx) {
    const alpha = Math.min(this.explodeProgress * 1.5, 1.0);
    ctx.save();
    ctx.globalAlpha = alpha;

    const relicData = {
      voyager: [
        { label: 'ESCUDO DORADO DE PROTECCIÓN // AU-197', offset: { x: 90, y: -70 } },
        { label: 'MATRIZ ANALÓGICA DE AUDIO (16.66 RPM)', offset: { x: -160, y: 10 } },
        { label: 'DISCO CALIBRADOR URANIO-238 (4.468 Ga)', offset: { x: 80, y: 80 } }
      ],
      quantum: [
        { label: 'JAULA DE CONTENCIÓN TESSERACT', offset: { x: 120, y: -90 } },
        { label: 'ANILLOS CARDÁN GYRO-ESTABILIZADORES', offset: { x: -180, y: 20 } },
        { label: 'SINGULARIDAD CUÁNTICA // TERRA-1 CORE', offset: { x: 100, y: 90 } }
      ],
      genesis: [
        { label: 'FACETAS CRISTALINAS FOTÓNICAS', offset: { x: 110, y: -80 } },
        { label: 'HEBRA NEURAL BIO-SINTÉTICA (GÉNESIS-DNA)', offset: { x: -200, y: 15 } },
        { label: 'MATRIZ DE POLARIZACIÓN REFRACTIVA', offset: { x: 90, y: 90 } }
      ]
    };

    const labels = relicData[this.currentRelic] || [];
    const center = this.project3D(this.pos.x, this.pos.y, this.pos.z);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = this.visionMode === 'wireframe' ? '#00ff88' : '#00f0ff';
    ctx.strokeStyle = this.visionMode === 'wireframe' ? 'rgba(0, 255, 136, 0.4)' : 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1;

    labels.forEach((item, idx) => {
      const lx = center.x + item.offset.x;
      const ly = center.y + item.offset.y;

      // Línea guía desde el centro hacia la etiqueta
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(lx - 8, ly);
      ctx.lineTo(lx + 140, ly);
      ctx.stroke();

      // Pequeño retículo
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 2, ly - 2, 4, 4);

      // Texto
      ctx.fillStyle = this.visionMode === 'wireframe' ? '#00ff88' : '#e0f2fe';
      ctx.fillText(item.label, lx + 6, ly - 4);
    });

    ctx.restore();
  }
}

// Exportar globalmente
window.RelicsEngine = RelicsEngine;
