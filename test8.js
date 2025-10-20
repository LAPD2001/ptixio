// ✅ Full working version with smart camera switching and screen share option

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none'; // Δεν χρειάζεται να φαίνεται
document.body.appendChild(video);

const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');
const cameraContainer = document.getElementById('cameraContainer');

let net;
let stream;
let cameras = [];
let showingAll = false;
let useScreen = false;

// Logging helper
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Init
window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  if (!useScreen) {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    // Ξεκινάμε με την πρώτη διαθέσιμη κάμερα
    await startCamera(cameras[0].deviceId);
  } else {
    await startScreenShare();
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      await showAllCameras();
    } else {
      await startCamera(deviceId);
    }
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  detect();
}

// Λίστα καμερών
async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');

  cameraSelect.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📹 Show all cameras';
  cameraSelect.appendChild(allOption);

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  log("📷 Found " + cameras.length + " camera(s)");
}

// ✅ Smart screen share
async function startScreenShare() {
  log("📺 Using screen share...");

  stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 1280, height: 720, frameRate: 30 }
  });

  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
      canvasMask.style.display = "block";
      resolve();
    };
  });

  log(`🎬 Screen share resolution: ${video.videoWidth}x${video.videoHeight}`);
}

// ✅ Smart camera start with fallback
async function startCamera(deviceId) {
  showingAll = false;
  cameraContainer.innerHTML = '';

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  let constraints;

  // Αν το deviceId αντιστοιχεί σε πίσω κάμερα (με όνομα ή index)
  const cam = cameras.find(c => c.deviceId === deviceId);
  const isBackCam = cam && cam.label.toLowerCase().includes('back');

  try {
    constraints = isBackCam
      ? { video: { facingMode: { ideal: "environment" } } }
      : { video: { deviceId: { exact: deviceId } } };

    log("🎥 Trying camera with constraints: " + JSON.stringify(constraints));

    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    log("⚠️ Fallback to default camera: " + err.message);
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
  }

  video.srcObject = stream;
  await video.play();

  canvasMask.style.display = 'block';
  log("✅ Camera started successfully");
}

// Δείχνει όλες τις κάμερες χωρίς ανίχνευση
async function showAllCameras() {
  showingAll = true;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
  canvasMask.style.display = 'none';
  cameraContainer.innerHTML = "<h3>All cameras view (no detection active)</h3>";

  for (let i = 0; i < cameras.length; i++) {
    const cam = cameras[i];

    const block = document.createElement('div');
    block.style.display = 'inline-block';
    block.style.margin = '6px';
    block.style.padding = '6px';
    block.style.border = '1px solid #444';
    block.style.width = '320px';
    block.style.textAlign = 'center';
    block.textContent = cam.label || `Camera ${i + 1}`;

    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.style.width = '100%';
    v.style.marginTop = '4px';
    block.appendChild(v);
    cameraContainer.appendChild(block);

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      v.srcObject = s;
    } catch (err) {
      block.textContent = "❌ " + (err.message || err);
    }
  }

  log("📺 Showing all cameras (no detection)");
}

// Ανίχνευση BodyPix
async function detect() {
  if (showingAll) {
    requestAnimationFrame(detect);
    return;
  }

  if (!net || !video.videoWidth) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const segmentation = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);

    const mask = bodyPix.toMask(segmentation);
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);

    const count = segmentation.length;
    countDiv.textContent = `Number of people: ${count}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}
