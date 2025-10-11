const videoContainer = document.getElementById('videoContainer'); // Νέο div για όλα τα βίντεο
const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');

let net;
let streams = []; // Θα κρατάει όλα τα streams
let useScreen = false;
let cameras = [];

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
    await startCamera(cameras[0].deviceId);
  } else {
    log("📺 Using screen share...");
    streams = [await navigator.mediaDevices.getDisplayMedia({ video: true })];
    createVideoElements(streams);
  }

  cameraSelect.onchange = async () => {
    const value = cameraSelect.value;
    if (value === "all") {
      log("🔄 Showing all cameras");
      await startAllCameras();
    } else {
      log("🔄 Switching to camera: " + value);
      await startCamera(value);
    }
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  detectAll();
}

// Λίστα καμερών
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

// Ξεκινάμε μία κάμερα
async function startCamera(deviceId) {
  try {
    // Καθαρίζουμε προηγούμενα streams
    streams.forEach(s => s.getTracks().forEach(track => track.stop()));
    streams = [];

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    streams.push(stream);
    createVideoElements(streams);
    log("🎥 Camera started successfully");
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
  }
}

// Ξεκινάμε όλες τις κάμερες
async function startAllCameras() {
  // Καθαρίζουμε προηγούμενα streams
  streams.forEach(s => s.getTracks().forEach(track => track.stop()));
  streams = [];

  for (const cam of cameras) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: cam.deviceId } },
      audio: false
    });
    streams.push(stream);
  }
  createVideoElements(streams);
}

// Δημιουργία video elements για κάθε stream
function createVideoElements(streams) {
  videoContainer.innerHTML = '';
  streams.forEach((s, i) => {
    let video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = s;
    video.style.width = "300px";
    video.style.height = "auto";
    videoContainer.appendChild(video);
    s.videoEl = video; // κρατάμε reference στο video element
  });
}

// BodyPix detect για όλα τα video
async function detectAll() {
  if (!net || streams.length === 0 || !streams[0].videoEl.videoWidth) {
    requestAnimationFrame(detectAll);
    return;
  }

  try {
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
    canvasMask.width = videoContainer.offsetWidth;
    canvasMask.height = videoContainer.offsetHeight;

    let totalCount = 0;
    streams.forEach(async (s, index) => {
      const video = s.videoEl;
      if (!video.videoWidth) return;

      const segmentation = await net.segmentMultiPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });
      totalCount += segmentation.length;

      const mask = bodyPix.toMask(segmentation);
      // Κάνουμε resize του mask στο μέγεθος του video
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      bodyPix.drawMask(tempCanvas, video, mask, 0.6, 3, false);

      // Ζωγραφίζουμε πάνω στο κύριο canvas στο σωστό σημείο
      const x = video.offsetLeft;
      const y = video.offsetTop;
      ctxMask.drawImage(tempCanvas, x, y, video.offsetWidth, video.offsetHeight);
    });

    countDiv.textContent = `Number of people: ${totalCount}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detectAll);
}
