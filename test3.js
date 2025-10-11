// δουλεύει για μία-μία κάμερα ή όλες μαζί ή screen share

const videoContainer = document.createElement('div');
videoContainer.style.display = 'flex';
videoContainer.style.flexWrap = 'wrap';
videoContainer.style.gap = '10px';
document.body.appendChild(videoContainer);

const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let streams = [];
let useScreen = false;
let cameras = [];

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
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '400px';
    videoContainer.appendChild(video);

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    streams = [stream];
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;
    log("🔄 Switching to: " + deviceId);
    await startCamera(deviceId);
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

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  // προσθήκη επιλογής "Όλες οι κάμερες"
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📸 Όλες οι κάμερες';
  cameraSelect.appendChild(allOption);

  if (cameras.length > 0) {
    log("📷 Found " + cameras.length + " camera(s)");
    cameras.forEach((c, i) => log(`   ${i + 1}. ${c.label || c.deviceId}`));
  } else {
    log("⚠️ No cameras found");
  }
}

async function startCamera(deviceId) {
  // σταματάμε παλιά streams
  streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  streams = [];
  videoContainer.innerHTML = '';

  if (deviceId === 'all') {
    // εμφανίζουμε όλες τις κάμερες
    for (const cam of cameras) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.width = '300px';
      videoContainer.appendChild(video);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      video.srcObject = stream;
      streams.push(stream);
    }
  } else {
    // μόνο μία κάμερα
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '400px';
    videoContainer.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    video.srcObject = stream;
    streams.push(stream);
  }

  log("🎥 Camera(s) started successfully");
}

async function detect() {
  if (!net || streams.length === 0) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    let totalPeople = 0;

    for (const s of streams) {
      const video = [...videoContainer.querySelectorAll('video')].find(v => v.srcObject === s);
      if (!video || !video.videoWidth) continue;

      const segmentation = await net.segmentMultiPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      totalPeople += segmentation.length;
    }

    countDiv.textContent = `Number of people: ${totalPeople}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}
