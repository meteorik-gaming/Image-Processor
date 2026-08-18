// Matching de color en espacio Lab (por familia), suavizado "no encadenado" (mayoría de
// vecinos contra un snapshot de la pasada anterior, evita manchas direccionales) y dithering
// Floyd–Steinberg como alternativa independiente.
// Código puro (sin DOM) — corre igual en el hilo principal o dentro de un worker.
// worker-pool.js reconstruye este archivo tal cual dentro del worker (ver ese módulo),
// así que todo acceso cruzado debe pasar por `PM.*`, nunca por variables locales de otro archivo.
(function(){
  const PM = self.PM = self.PM || {};
  const matching = PM.matching = {};

  matching.NEIGHBORS_4 = [[-1,0],[1,0],[0,-1],[0,1]];
  matching.NEIGHBORS_8 = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];

  matching.nearestByLuminance = function(pixelL, grayLumArr, grayPalette){
    let best=-1, bestDist=Infinity;
    for(let i=0;i<grayLumArr.length;i++){
      const d = Math.abs(pixelL-grayLumArr[i]);
      if(d<bestDist){ bestDist=d; best=i; }
    }
    return grayPalette[best];
  };

  matching.nearestWithFamilyLab = function(lab, palette, labPalette, family, numFamilies, famMinBuf, famColBuf){
    for(let f=0; f<numFamilies; f++) famMinBuf[f]=Infinity;
    for(let i=0;i<labPalette.length;i++){
      const d = PM.colorMath.labDist2(lab, labPalette[i]);
      const f = family[i];
      if(d<famMinBuf[f]){ famMinBuf[f]=d; famColBuf[f]=palette[i]; }
    }
    let bestF=-1, bestD=Infinity, secondF=-1, secondD=Infinity;
    for(let f=0; f<numFamilies; f++){
      const d = famMinBuf[f];
      if(d<bestD){ secondD=bestD; secondF=bestF; bestD=d; bestF=f; }
      else if(d<secondD){ secondD=d; secondF=f; }
    }
    const ambiguity = bestD<=0.0001 ? 999 : (secondD-bestD)/bestD;
    return { color: famColBuf[bestF], family: bestF, altColor: famColBuf[secondF]||famColBuf[bestF], altFamily: secondF, ambiguity };
  };

  // opts: { palette, labPalette, family, numFamilies, grayPalette, grayLum, grayEnabled,
  //         graySatThresh, forceGrayscale, useDither, smoothEnabled, smoothThreshPct,
  //         neighborMode, passes }
  matching.processImageData = function(imgData, w, h, opts){
    const data = imgData.data;
    const { palette, labPalette, family, numFamilies, grayPalette, grayLum, grayEnabled, graySatThresh, forceGrayscale,
            useDither, smoothEnabled, smoothThreshPct, neighborMode, passes } = opts;
    const famMinBuf = new Float64Array(numFamilies);
    const famColBuf = new Array(numFamilies);

    const pickColor = (r,g,b) => {
      if(grayPalette.length && (forceGrayscale || (grayEnabled && PM.colorMath.saturationPct(r,g,b)<=graySatThresh))){
        const lab = PM.colorMath.rgbToLab(r,g,b);
        return { color: matching.nearestByLuminance(lab[0], grayLum, grayPalette), family: -1, altColor:null, altFamily:-1, ambiguity: 999 };
      }
      const lab = PM.colorMath.rgbToLab(r,g,b);
      return matching.nearestWithFamilyLab(lab, palette, labPalette, family, numFamilies, famMinBuf, famColBuf);
    };

    if(useDither){
      const buf = new Float32Array(w*h*3);
      for(let i=0,j=0;i<data.length;i+=4,j+=3){ buf[j]=data[i]; buf[j+1]=data[i+1]; buf[j+2]=data[i+2]; }
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const idx=(y*w+x)*3;
          const r=Math.max(0,Math.min(255,buf[idx])), g=Math.max(0,Math.min(255,buf[idx+1])), b=Math.max(0,Math.min(255,buf[idx+2]));
          const nc = pickColor(r,g,b).color;
          const er=r-nc[0], eg=g-nc[1], eb=b-nc[2];
          buf[idx]=nc[0]; buf[idx+1]=nc[1]; buf[idx+2]=nc[2];
          const push=(xx,yy,f)=>{ if(xx<0||xx>=w||yy<0||yy>=h) return; const k=(yy*w+xx)*3; buf[k]+=er*f; buf[k+1]+=eg*f; buf[k+2]+=eb*f; };
          push(x+1,y,7/16); push(x-1,y+1,3/16); push(x,y+1,5/16); push(x+1,y+1,1/16);
        }
      }
      for(let i=0,j=0;i<data.length;i+=4,j+=3){ data[i]=buf[j]; data[i+1]=buf[j+1]; data[i+2]=buf[j+2]; }
      return { imgData, familyPerPixel: null };
    }

    const bestFamOut = new Int16Array(w*h).fill(-1);
    const bestColorOut = new Array(w*h);
    const altFamOut = new Int16Array(w*h).fill(-1);
    const altColorOut = new Array(w*h);
    const ambiguousFlag = new Uint8Array(w*h);
    const smoothThresh = smoothThreshPct/100;

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x, i = p*4;
        const r=data[i], g=data[i+1], b=data[i+2];
        const res = pickColor(r,g,b);
        bestFamOut[p] = res.family; bestColorOut[p] = res.color;
        if(res.family!==-1 && smoothEnabled && res.ambiguity < smoothThresh){
          ambiguousFlag[p] = 1; altFamOut[p] = res.altFamily; altColorOut[p] = res.altColor;
        }
      }
    }

    let workingFam = bestFamOut.slice();
    let workingColor = bestColorOut.slice();

    if(smoothEnabled){
      const offsets = neighborMode==='8' ? matching.NEIGHBORS_8 : matching.NEIGHBORS_4;
      for(let pass=0; pass<passes; pass++){
        const snapshot = workingFam;
        const nextFam = workingFam.slice();
        const nextColor = workingColor.slice();
        for(let y=0;y<h;y++){
          for(let x=0;x<w;x++){
            const p = y*w+x;
            if(!ambiguousFlag[p]) continue;
            let altCount=0, bestCount=0, avail=0;
            for(const [dx,dy] of offsets){
              const nx=x+dx, ny=y+dy;
              if(nx<0||nx>=w||ny<0||ny>=h) continue;
              avail++;
              const nf = snapshot[ny*w+nx];
              if(nf===altFamOut[p]) altCount++;
              else if(nf===bestFamOut[p]) bestCount++;
            }
            if(avail===0) continue;
            if(altCount > avail/2){ nextFam[p]=altFamOut[p]; nextColor[p]=altColorOut[p]; }
            else if(bestCount > avail/2){ nextFam[p]=bestFamOut[p]; nextColor[p]=bestColorOut[p]; }
          }
        }
        workingFam = nextFam; workingColor = nextColor;
      }
    }

    for(let p=0, i=0; p<w*h; p++, i+=4){
      const c = workingColor[p];
      data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2];
    }
    // se devuelve workingFam (family id final por pixel) para que feathering.js pueda
    // detectar bordes entre familias distintas sin tener que re-derivar el matching.
    return { imgData, familyPerPixel: workingFam };
  };
})();
