// Δουλεύει για μία-μία κάμερα, screen share, και τώρα για "όλες μαζί"

const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let useScreen = false;
let cameras = [];
let videoElements = []; // αποθήκευση όλων των video elements
let streams = [];

// logging function
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
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = "320px";
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    videoElements = [video];
    streams = [stream];
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;

    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      log("🎥 Showing all cameras...");
      await startAllCameras();
    } else {
      log("🔄 Switching to camera: " + deviceId);
      await startCamera(deviceId);
    }
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

  // προσθήκη επιλογής για όλες τις κάμερες
  const allOption = document.createElement('option');
  allOption.value = "all";
  allOption.textContent = "All cameras";
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

// εκκίνηση μίας κάμερας
async function startCamera(deviceId) {
  stopAllStreams();

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.width = "320px";
  document.body.appendChild(video);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  videoElements = [video];
  streams = [stream];

  log("🎥 Camera started successfully");
}

// εκκίνηση όλων των καμερών
async function startAllCameras() {
  stopAllStreams();

  videoElements = [];
  streams = [];

  for (const cam of cameras) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = "240px";
    video.style.margin = "5px";
    document.body.appendChild(video);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();

      videoElements.push(video);
      streams.push(stream);
      log("✅ Started " + (cam.label || cam.deviceId));
    } catch (err) {
      log("❌ Error starting " + (cam.label || cam.deviceId) + ": " + err.message);
    }
  }
}

// σταμάτημα όλων των streams
function stopAllStreams() {
  streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  streams = [];
  videoElements.forEach(v => v.remove());
  videoElements = [];
}

// BodyPix detect
async function detect() {
  if (!net || videoElements.length === 0) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const totalSegs = [];
    canvasMask.width = 640;
    canvasMask.height = 480;
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);

    for (const video of videoElements) {
      if (!video.videoWidth) continue;

      const segmentation = await net.segmentMultiPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });
      totalSegs.push(...segmentation);

      const mask = bodyPix.toMask(segmentation);
      bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);
    }

    countDiv.textContent = `Number of people: ${totalSegs.length}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}
