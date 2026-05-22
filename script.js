/**
 * ISBN Barcode Generator — script.js
 * Dr. T. M. Gogate Pratishthan, Nashik
 * -------------------------------------------
 * Features:
 *  - Generate EAN-13, CODE128, ISBN barcodes
 *  - Download as PNG
 *  - Print
 *  - Copy number to clipboard
 *  - History of last 10 barcodes
 *  - Enter key support
 *  - Input validation per barcode type
 */

// =============================================
// DOM ELEMENTS
// =============================================
const input       = document.getElementById('barcodeInput');
const typeSelect  = document.getElementById('barcodeType');
const widthSelect = document.getElementById('barcodeWidth');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const printBtn    = document.getElementById('printBtn');
const clearBtn    = document.getElementById('clearBtn');
const copyBtn     = document.getElementById('copyBtn');
const canvas      = document.getElementById('barcodeCanvas');
const placeholder = document.getElementById('barcodePlaceholder');
const display     = document.getElementById('barcodeDisplay');
const actionRow   = document.getElementById('actionRow');
const messageEl   = document.getElementById('message');
const timestampEl = document.getElementById('timestamp');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// =============================================
// STATE
// =============================================
let history = []; // Array of { number, type, time }
let lastGenerated = null;

// =============================================
// VALIDATION RULES
// =============================================
const validators = {
  EAN13: (val) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (cleaned.length !== 13) return { ok: false, msg: 'EAN-13 requires exactly 13 digits.' };
    return { ok: true, val: cleaned };
  },
  ISBN: (val) => {
    const cleaned = val.replace(/[^0-9X]/gi, '').toUpperCase();
    if (cleaned.length !== 10 && cleaned.length !== 13)
      return { ok: false, msg: 'ISBN must be 10 or 13 digits.' };
    return { ok: true, val: cleaned };
  },
  CODE128: (val) => {
    if (!val || val.trim().length === 0)
      return { ok: false, msg: 'Please enter a value for CODE128.' };
    if (val.length > 80)
      return { ok: false, msg: 'CODE128 value too long (max 80 chars).' };
    return { ok: true, val: val.trim() };
  }
};

// =============================================
// SHOW MESSAGE
// =============================================
function showMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;
  clearTimeout(messageEl._timer);
  messageEl._timer = setTimeout(() => {
    messageEl.classList.remove('show');
  }, 4000);
}

// =============================================
// GENERATE BARCODE
// =============================================
function generateBarcode() {
  const rawValue  = input.value.trim();
  const barcodeType = typeSelect.value;
  const barWidth    = parseInt(widthSelect.value, 10);

  // Validate
  const validation = validators[barcodeType](rawValue);
  if (!validation.ok) {
    showMessage('⚠ ' + validation.msg, 'error');
    input.focus();
    return;
  }

  const value = validation.val;

  // Show loading state
  generateBtn.classList.add('loading');
  generateBtn.disabled = true;

  // Simulate brief loading (for UX feel)
  setTimeout(() => {
    try {
      // Show canvas, hide placeholder
      canvas.style.display = 'block';
      placeholder.style.display = 'none';
      display.classList.add('has-barcode');

      // Generate barcode on canvas
      JsBarcode(canvas, value, {
        format:      barcodeType,
        width:       barWidth,
        height:      120,
        displayValue: false,
        fontSize:    16,
        background:  '#ffffff',
        lineColor:   '#000000',
        margin:      20,
        marginTop:   16,
        marginBottom:16,
        marginLeft:  20,
        marginRight: 20,
        flat:        false
      });

      // Timestamp
      const now = new Date();
      const timeStr = now.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      timestampEl.textContent = timeStr;

      // Show action buttons
      actionRow.style.display = 'flex';

      // Save last generated
      lastGenerated = { value, type: barcodeType, time: timeStr };

      // Add to history
      addToHistory(value, barcodeType, timeStr);

      // Success
      showMessage('✓ Barcode generated successfully!', 'success');

    } catch (err) {
      showMessage('✗ Failed to generate barcode: ' + err.message, 'error');
      canvas.style.display = 'none';
      placeholder.style.display = 'block';
      display.classList.remove('has-barcode');
      actionRow.style.display = 'none';
    }

    // Remove loading
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;

  }, 400);
}

// =============================================
// DOWNLOAD AS PNG
// =============================================
function downloadBarcode() {
  if (!lastGenerated) return;
  const link = document.createElement('a');
  const safeVal = lastGenerated.value.replace(/[^a-z0-9]/gi, '_');
  link.download = `barcode_${safeVal}_${lastGenerated.type}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showMessage('✓ Barcode downloaded as PNG!', 'success');
}

// =============================================
// PRINT BARCODE
// =============================================
function printBarcode() {
  if (!lastGenerated) return;
  const dataURL = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'width=500,height=400');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Barcode — ${lastGenerated.value}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center;
               justify-content: center; min-height: 100vh; font-family: 'Courier New', monospace;
               background: white; }
        img  { max-width: 90%; display: block; }
        p    { font-size: 13px; color: #555; margin-top: 8px; }
        h3   { font-size: 14px; color: #111; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <h3>Dr. T. M. Gogate Pratishthan, Nashik</h3>
      <img src="${dataURL}" />
      <p>${lastGenerated.type} &nbsp;|&nbsp; ${lastGenerated.time}</p>
      <script>window.onload = function(){ window.print(); window.close(); }<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// =============================================
// CLEAR
// =============================================
function clearAll() {
  canvas.style.display = 'none';
  placeholder.style.display = 'block';
  display.classList.remove('has-barcode');
  actionRow.style.display = 'none';
  timestampEl.textContent = '';
  input.value = '';
  lastGenerated = null;
  messageEl.classList.remove('show');
  input.focus();
}

// =============================================
// COPY NUMBER
// =============================================
function copyNumber() {
  const val = input.value.trim();
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    showMessage('✓ Number copied to clipboard!', 'success');
    copyBtn.style.color = '#10b981';
    setTimeout(() => { copyBtn.style.color = ''; }, 1500);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = val;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showMessage('✓ Number copied!', 'success');
  });
}

// =============================================
// HISTORY
// =============================================
function addToHistory(value, type, time) {
  // Avoid duplicate consecutive entries
  if (history.length > 0 && history[0].value === value && history[0].type === type) return;

  history.unshift({ value, type, time });
  if (history.length > 10) history.pop(); // Keep max 10
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No barcodes generated yet</div>';
    return;
  }

  history.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-dot"></div>
      <div class="history-info">
        <div class="history-number">${item.value}</div>
        <div class="history-meta">${item.time}</div>
      </div>
      <span class="history-type">${item.type}</span>
    `;
    // Click to re-load
    div.addEventListener('click', () => {
      input.value = item.value;
      // Match type in dropdown
      for (let opt of typeSelect.options) {
        if (opt.value === item.type) { typeSelect.value = item.type; break; }
      }
      generateBarcode();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    historyList.appendChild(div);
  });
}

function clearHistory() {
  history = [];
  renderHistory();
  showMessage('History cleared.', 'success');
}

// =============================================
// AUTO-SELECT FORMAT HELPER
// When user types, try to auto-suggest format
// =============================================
function autoDetectType() {
  const val = input.value.replace(/[^0-9]/g, '');
  if (val.length === 13 && typeSelect.value !== 'EAN13') {
    // Silently update hint, don't force change
  }
}

// =============================================
// EVENT LISTENERS
// =============================================
generateBtn.addEventListener('click', generateBarcode);
downloadBtn.addEventListener('click', downloadBarcode);
printBtn.addEventListener('click', printBarcode);
clearBtn.addEventListener('click', clearAll);
copyBtn.addEventListener('click', copyNumber);
clearHistoryBtn.addEventListener('click', clearHistory);

// Enter key triggers generate
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateBarcode();
});

// Live type detection
input.addEventListener('input', autoDetectType);

// =============================================
// ON LOAD — Auto focus & generate default
// =============================================
window.addEventListener('load', () => {
  input.focus();
  // Auto-generate default value
  setTimeout(() => generateBarcode(), 600);
});
