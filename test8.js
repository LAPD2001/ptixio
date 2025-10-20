// Δουλεύει κανονικά για screen share & κάμερα με μάσκα.
// Όταν δείχνει όλες τις κάμερες μαζί, δεν εφαρμόζει μάσκες.
//Δεν δουλευει η πισω καμερα σε κινητα.

const video= document.createElement('video');
 video.autoplay = false;
 video.playsInline = false;
 video.muted = true;
 video.style.display = 'none';
 video.display = 'none';
 let useScreen = false;

//document.body.appendChild(video);

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

// 📜 Logging function
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// 🔹 Έναρξη
window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  if (!useScreen) {
    await listCameras();
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    await showAllCameras(); // προεπιλογή “Show all cameras”
  } else {
    log("📺 Using screen share...");

    // 👉 Παίρνουμε το stream της οθόνης
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: 1280,
        height: 720,
        frameRate: 30
      }
    });

    video.srcObject = stream;
    //video.style.display = "block";
    //video.style.maxWidth = "640px";
    //video.style.border = "1px solid #444";
    //document.body.appendChild(video);

    // 👉 Περιμένουμε να φορτωθεί το video
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        canvasMask.width = video.videoWidth;
        canvasMask.height = video.videoHeight;
        canvasMask.style.display = "block";
        canvasMask.style.maxWidth = "640px";
        resolve();
      };
    });

    log(`🎬 Screen share resolution: ${video.videoWidth}x${video.videoHeight}`);
  }

  cameraSelect.onchange = async () => {
    if (useScreen) return;
    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      await showAllCameras();
    } else {
      await startCamera(deviceId);
    }
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  // 🔹 Μόνο όταν είναι έτοιμο το video ξεκινάει η ανίχνευση
  await new Promise(resolve => {
    if (video.readyState >= 2) resolve();
    else video.onloadeddata = () => resolve();
  });

  detect();
}

// 🔹 Λίστα καμερών
async function listCameras() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📹 Show all cameras';
  cameraSelect.appendChild(allOption);

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  log(cameras.length > 0
    ? `📷 Found ${cameras.length} camera(s)`
    : "⚠️ No cameras found");
}

// 🔹 Μία κάμερα με μάσκα
async function startCamera(deviceId) {
  showingAll = false;
  cameraContainer.innerHTML = '';

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  let constraints;

  // Αν είναι κινητό, χρησιμοποίησε facingMode
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    if (deviceId.toLowerCase().includes("back") || deviceId.toLowerCase().includes("environment")) {
      constraints = { video: { facingMode: { exact: "environment" } } };
    } else {
      constraints = { video: { facingMode: "user" } };
    }
  } else {
    // Αν είναι desktop, χρησιμοποίησε κανονικά το deviceId
    constraints = { video: { deviceId: { exact: deviceId } } };
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();
    canvasMask.style.display = 'block';
    log("🎥 Camera started: " + deviceId);
  } catch (err) {
    log("❌ Error starting camera: " + err.message);
    alert("Δεν ήταν δυνατή η πρόσβαση στην κάμερα: " + err.message);
  }
}


// 🔹 Εμφάνιση όλων των καμερών χωρίς μάσκα
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
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      v.srcObject = s;
    } catch (err) {
      block.textContent = "❌ " + (err.message || err);
    }
  }

  log("📺 Showing all cameras (no detection)");
}

// 🔹 Ανίχνευση BodyPix
async function detect() {
  if (showingAll) {
    requestAnimationFrame(detect);
    return;
  }

  if (!net || !video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const segmentation = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    // ✅ Βεβαιωνόμαστε ότι οι διαστάσεις ταιριάζουν
    if (canvasMask.width !== video.videoWidth || canvasMask.height !== video.videoHeight) {
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
    }

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
