// Orquesta matching + lineart/foreground + feathering en una sola función pura.
// Este es el único punto de entrada que llaman tanto el worker como el fallback
// de hilo principal — así el resultado es idéntico sin importar dónde corra.
(function(){
  const PM = self.PM = self.PM || {};
  const pipeline = PM.pipeline = {};

  // origImgData: ImageData pristina de origen, nunca se muta.
  // opts: el objeto que hoy arma currentProcessOpts() en ui.js, más:
  //   includeDebug (bool), featherGeneralEnabled, featherLineartEnabled, featherRadius, featherStrengthPct
  pipeline.runPipeline = function(origImgData, w, h, opts){
    let imgData = new ImageData(new Uint8ClampedArray(origImgData.data), w, h);

    const matchResult = PM.matching.processImageData(imgData, w, h, opts);
    imgData = matchResult.imgData;

    let lineartResult = null;
    let debugData = null;
    let debugDataGeneral = null;
    if(opts.lineartEnabled){
      lineartResult = PM.lineart.applyLineartForeground(origImgData, imgData, w, h, opts.lineartOpts);
      imgData = lineartResult.imgData;
      if(opts.includeDebug){
        debugData = PM.lineart.buildSegmentationDebugImage(origImgData, w, h, lineartResult.idPerPixel, lineartResult.seg.rawMask);
        debugDataGeneral = PM.lineart.buildNearestFamilyOverlay(origImgData, w, h, opts.lineartOpts.fg, lineartResult.seg.mask);
      }
    }

    if(opts.featherGeneralEnabled && matchResult.familyPerPixel){
      // "general" tiene que reflejar la agrupación FINAL de cada pixel. Si lineart tocó un
      // pixel (tinta o sección recoloreada), su id real ya no es el family del matching
      // principal sino el de lineart — si no corrigiéramos esto, se blendearía el color ya
      // recoloreado usando fronteras viejas que ya no existen.
      let idMap = matchResult.familyPerPixel;
      if(lineartResult && lineartResult.idPerPixel){
        idMap = idMap.slice();
        for(let p=0;p<idMap.length;p++){
          if(lineartResult.idPerPixel[p] !== -2) idMap[p] = 10000 + lineartResult.idPerPixel[p];
        }
      }
      PM.feathering.applyEdgeFeather(imgData.data, w, h, idMap, opts.featherRadius, opts.featherStrengthPct);
    }
    if(opts.featherLineartEnabled && lineartResult && lineartResult.idPerPixel){
      PM.feathering.applyEdgeFeather(imgData.data, w, h, lineartResult.idPerPixel, opts.featherRadius, opts.featherStrengthPct);
    }

    return {
      imgData,
      debugData,
      debugDataGeneral,
      numRegions: lineartResult ? lineartResult.seg.numRegions : 0,
      paletteSize: opts.palette.length
    };
  };
})();
