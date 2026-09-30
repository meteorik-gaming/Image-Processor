// Subtract: resta la imagen B de la imagen A (mismo tamaño exacto). Donde el color de A y
// el de B difiere más que el umbral (distancia en Lab), el pixel se queda tal cual está en
// A; donde son casi iguales, queda transparente. Código puro (sin DOM salvo canvases al
// vuelo), síncrono en el hilo principal. No es un tool de Sequence: necesita dos imágenes.
(function(){
  const PM = self.PM = self.PM || {};
  const subtract = PM.subtract = {};
  const { rgbToLab, labDist2 } = PM.colorMath;

  const ALPHA_CUTOFF = 128;
  const LAB_CACHE_MAX = 1<<19;

  subtract.imageDataFromFile = async function(file){
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    if(bitmap.close) bitmap.close();
    return data;
  };

  subtract.sizeMessage = function(a, b){
    return `Las imágenes no tienen el mismo tamaño: A es ${a.width}×${a.height} px y B es ${b.width}×${b.height} px.`;
  };

  // Componentes conectados (4 vecinos) de `mask` con valor `value` y tamaño < minSize: si
  // canFlip(...) lo permite para TODOS sus pixeles, se voltean al valor contrario.
  function flipSmallComponents(mask, w, h, value, minSize, canFlip){
    if(minSize<=1) return;
    const n = w*h;
    const visited = new Uint8Array(n);
    const queue = new Int32Array(n);
    for(let start=0; start<n; start++){
      if(visited[start] || mask[start]!==value) continue;
      let head = 0, tail = 0, allowed = true;
      queue[tail++] = start; visited[start] = 1;
      while(head<tail){
        const idx = queue[head++];
        if(canFlip && !canFlip(idx)) allowed = false;
        const x = idx % w, y = (idx - x) / w;
        if(x>0){ const j=idx-1; if(!visited[j] && mask[j]===value){ visited[j]=1; queue[tail++]=j; } }
        if(x<w-1){ const j=idx+1; if(!visited[j] && mask[j]===value){ visited[j]=1; queue[tail++]=j; } }
        if(y>0){ const j=idx-w; if(!visited[j] && mask[j]===value){ visited[j]=1; queue[tail++]=j; } }
        if(y<h-1){ const j=idx+w; if(!visited[j] && mask[j]===value){ visited[j]=1; queue[tail++]=j; } }
      }
      if(tail<minSize && allowed){
        for(let k=0;k<tail;k++) mask[queue[k]] = 1-value;
      }
    }
  }

  // a, b: ImageData del mismo tamaño. settings: { threshold, minIsland, fillHoles, invert, crop }.
  // Devuelve { imageData, kept, total, cropped } — imageData es el PNG a exportar.
  subtract.compute = function(a, b, settings){
    const w = a.width, h = a.height, n = w*h;
    const ad = a.data, bd = b.data;
    const t2 = settings.threshold*settings.threshold;
    const invert = !!settings.invert;

    const keep = new Uint8Array(n);   // 1 = el pixel se queda
    const opaque = new Uint8Array(n); // 1 = A tiene algo ahí (si no, nunca puede quedarse)
    const labCache = new Map();
    function labOf(r,g,bl){
      const key = (r<<16)|(g<<8)|bl;
      let lab = labCache.get(key);
      if(lab===undefined){
        lab = rgbToLab(r,g,bl);
        if(labCache.size<LAB_CACHE_MAX) labCache.set(key, lab);
      }
      return lab;
    }

    for(let i=0;i<n;i++){
      const p = i*4;
      if(ad[p+3]<ALPHA_CUTOFF) continue;
      opaque[i] = 1;
      let differs;
      if(bd[p+3]<ALPHA_CUTOFF) differs = true;
      else if(ad[p]===bd[p] && ad[p+1]===bd[p+1] && ad[p+2]===bd[p+2]) differs = false;
      else differs = labDist2(labOf(ad[p],ad[p+1],ad[p+2]), labOf(bd[p],bd[p+1],bd[p+2])) > t2;
      keep[i] = (differs !== invert) ? 1 : 0;
    }

    // limpieza: primero islas sueltas de lo que se queda, luego huecos chicos dentro de ello
    flipSmallComponents(keep, w, h, 1, settings.minIsland|0, null);
    flipSmallComponents(keep, w, h, 0, settings.fillHoles|0, idx=>opaque[idx]===1);

    let kept = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for(let i=0;i<n;i++){
      if(!keep[i]) continue;
      kept++;
      const x = i % w, y = (i - x) / w;
      if(x<x0) x0 = x; if(x>x1) x1 = x;
      if(y<y0) y0 = y; if(y>y1) y1 = y;
    }

    const cropped = !!settings.crop && kept>0;
    const ox = cropped ? x0 : 0, oy = cropped ? y0 : 0;
    const ow = cropped ? x1-x0+1 : w, oh = cropped ? y1-y0+1 : h;
    const out = new ImageData(ow, oh);
    const od = out.data;
    for(let y=0;y<oh;y++){
      for(let x=0;x<ow;x++){
        const src = (y+oy)*w + (x+ox);
        if(!keep[src]) continue;
        const p = src*4, q = (y*ow+x)*4;
        od[q]=ad[p]; od[q+1]=ad[p+1]; od[q+2]=ad[p+2]; od[q+3]=ad[p+3];
      }
    }
    return { imageData: out, kept, total: n, cropped };
  };

  subtract.imageDataToBlob = function(imageData){
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width; canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    return new Promise(res=>canvas.toBlob(res, 'image/png'));
  };

  // File A, File B -> resultado de compute. Lanza Error (con .code='size') si los tamaños
  // no coinciden exactamente.
  subtract.run = async function(fileA, fileB, settings){
    const [a, b] = await Promise.all([subtract.imageDataFromFile(fileA), subtract.imageDataFromFile(fileB)]);
    if(a.width!==b.width || a.height!==b.height){
      const err = new Error(subtract.sizeMessage(a, b));
      err.code = 'size';
      throw err;
    }
    return subtract.compute(a, b, settings);
  };
})();
