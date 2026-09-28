// Pixelate: reduce la imagen a un grid real de gridCols×gridRows pixeles (esa SÍ es
// la resolución final del pixel art, independiente del tamaño de la imagen original),
// un color plano por celda. El upscale (nearest-neighbor) es un paso aparte a cargo de
// pixelate-mode.js vía canvas — este archivo solo hace el downsample. Código puro
// (sin DOM), corre síncrono en el hilo principal: un solo paso barato, nada que ver
// con el costo de la segmentación de lineart.
(function(){
  const PM = self.PM = self.PM || {};
  const pixelate = PM.pixelate = {};
  const { rgbToLab, labDist2 } = PM.colorMath;

  function cellColor(data, w, x0, x1, y0, y1, method, threshold2){
    const bw = x1-x0, bh = y1-y0, n = bw*bh;
    const rs = new Array(n), gs = new Array(n), bs = new Array(n);
    let i = 0;
    for(let y=y0; y<y1; y++){
      for(let x=x0; x<x1; x++){
        const idx = (y*w+x)*4;
        rs[i]=data[idx]; gs[i]=data[idx+1]; bs[i]=data[idx+2];
        i++;
      }
    }
    if(method==='dominant' && n>1){
      const labs = new Array(n);
      for(let k=0;k<n;k++) labs[k] = rgbToLab(rs[k], gs[k], bs[k]);
      // brute-force: celdas son chiquitas en la práctica, así que O(n²) es trivial
      // — no hace falta clustering real.
      let bestSeed=0, bestCount=-1;
      for(let s=0;s<n;s++){
        let count=0;
        for(let k=0;k<n;k++) if(labDist2(labs[s], labs[k]) <= threshold2) count++;
        if(count>bestCount){ bestCount=count; bestSeed=s; }
      }
      let sr=0,sg=0,sb=0,cnt=0;
      for(let k=0;k<n;k++){
        if(labDist2(labs[bestSeed], labs[k]) <= threshold2){ sr+=rs[k]; sg+=gs[k]; sb+=bs[k]; cnt++; }
      }
      return [Math.round(sr/cnt), Math.round(sg/cnt), Math.round(sb/cnt)];
    }
    let sr=0,sg=0,sb=0;
    for(let k=0;k<n;k++){ sr+=rs[k]; sg+=gs[k]; sb+=bs[k]; }
    return [Math.round(sr/n), Math.round(sg/n), Math.round(sb/n)];
  }

  // reparte [0,total) en `count` buckets contiguos, casi iguales (mismo criterio que
  // un downsample nearest-neighbor estándar) — devuelve los `count+1` límites.
  function buildBounds(total, count){
    const bounds = new Array(count+1);
    for(let i=0;i<=count;i++) bounds[i] = Math.round(i*total/count);
    return bounds;
  }

  // srcImgData/w/h: la imagen original. opts: { gridCols, gridRows, method, thresholdDE }.
  // Devuelve un ImageData nuevo de gridCols×gridRows — esa es la resolución real del
  // pixel art; el upscale visual/de export es responsabilidad de quien llame esto.
  pixelate.buildSmallImageData = function(srcImgData, w, h, opts){
    const { gridCols, gridRows, method, thresholdDE } = opts;
    const data = srcImgData.data;
    const threshold2 = thresholdDE*thresholdDE;
    const xBounds = buildBounds(w, gridCols);
    const yBounds = buildBounds(h, gridRows);

    const out = new ImageData(gridCols, gridRows);
    const outData = out.data;

    for(let ry=0; ry<gridRows; ry++){
      const y0 = Math.min(yBounds[ry], h-1);
      const y1 = Math.min(Math.max(yBounds[ry+1], y0+1), h);
      for(let rx=0; rx<gridCols; rx++){
        const x0 = Math.min(xBounds[rx], w-1);
        const x1 = Math.min(Math.max(xBounds[rx+1], x0+1), w);
        const [r,g,b] = cellColor(data, w, x0, x1, y0, y1, method, threshold2);
        const oIdx = (ry*gridCols+rx)*4;
        outData[oIdx]=r; outData[oIdx+1]=g; outData[oIdx+2]=b; outData[oIdx+3]=255;
      }
    }
    return out;
  };

  // File -> File: downsample + upscale nearest-neighbor, todo vía canvas. Async porque
  // createImageBitmap/toBlob lo son — no hay DOM más allá de canvases al vuelo, así que
  // esto corre igual desde pixelate-mode.js (tab activo) que desde el tool Sequence
  // (headless, corriendo un preset de este tool sin que sea el tab activo).
  // opts: { gridCols, gridRows, method, thresholdDE, upscale }
  pixelate.runToFile = async function(file, opts){
    const bitmap = await createImageBitmap(file);
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = bitmap.width; srcCanvas.height = bitmap.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(bitmap, 0, 0);
    const srcImgData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height);

    const small = pixelate.buildSmallImageData(srcImgData, bitmap.width, bitmap.height, opts);
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = opts.gridCols; smallCanvas.height = opts.gridRows;
    smallCanvas.getContext('2d').putImageData(small, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = opts.gridCols * opts.upscale;
    outCanvas.height = opts.gridRows * opts.upscale;
    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(smallCanvas, 0, 0, opts.gridCols, opts.gridRows, 0, 0, outCanvas.width, outCanvas.height);

    const blob = await new Promise(res => outCanvas.toBlob(res, 'image/png'));
    return new File([blob], 'pixelated.png', { type:'image/png' });
  };
})();
