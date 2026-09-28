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
})();
