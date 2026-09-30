// Text Converter: reduce la imagen a un grid de cols×rows celdas, asigna a cada celda el
// símbolo de texto del color de la paleta más cercano y arma el texto (txt/csv/json).
// Código puro (sin DOM salvo canvases al vuelo), corre síncrono en el hilo principal.
(function(){
  const PM = self.PM = self.PM || {};
  const textconv = PM.textconv = {};
  const { hexToRgb, rgbToLab, labDist2 } = PM.colorMath;

  const ALPHA_CUTOFF = 128;
  const TRANSPARENT = -1;

  const segmenter = (typeof Intl!=='undefined' && Intl.Segmenter)
    ? new Intl.Segmenter(undefined, { granularity:'grapheme' }) : null;

  // Cuenta "caracteres visibles" (grafemas): un emoji cuenta como 1 aunque en UTF-16 sean 2+.
  textconv.graphemeCount = function(str){
    if(!str) return 0;
    if(segmenter){ let n=0; for(const _ of segmenter.segment(str)) n++; return n; }
    return Array.from(str).length;
  };

  // Solo avisa, nunca bloquea: símbolos repetidos, vacíos o de más de un carácter.
  // entries: [{hex, symbol}], transparentSymbol: string. Devuelve un array de strings.
  textconv.validateSymbols = function(entries, transparentSymbol){
    const rows = entries.map(e=>({ label:e.hex, symbol:e.symbol }));
    rows.push({ label:'transparente', symbol:transparentSymbol });

    const warnings = [];
    const bySymbol = new Map();
    rows.forEach(r=>{
      if(r.symbol==='') return;
      if(!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
      bySymbol.get(r.symbol).push(r.label);
    });
    bySymbol.forEach((labels, symbol)=>{
      if(labels.length>1) warnings.push(`El símbolo "${symbol}" está repetido en ${labels.join(', ')} — esos colores saldrán iguales en el texto.`);
    });
    rows.forEach(r=>{
      if(r.symbol===''){
        warnings.push(`${r.label} no tiene símbolo — sus pixeles no dejarán nada en el texto.`);
      } else {
        const n = textconv.graphemeCount(r.symbol);
        if(n>1) warnings.push(`El símbolo "${r.symbol}" de ${r.label} tiene ${n} caracteres — la salida puede quedar desalineada.`);
      }
    });
    return warnings;
  };

  // Devuelve una función (r,g,b) -> índice del color de la paleta más cercano en Lab (con caché).
  function makeMatcher(hexes){
    const labs = hexes.map(h=>rgbToLab(...hexToRgb(h)));
    const cache = new Map();
    return function(r,g,b){
      const key = (r<<16)|(g<<8)|b;
      let idx = cache.get(key);
      if(idx!==undefined) return idx;
      const lab = rgbToLab(r,g,b);
      let best = 0, bestD = Infinity;
      for(let i=0;i<labs.length;i++){
        const d = labDist2(lab, labs[i]);
        if(d<bestD){ bestD=d; best=i; }
      }
      cache.set(key, best);
      return best;
    };
  }

  function buildBounds(total, count){
    const bounds = new Array(count+1);
    for(let i=0;i<=count;i++) bounds[i] = Math.round(i*total/count);
    return bounds;
  }

  // Reduce imgData (w×h) a un grid gridCols×gridRows de índices de paleta (TRANSPARENT = -1
  // para celdas mayormente transparentes). method 'majority' = voto de cada pixel por su
  // color de paleta más cercano; 'mean' = promedia la celda y luego busca el más cercano.
  textconv.buildIndexGrid = function(imgData, w, h, opts, hexes){
    const { gridCols, gridRows, method } = opts;
    const data = imgData.data;
    const match = makeMatcher(hexes);
    const n = hexes.length;
    const xBounds = buildBounds(w, gridCols);
    const yBounds = buildBounds(h, gridRows);
    const grid = new Int16Array(gridCols*gridRows);
    const counts = new Uint32Array(n);

    for(let ry=0; ry<gridRows; ry++){
      const y0 = Math.min(yBounds[ry], h-1);
      const y1 = Math.min(Math.max(yBounds[ry+1], y0+1), h);
      for(let rx=0; rx<gridCols; rx++){
        const x0 = Math.min(xBounds[rx], w-1);
        const x1 = Math.min(Math.max(xBounds[rx+1], x0+1), w);
        const total = (x1-x0)*(y1-y0);
        let transparent = 0, sr=0, sg=0, sb=0;
        if(method==='mean'){
          for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
            const i = (y*w+x)*4;
            if(data[i+3]<ALPHA_CUTOFF){ transparent++; continue; }
            sr+=data[i]; sg+=data[i+1]; sb+=data[i+2];
          }
        } else {
          counts.fill(0);
          for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
            const i = (y*w+x)*4;
            if(data[i+3]<ALPHA_CUTOFF){ transparent++; continue; }
            counts[match(data[i], data[i+1], data[i+2])]++;
          }
        }
        let idx;
        if(transparent*2>=total || transparent===total){
          idx = TRANSPARENT;
        } else if(method==='mean'){
          const opaque = total-transparent;
          idx = match(Math.round(sr/opaque), Math.round(sg/opaque), Math.round(sb/opaque));
        } else {
          idx = 0;
          for(let k=1;k<n;k++) if(counts[k]>counts[idx]) idx = k;
        }
        grid[ry*gridCols+rx] = idx;
      }
    }
    return grid;
  };

  textconv.resolveSeparator = function(settings){
    switch(settings.separator){
      case 'comma': return ',';
      case 'space': return ' ';
      case 'tab': return '\t';
      case 'custom': return settings.customSeparator || '';
      default: return '';
    }
  };

  function csvField(s){
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }

  textconv.FORMAT_EXT = { txt:'txt', csv:'csv', json:'json' };

  textconv.render = function(grid, cols, rows, settings){
    const symbols = settings.palette.map(e=>e.symbol);
    const tSym = settings.transparentSymbol;
    const table = [];
    for(let y=0;y<rows;y++){
      const line = new Array(cols);
      for(let x=0;x<cols;x++){
        const idx = grid[y*cols+x];
        line[x] = idx===TRANSPARENT ? tSym : symbols[idx];
      }
      table.push(line);
    }
    if(settings.format==='json') return JSON.stringify(table);
    if(settings.format==='csv') return table.map(l=>l.map(csvField).join(',')).join('\n');
    const sep = textconv.resolveSeparator(settings);
    return table.map(l=>l.join(sep)).join('\n');
  };

  // File -> { text, cols, rows }. Igual que pixelate.runToFile: solo depende de canvases al
  // vuelo, así que sirve igual para imagen única y para batch.
  textconv.fileToText = async function(file, settings){
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const hexes = settings.palette.map(e=>e.hex);
    // "1 símbolo por pixel": el grid es el tamaño real de la imagen, sin reducir nada.
    const cols = settings.nativeSize ? bitmap.width : settings.gridCols;
    const rows = settings.nativeSize ? bitmap.height : settings.gridRows;
    if(cols*rows > textconv.MAX_CELLS){
      throw new Error(`La imagen tiene ${cols}×${rows} pixeles (${cols*rows} símbolos) — demasiado grande para 1 símbolo por pixel. Desactiva esa opción y usa un grid más chico.`);
    }
    const effective = Object.assign({}, settings, { gridCols:cols, gridRows:rows });
    const grid = textconv.buildIndexGrid(imgData, bitmap.width, bitmap.height, effective, hexes);
    if(bitmap.close) bitmap.close();
    return { text: textconv.render(grid, cols, rows, effective), cols, rows };
  };

  textconv.MAX_CELLS = 4000000;

  // Extensión y mime de cada formato de salida (lo usan el modo del tool y Sequence).
  textconv.FORMAT_MIME = { txt:'text/plain', csv:'text/csv', json:'application/json' };
})();
