// Wiring del tool Sequence: lista de bloques (tool + preset), reorder, drop de imagen,
// y el runner que encadena PM.pipelineTools[block.tool].run(...) pasando el File de
// salida de un bloque como entrada del siguiente.
(function(){
  const PM = self.PM = self.PM || {};
  const store = PM.presets.createStore('sequence');

  const blocksListEl = document.getElementById('sequenceBlocksList');
  const addBlockBtn = document.getElementById('sequenceAddBlockBtn');
  const countBadgeEl = document.getElementById('sequenceCountBadge');
  const drop = document.getElementById('sequenceDrop');
  const fileInput = document.getElementById('sequenceFileInput');
  const srcImg = document.getElementById('sequenceSrcImg');
  const runBtn = document.getElementById('sequenceRunBtn');
  const imagesGridEl = document.getElementById('sequenceImagesGrid');
  const statsEl = document.getElementById('sequenceStats');
  const dlBtn = document.getElementById('sequenceDlBtn');
  const dlFormatEl = document.getElementById('sequenceDlFormat');

  let blocks = []; // [{tool, preset}]
  let loadedFile = null;
  let lastCanvas = null;
  let lastText = null; // { text, ext, mime } cuando el último bloque es un tool de texto
  let dlUrl = null;

  const scheduleAutosave = PM.presets.debounce(()=>{ store.saveLastConfig({ blocks }); }, 400);

  function updateRunEnabled(){
    runBtn.disabled = !loadedFile || blocks.length===0 || blocks.some(b=>!b.preset) || PM.validateSequence(blocks).length>0;
  }

  function renderBlocks(){
    blocksListEl.innerHTML = '';
    const toolIds = Object.keys(PM.pipelineTools);
    const errorsByIndex = new Map(PM.validateSequence(blocks).map(e=>[e.index, e.message]));

    blocks.forEach((block, i)=>{
      const row = document.createElement('div');
      row.className = 'seq-block' + (errorsByIndex.has(i) ? ' seq-block-error' : '');

      const toolOptions = toolIds.map(id=>
        `<option value="${id}" ${block.tool===id?'selected':''}>${PM.pipelineTools[id].label}</option>`
      ).join('');

      const presets = PM.pipelineTools[block.tool].listPresets();
      const presetOptions = presets.length
        ? '<option value="">— elegir preset —</option>' + presets.map(p=>`<option value="${p}" ${block.preset===p?'selected':''}>${p}</option>`).join('')
        : '<option value="">— sin presets guardados —</option>';

      row.innerHTML = `
        <div class="seq-block-head">
          <span class="seq-block-num">${i+1}</span>
          <select class="seq-tool-select" data-i="${i}">${toolOptions}</select>
          <div class="seq-block-actions">
            <button class="seq-up" data-i="${i}" title="subir" ${i===0?'disabled':''}>↑</button>
            <button class="seq-down" data-i="${i}" title="bajar" ${i===blocks.length-1?'disabled':''}>↓</button>
            <button class="seq-remove" data-i="${i}" title="quitar">✕</button>
          </div>
        </div>
        <select class="seq-preset-select" data-i="${i}">${presetOptions}</select>
        ${errorsByIndex.has(i) ? `<div class="seq-error">⛔ ${errorsByIndex.get(i)}</div>` : ''}
      `;
      blocksListEl.appendChild(row);
    });

    blocksListEl.querySelectorAll('.seq-tool-select').forEach(sel=>{
      sel.addEventListener('change', e=>{
        const i = +e.target.dataset.i;
        blocks[i].tool = e.target.value;
        const firstPreset = PM.pipelineTools[blocks[i].tool].listPresets()[0];
        blocks[i].preset = firstPreset || '';
        renderBlocks(); scheduleAutosave();
      });
    });
    blocksListEl.querySelectorAll('.seq-preset-select').forEach(sel=>{
      sel.addEventListener('change', e=>{
        const i = +e.target.dataset.i;
        blocks[i].preset = e.target.value;
        scheduleAutosave(); updateRunEnabled();
      });
    });
    blocksListEl.querySelectorAll('.seq-up').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const i = +e.target.dataset.i;
        if(i<=0) return;
        [blocks[i-1], blocks[i]] = [blocks[i], blocks[i-1]];
        renderBlocks(); scheduleAutosave();
      });
    });
    blocksListEl.querySelectorAll('.seq-down').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const i = +e.target.dataset.i;
        if(i>=blocks.length-1) return;
        [blocks[i+1], blocks[i]] = [blocks[i], blocks[i+1]];
        renderBlocks(); scheduleAutosave();
      });
    });
    blocksListEl.querySelectorAll('.seq-remove').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const i = +e.target.dataset.i;
        blocks.splice(i,1);
        renderBlocks(); scheduleAutosave();
      });
    });

    countBadgeEl.textContent = blocks.length;
    updateRunEnabled();
  }

  addBlockBtn.addEventListener('click', ()=>{
    const toolIds = Object.keys(PM.pipelineTools);
    const tool = toolIds[0];
    const firstPreset = PM.pipelineTools[tool].listPresets()[0];
    blocks.push({ tool, preset: firstPreset || '' });
    renderBlocks(); scheduleAutosave();
  });

  // ---------- imagen de entrada ----------
  drop.addEventListener('click', ()=>fileInput.click());
  drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
  drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('drag'); if(e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', e=>{ if(e.target.files[0]) loadFile(e.target.files[0]); });

  function loadFile(file){
    loadedFile = file;
    const reader = new FileReader();
    reader.onload = ev=>{ srcImg.src = ev.target.result; srcImg.style.display='block'; updateRunEnabled(); };
    reader.readAsDataURL(file);
    clearResults();
  }

  function clearResults(){
    imagesGridEl.querySelectorAll('figure.seq-step').forEach(f=>f.remove());
    statsEl.innerHTML = '';
    dlBtn.style.display = 'none';
    dlFormatEl.style.display = '';
    lastCanvas = null;
    lastText = null;
  }

  function appendTextFigure(i, toolId, preset, result){
    const figure = document.createElement('figure');
    figure.className = 'seq-step';
    const figcaption = document.createElement('figcaption');
    figcaption.textContent = `${i+1}. ${PM.pipelineTools[toolId].label} (${preset})`;
    const out = document.createElement('textarea');
    out.className = 'text-output';
    out.readOnly = true;
    out.wrap = 'off';
    out.spellcheck = false;
    out.value = result.text;
    figure.appendChild(figcaption);
    figure.appendChild(out);
    imagesGridEl.appendChild(figure);
  }

  async function appendStepFigure(i, toolId, preset, file){
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);

    const figure = document.createElement('figure');
    figure.className = 'seq-step';
    const figcaption = document.createElement('figcaption');
    figcaption.textContent = `${i+1}. ${PM.pipelineTools[toolId].label} (${preset})`;
    const imgwrap = document.createElement('div');
    imgwrap.className = 'imgwrap';
    imgwrap.appendChild(canvas);
    figure.appendChild(figcaption);
    figure.appendChild(imgwrap);
    imagesGridEl.appendChild(figure);
    return canvas;
  }

  runBtn.addEventListener('click', async ()=>{
    if(!loadedFile || blocks.length===0) return;
    runBtn.disabled = true;
    clearResults();
    let currentFile = loadedFile;
    const stepLines = [];
    try{
      const errors = PM.validateSequence(blocks);
      if(errors.length) throw new Error(`Bloque ${errors[0].index+1}: ${errors[0].message}`);
      for(let i=0;i<blocks.length;i++){
        const { tool, preset } = blocks[i];
        if(!preset) throw new Error(`Bloque ${i+1}: falta elegir un preset.`);
        const t0 = performance.now();
        if(PM.pipelineTools[tool].terminal){
          lastText = await PM.pipelineTools[tool].runText(currentFile, preset);
          const t1 = performance.now();
          appendTextFigure(i, tool, preset, lastText);
          stepLines.push(`<span>${i+1}. ${PM.pipelineTools[tool].label} (${preset}) — <b>${(t1-t0).toFixed(0)} ms</b></span>`);
          continue;
        }
        currentFile = await PM.pipelineTools[tool].run(currentFile, preset);
        const t1 = performance.now();
        lastCanvas = await appendStepFigure(i, tool, preset, currentFile);
        stepLines.push(`<span>${i+1}. ${PM.pipelineTools[tool].label} (${preset}) — <b>${(t1-t0).toFixed(0)} ms</b></span>`);
      }
      statsEl.innerHTML = stepLines.join('');
      refreshDownloadLink();
    } catch(err){
      alert('Error corriendo la secuencia: ' + err.message);
      console.error(err);
    } finally {
      updateRunEnabled();
    }
  });

  function refreshDownloadLink(){
    if(lastText){
      if(dlUrl) URL.revokeObjectURL(dlUrl);
      dlUrl = URL.createObjectURL(new Blob([lastText.text], { type:lastText.mime+';charset=utf-8' }));
      dlBtn.href = dlUrl;
      dlBtn.download = 'sequence-result.' + lastText.ext;
      dlBtn.textContent = 'Descargar .' + lastText.ext;
      dlBtn.style.display = 'inline-block';
      dlFormatEl.style.display = 'none';
      return;
    }
    dlFormatEl.style.display = '';
    if(!lastCanvas) return;
    const fmt = dlFormatEl.value;
    if(fmt==='jpg'){
      dlBtn.href = lastCanvas.toDataURL('image/jpeg', 0.92);
      dlBtn.download = 'sequence-result.jpg';
    } else {
      dlBtn.href = lastCanvas.toDataURL('image/png');
      dlBtn.download = 'sequence-result.png';
    }
    dlBtn.textContent = 'Descargar ' + fmt.toUpperCase();
    dlBtn.style.display = 'inline-block';
  }
  dlFormatEl.addEventListener('change', refreshDownloadLink);

  PM.sequenceUi = {
    init(){
      const last = store.loadLastConfig();
      blocks = (last && Array.isArray(last.blocks)) ? last.blocks : [];
      renderBlocks();
    }
  };
})();
