const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let streams = [];
let videos = [];
let useScreen = false;
let cameras = [];

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
    await startSingleCamera(cameras[0].deviceId);
  } else {
    log("📺 Using screen share...");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = createVideoElement(stream);
    videos = [video];
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;

    if (deviceId === 'all') {
      log("🎥 Showing all cameras");
      await startAllCameras();
    } else {
      log("🔄 Switching to camera: " + deviceId);
      await startSingleCamera(deviceId);
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

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  if (cameras.length > 1) {
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Cameras';
    cameraSelect.appendChild(allOption);
  }

  log(`📷 Found ${cameras.length} camera(s)`);
}

// βοηθητική: δημιουργεί video element
function createVideoElement(stream) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  video.style.width = '300px';
  video.style.margin = '5px';
  document.body.appendChild(video);
  return video;
}

// μία κάμερα
async function startSingleCamera(deviceId) {
  // σταματάει όλες τις προηγούμενες
  streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  videos.forEach(v => v.remove());
  streams = [];
  videos = [];

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  const video = createVideoElement(stream);
  streams.push(stream);
  videos.push(video);
}

// όλες οι κάμερες
async function startAllCameras() {
  streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  videos.forEach(v => v.remove());
  streams = [];
  videos = [];

  for (const cam of cameras) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: cam.deviceId } },
      audio: false
    });
    const video = createVideoElement(stream);
    streams.push(stream);
    videos.push(video);
  }
}

// BodyPix detect
async function detect() {
  if (!net || videos.length === 0) {
    requestAnimationFrame(detect);
    return;
  }

  try {
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

      // ζωγραφίζει τη μάσκα πάνω στο βίντεο
      bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);
      totalPeople += segmentation.length;
    }

    countDiv.textContent = `Number of people: ${totalPeople}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}