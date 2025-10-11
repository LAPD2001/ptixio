//doulevei gia mia-mia kamera kai screen share

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none';
video.style.width = '300px';
video.style.margin = '5px';

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
async function detect() {
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