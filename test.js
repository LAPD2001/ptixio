const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none';
document.body.appendChild(video);

const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let stream;
let useScreen = false;
let cameras = [];

// logging function (γράφει και στο console και στη σελίδα)
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

// αρχικοποίηση
window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  if (!useScreen) {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    await startCamera(cameras[0].deviceId);
  } else {
    log("📺 Using screen share...");
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;
    log("🔄 Switching to camera: " + deviceId);
    await startCamera(deviceId);
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  detect();
}

// λήψη λίστας καμερών
async function listCameras() {
    await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  if (cameras.length > 0) {
    log("📷 Found " + cameras.length + " camera(s)");
    cameras.forEach((c, i) => log(`   ${i + 1}. ${c.label || c.deviceId}`));
  } else {
    log("⚠️ No cameras found");
  }
}

// εκκίνηση κάμερας
async function startCamera(deviceId) {
  try {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    log("🎥 Camera started successfully");
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

// BodyPix detect
// Αντικατάσταση της υπάρχουσας detect()
async function detect() {
  if (!net) {
    requestAnimationFrame(detect);
    return;
  }

  // περιμένουμε να έχει το video διαστάσεις
  if (!video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    // 1) τρέχουμε multi-person segmentation
    const segmentations = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7,
      maxDetections: 10
    });

    // 2) set canvas pixel size to video size
    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;

    // 3) σχεδιάζουμε πρώτα το video ως background (ώστε η μάσκα να είναι πάνω)
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
    ctxMask.drawImage(video, 0, 0, canvasMask.width, canvasMask.height);

    // 4) αν δεν έχουμε ανθρώπους, απλά ενημερώνουμε το count και τελειώνουμε
    if (!Array.isArray(segmentations) || segmentations.length === 0) {
      countDiv.textContent = `Number of people: 0`;
      requestAnimationFrame(detect);
      return;
    }

    // 5) δημιουργούμε προσωρινό offscreen canvas για να "συγχωνεύσουμε" όλα τα masks
    const off = document.createElement('canvas');
    off.width = canvasMask.width;
    off.height = canvasMask.height;
    const offCtx = off.getContext('2d');

    // προαιρετικά: καθαρίζουμε και το offscreen
    offCtx.clearRect(0, 0, off.width, off.height);

    // 6) για κάθε segmentation, παίρνουμε μάσκα (ImageData-like) και την τοποθετούμε στο offscreen
    for (let seg of segmentations) {
      // bodyPix.toMask δουλεύει με single segmentation
      const mask = bodyPix.toMask(seg); // {data: Uint8ClampedArray, width, height}
      // δημιουργούμε ImageData από τα δεδομένα της μάσκας
      const imageData = new ImageData(new Uint8ClampedArray(mask.data), mask.width, mask.height);
      // putImageData στο offscreen (στο pixel scale)
      offCtx.putImageData(imageData, 0, 0);
      // με source-over ενώνουμε τις μάσκες (default)
      // αν θέλεις διαφορετικά χρώματα/στυλ, θα πρέπει να επεξεργαστείς τα pixel πριν putImageData
    }

    // 7) (προαιρετικό) εφαρμόζουμε blur στο offscreen πριν το σχεδιάσουμε
    // (εργαλειο: ctx.filter)
    offCtx.filter = 'blur(3px)';       // ή '' για no blur
    const blurred = document.createElement('canvas');
    blurred.width = off.width;
    blurred.height = off.height;
    const blurredCtx = blurred.getContext('2d');
    blurredCtx.drawImage(off, 0, 0);
    offCtx.filter = 'none';

    // 8) σχεδιάζουμε την συγχωνευμένη μάσκα πάνω στο κύριο canvas με opacity
    ctxMask.save();
    ctxMask.globalAlpha = 0.6;         // opacity της μάσκας (όπως το drawMask)
    ctxMask.drawImage(blurred, 0, 0, canvasMask.width, canvasMask.height);
    ctxMask.restore();

    // 9) ενημέρωση πλήθους
    const count = segmentations.length;
    countDiv.textContent = `Number of people: ${count}`;

  } catch (err) {
    log("⚠️ Detect error: " + (err && err.message ? err.message : err));
  }

  requestAnimationFrame(detect);
}
