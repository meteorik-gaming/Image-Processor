// Modo "video": extrae frames de un <video> vía canvas (secuencial, limitación del
// navegador al buscar por tiempo), y cada frame se procesa igual que en batch — mismo
// worker pool, en paralelo — armando un .zip de frames numerados. Sin audio, sin
// reensamblar el video: eso se deja a un editor/ffmpeg aparte, usando el mismo fps.
(function(){
  const PM = self.PM = self.PM || {};

  const videoDrop = document.getElementById('videoDrop');
  const videoInput = document.getElementById('videoInput');
  const videoInfo = document.getElementById('videoInfo');
  const videoFpsEl = document.getElementById('videoFps');
  const videoFormatEl = document.getElementById('videoFormat');
  const videoRunBtn = document.getElementById('videoRunBtn');
  const videoProgressBar = document.getElementById('videoProgressBar');
  const videoStatsEl = document.getElementById('videoStats');
  const videoDlBtn = document.getElementById('videoDlBtn');

  let loadedVideoFile = null;
  let videoMeta = null; // { duration, width, height }

  videoDrop.addEventListener('click', ()=>videoInput.click());
  videoInput.addEventListener('change', e=>{ if(e.target.files[0]) loadVideo(e.target.files[0]); });
  videoDrop.addEventListener('dragover', e=>{ e.preventDefault(); videoDrop.classList.add('drag'); });
  videoDrop.addEventListener('dragleave', ()=> videoDrop.classList.remove('drag'));
  videoDrop.addEventListener('drop', e=>{ e.preventDefault(); videoDrop.classList.remove('drag'); if(e.dataTransfer.files[0]) loadVideo(e.dataTransfer.files[0]); });

  function estimatedFrameCount(){
    const fps = +videoFpsEl.value || 24;
    return videoMeta ? Math.max(1, Math.floor(videoMeta.duration * fps)) : 0;
  }
  function renderVideoInfo(){
    if(!videoMeta) return;
    const fps = +videoFpsEl.value || 24;
    videoInfo.innerHTML =
      `<span>duración: <b>${videoMeta.duration.toFixed(1)}s</b></span>` +
      `<span>resolución: <b>${videoMeta.width}x${videoMeta.height}</b></span>` +
      `<span>frames a ${fps}fps: <b>${estimatedFrameCount()}</b></span>`;
  }
  videoFpsEl.addEventListener('change', renderVideoInfo);

  async function loadVideo(file){
    loadedVideoFile = file;
    videoRunBtn.disabled = true;
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    await new Promise((res, rej)=>{ video.onloadedmetadata = res; video.onerror = rej; });
    videoMeta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    URL.revokeObjectURL(url);
    renderVideoInfo();
    videoRunBtn.disabled = false;
  }

  function seekTo(video, t){
    return new Promise(res=>{
      const onSeeked = ()=>{ video.removeEventListener('seeked', onSeeked); res(); };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });
  }

  videoRunBtn.addEventListener('click', async ()=>{
    if(!loadedVideoFile || !videoMeta) return;
    videoRunBtn.disabled = true;
    const t0 = performance.now();

    const fmt = videoFormatEl.value;
    const baseOpts = PM.ui.currentProcessOpts(false);
    const opts = Object.assign({}, baseOpts, {
      outputMime: fmt==='jpg' ? 'image/jpeg' : 'image/png',
      outputQuality: 0.92
    });

    const fps = +videoFpsEl.value || 24;
    const frameCount = estimatedFrameCount();
    const pad = String(frameCount).length;

    const video = document.createElement('video');
    const url = URL.createObjectURL(loadedVideoFile);
    video.src = url;
    video.muted = true;
    await new Promise(res=>{ video.onloadedmetadata = res; });

    const canvas = document.createElement('canvas');
    canvas.width = videoMeta.width; canvas.height = videoMeta.height;
    const ctx = canvas.getContext('2d');

    const zip = new JSZip();
    let extracted=0, done=0, failed=0;
    const jobs = [];

    function updateProgress(){
      videoProgressBar.style.width = Math.round(((done+failed)/frameCount)*100)+'%';
      videoStatsEl.innerHTML =
        `<span>extraídos: <b>${extracted}/${frameCount}</b></span>` +
        `<span>procesados: <b>${done}/${frameCount}</b></span>` +
        (failed?`<span>fallidos: <b>${failed}</b></span>`:'') +
        `<span>modo: <b>${PM.workerPool.usingWorkers ? 'workers en paralelo' : 'hilo principal (fallback)'}</b></span>`;
    }
    updateProgress();

    for(let i=0; i<frameCount; i++){
      const t = Math.min(i/fps, Math.max(0, videoMeta.duration - 0.001));
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      extracted++; updateProgress();

      const name = 'frame_' + String(i+1).padStart(pad, '0') + '.' + fmt;
      const job = PM.workerPool.processFile(frameBlob, opts).then(result=>{
        zip.file(name, result.blob);
        done++;
      }).catch(err=>{
        console.error('Fallo procesando frame', i, err);
        failed++;
      }).finally(updateProgress);
      jobs.push(job);
    }

    URL.revokeObjectURL(url);
    await Promise.allSettled(jobs);

    const zipBlob = await zip.generateAsync({type:'blob'});
    const t1 = performance.now();
    videoDlBtn.href = URL.createObjectURL(zipBlob);
    videoDlBtn.style.display = 'inline-block';

    videoStatsEl.innerHTML =
      `<span>procesados: <b>${done}/${frameCount}</b></span>` +
      (failed?`<span>fallidos: <b>${failed}</b></span>`:'') +
      `<span>tiempo total: <b>${((t1-t0)/1000).toFixed(1)} s</b></span>` +
      `<span>fps usado: <b>${fps}</b></span>`;

    videoRunBtn.disabled = false;
  });
})();
