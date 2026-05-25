/**
 * BarcodeForge PWA — FINAL WORKING script.js
 * Created by Prathamesh Prashant Pawar
 */

'use strict';

/* =========================
   STATE
========================= */

let lastGenerated = null;

let history =
JSON.parse(localStorage.getItem('bf_history') || '[]');


/* =========================
   MESSAGE
========================= */

function showMessage(text, type = 'success') {

    const el = document.getElementById('message');

    if (!el) return;

    el.innerText = text;

    el.style.display = 'block';

    if(type === 'error'){
        el.style.color = '#ff4d4d';
    } else {
        el.style.color = '#00ff99';
    }

    setTimeout(() => {
        el.style.display = 'none';
    }, 3000);
}


/* =========================
   GENERATE BARCODE + QR
========================= */

function generateBarcode() {

    const input =
    document.getElementById('barcodeInput');

    const type =
    document.getElementById('barcodeType');

    const canvas =
    document.getElementById('barcodeCanvas');

    const qrDiv =
    document.getElementById('qrcode');

    if (!input || !type || !canvas || !qrDiv) {
        alert('Required HTML elements missing!');
        return;
    }

    const value = input.value.trim();

    if (!value) {
        showMessage('Enter a value!', 'error');
        return;
    }

    try {

        /* BARCODE */

        JsBarcode(canvas, value, {
            format: type.value,
            width: 2,
            height: 90,
            displayValue: false,
            background: "#ffffff",
            lineColor: "#000000",
            margin: 10
        });

        /* QR */

        qrDiv.innerHTML = '';

        new QRCode(qrDiv, {
            text: value,
            width: 200,
            height: 200
        });

        /* SAVE */

        const now = new Date().toLocaleString();

        lastGenerated = {
            value: value,
            type: type.value,
            time: now
        };

        addToHistory(value, type.value, now);

        showMessage('✓ Generated Successfully');

    } catch (e) {

        showMessage('✗ ' + e.message, 'error');

    }

}


/* =========================
   DOWNLOAD BARCODE
========================= */

function downloadBarcode() {

    if (!lastGenerated) {
        showMessage('Generate first!', 'error');
        return;
    }

    const canvas =
    document.getElementById('barcodeCanvas');

    const a =
    document.createElement('a');

    a.download =
    'barcode_' + lastGenerated.value + '.png';

    a.href =
    canvas.toDataURL('image/png');

    a.click();

}


/* =========================
   DOWNLOAD QR
========================= */

function downloadQR() {

    if (!lastGenerated) {
        showMessage('Generate first!', 'error');
        return;
    }

    const qrImg =
    document.querySelector('#qrcode img');

    if (!qrImg) {
        showMessage('QR not found!', 'error');
        return;
    }

    const a =
    document.createElement('a');

    a.download =
    'qr_' + lastGenerated.value + '.png';

    a.href =
    qrImg.src;

    a.click();

}


/* =========================
   PRINT
========================= */

function printBarcode() {

    if (!lastGenerated) return;

    const canvas =
    document.getElementById('barcodeCanvas');

    const qrImg =
    document.querySelector('#qrcode img');

    const w = window.open('');

    w.document.write(`

        <html>
        <head>
        <title>Print</title>
        </head>

        <body style="text-align:center;font-family:Arial;">

        <h2>BarcodeForge</h2>

        <img src="${canvas.toDataURL()}">

        <br><br>

        ${qrImg ? `<img src="${qrImg.src}" width="200">` : ''}

        <p>${lastGenerated.value}</p>

        <script>
        window.onload = function(){
            window.print();
            window.close();
        }
        <\/script>

        </body>
        </html>

    `);

    w.document.close();

}


/* =========================
   COPY
========================= */

function copyNumber() {

    const val =
    document.getElementById('barcodeInput').value;

    if (!val) return;

    navigator.clipboard.writeText(val);

    showMessage('✓ Copied');

}


/* =========================
   CLEAR
========================= */

function clearAll() {

    const canvas =
    document.getElementById('barcodeCanvas');

    const ctx =
    canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    document.getElementById('qrcode').innerHTML = '';

    document.getElementById('barcodeInput').value = '';

    lastGenerated = null;

    showMessage('✓ Cleared');

}


/* =========================
   HISTORY
========================= */

function addToHistory(value, type, time) {

    history.unshift({
        value,
        type,
        time
    });

    if(history.length > 20){
        history.pop();
    }

    localStorage.setItem(
        'bf_history',
        JSON.stringify(history)
    );

    renderHistory();

}


function renderHistory() {

    const el =
    document.getElementById('historyList');

    if(!el) return;

    if(history.length === 0){

        el.innerHTML =
        '<p>No history yet</p>';

        return;
    }

    el.innerHTML = '';

    history.forEach(item => {

        const div =
        document.createElement('div');

        div.style.marginBottom = '10px';

        div.style.padding = '10px';

        div.style.border =
        '1px solid #444';

        div.style.borderRadius =
        '10px';

        div.innerHTML = `

            <strong>${item.value}</strong>
            <br>
            ${item.type}
            <br>
            <small>${item.time}</small>

        `;

        div.onclick = () => {

            document.getElementById('barcodeInput').value =
            item.value;

            document.getElementById('barcodeType').value =
            item.type;

            generateBarcode();

        };

        el.appendChild(div);

    });

}


/* =========================
   CAMERA SCANNER
========================= */

async function startScanner() {

    try {

        const stream =
        await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            }
        });

        const video =
        document.getElementById("scannerVideo");

        if(!video){
            alert('scannerVideo not found!');
            return;
        }

        video.srcObject = stream;

        showMessage('✓ Camera Started');

    }

    catch(error) {

        alert("Camera access denied!");

    }

}


/* =========================
   EVENTS
========================= */

window.addEventListener('load', () => {

    renderHistory();

    const generateBtn =
    document.getElementById('generateBtn');

    if(generateBtn){
        generateBtn.addEventListener(
            'click',
            generateBarcode
        );
    }

});
