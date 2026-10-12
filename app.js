/**
 * AETHERIS 3050 — Orquestador Principal (NexusOS)
 * Integración de Audio procedural, Motor Cósmico, Reliquias 3D y Telemetría.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Instanciación de Motores
  const cosmosCanvas = document.getElementById('cosmos-canvas');
  const chamberCanvas = document.getElementById('chamber-canvas');
  const oscCanvas = document.getElementById('hud-oscilloscope');
  const spectrumCanvas = document.getElementById('dossier-spectrum');

  const soundEngine = new SoundEngine();
  const cosmosEngine = new CosmosEngine(cosmosCanvas);
  const relicsEngine = new RelicsEngine(chamberCanvas, soundEngine);

  // Contextos de los mini-canvases visualizadores
  const oscCtx = oscCanvas.getContext('2d');
  const spectrumCtx = spectrumCanvas.getContext('2d');

  // Estado general de la aplicación
  let activeRelicId = 'voyager';
  let activeEra = 'analog';
  let activeVision = 'visible';
  let activeGravity = '0g';
  let isDossierOpen = true;

  // Base de datos de reliquias desclasificadas
  const relicDatabase = {
    voyager: {
      title: 'EL DISCO DE ORO DE LAS VOYAGER',
      eraTag: 'ERA ANALÓGICA • AÑO 1977 D.C.',
      classification: 'CONFIDENCIAL // NIVEL OMEGA',
      code: 'ARCH-3050-V1',
      composition: 'Cobre bañado en oro / Uranio-238',
      mass: '1.024 kg (Inercia 0G)',
      quantum: 'ψ = 0.0014 meV',
      preservation: '99.98% Integridad',
      chronicle: 'Lanzado a bordo de la sonda espacial Voyager 1 en agosto de 1977, este fonógrafo de 12 pulgadas porta los sonidos, imágenes y lenguajes del amanecer planetario de la Tierra. Recuperado de la Nube de Oort en el año 2914 por la Flota Arqueológica de Orión tras 937 años de silencio intersticial, sus surcos microscópicos preservan las últimas voces análogas de la humanidad primigenia.',
      freqDisplay: '432.08 Hz',
      freqNumeric: 432.08
    },
    quantum: {
      title: 'EL NÚCLEO CUÁNTICO TERRA-1',
      eraTag: 'ERA SILICIO • AÑO 2088 D.C.',
      classification: 'RESTRINGIDO // SECTOR TERRA',
      code: 'ARCH-3050-Q7',
      composition: 'Hipercubo de grafeno y supercomputación cuántica',
      mass: '3.450 kg (Inercia 0G)',
      quantum: 'ψ = 894.20 meV',
      preservation: '98.74% Integridad',
      chronicle: 'Forjado en el centro subterráneo de Ginebra durante la Gran Convergencia Digital de 2088, Terra-1 fue el primer procesador de coherencia cuántica sin pérdidas de decoherencia térmica. Contuvo durante décadas los modelos climáticos que salvaron la biosfera terrestre antes del éxodo interplanetario. Su matriz de entrelazamiento continúa procesando probabilidades cuánticas en bucle perpetuo.',
      freqDisplay: '891.42 MHz',
      freqNumeric: 891.42
    },
    genesis: {
      title: 'CRISTAL BIO-SINTÉTICO GÉNESIS',
      eraTag: 'ERA POST-HUMANA • AÑO 2540 D.C.',
      classification: 'PÚBLICO // ACCESO ARCHIVO',
      code: 'ARCH-3050-BIO',
      composition: 'Retícula fotónica de cuarzo y hebra bio-neural',
      mass: '0.812 kg (Inercia 0G)',
      quantum: 'ψ = 12.44 meV',
      preservation: '100.00% Inmortal',
      chronicle: 'Creado en los laboratorios orbitales de Titán en 2540, el Cristal Génesis fusiona el código genético humano completo (homo sapiens) con una red neural auto-reparable basada en fotones entrelazados. Su estructura cristalina refracta pulsos lumínicos codificados capaces de regenerar la biodiversidad completa del planeta Tierra ante cualquier catástrofe de escala cósmica.',
      freqDisplay: '528.00 Hz',
      freqNumeric: 528.00
    }
  };

  // Referencias a elementos del DOM
  const welcomeModal = document.getElementById('welcome-modal');
  const btnEnterVault = document.getElementById('btn-enter-vault');
  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  const audioBtnText = document.getElementById('audio-btn-text');
  const dossierPanel = document.getElementById('dossier-panel');
  const btnToggleDossier = document.getElementById('btn-toggle-dossier');
  const dossierCloseTab = document.getElementById('dossier-close-tab');
  const btnTriggerResonance = document.getElementById('btn-trigger-resonance');
  const btnExplodeToggle = document.getElementById('btn-explode-toggle');
  const btnRecenter = document.getElementById('btn-recenter');
  const stardateTicker = document.getElementById('stardate-ticker');
  const quantumIntegrityVal = document.getElementById('quantum-integrity-val');
  const quantumIntegrityBar = document.getElementById('quantum-integrity-bar');
  const warpStatusText = document.getElementById('warp-status-text');

  // Elementos de la ficha Dossier
  const dossierClassification = document.getElementById('dossier-classification');
  const dossierCode = document.getElementById('dossier-code');
  const dossierTitle = document.getElementById('dossier-relic-title');
  const dossierEraTag = document.getElementById('dossier-era-tag');
  const specComposition = document.getElementById('spec-composition');
  const specMass = document.getElementById('spec-mass');
  const specQuantum = document.getElementById('spec-quantum');
  const specPreservation = document.getElementById('spec-preservation');
  const dossierChronicle = document.getElementById('dossier-chronicle-text');
  const relicFreqDisplay = document.getElementById('relic-freq-display');

  // =========================================================================
  // GESTIÓN DE AUDIO & MODAL DE BIENVENIDA
  // =========================================================================
  const unlockAudioAndStart = () => {
    soundEngine.init();
    soundEngine.setMuted(false);
    updateAudioUI(true);
    welcomeModal.classList.add('hidden');
    soundEngine.playScanSweep();
  };

  btnEnterVault.addEventListener('click', unlockAudioAndStart);

  // Desbloqueo pasivo en primer clic si el usuario cerró el modal
  window.addEventListener('click', () => {
    if (!soundEngine.isInitialized) {
      soundEngine.init();
    }
  }, { once: true });

  const updateAudioUI = (isPlaying) => {
    if (isPlaying) {
      audioToggleBtn.classList.remove('muted');
      audioBtnText.textContent = 'AUDIO: ON';
    } else {
      audioToggleBtn.classList.add('muted');
      audioBtnText.textContent = 'AUDIO: OFF';
    }
  };

  audioToggleBtn.addEventListener('click', () => {
    const isNowPlaying = soundEngine.toggleMute();
    updateAudioUI(isNowPlaying);
  });

  // =========================================================================
  // SELECTOR DE RELIQUIAS 3D
  // =========================================================================
  const relicTabs = document.querySelectorAll('.relic-tab');

  const selectRelic = (relicId) => {
    if (activeRelicId === relicId) return;
    activeRelicId = relicId;

    relicTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.relic === relicId);
    });

    relicsEngine.setRelic(relicId);
    updateDossierContent(relicId);
    soundEngine.playClick();
  };

  relicTabs.forEach(tab => {
    tab.addEventListener('click', () => selectRelic(tab.dataset.relic));
  });

  const updateDossierContent = (relicId) => {
    const data = relicDatabase[relicId];
    if (!data) return;

    dossierClassification.textContent = data.classification;
    dossierCode.textContent = data.code;
    dossierTitle.textContent = data.title;
    dossierEraTag.textContent = data.eraTag;
    specComposition.textContent = data.composition;
    specMass.textContent = data.mass;
    specQuantum.textContent = data.quantum;
    specPreservation.textContent = data.preservation;
    dossierChronicle.textContent = data.chronicle;
    relicFreqDisplay.textContent = data.freqDisplay;

    // Resaltar suavemente la ficha con micro-animación
    dossierPanel.style.transform = isDossierOpen ? 'translateX(0)' : 'translateX(110%)';
  };

  // =========================================================================
  // CONTROLES DE LA CÁMARA (GRAVEDAD, DESPIECE, RECENTRADO)
  // =========================================================================
  const gravityButtons = document.querySelectorAll('[data-gravity]');

  const setGravityMode = (mode) => {
    activeGravity = mode;
    gravityButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gravity === mode);
    });
    relicsEngine.setGravity(mode);
  };

  gravityButtons.forEach(btn => {
    btn.addEventListener('click', () => setGravityMode(btn.dataset.gravity));
  });

  // Vista explosionada
  btnExplodeToggle.addEventListener('click', () => {
    const exploded = relicsEngine.toggleExploded();
    btnExplodeToggle.classList.toggle('active', exploded);
    document.getElementById('btn-explode-text').textContent = exploded ? 'VISTA ENSAMBLADA' : 'VISTA EXPLOSIONADA';
  });

  // Recentrar reliquia
  btnRecenter.addEventListener('click', () => {
    relicsEngine.resetRelicPosition();
    soundEngine.playClick();
  });

  // Panel Dossier (Abrir / Cerrar)
  const toggleDossier = (forceState = null) => {
    isDossierOpen = forceState !== null ? forceState : !isDossierOpen;
    dossierPanel.classList.toggle('open', isDossierOpen);
    soundEngine.playScanSweep();
  };

  btnToggleDossier.addEventListener('click', () => toggleDossier());
  dossierCloseTab.addEventListener('click', () => toggleDossier(false));

  // Sintonizador de Resonancia
  btnTriggerResonance.addEventListener('click', () => {
    soundEngine.playRelicResonance(activeRelicId);

    // Feedback táctil y visual
    btnTriggerResonance.style.transform = 'scale(0.96)';
    setTimeout(() => {
      btnTriggerResonance.style.transform = '';
    }, 150);
  });

  // =========================================================================
  // MODOS DE VISIÓN (Óptico, Cuántico, Rayos-X)
  // =========================================================================
  const visionButtons = document.querySelectorAll('.vision-btn');

  const setVisionMode = (mode) => {
    activeVision = mode;
    visionButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vision === mode);
    });

    document.body.className = `vision-${mode}`;
    cosmosEngine.setVisionMode(mode);
    relicsEngine.setVisionMode(mode);
    soundEngine.playModeSwitch();
  };

  visionButtons.forEach(btn => {
    btn.addEventListener('click', () => setVisionMode(btn.dataset.vision));
  });

  // =========================================================================
  // LÍNEA TEMPORAL & SALTO HIPERESPACIAL (Aethel Engine)
  // =========================================================================
  const eraButtons = document.querySelectorAll('.era-btn');

  const jumpToEra = (eraId) => {
    if (activeEra === eraId) return;
    activeEra = eraId;

    eraButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.era === eraId);
    });

    warpStatusText.textContent = 'HIPER-SALTO EN PROGRESO...';
    warpStatusText.style.color = '#ffb703';

    cosmosEngine.warpToEra(eraId);
    soundEngine.playWarpJump();

    setTimeout(() => {
      warpStatusText.textContent = 'HIPER-SALTO: ESTABLE';
      warpStatusText.style.color = 'var(--accent-cyan)';
    }, 1400);
  };

  eraButtons.forEach(btn => {
    btn.addEventListener('click', () => jumpToEra(btn.dataset.era));
  });

  // =========================================================================
  // TELEMETRÍA EN TIEMPO REAL (Reloj Estelar e Integridad Cuántica)
  // =========================================================================
  let integrityBase = 99.80;

  const updateTelemetry = () => {
    const now = new Date();
    const yearFraction = ((now.getMonth() * 30 + now.getDate()) / 365).toFixed(3);
    const ms = String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
    const stardate = (9820 + (now.getSeconds() * 1000 + now.getMilliseconds()) / 60000).toFixed(1);

    stardateTicker.textContent = `AÑO 3050.${yearFraction.slice(2)} | STARDATE // ${stardate}`;

    // Micro-fluctuación cuántica viva
    if (Math.random() < 0.15) {
      const jitter = (Math.random() - 0.5) * 0.08;
      const val = Math.min(Math.max(integrityBase + jitter, 99.65), 99.98).toFixed(1);
      quantumIntegrityVal.textContent = `${val}%`;
      quantumIntegrityBar.style.width = `${val}%`;
    }
  };

  setInterval(updateTelemetry, 100);

  // =========================================================================
  // MINI-OSCILOSCOPIO Y ESPECTRÓMETRO EN TIEMPO REAL
  // =========================================================================
  const drawOscilloscope = () => {
    const wave = soundEngine.getWaveformData();
    const w = oscCanvas.width;
    const h = oscCanvas.height;

    oscCtx.clearRect(0, 0, w, h);

    oscCtx.strokeStyle = activeVision === 'wireframe' ? '#00ff88' : '#00f0ff';
    oscCtx.lineWidth = 1.4;
    oscCtx.beginPath();

    if (!wave || soundEngine.isMuted) {
      // Línea plana de reposo
      oscCtx.moveTo(0, h / 2);
      oscCtx.lineTo(w, h / 2);
    } else {
      const sliceW = w / wave.length;
      for (let i = 0; i < wave.length; i++) {
        const v = wave[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) oscCtx.moveTo(0, y);
        else oscCtx.lineTo(i * sliceW, y);
      }
    }
    oscCtx.stroke();
  };

  const drawSpectrum = () => {
    const freq = soundEngine.getFrequencyData();
    const w = spectrumCanvas.width;
    const h = spectrumCanvas.height;

    spectrumCtx.clearRect(0, 0, w, h);

    const numBars = 18;
    const barW = (w / numBars) - 1.5;

    for (let i = 0; i < numBars; i++) {
      let val = 0;
      if (freq && !soundEngine.isMuted) {
        val = freq[i * 2] / 255;
      } else {
        // Micro-actividad residual sutil
        val = (Math.sin(performance.now() * 0.003 + i) * 0.15 + 0.18) * 0.3;
      }

      const barH = Math.max(val * h, 2);
      const x = i * (barW + 1.5);
      const y = h - barH;

      spectrumCtx.fillStyle = activeVision === 'wireframe' ? '#00ff88' : (i % 2 === 0 ? '#00f0ff' : '#a855f7');
      spectrumCtx.fillRect(x, y, barW, barH);
    }
  };

  // =========================================================================
  // ATAJOS DE TECLADO SCI-FI
  // =========================================================================
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toUpperCase();
    if (key === '1') selectRelic('voyager');
    else if (key === '2') selectRelic('quantum');
    else if (key === '3') selectRelic('genesis');
    else if (key === 'G') {
      const gravOrder = ['0g', '1g', 'hyper'];
      const nextIdx = (gravOrder.indexOf(activeGravity) + 1) % gravOrder.length;
      setGravityMode(gravOrder[nextIdx]);
    } else if (key === 'E') {
      btnExplodeToggle.click();
    } else if (key === 'V') {
      const visOrder = ['visible', 'quantum', 'wireframe'];
      const nextIdx = (visOrder.indexOf(activeVision) + 1) % visOrder.length;
      setVisionMode(visOrder[nextIdx]);
    } else if (key === 'M') {
      audioToggleBtn.click();
    } else if (key === 'D') {
      toggleDossier();
    } else if (key === ' ' || key === 'SPACEBAR') {
      relicsEngine.resetRelicPosition();
    }
  });

  // =========================================================================
  // BUCLE DE ANIMACIÓN PRINCIPAL A 60 FPS (requestAnimationFrame)
  // =========================================================================
  let lastTimestamp = performance.now();

  const mainLoop = (timestamp) => {
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // Actualizar y renderizar fondo estelar (Aethel Engine)
    cosmosEngine.update(deltaTime);
    cosmosEngine.render();

    // Actualizar y renderizar reliquias 3D y cámara de gravedad cero
    relicsEngine.update(deltaTime);
    relicsEngine.render();

    // Actualizar osciloscopio y analizador de espectro
    drawOscilloscope();
    drawSpectrum();

    requestAnimationFrame(mainLoop);
  };

  requestAnimationFrame(mainLoop);
});
