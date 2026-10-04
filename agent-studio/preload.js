// Мост между окном и главным процессом: только то, что нужно интерфейсу.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  load: () => ipcRenderer.invoke('schema:load'),
  save: (data) => ipcRenderer.invoke('schema:save', data),
  exportFile: (data) => ipcRenderer.invoke('schema:export', data),
  importFile: () => ipcRenderer.invoke('schema:import'),
});
