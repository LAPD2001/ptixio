
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

  // Κλείνουμε την προηγούμενη κάμερα
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  // 🕐 Μικρό διάλειμμα για να απελευθερωθεί πλήρως η συσκευή
  await new Promise(r => setTimeout(r, 400));

  const cam = cameras.find(c => c.deviceId === deviceId);
  const isBack = cam && cam.label.toLowerCase().includes("back");

  let constraints = { video: { deviceId: { exact: deviceId } } };

  try {
    log("🎥 Trying camera: " + (cam?.label || "unknown"));
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err1) {
    log("⚠️ Exact device failed: " + err1.message);

    // 🕐 Ακόμα ένα μικρό delay πριν το retry βοηθά σε κινητά (ιδίως Android)
    await new Promise(r => setTimeout(r, 500));

    try {
      constraints = { video: { facingMode: isBack ? "environment" : "user" } };
      log("🔄 Retrying with facingMode: " + constraints.video.facingMode);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err2) {
      log("❌ All camera attempts failed: " + err2.message);
      return;
    }
  }

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
  log("✅ Camera started: " + (cam?.label || "unnamed"));
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
