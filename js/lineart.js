// v6/v7: detección de lineart (tinta) por ángulo de hue + recoloreo de foreground por sección.
// Código puro (sin DOM) — corre igual en el hilo principal o dentro de un worker.
(function(){
  const PM = self.PM = self.PM || {};
  const lineart = PM.lineart = {};
  // Nota: nunca destructurar funciones de PM.colorMath acá arriba (ej. `const {rgbToLab} = ...`).
  // Este archivo se serializa function-por-function dentro de worker-pool.js para armar el
  // worker; cualquier función que dependa de una closure local (en vez de `PM.colorMath.xxx`
  // completo) se rompe al reensamblarse ahí, porque esa closure no existe en el bundle.

  lineart.INK_ACHROMATIC_CHROMA2 = 16; // ~chroma magnitud 4 en Lab a,b — debajo de esto el ángulo de hue es ruido

  lineart.nearestShadeByL = function(shades, pixelL){
    let best=-1, bestD=Infinity;
    for(let i=0;i<shades.length;i++){
      const d = Math.abs(pixelL-shades[i].L);
      if(d<bestD){ bestD=d; best=i; }
    }
    return shades[best].rgb;
  };

  lineart.buildSAT = function(mask, w, h){
    const W = w+1;
    const sat = new Int32Array(W*(h+1));
    for(let y=0;y<h;y++){
      let rowsum = 0;
      for(let x=0;x<w;x++){
        rowsum += mask[y*w+x];
        sat[(y+1)*W+(x+1)] = sat[y*W+(x+1)] + rowsum;
      }
    }
    return sat;
  };

  lineart.boxSum = function(sat, w, h, x0, y0, x1, y1){
    x0 = Math.max(0,x0); y0 = Math.max(0,y0); x1 = Math.min(w-1,x1); y1 = Math.min(h-1,y1);
    if(x1<x0 || y1<y0) return 0;
    const W = w+1;
    return sat[(y1+1)*W+(x1+1)] - sat[y0*W+(x1+1)] - sat[(y1+1)*W+x0] + sat[y0*W+x0];
  };

  lineart.computeInkMask = function(labCache, w, h, grayPaletteFull, inkDarkN, inkHueThresh, inkMaxL){
    const refsAll = grayPaletteFull.map(c=>PM.colorMath.rgbToLab(c[0],c[1],c[2]));
    refsAll.sort((a,b)=>a[0]-b[0]);
    const refs = refsAll.slice(0, Math.min(inkDarkN, refsAll.length)).map(lab=>{
      const chroma2 = lab[1]*lab[1]+lab[2]*lab[2];
      return { chroma2, angle: Math.atan2(lab[2], lab[1]) };
    });
    const mask = new Uint8Array(w*h);
    const angleThreshRad = (inkHueThresh * 1.8) * Math.PI/180;
    for(let p=0;p<w*h;p++){
      const lab = labCache[p];
      const chroma2 = lab[1]*lab[1]+lab[2]*lab[2];
      const achromatic = chroma2 < lineart.INK_ACHROMATIC_CHROMA2;
      const angle = Math.atan2(lab[2], lab[1]);
      let matched = false;
      for(let i=0;i<refs.length;i++){
        if(achromatic || refs[i].chroma2 < lineart.INK_ACHROMATIC_CHROMA2){ matched = true; break; }
        let diff = Math.abs(angle - refs[i].angle);
        if(diff > Math.PI) diff = 2*Math.PI - diff;
        if(diff <= angleThreshRad){ matched = true; break; }
      }
      mask[p] = (matched && lab[0]<=inkMaxL) ? 1 : 0;
    }
    return mask;
  };

  lineart.refineInkMask = function(mask, w, h, radiusPx, solidRejectPct, gapClosePct){
    const sat1 = lineart.buildSAT(mask, w, h);
    const mask2 = mask.slice();
    const rejectedAsSolid = new Uint8Array(w*h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x;
        if(!mask[p]) continue;
        const x0=x-radiusPx, x1=x+radiusPx, y0=y-radiusPx, y1=y+radiusPx;
        const cx0=Math.max(0,x0), cx1=Math.min(w-1,x1), cy0=Math.max(0,y0), cy1=Math.min(h-1,y1);
        const area = (cx1-cx0+1)*(cy1-cy0+1);
        const inkSum = lineart.boxSum(sat1,w,h,x0,y0,x1,y1);
        const nonInkFrac = (area-inkSum)/area;
        if(nonInkFrac < solidRejectPct/100){ mask2[p] = 0; rejectedAsSolid[p] = 1; }
      }
    }
    // Preservar un borde delgado: un pixel descartado por "relleno sólido" que sea vecino
    // directo de un pixel que NUNCA fue candidato a tinta se mantiene como tinta. Sin esto,
    // un cruce denso de varias líneas (ej. donde converge el nudo de una bandana) se
    // descarta entero por parecer relleno sólido, y dos secciones que deberían quedar
    // separadas terminan fusionadas en una sola región por ese hueco.
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x;
        if(!rejectedAsSolid[p]) continue;
        let bordersRealFill = false;
        for(let dy=-1; dy<=1 && !bordersRealFill; dy++){
          for(let dx=-1; dx<=1; dx++){
            if(dx===0 && dy===0) continue;
            const nx=x+dx, ny=y+dy;
            if(nx<0||nx>=w||ny<0||ny>=h) continue;
            if(!mask[ny*w+nx]){ bordersRealFill = true; break; }
          }
        }
        if(bordersRealFill) mask2[p] = 1;
      }
    }
    const sat2 = lineart.buildSAT(mask2, w, h);
    const mask3 = mask2.slice();
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x;
        if(mask2[p]) continue;
        const x0=x-radiusPx, x1=x+radiusPx, y0=y-radiusPx, y1=y+radiusPx;
        const cx0=Math.max(0,x0), cx1=Math.min(w-1,x1), cy0=Math.max(0,y0), cy1=Math.min(h-1,y1);
        const area = (cx1-cx0+1)*(cy1-cy0+1);
        const inkSum = lineart.boxSum(sat2,w,h,x0,y0,x1,y1);
        const inkFrac = inkSum/area;
        if(inkFrac >= gapClosePct/100) mask3[p] = 1;
      }
    }
    return mask3;
  };

  // Etiquetado 4-conectividad (BFS) de los pixeles que NO son tinta. Los pixeles de tinta quedan en -1.
  lineart.labelRegions = function(mask, w, h){
    const labels = new Int32Array(w*h).fill(-1);
    const queue = new Int32Array(w*h);
    let nextLabel = 0;
    const touchesBorder = [];
    const areaOf = [];
    for(let start=0; start<w*h; start++){
      if(mask[start] || labels[start]!==-1) continue;
      let qHead=0, qTail=0, area=0, border=false;
      queue[qTail++] = start; labels[start] = nextLabel;
      while(qHead<qTail){
        const cur = queue[qHead++];
        const cx = cur % w, cy = (cur / w) | 0;
        area++;
        if(cx===0 || cy===0 || cx===w-1 || cy===h-1) border = true;
        const tryPush = (nx,ny)=>{
          if(nx<0||nx>=w||ny<0||ny>=h) return;
          const np = ny*w+nx;
          if(!mask[np] && labels[np]===-1){ labels[np]=nextLabel; queue[qTail++]=np; }
        };
        tryPush(cx-1,cy); tryPush(cx+1,cy); tryPush(cx,cy-1); tryPush(cx,cy+1);
      }
      touchesBorder.push(border); areaOf.push(area);
      nextLabel++;
    }
    return { labels, numRegions: nextLabel, touchesBorder, areaOf };
  };

  // Adyacencia entre regiones "a través" de la tinta: para cada pixel de tinta, mira en un
  // radio chico a su alrededor qué regiones no-tinta aparecen cerca — si aparece más de una,
  // esas regiones se consideran vecinas (aunque las separe una línea). Solo mira alrededor de
  // pixeles de tinta (normalmente una fracción chica de la imagen), así que es barato.
  lineart.buildRegionAdjacency = function(labels, mask, w, h, numRegions){
    const ADJ_RADIUS = 2;
    const adjacent = Array.from({length:numRegions}, ()=> new Set());
    const seen = new Set();
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x;
        if(!mask[p]) continue;
        seen.clear();
        for(let dy=-ADJ_RADIUS; dy<=ADJ_RADIUS; dy++){
          for(let dx=-ADJ_RADIUS; dx<=ADJ_RADIUS; dx++){
            const nx=x+dx, ny=y+dy;
            if(nx<0||nx>=w||ny<0||ny>=h) continue;
            const np = ny*w+nx;
            if(mask[np]) continue;
            const r = labels[np];
            if(r>=0) seen.add(r);
          }
        }
        if(seen.size>1){
          const arr = Array.from(seen);
          for(let i=0;i<arr.length;i++){
            for(let j=i+1;j<arr.length;j++){
              adjacent[arr[i]].add(arr[j]);
              adjacent[arr[j]].add(arr[i]);
            }
          }
        }
      }
    }
    return adjacent;
  };

  // Compartido por el pase de recoloreo y la vista de debug, para que ambos reflejen
  // exactamente la misma detección.
  lineart.computeLineartSegmentation = function(labCache, w, h, opts){
    const { grayPaletteFull, inkDarkN, inkHueThresh, inkMaxL, inkRadius, solidReject, gapClose } = opts;
    // rawMask: candidato a tinta por color/luminosidad, ANTES de solidReject/gapClose.
    // Se conserva aparte (refineInkMask no muta su entrada) para poder mostrar en debug
    // qué pixeles "parecían" tinta pero el refinamiento descartó (ej. relleno sólido oscuro).
    const rawMask = lineart.computeInkMask(labCache, w, h, grayPaletteFull, inkDarkN, inkHueThresh, inkMaxL);
    const mask = lineart.refineInkMask(rawMask, w, h, inkRadius, solidReject, gapClose);
    const { labels, numRegions, touchesBorder, areaOf } = lineart.labelRegions(mask, w, h);
    return { mask, rawMask, labels, numRegions, touchesBorder, areaOf };
  };

  // Clasificador de regiones compartido por el pase de recoloreo y la vista de debug,
  // para que ambos coincidan siempre en qué regiones califican como foreground.
  lineart.classifyRegions = function(labCache, seg, opts, w, h){
    const { fg, bgFamilyAB, maxRegionAreaPct, familySep, maxFamPerRegion } = opts;
    const { labels, numRegions, touchesBorder, areaOf } = seg;
    const n = labCache.length;
    const maxArea = (maxRegionAreaPct/100) * n;
    const sepThresh = familySep * 20;

    const eligible = new Uint8Array(numRegions);
    for(let r=0; r<numRegions; r++) eligible[r] = (!touchesBorder[r] && areaOf[r]<=maxArea && areaOf[r]>=9) ? 1 : 0;

    const perRegion = new Array(numRegions).fill(null);
    const pixelsByRegion = Array.from({length:numRegions}, ()=>[]);
    if(fg.numFamilies===0) return { perRegion, pixelsByRegion };

    // "Rodeada" (landlocked): para cada región elegible, mira sus vecinas (a través de la
    // tinta) y agrúpalas por color parecido (mismo umbral que familySep). Si el número de
    // grupos de color distintos entre las vecinas es bajo, esta sección probablemente está
    // embebida dentro de un solo material continuo (un hueco real en la pose) en vez de ser
    // una prenda/accesorio genuino — que normalmente colinda con varias cosas distintas.
    // Se cuenta por color, no por región cruda: un brazo con brazalete son 3 regiones pero
    // solo 2 colores (piel arriba y abajo del brazalete cuentan como el mismo vecino).
    let adjacency = null, allSumA = null, allSumB = null, allCnt = null;
    if(opts.landlockedEnabled){
      adjacency = lineart.buildRegionAdjacency(labels, seg.mask, w, h, numRegions);
      allSumA = new Float64Array(numRegions); allSumB = new Float64Array(numRegions); allCnt = new Int32Array(numRegions);
      for(let p=0; p<n; p++){
        const r = labels[p];
        if(r<0) continue;
        const lab = labCache[p];
        allSumA[r]+=lab[1]; allSumB[r]+=lab[2]; allCnt[r]++;
      }
    }

    // Colores REALES de fondo de esta imagen: la media (a,b) de CADA región que toca el
    // borde por separado (cielo, montaña, piso... pueden ser varias y bien distintas entre
    // sí) — para el chequeo opcional "se parece al fondo real muestreado". Comparar contra
    // cada una por separado y quedarse con la más cercana evita el problema de promediarlas
    // todas juntas: un fondo con cielo Y montaña de colores distintos daría un promedio que
    // no se parece a ninguno de los dos de verdad.
    let realBgList = null;
    if(opts.excludeRealBackgroundMatches){
      const bgSumA = new Float64Array(numRegions), bgSumB = new Float64Array(numRegions), bgCnt = new Int32Array(numRegions);
      for(let p=0; p<n; p++){
        const r = labels[p];
        if(r>=0 && touchesBorder[r]){ const lab = labCache[p]; bgSumA[r]+=lab[1]; bgSumB[r]+=lab[2]; bgCnt[r]++; }
      }
      realBgList = [];
      for(let r=0; r<numRegions; r++){
        if(touchesBorder[r] && bgCnt[r] >= 9) realBgList.push([bgSumA[r]/bgCnt[r], bgSumB[r]/bgCnt[r]]);
      }
    }

    const tally = Array.from({length:numRegions}, ()=> new Float64Array(fg.numFamilies));
    const sumA = new Float64Array(numRegions), sumB = new Float64Array(numRegions), cnt = new Int32Array(numRegions);

    for(let p=0; p<n; p++){
      const r = labels[p];
      if(r<0 || !eligible[r]) continue;
      const lab = labCache[p];
      pixelsByRegion[r].push(p);
      sumA[r]+=lab[1]; sumB[r]+=lab[2]; cnt[r]++;
      let bestF=-1, bestD=Infinity;
      for(let f=0; f<fg.numFamilies; f++){
        const da=lab[1]-fg.familyAB[f][0], db=lab[2]-fg.familyAB[f][1];
        const d = da*da+db*db;
        if(d<bestD){ bestD=d; bestF=f; }
      }
      tally[r][bestF]++;
    }

    for(let r=0; r<numRegions; r++){
      if(!eligible[r] || cnt[r]===0) continue;
      const meanA = sumA[r]/cnt[r], meanB = sumB[r]/cnt[r];

      const meanChroma2 = meanA*meanA + meanB*meanB;
      const isChromatic = meanChroma2 >= lineart.INK_ACHROMATIC_CHROMA2;
      const hasRealBg = realBgList && realBgList.length>0;
      if(isChromatic && (!opts.skipBackgroundCheck || hasRealBg)){
        let fgBestDist = Infinity;
        for(let i=0;i<fg.familyAB.length;i++){
          const da=meanA-fg.familyAB[i][0], db=meanB-fg.familyAB[i][1];
          const d = da*da+db*db;
          if(d<fgBestDist) fgBestDist = d;
        }
        if(!opts.skipBackgroundCheck){
          let bgBestDist = Infinity;
          for(let i=0;i<bgFamilyAB.length;i++){
            const da=meanA-bgFamilyAB[i][0], db=meanB-bgFamilyAB[i][1];
            const d = da*da+db*db;
            if(d<bgBestDist) bgBestDist = d;
          }
          if(bgBestDist < fgBestDist) continue;
        }
        if(hasRealBg){
          let realBgBestDist = Infinity;
          for(const [ra,rb] of realBgList){
            const da=meanA-ra, db=meanB-rb;
            const d = da*da+db*db;
            if(d<realBgBestDist) realBgBestDist = d;
          }
          if(realBgBestDist < fgBestDist) continue;
        }
      }

      if(opts.landlockedEnabled){
        const neighborGroups = [];
        for(const nr of adjacency[r]){
          if(allCnt[nr]===0) continue;
          const na = allSumA[nr]/allCnt[nr], nb = allSumB[nr]/allCnt[nr];
          let matched = false;
          for(const g of neighborGroups){
            const da=na-g.a, db=nb-g.b;
            if(da*da+db*db <= sepThresh){ g.a=(g.a*g.n+na)/(g.n+1); g.b=(g.b*g.n+nb)/(g.n+1); g.n++; matched=true; break; }
          }
          if(!matched) neighborGroups.push({ a:na, b:nb, n:1 });
        }
        if(neighborGroups.length>0 && neighborGroups.length<=opts.landlockedMaxColors) continue;
      }

      const ranked = Array.from({length:fg.numFamilies}, (_,f)=>f).filter(f=>tally[r][f]>0).sort((a,b)=>tally[r][b]-tally[r][a]);
      const survivors = [];
      for(const f of ranked){
        if(survivors.length===0){ survivors.push(f); continue; }
        if(survivors.length>=maxFamPerRegion) break;
        const farEnough = survivors.every(s => fg.pairDist[f][s] > sepThresh);
        if(farEnough) survivors.push(f);
      }
      if(survivors.length===0) continue;
      perRegion[r] = { survivors };
    }
    return { perRegion, pixelsByRegion };
  };

  // Aplica el recoloreo de foreground sobre outImgData (que ya trae el resultado del
  // matching principal) usando siempre origImgData (pristina) para clasificar.
  // Devuelve además `idPerPixel`: -1 tinta, -2 sin tocar, f>=0 familia foreground asignada —
  // lo usa feathering.js para saber dónde hay un borde real de lineart/sección.
  lineart.applyLineartForeground = function(origImgData, outImgData, w, h, opts){
    const { grayPaletteFull, fg } = opts;
    const src = origImgData.data;
    const data = outImgData.data;
    const n = w*h;
    const labCache = new Array(n);
    for(let p=0,i=0; p<n; p++,i+=4) labCache[p] = PM.colorMath.rgbToLab(src[i],src[i+1],src[i+2]);

    const seg = lineart.computeLineartSegmentation(labCache, w, h, opts);
    const { mask } = seg;
    const idPerPixel = new Int16Array(n).fill(-2);

    const grayLumFull = grayPaletteFull.map(c=>PM.colorMath.rgbToLab(c[0],c[1],c[2])[0]);
    for(let p=0,i=0; p<n; p++,i+=4){
      if(mask[p]){
        const nc = PM.matching.nearestByLuminance(labCache[p][0], grayLumFull, grayPaletteFull);
        data[i]=nc[0]; data[i+1]=nc[1]; data[i+2]=nc[2];
        idPerPixel[p] = -1;
      }
    }

    const { perRegion, pixelsByRegion } = lineart.classifyRegions(labCache, seg, opts, w, h);

    for(let r=0; r<seg.numRegions; r++){
      const cls = perRegion[r];
      if(!cls) continue;
      for(const p of pixelsByRegion[r]){
        const lab = labCache[p];
        let bestS=cls.survivors[0], bestD=Infinity;
        for(const s of cls.survivors){
          const da=lab[1]-fg.familyAB[s][0], db=lab[2]-fg.familyAB[s][1];
          const d = da*da+db*db;
          if(d<bestD){ bestD=d; bestS=s; }
        }
        const nc = lineart.nearestShadeByL(fg.familyShades[bestS], lab[0]);
        const i = p*4;
        data[i]=nc[0]; data[i+1]=nc[1]; data[i+2]=nc[2];
        idPerPixel[p] = bestS;
      }
    }
    return { imgData: outImgData, seg, perRegion, idPerPixel };
  };

  // Color pseudoaleatorio determinístico por id de FAMILIA (no de región), vía rotación de
  // hue en ángulo dorado. Clave para el debug view: dos regiones distintas que hayan caído
  // en la misma familia foreground salen exactamente del mismo color, así se ve a simple
  // vista si el classifier está "fusionando" secciones de una misma prenda o no.
  lineart.familyDebugColor = function(familyIndex){
    const hue = ((familyIndex*137.508) % 360) / 360;
    return PM.colorMath.hslToRgb(hue, 0.65, 0.55);
  };

  // Visualización de la segmentación: color por FAMILIA asignada (no por región) para las
  // secciones recoloreadas, gris apagado para fondo/excluida/rechazada, blanco para tinta,
  // y gris MUY claro para pixeles que el detector inicial marcó como candidato a tinta
  // (oscuros/de hue compatible) pero que el refinamiento (solidReject/gapClose) descartó
  // por no ser línea real (ej. un relleno sólido oscuro). Pinta pixel por pixel directo
  // desde idPerPixel — el mismo dato que ya usó el recoloreo real — así lo que se ve acá es
  // exactamente lo que pasó, incluso cuando maxFamPerRegion>1 y una misma región termina
  // con más de una familia adentro.
  lineart.buildSegmentationDebugImage = function(origImgData, w, h, idPerPixel, rawInkMask){
    const n = w*h;
    const od = new Uint8ClampedArray(n*4);
    const src = origImgData.data;
    for(let p=0, i=0; p<n; p++, i+=4){
      const id = idPerPixel[p];
      if(id === -1){ // tinta final
        od[i]=255; od[i+1]=255; od[i+2]=255; od[i+3]=255;
      } else if(id >= 0){ // familia foreground realmente asignada a este pixel
        const c = lineart.familyDebugColor(id);
        od[i]=c[0]; od[i+1]=c[1]; od[i+2]=c[2]; od[i+3]=255;
      } else if(rawInkMask && rawInkMask[p]){ // parecía tinta, el refinamiento lo descartó
        od[i]=0; od[i+1]=0; od[i+2]=0; od[i+3]=255;
      } else { // nunca pareció tinta — fondo / excluida / rechazada, dejada intacta
        const g = (src[i]*0.299 + src[i+1]*0.587 + src[i+2]*0.114) * 0.4 + 40;
        od[i]=g; od[i+1]=g; od[i+2]=g; od[i+3]=255;
      }
    }
    return od; // Uint8ClampedArray RGBA plano — el caller decide si envolverlo en ImageData
  };

  // Overlay de diagnóstico "general": para CADA pixel que no sea tinta, muestra a qué familia
  // foreground le quedaría más cerca por chroma — ignorando por completo los filtros de
  // elegibilidad de región (toca el borde, excede el área máxima, o perdió el chequeo
  // fondo-vs-foreground). Útil para ver qué "quería" pasar antes de que cualquier filtro lo
  // descartara, sin tener que desactivar esos filtros de verdad.
  lineart.buildNearestFamilyOverlay = function(origImgData, w, h, fg, finalInkMask){
    const n = w*h;
    const src = origImgData.data;
    const od = new Uint8ClampedArray(n*4);
    for(let p=0, i=0; p<n; p++, i+=4){
      if(finalInkMask[p]){
        od[i]=255; od[i+1]=255; od[i+2]=255; od[i+3]=255;
        continue;
      }
      if(fg.numFamilies===0){
        od[i]=40; od[i+1]=40; od[i+2]=40; od[i+3]=255;
        continue;
      }
      const lab = PM.colorMath.rgbToLab(src[i],src[i+1],src[i+2]);
      let bestF=-1, bestD=Infinity;
      for(let f=0; f<fg.numFamilies; f++){
        const da=lab[1]-fg.familyAB[f][0], db=lab[2]-fg.familyAB[f][1];
        const d = da*da+db*db;
        if(d<bestD){ bestD=d; bestF=f; }
      }
      const c = lineart.familyDebugColor(bestF);
      od[i]=c[0]; od[i+1]=c[1]; od[i+2]=c[2]; od[i+3]=255;
    }
    return od;
  };
})();
