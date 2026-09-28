# Image Processor v1.0

🌐 [English version](README.md) | Español | 📝 [Changelog](CHANGELOG-ES.md)

> Primer release oficial. Anteriormente desarrollado bajo el codename interno "v7", y anteriormente lanzado y conocido como **Palette Matcher** — renombrado a Image Processor ahora que cubre más que solo matching de paletas. Esa historia no se borra, solo dejó de ser toda la historia.

Un toolkit interactivo y performante de procesamiento de imágenes para navegador, construido una herramienta a la vez. Elige un tool desde las pestañas de arriba; cada uno tiene su propio panel de configuración (con secciones colapsables, para que no se vuelva una pared de sliders) y su propio espacio de trabajo. Todos los sliders de la app soportan doble click para escribir un valor exacto, y cada tool tiene sus propios presets nombrados.

## 🧰 Tools

### 🎨 Palette Matcher

Trabaja con paletas de colores de forma profesional, desde importar colores base hasta generar ramps suavizados y matching automático a paletas existentes. Perfecto para diseñadores, ilustradores y desarrolladores que necesiten control fino sobre sus paletas de color.

- **Lab Color Matching** — Matching de colores usando espacio LAB para resultados perceptualmente precisos
- **HSL Ramps** — Generación de ramps de colores solo en lightness para máximo control
- **Multi-layer Shadows & Highlights** — Control granular sobre sombras (multiply) y brillos (screen) con capas ajustables
- **Web Workers** — Procesamiento en background para no bloquear la UI, incluso con lotes grandes
- **Feathering** — Suavizado avanzado de transiciones entre colores
- **Batch Processing** — Procesar múltiples imágenes o datos en lote
- **Video Mode** — Soporte para procesamiento de video frame-by-frame
- **Presets** — Guardar y cargar configuraciones personalizadas
- **Import/Export** — Importar paletas en formato HEX
- **Non-chained Smoothing** — Suavizado independiente sin encadenamiento de efectos

### 🔲 Pixelate

Reduce la imagen a un grid real de pixel art, y opcionalmente la vuelve a escalar sin blur para exportarla.

- Sliders independientes de ancho/alto del grid (30–120 celdas cada uno, con checkbox de grid-lock para igualarlos) — no tiene por qué respetar el aspect ratio original
- Dos métodos para elegir el color de cada celda: **promedio** simple, o **color dominante** por clustering en espacio Lab (agrupa tonos perceptualmente parecidos, así un shading fino en gradiente igual encuentra un color mayoritario sin necesitar un pixel exactamente repetido)
- Factor de upscale (1×–10×, nearest-neighbor) para exportar el pixel art más grande sin blur
- Manda el resultado pixelado directo a Palette Matcher para también matchearlo contra una paleta — o expórtalo standalone

### 🧩 Sequence

Encadena otros tools: agrega bloques ordenados, cada uno un tool atado a uno de sus presets guardados, y corre toda la cadena sobre una sola imagen — el resultado de un bloque es la entrada del siguiente.

- Bloques reordenables (↑ / ↓ / ✕) — combina Palette Matcher y Pixelate en el orden que quieras, las veces que quieras
- Cada bloque corre con un **preset nombrado** que ya guardaste en ese tool (los bloques no usan lo que esté en pantalla en ese momento)
- Muestra el resultado de cada paso intermedio, no solo el final, para que veas qué hizo cada bloque
- La lista de bloques se autoguarda igual que todo lo demás

## 🚀 Uso

1. Abre `index.html` en tu navegador
2. Elige un tool desde las pestañas de arriba (Palette Matcher / Pixelate / Sequence)
3. Configúralo en el panel izquierdo — haz click en el título de una sección para colapsarla/expandirla, doble click en cualquier slider para escribir un valor exacto
4. Suelta una imagen (o una carpeta / video, en Palette Matcher) y procésala
5. Guarda configuraciones como presets nombrados en cada tool — tu última config siempre se autoguarda, y los presets nombrados son con lo que corren los bloques de Sequence

## 📋 Requisitos

- Navegador moderno con soporte para Web Workers, Canvas y FileReader API
- No requiere instalación ni dependencias externas (todo vanilla JS)

## 📝 Licencia

Libre para usar y modificar.

---

Hecho con 💜 por Meteori-K Media
