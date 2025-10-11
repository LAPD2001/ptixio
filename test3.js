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

let net;
let stream;
let useScreen = false;
let cameras = [];
let allStreams = [];
let allVideos = [];

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
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      await startAllCameras();
    } else {
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
    cameras.forEach((c, i) => log(`   ${i + 1}. ${c.label || c.deviceId}`));
  } else {
    log("⚠️ No cameras found");
  }
}

// εκκίνηση μίας κάμερας
async function startCamera(deviceId) {
  stopAllStreams();
  allVideos.forEach(v => v.remove());
  allVideos = [];

  try {
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

// εκκίνηση όλων των καμερών
async function startAllCameras() {
  stopAllStreams();
  allVideos.forEach(v => v.remove());
  allVideos = [];
  allStreams = [];

  for (let device of cameras) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false
      });
      allStreams.push(s);

      const v = document.createElement('video');
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.srcObject = s;
      v.style.width = '200px';
      v.style.height = 'auto';
      document.body.appendChild(v);
      allVideos.push(v);
    } catch (err) {
      log("❌ Could not start camera " + device.label + ": " + err.message);
    }
  }
}

// σταμάτημα όλων των streams
function stopAllStreams() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  allStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
  allStreams = [];
}

// BodyPix detect
async function detect() {
  if (!net) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);

    let peopleCount = 0;

    if (cameraSelect.value === "all") {
      // όλες οι κάμερες ταυτόχρονα
      allVideos.forEach(async v => {
        if (!v.videoWidth) return;

        canvasMask.width = v.videoWidth;
        canvasMask.height = v.videoHeight;

        const segmentation = await net.segmentMultiPerson(v, {
          internalResolution: 'medium',
          segmentationThreshold: 0.7
        });

        const mask = bodyPix.toMask(segmentation);
        bodyPix.drawMask(canvasMask, v, mask, 0.6, 3, false);

        peopleCount += segmentation.length;
      });
    } else {
      if (video.videoWidth) {
        const segmentation = await net.segmentMultiPerson(video, {
          internalResolution: 'medium',
          segmentationThreshold: 0.7
        });

        canvasMask.width = video.videoWidth;
        canvasMask.height = video.videoHeight;
        const mask = bodyPix.toMask(segmentation);
        bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);

        peopleCount = segmentation.length;
      }
    }

    countDiv.textContent = `Number of people: ${peopleCount}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}
