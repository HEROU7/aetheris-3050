# Guía de Contribución — AETHERIS 3050

Agradecemos tu interés en contribuir a la preservación del archivo holográfico **AETHERIS 3050**.

## Principios para Contribuciones

1. **Cero Dependencias Pesadas:** Todo nuevo artefacto o módulo debe mantenerse dentro de la filosofía de cero bibliotecas externas y renderizado directo en Canvas / Web Audio API nativo.
2. **Rendimiento Estricto (60 FPS):** No se aceptan animaciones o cálculos matemáticos que provoquen caídas de fotogramas o asignaciones descontroladas de memoria en el bucle principal.
3. **Calidad Visual Awwwards:** Toda nueva interfaz o elemento interactivo debe respetar el sistema de diseño NexusOS: tipografías mono/display, bordes con brillo sutil (1px), curvas de resorte y estados activos responsivos.

## Flujo de Trabajo

1. Haz un Fork del repositorio.
2. Crea una rama descriptiva para tu característica: `git checkout -b feature/nueva-reliquia`.
3. Prueba tu código localmente asegurando que la consola de desarrollo permanezca limpia de errores y advertencias.
4. Envía un Pull Request con una descripción detallada de tus cambios.
