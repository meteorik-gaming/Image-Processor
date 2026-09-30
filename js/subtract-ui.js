// Wiring del panel izquierdo del tool Subtract: umbral de diferencia, limpieza, invertir,
// recortar y presets nombrados + autosave. Mismo rol que pixelate-ui.js para su tool.
(function(){
  const PM = self.PM = self.PM || {};
  const subtractUi = PM.subtractUi = {};
  const store = PM.presets.createStore('subtract');

  const $ = id => document.getElementById(id);
  const thresholdEl = $('subtractThreshold'), thresholdValEl = $('subtractThresholdVal');
  const minIslandEl = $('subtractMinIsland'), minIslandValEl = $('subtractMinIslandVal');
  const fillHolesEl = $('subtractFillHoles'), fillHolesValEl = $('subtractFillHolesVal');
  const invertEl = $('subtractInvert'), cropEl = $('subtractCrop');
  const presetSelectEl = $('subtractPresetSelect'), presetNameEl = $('subtractPresetName');
  const presetSaveBtnEl = $('subtractPresetSaveBtn'), presetDeleteBtnEl = $('subtractPresetDeleteBtn');

  function updateLabels(){
    thresholdValEl.textContent = thresholdEl.value;
    minIslandValEl.textContent = +minIslandEl.value===0 ? 'off' : minIslandEl.value + ' px';
    fillHolesValEl.textContent = +fillHolesEl.value===0 ? 'off' : fillHolesEl.value + ' px';
  }
  [thresholdEl, minIslandEl, fillHolesEl].forEach(el=>el.addEventListener('input', updateLabels));

  function currentSettings(){
    return {
      threshold: +thresholdEl.value,
      minIsland: +minIslandEl.value,
      fillHoles: +fillHolesEl.value,
      invert: invertEl.checked,
      crop: cropEl.checked
    };
  }
  function applySettings(cfg){
    if(cfg.threshold!=null) thresholdEl.value = cfg.threshold;
    if(cfg.minIsland!=null) minIslandEl.value = cfg.minIsland;
    if(cfg.fillHoles!=null) fillHolesEl.value = cfg.fillHoles;
    if(cfg.invert!=null) invertEl.checked = cfg.invert;
    if(cfg.crop!=null) cropEl.checked = cfg.crop;
    updateLabels();
  }
  subtractUi.currentSettings = currentSettings;

  const scheduleAutosave = PM.presets.debounce(()=>{ store.saveLastConfig(currentSettings()); }, 400);
  document.querySelector('#tool-subtract .panel').addEventListener('input', scheduleAutosave);
  document.querySelector('#tool-subtract .panel').addEventListener('change', scheduleAutosave);

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

  subtractUi.init = function(){
    const last = store.loadLastConfig();
    if(last) applySettings(last);
    else updateLabels();
    refreshPresetSelect();
  };
})();
