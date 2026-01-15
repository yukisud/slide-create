const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const appRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  mainWindow.loadFile(path.join(appRoot, 'index.html'));

  // 開発時はDevToolsを開く
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// スライドをキャプチャしてPNG保存
ipcMain.handle('capture-slides', async (event, fullHtml, slideCount) => {
  try {
    // 保存先を選択
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'スライドの保存先を選択'
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, message: 'キャンセルされました' };
    }

    const outputDir = result.filePaths[0];
    const slidesDir = path.join(outputDir, 'slides');
    fs.mkdirSync(slidesDir, { recursive: true });
    const capturedFiles = [];

    // キャプチャ用の非表示ウィンドウを作成
    const captureWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        offscreen: true
      }
    });

    // Load the full HTML once
    await captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    // Wait for all resources to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Hide all slides except the one we're capturing
    for (let i = 0; i < slideCount; i++) {
      await captureWindow.webContents.executeJavaScript(`
        (function() {
          // Reset body styles for capture
          document.body.style.display = 'block';
          document.body.style.padding = '0';
          document.body.style.margin = '0';
          document.body.style.gap = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.width = '1280px';
          document.body.style.height = '720px';

          const slides = document.querySelectorAll('.slide');
          slides.forEach((slide, index) => {
            if (index === ${i}) {
              slide.style.display = '';
              slide.style.position = 'absolute';
              slide.style.top = '0';
              slide.style.left = '0';
              slide.style.margin = '0';
              slide.style.width = '1280px';
              slide.style.transformOrigin = 'top left';

              // Force layout calculation
              slide.offsetHeight;

              // Get actual height after layout
              const actualHeight = slide.scrollHeight;

              // If slide is taller than 720px, scale it down
              if (actualHeight > 720) {
                const scale = 720 / actualHeight;
                slide.style.transform = 'scale(' + scale + ')';
                console.log('Scaling slide ${i} from', actualHeight, 'to 720px, scale:', scale);
              } else {
                slide.style.minHeight = '720px';
              }
            } else {
              slide.style.display = 'none';
            }
          });
        })();
      `);

      // Wait for Chart.js to render and scaling to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      // スクリーンショット取得
      const image = await captureWindow.webContents.capturePage({
        x: 0,
        y: 0,
        width: 1280,
        height: 720
      });

      // PNG保存
      const fileName = `${String(i + 1).padStart(3, '0')}.png`;
      const filePath = path.join(slidesDir, fileName);
      fs.writeFileSync(filePath, image.toPNG());
      capturedFiles.push(filePath);

      // 進捗を送信
      event.sender.send('capture-progress', { current: i + 1, total: slideCount });
    }

    captureWindow.close();

    return {
      success: true,
      message: `${slideCount}枚のスライドを保存しました`,
      files: capturedFiles,
      outputDir: slidesDir
    };

  } catch (error) {
    console.error('Capture error:', error);
    return { success: false, message: error.message };
  }
});

// PDF出力
ipcMain.handle('export-pdf', async (event, fullHtml, slideCount) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'PDFの保存先を選択'
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, message: 'キャンセルされました' };
    }

    const outputDir = result.filePaths[0];
    const outputPath = path.join(outputDir, 'slide.pdf');

    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();

    const captureWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        offscreen: true
      }
    });

    // Load the full HTML once
    await captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    // Wait for all resources to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Hide all slides except the one we're capturing
    for (let i = 0; i < slideCount; i++) {
      await captureWindow.webContents.executeJavaScript(`
        (function() {
          // Reset body styles for capture
          document.body.style.display = 'block';
          document.body.style.padding = '0';
          document.body.style.margin = '0';
          document.body.style.gap = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.width = '1280px';
          document.body.style.height = '720px';

          const slides = document.querySelectorAll('.slide');
          slides.forEach((slide, index) => {
            if (index === ${i}) {
              slide.style.display = '';
              slide.style.position = 'absolute';
              slide.style.top = '0';
              slide.style.left = '0';
              slide.style.margin = '0';
              slide.style.width = '1280px';
              slide.style.transformOrigin = 'top left';

              // Force layout calculation
              slide.offsetHeight;

              // Get actual height after layout
              const actualHeight = slide.scrollHeight;

              // If slide is taller than 720px, scale it down
              if (actualHeight > 720) {
                const scale = 720 / actualHeight;
                slide.style.transform = 'scale(' + scale + ')';
                console.log('Scaling slide ${i} from', actualHeight, 'to 720px, scale:', scale);
              } else {
                slide.style.minHeight = '720px';
              }
            } else {
              slide.style.display = 'none';
            }
          });
        })();
      `);

      // Wait for Chart.js to render and scaling to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      const image = await captureWindow.webContents.capturePage({
        x: 0,
        y: 0,
        width: 1280,
        height: 720
      });

      const pngData = image.toPNG();
      const pngImage = await pdfDoc.embedPng(pngData);
      const page = pdfDoc.addPage([1280, 720]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: 1280,
        height: 720
      });

      event.sender.send('capture-progress', { current: i + 1, total: slideCount });
    }

    captureWindow.close();

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    return { success: true, message: 'PDFを保存しました', filePath: outputPath };

  } catch (error) {
    console.error('PDF export error:', error);
    return { success: false, message: error.message };
  }
});
