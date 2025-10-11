const videoContainer = document.getElementById('videoContainer'); // div που θα κρατάει όλα τα video
const canvasMaskContainer = document.getElementById('canvasMaskContainer'); // div για μάσκες

let videos = []; // πίνακας με όλα τα video elements
let canvases = []; // πίνακας με όλα τα canvas για μάσκα

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  if (!useScreen) {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    createVideoForCamera(cameras[0].deviceId); // εμφανίζουμε την πρώτη κάμερα κανονικά
  } else {
    log("📺 Using screen share...");
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.display = 'block';
    videoContainer.appendChild(video);

    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvasMaskContainer.appendChild(canvas);
    videos.push(video);
    canvases.push(canvas);
  }

  cameraSelect.onchange = async () => {
    const value = cameraSelect.value;
    if (value === "all") {
      await startAllCameras();
    } else {
      await startSingleCamera(value);
    }
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  detect();
}

// δημιουργία option "all cameras"
async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

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

  log(`📷 Found ${cameras.length} camera(s)`);
}

// εκκίνηση μιας μόνο κάμερας
async function startSingleCamera(deviceId) {
  // σταμάτα όλα τα video προηγούμενα
  videos.forEach(v => v.srcObject && v.srcObject.getTracks().forEach(t => t.stop()));
  videoContainer.innerHTML = '';
  canvasMaskContainer.innerHTML = '';
  videos = [];
  canvases = [];

  await createVideoForCamera(deviceId);
}

// εκκίνηση όλων των καμερών μαζί
async function startAllCameras() {
  // σταμάτα προηγούμενα
  videos.forEach(v => v.srcObject && v.srcObject.getTracks().forEach(t => t.stop()));
  videoContainer.innerHTML = '';
  canvasMaskContainer.innerHTML = '';
  videos = [];
  canvases = [];

  for (let cam of cameras) {
    await createVideoForCamera(cam.deviceId);
  }
}

// helper για δημιουργία video + canvas μάσκας για κάθε κάμερα
async function createVideoForCamera(deviceId) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.display = 'block';
  videoContainer.appendChild(video);

  const canvas = document.createElement('canvas');
  canvasMaskContainer.appendChild(canvas);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  videos.push(video);
  canvases.push(canvas);
}

// detect με BodyPix για όλες τις κάμερες
async function detect() {
  if (!net) {
    requestAnimationFrame(detect);
    return;
  }

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const canvas = canvases[i];
    const ctx = canvas.getContext('2d');

    if (!video.videoWidth) continue;

    try {
      const segmentation = await net.segmentMultiPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mask = bodyPix.toMask(segmentation);
      bodyPix.drawMask(canvas, video, mask, 0.6, 3, false);
    } catch (err) {
      log("⚠️ Detect error: " + err.message);
    }
  }

  requestAnimationFrame(detect);
}
