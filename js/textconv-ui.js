// Wiring del panel izquierdo del tool Text Converter: tabla color→símbolo (con copia desde
// las 3 paletas de Palette Matcher), grid, método, separador/formato, avisos de símbolos
// y presets nombrados + autosave. Mismo rol que pixelate-ui.js para su tool.
(function(){
  const PM = self.PM = self.PM || {};
  const textconvUi = PM.textconvUi = {};
  const store = PM.presets.createStore('textconv');

  const $ = id => document.getElementById(id);
  const swatchesEl = $('textconvSwatches');
  const copySourceEl = $('textconvCopySource');
  const transparentSymbolEl = $('textconvTransparentSymbol');
  const alphaEl = $('textconvAlpha'), alphaValEl = $('textconvAlphaVal');
  const warningsEls = [$('textconvWarnings'), $('textconvWarningsMain')];
  const gridColsEl = $('textconvCols'), gridColsValEl = $('textconvColsVal');
  const gridRowsEl = $('textconvRows'), gridRowsValEl = $('textconvRowsVal');
  const gridLockEl = $('textconvGridLock');
  const nativeSizeEl = $('textconvNativeSize'), gridBlockEl = $('textconvGridBlock');
  const sizeBadgeEl = $('textconvSizeBadge');
  const methodEl = $('textconvMethod');
  const separatorEl = $('textconvSeparator'), customSepEl = $('textconvCustomSep');
  const formatEl = $('textconvFormat'), formatHintEl = $('textconvFormatHint');
  const presetSelectEl = $('textconvPresetSelect'), presetNameEl = $('textconvPresetName');
  const presetSaveBtnEl = $('textconvPresetSaveBtn'), presetDeleteBtnEl = $('textconvPresetDeleteBtn');

  const DEFAULT_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let palette = [{ hex:'#ffffff', symbol:'B' }, { hex:'#000000', symbol:'N' }];

  function pickDefaultSymbol(used){
    for(const ch of DEFAULT_SYMBOLS) if(!used.has(ch)) return ch;
    return '?';
  }

  // ---------- avisos (solo informan, nunca bloquean) ----------
  function getWarnings(){
    return PM.textconv.validateSymbols(palette, transparentSymbolEl.value);
  }
  textconvUi.getWarnings = getWarnings;
  function renderWarnings(){
    const warnings = getWarnings();
    warningsEls.forEach(el=>{
      el.innerHTML = '';
      el.style.display = warnings.length ? 'block' : 'none';
      if(!warnings.length) return;
      const title = document.createElement('div');
      title.className = 'warn-title';
      title.textContent = '⚠ La salida puede no verse como esperas:';
      el.appendChild(title);
      warnings.forEach(w=>{
        const li = document.createElement('div');
        li.textContent = w;
        el.appendChild(li);
      });
    });
  }

  // ---------- tabla de paleta ----------
  function renderPalette(){
    swatchesEl.innerHTML = '';
    palette.forEach(entry=>{
      const row = document.createElement('div');
      row.className = 'swatch-row';

      const color = document.createElement('input');
      color.type = 'color'; color.value = entry.hex;
      const hex = document.createElement('input');
      hex.type = 'text'; hex.value = entry.hex;
      const sym = document.createElement('input');
      sym.type = 'text'; sym.className = 'symbol-input'; sym.value = entry.symbol;
      sym.placeholder = 'símbolo'; sym.title = 'símbolo (cualquier texto)';
      const rm = document.createElement('button');
      rm.textContent = '✕'; rm.title = 'quitar';

      color.addEventListener('input', ()=>{ entry.hex = color.value; hex.value = color.value; renderWarnings(); });
      hex.addEventListener('change', ()=>{
        let v = hex.value.trim(); if(!v.startsWith('#')) v = '#'+v;
        if(/^#[0-9a-fA-F]{6}$/.test(v)){ entry.hex = v.toLowerCase(); color.value = entry.hex; hex.value = entry.hex; renderWarnings(); }
        else hex.value = entry.hex;
      });
      sym.addEventListener('input', ()=>{ entry.symbol = sym.value; renderWarnings(); });
      rm.addEventListener('click', ()=>{
        if(palette.length<=1) return;
        palette.splice(palette.indexOf(entry), 1);
        renderPalette(); scheduleAutosave();
      });

      row.append(color, hex, sym, rm);
      swatchesEl.appendChild(row);
    });
    renderWarnings();
  }

  $('textconvAddColor').addEventListener('click', ()=>{
    const used = new Set(palette.map(e=>e.symbol));
    palette.push({ hex:'#888888', symbol:pickDefaultSymbol(used) });
    renderPalette(); scheduleAutosave();
  });

  // Copia una de las 3 paletas de Palette Matcher. Si un hex ya estaba en la tabla se
  // conserva su símbolo; los demás reciben el siguiente símbolo por defecto libre.
  $('textconvCopyBtn').addEventListener('click', ()=>{
    const s = PM.ui.currentSettings();
    const source = { base:s.baseColors, gray:s.grayColors, fg:s.fgColors }[copySourceEl.value] || [];
    if(!source.length) return;
    const known = new Map(palette.map(e=>[e.hex.toLowerCase(), e.symbol]));
    const used = new Set();
    const next = source.map(hex=>{
      const key = hex.toLowerCase();
      const symbol = known.has(key) ? known.get(key) : null;
      if(symbol!==null) used.add(symbol);
      return { hex:key, symbol };
    });
    next.forEach(e=>{
      if(e.symbol===null){ e.symbol = pickDefaultSymbol(used); used.add(e.symbol); }
    });
    palette = next;
    renderPalette(); scheduleAutosave();
  });

  transparentSymbolEl.addEventListener('input', renderWarnings);
  function updateAlphaLabel(){ alphaValEl.textContent = alphaEl.value + '%'; }
  alphaEl.addEventListener('input', updateAlphaLabel);

  // ---------- grid / salida ----------
  function updateSizeLabels(){
    const cols = +gridColsEl.value, rows = +gridRowsEl.value;
    gridColsValEl.textContent = cols;
    gridRowsValEl.textContent = rows;
    sizeBadgeEl.textContent = nativeSizeEl.checked ? '1 símbolo / pixel' : `${cols} × ${rows}`;
    gridBlockEl.classList.toggle('disabled', nativeSizeEl.checked);
  }
  nativeSizeEl.addEventListener('change', updateSizeLabels);
  gridColsEl.addEventListener('input', ()=>{
    if(gridLockEl.checked) gridRowsEl.value = gridColsEl.value;
    updateSizeLabels();
  });
  gridRowsEl.addEventListener('input', ()=>{
    if(gridLockEl.checked) gridColsEl.value = gridRowsEl.value;
    updateSizeLabels();
  });

  function updateOutputUI(){
    const isTxt = formatEl.value==='txt';
    separatorEl.parentElement.classList.toggle('disabled', !isTxt);
    customSepEl.style.display = (isTxt && separatorEl.value==='custom') ? '' : 'none';
    formatHintEl.textContent = isTxt
      ? 'Texto plano: las celdas de cada fila se unen con el separador elegido.'
      : formatEl.value==='csv'
        ? 'CSV: una fila por renglón, celdas separadas por coma (el separador de arriba no aplica).'
        : 'JSON: array de arrays con un símbolo por celda (el separador de arriba no aplica).';
  }
  separatorEl.addEventListener('change', updateOutputUI);
  formatEl.addEventListener('change', updateOutputUI);

  // ---------- settings ----------
  function currentSettings(){
    return {
      palette: palette.map(e=>({ hex:e.hex, symbol:e.symbol })),
      transparentSymbol: transparentSymbolEl.value,
      alphaThreshold: +alphaEl.value,
      gridCols: +gridColsEl.value,
      gridRows: +gridRowsEl.value,
      gridLock: gridLockEl.checked,
      nativeSize: nativeSizeEl.checked,
      method: methodEl.value,
      separator: separatorEl.value,
      customSeparator: customSepEl.value,
      format: formatEl.value
    };
  }
  function applySettings(cfg){
    if(Array.isArray(cfg.palette) && cfg.palette.length){
      palette = cfg.palette.map(e=>({ hex:e.hex, symbol:String(e.symbol==null ? '' : e.symbol) }));
    }
    if(cfg.transparentSymbol!=null) transparentSymbolEl.value = cfg.transparentSymbol;
    alphaEl.value = cfg.alphaThreshold!=null ? cfg.alphaThreshold : PM.textconv.DEFAULT_ALPHA_THRESHOLD;
    updateAlphaLabel();
    if(cfg.gridCols!=null) gridColsEl.value = cfg.gridCols;
    if(cfg.gridRows!=null) gridRowsEl.value = cfg.gridRows;
    if(cfg.gridLock!=null) gridLockEl.checked = cfg.gridLock;
    if(cfg.nativeSize!=null) nativeSizeEl.checked = cfg.nativeSize;
    if(cfg.method!=null) methodEl.value = cfg.method;
    if(cfg.separator!=null) separatorEl.value = cfg.separator;
    if(cfg.customSeparator!=null) customSepEl.value = cfg.customSeparator;
    if(cfg.format!=null) formatEl.value = cfg.format;
    updateSizeLabels();
    updateOutputUI();
    renderPalette();
  }
  textconvUi.currentSettings = currentSettings;

  const scheduleAutosave = PM.presets.debounce(()=>{ store.saveLastConfig(currentSettings()); }, 400);
  document.querySelector('#tool-textconv .panel').addEventListener('input', scheduleAutosave);
  document.querySelector('#tool-textconv .panel').addEventListener('change', scheduleAutosave);

  // ---------- presets nombrados ----------
  function refreshPresetSelect(){
    const names = store.listPresetNames();
    presetSelectEl.innerHTML = '<option value="">— cargar preset —</option>' +
      names.map(n=>`<option value="${n}">${n}</option>`).join('');
  }
  presetSaveBtnEl.addEventListener('click', ()=>{
    const name = presetNameEl.value.trim();
    if(!name){ alert('Ponle un nombre al preset primero.'); return; }
    store.savePreset(name, currentSettings());
    presetNameEl.value = '';
    refreshPresetSelect();
    presetSelectEl.value = name;
  });
  presetSelectEl.addEventListener('change', ()=>{
    const name = presetSelectEl.value;
    if(!name) return;
    const cfg = store.loadPreset(name);
    if(cfg) applySettings(cfg);
  });
  presetDeleteBtnEl.addEventListener('click', ()=>{
    const name = presetSelectEl.value;
    if(!name) return;
    if(!confirm(`¿Borrar el preset "${name}"?`)) return;
    store.deletePreset(name);
    refreshPresetSelect();
  });

  textconvUi.init = function(){
    const last = store.loadLastConfig();
    if(last) applySettings(last);
    else { updateSizeLabels(); updateOutputUI(); renderPalette(); }
    refreshPresetSelect();
  };
})();
