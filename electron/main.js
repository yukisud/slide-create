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
ipcMain.handle('capture-slides', async (event, slidesHtml, slideCount) => {
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

    for (let i = 0; i < slideCount; i++) {
      // 各スライドのHTMLをレンダリング
      const slideHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Noto Sans JP', sans-serif;
              width: 1280px;
              height: 720px;
              overflow: hidden;
              background: white;
            }
          </style>
        </head>
        <body>
          <div id="slide-container"></div>
          <script>
            document.getElementById('slide-container').innerHTML = decodeURIComponent("${encodeURIComponent(slidesHtml[i])}");
          </script>
        </body>
        </html>
      `;

      await captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(slideHtml)}`);

      // フォント読み込み待機
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
ipcMain.handle('export-pdf', async (event, slidesHtml, slideCount) => {
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

    for (let i = 0; i < slideCount; i++) {
      const slideHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Noto Sans JP', sans-serif;
              width: 1280px;
              height: 720px;
              overflow: hidden;
              background: white;
            }
          </style>
        </head>
        <body>
          <div id="slide-container"></div>
          <script>
            document.getElementById('slide-container').innerHTML = decodeURIComponent("${encodeURIComponent(slidesHtml[i])}");
          </script>
        </body>
        </html>
      `;

      await captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(slideHtml)}`);

      // Wait for fonts to load
      await new Promise(resolve => setTimeout(resolve, 800));

      // Extract and execute scripts from the injected HTML
      await captureWindow.webContents.executeJavaScript(`
        (function() {
          const container = document.getElementById('slide-container');

          // Extract all script elements
          const scripts = Array.from(container.querySelectorAll('script'));

          // Remove them from DOM first
          scripts.forEach(script => script.remove());

          // Execute external scripts first, then inline scripts
          const externalScripts = scripts.filter(s => s.src);
          const inlineScripts = scripts.filter(s => !s.src);

          return new Promise((resolve) => {
            if (externalScripts.length === 0) {
              // No external scripts, execute inline immediately
              inlineScripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript);
              });
              resolve();
            } else {
              // Load external scripts first
              let loaded = 0;
              externalScripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.src = script.src;
                newScript.onload = () => {
                  loaded++;
                  if (loaded === externalScripts.length) {
                    // All external scripts loaded, execute inline
                    inlineScripts.forEach(script => {
                      const inlineScript = document.createElement('script');
                      inlineScript.textContent = script.textContent;
                      document.body.appendChild(inlineScript);
                    });
                    resolve();
                  }
                };
                newScript.onerror = () => {
                  loaded++;
                  if (loaded === externalScripts.length) {
                    inlineScripts.forEach(script => {
                      const inlineScript = document.createElement('script');
                      inlineScript.textContent = script.textContent;
                      document.body.appendChild(inlineScript);
                    });
                    resolve();
                  }
                };
                document.body.appendChild(newScript);
              });
            }
          });
        })();
      `);

      // Wait for Chart.js to render (if present)
      const hasCharts = await captureWindow.webContents.executeJavaScript(`
        typeof Chart !== 'undefined' && document.querySelectorAll('canvas').length > 0
      `);

      if (hasCharts) {
        // Give Chart.js time to render
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

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
