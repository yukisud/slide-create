const preview = document.getElementById('preview');
const htmlInput = document.getElementById('htmlInput');
const renderBtn = document.getElementById('renderBtn');
const clearBtn = document.getElementById('clearBtn');
const editToggle = document.getElementById('editToggle');
const previewScale = document.getElementById('previewScale');
const selectionToolbar = document.getElementById('selectionToolbar');
const toolbarFontSize = document.getElementById('toolbarFontSize');
const toolbarSwatches = document.getElementById('toolbarSwatches');
const exportImagesBtn = document.getElementById('exportImagesBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const geminiUrlInput = document.getElementById('geminiUrl');
const saveGeminiBtn = document.getElementById('saveGeminiBtn');
const openGeminiBtn = document.getElementById('openGeminiBtn');
const geminiModal = document.getElementById('geminiModal');
const modalCopyPromptBtn = document.getElementById('modalCopyPromptBtn');
const modalOpenGeminiBtn = document.getElementById('modalOpenGeminiBtn');
const modalGeminiUrl = document.getElementById('modalGeminiUrl');
const modalSaveGeminiBtn = document.getElementById('modalSaveGeminiBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const toast = document.getElementById('toast');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const errorPrompt = document.getElementById('errorPrompt');
const copyErrorPromptBtn = document.getElementById('copyErrorPromptBtn');
const closeErrorModalBtn = document.getElementById('closeErrorModalBtn');

// Loading Elements
const loadingModal = document.getElementById('loadingModal');
const loadingText = document.getElementById('loadingText');
const loadingBar = document.getElementById('loadingBar');

let promptText = '';
let savedRange = null;

const COLOR_SWATCHES = [
  '#111111', '#333333', '#6b7280', '#9ca3af', '#e5e7eb',
  '#002f5d', '#036ad1', '#1a237e', '#3949ab', '#5c6bc0',
  '#8e24aa', '#ab47bc', '#ba68c8', '#4285F4', '#EA4335',
  '#FBBC05', '#FF0000', '#000000'
];

const STORAGE_KEYS = {
  html: 'html-slide-tool:html',
  geminiUrl: 'html-slide-tool:geminiUrl'
};

function showLoading(total) {
  loadingModal.classList.add('show');
  loadingModal.setAttribute('aria-hidden', 'false');
  updateLoading(0, total);
}

function updateLoading(current, total) {
  const percent = Math.round((current / total) * 100);
  loadingBar.style.width = `${percent}%`;
  loadingText.textContent = `${current}/${total} ダウンロード中...`;
}

function hideLoading() {
  loadingModal.classList.remove('show');
  loadingModal.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    loadingBar.style.width = '0%';
    loadingText.textContent = '準備中...';
  }, 300);
}

function loadPrompt() {
  fetch('prompt_spec.txt')
    .then(res => res.text())
    .then(text => {
      promptText = text;
    })
    .catch(() => {
      promptText = '';
    });
}

function sanitizeHtml(doc) {
  // 信頼できるCDNのホワイトリスト
  const TRUSTED_CDNS = [
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'code.jquery.com',
    'd3js.org',
    'cdn.plot.ly',
    'cdn.bokeh.org',
    'www.gstatic.com/charts'
  ];

  // 危険なパターン（基本的なXSS対策）
  const DANGEROUS_PATTERNS = [
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /\.innerHTML\s*=/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(\s*['"`]/i,
    /setInterval\s*\(\s*['"`]/i,
    /window\.location/i,
    /document\.write/i
  ];

  const allScripts = doc.querySelectorAll('script');
  console.log('[DEBUG] sanitizeHtml: Found', allScripts.length, 'script tags');

  doc.querySelectorAll('script').forEach(el => {
    const src = el.getAttribute('src');

    // 外部スクリプト（src属性あり）の場合
    if (src) {
      console.log('[DEBUG] sanitizeHtml: Checking external script:', src);
      // 信頼できるCDNからのスクリプトかチェック
      const isTrusted = TRUSTED_CDNS.some(cdn => {
        try {
          const url = new URL(src, window.location.href);
          return url.hostname.includes(cdn);
        } catch {
          return false;
        }
      });

      // 信頼できないスクリプトは削除
      if (!isTrusted) {
        console.log('[DEBUG] sanitizeHtml: Removing untrusted script:', src);
        el.remove();
      } else {
        console.log('[DEBUG] sanitizeHtml: Keeping trusted script:', src);
      }
      return;
    }

    // インラインスクリプトの場合、危険なパターンをチェック
    const scriptContent = el.textContent || '';
    const isDangerous = DANGEROUS_PATTERNS.some(pattern => pattern.test(scriptContent));

    if (isDangerous) {
      console.warn('[DEBUG] sanitizeHtml: Dangerous script pattern detected and removed:', scriptContent.substring(0, 100));
      el.remove();
    } else {
      console.log('[DEBUG] sanitizeHtml: Keeping safe inline script, length:', scriptContent.length);
    }
    // 安全と判断されたインラインスクリプトは残す
  });

  return doc;
}

function renderSlides() {
  const html = htmlInput.value.trim();
  preview.innerHTML = '';
  if (!html) return;

  let slides = [];
  let doc = null;
  try {
    const parser = new DOMParser();
    doc = sanitizeHtml(parser.parseFromString(html, 'text/html'));
    slides = extractSlidesFromDoc(doc);
  } catch (e) {
    showErrorModal(e.message, html);
    return;
  }
  if (slides.length === 0) {
    showErrorModal('スライド要素が見つかりませんでした。class="slide" が含まれているか確認してください。', html);
    return;
  }

  // head内の外部スクリプトを検出して先に読み込む
  const headScripts = [];
  if (doc && doc.head) {
    const scripts = Array.from(doc.head.querySelectorAll('script[src]'));
    scripts.forEach(script => {
      headScripts.push(script.src);
      console.log('[DEBUG] Found head script:', script.src);
    });
  }

  // head内のスクリプトを先に読み込む
  let headScriptsLoaded = 0;
  const totalHeadScripts = headScripts.length;

  const renderSlidesAfterHeadScripts = () => {
    console.log('[DEBUG] Head scripts loaded, rendering slides');
    renderSlidesContent(slides);
  };

  if (totalHeadScripts === 0) {
    renderSlidesContent(slides);
  } else {
    console.log('[DEBUG] Loading head scripts, count:', totalHeadScripts);
    headScripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        headScriptsLoaded++;
        console.log('[DEBUG] Head script loaded:', src, `(${headScriptsLoaded}/${totalHeadScripts})`);
        if (headScriptsLoaded === totalHeadScripts) {
          renderSlidesAfterHeadScripts();
        }
      };
      script.onerror = () => {
        console.error('[DEBUG] Failed to load head script:', src);
        headScriptsLoaded++;
        if (headScriptsLoaded === totalHeadScripts) {
          renderSlidesAfterHeadScripts();
        }
      };
      document.head.appendChild(script);
    });
  }
}

function extractSlidesFromDoc(doc) {
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('HTMLの構文解析に失敗しました。タグの閉じ忘れや不正な構造が含まれている可能性があります。');
  }
  const slides = Array.from(doc.querySelectorAll('.slide'));
  if (slides.length > 0) return slides;
  const body = doc.body;
  if (!body) return [];
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = body.innerHTML;
  return [wrapper];
}

function renderSlidesContent(slides) {
  slides.forEach((slide, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'slide-wrap';

    const slideNode = slide.cloneNode(true);
    slideNode.classList.add('slide-editor');
    slideNode.dataset.slideIndex = String(idx + 1);

    // scriptタグを抜き出して保存（外部とインラインを分離）
    const scripts = Array.from(slideNode.querySelectorAll('script'));
    console.log('[DEBUG] Found scripts:', scripts.length);
    const externalScripts = [];
    const inlineScripts = [];

    scripts.forEach(script => {
      if (script.src) {
        console.log('[DEBUG] External script:', script.src);
        externalScripts.push({
          src: script.src,
          textContent: script.textContent
        });
      } else {
        console.log('[DEBUG] Inline script length:', script.textContent.length);
        inlineScripts.push({
          textContent: script.textContent
        });
      }
      script.remove();
    });

    wrap.appendChild(slideNode);
    preview.appendChild(wrap);

    // 外部スクリプトを先に読み込む
    let loadedCount = 0;
    const totalExternal = externalScripts.length;

    const executeInlineScripts = () => {
      // すべての外部スクリプトがロード完了後、インラインスクリプトを実行
      console.log('[DEBUG] Executing inline scripts, count:', inlineScripts.length);
      inlineScripts.forEach((data, idx) => {
        console.log('[DEBUG] Executing inline script', idx);
        const newScript = document.createElement('script');
        newScript.textContent = data.textContent;
        slideNode.appendChild(newScript);
      });
    };

    if (totalExternal === 0) {
      // 外部スクリプトがない場合はすぐに実行
      console.log('[DEBUG] No external scripts, executing inline immediately');
      executeInlineScripts();
    } else {
      // 外部スクリプトを追加
      console.log('[DEBUG] Loading external scripts, count:', totalExternal);
      externalScripts.forEach(data => {
        const newScript = document.createElement('script');
        newScript.src = data.src;
        newScript.onload = () => {
          loadedCount++;
          console.log('[DEBUG] External script loaded:', data.src, `(${loadedCount}/${totalExternal})`);
          if (loadedCount === totalExternal) {
            // すべての外部スクリプトがロード完了
            console.log('[DEBUG] All external scripts loaded, executing inline scripts');
            executeInlineScripts();
          }
        };
        newScript.onerror = () => {
          console.error('[DEBUG] Failed to load script:', data.src);
          loadedCount++;
          if (loadedCount === totalExternal) {
            executeInlineScripts();
          }
        };
        slideNode.appendChild(newScript);
      });
    }
  });

  applyEditMode();
}

function applyEditMode() {
  const editable = editToggle.checked;
  preview.querySelectorAll('.slide-editor').forEach(slide => {
    slide.contentEditable = editable ? 'true' : 'false';
  });
  if (!editable) {
    selectionToolbar.classList.remove('show');
  }
}

function applyPreviewScale() {
  preview.style.setProperty('--preview-scale', previewScale.value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

// Electron環境かどうかをチェック
function isElectron() {
  return window.electronAPI && window.electronAPI.isElectron;
}

// スライドのHTMLを取得（Electron用）
function getSlidesHtml() {
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  return slides.map(slide => {
    const clone = slide.cloneNode(true);
    clone.classList.remove('slide-editor');
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('data-slide-index');
    return clone.outerHTML;
  });
}

async function exportImages() {
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  if (slides.length === 0) return;

  // Electron環境の場合はネイティブキャプチャを使用
  if (isElectron()) {
    showLoading(slides.length);
    try {
      const slidesHtml = getSlidesHtml();

      // 進捗イベントをリッスン
      window.electronAPI.onCaptureProgress((data) => {
        updateLoading(data.current, data.total);
      });

      const result = await window.electronAPI.captureSlides(slidesHtml, slides.length);

      if (result.success) {
        showToast(result.message);
      } else {
        showToast(result.message || '書き出しに失敗しました');
      }
    } catch (error) {
      console.error(error);
      showToast('書き出しに失敗しました');
    } finally {
      hideLoading();
    }
    return;
  }

  // 通常のブラウザ環境
  showLoading(slides.length);

  try {
    const zip = new window.JSZip();
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      updateLoading(index + 1, slides.length);
      await new Promise(resolve => setTimeout(resolve, 50));
      const canvas = await renderSlideCanvas(slide);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      zip.file(`${String(index + 1).padStart(3, '0')}.png`, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'slides.zip';
    link.click();
  } catch (error) {
    console.error(error);
    showToast('書き出しに失敗しました');
  } finally {
    hideLoading();
  }
}

async function exportPdf() {
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  if (slides.length === 0) return;

  // Electron環境の場合はネイティブPDF出力を使用
  if (isElectron()) {
    showLoading(slides.length);
    try {
      const slidesHtml = getSlidesHtml();

      window.electronAPI.onCaptureProgress((data) => {
        updateLoading(data.current, data.total);
      });

      const result = await window.electronAPI.exportPdf(slidesHtml, slides.length);

      if (result.success) {
        showToast(result.message);
      } else {
        showToast(result.message || '書き出しに失敗しました');
      }
    } catch (error) {
      console.error(error);
      showToast('書き出しに失敗しました');
    } finally {
      hideLoading();
    }
    return;
  }

  // 通常のブラウザ環境
  showLoading(slides.length);

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'px', format: [1280, 720], orientation: 'landscape' });

    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      updateLoading(index + 1, slides.length);
      await new Promise(resolve => setTimeout(resolve, 50));
      const canvas = await renderSlideCanvas(slide);
      const imgData = canvas.toDataURL('image/png');
      if (index > 0) pdf.addPage([1280, 720], 'landscape');
      pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
    }
    pdf.save('slide.pdf');
  } catch (error) {
    console.error(error);
    showToast('書き出しに失敗しました');
  } finally {
    hideLoading();
  }
}

async function renderSlideCanvas(slide) {
  // フォントのロード完了を確実に待つ
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // 1. スライドを複製してクリーンアップ
  const clone = slide.cloneNode(true);
  clone.classList.remove('slide-editor');
  clone.contentEditable = 'false';
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.width = '1280px';
  clone.style.height = '720px';
  clone.style.position = 'relative';

  // 2. 撮影用の隔離コンテナを作成
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: '1280px',
    height: '720px',
    zIndex: '0',
    background: '#ffffff',
    overflow: 'hidden',
    margin: '0',
    padding: '0'
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  // 4. レイアウト計算のために少し待機
  await new Promise(resolve => setTimeout(resolve, 100));

  // 5. スライド直下のflex修正のみ（ネストされた要素は触らない）
  const slideEl = clone.querySelector('.slide');
  if (slideEl) {
    const computed = window.getComputedStyle(slideEl);
    if (computed.display === 'flex' && computed.flexDirection === 'column') {
      // スライドの直接の子要素（コンテンツラッパー）の位置を保存
      Array.from(slideEl.children).forEach(child => {
        // absolute要素（背景アイコン）はスキップ
        const childComputed = window.getComputedStyle(child);
        if (childComputed.position === 'absolute') return;

        const childRect = child.getBoundingClientRect();
        const parentRect = slideEl.getBoundingClientRect();
        const offsetTop = childRect.top - parentRect.top;

        // 位置をdata属性に保存
        child.dataset.flexFixTop = `${offsetTop}`;
      });

      slideEl.dataset.flexFix = 'slide';
    }
  }

  try {
    // 3. html2canvasでレンダリング (復旧)
    const canvas = await html2canvas(container, {
      width: 1280,
      height: 720,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1280,
      windowHeight: 720,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc) => {
        console.log('onclone executed: v21 (slide-only flex fix)');
        clonedDoc.defaultView.scrollTo(0, 0);
        const clonedBody = clonedDoc.body;
        clonedBody.style.margin = '0';
        clonedBody.style.padding = '0';

        // 1. z-indexを構造ベースで強制設定（クラス名に依存しない）
        clonedDoc.querySelectorAll('.slide').forEach(slide => {
          Array.from(slide.children).forEach(child => {
            const computed = clonedDoc.defaultView.getComputedStyle(child);

            if (computed.position === 'absolute') {
              // absolute要素（背景アイコン）は最背面
              child.style.zIndex = '0';
            } else {
              // それ以外（コンテンツラッパー）は前面
              child.style.position = 'relative';
              child.style.zIndex = '10';
            }
          });
        });

        // Tailwindのz-indexクラスも処理（ネストされた要素用）
        const zIndexClasses = ['z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50'];
        zIndexClasses.forEach((cls) => {
          clonedDoc.querySelectorAll(`.slide .${cls}`).forEach(el => {
            const computed = clonedDoc.defaultView.getComputedStyle(el);
            if (computed.position === 'static') {
              el.style.position = 'relative';
            }
            el.style.zIndex = cls === 'z-0' ? '0' : cls.split('-')[1];
          });
        });

        // 2. Font Awesomeの縦ズレを抑える
        clonedDoc.querySelectorAll('.fa, .fas, .far, .fab, .fa-solid, .fa-regular, .fa-brands').forEach(el => {
          el.style.lineHeight = '1';
          el.style.display = 'inline-block';
          el.style.verticalAlign = 'middle';
        });

        // 3. .slide要素のflex修正を適用（ネストは触らない）
        clonedDoc.querySelectorAll('[data-flex-fix="slide"]').forEach(slide => {
          slide.style.justifyContent = 'flex-start';
          slide.style.alignItems = 'stretch';
        });

        // 4. スライドの直接子要素の位置を固定
        clonedDoc.querySelectorAll('[data-flex-fix-top]').forEach(el => {
          const top = el.dataset.flexFixTop;
          if (top && parseFloat(top) > 0) {
            el.style.marginTop = `${top}px`;
          }
        });
      }
    });
    return canvas;

  } catch (error) {
    console.error('html2canvas export failed:', error);
    alert('書き出しに失敗しました。\\n' + error.message);
    throw error;
  } finally {
    // 5. 後始末
    document.body.removeChild(container);
  }
}

function saveGeminiUrl() {
  const value = geminiUrlInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.geminiUrl, value);
}

function openGemini() {
  const savedUrl = localStorage.getItem(STORAGE_KEYS.geminiUrl) || '';
  const url = geminiUrlInput.value.trim() || savedUrl;
  if (!savedUrl) {
    showGeminiModal();
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function copyPrompt() {
  if (!promptText) return;
  navigator.clipboard.writeText(promptText).then(() => {
    showToast('コピーしました');
  }).catch(() => { });
}

function showGeminiModal() {
  modalGeminiUrl.value = geminiUrlInput.value.trim();
  geminiModal.classList.add('show');
  geminiModal.setAttribute('aria-hidden', 'false');
}

function closeGeminiModal() {
  geminiModal.classList.remove('show');
  geminiModal.setAttribute('aria-hidden', 'true');
}

function showErrorModal(message, html) {
  errorMessage.textContent = message;
  errorPrompt.value = buildErrorPrompt(message, html);
  errorModal.classList.add('show');
  errorModal.setAttribute('aria-hidden', 'false');
}

function closeErrorModal() {
  errorModal.classList.remove('show');
  errorModal.setAttribute('aria-hidden', 'true');
}

function buildErrorPrompt(message, html) {
  return `以下のHTMLでエラーが発生しました。\\n\\n【エラー内容】\\n${message}\\n\\n【修正方針】\\n- class="slide" を持つスライド要素が必ず含まれるようにする\\n- タグの閉じ忘れや入れ子の不整合を修正\\n- 余分なscriptタグは削除\\n\\n【対象HTML】\\n${html}`;
}

function applySelectionStyle(style) {
  const range = restoreSelectionRange();
  if (!range) return;

  // 選択範囲が空の場合は親要素に適用
  if (range.collapsed) {
    const element = range.startContainer.parentElement;
    if (element && element.closest('.slide-editor')) {
      Object.assign(element.style, style);
    }
    saveSelectionRange();
    return;
  }

  // 選択範囲がある場合は、spanで囲むか親要素に適用
  try {
    // シンプルな選択範囲の場合
    const span = document.createElement('span');
    Object.assign(span.style, style);
    range.surroundContents(span);

    // 選択範囲を維持
    const selection = window.getSelection();
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
    saveSelectionRange();
  } catch (e) {
    // 複雑な選択範囲の場合は親要素に適用
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    if (element && element.closest('.slide-editor')) {
      Object.assign(element.style, style);
    }
    saveSelectionRange();
  }
}

function refreshSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    selectionToolbar.classList.remove('show');
    return;
  }
  const range = selection.getRangeAt(0);

  // 選択範囲の始点ノードを取得
  let node = range.startContainer;

  // テキストノードなら親要素を取得
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  // スライドエディタ内にあるか確認
  if (!node || !node.closest('.slide-editor')) {
    selectionToolbar.classList.remove('show');
    return;
  }

  const styles = window.getComputedStyle(node);
  toolbarFontSize.value = Math.round(parseFloat(styles.fontSize) || 16);

  saveSelectionRange();
  positionToolbar(range);

  if (editToggle.checked) {
    selectionToolbar.classList.add('show');
  }
}

function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return '#111111';
  const [r, g, b] = result.map(v => parseInt(v, 10));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function renderColorScale() {
  COLOR_SWATCHES.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'toolbar-swatch';
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      applySelectionStyle({ color });
    });
    toolbarSwatches.appendChild(swatch);
  });
}

function saveSelectionRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  savedRange = selection.getRangeAt(0).cloneRange();
}

function restoreSelectionRange() {
  const selection = window.getSelection();
  if (!savedRange) {
    if (selection && selection.rangeCount > 0) return selection.getRangeAt(0);
    return null;
  }
  selection.removeAllRanges();
  selection.addRange(savedRange);
  return savedRange;
}

function positionToolbar(range) {
  if (!range) return;
  const rect = range.getBoundingClientRect();

  // .panel-right を基準にする
  const panelRight = document.querySelector('.panel-right');
  const panelRect = panelRight.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) return;

  // ツールバーの位置計算 (パネル内での相対位置)
  // rect.top はビューポート基準。panelRect.top もビューポート基準。
  // 差分がパネル上端からの距離。
  // そこからツールバーの高さ分(約40px)とマージン(10px)を引く。

  const top = rect.top - panelRect.top - 50;
  const left = rect.left - panelRect.left;

  // 画面外にはみ出さないように調整 (簡易)
  const safeTop = Math.max(10, top);
  const safeLeft = Math.max(10, Math.min(panelRect.width - 200, left));

  selectionToolbar.style.top = `${safeTop}px`;
  selectionToolbar.style.left = `${safeLeft}px`;
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEYS.html);
  if (saved) htmlInput.value = saved;
  const url = localStorage.getItem(STORAGE_KEYS.geminiUrl);
  if (url) geminiUrlInput.value = url;
}

htmlInput.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEYS.html, htmlInput.value);
});
renderBtn.addEventListener('click', renderSlides);
clearBtn.addEventListener('click', () => {
  htmlInput.value = '';
  preview.innerHTML = '';
  localStorage.removeItem(STORAGE_KEYS.html);
});
editToggle.addEventListener('change', applyEditMode);
previewScale.addEventListener('input', applyPreviewScale);
toolbarFontSize.addEventListener('input', () => {
  applySelectionStyle({ fontSize: `${toolbarFontSize.value}px` });
});
exportImagesBtn.addEventListener('click', exportImages);
exportPdfBtn.addEventListener('click', exportPdf);
copyPromptBtn.addEventListener('click', copyPrompt);
saveGeminiBtn.addEventListener('click', saveGeminiUrl);
openGeminiBtn.addEventListener('click', openGemini);
modalCopyPromptBtn.addEventListener('click', copyPrompt);
modalOpenGeminiBtn.addEventListener('click', () => {
  const url = modalGeminiUrl.value.trim();
  if (!url) {
    showToast('Gemini URLを入力してください');
    return;
  }
  window.open(url, '_blank', 'noopener');
});
modalSaveGeminiBtn.addEventListener('click', () => {
  geminiUrlInput.value = modalGeminiUrl.value.trim();
  saveGeminiUrl();
  closeGeminiModal();
  openGemini();
});
modalCloseBtn.addEventListener('click', closeGeminiModal);
copyErrorPromptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(errorPrompt.value).then(() => {
    showToast('コピーしました');
  }).catch(() => { });
});
closeErrorModalBtn.addEventListener('click', closeErrorModal);
document.addEventListener('selectionchange', refreshSelection);
preview.addEventListener('mousedown', () => {
  if (!editToggle.checked) {
    selectionToolbar.classList.remove('show');
  }
});
document.addEventListener('click', (event) => {
  if (!preview.contains(event.target) && !selectionToolbar.contains(event.target)) {
    selectionToolbar.classList.remove('show');
  }
});

loadPrompt();
restoreState();
applyPreviewScale();
renderColorScale();
if (htmlInput.value.trim()) renderSlides();

// 初回アクセス時（URL未保存時）にセットアップガイドを表示
if (!localStorage.getItem(STORAGE_KEYS.geminiUrl)) {
  showGeminiModal();
}
