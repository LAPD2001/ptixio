const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let streams = [];
let useScreen = false;
let cameras = [];
let videos = []; // πίνακας με όλα τα video elements

function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  if (!useScreen) {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    await startCamera(cameras[0].deviceId); // ξεκινά η πρώτη κάμερα
  } else {
    log("📺 Using screen share...");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    createVideoForStream(stream);
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;

    // Αν επιλέχθηκε "All", δείξε όλες τις κάμερες
    if (deviceId === "all") {
      log("🔄 Showing all cameras...");
      await showAllCameras();
    } else {
      log("🔄 Switching to camera: " + deviceId);
      await startCamera(deviceId);
    }
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  detect();
}

async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

  // Προσθήκη επιλογής "All cameras"
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Cameras';
  cameraSelect.appendChild(allOption);

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

async function startCamera(deviceId) {
  stopAllStreams();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    createVideoForStream(stream);
    log("🎥 Camera started successfully");
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

async function showAllCameras() {
  stopAllStreams();
  for (const cam of cameras) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      createVideoForStream(stream);
    } catch (err) {
      log("⚠️ Error starting one camera: " + err.message);
    }
  }
}

function createVideoForStream(stream) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.width = 320;
  video.height = 240;
  video.style.margin = "5px";
  document.body.appendChild(video);

  video.srcObject = stream;
  streams.push(stream);
  videos.push(video);
}

function stopAllStreams() {
  streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  streams = [];
  videos.forEach(v => v.remove());
  videos = [];
}

// BodyPix detect
async function detect() {
  if (!net || videos.length === 0) {
    requestAnimationFrame(detect);
    return;
  }

  ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
  let totalPeople = 0;

  for (const video of videos) {
    if (!video.videoWidth) continue;

    const segmentation = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    const mask = bodyPix.toMask(segmentation);
    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);

    totalPeople += segmentation.length;
  }

  countDiv.textContent = `Number of people: ${totalPeople}`;
  requestAnimationFrame(detect);
}
