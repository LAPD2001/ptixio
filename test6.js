// Doulevei kanonika gia screen share. Doulevei gia camera me maska otan einai mia mia h kamera. Otan deixnei olew tis kameres mazi den deixnei maskes gia logous poluplokothtas.
const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none';
let useScreen = false;

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

// logging function
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
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
    // ξεκινάμε με “Show all cameras”
    await showAllCameras();
  } else {
    log("📺 Using screen share...");
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
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

// λίστα καμερών
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

  if (cameras.length > 0) {
    log("📷 Found " + cameras.length + " camera(s)");
  } else {
    log("⚠️ No cameras found");
  }
}

// εκκίνηση μίας κάμερας (με μάσκα)
async function startCamera(deviceId) {
  showingAll = false;
  cameraContainer.innerHTML = ''; // καθαρίζουμε container

  // σταματάμε ό,τι υπάρχει
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    //stream = null;
  }

  // παίρνουμε το stream
  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  // εμφανίζουμε το canvas (μάσκα)
  canvasMask.style.display = 'block';
  log("🎥 Camera started: " + deviceId);
}

// δείχνει όλες τις κάμερες χωρίς μάσκα
async function showAllCameras() {
  showingAll = true;

  // σταματάμε ό,τι άλλο υπάρχει
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  // κρύβουμε τη μάσκα
  ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
  canvasMask.style.display = 'none';

  // καθαρίζουμε και προσθέτουμε τίτλο
  cameraContainer.innerHTML = "<h3>All cameras view (no detection active)</h3>";

  // ξεκινάμε όλες τις κάμερες
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

// BodyPix detect
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
