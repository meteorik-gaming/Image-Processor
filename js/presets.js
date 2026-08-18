// Autosave de la config en localStorage + presets nombrados. Puramente main-thread
// (no se necesita dentro del worker). No sabe nada de DOM: ui.js le pasa el objeto plano
// que arma currentSettings() y usa applySettings(cfg) para restaurarlo.
(function(){
  const PM = self.PM = self.PM || {};
  const presets = PM.presets = {};

  const LAST_CONFIG_KEY = 'paletteMatcher.lastConfig';
  const PRESETS_KEY = 'paletteMatcher.presets';

  function readPresetsMap(){
    try{
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(err){ return {}; }
  }
  function writePresetsMap(map){
    localStorage.setItem(PRESETS_KEY, JSON.stringify(map));
  }

  presets.saveLastConfig = function(settings){
    try{ localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(settings)); }
    catch(err){ /* localStorage lleno o deshabilitado — no es crítico, se ignora */ }
  };

  presets.loadLastConfig = function(){
    try{
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(err){ return null; }
  };

  presets.listPresetNames = function(){
    return Object.keys(readPresetsMap()).sort((a,b)=>a.localeCompare(b));
  };

  presets.savePreset = function(name, settings){
    const map = readPresetsMap();
    map[name] = settings;
    writePresetsMap(map);
  };

  presets.loadPreset = function(name){
    const map = readPresetsMap();
    return map[name] || null;
  };

  presets.deletePreset = function(name){
    const map = readPresetsMap();
    delete map[name];
    writePresetsMap(map);
  };

  // debounce genérico chiquito, solo lo usa el autosave de config
  presets.debounce = function(fn, ms){
    let t = null;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(null,args), ms);
    };
  };
})();
