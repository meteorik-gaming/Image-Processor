// Modo del tool Subtract. Dos vistas: "par de imágenes" (A base + B a restar -> PNG) y
// "carpetas" (carpeta A + carpeta B, emparejadas por nombre -> un PNG por par en un .zip).
// Todo en hilo principal (ver subtract.js), sin worker.
(function(){
  const PM = self.PM = self.PM || {};
  const $ = id => document.getElementById(id);
  const relPathOf = PM.fileUtils.relPathOf;

  // ---------- selector de vista (propio: los .tab de Palette Matcher son globales) ----------
  document.querySelectorAll('.mode-tab[data-mode-group="subtract"]').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.mode-tab[data-mode-group="subtract"]').forEach(t=>t.classList.toggle('active', t===tab));
      document.querySelectorAll('.mode-panel[data-mode-group="subtract"]').forEach(p=>p.classList.toggle('active', p.id==='subtractMode-'+tab.dataset.mode));
    });
  });

  function baseName(name){
    const dot = name.lastIndexOf('.');
    return dot===-1 ? name : name.slice(0, dot);
  }
  function dropZone(zone, input, onFiles){
    zone.addEventListener('click', ()=>input.click());
    zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', ()=> zone.classList.remove('drag'));
    zone.addEventListener('drop', async e=>{
      e.preventDefault(); zone.classList.remove('drag');
      onFiles(await PM.fileUtils.collectFromDrop(e.dataTransfer));
    });
    input.addEventListener('change', e=>{ if(e.target.files.length) onFiles(Array.from(e.target.files)); });
  }
  const imagesOnly = list => list.filter(f=>f.type.startsWith('image/'));

  // =====================================================================
  //  Vista: par de imágenes
  // =====================================================================
  const single = {
    a: { file:null, dims:null, url:null, drop:$('subtractDropA'), input:$('subtractFileA'), img:$('subtractImgA'), label:$('subtractLabelA') },
    b: { file:null, dims:null, url:null, drop:$('subtractDropB'), input:$('subtractFileB'), img:$('subtractImgB'), label:$('subtractLabelB') }
  };
  const runBtn = $('subtractRunBtn');
  const sizeErrorEl = $('subtractSizeError');
  const outCanvas = $('subtractOutCanvas');
  const statsEl = $('subtractStats');
  const dlBtn = $('subtractDlBtn');
  let dlUrl = null;

  function refreshReady(){
    const { a, b } = single;
    const both = a.file && b.file && a.dims && b.dims;
    const mismatch = both && (a.dims.w!==b.dims.w || a.dims.h!==b.dims.h);
    sizeErrorEl.style.display = mismatch ? 'block' : 'none';
    if(mismatch) sizeErrorEl.textContent = `⛔ ${PM.subtract.sizeMessage({ width:a.dims.w, height:a.dims.h }, { width:b.dims.w, height:b.dims.h })} Necesitan medir exactamente lo mismo.`;
    runBtn.disabled = !both || mismatch;
  }

  function loadSlot(slot, file){
    if(!file) return;
    slot.file = file; slot.dims = null;
    if(slot.url) URL.revokeObjectURL(slot.url);
    slot.url = URL.createObjectURL(file);
    slot.img.onload = ()=>{ slot.dims = { w:slot.img.naturalWidth, h:slot.img.naturalHeight }; refreshReady(); };
    slot.img.src = slot.url;
    slot.img.style.display = 'block';
    slot.label.textContent = file.name;
    refreshReady();
  }
  ['a','b'].forEach(k=>{
    const slot = single[k];
    dropZone(slot.drop, slot.input, files=>{ loadSlot(slot, imagesOnly(files)[0]); });
  });

  function setDownload(blob, filename){
    if(dlUrl) URL.revokeObjectURL(dlUrl);
    dlUrl = URL.createObjectURL(blob);
    dlBtn.href = dlUrl;
    dlBtn.download = filename;
    dlBtn.style.display = 'inline-block';
  }

  runBtn.addEventListener('click', async ()=>{
    runBtn.disabled = true;
    const t0 = performance.now();
    try{
      const settings = PM.subtractUi.currentSettings();
      const res = await PM.subtract.run(single.a.file, single.b.file, settings);
      outCanvas.width = res.imageData.width;
      outCanvas.height = res.imageData.height;
      outCanvas.getContext('2d').putImageData(res.imageData, 0, 0);
      outCanvas.parentElement.classList.add('checker');
      outCanvas.style.display = 'block';
      setDownload(await PM.subtract.imageDataToBlob(res.imageData), baseName(single.a.file.name)+'_subtracted.png');
      statsEl.innerHTML =
        `<span>salida: <b>${res.imageData.width}×${res.imageData.height} px${res.cropped?' (recortada)':''}</b></span>` +
        `<span>pixeles que quedaron: <b>${res.kept} (${(res.kept/res.total*100).toFixed(1)}%)</b></span>` +
        (res.kept===0 ? '<span><b>⚠ no quedó nada — baja el umbral o revisa que A y B sean distintas</b></span>' : '') +
        `<span>tiempo: <b>${(performance.now()-t0).toFixed(0)} ms</b></span>`;
    } catch(err){
      alert('Error restando las imágenes: ' + err.message);
      console.error(err);
    } finally {
      refreshReady();
    }
  });

  // =====================================================================
  //  Vista: carpetas (batch por pares)
  // =====================================================================
  const batch = {
    a: { files:[], drop:$('subtractFolderDropA'), input:$('subtractFolderInputA'), info:$('subtractFolderInfoA') },
    b: { files:[], drop:$('subtractFolderDropB'), input:$('subtractFolderInputB'), info:$('subtractFolderInfoB') }
  };
  const batchRunBtn = $('subtractBatchRunBtn');
  const progressBarEl = $('subtractProgressBar');
  const batchStatsEl = $('subtractBatchStats');
  const batchLogEl = $('subtractBatchLog');
  const batchDlBtn = $('subtractBatchDlBtn');
  let batchDlUrl = null;

  // Ruta relativa sin la carpeta raíz elegida ni la extensión: es la llave del emparejado.
  function stemOf(f){
    let p = relPathOf(f);
    const slash = p.indexOf('/');
    if(slash!==-1) p = p.slice(slash+1);
    return baseName(p);
  }

  ['a','b'].forEach(k=>{
    const side = batch[k];
    dropZone(side.drop, side.input, files=>{
      side.files = imagesOnly(files);
      side.info.textContent = side.files.length ? `${side.files.length} imagen(es)` : 'sin imágenes';
      batchRunBtn.disabled = !(batch.a.files.length && batch.b.files.length);
    });
  });
  $('subtractFolderBtnA').addEventListener('click', ()=>batch.a.input.click());
  $('subtractFolderBtnB').addEventListener('click', ()=>batch.b.input.click());

  batchRunBtn.addEventListener('click', async ()=>{
    batchRunBtn.disabled = true;
    const t0 = performance.now();
    const settings = PM.subtractUi.currentSettings();
    const bByKey = new Map(batch.b.files.map(f=>[stemOf(f).toLowerCase(), f]));
    const usedB = new Set();
    const zip = new JSZip();
    const log = [];
    let done = 0;
    progressBarEl.style.width = '0%';
    batchDlBtn.style.display = 'none';

    for(let i=0;i<batch.a.files.length;i++){
      const fileA = batch.a.files[i];
      const stem = stemOf(fileA);
      const fileB = bByKey.get(stem.toLowerCase());
      if(!fileB){
        log.push(`sin pareja en B: ${stem}`);
      } else {
        usedB.add(stem.toLowerCase());
        try{
          const res = await PM.subtract.run(fileA, fileB, settings);
          zip.file(stem+'_subtracted.png', await PM.subtract.imageDataToBlob(res.imageData));
          done++;
          if(res.kept===0) log.push(`no quedó nada: ${stem}`);
        } catch(err){
          console.error('Fallo restando', stem, err);
          log.push(err.code==='size' ? `tamaños distintos, se saltó: ${stem} (${err.message.replace(/^.*?: /,'')})` : `error en ${stem}: ${err.message}`);
        }
      }
      progressBarEl.style.width = Math.round(((i+1)/batch.a.files.length)*100)+'%';
      batchStatsEl.innerHTML = `<span>procesados: <b>${done}/${batch.a.files.length}</b></span>`;
      await new Promise(r=>setTimeout(r, 0)); // deja respirar a la UI entre pares
    }
    bByKey.forEach((f, key)=>{ if(!usedB.has(key)) log.push(`sin pareja en A: ${stemOf(f)}`); });

    if(done>0){
      if(batchDlUrl) URL.revokeObjectURL(batchDlUrl);
      batchDlUrl = URL.createObjectURL(await zip.generateAsync({ type:'blob' }));
      batchDlBtn.href = batchDlUrl;
      batchDlBtn.style.display = 'inline-block';
    }
    batchStatsEl.innerHTML =
      `<span>procesados: <b>${done}/${batch.a.files.length}</b></span>` +
      (log.length ? `<span>avisos: <b>⚠ ${log.length}</b></span>` : '') +
      `<span>tiempo total: <b>${((performance.now()-t0)/1000).toFixed(1)} s</b></span>`;
    batchLogEl.style.display = log.length ? 'block' : 'none';
    batchLogEl.innerHTML = '';
    log.forEach(line=>{ const d = document.createElement('div'); d.textContent = line; batchLogEl.appendChild(d); });
    batchRunBtn.disabled = false;
  });
})();
