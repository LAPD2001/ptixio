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
let useScreen = false;
let cameras = [];
let allStreams = [];

// logging function
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
    // προεπιλογή “All Cameras”
    cameraSelect.value = "all";
    await showAllCameras();
  } else {
    log("📺 Using screen share...");
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
  }

  cameraSelect.onchange = async () => {
    const value = cameraSelect.value;
    if (value === "all") {
      await showAllCameras();
    } else {
      await startCamera(value);
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

// εκκίνηση μιας κάμερας
async function startCamera(deviceId) {
  try {
    // καθάρισε προηγούμενα
    if (stream) stream.getTracks().forEach(track => track.stop());
    cameraContainer.innerHTML = '';

    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    canvasMask.style.display = 'block';
    log("🎥 Camera started successfully");
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

// εμφάνιση όλων των καμερών
async function showAllCameras() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  cameraContainer.innerHTML = '';
  allStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
  allStreams = [];

  const cols = Math.ceil(Math.sqrt(cameras.length));
  const size = 240;

  canvasMask.width = cols * size;
  canvasMask.height = cols * size;
  ctxMask.fillStyle = "black";
  ctxMask.fillRect(0, 0, canvasMask.width, canvasMask.height);

  let x = 0, y = 0;

  for (const cam of cameras) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      allStreams.push(s);
      const v = document.createElement('video');
      v.srcObject = s;
      await v.play();

      // σχεδίαση κάθε video μέσα στο main canvas
      const drawFrame = () => {
        if (v.readyState >= 2) {
          ctxMask.drawImage(v, x * size, y * size, size, size);
        }
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      x++;
      if (x >= cols) {
        x = 0;
        y++;
      }
    } catch (e) {
      log("⚠️ Error opening camera: " + e.message);
    }
  }

  countDiv.textContent = "All cameras shown (no mask)";
}

// BodyPix detect
async function detect() {
  if (!net || !video.videoWidth) {
    requestAnimationFrame(detect);
    return;
  }

  if (cameraSelect.value === "all") {
    requestAnimationFrame(detect);
    return; // δεν βάζουμε μασκα όταν δείχνουμε όλες
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
