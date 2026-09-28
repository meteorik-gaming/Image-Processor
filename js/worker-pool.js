// Pool de Web Workers para correr pipeline.js fuera del hilo principal.
//
// Por qué existe este archivo tan raro: abrir la app con doble-click sirve el HTML por
// file://, y en Chrome `new Worker('js/worker.js')` con ruta relativa falla con
// SecurityError ("cannot be accessed from origin 'null'") — confirmado con un spike antes
// de construir esto. La única forma que sí funciona sin montar un servidor es crear el
// worker desde un Blob URL con el código inline. Como no hay bundler, el código del worker
// se arma en tiempo de ejecución leyendo los mismos módulos puros que ya están cargados
// en el hilo principal (color-math.js, matching.js, feathering.js, lineart.js, pipeline.js)
// vía `Function.prototype.toString()` — así el worker corre exactamente el mismo código,
// sin mantener una segunda copia a mano que se puede desincronizar.
//
// Cada job es "procesa este File con estos opts" — tanto el modo imagen única como el modo
// batch mandan el mismo tipo de job; el worker decodifica con createImageBitmap +
// OffscreenCanvas, corre PM.pipeline.runPipeline, y devuelve blobs ya codificados.
(function(){
  const PM = self.PM = self.PM || {};

  function serializeNamespace(nsName, ns){
    const lines = [`const ${nsName} = PM.${nsName} = PM.${nsName} || {};`];
    for(const key of Object.keys(ns)){
      const val = ns[key];
      if(typeof val === 'function'){
        lines.push(`${nsName}.${key} = ${val.toString()};`);
      } else {
        lines.push(`${nsName}.${key} = ${JSON.stringify(val)};`);
      }
    }
    return lines.join('\n');
  }

  const WORKER_ENTRY = `
    self.onmessage = async function(e){
      const msg = e.data;
      if(msg.type === 'capabilities-check'){
        self.postMessage({
          type: 'capabilities-check',
          offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
          createImageBitmap: typeof createImageBitmap !== 'undefined'
        });
        return;
      }
      const { jobId, file, opts } = msg;
      try{
        const bitmap = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const origImgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

        const result = pipeline.runPipeline(origImgData, bitmap.width, bitmap.height, opts);
        ctx.putImageData(result.imgData, 0, 0);
        const blob = await canvas.convertToBlob({ type: opts.outputMime || 'image/png', quality: opts.outputQuality || 0.92 });

        async function encodeRaw(rawRGBA){
          if(!rawRGBA) return null;
          const c = new OffscreenCanvas(bitmap.width, bitmap.height);
          c.getContext('2d').putImageData(new ImageData(rawRGBA, bitmap.width, bitmap.height), 0, 0);
          return await c.convertToBlob({ type: 'image/png' });
        }
        const debugBlob = await encodeRaw(result.debugData);
        const debugGeneralBlob = await encodeRaw(result.debugDataGeneral);

        self.postMessage({
          jobId, ok:true, blob, debugBlob, debugGeneralBlob,
          width: bitmap.width, height: bitmap.height,
          numRegions: result.numRegions, paletteSize: result.paletteSize
        });
      } catch(err){
        self.postMessage({ jobId, ok:false, error: (err && err.message) || String(err) });
      }
    };
  `;

  function buildWorkerBlobURL(){
    const parts = [
      'const PM = self.PM = self.PM || {};',
      serializeNamespace('colorMath', PM.colorMath),
      serializeNamespace('matching', PM.matching),
      serializeNamespace('feathering', PM.feathering),
      serializeNamespace('lineart', PM.lineart),
      serializeNamespace('pipeline', PM.pipeline),
      WORKER_ENTRY
    ];
    const blob = new Blob([parts.join('\n\n')], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  function WorkerPool(size){
    this.size = size;
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending = new Map(); // jobId -> {resolve, reject}
    this.nextJobId = 1;
    this.usingWorkers = false;
    this.ready = this._init();
  }

  WorkerPool.prototype._init = async function(){
    let blobUrl;
    try{
      blobUrl = buildWorkerBlobURL();
      const probe = new Worker(blobUrl);
      const caps = await new Promise((resolve, reject)=>{
        const t = setTimeout(()=>reject(new Error('timeout probando capacidades del worker')), 4000);
        probe.onmessage = (e)=>{ clearTimeout(t); resolve(e.data); };
        probe.onerror = (e)=>{ clearTimeout(t); reject(new Error(e.message || 'worker onerror')); };
        probe.postMessage({ type:'capabilities-check' });
      });
      if(!caps.offscreenCanvas || !caps.createImageBitmap){
        probe.terminate();
        throw new Error('OffscreenCanvas/createImageBitmap no disponibles dentro del worker');
      }
      this.usingWorkers = true;
      this._wireWorker(probe);
      this.workers.push(probe);
      this.idle.push(probe);
      for(let i=1;i<this.size;i++){
        const w = new Worker(blobUrl);
        this._wireWorker(w);
        this.workers.push(w);
        this.idle.push(w);
      }
      console.info(`[image-processor] usando ${this.workers.length} worker(s) en paralelo.`);
    } catch(err){
      console.warn('[image-processor] Web Workers no disponibles, se procesará en el hilo principal:', err.message || err);
      this.usingWorkers = false;
      this.workers = [];
      this.idle = [];
    }
  };

  WorkerPool.prototype._wireWorker = function(w){
    w.onmessage = (e)=>{
      const msg = e.data;
      const entry = this.pending.get(msg.jobId);
      if(entry){
        this.pending.delete(msg.jobId);
        if(msg.ok) entry.resolve(msg);
        else entry.reject(new Error(msg.error));
      }
      this.idle.push(w);
      this._drain();
    };
    w.onerror = (e)=>{
      console.error('[image-processor] error inesperado en worker:', e.message);
    };
  };

  WorkerPool.prototype._drain = function(){
    while(this.idle.length && this.queue.length){
      const w = this.idle.pop();
      const job = this.queue.shift();
      this.pending.set(job.jobId, { resolve: job.resolve, reject: job.reject });
      w.postMessage({ jobId: job.jobId, file: job.file, opts: job.opts });
    }
  };

  // Fallback sin workers: corre el mismo pipeline en el hilo principal con un <canvas> normal.
  WorkerPool.prototype._runInline = async function(file, opts){
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const origImgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    const result = PM.pipeline.runPipeline(origImgData, bitmap.width, bitmap.height, opts);
    ctx.putImageData(result.imgData, 0, 0);
    const blob = await new Promise(res => canvas.toBlob(res, opts.outputMime || 'image/png', opts.outputQuality || 0.92));

    async function encodeRaw(rawRGBA){
      if(!rawRGBA) return null;
      const c = document.createElement('canvas');
      c.width = bitmap.width; c.height = bitmap.height;
      c.getContext('2d').putImageData(new ImageData(rawRGBA, bitmap.width, bitmap.height), 0, 0);
      return await new Promise(res => c.toBlob(res, 'image/png'));
    }
    const debugBlob = await encodeRaw(result.debugData);
    const debugGeneralBlob = await encodeRaw(result.debugDataGeneral);
    // yield para que la UI (barra de progreso, scroll) pueda respirar entre imágenes
    await new Promise(res => setTimeout(res, 0));
    return { ok:true, blob, debugBlob, debugGeneralBlob, width: bitmap.width, height: bitmap.height, numRegions: result.numRegions, paletteSize: result.paletteSize };
  };

  WorkerPool.prototype.processFile = async function(file, opts){
    await this.ready;
    if(!this.usingWorkers){
      return this._runInline(file, opts);
    }
    return new Promise((resolve, reject)=>{
      const jobId = this.nextJobId++;
      this.queue.push({ jobId, file, opts, resolve, reject });
      this._drain();
    });
  };

  PM.createWorkerPool = function(){
    const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 4), 8));
    return new WorkerPool(size);
  };
})();
