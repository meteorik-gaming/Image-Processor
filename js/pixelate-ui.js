// Wiring del panel izquierdo del tool Pixelate: grid (cols/rows + lock), método de
// color, umbral, upscale, presets nombrados + autosave — mismo rol que ui.js pero
// acotado a este tool (ui.js no se toca). Expone PM.pixelateUi.buildOpts(settings)
// (puro, sin DOM) para que el tool Sequence pueda correr un preset de este tool sin
// que Pixelate sea el tab activo.
(function(){
  const PM = self.PM = self.PM || {};
  const pixelateUi = PM.pixelateUi = {};
  const store = PM.presets.createStore('pixelate');

  const $ = id => document.getElementById(id);
  const gridColsEl = $('gridCols'), gridColsValEl = $('gridColsVal');
  const gridRowsEl = $('gridRows'), gridRowsValEl = $('gridRowsVal');
  const gridLockEl = $('gridLock');
  const nativeSizeBadgeEl = $('pixelateNativeSizeBadge'), finalSizeBadgeEl = $('pixelateFinalSizeBadge');
  const methodEl = $('pixelateMethod'), meanHintEl = $('pixelateMeanHint');
  const thresholdBlockEl = $('pixelateThresholdBlock');
  const thresholdEl = $('pixelateThreshold'), thresholdValEl = $('pixelateThresholdVal');
  const upscaleEl = $('pixelateUpscale'), upscaleValEl = $('pixelateUpscaleVal');
  const presetSelectEl = $('pixelatePresetSelect'), presetNameEl = $('pixelatePresetName');
  const presetSaveBtnEl = $('pixelatePresetSaveBtn'), presetDeleteBtnEl = $('pixelatePresetDeleteBtn');

  function updateSizeLabels(){
    const cols = +gridColsEl.value, rows = +gridRowsEl.value, up = +upscaleEl.value;
    gridColsValEl.textContent = cols;
    gridRowsValEl.textContent = rows;
    nativeSizeBadgeEl.textContent = `${cols} × ${rows} px`;
    finalSizeBadgeEl.textContent = `${cols*up} × ${rows*up} px`;
    upscaleValEl.textContent = up + '×';
  }
  function updateMethodUI(){
    const isDominant = methodEl.value==='dominant';
    thresholdBlockEl.classList.toggle('disabled', !isDominant);
    meanHintEl.style.display = isDominant ? 'none' : '';
  }

  gridColsEl.addEventListener('input', ()=>{
    if(gridLockEl.checked) gridRowsEl.value = gridColsEl.value;
    updateSizeLabels();
  });
  gridRowsEl.addEventListener('input', ()=>{
    if(gridLockEl.checked) gridColsEl.value = gridRowsEl.value;
    updateSizeLabels();
  });
  upscaleEl.addEventListener('input', updateSizeLabels);
  methodEl.addEventListener('change', updateMethodUI);
  thresholdEl.addEventListener('input', ()=>{ thresholdValEl.textContent = thresholdEl.value; });

  function currentSettings(){
    return {
      gridCols: +gridColsEl.value,
      gridRows: +gridRowsEl.value,
      gridLock: gridLockEl.checked,
      method: methodEl.value,
      threshold: +thresholdEl.value,
      upscale: +upscaleEl.value
    };
  }
  function applySettings(cfg){
    if(cfg.gridCols!=null) gridColsEl.value = cfg.gridCols;
    if(cfg.gridRows!=null) gridRowsEl.value = cfg.gridRows;
    if(cfg.gridLock!=null) gridLockEl.checked = cfg.gridLock;
    if(cfg.method!=null) methodEl.value = cfg.method;
    if(cfg.threshold!=null) thresholdEl.value = cfg.threshold;
    if(cfg.upscale!=null) upscaleEl.value = cfg.upscale;
    updateSizeLabels();
    updateMethodUI();
    thresholdValEl.textContent = thresholdEl.value;
  }

  const scheduleAutosave = PM.presets.debounce(()=>{ store.saveLastConfig(currentSettings()); }, 400);
  document.querySelector('#tool-pixelate .panel').addEventListener('input', scheduleAutosave);
  document.querySelector('#tool-pixelate .panel').addEventListener('change', scheduleAutosave);

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

  // ---------- opts para pixelate.js — puro, no lee DOM, para que Sequence pueda
  // correr un preset de este tool sin que Pixelate sea el tab activo ----------
  pixelateUi.buildOpts = function(settings){
    return {
      gridCols: settings.gridCols,
      gridRows: settings.gridRows,
      method: settings.method,
      thresholdDE: settings.threshold,
      upscale: settings.upscale
    };
  };
  pixelateUi.currentOpts = function(){
    return pixelateUi.buildOpts(currentSettings());
  };

  pixelateUi.init = function(){
    const last = store.loadLastConfig();
    if(last) applySettings(last);
    else { updateSizeLabels(); updateMethodUI(); }
    refreshPresetSelect();
  };
})();
