// Shell multi-tool: switcher entre tools (Palette Matcher / Pixelate / lo que se agregue)
// + accordion genérico para las .section de cualquier panel. Puramente DOM, sin estado
// de negocio — cada tool sigue dueño de su propia lógica en sus propios archivos.
(function(){
  const PM = self.PM = self.PM || {};
  const tools = PM.tools = {};

  const ACTIVE_TOOL_KEY = 'imageProcessor.activeTool';
  const COLLAPSED_KEY = 'imageProcessor.ui.collapsed';

  function readCollapsedMap(){
    try{
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(err){ return {}; }
  }
  function writeCollapsedMap(map){
    try{ localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map)); }
    catch(err){ /* localStorage lleno o deshabilitado — no es crítico */ }
  }

  function initCollapsibleSections(){
    const collapsed = readCollapsedMap();
    document.querySelectorAll('.section[id]').forEach(section=>{
      if(collapsed[section.id]) section.classList.add('collapsed');
      const h2 = section.querySelector('h2');
      h2.addEventListener('click', ()=>{
        section.classList.toggle('collapsed');
        const map = readCollapsedMap();
        map[section.id] = section.classList.contains('collapsed');
        writeCollapsedMap(map);
      });
    });
  }

  tools.switchTo = function(toolId){
    document.querySelectorAll('.tool-tab').forEach(t=>{
      t.classList.toggle('active', t.dataset.tool===toolId);
    });
    document.querySelectorAll('.tool-view').forEach(v=>{
      v.classList.toggle('active', v.id==='tool-'+toolId);
    });
    try{ localStorage.setItem(ACTIVE_TOOL_KEY, toolId); }
    catch(err){ /* no es crítico */ }
  };

  function initToolTabs(){
    document.querySelectorAll('.tool-tab').forEach(tab=>{
      tab.addEventListener('click', ()=> tools.switchTo(tab.dataset.tool));
    });
    let last = null;
    try{ last = localStorage.getItem(ACTIVE_TOOL_KEY); } catch(err){ /* no es crítico */ }
    if(last && document.getElementById('tool-'+last)) tools.switchTo(last);
  }

  // Doble click en cualquier slider -> input numérico para escribir el valor exacto
  // (clamped a min/max) en vez de tener que atinarle arrastrando. Genérico: corre una
  // sola vez para TODOS los sliders del documento, sin importar el tool/tab activo.
  function initEditableSliders(){
    document.querySelectorAll('input[type=range]').forEach(slider=>{
      slider.addEventListener('dblclick', ()=>{
        if(slider.style.display==='none') return; // ya hay un edit abierto para este slider
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'slider-edit-input';
        input.min = slider.min; input.max = slider.max; input.step = slider.step || 1;
        input.value = slider.value;

        slider.style.display = 'none';
        slider.after(input);
        input.focus();
        input.select();

        let done = false;
        function commit(){
          if(done) return; done = true;
          let v = parseFloat(input.value);
          if(isNaN(v)) v = +slider.value;
          v = Math.min(+slider.max, Math.max(+slider.min, v));
          slider.value = v;
          cleanup();
          slider.dispatchEvent(new Event('input', { bubbles:true }));
          slider.dispatchEvent(new Event('change', { bubbles:true }));
        }
        function cancel(){
          if(done) return; done = true;
          cleanup();
        }
        function cleanup(){
          input.remove();
          slider.style.display = '';
        }
        input.addEventListener('keydown', e=>{
          if(e.key==='Enter') commit();
          else if(e.key==='Escape') cancel();
        });
        input.addEventListener('blur', commit);
      });
    });
  }

  tools.init = function(){
    initToolTabs();
    initCollapsibleSections();
    initEditableSliders();
  };
})();
