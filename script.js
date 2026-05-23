const input = document.getElementById("barcodeInput");
const barcode = document.getElementById("barcode");
const qrcodeDiv = document.getElementById("qrcode");
const message = document.getElementById("message");
const historyList = document.getElementById("historyList");
const loader = document.getElementById("loader");

window.onload = () => {
    generateCode();
};

input.addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        generateCode();
    }
});

function generateCode(){

    let value = input.value.trim();
    let type = document.getElementById("barcodeType").value;

    if(value === ""){
        alert("Please enter a value");
        return;
    }

    loader.style.display = "block";

    setTimeout(() => {

        // Generate Barcode
        JsBarcode("#barcode", value, {
            format: type,
            lineColor: "#000",
            width: 2,
            height: 80,
            displayValue: false
        });

        // Clear previous QR
        qrcodeDiv.innerHTML = "";

        // Generate QR
        new QRCode(qrcodeDiv, {
            text: value,
            width: 180,
            height: 180
        });

        loader.style.display = "none";

        message.innerHTML = "✅ Barcode & QR Generated Successfully";

        addHistory(value, type);

    }, 500);
}

function downloadBarcode(){

    let svg = document.getElementById("barcode");

    let serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    let image = new Image();

    image.src = 'data:image/svg+xml;base64,' + window.btoa(source);

    image.onload = function(){

        let canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;

        let context = canvas.getContext('2d');

        context.fillStyle = "#ffffff";
        context.fillRect(0,0,canvas.width,canvas.height);

        context.drawImage(image,0,0);

        let a = document.createElement('a');

        a.download = input.value + "_barcode.png";

        a.href = canvas.toDataURL("image/png");

        a.click();
    };
}

function printCode(){
    window.print();
}

function clearAll(){

    input.value = "";

    barcode.innerHTML = "";

    qrcodeDiv.innerHTML = "";

    message.innerHTML = "";
}

function copyText(){

    navigator.clipboard.writeText(input.value);

    alert("Copied Successfully");
}

function addHistory(value, type){

    let li = document.createElement("li");

    let date = new Date().toLocaleString();

    li.innerHTML = `
        <strong>${value}</strong> (${type})<br>
        <small>${date}</small>
    `;

    historyList.prepend(li);

    if(historyList.children.length > 10){
        historyList.removeChild(historyList.lastChild);
    }
}

async function startScanner() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        const video = document.getElementById("scannerVideo");
        video.srcObject = stream;

    } catch (error) {
        alert("Camera access denied!");
    }
}