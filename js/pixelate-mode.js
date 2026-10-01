// Modo del tool Pixelate: drag&drop / file picker -> pixelate.processImageData en el
// hilo principal (sin worker, ver pixelate.js) -> canvas resultado -> descarga, y un
// atajo para mandar el resultado directo al Palette Matcher.
(function(){
  const PM = self.PM = self.PM || {};

  const drop = document.getElementById('pixelateDrop');
  const fileInput = document.getElementById('pixelateFileInput');
  const srcImg = document.getElementById('pixelateSrcImg');
  const runBtn = document.getElementById('pixelateRunBtn');
  const outCanvas = document.getElementById('pixelateOutCanvas');
  const statsEl = document.getElementById('pixelateStats');
  const dlBtn = document.getElementById('pixelateDlBtn');
  const dlFormatEl = document.getElementById('pixelateDlFormat');
  const sendToPaletteBtn = document.getElementById('sendToPaletteBtn');

  let loadedFile = null;

  drop.addEventListener('click', ()=>fileInput.click());
  drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
  drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('drag'); if(e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', e=>{ if(e.target.files[0]) loadFile(e.target.files[0]); });

  function loadFile(file){
    loadedFile = file;
    const reader = new FileReader();
    reader.onload = ev=>{ srcImg.src = ev.target.result; srcImg.style.display='block'; runBtn.disabled=false; };
    reader.readAsDataURL(file);
  }

  runBtn.addEventListener('click', async ()=>{
    if(!loadedFile) return;
    runBtn.disabled = true;
    const t0 = performance.now();
    try{
      const opts = PM.pixelateUi.currentOpts();
      const outFile = await PM.pixelate.runToFile(loadedFile, opts);
      const outBitmap = await createImageBitmap(outFile);

      outCanvas.width = outBitmap.width;
      outCanvas.height = outBitmap.height;
      outCanvas.getContext('2d').drawImage(outBitmap, 0, 0);
      outCanvas.style.display = 'block';

      const t1 = performance.now();
      statsEl.innerHTML =
        `<span>grid real: <b>${opts.gridCols}×${opts.gridRows} px</b></span>` +
        `<span>salida (upscale ${opts.upscale}×): <b>${outCanvas.width}×${outCanvas.height} px</b></span>` +
        `<span>método: <b>${opts.method==='dominant'?'dominante':'promedio'}</b></span>` +
        `<span>tiempo: <b>${(t1-t0).toFixed(0)} ms</b></span>`;

      refreshDownloadLink();
      sendToPaletteBtn.style.display = 'inline-block';
    } catch(err){
      alert('Error pixelando la imagen: ' + err.message);
      console.error(err);
    } finally {
      runBtn.disabled = false;
    }
  });

  function refreshDownloadLink(){
    if(outCanvas.style.display==='none') return;
    const fmt = dlFormatEl.value;
    if(fmt==='jpg'){
      dlBtn.href = outCanvas.toDataURL('image/jpeg', 0.92);
      dlBtn.download = 'pixelated.jpg';
    } else {
      dlBtn.href = outCanvas.toDataURL('image/png');
      dlBtn.download = 'pixelated.png';
    }
    dlBtn.textContent = 'Descargar ' + fmt.toUpperCase();
    dlBtn.style.display = 'inline-block';
  }
  dlFormatEl.addEventListener('change', refreshDownloadLink);

  sendToPaletteBtn.addEventListener('click', ()=>{
    outCanvas.toBlob(blob=>{
      if(!blob) return;
      const file = new File([blob], 'pixelated.png', { type:'image/png' });
      PM.singleMode.loadFile(file);
      PM.tools.switchTo('palette');
    }, 'image/png');
  });

  // ---------- selector de vista (propio, igual que Subtract) ----------
  document.querySelectorAll('.mode-tab[data-mode-group="pixelate"]').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.mode-tab[data-mode-group="pixelate"]').forEach(t=>t.classList.toggle('active', t===tab));
      document.querySelectorAll('.mode-panel[data-mode-group="pixelate"]').forEach(p=>p.classList.toggle('active', p.id==='pixelateMode-'+tab.dataset.mode));
    });
  });

  // ---------- vista: carpeta (batch) ----------
  // Pixelate corre en el hilo principal (sin workers), así que el batch es en serie.
  const folderDrop = document.getElementById('pixelateFolderDrop');
  const folderInput = document.getElementById('pixelateFolderInput');
  const fileListBox = document.getElementById('pixelateFileListBox');
  const batchFormatEl = document.getElementById('pixelateBatchFormat');
  const progressBar = document.getElementById('pixelateProgressBar');
  const batchRunBtn = document.getElementById('pixelateBatchRunBtn');
  const batchStatsEl = document.getElementById('pixelateBatchStats');
  const batchDlBtn = document.getElementById('pixelateBatchDlBtn');

  let batchFiles = [];
  let zipUrl = null;
  const relPathOf = f => PM.fileUtils.relPathOf(f);

  function setBatchFiles(list){
    batchFiles = list.filter(f=>f.type.startsWith('image/'));
    if(batchFiles.length===0){ fileListBox.textContent = 'ningún archivo seleccionado'; batchRunBtn.disabled = true; return; }
    fileListBox.innerHTML = batchFiles.map(f=>`<div>${relPathOf(f)}</div>`).join('');
    batchRunBtn.disabled = false;
  }

  folderDrop.addEventListener('click', ()=>folderInput.click());
  folderInput.addEventListener('change', e=>setBatchFiles(Array.from(e.target.files)));
  folderDrop.addEventListener('dragover', e=>{ e.preventDefault(); folderDrop.classList.add('drag'); });
  folderDrop.addEventListener('dragleave', ()=> folderDrop.classList.remove('drag'));
  folderDrop.addEventListener('drop', async e=>{
    e.preventDefault(); folderDrop.classList.remove('drag');
    setBatchFiles(await PM.fileUtils.collectFromDrop(e.dataTransfer));
  });

  function splitExt(filename){
    const dot = filename.lastIndexOf('.');
    return dot===-1 ? [filename, 'png'] : [filename.slice(0,dot), filename.slice(dot+1).toLowerCase()];
  }

  // runToFile siempre devuelve PNG; si el destino es otro formato, se reencodea por canvas.
  async function encodeAs(pngFile, ext){
    if(ext==='png') return pngFile;
    const mime = (ext==='jpg'||ext==='jpeg') ? 'image/jpeg' : ext==='webp' ? 'image/webp' : 'image/png';
    const bmp = await createImageBitmap(pngFile);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    if(mime==='image/jpeg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0);
    return new Promise(res=>c.toBlob(res, mime, 0.92));
  }

  batchRunBtn.addEventListener('click', async ()=>{
    if(batchFiles.length===0) return;
    batchRunBtn.disabled = true;
    batchDlBtn.style.display = 'none';
    if(zipUrl){ URL.revokeObjectURL(zipUrl); zipUrl = null; }
    const t0 = performance.now();
    const opts = PM.pixelateUi.currentOpts();
    const fmtOverride = batchFormatEl.value;
    const zip = new JSZip();
    let done = 0, failed = 0;
    const total = batchFiles.length;

    function updateProgress(){
      progressBar.style.width = Math.round(((done+failed)/total)*100)+'%';
      batchStatsEl.innerHTML =
        `<span>procesados: <b>${done}/${total}</b></span>` +
        (failed?`<span>fallidos: <b>${failed}</b></span>`:'');
    }
    updateProgress();

    for(const file of batchFiles){
      const relPath = relPathOf(file);
      const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')+1) : '';
      const [base, origExt] = splitExt(relPath.split('/').pop());
      const ext = fmtOverride==='same' ? origExt : fmtOverride;
      try{
        const png = await PM.pixelate.runToFile(file, opts);
        zip.file(dir + base + '_pixelated.' + ext, await encodeAs(png, ext));
        done++;
      } catch(err){
        console.error('Fallo pixelando', relPath, err);
        failed++;
      }
      updateProgress();
    }

    const zipBlob = await zip.generateAsync({type:'blob'});
    zipUrl = URL.createObjectURL(zipBlob);
    batchDlBtn.href = zipUrl;
    batchDlBtn.style.display = 'inline-block';
    batchStatsEl.innerHTML =
      `<span>procesados: <b>${done}/${total}</b></span>` +
      (failed?`<span>fallidos: <b>${failed}</b></span>`:'') +
      `<span>tiempo total: <b>${((performance.now()-t0)/1000).toFixed(1)} s</b></span>`;
    batchRunBtn.disabled = false;
  });
})();
