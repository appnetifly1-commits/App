
(function () {
  const $ = (id) => document.getElementById(id);

  const state = {
    file: null,
    objectUrl: null,
  };

  const els = {
    fileInput: $('fileInput'),
    chooseBtn: $('chooseBtn'),
    analyzeBtn: $('analyzeBtn'),
    clearBtn: $('clearBtn'),
    dropZone: $('dropZone'),
    fileMeta: $('fileMeta'),
    fileName: $('fileName'),
    fileSize: $('fileSize'),
    previewWrap: $('previewWrap'),
    previewImage: $('previewImage'),
    loader: $('loader'),
    loaderText: $('loaderText'),
    resultsArea: $('resultsArea'),
    processedImage: $('processedImage'),
    detectionImage: $('detectionImage'),
    reportText: $('reportText'),
    settingsCard: $('settingsCard'),
    toggleSettingsBtn: $('toggleSettingsBtn'),
  };

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let value = bytes;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function setLoading(isLoading, text) {
    els.loader.style.display = isLoading ? 'flex' : 'none';
    els.loaderText.textContent = text || 'جاري التحليل...';
    els.analyzeBtn.disabled = isLoading || !state.file;
    els.chooseBtn.disabled = isLoading;
    els.clearBtn.disabled = isLoading;
  }

  function clearResults() {
    els.resultsArea.style.display = 'none';
    els.processedImage.removeAttribute('src');
    els.detectionImage.removeAttribute('src');
    els.reportText.value = '';
  }

  function clearAll() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file = null;
    state.objectUrl = null;
    els.fileInput.value = '';
    els.fileMeta.style.display = 'none';
    els.previewWrap.style.display = 'none';
    clearResults();
    els.analyzeBtn.disabled = true;
  }

  function selectFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('من فضلك اختر ملف صورة صالح.');
      return;
    }
    clearResults();
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    els.previewImage.src = state.objectUrl;
    els.previewWrap.style.display = 'block';
    els.fileName.textContent = file.name;
    els.fileSize.textContent = formatBytes(file.size);
    els.fileMeta.style.display = 'flex';
    els.analyzeBtn.disabled = false;
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function buildPendingMessage(data) {
    const missing = Array.isArray(data?.missing) ? data.missing.join(', ') : 'Configuration pending';
    return [
      'Panorama AI is configured structurally, but the Supervisely model sessions are still pending.',
      '',
      `Missing/placeholder settings: ${missing}`,
      '',
      'Required final environment variables after training:',
      '- SUPERVISELY_SEGMENTATION_TASK_ID',
      '- SUPERVISELY_DETECTION_TASK_ID_1',
      '- SUPERVISELY_DETECTION_TASK_ID_2',
      '- SUPERVISELY_API_TOKEN',
      '- OPENROUTER_API_KEY',
      '',
      'Expected final output:',
      '1) One segmentation image',
      '2) One merged full detection image',
      '3) One professional written report'
    ].join('\n');
  }

  function renderResponse(data) {
    els.resultsArea.style.display = 'grid';
    const seg = data?.segmentation_image || data?.segmentationImage || '';
    const det = data?.full_detection_image || data?.detection_image || data?.detectionImage || '';
    if (seg) els.processedImage.src = seg;
    if (det) els.detectionImage.src = det;

    const report = data?.report || data?.written_report || data?.professional_report || data?.text || '';
    els.reportText.value = report || 'No written report returned.';
  }

  async function analyzeCurrentImage() {
    if (!state.file) return;
    try {
      setLoading(true, 'جاري إرسال صورة البانوراما للتحليل...');
      const imageBase64 = await fileToBase64(state.file);
      const res = await fetch('/.netlify/functions/pano-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          filename: state.file.name,
          mimeType: state.file.type,
          request_profile: 'segmentation_plus_2_detection_projects_merged',
          expected_return: {
            segmentation_image: 1,
            full_detection_image: 1,
            written_report: 1,
          }
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        els.resultsArea.style.display = 'grid';
        els.reportText.value = data?.status === 'pending_configuration'
          ? buildPendingMessage(data)
          : (data?.error || 'Analysis failed.');
        return;
      }
      renderResponse(data);
    } catch (err) {
      els.resultsArea.style.display = 'grid';
      els.reportText.value = 'Error: ' + (err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  els.chooseBtn?.addEventListener('click', () => els.fileInput.click());
  els.fileInput?.addEventListener('change', (e) => selectFile(e.target.files?.[0] || null));
  els.clearBtn?.addEventListener('click', clearAll);
  els.analyzeBtn?.addEventListener('click', analyzeCurrentImage);
  els.dropZone?.addEventListener('click', () => els.fileInput.click());
  els.dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('drag'); });
  els.dropZone?.addEventListener('dragleave', () => els.dropZone.classList.remove('drag'));
  els.dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag');
    selectFile(e.dataTransfer?.files?.[0] || null);
  });
  els.toggleSettingsBtn?.addEventListener('click', () => {
    const isHidden = getComputedStyle(els.settingsCard).display === 'none';
    els.settingsCard.style.display = isHidden ? 'block' : 'none';
  });

  window.printReport = function printReport() {
    const text = els.reportText.value || '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Panorama Report</title><style>body{font-family:Arial,sans-serif;padding:24px;white-space:pre-wrap;line-height:1.7}</style></head><body>${text.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };
})();
