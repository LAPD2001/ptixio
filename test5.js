// Εμφάνιση όλων των καμερών μαζί χωρίς μάσκα

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
document.body.appendChild(video);

const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let stream;
let cameras = [];
let mode = 'single';
let activeStreams = [];

// logging
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// αρχικοποίηση
window.onload = init;

async function init() {
  log("🚀 Initializing...");

  await listCameras();

  // προσθήκη επιλογής "All cameras"
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📸 All cameras';
  cameraSelect.prepend(allOption);

  cameraSelect.onchange = async () => {
    const val = cameraSelect.value;
    if (val === 'all') {
      await showAllCameras();
    } else {
      await startSingleCamera(val);
    }
  };

  // εκκίνηση με την πρώτη κάμερα
  if (cameras.length > 0) {
    await startSingleCamera(cameras[0].deviceId);
  }
}

// Λήψη λίστας καμερών
async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices.filter(d => d.kind === 'videoinput');

    cameraSelect.innerHTML = '';
    cameras.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    log(`📷 Found ${cameras.length} camera(s)`);
  } catch (err) {
    log("❌ Error listing cameras: " + err.message);
  }
}

// Εμφάνιση μιας κάμερας
async function startSingleCamera(deviceId) {
  mode = 'single';
  stopAllStreams();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    video.srcObject = stream;
    video.style.display = 'block';

    // καθάρισε τυχόν άλλες κάμερες από τη σελίδα
    document.querySelectorAll('.multiCam').forEach(el => el.remove());

    log("🎥 Showing single camera");
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

// Εμφάνιση όλων των καμερών
async function showAllCameras() {
  mode = 'all';
  stopAllStreams();

  video.style.display = 'none';
  document.querySelectorAll('.multiCam').forEach(el => el.remove());
  activeStreams = [];

  for (let i = 0; i < cameras.length; i++) {
    const cam = cameras[i];
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.className = 'multiCam';
    v.style.width = '300px';
    v.style.margin = '5px';
    document.body.appendChild(v);

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      v.srcObject = s;
      activeStreams.push(s);
      log(`📸 Showing camera ${i + 1}`);
    } catch (err) {
      log(`❌ Error opening camera ${i + 1}: ${err.message}`);
    }
  }
}

// Σταμάτημα όλων των streams
function stopAllStreams() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
  activeStreams = [];
}

// Καθαρισμός στο κλείσιμο
window.addEventListener('beforeunload', stopAllStreams);
