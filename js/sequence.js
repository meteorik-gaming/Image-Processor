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
    }
  };
})();
