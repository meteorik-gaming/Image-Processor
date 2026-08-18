// Boot: crea el pool de workers y restaura la config guardada (o los defaults).
// single-mode.js / batch-mode.js ya esperan PM.workerPool.ready internamente en el primer job.
(function(){
  const PM = self.PM = self.PM || {};
  PM.workerPool = PM.createWorkerPool();
  PM.ui.init();
})();
