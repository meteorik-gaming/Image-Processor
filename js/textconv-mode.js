// Modo del tool Text Converter: una imagen -> texto en pantalla (copiar/descargar); varias
// imágenes o una carpeta -> un archivo por imagen dentro de un .zip. Todo en hilo principal
// (ver textconv.js), sin worker.
(function(){
  const PM = self.PM = self.PM || {};

  const $ = id => document.getElementById(id);
  const drop = $('textconvDrop');
  const fileInput = $('textconvFileInput');
  const folderInput = $('textconvFolderInput');
  const folderBtn = $('textconvFolderBtn');
  const srcImg = $('textconvSrcImg');
  const runBtn = $('textconvRunBtn');
  const outEl = $('textconvOut');
  const statsEl = $('textconvStats');
  const progressEl = $('textconvProgress'), progressBarEl = $('textconvProgressBar');
  const copyBtn = $('textconvCopyOutBtn');
  const dlBtn = $('textconvDlBtn');

  let files = [];
  let srcUrl = null, dlUrl = null;

  function relPathOf(f){ return f.webkitRelativePath || f.relPath || f.name; }
  function baseName(name){
    const dot = name.lastIndexOf('.');
    return dot===-1 ? name : name.slice(0, dot);
  }

  function setFiles(list){
    files = list.filter(f=>f.type.startsWith('image/'));
    if(!files.length){ alert('No encontré imágenes en lo que elegiste.'); return; }
    if(srcUrl) URL.revokeObjectURL(srcUrl);
    srcUrl = URL.createObjectURL(files[0]);
    srcImg.src = srcUrl; srcImg.style.display = 'block';
    runBtn.disabled = false;
    runBtn.textContent = files.length>1 ? `Convertir ${files.length} imágenes (.zip)` : 'Convertir a texto';
    statsEl.innerHTML = `<span>imágenes cargadas: <b>${files.length}</b></span>`;
  }

  // Lee archivos sueltos y carpetas (recursivo) de un drop. webkitGetAsEntry tiene que
  // llamarse de forma síncrona sobre todos los items, antes de cualquier await.
  async function collectFromDrop(dataTransfer){
    const entries = Array.from(dataTransfer.items).map(it=>it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    const out = [];
    async function readEntry(entry, path){
      if(entry.isFile){
        await new Promise(res=>entry.file(f=>{ f.relPath = path+f.name; out.push(f); res(); }, res));
      } else if(entry.isDirectory){
        const reader = entry.createReader();
        for(;;){
          const batch = await new Promise(res=>reader.readEntries(res, ()=>res([])));
          if(!batch.length) break;
          for(const ent of batch) await readEntry(ent, path+entry.name+'/');
        }
      }
    }
    for(const ent of entries) await readEntry(ent, '');
    return out;
  }

  drop.addEventListener('click', ()=>fileInput.click());
  folderBtn.addEventListener('click', ()=>folderInput.click());
  drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
  drop.addEventListener('drop', async e=>{
    e.preventDefault(); drop.classList.remove('drag');
    setFiles(await collectFromDrop(e.dataTransfer));
  });
  fileInput.addEventListener('change', e=>{ if(e.target.files.length) setFiles(Array.from(e.target.files)); });
  folderInput.addEventListener('change', e=>{ if(e.target.files.length) setFiles(Array.from(e.target.files)); });

  function setDownload(blob, filename, label){
    if(dlUrl) URL.revokeObjectURL(dlUrl);
    dlUrl = URL.createObjectURL(blob);
    dlBtn.href = dlUrl;
    dlBtn.download = filename;
    dlBtn.textContent = label;
    dlBtn.style.display = 'inline-block';
  }

  function warningsStat(){
    const n = PM.textconvUi.getWarnings().length;
    return n ? `<span>avisos: <b>⚠ ${n}</b></span>` : '';
  }

  runBtn.addEventListener('click', async ()=>{
    if(!files.length) return;
    runBtn.disabled = true;
    const t0 = performance.now();
    const settings = PM.textconvUi.currentSettings();
    const ext = PM.textconv.FORMAT_EXT[settings.format] || 'txt';
    const mime = settings.format==='json' ? 'application/json' : settings.format==='csv' ? 'text/csv' : 'text/plain';
    try{
      if(files.length===1){
        const { text, cols, rows } = await PM.textconv.fileToText(files[0], settings);
        outEl.value = text;
        copyBtn.disabled = false;
        setDownload(new Blob([text], { type:mime+';charset=utf-8' }), baseName(files[0].name)+'.'+ext, 'Descargar .'+ext);
        statsEl.innerHTML =
          `<span>grid: <b>${cols}×${rows}</b></span>` +
          `<span>caracteres: <b>${text.length}</b></span>` +
          warningsStat() +
          `<span>tiempo: <b>${(performance.now()-t0).toFixed(0)} ms</b></span>`;
      } else {
        const zip = new JSZip();
        let done = 0, failed = 0, firstText = null;
        progressEl.style.display = 'block';
        progressBarEl.style.width = '0%';
        for(const file of files){
          try{
            const { text } = await PM.textconv.fileToText(file, settings);
            if(firstText===null) firstText = text;
            zip.file(baseName(relPathOf(file))+'.'+ext, text);
            done++;
          } catch(err){
            console.error('Fallo convirtiendo', relPathOf(file), err);
            failed++;
          }
          progressBarEl.style.width = Math.round(((done+failed)/files.length)*100)+'%';
          statsEl.innerHTML = `<span>convertidas: <b>${done}/${files.length}</b></span>` + (failed?`<span>fallidas: <b>${failed}</b></span>`:'');
          await new Promise(r=>setTimeout(r, 0)); // deja respirar a la UI entre imágenes
        }
        outEl.value = firstText===null ? '' : firstText;
        copyBtn.disabled = firstText===null;
        const zipBlob = await zip.generateAsync({ type:'blob' });
        setDownload(zipBlob, 'text-converted.zip', 'Descargar .zip');
        statsEl.innerHTML =
          `<span>convertidas: <b>${done}/${files.length}</b></span>` +
          (failed?`<span>fallidas: <b>${failed}</b></span>`:'') +
          warningsStat() +
          `<span>tiempo total: <b>${((performance.now()-t0)/1000).toFixed(1)} s</b></span>` +
          `<span>vista previa: <b>primera imagen</b></span>`;
      }
    } catch(err){
      alert('Error convirtiendo la imagen: ' + err.message);
      console.error(err);
    } finally {
      runBtn.disabled = false;
    }
  });

  copyBtn.addEventListener('click', async ()=>{
    const text = outEl.value;
    try{
      await navigator.clipboard.writeText(text);
    } catch(err){
      outEl.select();
      document.execCommand('copy');
    }
    const old = copyBtn.textContent;
    copyBtn.textContent = '¡Copiado!';
    setTimeout(()=>{ copyBtn.textContent = old; }, 1200);
  });
})();
