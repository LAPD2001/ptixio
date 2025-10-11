const logDiv = document.getElementById('log');
const cameraContainer = document.getElementById('cameraContainer');
const modeSelect = document.getElementById('modeSelect');
const cameraSelect = document.getElementById('cameraSelect');

let net;
let cameras = [];

function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

window.onload = init;

async function init() {
  log("🚀 Initializing...");
  // Ζητάμε πρώτα άδεια για να αποκαλυφθούν τα labels στο κινητό
  try {
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
  } catch (e) {
    log("⚠️ Δεν δόθηκε άδεια στην κάμερα.");
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  log(`📷 Βρέθηκαν ${cameras.length} κάμερες.`);

  if (cameras.length === 0) {
    log("⚠️ Καμία κάμερα δεν βρέθηκε.");
    return;
  }

  // Γεμίζουμε το select με τις κάμερες
  cameraSelect.innerHTML = "";
  cameras.forEach((cam, i) => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(opt);
  });

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  // Αν αλλάξει το mode ή η κάμερα, επανεκκινεί
  modeSelect.onchange = startSelectedMode;
  cameraSelect.onchange = startSelectedMode;

  startSelectedMode();
}

async function startSelectedMode() {
  cameraContainer.innerHTML = "";

  if (modeSelect.value === "all") {
    // Όλες οι κάμερες
    for (let i = 0; i < cameras.length; i++) {
      await createCameraBlock(cameras[i], i);
    }
  } else {
    // Μία κάμερα
    const selected = cameras.find(c => c.deviceId === cameraSelect.value);
    if (selected) await createCameraBlock(selected, 0);
  }
}

// Δημιουργεί video + canvas για κάθε κάμερα
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
    log(`✅ Ξεκίνησε η κάμερα ${index + 1}`);

    detectLoop(video, canvas, countDiv);
  } catch (err) {
    log(`❌ Σφάλμα στην κάμερα ${index + 1}: ${err.message}`);
  }
}

// Ανίχνευση ατόμων με BodyPix
async function detectLoop(video, canvas, countDiv) {
  const ctx = canvas.getContext('2d');

  async function detect() {
    if (!video.videoWidth) {
      requestAnimationFrame(detect);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const segmentation = await net.segmentMultiPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      const mask = bodyPix.toMask(segmentation);
      bodyPix.drawMask(canvas, video, mask, 0.6, 3, false);

      const count = segmentation.length;
      countDiv.textContent = `People: ${count}`;
    } catch (err) {
      log(`⚠️ Detect error: ${err.message}`);
    }

    requestAnimationFrame(detect);
  }

  detect();
}
