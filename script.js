/**
 * BarcodeForge PWA — script.js
 * Created by Prathamesh Prashant Pawar
 * Android + iOS installable app
 */
'use strict';

/* ── HACK PROTECTION ── */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key==='F12'||(e.ctrlKey&&['u','U'].includes(e.key))||(e.ctrlKey&&e.shiftKey&&['i','I','j','J'].includes(e.key)))
    { e.preventDefault(); return false; }
});

/* ── PWA INSTALL ── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').style.display = 'flex';
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') document.getElementById('installBanner').style.display = 'none';
  deferredPrompt = null;
});

document.getElementById('dismissBtn')?.addEventListener('click', () => {
  document.getElementById('installBanner').style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').style.display = 'none';
  showMessage('✓ App installed successfully!', 'success');
});

/* ── SERVICE WORKER ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW error:', err));
  });
}

/* ── STATE ── */
let lastGenerated = null;
let qrInstance    = null;
let html5Scanner  = null;
let scannerRunning = false;
let history = JSON.parse(localStorage.getItem('bf_history') || '[]');

/* ── TABS ── */
function showTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'history') renderHistory();
}

/* ── PREVIEW TOGGLE ── */
function switchPreview(type, btn) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('previewBarcode').style.display = type === 'barcode' ? 'flex' : 'none';
  document.getElementById('previewQR').style.display      = type === 'qr'      ? 'flex' : 'none';
}

/* ── VALIDATION ── */
const validators = {
  EAN13:   v => { const c = v.replace(/\D/g,''); return c.length===13 ? {ok:true,val:c} : {ok:false,msg:'EAN-13 requires exactly 13 digits.'}; },
  ISBN:    v => { const c = v.replace(/[^0-9X]/gi,'').toUpperCase(); return (c.length===10||c.length===13) ? {ok:true,val:c} : {ok:false,msg:'ISBN must be 10 or 13 digits.'}; },
  CODE128: v => v.trim().length ? {ok:true,val:v.trim()} : {ok:false,msg:'Please enter a value.'}
};

/* ── MESSAGE ── */
function showMessage(text, type='success') {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4000);
}

/* ── GENERATE ── */
function generateBarcode() {
  const raw  = document.getElementById('barcodeInput').value.trim();
  const type = document.getElementById('barcodeType').value;
  const w    = parseInt(document.getElementById('barcodeWidth').value);
  const v    = validators[type](raw);
  if (!v.ok) { showMessage('⚠ ' + v.msg, 'error'); return; }

  const btn = document.getElementById('generateBtn');
  btn.classList.add('loading'); btn.disabled = true;

  setTimeout(() => {
    try {
      // ── Barcode ──
      const canvas = document.getElementById('barcodeCanvas');
      canvas.style.display = 'block';
      document.getElementById('barcodePlaceholder').style.display = 'none';
      document.getElementById('previewBarcode').classList.add('filled');

      JsBarcode(canvas, v.val, {
        format: type, width: w, height: 90,
        displayValue: false,
        background: '#ffffff', lineColor: '#000000',
        margin: 16
      });

      // ── QR Code ──
      const qrDiv = document.getElementById('qrcode');
      qrDiv.innerHTML = '';
      qrInstance = new QRCode(qrDiv, {
        text: v.val, width: 180, height: 180,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      qrDiv.style.display = 'flex';
      document.getElementById('qrPlaceholder').style.display = 'none';
      document.getElementById('previewQR').classList.add('filled');

      // ── Timestamp ──
      const now = new Date();
      const ts  = now.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      document.getElementById('timestamp').textContent = ts;
      document.getElementById('actionRow').style.display = 'grid';

      lastGenerated = { value: v.val, type, time: ts };
      addToHistory(v.val, type, ts);
      showMessage('✓ Barcode and QR Code generated!', 'success');

      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(50);

    } catch(e) { showMessage('✗ ' + e.message, 'error'); }

    btn.classList.remove('loading');
    btn.disabled = false;
  }, 300);
}

/* ── DOWNLOAD PNG ── */
function downloadBarcode() {
  if (!lastGenerated) return;
  const a = document.createElement('a');
  a.download = `barcode_${lastGenerated.value}.png`;
  a.href = document.getElementById('barcodeCanvas').toDataURL('image/png');
  a.click();
  showMessage('✓ Barcode downloaded!', 'success');
}

function downloadQR() {
  if (!lastGenerated) return;

  // QRCode library creates a canvas OR img depending on browser
  const qrDiv = document.getElementById('qrcode');

  // Try canvas first
  const qrCanvas = qrDiv.querySelector('canvas');
  if (qrCanvas) {
    const a = document.createElement('a');
    a.download = `qr_${lastGenerated.value}.png`;
    a.href = qrCanvas.toDataURL('image/png');
    a.click();
    showMessage('✓ QR Code downloaded!', 'success');
    return;
  }

  // Try img tag — draw on temp canvas
  const qrImg = qrDiv.querySelector('img');
  if (qrImg) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width  = 200;
    tempCanvas.height = 200;
    const ctx = tempCanvas.getContext('2d');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(image, 0, 0, 200, 200);
      const a = document.createElement('a');
      a.download = `qr_${lastGenerated.value}.png`;
      a.href = tempCanvas.toDataURL('image/png');
      a.click();
      showMessage('✓ QR Code downloaded!', 'success');
    };
    image.src = qrImg.src;
    return;
  }

  showMessage('⚠ QR Code not found. Generate first!', 'error');
}

/* ── PDF DOWNLOAD ── */
async function downloadPDF() {
  if (!lastGenerated) return;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Dark background
    doc.setFillColor(6, 8, 15);
    doc.rect(0, 0, 210, 297, 'F');

    // Header
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('BarcodeForge', 105, 24, { align: 'center' });
    doc.setTextColor(122, 138, 170);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Created by Prathamesh Prashant Pawar', 105, 33, { align: 'center' });

    // Divider
    doc.setDrawColor(0, 229, 255); doc.setLineWidth(0.3);
    doc.line(20, 39, 190, 39);

    // Barcode image
    const bcData = document.getElementById('barcodeCanvas').toDataURL('image/png');
    doc.addImage(bcData, 'PNG', 35, 48, 140, 56);

    // QR Code
    const qrImg = document.getElementById('qrcode').querySelector('img');
    if (qrImg) doc.addImage(qrImg.src, 'PNG', 75, 116, 60, 60);

    // Value
    doc.setTextColor(240, 244, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(lastGenerated.value, 105, 190, { align: 'center' });
    doc.setTextColor(122, 138, 170);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Type: ${lastGenerated.type}   |   Generated: ${lastGenerated.time}`, 105, 198, { align: 'center' });

    // Footer
    doc.setTextColor(61, 77, 102); doc.setFontSize(8);
    doc.text('BarcodeForge · Professional Publishing Tool · Free Forever', 105, 284, { align: 'center' });

    doc.save(`barcode_${lastGenerated.value}.pdf`);
    showMessage('✓ PDF downloaded!', 'success');
  } catch(e) { showMessage('✗ PDF error: ' + e.message, 'error'); }
}

/* ── PRINT ── */
function printBarcode() {
  if (!lastGenerated) return;
  const bcData = document.getElementById('barcodeCanvas').toDataURL('image/png');
  const qrImg  = document.getElementById('qrcode').querySelector('img');
  const w = window.open('', '_blank', 'width=600,height=500');
  w.document.write(`<!DOCTYPE html><html><head><title>Print Barcode</title>
  <style>body{margin:0;font-family:'Courier New',monospace;background:#fff;display:flex;flex-direction:column;align-items:center;padding:28px;}
  h2{font-size:13px;margin-bottom:3px;}p{font-size:10px;color:#555;margin:3px 0;}
  .row{display:flex;gap:32px;align-items:center;margin:16px 0;}img{display:block;}
  </style></head><body>
  <h2>BarcodeForge — Prathamesh Prashant Pawar</h2>
  <div class="row">
    <div><p>Barcode</p><img src="${bcData}" style="max-width:200px;"/></div>
    ${qrImg ? `<div><p>QR Code</p><img src="${qrImg.src}" style="width:130px;height:130px;"/></div>` : ''}
  </div>
  <p><strong>${lastGenerated.value}</strong> · ${lastGenerated.type} · ${lastGenerated.time}</p>
  <script>window.onload=function(){window.print();window.close();}<\/script>
  </body></html>`);
  w.document.close();
}

/* ── CLEAR ── */
function clearAll() {
  const canvas = document.getElementById('barcodeCanvas');
  canvas.style.display = 'none';
  document.getElementById('barcodePlaceholder').style.display = 'flex';
  document.getElementById('previewBarcode').classList.remove('filled');

  const qrDiv = document.getElementById('qrcode');
  qrDiv.innerHTML = ''; qrDiv.style.display = 'none';
  document.getElementById('qrPlaceholder').style.display = 'flex';
  document.getElementById('previewQR').classList.remove('filled');

  document.getElementById('actionRow').style.display = 'none';
  document.getElementById('timestamp').textContent = '';
  document.getElementById('barcodeInput').value = '';
  lastGenerated = null;
  document.getElementById('message').classList.remove('show');
}

/* ── COPY ── */
function copyNumber() {
  const val = document.getElementById('barcodeInput').value.trim();
  if (!val) return;
  navigator.clipboard.writeText(val)
    .then(() => { showMessage('✓ Copied!', 'success'); if (navigator.vibrate) navigator.vibrate(30); })
    .catch(() => {
      const t = document.createElement('textarea');
      t.value = val; document.body.appendChild(t); t.select();
      document.execCommand('copy'); document.body.removeChild(t);
      showMessage('✓ Copied!', 'success');
    });
}

/* ── HISTORY ── */
function addToHistory(value, type, time) {
  if (history.length && history[0].value === value) return;
  history.unshift({ value, type, time });
  if (history.length > 30) history.pop();
  try { localStorage.setItem('bf_history', JSON.stringify(history)); } catch(e) {}
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!history.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🕐</div><p>No history yet</p></div>';
    return;
  }
  el.innerHTML = '';
  history.forEach(item => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `
      <div class="history-dot"></div>
      <div class="history-info">
        <div class="history-number">${item.value}</div>
        <div class="history-meta">${item.time}</div>
      </div>
      <span class="history-type">${item.type}</span>`;
    d.addEventListener('click', () => {
      document.getElementById('barcodeInput').value = item.value;
      document.getElementById('barcodeType').value  = item.type;
      showTab('generate', document.querySelector('.bnav-btn[data-tab="generate"]'));
      generateBarcode();
    });
    el.appendChild(d);
  });
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  history = [];
  try { localStorage.removeItem('bf_history'); } catch(e) {}
  renderHistory();
  showMessage('History cleared.', 'success');
}

/* ── BULK GENERATOR ── */
function generateBulk() {
  const lines   = document.getElementById('bulkInput').value.split('\n').map(l => l.trim()).filter(Boolean);
  const type    = document.getElementById('bulkType').value;
  const resEl   = document.getElementById('bulkResults');
  const actEl   = document.getElementById('bulkActions');
  resEl.innerHTML = '';

  if (!lines.length) { alert('Please enter numbers!'); return; }

  lines.forEach(line => {
    const v   = validators[type](line);
    const div = document.createElement('div');

    if (v.ok) {
      div.className = 'bulk-item success-item';
      const c = document.createElement('canvas');
      c.className = 'bulk-canvas';
      try {
        JsBarcode(c, v.val, { format: type, width: 1.5, height: 44, displayValue: false, background: '#fff', lineColor: '#000', margin: 6 });
        div.innerHTML = `<span class="bulk-num">${v.val}</span>`;
        div.appendChild(c);
        const badge = document.createElement('span'); badge.className = 'bulk-badge ok'; badge.textContent = 'OK'; div.appendChild(badge);
        const btn = document.createElement('button'); btn.className = 'bulk-dl'; btn.textContent = '⬇';
        btn.onclick = () => { const a = document.createElement('a'); a.download = `barcode_${v.val}.png`; a.href = c.toDataURL('image/png'); a.click(); };
        div.appendChild(btn);
      } catch(e) { div.innerHTML = `<span class="bulk-num">${line}</span><span class="bulk-badge err">ERROR</span>`; }
    } else {
      div.className = 'bulk-item error-item';
      div.innerHTML = `<span class="bulk-num">${line}</span><span class="bulk-badge err">❌ ${v.msg}</span>`;
    }
    resEl.appendChild(div);
  });
  actEl.style.display = 'block';
}

async function downloadAllPDF() {
  const { jsPDF }  = window.jspdf;
  const canvases   = document.querySelectorAll('.bulk-canvas');
  if (!canvases.length) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFillColor(6, 8, 15); doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(0, 229, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('BarcodeForge — Bulk Export', 105, 18, { align: 'center' });
  doc.setTextColor(122, 138, 170); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Prathamesh Prashant Pawar', 105, 26, { align: 'center' });

  let y = 36;
  const bw = 84, bh = 26, gap = 12, perRow = 2, xStart = 14;

  canvases.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const xp  = xStart + col * (bw + gap);
    const yp  = y + row * (bh + 20);
    if (yp + bh > 265) {
      doc.addPage();
      doc.setFillColor(6, 8, 15); doc.rect(0, 0, 210, 297, 'F');
      y = 14;
    }
    try { doc.addImage(c.toDataURL('image/png'), 'PNG', xp, y + row * (bh + 20), bw, bh); } catch(e) {}
  });

  doc.save('bulk_barcodes.pdf');
  showMessage('✓ Bulk PDF downloaded!', 'success');
}

/* ── CAMERA SCANNER ── */
function startScanner() {
  const readerEl = document.getElementById('reader');
  const resultEl = document.getElementById('scanResult');
  const startBtn = document.getElementById('startScanBtn');
  const stopBtn  = document.getElementById('stopScanBtn');

  readerEl.style.display = 'block';
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-flex';
  resultEl.style.display = 'none';
  scannerRunning = true;

  html5Scanner = new Html5Qrcode('reader');
  html5Scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    decodedText => {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `✅ Scanned!<br/><strong style="font-size:1.05rem;">${decodedText}</strong><br/>
        <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="useScanResult('${decodedText}')">
          ↩ Use this value
        </button>`;
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      stopScanner();
    },
    () => {}
  ).catch(err => {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `❌ Could not open camera.<br/><small style="color:var(--text3)">${err}</small>`;
    stopBtn.style.display = 'none';
    startBtn.style.display = 'inline-flex';
    readerEl.style.display = 'none';
  });
}

function stopScanner() {
  if (html5Scanner && scannerRunning) {
    html5Scanner.stop().then(() => { html5Scanner.clear(); scannerRunning = false; }).catch(() => {});
  }
  document.getElementById('startScanBtn').style.display = 'inline-flex';
  document.getElementById('stopScanBtn').style.display  = 'none';
  document.getElementById('reader').style.display       = 'none';
}

function useScanResult(val) {
  document.getElementById('barcodeInput').value = val;
  showTab('generate', document.querySelector('.bnav-btn[data-tab="generate"]'));
  generateBarcode();
}

/* ── EVENTS ── */
document.getElementById('generateBtn').addEventListener('click', generateBarcode);
document.getElementById('downloadBtn').addEventListener('click', downloadBarcode);
document.getElementById('downloadQRBtn').addEventListener('click', downloadQR);
document.getElementById('pdfBtn').addEventListener('click', downloadPDF);
document.getElementById('printBtn').addEventListener('click', printBarcode);
document.getElementById('clearBtn').addEventListener('click', clearAll);
document.getElementById('copyBtn').addEventListener('click', copyNumber);
document.getElementById('barcodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') generateBarcode(); });

/* ── INIT ── */
window.addEventListener('load', () => {
  renderHistory();
  setTimeout(() => generateBarcode(), 500);
});
