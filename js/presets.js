// Autosave de la config en localStorage + presets nombrados. Puramente main-thread
// (no se necesita dentro del worker). No sabe nada de DOM: cada tool.js le pasa el objeto
// plano que arma su currentSettings() y usa applySettings(cfg) para restaurarlo.
// Un store por namespace (un tool = un namespace) para que cada tool tenga su propio
// autosave/presets sin pisar los de los demás.
(function(){
  const PM = self.PM = self.PM || {};
  const presets = PM.presets = {};

  function readPresetsMap(presetsKey){
    try{
      const raw = localStorage.getItem(presetsKey);
      return raw ? JSON.parse(raw) : {};
    } catch(err){ return {}; }
  }
  function writePresetsMap(presetsKey, map){
    localStorage.setItem(presetsKey, JSON.stringify(map));
  }

  // namespace: prefijo de las keys de localStorage, ej. 'paletteMatcher' -> 'paletteMatcher.lastConfig'.
  presets.createStore = function(namespace){
    const lastConfigKey = `${namespace}.lastConfig`;
    const presetsKey = `${namespace}.presets`;
    return {
      saveLastConfig(settings){
        try{ localStorage.setItem(lastConfigKey, JSON.stringify(settings)); }
        catch(err){ /* localStorage lleno o deshabilitado — no es crítico, se ignora */ }
      },
      loadLastConfig(){
        try{
          const raw = localStorage.getItem(lastConfigKey);
          return raw ? JSON.parse(raw) : null;
        } catch(err){ return null; }
      },
      listPresetNames(){
        return Object.keys(readPresetsMap(presetsKey)).sort((a,b)=>a.localeCompare(b));
      },
      savePreset(name, settings){
        const map = readPresetsMap(presetsKey);
        map[name] = settings;
        writePresetsMap(presetsKey, map);
      },
      loadPreset(name){
        return readPresetsMap(presetsKey)[name] || null;
      },
      deletePreset(name){
        const map = readPresetsMap(presetsKey);
        delete map[name];
        writePresetsMap(presetsKey, map);
      }
    };
  };

  // debounce genérico chiquito, lo usa el autosave de config de cada tool
  presets.debounce = function(fn, ms){
    let t = null;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(null,args), ms);
    };
  };
})();
