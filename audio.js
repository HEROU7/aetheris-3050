/**
 * AETHERIS 3050 — Aura Sound Lab
 * Motor de Audio Procedural Nativo (Web Audio API)
 * 100% sintetizado en tiempo real sin archivos externos.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.isInitialized = false;

    // Buses de mezcla
    this.masterGain = null;
    this.compressor = null;
    this.analyser = null;

    // Drones ambientales
    this.droneGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneFilter = null;
    this.droneLfo = null;
    this.noiseNode = null;

    // Resonancia activa de reliquia
    this.currentResonanceNodes = [];

    // Búfer de análisis de espectro y osciloscopio
    this.timeData = null;
    this.freqData = null;
  }

  /**
   * Inicializa el contexto de audio en respuesta al primer gesto del usuario
   */
  init() {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Limiter / Compresor para evitar saturación y distorsión
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      // Analizador de señal para Osciloscopio HUD y Espectrograma
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      // Enrutamiento: Fuente -> MasterGain -> Compressor -> Analyser -> Destino
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Iniciar el generador del Drone de la estación espacial
      this._setupStationDrone();

      this.isInitialized = true;
      this.isMuted = false;
      this.masterGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.5);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (err) {
      console.warn('[Aura Synth] Web Audio API no soportado o bloqueado:', err);
    }
  }

  /**
   * Asegura que el contexto esté despierto y reanuda si fue suspendido
   */
  ensureRunning() {
    if (!this.isInitialized) {
      this.init();
    } else if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Conmuta el estado de silencio (Mute / Unmute)
   */
  toggleMute() {
    this.ensureRunning();
    if (!this.ctx) return false;

    this.isMuted = !this.isMuted;
    const targetGain = this.isMuted ? 0.0001 : 0.7;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    return !this.isMuted;
  }

  setMuted(muted) {
    this.ensureRunning();
    if (!this.ctx) return;
    this.isMuted = muted;
    const targetGain = this.isMuted ? 0.0001 : 0.7;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  /**
   * Genera el zumbido hipnótico de la cámara de contención en gravedad cero
   * Frecuencia sub-bass (55Hz / 110Hz) con filtro modulado por LFO y ruido tenue de ventilación.
   */
  _setupStationDrone() {
    if (!this.ctx) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

    // Filtro pasa-bajos con modulación lenta
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.droneFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    // Oscilador 1: Sub-graves (55Hz, La1)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    // Oscilador 2: Armónico enriquecido (110Hz, La2 levemente desafinado para batido acústico)
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(110.3, this.ctx.currentTime);

    // LFO que modula suavemente el corte del filtro (0.06 Hz = respiración espacial lenta)
    this.droneLfo = this.ctx.createOscillator();
    this.droneLfo.frequency.setValueAtTime(0.065, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(55, this.ctx.currentTime); // modulación +-55 Hz

    this.droneLfo.connect(lfoGain);
    lfoGain.connect(this.droneFilter.frequency);

    // Generador de ruido rosa/marrón sintetizado (atmósfera presurizada)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.07;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.droneGain);

    // Conexiones de osciladores principales
    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    // Iniciar osciladores
    this.droneOsc1.start();
    this.droneOsc2.start();
    this.droneLfo.start();
    this.noiseNode.start();
  }

  /**
   * SFX: Clic mecánico de interfaz de alta frecuencia
   */
  playClick() {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.035);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  /**
   * SFX: Micro-hover táctil
   */
  playHover() {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.02);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.025);
  }

  /**
   * SFX: Barrido de frecuencia holográfica al desplegar paneles o desclasificar
   */
  playScanSweep() {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(1900, t + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.22);
    filter.Q.setValueAtTime(5.0, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  /**
   * SFX: Conmutación de Modo de Visión (Luz Visible / Escaneo Cuántico / Rayos-X)
   */
  playModeSwitch() {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;

    [523.25, 659.25, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);

      gain.gain.setValueAtTime(0.14, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.13);
    });
  }

  /**
   * SFX: Salto Hiperespacial de Era Histórica
   */
  playWarpJump() {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;

    // Aceleración de frecuencia ascendente
    const warpOsc = this.ctx.createOscillator();
    const warpFilter = this.ctx.createBiquadFilter();
    const warpGain = this.ctx.createGain();

    warpOsc.type = 'sawtooth';
    warpOsc.frequency.setValueAtTime(65, t);
    warpOsc.frequency.exponentialRampToValueAtTime(980, t + 0.65);
    warpOsc.frequency.exponentialRampToValueAtTime(140, t + 1.2);

    warpFilter.type = 'lowpass';
    warpFilter.frequency.setValueAtTime(220, t);
    warpFilter.frequency.exponentialRampToValueAtTime(4500, t + 0.65);
    warpFilter.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    warpFilter.Q.setValueAtTime(8, t);

    warpGain.gain.setValueAtTime(0.001, t);
    warpGain.gain.linearRampToValueAtTime(0.35, t + 0.55);
    warpGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);

    warpOsc.connect(warpFilter);
    warpFilter.connect(warpGain);
    warpGain.connect(this.masterGain);

    warpOsc.start(t);
    warpOsc.stop(t + 1.3);

    // Explosión de aire/plasma en el pico del salto
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.8, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.22));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, t + 0.5);
    noiseFilter.frequency.exponentialRampToValueAtTime(450, t + 1.1);
    noiseFilter.Q.setValueAtTime(2.5, t + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, t + 0.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t + 0.5);
  }

  /**
   * SFX: Impacto / Rebote de reliquia contra los límites de la cámara de gravedad cero
   * @param {number} velocity Intensidad de velocidad de impacto (0.1 a 1.0)
   * @param {string} relicType Identificador de reliquia ('voyager', 'quantum', 'genesis')
   */
  playCollision(velocity = 0.5, relicType = 'voyager') {
    if (this.isMuted || !this.ctx) return;
    this.ensureRunning();

    const t = this.ctx.currentTime;
    const clampedVel = Math.min(Math.max(velocity, 0.1), 1.0);

    if (relicType === 'voyager') {
      // Resonancia de disco de oro / bronce espacial
      const freqs = [380, 760, 1140, 1520];
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, t);

        const decay = 0.25 / (idx + 1) * clampedVel + 0.08;
        const vol = (0.22 / (idx + 1)) * clampedVel;

        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + decay + 0.02);
      });
    } else if (relicType === 'quantum') {
      // Golpe sub-electromagnético con chirp digital
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.28);

      gain.gain.setValueAtTime(0.35 * clampedVel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.35);
    } else {
      // Cristal Génesis: Campana de cuarzo prístina
      const crystalFreqs = [1760, 3520, 5280];
      crystalFreqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);

        const decay = 0.45 * clampedVel + 0.1;
        const vol = (0.15 / (idx + 1)) * clampedVel;

        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + decay + 0.02);
      });
    }
  }

  /**
   * SINTONIZACIÓN DE FRECUENCIA DE RESONANCIA
   * Ejecuta el acorde armónico característico de la reliquia seleccionada.
   * @param {string} relicId 'voyager' | 'quantum' | 'genesis'
   */
  playRelicResonance(relicId) {
    this.ensureRunning();
    if (!this.ctx) return;

    // Detener resonancias activas previas
    this.stopActiveResonance();

    const t = this.ctx.currentTime;

    if (relicId === 'voyager') {
      // El Disco de Oro: Armónicos dorados cálidos (Acorde Mayor con vibrato análogo)
      // D4 (293.66Hz), F#4 (369.99Hz), A4 (440Hz), C#5 (554.37Hz)
      const chord = [293.66, 369.99, 440.00, 554.37];
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        // Sutil vibrato analógico
        const vibrato = this.ctx.createOscillator();
        vibrato.frequency.setValueAtTime(5.5, t);
        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.setValueAtTime(3.2, t);
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start(t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14, t + 0.6);
        gain.gain.setValueAtTime(0.14, t + 2.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 4.3);
        vibrato.stop(t + 4.3);

        this.currentResonanceNodes.push(osc, gain, vibrato);
      });
    } else if (relicId === 'quantum') {
      // El Núcleo Cuántico: Sintetizador cuántico pulsante con arpegio
      // Frecuencias futuristas en intervalo de quintas aumentadas
      const freqs = [110, 220, 329.63, 493.88, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, t);
        filter.Q.setValueAtTime(4.0, t);

        if (panner) {
          panner.pan.setValueAtTime((idx - 2) * 0.4, t);
        }

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.4);
        gain.gain.setValueAtTime(0.12, t + 3.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);

        osc.connect(filter);
        filter.connect(gain);
        if (panner) {
          gain.connect(panner);
          panner.connect(this.masterGain);
        } else {
          gain.connect(this.masterGain);
        }

        osc.start(t);
        osc.stop(t + 4.6);
        this.currentResonanceNodes.push(osc, gain);
      });
    } else {
      // Cristal Bio-Sintético Génesis: Campana etérea cristalina
      // Armónicos puros basados en la proporción áurea
      const crystalNotes = [528.0, 792.0, 1056.0, 1584.0, 2112.0];
      crystalNotes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.11 / (idx + 1), t + 0.8);
        gain.gain.setValueAtTime(0.11 / (idx + 1), t + 3.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 5.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 5.1);
        this.currentResonanceNodes.push(osc, gain);
      });
    }
  }

  stopActiveResonance() {
    this.currentResonanceNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.currentResonanceNodes = [];
  }

  /**
   * Obtiene la forma de onda en tiempo real para el osciloscopio
   */
  getWaveformData() {
    if (!this.analyser || !this.timeData) return null;
    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }

  /**
   * Obtiene los datos de frecuencias en tiempo real para el espectrograma
   */
  getFrequencyData() {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }
}

// Exportar globalmente
window.SoundEngine = SoundEngine;
