const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none';
document.body.appendChild(video);

const canvasMask = document.getElementById('canvasMask'); // Κεντρικός καμβάς για single camera
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let stream;
let useScreen = false;
let cameras = [];

// Για όταν δείχνουμε όλες τις κάμερες
let multiCameras = [];
let multiCanvases = [];

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
    await startCamera(cameras[0].deviceId);
  } else {
    log("📺 Using screen share...");
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
  }

  cameraSelect.onchange = async () => {
    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      log("🔄 Showing all cameras");
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

async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = "all";
  allOption.textContent = "All Cameras";
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
  try {
    // Καθαρισμός multi-cameras αν υπάρχει
    multiCameras.forEach(c => c.video.remove());
    multiCanvases.forEach(c => c.remove());
    multiCameras = [];
    multiCanvases = [];

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

// Όλες οι κάμερες μαζί
async function startAllCameras() {
  // Καθαρισμός προηγούμενου
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  multiCameras.forEach(c => c.video.remove());
  multiCanvases.forEach(c => c.remove());
  multiCameras = [];
  multiCanvases = [];

  for (let device of cameras) {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    document.body.appendChild(v);

    const s = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: device.deviceId } },
      audio: false
    });

    v.srcObject = s;
    await v.play();

    const c = document.createElement('canvas');
    document.body.appendChild(c);

    multiCameras.push({ video: v, stream: s });
    multiCanvases.push(c);
  }
}

// Κύκλος ανίχνευσης
async function detect() {
  if (!net) {
    requestAnimationFrame(detect);
    return;
  }

  if (multiCameras.length > 0) {
    // Όλες οι κάμερες
    for (let i = 0; i < multiCameras.length; i++) {
      const v = multiCameras[i].video;
      const c = multiCanvases[i];
      if (!v.videoWidth) continue;

      const segmentation = await net.segmentMultiPerson(v, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);

      const mask = bodyPix.toMask(segmentation);
      bodyPix.drawMask(c, v, mask, 0.6, 3, false);
    }
  } else if (video.videoWidth) {
    // Single camera ή screen
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
  }

  requestAnimationFrame(detect);
}
