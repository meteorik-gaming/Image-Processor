# Palette Matcher v7

Una herramienta interactiva y performante para **matching de paletas de colores** con algoritmos avanzados de matching y generación de ramps.

## 🎨 ¿Qué hace?

Palette Matcher te permite trabajar con paletas de colores de forma profesional, desde importar colores base hasta generar ramps suavizados y matching automático a paletas existentes. Perfecto para diseñadores, ilustradores y desarrolladores que necesiten control fino sobre sus paletas de color.

## ✨ Features

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

## 🚀 Uso

1. Abre `index.html` en tu navegador
2. Importa tu paleta base (colores separados por comas o saltos de línea)
3. Ajusta los parámetros de ramps, sombras y brillos
4. Usa single mode para procesar imágenes individuales o batch mode para múltiples archivos
5. Guarda tus configuraciones favoritas como presets

## 📋 Requisitos

- Navegador moderno con soporte para Web Workers, Canvas y FileReader API
- No requiere instalación ni dependencias externas (todo vanilla JS)

## 📝 Licencia

Libre para usar y modificar.

---

Hecho con 💜 por Alan
