// Modo "carpeta (batch)": encola todos los archivos y los reparte en paralelo entre
// los workers del pool (o en serie si cayó al fallback de hilo principal). Cada resultado
// se mete al zip apenas llega, sin esperar a que terminen los demás.
(function(){
  const PM = self.PM = self.PM || {};

  const folderDrop = document.getElementById('folderDrop');
  const folderInput = document.getElementById('folderInput');
  const fileListBox = document.getElementById('fileListBox');
  const batchRunBtn = document.getElementById('batchRunBtn');
  const progressBar = document.getElementById('progressBar');
  const batchStatsEl = document.getElementById('batchStats');
  const batchDlBtn = document.getElementById('batchDlBtn');
  const batchFormatEl = document.getElementById('batchFormat');

  let batchFiles = [];

  folderDrop.addEventListener('click', ()=>folderInput.click());
  folderInput.addEventListener('change', e=>{
    batchFiles = Array.from(e.target.files).filter(f=>f.type.startsWith('image/'));
    renderFileList();
  });
  folderDrop.addEventListener('dragover', e=>{ e.preventDefault(); folderDrop.classList.add('drag'); });
  folderDrop.addEventListener('dragleave', ()=> folderDrop.classList.remove('drag'));
  folderDrop.addEventListener('drop', async e=>{
    e.preventDefault(); folderDrop.classList.remove('drag');
    const items = e.dataTransfer.items;
    const files = [];
    async function readEntry(entry, path){
      if(entry.isFile){ await new Promise(res=>entry.file(f=>{ f.relPath=path+f.name; files.push(f); res(); })); }
      else if(entry.isDirectory){
        const reader = entry.createReader();
        const entries = await new Promise(res=>reader.readEntries(res));
        for(const ent of entries) await readEntry(ent, path+entry.name+'/');
      }
    }
    const entries = Array.from(items).map(it=>it.webkitGetAsEntry()).filter(Boolean);
    for(const ent of entries) await readEntry(ent, '');
    batchFiles = files.filter(f=>f.type.startsWith('image/'));
    renderFileList();
  });

  function renderFileList(){
    if(batchFiles.length===0){ fileListBox.textContent='ningún archivo seleccionado'; batchRunBtn.disabled=true; return; }
    fileListBox.innerHTML = batchFiles.map(f=>`<div>${f.webkitRelativePath||f.relPath||f.name}</div>`).join('');
    batchRunBtn.disabled = false;
  }

  function extAndBase(filename){
    const dot = filename.lastIndexOf('.');
    if(dot===-1) return [filename, 'png'];
    return [filename.slice(0,dot), filename.slice(dot+1).toLowerCase()];
  }
  function mimeForExt(ext){
    if(ext==='jpg'||ext==='jpeg') return 'image/jpeg';
    if(ext==='webp') return 'image/webp';
    return 'image/png';
  }

  batchRunBtn.addEventListener('click', async ()=>{
    if(batchFiles.length===0) return;
    batchRunBtn.disabled = true;
    const t0 = performance.now();
    const baseOpts = PM.ui.currentProcessOpts(false);
    const fmtOverride = batchFormatEl.value;

    const zip = new JSZip();
    let done=0, failed=0;
    const total = batchFiles.length;

    function updateProgress(){
      progressBar.style.width = Math.round(((done+failed)/total)*100)+'%';
      batchStatsEl.innerHTML =
        `<span>procesados: <b>${done}/${total}</b></span>` +
        (failed?`<span>fallidos: <b>${failed}</b></span>`:'') +
        `<span>modo: <b>${PM.workerPool.usingWorkers ? 'workers en paralelo' : 'hilo principal (fallback)'}</b></span>`;
    }
    updateProgress();

    const jobs = batchFiles.map(file=>{
      const relPath = file.webkitRelativePath || file.relPath || file.name;
      const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')+1) : '';
      const [base, origExt] = extAndBase(relPath.split('/').pop());
      const ext = fmtOverride==='same' ? origExt : fmtOverride;
      const outName = dir + base + '_matched.' + ext;

      const opts = Object.assign({}, baseOpts, { outputMime: mimeForExt(ext), outputQuality: 0.92 });

      return PM.workerPool.processFile(file, opts).then(result=>{
        zip.file(outName, result.blob);
        done++;
      }).catch(err=>{
        console.error('Fallo procesando', relPath, err);
        failed++;
      }).finally(updateProgress);
    });

    await Promise.allSettled(jobs);

    const zipBlob = await zip.generateAsync({type:'blob'});
    const t1 = performance.now();
    batchDlBtn.href = URL.createObjectURL(zipBlob);
    batchDlBtn.style.display = 'inline-block';

    batchStatsEl.innerHTML =
      `<span>procesados: <b>${done}/${total}</b></span>` +
      (failed?`<span>fallidos: <b>${failed}</b></span>`:'') +
      `<span>tiempo total: <b>${((t1-t0)/1000).toFixed(1)} s</b></span>` +
      `<span>modo: <b>${PM.workerPool.usingWorkers ? 'workers en paralelo' : 'hilo principal (fallback)'}</b></span>`;

    batchRunBtn.disabled = false;
  });
})();
