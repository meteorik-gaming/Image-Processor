// Conversiones de color puras (hex/rgb/hsl/lab) + distancia en Lab.
// Sin estado, sin DOM — se usa igual en el hilo principal y dentro de los workers
// (worker-pool.js reconstruye este mismo código a partir de este archivo, ver ese módulo).
(function(){
  const PM = self.PM = self.PM || {};
  const colorMath = PM.colorMath = {};

  colorMath.hexToRgb = function(hex){
    const n = parseInt(hex.replace('#',''),16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  };

  colorMath.rgbToHex = function(c){
    return '#' + c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
  };

  colorMath.rgbToHsl = function(r,g,b){
    r/=255; g/=255; b/=255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    let h=0, s=0, l=(mx+mn)/2;
    const d = mx-mn;
    if(d!==0){
      s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
      switch(mx){
        case r: h=(g-b)/d + (g<b?6:0); break;
        case g: h=(b-r)/d + 2; break;
        case b: h=(r-g)/d + 4; break;
      }
      h/=6;
    }
    return [h,s,l];
  };

  colorMath.hslToRgb = function(h,s,l){
    if(s===0){ const v=l*255; return [v,v,v]; }
    const hue2rgb=(p,q,t)=>{
      if(t<0) t+=1; if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    const r = hue2rgb(p,q,h+1/3);
    const g = hue2rgb(p,q,h);
    const b = hue2rgb(p,q,h-1/3);
    return [r*255,g*255,b*255];
  };

  colorMath.rgbToLab = function(r,g,b){
    let rl=r/255, gl=g/255, bl=b/255;
    const toLinear = c => c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
    rl=toLinear(rl); gl=toLinear(gl); bl=toLinear(bl);
    const x = (rl*0.4124+gl*0.3576+bl*0.1805)*100;
    const y = (rl*0.2126+gl*0.7152+bl*0.0722)*100;
    const z = (rl*0.0193+gl*0.1192+bl*0.9505)*100;
    const refX=95.047, refY=100.0, refZ=108.883;
    let xr=x/refX, yr=y/refY, zr=z/refZ;
    const f = t => t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
    const fx=f(xr), fy=f(yr), fz=f(zr);
    return [(116*fy)-16, 500*(fx-fy), 200*(fy-fz)];
  };

  colorMath.labDist2 = function(a,b){
    const dl=a[0]-b[0], da=a[1]-b[1], db=a[2]-b[2];
    return dl*dl+da*da+db*db;
  };

  colorMath.saturationPct = function(r,g,b){
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    if(mx===0) return 0;
    return ((mx-mn)/mx)*100;
  };
})();
