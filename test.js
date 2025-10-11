// Δημιουργία βασικών DOM στοιχείων
const container = document.getElementById('container');
const cameraSelect = document.getElementById('cameraSelect');
const countDiv = document.getElementById('count');
const logDiv = document.getElementById('log');

let net;
let streams = [];
let cameras = [];
let useScreen = false;

// ---------- βοηθητική συνάρτηση για log ----------
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

// ---------- αρχικοποίηση ----------
window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the cameras.");

  // Φόρτωση μοντέλου BodyPix
  log("⏳ Loading BodyPix...");
  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  if (useScreen) {
    log("📺 Using screen share...");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    createVideoCanvas(stream, "Screen Share");
  } else {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }

    // Δημιουργεί βίντεο για κάθε κάμερα
    for (let cam of cameras) {
      await startCamera(cam);
    }
  }

  detectLoop();
}

// ---------- λήψη λίστας καμερών ----------
async function listCameras() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true }); // ζητάει άδεια
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
    cameras.forEach((c, i) => log(`   ${i + 1}. ${c.label || c.deviceId}`));
  } catch (err) {
    log("❌ Error listing cameras: " + err.message);
  }
}

// ---------- εκκίνηση κάμερας ----------
async function startCamera(device) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: device.deviceId } },
      audio: false
    });
    streams.push(stream);
    createVideoCanvas(stream, device.label || "Unnamed Camera");
    log("🎥 Started camera: " + (device.label || device.deviceId));
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

// ---------- δημιουργία στοιχείων video + canvas ----------
function createVideoCanvas(stream, label) {
  const div = document.createElement('div');
  div.style.margin = '10px';
  div.style.display = 'inline-block';
  div.style.textAlign = 'center';

  const title = document.createElement('div');
  title.textContent = label;
  title.style.fontWeight = 'bold';
  div.appendChild(title);

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.width = 320;
  video.height = 240;
  video.srcObject = stream;
  div.appendChild(video);

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  div.appendChild(canvas);

  container.appendChild(div);

  stream.videoElement = video;
  stream.canvasElement = canvas;
}

// ---------- κύριος βρόχος ανίχνευσης ----------
async function detectLoop() {
  if (!net || streams.length === 0) {
    requestAnimationFrame(detectLoop);
    return;
  }

  let totalPeople = 0;

  for (let s of streams) {
    const video = s.videoElement;
    const canvas = s.canvasElement;
    const ctx = canvas.getContext('2d');

    if (video.readyState >= 2) {
      try {
        const segmentation = await net.segmentMultiPerson(video, {
          internalResolution: 'medium',
          segmentationThreshold: 0.7
        });

        const mask = bodyPix.toMask(segmentation);
        bodyPix.drawMask(canvas, video, mask, 0.6, 3, false);

        totalPeople += segmentation.length;
      } catch (err) {
        log("⚠️ Detect error: " + err.message);
      }
    }
  }

  countDiv.textContent = `👥 Total people detected: ${totalPeople}`;
  requestAnimationFrame(detectLoop);
}
