/* Desktop boundary: the same offline UI can use a native Save dialog later. */
const WorkbenchHost = {
 get native(){return Boolean(window.__TAURI__?.core?.invoke)},
 async save(blob,name){
  if(this.native){
   const bytes=Array.from(new Uint8Array(await blob.arrayBuffer()));
   return window.__TAURI__.core.invoke('save_output',{name,bytes});
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);return true;
 }
};
