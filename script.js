/**
 * BarcodeForge — script.js
 * Created by Prathamesh Prashant Pawar
 * Features: Generate, QR, PDF, Bulk, Camera Scanner, History, Hack Protection
 */

'use strict';

/* ── HACK PROTECTION ── */
// Disable right-click
document.addEventListener('contextmenu', e => e.preventDefault());
// Disable F12, Ctrl+U, Ctrl+Shift+I, Ctrl+Shift+J
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && ['u','U'].includes(e.key)) ||
      (e.ctrlKey && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key))) {
    e.preventDefault(); return false;
  }
});
// Detect devtools open (basic)
(function devtoolsDetect() {
  const threshold = 160;
  setInterval(() => {
    if (window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#06080f;color:#ff5252;font-size:1.2rem;">🔒 Access Restricted</div>';
    }
  }, 1000);
})();
// Disable text selection on sensitive areas
document.addEventListener('selectstart', e => {
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
});

/* ── DOM ── */
const input       = document.getElementById('barcodeInput');
const typeSelect  = document.getElementById('barcodeType');
const widthSelect = document.getElementById('barcodeWidth');
const generateBtn = document.getElementById('generateBtn');
const canvas      = document.getElementById('barcodeCanvas');
const placeholder = document.getElementById('barcodePlaceholder');
const actionRow   = document.getElementById('actionRow');
const messageEl   = document.getElementById('message');
const timestampEl = document.getElementById('timestamp');
const historyListEl = document.getElementById('historyList');
const qrDiv       = document.getElementById('qrcode');
const qrPlaceholder = document.getElementById('qrPlaceholder');

let history = JSON.parse(localStorage.getItem('bcHistory') || '[]');
let lastGenerated = null;
let qrInstance = null;
let html5Scanner = null;
let scannerRunning = false;

/* ── TABS ── */
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'history') renderHistory();
}

/* ── PREVIEW TABS ── */
function switchPreview(type, btn) {
  document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (type === 'barcode') {
    document.getElementById('previewBarcode').style.display = 'flex';
    document.getElementById('previewQR').style.display = 'none';
  } else {
    document.getElementById('previewBarcode').style.display = 'none';
    document.getElementById('previewQR').style.display = 'flex';
  }
}

/* ── VALIDATION ── */
const validators = {
  EAN13:   v => { const c = v.replace(/\D/g,''); return c.length===13 ? {ok:true,val:c} : {ok:false,msg:'EAN-13 requires exactly 13 digits.'}; },
  ISBN:    v => { const c = v.replace(/[^0-9X]/gi,'').toUpperCase(); return (c.length===10||c.length===13) ? {ok:true,val:c} : {ok:false,msg:'ISBN must be 10 or 13 digits.'}; },
  CODE128: v => v.trim().length ? {ok:true,val:v.trim()} : {ok:false,msg:'Please enter a value.'}
};

/* ── MESSAGE ── */
function showMessage(text, type='success') {
  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;
  clearTimeout(messageEl._t);
  messageEl._t = setTimeout(() => messageEl.classList.remove('show'), 4000);
}

/* ── GENERATE ── */
function generateBarcode() {
  const raw  = input.value.trim();
  const type = typeSelect.value;
  const w    = parseInt(widthSelect.value);
  const v    = validators[type](raw);
  if (!v.ok) { showMessage('⚠ ' + v.msg, 'error'); input.focus(); return; }

  generateBtn.classList.add('loading');
  generateBtn.disabled = true;

  setTimeout(() => {
    try {
      // Barcode
      canvas.style.display = 'block';
      placeholder.style.display = 'none';
      document.getElementById('previewBarcode').classList.add('filled');

      JsBarcode(canvas, v.val, {
        format: type, width: w, height: 100,
        displayValue: false, background: '#ffffff',
        lineColor: '#000000', margin: 18
      });

      // QR
      qrDiv.innerHTML = '';
      qrInstance = new QRCode(qrDiv, {
        text: v.val, width: 180, height: 180,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      qrDiv.style.display = 'flex';
      qrPlaceholder.style.display = 'none';
      document.getElementById('previewQR').classList.add('filled');

      // Timestamp
      const now = new Date();
      const ts = now.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      timestampEl.textContent = ts;
      actionRow.style.display = 'flex';
      lastGenerated = { value: v.val, type, time: ts };
      addToHistory(v.val, type, ts);
      showMessage('✓ Barcode and QR Code generated!', 'success');
    } catch(err) {
      showMessage('✗ ' + err.message, 'error');
    }
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
  }, 350);
}

/* ── DOWNLOAD PNG ── */
function downloadBarcode() {
  if (!lastGenerated) return;
  const a = document.createElement('a');
  a.download = `barcode_${lastGenerated.value}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  showMessage('✓ Barcode PNG downloaded!', 'success');
}

function downloadQR() {
  if (!lastGenerated) return;
  const img = qrDiv.querySelector('img');
  if (!img) return;
  const a = document.createElement('a');
  a.download = `qr_${lastGenerated.value}.png`;
  a.href = img.src;
  a.click();
  showMessage('✓ QR PNG downloaded!', 'success');
}

/* ── PDF DOWNLOAD ── */
async function downloadPDF() {
  if (!lastGenerated) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(6, 8, 15);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica','bold');
  doc.text('BarcodeForge', 105, 24, { align: 'center' });
  doc.setTextColor(122, 138, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text('Created by Prathamesh Prashant Pawar', 105, 32, { align: 'center' });

  // Divider
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.3);
  doc.line(20, 37, 190, 37);

  // Barcode image
  const bcData = canvas.toDataURL('image/png');
  doc.addImage(bcData, 'PNG', 40, 48, 130, 55);

  // QR image
  const qrImg = qrDiv.querySelector('img');
  if (qrImg) {
    doc.addImage(qrImg.src, 'PNG', 75, 115, 60, 60);
  }

  // Info
  doc.setTextColor(240, 244, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica','bold');
  doc.text(lastGenerated.value, 105, 188, { align: 'center' });
  doc.setTextColor(122, 138, 170);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text(`Type: ${lastGenerated.type}   |   Generated: ${lastGenerated.time}`, 105, 196, { align: 'center' });

  // Footer
  doc.setTextColor(61, 77, 102);
  doc.setFontSize(8);
  doc.text('BarcodeForge · Professional Publishing Tool · Free Forever', 105, 285, { align: 'center' });

  doc.save(`barcode_${lastGenerated.value}.pdf`);
  showMessage('✓ PDF downloaded!', 'success');
}

/* ── PRINT ── */
function printBarcode() {
  if (!lastGenerated) return;
  const bcData = canvas.toDataURL('image/png');
  const qrImg  = qrDiv.querySelector('img');
  const qrSrc  = qrImg ? qrImg.src : '';
  const w = window.open('','_blank','width=600,height=520');
  w.document.write(`<!DOCTYPE html><html><head><title>Print</title>
  <style>body{margin:0;font-family:'Courier New',monospace;background:#fff;display:flex;flex-direction:column;align-items:center;padding:30px;}
  h2{font-size:14px;margin-bottom:4px;}p{font-size:11px;color:#555;margin:4px 0;}
  .row{display:flex;gap:40px;align-items:center;margin:20px 0;}img{display:block;}
  </style></head><body>
  <h2>BarcodeForge — Prathamesh Prashant Pawar</h2>
  <div class="row">
    <div><p>Barcode</p><img src="${bcData}" style="max-width:220px;"/></div>
    ${qrSrc?`<div><p>QR Code</p><img src="${qrSrc}" style="width:140px;height:140px;"/></div>`:''}
  </div>
  <p><strong>${lastGenerated.value}</strong> · ${lastGenerated.type} · ${lastGenerated.time}</p>
  <script>window.onload=function(){window.print();window.close();}<\/script>
  </body></html>`);
  w.document.close();
}

/* ── CLEAR ── */
function clearAll() {
  canvas.style.display = 'none';
  placeholder.style.display = 'flex';
  document.getElementById('previewBarcode').classList.remove('filled');
  qrDiv.innerHTML = ''; qrDiv.style.display = 'none';
  qrPlaceholder.style.display = 'flex';
  document.getElementById('previewQR').classList.remove('filled');
  actionRow.style.display = 'none';
  timestampEl.textContent = '';
  input.value = ''; lastGenerated = null;
  messageEl.classList.remove('show');
  input.focus();
}

/* ── COPY ── */
function copyNumber() {
  const val = input.value.trim(); if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    showMessage('✓ Copied!', 'success');
  }).catch(() => {
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
  if (history.length > 20) history.pop();
  try { localStorage.setItem('bcHistory', JSON.stringify(history)); } catch(e){}
}

function renderHistory() {
  historyListEl.innerHTML = '';
  if (!history.length) {
    historyListEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🕐</div><p>No history yet</p></div>';
    return;
  }
  history.forEach(item => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `<div class="history-dot"></div>
      <div class="history-info">
        <div class="history-number">${item.value}</div>
        <div class="history-meta">${item.time}</div>
      </div>
      <span class="history-type">${item.type}</span>`;
    d.addEventListener('click', () => {
      input.value = item.value; typeSelect.value = item.type;
      showTab('generate');
      document.querySelectorAll('.nav-tab')[0].classList.add('active');
      document.querySelectorAll('.nav-tab').forEach((t,i) => { if(i>0) t.classList.remove('active'); });
      generateBarcode();
    });
    historyListEl.appendChild(d);
  });
}

function clearHistory() {
  history = [];
  try { localStorage.removeItem('bcHistory'); } catch(e){}
  renderHistory();
  showMessage('History cleared.', 'success');
}

/* ── BULK GENERATOR ── */
function generateBulk() {
  const lines = document.getElementById('bulkInput').value
    .split('\n').map(l=>l.trim()).filter(Boolean);
  const type  = document.getElementById('bulkType').value;
  const resultsEl = document.getElementById('bulkResults');
  const actionsEl = document.getElementById('bulkActions');
  resultsEl.innerHTML = '';

  if (!lines.length) { alert('Please enter numbers!'); return; }

  lines.forEach((line, idx) => {
    const v = validators[type](line);
    const div = document.createElement('div');

    if (v.ok) {
      div.className = 'bulk-item success-item';
      const c = document.createElement('canvas');
      c.className = 'bulk-canvas';
      try {
        JsBarcode(c, v.val, { format: type, width: 1.5, height: 50, displayValue: false, background:'#fff', lineColor:'#000', margin:8 });
        div.innerHTML = `<span class="bulk-num">${v.val}</span>`;
        div.appendChild(c);
        const badge = document.createElement('span'); badge.className='bulk-badge ok'; badge.textContent='OK'; div.appendChild(badge);
        const btn = document.createElement('button'); btn.className='bulk-dl';
        btn.textContent = '⬇ PNG';
        btn.onclick = () => {
          const a = document.createElement('a');
          a.download = `barcode_${v.val}.png`;
          a.href = c.toDataURL('image/png'); a.click();
        };
        div.appendChild(btn);
      } catch(e) {
        div.innerHTML = `<span class="bulk-num">${line}</span><span class="bulk-badge err">ERROR</span>`;
      }
    } else {
      div.className = 'bulk-item error-item';
      div.innerHTML = `<span class="bulk-num">${line}</span><span class="bulk-badge err">❌ ${v.msg}</span>`;
    }
    resultsEl.appendChild(div);
  });

  actionsEl.style.display = 'block';
}

async function downloadAllPDF() {
  const { jsPDF } = window.jspdf;
  const canvases = document.querySelectorAll('.bulk-canvas');
  if (!canvases.length) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(6,8,15); doc.rect(0,0,210,297,'F');
  doc.setTextColor(0,229,255); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('BarcodeForge — Bulk Export', 105, 20, {align:'center'});
  doc.setTextColor(122,138,170); doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Prathamesh Prashant Pawar', 105, 28, {align:'center'});

  let y = 40; const perRow = 2; const bw = 85; const bh = 30; const xStart = 15; const gap = 15;
  canvases.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = xStart + col * (bw + gap);
    const yy = y + row * (bh + 20);
    if (yy > 260) { doc.addPage(); doc.setFillColor(6,8,15); doc.rect(0,0,210,297,'F'); y = 10; }
    doc.addImage(c.toDataURL('image/png'), 'PNG', x, y + row*(bh+20), bw, bh);
  });

  doc.save('bulk_barcodes.pdf');
}

/* ── CAMERA SCANNER ── */
function startScanner() {
  const readerEl  = document.getElementById('reader');
  const resultEl  = document.getElementById('scanResult');
  const startBtn  = document.getElementById('startScanBtn');
  const stopBtn   = document.getElementById('stopScanBtn');

  readerEl.style.display = 'block';
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-flex';
  resultEl.style.display = 'none';
  scannerRunning = true;

  html5Scanner = new Html5Qrcode('reader');
  html5Scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    decodedText => {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `✅ Scanned Successfully!<br/><strong style="font-size:1rem;">${decodedText}</strong><br/>
        <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="useScanResult('${decodedText}')">
          ↩ Use this value
        </button>`;
      stopScanner();
    },
    () => {}
  ).catch(err => {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `❌ Could not open camera.<br/><small>${err}</small>`;
    stopBtn.style.display = 'none';
    startBtn.style.display = 'inline-flex';
  });
}

function stopScanner() {
  if (html5Scanner && scannerRunning) {
    html5Scanner.stop().then(() => { html5Scanner.clear(); scannerRunning = false; }).catch(()=>{});
  }
  document.getElementById('startScanBtn').style.display = 'inline-flex';
  document.getElementById('stopScanBtn').style.display  = 'none';
  document.getElementById('reader').style.display = 'none';
}

function useScanResult(val) {
  input.value = val;
  showTab('generate');
  document.querySelectorAll('.nav-tab')[0].classList.add('active');
  document.querySelectorAll('.nav-tab').forEach((t,i) => { if(i>0) t.classList.remove('active'); });
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
input.addEventListener('keydown', e => { if (e.key === 'Enter') generateBarcode(); });

// Rate limiting — prevent spam clicking
let lastClick = 0;
generateBtn.addEventListener('click', () => {
  const now = Date.now();
  if (now - lastClick < 800) { showMessage('⚠ Please wait a moment!', 'error'); return; }
  lastClick = now;
});

/* ── INIT ── */
window.addEventListener('load', () => {
  input.focus();
  renderHistory();
  setTimeout(() => generateBarcode(), 500);
});
