// Registry de tools que el tool Sequence puede encadenar. Cada entrada corre su tool
// de forma headless (sin que sea el tab activo) a partir de uno de sus PRESETS
// GUARDADOS — nunca de sliders en vivo, porque el bloque puede correr mientras ese
// tool ni siquiera está montado en pantalla. Fácil de extender: cuando se agregue un
// tool nuevo, solo hace falta una entrada más acá.
(function(){
  const PM = self.PM = self.PM || {};

  PM.pipelineTools = {
    pixelate: {
      label: 'Pixelate',
      listPresets: () => PM.presets.createStore('pixelate').listPresetNames(),
      run: async (file, presetName) => {
        const settings = PM.presets.createStore('pixelate').loadPreset(presetName);
        if(!settings) throw new Error(`Pixelate: no existe el preset "${presetName}"`);
        return PM.pixelate.runToFile(file, PM.pixelateUi.buildOpts(settings));
      }
    },
    palette: {
      label: 'Palette Matcher',
      listPresets: () => PM.presets.createStore('paletteMatcher').listPresetNames(),
      run: async (file, presetName) => {
        const settings = PM.presets.createStore('paletteMatcher').loadPreset(presetName);
        if(!settings) throw new Error(`Palette Matcher: no existe el preset "${presetName}"`);
        const opts = PM.ui.buildProcessOpts(settings, false);
        opts.outputMime = 'image/png';
        opts.outputQuality = 1;
        const result = await PM.workerPool.processFile(file, opts);
        return new File([result.blob], 'step.png', { type:'image/png' });
      }
    },
    // Tool "terminal": su salida es texto, no imagen, así que no puede alimentar a otro
    // bloque — solo puede ir al final. Se corre con runText en vez de run.
    textconv: {
      label: 'Text Converter',
      terminal: true,
      listPresets: () => PM.presets.createStore('textconv').listPresetNames(),
      runText: async (file, presetName) => {
        const settings = PM.presets.createStore('textconv').loadPreset(presetName);
        if(!settings) throw new Error(`Text Converter: no existe el preset "${presetName}"`);
        const { text } = await PM.textconv.fileToText(file, settings);
        const format = settings.format || 'txt';
        return { text, ext: PM.textconv.FORMAT_EXT[format] || 'txt', mime: PM.textconv.FORMAT_MIME[format] || 'text/plain' };
      }
    }
  };

  // Devuelve { index, message } por cada bloque mal puesto (un tool terminal que no es el
  // último), o [] si la secuencia es válida. Sequence lo usa para marcar error y no correr.
  PM.validateSequence = function(blocks){
    const errors = [];
    blocks.forEach((b, i)=>{
      const t = PM.pipelineTools[b.tool];
      if(t && t.terminal && i<blocks.length-1){
        errors.push({ index:i, message:`${t.label} produce texto, no una imagen: solo puede ir al final de la secuencia.` });
      }
    });
    return errors;
  };
})();
