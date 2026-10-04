// Мост между окном и главным процессом: только то, что нужно интерфейсу.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  load: () => ipcRenderer.invoke('schema:load'),
  save: (data) => ipcRenderer.invoke('schema:save', data),
  exportFile: (data) => ipcRenderer.invoke('schema:export', data),
  importFile: () => ipcRenderer.invoke('schema:import'),

  keyStatus: () => ipcRenderer.invoke('key:status'),
  setKey: (key) => ipcRenderer.invoke('key:set', key),
  clearKey: () => ipcRenderer.invoke('key:clear'),
  runAgent: (req) => ipcRenderer.invoke('agent:run', req),
  abortAgent: (runId) => ipcRenderer.invoke('agent:abort', runId),
  onAgentEvent: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },
});
