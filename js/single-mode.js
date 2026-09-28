// Modo "imagen única": drag&drop / file picker -> un job al worker pool -> pinta
// resultado + debug (si lineart está activo) -> link de descarga.
(function(){
  const PM = self.PM = self.PM || {};
  const singleMode = PM.singleMode = {};

  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('fileInput');
  const srcImg = document.getElementById('srcImg');
  const runBtn = document.getElementById('runBtn');
  const outCanvas = document.getElementById('outCanvas');
  const debugCanvas = document.getElementById('debugCanvas');
  const debugFigure = document.getElementById('debugFigure');
  const debugHint = document.getElementById('debugHint');
  const debugHintGeneral = document.getElementById('debugHintGeneral');
  const debugModeSelect = document.getElementById('debugModeSelect');
  const imagesGrid = document.getElementById('imagesGrid');
  const statsEl = document.getElementById('stats');
  const dlBtn = document.getElementById('dlBtn');
  const dlFormatEl = document.getElementById('dlFormat');

  let loadedFile = null;
  let lastDebugBlob = null, lastDebugGeneralBlob = null;

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
  // Expuesto para que otros tools (ej. Pixelate) puedan mandar su resultado
  // directo al Palette Matcher sin pasar por el file picker.
  singleMode.loadFile = loadFile;

  async function bitmapToCanvas(blob, canvas){
    const bitmap = await createImageBitmap(blob);
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
  }

  // Cambiar el selector solo redibuja desde el blob ya generado — no reprocesa la imagen.
  async function renderSelectedDebugView(){
    const showGeneral = debugModeSelect.value === 'general';
    const blob = showGeneral ? lastDebugGeneralBlob : lastDebugBlob;
    if(!blob) return;
    await bitmapToCanvas(blob, debugCanvas);
    debugHint.style.display = showGeneral ? 'none' : '';
    debugHintGeneral.style.display = showGeneral ? '' : 'none';
  }
  debugModeSelect.addEventListener('change', renderSelectedDebugView);

  runBtn.addEventListener('click', async ()=>{
    if(!loadedFile) return;
    runBtn.disabled = true;
    const t0 = performance.now();
    try{
      const opts = PM.ui.currentProcessOpts(true);
      opts.outputMime = 'image/png';
      opts.outputQuality = 1;

      const result = await PM.workerPool.processFile(loadedFile, opts);
      await bitmapToCanvas(result.blob, outCanvas);
      outCanvas.style.display = 'block';

      if(opts.lineartEnabled && result.debugBlob){
        lastDebugBlob = result.debugBlob;
        lastDebugGeneralBlob = result.debugGeneralBlob;
        await renderSelectedDebugView();
        debugFigure.style.display = '';
        imagesGrid.classList.add('with-debug');
      } else {
        lastDebugBlob = null; lastDebugGeneralBlob = null;
        debugFigure.style.display = 'none';
        debugHint.style.display = 'none';
        debugHintGeneral.style.display = 'none';
        imagesGrid.classList.remove('with-debug');
      }

      const t1 = performance.now();
      statsEl.innerHTML =
        `<span>pixeles: <b>${(result.width*result.height).toLocaleString()}</b></span>` +
        `<span>colores en paleta: <b>${result.paletteSize}</b></span>` +
        `<span>tiempo: <b>${(t1-t0).toFixed(0)} ms</b></span>` +
        `<span>modo: <b>${PM.workerPool.usingWorkers ? 'worker' : 'hilo principal (fallback)'}</b></span>`;

      refreshDownloadLink();
    } catch(err){
      alert('Error procesando la imagen: ' + err.message);
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
      dlBtn.download = 'palette-matched.jpg';
    } else {
      dlBtn.href = outCanvas.toDataURL('image/png');
      dlBtn.download = 'palette-matched.png';
    }
    dlBtn.textContent = 'Descargar ' + fmt.toUpperCase();
    dlBtn.style.display = 'inline-block';
  }
  dlFormatEl.addEventListener('change', refreshDownloadLink);
})();
