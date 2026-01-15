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

    // Get the maximum size needed to capture all slides
    const maxSize = await captureWindow.webContents.executeJavaScript(`
      (function() {
        const slides = document.querySelectorAll('.slide');
        let maxWidth = 1280;
        let maxHeight = 720;

        slides.forEach(slide => {
          const rect = slide.getBoundingClientRect();
          // Get the right and bottom edges (position + size)
          maxWidth = Math.max(maxWidth, Math.ceil(rect.right));
          maxHeight = Math.max(maxHeight, Math.ceil(rect.bottom));
        });

        return { width: maxWidth, height: maxHeight };
      })();
    `);

    // Resize capture window to accommodate all slides
    captureWindow.setSize(maxSize.width, maxSize.height);
    console.log('Capture window resized to:', maxSize.width, 'x', maxSize.height);

    // Wait for window resize to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Hide all slides except the one we're capturing
    for (let i = 0; i < slideCount; i++) {
      // Hide other slides and get the position of target slide
      const slideRect = await captureWindow.webContents.executeJavaScript(`
        (function() {
          const slides = document.querySelectorAll('.slide');
          let targetRect = null;

          slides.forEach((slide, index) => {
            if (index === ${i}) {
              slide.style.display = '';
              // Get actual position and size as displayed in preview
              const rect = slide.getBoundingClientRect();
              targetRect = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              };
            } else {
              slide.style.display = 'none';
            }
          });

          return targetRect;
        })();
      `);

      // Wait for Chart.js to render
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Capture the slide at its actual position and size (as in preview)
      const image = await captureWindow.webContents.capturePage({
        x: Math.floor(slideRect.x),
        y: Math.floor(slideRect.y),
        width: Math.ceil(slideRect.width),
        height: Math.ceil(slideRect.height)
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

    // Get the maximum size needed to capture all slides
    const maxSize = await captureWindow.webContents.executeJavaScript(`
      (function() {
        const slides = document.querySelectorAll('.slide');
        let maxWidth = 1280;
        let maxHeight = 720;

        slides.forEach(slide => {
          const rect = slide.getBoundingClientRect();
          // Get the right and bottom edges (position + size)
          maxWidth = Math.max(maxWidth, Math.ceil(rect.right));
          maxHeight = Math.max(maxHeight, Math.ceil(rect.bottom));
        });

        return { width: maxWidth, height: maxHeight };
      })();
    `);

    // Resize capture window to accommodate all slides
    captureWindow.setSize(maxSize.width, maxSize.height);
    console.log('Capture window resized to:', maxSize.width, 'x', maxSize.height);

    // Wait for window resize to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Hide all slides except the one we're capturing
    for (let i = 0; i < slideCount; i++) {
      // Hide other slides and get the position of target slide
      const slideRect = await captureWindow.webContents.executeJavaScript(`
        (function() {
          const slides = document.querySelectorAll('.slide');
          let targetRect = null;

          slides.forEach((slide, index) => {
            if (index === ${i}) {
              slide.style.display = '';
              // Get actual position and size as displayed in preview
              const rect = slide.getBoundingClientRect();
              targetRect = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              };
            } else {
              slide.style.display = 'none';
            }
          });

          return targetRect;
        })();
      `);

      // Wait for Chart.js to render
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Capture the slide at its actual position and size (as in preview)
      const image = await captureWindow.webContents.capturePage({
        x: Math.floor(slideRect.x),
        y: Math.floor(slideRect.y),
        width: Math.ceil(slideRect.width),
        height: Math.ceil(slideRect.height)
      });

      const pngData = image.toPNG();
      const pngImage = await pdfDoc.embedPng(pngData);

      // Calculate aspect ratio to fit in 1280x720 PDF page
      const slideAspect = slideRect.width / slideRect.height;
      const pageAspect = 1280 / 720;

      let pdfWidth = 1280;
      let pdfHeight = 720;

      if (slideAspect > pageAspect) {
        // Slide is wider - fit to width
        pdfHeight = 1280 / slideAspect;
      } else {
        // Slide is taller - fit to height
        pdfWidth = 720 * slideAspect;
      }

      const page = pdfDoc.addPage([1280, 720]);
      page.drawImage(pngImage, {
        x: (1280 - pdfWidth) / 2,
        y: (720 - pdfHeight) / 2,
        width: pdfWidth,
        height: pdfHeight
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
