const { contextBridge, ipcRenderer } = require('electron');

// Electron APIをウェブページに公開
contextBridge.exposeInMainWorld('electronAPI', {
  // スライドをPNG画像として保存
  captureSlides: (slidesHtml, slideCount) => {
    return ipcRenderer.invoke('capture-slides', slidesHtml, slideCount);
  },

  // スライドをPDFとして保存
  exportPdf: (slidesHtml, slideCount) => {
    return ipcRenderer.invoke('export-pdf', slidesHtml, slideCount);
  },

  // 進捗イベントをリッスン
  onCaptureProgress: (callback) => {
    ipcRenderer.on('capture-progress', (event, data) => callback(data));
  },

  // Electronで実行中かどうか
  isElectron: true
});
