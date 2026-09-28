// Wiring de todo el panel izquierdo: paletas (swatches), ramps, sliders, tabs,
// feathering, presets/autosave, y export/import de config. Todo DOM, todo main-thread.
// Expone PM.ui.currentProcessOpts()/currentSettings()/applySettings() para que
// single-mode.js y batch-mode.js arme los jobs que le manda al worker pool.
(function(){
  const PM = self.PM = self.PM || {};
  const ui = PM.ui = {};
  const { hexToRgb, rgbToHex, rgbToLab } = PM.colorMath;
  const store = PM.presets.createStore('paletteMatcher');

  let baseColors = ['#3b3178', '#7ec8e3', '#e8a33d'];
  let grayColors = ['#2b2b2b', '#6e6e6e', '#c9c9c9'];
  let fgColors = ['#888888'];
  let fgGroupOf = null;

  const $ = id => document.getElementById(id);
  const swatchesEl = $('swatches');
  const graySwatchesEl = $('graySwatches');
  const rampPreviewEl = $('rampPreview');
  const mainPreviewColorEl = $('mainPreviewColor');
  const sLayersEl = $('sLayers'), sOpacityEl = $('sOpacity'), hLayersEl = $('hLayers'), hOpacityEl = $('hOpacity');
  const smoothEnabledEl = $('smoothEnabled'), smoothThreshEl = $('smoothThresh'), neighborModeEl = $('neighborMode'), passesEl = $('passes');
  const ditherEl = $('dither');
  const grayEnabledEl = $('grayEnabled'), graySatEl = $('graySat'), forceGrayscaleEl = $('forceGrayscale');
  const graySyncEl = $('graySync'), grayPreviewColorEl = $('grayPreviewColor'), grayRampPreviewEl = $('grayRampPreview'), grayRampBlockEl = $('grayRampBlock');
  const gSLayersEl = $('gSLayers'), gSOpacityEl = $('gSOpacity'), gHLayersEl = $('gHLayers'), gHOpacityEl = $('gHOpacity');
  const lineartEnabledEl = $('lineartEnabled');
  const noRealBackgroundEl = $('noRealBackground');
  const excludeRealBgMatchesEl = $('excludeRealBgMatches');
  const landlockedEnabledEl = $('landlockedEnabled');
  const landlockedMaxColorsEl = $('landlockedMaxColors');
  const inkDarkNEl = $('inkDarkN'), inkHueThreshEl = $('inkHueThresh'), inkMaxLEl = $('inkMaxL'), inkRadiusEl = $('inkRadius');
  const solidRejectEl = $('solidReject'), gapCloseEl = $('gapClose'), maxRegionAreaEl = $('maxRegionArea');
  const familySepEl = $('familySep'), maxFamPerRegionEl = $('maxFamPerRegion');
  const fgSwatchesEl = $('fgSwatches'), analyzeFgBtnEl = $('analyzeFgBtn'), fgGroupsListEl = $('fgGroupsList');
  const fgSyncEl = $('fgSync'), fgRampBlockEl = $('fgRampBlock'), fgPreviewColorEl = $('fgPreviewColor'), fgRampPreviewEl = $('fgRampPreview');
  const fgSLayersEl = $('fgSLayers'), fgSOpacityEl = $('fgSOpacity'), fgHLayersEl = $('fgHLayers'), fgHOpacityEl = $('fgHOpacity');
  const featherLineartEl = $('featherLineartEnabled'), featherGeneralEl = $('featherGeneralEnabled');
  const featherRadiusEl = $('featherRadius'), featherStrengthEl = $('featherStrength');
  const presetSelectEl = $('presetSelect'), presetNameEl = $('presetName'), presetSaveBtnEl = $('presetSaveBtn'), presetDeleteBtnEl = $('presetDeleteBtn');

  // ---------- swatch list UI genérica ----------
  function renderColorList(container, arr, onChange){
    container.innerHTML = '';
    arr.forEach((hex, i)=>{
      const row = document.createElement('div');
      row.className = 'swatch-row';
      row.innerHTML = `
        <input type="color" value="${hex}" data-i="${i}">
        <input type="text" value="${hex}" data-i="${i}">
        <button data-i="${i}" title="quitar">✕</button>
      `;
      container.appendChild(row);
    });
    container.querySelectorAll('input[type=color]').forEach(inp=>{
      inp.addEventListener('input', e=>{ arr[+e.target.dataset.i]=e.target.value; onChange(); });
    });
    container.querySelectorAll('input[type=text]').forEach(inp=>{
      inp.addEventListener('change', e=>{
        let v=e.target.value.trim(); if(!v.startsWith('#')) v='#'+v;
        if(/^#[0-9a-fA-F]{6}$/.test(v)){ arr[+e.target.dataset.i]=v; onChange(); }
      });
    });
    container.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', e=>{
        if(arr.length<=1) return;
        arr.splice(+e.target.dataset.i,1); onChange();
      });
    });
  }
  function parseHexList(text){
    return text.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean)
      .map(s=> s.startsWith('#')?s:'#'+s)
      .filter(s=>/^#[0-9a-fA-F]{6}$/.test(s));
  }

  function renderSwatches(){
    renderColorList(swatchesEl, baseColors, ()=>{ renderSwatches(); });
    renderMainPreviewSelector();
    renderRampPreview();
  }
  function renderMainPreviewSelector(){
    const prevIdx = mainPreviewColorEl.value;
    mainPreviewColorEl.innerHTML = baseColors.map((hex,i)=>`<option value="${i}">${i+1} — ${hex}</option>`).join('');
    mainPreviewColorEl.value = (prevIdx!=='' && +prevIdx < baseColors.length) ? prevIdx : 0;
  }
  function renderRampPreview(){
    const sLayers = +sLayersEl.value, sOpacityPct = +sOpacityEl.value;
    const hLayers = +hLayersEl.value, hOpacityPct = +hOpacityEl.value;
    const idx = +mainPreviewColorEl.value || 0;
    const r = PM.ramp.buildRamp(baseColors[idx], sLayers, sOpacityPct, hLayers, hOpacityPct);
    rampPreviewEl.innerHTML = r.map(c=>`<div style="background:${rgbToHex(c)}"></div>`).join('');
  }
  mainPreviewColorEl.addEventListener('change', renderRampPreview);

  function renderGraySwatches(){
    renderColorList(graySwatchesEl, grayColors, ()=>{ renderGraySwatches(); });
    renderGrayPreviewSelector();
    renderGrayRampPreview();
  }
  function renderGrayPreviewSelector(){
    const prevIdx = grayPreviewColorEl.value;
    grayPreviewColorEl.innerHTML = grayColors.map((hex,i)=>`<option value="${i}">${i+1} — ${hex}</option>`).join('');
    grayPreviewColorEl.value = (prevIdx!=='' && +prevIdx < grayColors.length) ? prevIdx : Math.floor((grayColors.length-1)/2);
  }
  function renderGrayRampPreview(){
    const sync = graySyncEl.checked;
    const sLayers = sync? +sLayersEl.value : +gSLayersEl.value;
    const sOpacityPct = sync? +sOpacityEl.value : +gSOpacityEl.value;
    const hLayers = sync? +hLayersEl.value : +gHLayersEl.value;
    const hOpacityPct = sync? +hOpacityEl.value : +gHOpacityEl.value;
    const idx = +grayPreviewColorEl.value || 0;
    const r = PM.ramp.buildRamp(grayColors[idx], sLayers, sOpacityPct, hLayers, hOpacityPct);
    grayRampPreviewEl.innerHTML = r.map(c=>`<div style="background:${rgbToHex(c)}"></div>`).join('');
  }
  grayPreviewColorEl.addEventListener('change', renderGrayRampPreview);

  function renderFgSwatches(){
    renderColorList(fgSwatchesEl, fgColors, ()=>{ fgGroupOf=null; renderFgSwatches(); });
    renderFgPreviewSelector();
    renderFgRampPreview();
    renderFgGroupsUI();
  }
  function analyzeFgGroups(){
    const labs = fgColors.map(hex=>rgbToLab(...hexToRgb(hex)));
    const threshold = +familySepEl.value * 20;
    const groups = [];
    const groupOf = new Array(fgColors.length).fill(0);
    labs.forEach((lab, i)=>{
      let found = -1;
      for(let g=0; g<groups.length; g++){
        const da = lab[1]-groups[g].a, db = lab[2]-groups[g].b;
        if(da*da+db*db <= threshold){ found = g; break; }
      }
      if(found===-1){
        groups.push({ a:lab[1], b:lab[2], count:1 });
        groupOf[i] = groups.length-1;
      } else {
        const g = groups[found];
        g.a = (g.a*g.count + lab[1])/(g.count+1);
        g.b = (g.b*g.count + lab[2])/(g.count+1);
        g.count++; groupOf[i] = found;
      }
    });
    fgGroupOf = groupOf;
    renderFgGroupsUI();
  }
  function renderFgGroupsUI(){
    if(!fgGroupOf || fgGroupOf.length!==fgColors.length){
      fgGroupsListEl.textContent = 'sin agrupar — cada color es su propia familia (comportamiento dinámico normal). Corre el análisis para fijar grupos.';
      return;
    }
    const numGroups = Math.max(...fgGroupOf)+1;
    const rows = fgColors.map((hex,i)=>{
      const opts = Array.from({length:numGroups+1}, (_,g)=>{
        const label = g<numGroups ? `Grupo ${g+1}` : 'Grupo nuevo';
        return `<option value="${g}" ${fgGroupOf[i]===g?'selected':''}>${label}</option>`;
      }).join('');
      return `<div class="swatch-row"><div style="width:16px;height:16px;border-radius:3px;background:${hex};flex-shrink:0;"></div><span style="font-family:var(--mono);font-size:11px;">${hex}</span><select data-i="${i}" style="margin-left:auto;width:auto;font-size:11px;padding:3px 4px;">${opts}</select></div>`;
    }).join('');
    fgGroupsListEl.innerHTML = `<div class="hint" style="margin-bottom:6px;">${numGroups} grupo(s) — ajusta manualmente si hace falta:</div>` + rows;
    fgGroupsListEl.querySelectorAll('select').forEach(sel=>{
      sel.addEventListener('change', e=>{
        fgGroupOf[+e.target.dataset.i] = +e.target.value;
        renderFgGroupsUI();
      });
    });
  }
  analyzeFgBtnEl.addEventListener('click', analyzeFgGroups);
  function renderFgPreviewSelector(){
    const prevIdx = fgPreviewColorEl.value;
    fgPreviewColorEl.innerHTML = fgColors.map((hex,i)=>`<option value="${i}">${i+1} — ${hex}</option>`).join('');
    fgPreviewColorEl.value = (prevIdx!=='' && +prevIdx < fgColors.length) ? prevIdx : 0;
  }
  function renderFgRampPreview(){
    const sync = fgSyncEl.checked;
    const sLayers = sync? +sLayersEl.value : +fgSLayersEl.value;
    const sOpacityPct = sync? +sOpacityEl.value : +fgSOpacityEl.value;
    const hLayers = sync? +hLayersEl.value : +fgHLayersEl.value;
    const hOpacityPct = sync? +hOpacityEl.value : +fgHOpacityEl.value;
    const idx = +fgPreviewColorEl.value || 0;
    const r = PM.ramp.buildRamp(fgColors[idx], sLayers, sOpacityPct, hLayers, hOpacityPct);
    fgRampPreviewEl.innerHTML = r.map(c=>`<div style="background:${rgbToHex(c)}"></div>`).join('');
  }
  fgPreviewColorEl.addEventListener('change', renderFgRampPreview);

  $('addColor').addEventListener('click', ()=>{ baseColors.push('#888888'); renderSwatches(); });
  $('addGrayColor').addEventListener('click', ()=>{ grayColors.push('#888888'); renderGraySwatches(); });
  $('addFgColor').addEventListener('click', ()=>{ fgColors.push('#888888'); renderFgSwatches(); });
  $('importFgBtn').addEventListener('click', ()=>{
    const list = parseHexList($('importHexFg').value);
    if(list.length){ fgColors = list; fgGroupOf = null; renderFgSwatches(); }
  });
  $('importMainBtn').addEventListener('click', ()=>{
    const list = parseHexList($('importHexMain').value);
    if(list.length){ baseColors = list; renderSwatches(); }
  });
  $('importGrayBtn').addEventListener('click', ()=>{
    const list = parseHexList($('importHexGray').value);
    if(list.length){ grayColors = list; renderGraySwatches(); }
  });

  [sLayersEl,sOpacityEl,hLayersEl,hOpacityEl].forEach(el=>{
    el.addEventListener('input', ()=>{
      $('sLayersVal').textContent = sLayersEl.value;
      $('sOpacityVal').textContent = sOpacityEl.value+'%';
      $('hLayersVal').textContent = hLayersEl.value;
      $('hOpacityVal').textContent = hOpacityEl.value+'%';
      renderRampPreview();
      if(graySyncEl.checked) renderGrayRampPreview();
      if(fgSyncEl.checked) renderFgRampPreview();
    });
  });
  smoothThreshEl.addEventListener('input', ()=>{ $('smoothThreshVal').textContent = smoothThreshEl.value+'%'; });
  passesEl.addEventListener('input', ()=>{ $('passesVal').textContent = passesEl.value; });
  graySatEl.addEventListener('input', ()=>{ $('graySatVal').textContent = graySatEl.value+'%'; });
  [gSLayersEl,gSOpacityEl,gHLayersEl,gHOpacityEl].forEach(el=>{
    el.addEventListener('input', ()=>{
      $('gSLayersVal').textContent = gSLayersEl.value;
      $('gSOpacityVal').textContent = gSOpacityEl.value+'%';
      $('gHLayersVal').textContent = gHLayersEl.value;
      $('gHOpacityVal').textContent = gHOpacityEl.value+'%';
      renderGrayRampPreview();
    });
  });
  [fgSLayersEl,fgSOpacityEl,fgHLayersEl,fgHOpacityEl].forEach(el=>{
    el.addEventListener('input', ()=>{
      $('fgSLayersVal').textContent = fgSLayersEl.value;
      $('fgSOpacityVal').textContent = fgSOpacityEl.value+'%';
      $('fgHLayersVal').textContent = fgHLayersEl.value;
      $('fgHOpacityVal').textContent = fgHOpacityEl.value+'%';
      renderFgRampPreview();
    });
  });
  function updateFgSyncUI(){ fgRampBlockEl.classList.toggle('disabled', fgSyncEl.checked); renderFgRampPreview(); }
  fgSyncEl.addEventListener('change', updateFgSyncUI);
  function updateGraySyncUI(){ grayRampBlockEl.classList.toggle('disabled', graySyncEl.checked); renderGrayRampPreview(); }
  graySyncEl.addEventListener('change', updateGraySyncUI);

  inkDarkNEl.addEventListener('input', ()=>{ $('inkDarkNVal').textContent = inkDarkNEl.value; });
  inkHueThreshEl.addEventListener('input', ()=>{ $('inkHueThreshVal').textContent = inkHueThreshEl.value; });
  inkMaxLEl.addEventListener('input', ()=>{ $('inkMaxLVal').textContent = inkMaxLEl.value+'%'; });
  inkRadiusEl.addEventListener('input', ()=>{ $('inkRadiusVal').textContent = inkRadiusEl.value; });
  solidRejectEl.addEventListener('input', ()=>{ $('solidRejectVal').textContent = solidRejectEl.value+'%'; });
  gapCloseEl.addEventListener('input', ()=>{ $('gapCloseVal').textContent = gapCloseEl.value+'%'; });
  maxRegionAreaEl.addEventListener('input', ()=>{ $('maxRegionAreaVal').textContent = maxRegionAreaEl.value+'%'; });
  familySepEl.addEventListener('input', ()=>{ $('familySepVal').textContent = familySepEl.value; });
  maxFamPerRegionEl.addEventListener('input', ()=>{ $('maxFamPerRegionVal').textContent = maxFamPerRegionEl.value; });
  landlockedMaxColorsEl.addEventListener('input', ()=>{ $('landlockedMaxColorsVal').textContent = landlockedMaxColorsEl.value; });
  featherRadiusEl.addEventListener('input', ()=>{ $('featherRadiusVal').textContent = featherRadiusEl.value; });
  featherStrengthEl.addEventListener('input', ()=>{ $('featherStrengthVal').textContent = featherStrengthEl.value+'%'; });

  // --- tabs ---
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-'+tab.dataset.tab).classList.add('active');
    });
  });

  // ---------- settings (export/import/presets/autosave) ----------
  function currentSettings(){
    return {
      baseColors, grayColors, fgColors, fgGroupOf,
      sLayers: +sLayersEl.value, sOpacity: +sOpacityEl.value,
      hLayers: +hLayersEl.value, hOpacity: +hOpacityEl.value,
      dither: ditherEl.checked,
      smoothEnabled: smoothEnabledEl.checked, smoothThresh: +smoothThreshEl.value,
      neighborMode: neighborModeEl.value, passes: +passesEl.value,
      grayEnabled: grayEnabledEl.checked, graySat: +graySatEl.value,
      forceGrayscale: forceGrayscaleEl.checked,
      graySync: graySyncEl.checked,
      gSLayers: +gSLayersEl.value, gSOpacity: +gSOpacityEl.value,
      gHLayers: +gHLayersEl.value, gHOpacity: +gHOpacityEl.value,
      lineartEnabled: lineartEnabledEl.checked,
      noRealBackground: noRealBackgroundEl.checked,
      excludeRealBgMatches: excludeRealBgMatchesEl.checked,
      landlockedEnabled: landlockedEnabledEl.checked, landlockedMaxColors: +landlockedMaxColorsEl.value,
      inkDarkN: +inkDarkNEl.value, inkHueThresh: +inkHueThreshEl.value, inkMaxL: +inkMaxLEl.value,
      inkRadius: +inkRadiusEl.value, solidReject: +solidRejectEl.value, gapClose: +gapCloseEl.value,
      maxRegionArea: +maxRegionAreaEl.value, familySep: +familySepEl.value, maxFamPerRegion: +maxFamPerRegionEl.value,
      fgSync: fgSyncEl.checked,
      fgSLayers: +fgSLayersEl.value, fgSOpacity: +fgSOpacityEl.value,
      fgHLayers: +fgHLayersEl.value, fgHOpacity: +fgHOpacityEl.value,
      featherLineartEnabled: featherLineartEl.checked, featherGeneralEnabled: featherGeneralEl.checked,
      featherRadius: +featherRadiusEl.value, featherStrength: +featherStrengthEl.value
    };
  }

  function applySettings(cfg){
    if(cfg.baseColors) baseColors = cfg.baseColors;
    if(cfg.grayColors) grayColors = cfg.grayColors;
    if(cfg.fgColors) fgColors = cfg.fgColors;
    fgGroupOf = (cfg.fgGroupOf!=null) ? cfg.fgGroupOf : null;
    if(cfg.sLayers!=null) sLayersEl.value = cfg.sLayers;
    if(cfg.sOpacity!=null) sOpacityEl.value = cfg.sOpacity;
    if(cfg.hLayers!=null) hLayersEl.value = cfg.hLayers;
    if(cfg.hOpacity!=null) hOpacityEl.value = cfg.hOpacity;
    if(cfg.dither!=null) ditherEl.checked = cfg.dither;
    if(cfg.smoothEnabled!=null) smoothEnabledEl.checked = cfg.smoothEnabled;
    if(cfg.smoothThresh!=null) smoothThreshEl.value = cfg.smoothThresh;
    if(cfg.neighborMode!=null) neighborModeEl.value = cfg.neighborMode;
    if(cfg.passes!=null) passesEl.value = cfg.passes;
    if(cfg.grayEnabled!=null) grayEnabledEl.checked = cfg.grayEnabled;
    if(cfg.graySat!=null) graySatEl.value = cfg.graySat;
    if(cfg.forceGrayscale!=null) forceGrayscaleEl.checked = cfg.forceGrayscale;
    if(cfg.graySync!=null) graySyncEl.checked = cfg.graySync;
    if(cfg.gSLayers!=null) gSLayersEl.value = cfg.gSLayers;
    if(cfg.gSOpacity!=null) gSOpacityEl.value = cfg.gSOpacity;
    if(cfg.gHLayers!=null) gHLayersEl.value = cfg.gHLayers;
    if(cfg.gHOpacity!=null) gHOpacityEl.value = cfg.gHOpacity;
    if(cfg.lineartEnabled!=null) lineartEnabledEl.checked = cfg.lineartEnabled;
    if(cfg.noRealBackground!=null) noRealBackgroundEl.checked = cfg.noRealBackground;
    if(cfg.excludeRealBgMatches!=null) excludeRealBgMatchesEl.checked = cfg.excludeRealBgMatches;
    if(cfg.landlockedEnabled!=null) landlockedEnabledEl.checked = cfg.landlockedEnabled;
    if(cfg.landlockedMaxColors!=null) landlockedMaxColorsEl.value = cfg.landlockedMaxColors;
    if(cfg.inkDarkN!=null) inkDarkNEl.value = cfg.inkDarkN;
    if(cfg.inkHueThresh!=null) inkHueThreshEl.value = cfg.inkHueThresh;
    if(cfg.inkMaxL!=null) inkMaxLEl.value = cfg.inkMaxL;
    if(cfg.inkRadius!=null) inkRadiusEl.value = cfg.inkRadius;
    if(cfg.solidReject!=null) solidRejectEl.value = cfg.solidReject;
    if(cfg.gapClose!=null) gapCloseEl.value = cfg.gapClose;
    if(cfg.maxRegionArea!=null) maxRegionAreaEl.value = cfg.maxRegionArea;
    if(cfg.familySep!=null) familySepEl.value = cfg.familySep;
    if(cfg.maxFamPerRegion!=null) maxFamPerRegionEl.value = cfg.maxFamPerRegion;
    if(cfg.fgSync!=null) fgSyncEl.checked = cfg.fgSync;
    if(cfg.fgSLayers!=null) fgSLayersEl.value = cfg.fgSLayers;
    if(cfg.fgSOpacity!=null) fgSOpacityEl.value = cfg.fgSOpacity;
    if(cfg.fgHLayers!=null) fgHLayersEl.value = cfg.fgHLayers;
    if(cfg.fgHOpacity!=null) fgHOpacityEl.value = cfg.fgHOpacity;
    if(cfg.featherLineartEnabled!=null) featherLineartEl.checked = cfg.featherLineartEnabled;
    if(cfg.featherGeneralEnabled!=null) featherGeneralEl.checked = cfg.featherGeneralEnabled;
    if(cfg.featherRadius!=null) featherRadiusEl.value = cfg.featherRadius;
    if(cfg.featherStrength!=null) featherStrengthEl.value = cfg.featherStrength;

    $('sLayersVal').textContent = sLayersEl.value;
    $('sOpacityVal').textContent = sOpacityEl.value+'%';
    $('hLayersVal').textContent = hLayersEl.value;
    $('hOpacityVal').textContent = hOpacityEl.value+'%';
    $('smoothThreshVal').textContent = smoothThreshEl.value+'%';
    $('passesVal').textContent = passesEl.value;
    $('graySatVal').textContent = graySatEl.value+'%';
    $('gSLayersVal').textContent = gSLayersEl.value;
    $('gSOpacityVal').textContent = gSOpacityEl.value+'%';
    $('gHLayersVal').textContent = gHLayersEl.value;
    $('gHOpacityVal').textContent = gHOpacityEl.value+'%';
    $('inkDarkNVal').textContent = inkDarkNEl.value;
    $('inkHueThreshVal').textContent = inkHueThreshEl.value;
    $('inkMaxLVal').textContent = inkMaxLEl.value+'%';
    $('inkRadiusVal').textContent = inkRadiusEl.value;
    $('solidRejectVal').textContent = solidRejectEl.value+'%';
    $('gapCloseVal').textContent = gapCloseEl.value+'%';
    $('maxRegionAreaVal').textContent = maxRegionAreaEl.value+'%';
    $('familySepVal').textContent = familySepEl.value;
    $('maxFamPerRegionVal').textContent = maxFamPerRegionEl.value;
    $('landlockedMaxColorsVal').textContent = landlockedMaxColorsEl.value;
    $('fgSLayersVal').textContent = fgSLayersEl.value;
    $('fgSOpacityVal').textContent = fgSOpacityEl.value+'%';
    $('fgHLayersVal').textContent = fgHLayersEl.value;
    $('fgHOpacityVal').textContent = fgHOpacityEl.value+'%';
    $('featherRadiusVal').textContent = featherRadiusEl.value;
    $('featherStrengthVal').textContent = featherStrengthEl.value+'%';

    updateGraySyncUI();
    updateFgSyncUI();
    renderSwatches(); renderGraySwatches(); renderFgSwatches();
  }

  $('exportCfgBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(currentSettings(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'palette-matcher-config.json';
    a.click();
  });
  $('importCfgBtn').addEventListener('click', ()=> $('importCfgFile').click());
  $('importCfgFile').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      try{ applySettings(JSON.parse(ev.target.result)); }
      catch(err){ alert('El archivo de configuración no es válido.'); }
    };
    reader.readAsText(file);
  });

  // ---------- presets nombrados + autosave ----------
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

  const scheduleAutosave = PM.presets.debounce(()=>{ store.saveLastConfig(currentSettings()); }, 400);
  document.querySelector('#tool-palette .panel').addEventListener('input', scheduleAutosave);
  document.querySelector('#tool-palette .panel').addEventListener('change', scheduleAutosave);

  // ---------- opts para el pipeline (lo que consume worker-pool.js) ----------
  // Puro: función de un objeto con la forma de currentSettings(), sin tocar DOM — así
  // el tool Sequence puede armar opts a partir de un preset guardado sin que Palette
  // Matcher sea el tab activo (y sin re-leer sliders que ni están montados con esos
  // valores en ese momento).
  ui.buildProcessOpts = function(settings, includeDebug){
    const sLayers = settings.sLayers, sOpacityPct = settings.sOpacity;
    const hLayers = settings.hLayers, hOpacityPct = settings.hOpacity;
    const baseColors = settings.baseColors, grayColors = settings.grayColors;
    const fgColors = settings.fgColors, fgGroupOf = settings.fgGroupOf;
    const { palette, labPalette, family, numFamilies } = PM.ramp.buildFullPalette(baseColors, sLayers, sOpacityPct, hLayers, hOpacityPct);

    const graySync = settings.graySync;
    const grayPalette = PM.ramp.buildGrayFullPalette(
      grayColors,
      graySync? sLayers : settings.gSLayers, graySync? sOpacityPct : settings.gSOpacity,
      graySync? hLayers : settings.gHLayers, graySync? hOpacityPct : settings.gHOpacity
    );
    const grayLum = grayPalette.map(c=>rgbToLab(c[0],c[1],c[2])[0]);

    const lineartEnabled = settings.lineartEnabled;
    const fgSync = settings.fgSync;
    const lineartOpts = lineartEnabled ? {
      grayPaletteFull: grayPalette,
      inkDarkN: settings.inkDarkN,
      inkHueThresh: settings.inkHueThresh,
      inkMaxL: settings.inkMaxL,
      inkRadius: settings.inkRadius,
      solidReject: settings.solidReject,
      gapClose: settings.gapClose,
      maxRegionAreaPct: settings.maxRegionArea,
      familySep: settings.familySep,
      maxFamPerRegion: settings.maxFamPerRegion,
      skipBackgroundCheck: settings.noRealBackground,
      excludeRealBackgroundMatches: settings.excludeRealBgMatches,
      landlockedEnabled: settings.landlockedEnabled,
      landlockedMaxColors: settings.landlockedMaxColors,
      bgFamilyAB: baseColors.map(hex=>{ const [,a,bb]=rgbToLab(...hexToRgb(hex)); return [a,bb]; }),
      fg: PM.ramp.buildFgFullPalette(
        fgColors, fgGroupOf,
        fgSync? sLayers : settings.fgSLayers, fgSync? sOpacityPct : settings.fgSOpacity,
        fgSync? hLayers : settings.fgHLayers, fgSync? hOpacityPct : settings.fgHOpacity
      )
    } : null;

    return {
      palette, labPalette, family, numFamilies,
      grayPalette, grayLum,
      grayEnabled: settings.grayEnabled,
      graySatThresh: settings.graySat,
      forceGrayscale: settings.forceGrayscale,
      useDither: settings.dither,
      smoothEnabled: settings.smoothEnabled,
      smoothThreshPct: settings.smoothThresh,
      neighborMode: settings.neighborMode,
      passes: settings.passes,
      lineartEnabled, lineartOpts,
      includeDebug: !!includeDebug,
      featherGeneralEnabled: settings.featherGeneralEnabled,
      featherLineartEnabled: settings.featherLineartEnabled,
      featherRadius: settings.featherRadius,
      featherStrengthPct: settings.featherStrength
    };
  };

  ui.currentProcessOpts = function(includeDebug){
    return ui.buildProcessOpts(currentSettings(), includeDebug);
  };

  ui.currentSettings = currentSettings;
  ui.applySettings = applySettings;

  // ---------- boot ----------
  ui.init = function(){
    const last = store.loadLastConfig();
    if(last) applySettings(last);
    else { renderSwatches(); renderGraySwatches(); renderFgSwatches(); }
    updateGraySyncUI();
    updateFgSyncUI();
    refreshPresetSelect();
  };
})();
