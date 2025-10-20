
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
const cameraContainer = document.getElementById('cameraContainer');

let net;
let stream;
let cameras = [];
let showingAll = false;

// Helper
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

window.onload = init;

async function init() {
  await listCameras();

  if (cameras.length === 0) {
    alert("Δεν βρέθηκαν κάμερες!");
    return;
  }

  // Ξεκινάμε με την πρώτη (συνήθως μπροστά)
  await startCamera(cameras[0].deviceId);

  cameraSelect.onchange = async () => {
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

// Λίστα διαθέσιμων καμερών
async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');

  cameraSelect.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📹 Show all cameras';
  cameraSelect.appendChild(allOption);

  cameras.forEach((device, i) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(option);
  });

  log("📷 Found " + cameras.length + " camera(s)");
}

// Εκκίνηση συγκεκριμένης κάμερας με fallback
async function startCamera(deviceId) {
  showingAll = false;
  cameraContainer.innerHTML = '';

  // Σταματάμε ό,τι υπήρχε πριν
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  // Περιμένουμε λίγο για να “απελευθερωθεί” η κάμερα
  await new Promise(r => setTimeout(r, 500));

  const cam = cameras.find(c => c.deviceId === deviceId);
  const label = cam?.label?.toLowerCase() || '';
  const isBack = label.includes('back') || label.includes('rear') || label.includes('environment');

  log(`🎥 Starting camera: ${cam?.label || deviceId}`);
  
  let tried = [];
  let success = false;

  const tryConstraints = async (constraints, name) => {
    try {
      log(`🔧 Trying ${name}: ${JSON.stringify(constraints)}`);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      success = true;
      log(`✅ Success with ${name}`);
    } catch (err) {
      tried.push(`${name} → ${err.name}`);
      log(`❌ Failed ${name}: ${err.message}`);
    }
  };

  // 🔹 1. Προσπαθούμε με το ακριβές deviceId
  await tryConstraints({ video: { deviceId: { exact: deviceId } } }, "exact deviceId");

  // 🔹 2. Αν αποτύχει, προσπαθούμε με facingMode
  if (!success) {
    await tryConstraints({ video: { facingMode: isBack ? "environment" : "user" } }, "facingMode");
  }

  // 🔹 3. Αν ακόμα αποτύχει, fallback σε default κάμερα
  if (!success) {
    await tryConstraints({ video: true }, "default camera");
  }

  // Αν αποτύχουν όλα
  if (!success) {
    log("❌ Could not start any camera. Tried: " + tried.join(", "));
    alert("Η κάμερα δεν μπορεί να ξεκινήσει. Ίσως χρησιμοποιείται από άλλη εφαρμογή.");
    return;
  }

  // ✅ Επιτυχία
  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
      resolve();
    };
  });

  await video.play();

  canvasMask.style.display = 'block';
  log(`🎬 Camera active (${video.videoWidth}x${video.videoHeight})`);
}



// Προβολή όλων των καμερών
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
        video: { deviceId: { exact: cam.deviceId } }
      });
      v.srcObject = s;
    } catch (err) {
      block.textContent = "❌ " + (err.message || err);
    }
  }

  log("📺 Showing all cameras (no detection)");
}

// Ανίχνευση με BodyPix
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
