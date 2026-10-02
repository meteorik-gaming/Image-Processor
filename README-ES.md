# Image Processor v1.3.3

🌐 [English version](README.md) | Español | 📝 [Changelog](CHANGELOG-ES.md)

> Anteriormente desarrollado bajo el codename interno "v7", y anteriormente lanzado y conocido como **Palette Matcher** (v1.0) — renombrado a Image Processor a partir de v1.1, ahora que cubre más que solo matching de paletas. Esa historia no se borra, solo dejó de ser toda la historia. Mirá el [changelog](CHANGELOG-ES.md) para ver qué cambió.

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

### 🔤 Text Converter

Convierte una imagen en texto (ASCII art y similares): cada pixel se vuelve el símbolo que le asignaste a su color de paleta más cercano.

- Tabla color → símbolo; los símbolos pueden ser cualquier texto (`B`, `##`, un emoji). Copia los colores de cualquiera de las 3 paletas de Palette Matcher (base / gris / foreground) y asígnales símbolos
- Símbolo propio para pixeles transparentes
- Sliders de grid (columnas/filas, con grid-lock) o **1 símbolo por pixel** (tamaño original de la imagen, tope de 4M de pixeles); el símbolo de cada celda se elige por mayoría o promediando la celda
- Salida en pantalla, copiable y descargable como `.txt` (sin separador, coma, espacio, tab o personalizado), `.csv` o `.json`
- Avisa (nunca bloquea) si dos colores comparten símbolo, si un símbolo está vacío o si tiene más de un carácter (un emoji cuenta como uno)
- Suelta varias imágenes o una carpeta para obtener un archivo por imagen dentro de un `.zip`
- Presets nombrados, igual que los demás tools — y usable como bloque en Sequence, **solo como último bloque** (su salida es texto, así que nada puede ir después; ponerlo antes se marca como error y bloquea la corrida)

### ➖ Subtract

Resta la imagen B de la imagen A (ambas exactamente del mismo tamaño) y devuelve un PNG con solo lo que es distinto: donde el color de A difiere del de B por más que un umbral, el pixel se queda tal cual está en A; en todo lo demás queda transparente.

- Umbral de diferencia medido en Lab ΔE, bordes duros (cada pixel es todo o nada)
- Limpieza: quitar islas chicas, rellenar huecos chicos
- Invertir (quedarse con lo que *no* cambió) y recorte opcional al contenido que quedó
- Los tamaños deben coincidir exacto — si no, marca error y no corre
- Modo carpetas: elige una carpeta de bases (A) y otra a restar (B); se emparejan por nombre de archivo y salen como un PNG por par en un `.zip`, saltando y reportando las que no tengan pareja o midan distinto
- Presets nombrados. No está disponible en Sequence, porque necesita dos imágenes

## 🚀 Uso

1. Abre `index.html` en tu navegador
2. Elige un tool desde las pestañas de arriba (Palette Matcher / Pixelate / Sequence / Text Converter)
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
