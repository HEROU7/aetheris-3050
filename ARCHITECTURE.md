# Arquitectura Técnica — AETHERIS 3050

Este documento detalla los principios de diseño de software, el flujo de datos y las técnicas de optimización de rendimiento implementadas en **AETHERIS 3050**.

---

## 1. Principios de Diseño

1. **Autonomía y Cero Dependencias:** Todo el renderizado 3D y la síntesis sonora se ejecutan nativamente en el navegador sin bibliotecas externas (como Three.js, Babylon.js o Tone.js), reduciendo el bundle a menos de 75 KB de código puro y logrando tiempos de carga instantáneos ($< 200 \text{ ms}$).
2. **Desacoplamiento Modular:** Cada motor (`SoundEngine`, `CosmosEngine`, `RelicsEngine`) opera de forma aislada, exponiendo interfaces claras y permitiendo que el orquestador (`app.js`) sincronice estados mediante eventos.
3. **Presupuesto de Cuadros (60 FPS Frame Budget):** Las operaciones de cálculo físico y proyección se realizan sin asignar objetos en bucles críticos de animación para evitar la recolección de basura (*Garbage Collection pauses*).

---

## 2. Diagrama de Flujo de Audio (Aura Sound Lab)

```
[Oscilador Sub-Bass 55Hz] ----+
                              |--> [BiquadFilter Lowpass 140Hz] --+
[Oscilador Triángulo 110Hz] --+         ^                         |
                                        | (Modulación +-55Hz)     |
                                  [LFO 0.065Hz]                   |
                                                                  v
[Generador Ruido Rosa] -----> [Biquad Bandpass 260Hz] ---------> [Drone Gain (0.22)] --+
                                                                                       |
[SFX Clics / Sweeps / Pings] ----------------------------------------------------------> [Master Gain]
                                                                                       |       |
[Resonancia de Reliquias (Acordes / Arpegios)] -----------------------------------------+       v
                                                                                       [DynamicsCompressor]
                                                                                               |
                                                                                               v
                                                                                       [AnalyserNode (FFT)]
                                                                                               |
                                                                                               v
                                                                                       [AudioContext.destination]
```

### Características Clave:
- **Compresor / Limitador Maestro:** Umbral en $-14 \text{ dB}$, relación $6:1$ y ataque de $3 \text{ ms}$ para garantizar que múltiples sonidos simultáneos nunca distorsionen la señal.
- **Buffers de Ruido Estático:** El ruido rosa atmosférico se sintetiza una sola vez en un `AudioBuffer` de 2 segundos y se reproduce en bucle infinito, consumiendo prácticamente $0\%$ de CPU tras la inicialización.

---

## 3. Tubería de Renderizado y Proyección 3D (Zero-G Engine)

El motor de proyección 3D implementa una versión optimizada de la proyección en perspectiva con algoritmo del pintor (*Painter's Algorithm*):

1. **Definición Geométrica Local:** Cada componente de la reliquia define sus vértices y anillos en coordenadas locales $(x, y, z)$.
2. **Transformación Explosionada:** Si el factor de explosión $E \in [0, 1]$ es mayor a cero, los vértices se desplazan hacia el exterior a lo largo de sus vectores normales o desplazamientos axiales.
3. **Rotación Matricial:**
   Se aplican las matrices de rotación de Euler Yaw, Pitch y Roll:
   ```javascript
   // Yaw (Y)
   const x1 = p.x * cosY + p.z * sinY;
   const z1 = -p.x * sinY + p.z * cosY;
   // Pitch (X)
   const y2 = p.y * cosX - z1 * sinX;
   const z2 = p.y * sinX + z1 * cosX;
   // Roll (Z)
   const x3 = x1 * cosZ - y2 * sinZ;
   const y3 = x1 * sinZ + y2 * cosZ;
   ```
4. **Traslación y Profundidad de Cámara:** Se suma la posición del objeto en el contenedor $(pos_x, pos_y, pos_z)$ y la distancia focal de la cámara.
5. **Ordenación de Profundidad:** Las caras poligonales y capas se ordenan por su coordenada de profundidad $Z$ media antes de ser dibujadas en el `<canvas>`.
6. **Iluminación Difusa:** El producto escalar entre la normal de cada cara y el vector de luz virtual $(\vec{L} = [0.4, -0.7, 0.6])$ calcula la intensidad de brillo y opacidad del material.

---

## 4. Gestión de Memoria y Resistencia a Fugas

- Los listeners de eventos utilizan referencias fijas o se registran una única vez en el ciclo de vida del documento.
- Las dimensiones del canvas leen y escalan con `window.devicePixelRatio` limitado a $2.0$ para evitar sobrecostes innecesarios en pantallas Retina de ultra-alta densidad ($3\times$ o $4\times$).
- No se recrean arreglos tipados (`Uint8Array`) en cada cuadro; el analizador de audio escribe sobre buffers pre-asignados `this.timeData` y `this.freqData`.
