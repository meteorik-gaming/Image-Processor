// Boot: crea el pool de workers, arranca el shell multi-tool (tabs + secciones
// colapsables) y restaura la config guardada (o los defaults) de cada tool.
// single-mode.js / batch-mode.js ya esperan PM.workerPool.ready internamente en el primer job.
(function(){
  const PM = self.PM = self.PM || {};
  PM.workerPool = PM.createWorkerPool();
  PM.tools.init();
  PM.ui.init();
  PM.pixelateUi.init();
  PM.sequenceUi.init();
  PM.textconvUi.init();
})();
