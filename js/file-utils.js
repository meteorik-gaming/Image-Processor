// Utilidades compartidas de archivos: leer archivos sueltos y carpetas (recursivo) de un
// drop. Cada File resultante trae .relPath (ruta relativa dentro de lo que se soltó).
(function(){
  const PM = self.PM = self.PM || {};
  const fileUtils = PM.fileUtils = {};

  // webkitGetAsEntry tiene que llamarse de forma síncrona sobre todos los items, antes de
  // cualquier await — por eso el map va arriba del todo.
  fileUtils.collectFromDrop = async function(dataTransfer){
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
  };

  fileUtils.relPathOf = function(f){ return f.webkitRelativePath || f.relPath || f.name; };
})();
