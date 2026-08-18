// Construcción de ramps (sombra/brillo por color) y de las paletas completas
// (principal, gris, foreground) a partir del estado de los sliders.
// Solo corre en el hilo principal — el worker recibe las paletas ya construidas
// (arrays planos de rgb/lab) como parte de los "opts" de cada job, no este código.
(function(){
  const PM = self.PM = self.PM || {};
  const { hexToRgb, rgbToLab } = PM.colorMath;
  const ramp = PM.ramp = {};

  ramp.buildRamp = function(baseHex, sLayers, sOpacityPct, hLayers, hOpacityPct){
    const [r0,g0,b0] = hexToRgb(baseHex);
    const [h,s,l] = PM.colorMath.rgbToHsl(r0,g0,b0);
    const sOpacity = sOpacityPct/100, hOpacity = hOpacityPct/100;
    let curL = l; const shadows = [];
    for(let i=0;i<sLayers;i++){
      const multiplied = curL*curL;
      curL = curL + (multiplied-curL)*sOpacity;
      shadows.push(PM.colorMath.hslToRgb(h,s,curL));
    }
    curL = l; const highlights = [];
    for(let i=0;i<hLayers;i++){
      const screened = 1-(1-curL)*(1-curL);
      curL = curL + (screened-curL)*hOpacity;
      highlights.push(PM.colorMath.hslToRgb(h,s,curL));
    }
    return [...shadows.slice().reverse(), [r0,g0,b0], ...highlights];
  };

  ramp.buildFullPalette = function(baseColors, sLayers, sOpacityPct, hLayers, hOpacityPct){
    let palette = [], family = [];
    baseColors.forEach((hex, fi)=>{
      const r = ramp.buildRamp(hex, sLayers, sOpacityPct, hLayers, hOpacityPct);
      r.forEach(c=>{ palette.push(c); family.push(fi); });
    });
    const labPalette = palette.map(c=>rgbToLab(c[0],c[1],c[2]));
    return { palette, labPalette, family, numFamilies: baseColors.length };
  };

  ramp.buildGrayFullPalette = function(grayColors, sLayers, sOpacityPct, hLayers, hOpacityPct){
    let palette = [];
    grayColors.forEach(hex=>{
      palette = palette.concat(ramp.buildRamp(hex, sLayers, sOpacityPct, hLayers, hOpacityPct));
    });
    return palette;
  };

  // fgGroupOf: null (cada color es su propia familia) o array paralelo a fgColors con el id de grupo.
  ramp.buildFgFullPalette = function(fgColors, fgGroupOf, sLayers, sOpacityPct, hLayers, hOpacityPct){
    let baseHexes;
    if(fgGroupOf && fgGroupOf.length===fgColors.length){
      const numGroups = Math.max(...fgGroupOf)+1;
      const sums = Array.from({length:numGroups}, ()=>[0,0,0,0]);
      fgColors.forEach((hex,i)=>{
        const rgb = hexToRgb(hex), g = fgGroupOf[i];
        sums[g][0]+=rgb[0]; sums[g][1]+=rgb[1]; sums[g][2]+=rgb[2]; sums[g][3]++;
      });
      baseHexes = sums.map(s=> s[3]>0 ? PM.colorMath.rgbToHex([s[0]/s[3], s[1]/s[3], s[2]/s[3]]) : '#888888');
    } else {
      baseHexes = fgColors;
    }

    const familyAB = [], familyShades = [];
    baseHexes.forEach(hex=>{
      const r = ramp.buildRamp(hex, sLayers, sOpacityPct, hLayers, hOpacityPct);
      const shades = r.map(c=>{ const lab=rgbToLab(c[0],c[1],c[2]); return {L:lab[0], rgb:c}; });
      familyShades.push(shades);
      const [, a, bb] = rgbToLab(...hexToRgb(hex));
      familyAB.push([a,bb]);
    });
    const n = familyAB.length;
    const pairDist = Array.from({length:n}, ()=>new Array(n).fill(0));
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const da=familyAB[i][0]-familyAB[j][0], db=familyAB[i][1]-familyAB[j][1];
      pairDist[i][j] = da*da+db*db;
    }
    return { familyAB, familyShades, pairDist, numFamilies: n };
  };
})();
