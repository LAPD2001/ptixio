const logDiv = document.getElementById('log');
const cameraContainer = document.getElementById('cameraContainer');
const cameraSelect = document.getElementById('cameraSelect');

let net;
let cameras = [];
let activeStreams = [];

// απλή logging function
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

// αρχή
window.onload = init;

async function init() {
  log("🚀 Initializing...");
  await navigator.mediaDevices.getUserMedia({ video: true }); // ζητάει άδεια

  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  log(`📷 Found ${cameras.length} camera(s)`);

  if (cameras.length === 0) {
    log("⚠️ No cameras found.");
    return;
  }

  // Προσθέτουμε επιλογές στο dropdown
  cameraSelect.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📸 All cameras';
  cameraSelect.appendChild(allOption);

  cameras.forEach((cam, i) => {
    const option = document.createElement('option');
    option.value = cam.deviceId;
    option.textContent = cam.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(option);
  });

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  // όταν αλλάζει επιλογή στο select
  cameraSelect.onchange = () => handleCameraSelection(cameraSelect.value);

  // ξεκινάμε με “All cameras”
  handleCameraSelection('all');
}

// χειρίζεται ποια κάμερα να δείξει
async function handleCameraSelection(value) {
  // καθαρίζει ό,τι υπήρχε
  cameraContainer.innerHTML = '';
  activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
  activeStreams = [];

  if (value === 'all') {
    log("🌐 Displaying ALL cameras...");
    for (let i = 0; i < cameras.length; i++) {
      await createCameraBlock(cameras[i], i);
    }
  } else {
    const camera = cameras.find(c => c.deviceId === value);
    if (camera) {
      log(`🎥 Displaying only camera: ${camera.label || camera.deviceId}`);
      await createCameraBlock(camera, cameras.indexOf(camera));
    } else {
      log("⚠️ Camera not found!");
    }
  }
}

// δημιουργεί video + canvas για κάθε κάμερα
async function createCameraBlock(camera, index) {
  const block = document.createElement('div');
  block.style.border = "1px solid #333";
  block.style.margin = "10px";
  block.style.padding = "10px";
  block.style.display = "inline-block";
  block.style.verticalAlign = "top";

  const title = document.createElement('div');
  title.textContent = `🎥 Camera ${index + 1}: ${camera.label || camera.deviceId}`;
  block.appendChild(title);

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.width = "320px";
  block.appendChild(video);

  const canvas = document.createElement('canvas');
  canvas.style.display = "block";
  canvas.style.marginTop = "5px";
  block.appendChild(canvas);

  const countDiv = document.createElement('div');
  countDiv.textContent = "People: 0";
  countDiv.style.marginTop = "5px";
  block.appendChild(countDiv);

  cameraContainer.appendChild(block);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: camera.deviceId } }
    });
    video.srcObject = stream;
    await video.play();
    activeStreams.push(stream);
    log(`✅ Started camera ${index + 1}`);

    detectLoop(video, canvas, countDiv);
  } catch (err) {
    log(`❌ Error starting camera ${index + 1}: ${err.message}`);
  }
}

// BodyPix detection loop για κάθε κάμερα
async function detectLoop(video, canvas, countDiv) {
  const ctx = canvas.getContext('2d');

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


  detect();
}
