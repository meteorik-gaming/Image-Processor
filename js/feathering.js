// Feathering de bordes (NUEVO en v7): suaviza el corte duro entre dos grupos de color
// vecinos (familia de la paleta principal, o sección de lineart/foreground) promediando
// hacia los vecinos dentro de un radio, con una fuerza configurable. Es puramente cosmético
// y corre como post-proceso sobre el buffer ya matcheado — no cambia qué familia gana,
// solo suaviza la transición visual entre una y otra.
// Se usa con dos "idPerPixel" distintos (mismo algoritmo, distinto criterio de borde):
//  - familyPerPixel del matching principal -> "feathering general"
//  - id de sección/tinta del pase de lineart -> "feathering en bordes de tinta"
(function(){
  const PM = self.PM = self.PM || {};
  const feathering = PM.feathering = {};

  feathering.applyEdgeFeather = function(data, w, h, idPerPixel, radiusPx, strengthPct){
    if(radiusPx<=0 || strengthPct<=0) return;
    const strength = strengthPct/100;
    const src = new Uint8ClampedArray(data); // snapshot de solo-lectura, para no encadenar el blend
    const r2 = radiusPx*radiusPx;

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w+x;
        const myId = idPerPixel[p];
        let isEdge = false;
        for(let dy=-1; dy<=1 && !isEdge; dy++){
          for(let dx=-1; dx<=1; dx++){
            if(dx===0 && dy===0) continue;
            const nx=x+dx, ny=y+dy;
            if(nx<0||nx>=w||ny<0||ny>=h) continue;
            if(idPerPixel[ny*w+nx] !== myId){ isEdge = true; break; }
          }
        }
        if(!isEdge) continue;

        const i = p*4;
        let sumR=0,sumG=0,sumB=0,sumW=0;
        for(let dy=-radiusPx; dy<=radiusPx; dy++){
          for(let dx=-radiusPx; dx<=radiusPx; dx++){
            const d2 = dx*dx+dy*dy;
            if(d2>r2) continue;
            const nx=x+dx, ny=y+dy;
            if(nx<0||nx>=w||ny<0||ny>=h) continue;
            const wgt = 1/(1+Math.sqrt(d2));
            const ni = (ny*w+nx)*4;
            sumR += src[ni]*wgt; sumG += src[ni+1]*wgt; sumB += src[ni+2]*wgt; sumW += wgt;
          }
        }
        if(sumW<=0) continue;
        data[i]   = src[i]   + ((sumR/sumW) - src[i])  *strength;
        data[i+1] = src[i+1] + ((sumG/sumW) - src[i+1])*strength;
        data[i+2] = src[i+2] + ((sumB/sumW) - src[i+2])*strength;
      }
    }
  };
})();
