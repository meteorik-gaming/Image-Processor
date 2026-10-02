# Changelog

English | 🌐 [Versión en Español](CHANGELOG-ES.md)

All notable changes to this project are documented here.

## v1.3.3 — Sequence batch + Text Converter alpha threshold

- **Sequence** now has a folder (batch) mode: every image goes through all the
  blocks and you get one `.zip` per step, so any intermediate stage can be
  reviewed or reused. Images that fail are skipped and counted
- **Text Converter**: new transparency threshold slider (default 50%) — pixels
  with alpha below it count as transparent and use the transparent symbol. Saved
  in presets; older presets keep the previous 50% behavior

## v1.3.1 — Pixelate batch

- **Pixelate** now has a folder (batch) mode like the other tools: pick or drop a
  folder (subfolders respected), choose the output format (same as original, PNG
  or JPG) and download a `.zip` with the results, using the current settings

## v1.3 — Subtract

- New **Subtract** tool: subtracts image B from image A (same exact size) and
  exports a PNG with only the pixels that differ (Lab ΔE threshold, hard edges),
  everything else transparent. Island removal / hole filling, invert, crop to
  content, folder mode pairing images by file name into a `.zip`, named presets.
  Size mismatches are flagged as an error. Not available in Sequence

## v1.2 — Text Converter

- New **Text Converter** tool: turns an image into text (ASCII art) using a
  color → symbol table. Symbols can be any text; colors can be copied from any of
  Palette Matcher's 3 palettes. Output as `.txt` (optional separator), `.csv` or
  `.json`, copyable and downloadable, with a batch mode (multiple images / folder →
  `.zip`), a symbol for transparent pixels, named presets, and non-blocking
  warnings for duplicate, empty or multi-character symbols; optional 1 symbol per
  pixel mode. Also available in **Sequence**, but only as the last block (flagged as
  an error anywhere else)

## v1.1 — Image Processor

*Previously released and known as **Palette Matcher v1.0** (see below) — renamed
because the tool now covers more than palette matching. That history isn't going
away, it's just no longer the whole story.*

- **Renamed** Palette Matcher → Image Processor
- New **multi-tool shell**: tabs at the top to switch between tools, collapsible
  config sections so a tool's panel doesn't turn into a wall of sliders
- New **Pixelate** tool: downsamples an image to a real pixel-art grid
  (independent width/height, 30–120 cells), color per cell via plain average or
  dominant-color clustering in Lab space, nearest-neighbor upscale (1×–10×) for
  export, and can feed its result straight into Palette Matcher
- New **Sequence** tool: chain any tools together as ordered blocks, each bound
  to one of that tool's saved presets, and run the whole chain on one image
- **Named presets** are now available for every tool (previously only Palette
  Matcher had them)
- **Double-click any slider** across the whole app to type an exact value
  instead of dragging for it, clamped to that slider's range
- Pixelate: grid-lock checkbox to keep the grid square while dragging either
  slider

## Palette Matcher v1.0 (original release)

First official release. Previously developed under the internal codename "v7".

- Lab color matching, HSL ramps, multi-layer shadows/highlights
- Web Workers, feathering, batch processing, video mode
- Presets, HEX import/export, non-chained smoothing
