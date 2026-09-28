# Changelog

🌐 [English version](CHANGELOG.md) | Español

Todos los cambios importantes del proyecto quedan documentados acá.

## v1.0 — Image Processor

*Anteriormente lanzado y conocido como **Palette Matcher v1.0** (ver abajo) —
renombrado porque la herramienta ya cubre más que solo matching de paletas.
Esa historia no se borra, solo dejó de ser toda la historia.*

- **Renombrado** Palette Matcher → Image Processor
- Nuevo **shell multi-tool**: pestañas arriba para cambiar de tool, secciones
  de configuración colapsables para que el panel de un tool no se vuelva una
  pared de sliders
- Nuevo tool **Pixelate**: reduce la imagen a un grid real de pixel art (ancho
  y alto independientes, 30–120 celdas), color por celda vía promedio simple o
  color dominante por clustering en espacio Lab, upscale nearest-neighbor
  (1×–10×) para exportar, y puede mandar su resultado directo a Palette
  Matcher
- Nuevo tool **Sequence**: encadena cualquier combinación de tools como
  bloques ordenados, cada uno atado a uno de los presets guardados de ese
  tool, y corre la cadena completa sobre una imagen
- **Presets nombrados** disponibles ahora en todos los tools (antes solo
  Palette Matcher los tenía)
- **Doble click en cualquier slider** de toda la app para escribir un valor
  exacto en vez de arrastrar para encontrarlo, clamped al rango del slider
- Pixelate: checkbox de grid-lock para mantener el grid cuadrado al arrastrar
  cualquiera de los dos sliders

## Palette Matcher v1.0 (release original)

Primer release oficial. Anteriormente desarrollado bajo el codename interno "v7".

- Matching de color en Lab, ramps HSL, sombras/brillos multicapa
- Web Workers, feathering, batch processing, modo video
- Presets, import/export de HEX, suavizado no encadenado
