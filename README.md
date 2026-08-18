# Palette Matcher 1.0

English | 🌐 [Versión en Español](README-ES.md)

> First official release. Previously developed under the internal codename "v7".

An interactive, high-performance tool for **color palette matching** with advanced matching algorithms and ramp generation.

## 🎨 What does it do?

Palette Matcher lets you work with color palettes professionally, from importing base colors to generating smoothed ramps and automatic matching against existing palettes. Perfect for designers, illustrators, and developers who need fine-grained control over their color palettes.

## ✨ Features

- **Lab Color Matching** — Color matching using the LAB color space for perceptually accurate results
- **HSL Ramps** — Lightness-only ramp generation for maximum control
- **Multi-layer Shadows & Highlights** — Granular control over shadows (multiply) and highlights (screen) with adjustable layers
- **Web Workers** — Background processing to keep the UI responsive, even with large batches
- **Feathering** — Advanced smoothing of transitions between colors
- **Batch Processing** — Process multiple images or datasets in bulk
- **Video Mode** — Support for frame-by-frame video processing
- **Presets** — Save and load custom configurations
- **Import/Export** — Import palettes in HEX format
- **Non-chained Smoothing** — Independent smoothing without effect chaining

## 🚀 Usage

1. Open `index.html` in your browser
2. Import your base palette (colors separated by commas or line breaks)
3. Adjust the ramp, shadow, and highlight parameters
4. Use single mode to process individual images or batch mode for multiple files
5. Save your favorite configurations as presets

## 📋 Requirements

- Modern browser with support for Web Workers, Canvas, and the FileReader API
- No installation or external dependencies required (all vanilla JS)

## 📝 License

Free to use and modify.

---

Made with 💜 by Meteori-K Media
