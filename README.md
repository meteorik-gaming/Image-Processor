# Image Processor v1.3.1

English | 🌐 [Versión en Español](README-ES.md) | 📝 [Changelog](CHANGELOG.md)

> Previously developed under the internal codename "v7", and previously released and known as **Palette Matcher** (v1.0) — renamed to Image Processor as of v1.1, now that it covers more than palette matching. Nothing about that history is going away, it's just no longer the whole story. See the [changelog](CHANGELOG.md) for what's new.

An interactive, high-performance browser toolkit for image processing, built one focused tool at a time. Pick a tool from the tabs at the top; each one gets its own config panel (with collapsible sections, so it doesn't turn into a wall of sliders) and its own workspace. Every slider in the app supports double-click-to-type an exact value, and every tool has its own named presets.

## 🧰 Tools

### 🎨 Palette Matcher

Work with color palettes professionally, from importing base colors to generating smoothed ramps and automatic matching against existing palettes. Perfect for designers, illustrators, and developers who need fine-grained control over their color palettes.

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

### 🔲 Pixelate

Downsamples the image to a real pixel-art grid, then optionally scales it back up crisp (no blur) for export.

- Independent width/height grid sliders (30–120 cells each, with a grid-lock checkbox to keep them equal) — doesn't have to match the original image's aspect ratio
- Two color-picking methods per cell: plain **average**, or **dominant-color clustering** in Lab space (groups perceptually similar shades so fine gradient shading still finds a majority color instead of needing an exact repeated pixel)
- Upscale factor (1×–10×, nearest-neighbor) to export the pixel art bigger without blur
- Send the pixelated result straight into Palette Matcher to also match it against a palette — or export it standalone

### 🧩 Sequence

Chains other tools together: add ordered blocks, each one a tool bound to one of that tool's saved presets, then run the whole chain on a single image — one block's output feeds the next block's input.

- Reorderable blocks (↑ / ↓ / ✕) — mix and match Palette Matcher and Pixelate in any order, any number of times
- Each block runs off a **named preset** you already saved in that tool (blocks don't use whatever's currently on-screen)
- Shows every intermediate step's result, not just the final one, so you can see what each block actually did
- The block list itself autosaves, same as everything else

### 🔤 Text Converter

Converts an image into text (ASCII art and the like): each pixel becomes the symbol you assigned to its closest palette color.

- Color → symbol table; symbols can be any text (`B`, `##`, an emoji). Copy the colors from any of Palette Matcher's 3 palettes (base / gray / foreground) and assign symbols to them
- Own symbol for transparent pixels
- Grid sliders (cols/rows, with grid-lock) or **1 symbol per pixel** (original image size, capped at 4M pixels); symbol per cell picked by majority vote or by averaging the cell
- Output shown in-app, copyable and downloadable as `.txt` (no separator, comma, space, tab or custom), `.csv` or `.json`
- Warns (never blocks) when two colors share a symbol, a symbol is empty, or a symbol is more than one character (emojis count as one)
- Drop several images or a folder to get one file per image in a `.zip`
- Named presets, same as the other tools — and usable as a block in Sequence, **only as the last block** (its output is text, so nothing can follow it; placing it earlier is flagged as an error and blocks the run)

### ➖ Subtract

Subtracts image B from image A (both exactly the same size) and returns a PNG with only what's different: wherever A's color differs from B's by more than a threshold, the pixel stays exactly as it is in A; everywhere else becomes transparent.

- Difference threshold measured in Lab ΔE, hard edges (each pixel is all-or-nothing)
- Cleanup: remove small islands, fill small holes
- Invert (keep what did *not* change), and optional crop to the remaining content
- Sizes must match exactly — otherwise it flags an error and won't run
- Folder mode: pick a folder of bases (A) and a folder to subtract (B); images are paired by file name and exported as one PNG each in a `.zip`, with unpaired / mismatched ones skipped and reported
- Named presets. Not available in Sequence, since it needs two images

## 🚀 Usage

1. Open `index.html` in your browser
2. Pick a tool from the tabs at the top (Palette Matcher / Pixelate / Sequence / Text Converter)
3. Configure it in the left panel — click a section header to collapse/expand it, double-click any slider to type an exact value
4. Drop an image (or a folder / video, in Palette Matcher) and process it
5. Save configurations as named presets in each tool — your last settings always autosave regardless, and named presets are what Sequence blocks run off of

## 📋 Requirements

- Modern browser with support for Web Workers, Canvas, and the FileReader API
- No installation or external dependencies required (all vanilla JS)

## 📝 License

Free to use and modify.

---

Made with 💜 by Meteori-K Media
