let currentStream = null;
let video = document.createElement("video");
let canvas = document.createElement("canvas");
let ctx = canvas.getContext("2d");
let bodyPixNet = null;
let cameras = [];
let detectionActive = false;

const select = document.getElementById("cameraSelect");
const logBox = document.getElementById("log");
const videoContainer = document.getElementById("videoContainer");

function log(msg, color = "white") {
  const line = document.createElement("div");
  line.style.color = color;
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

// 🔹 Εμφανίζει μήνυμα στην αρχή
log("🔍 Initializing camera system...");

// 🔹 Φόρτωση BodyPix
async function loadBodyPix() {
  log("Loading BodyPix model...");
  bodyPixNet = await bodyPix.load();
  log("✅ BodyPix model loaded", "lightgreen");
}

// 🔹 Λήψη λίστας καμερών
async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices.filter((d) => d.kind === "videoinput");
    log(`📸 Found ${cameras.length} camera(s)`, "lightgreen");

    select.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Show all cameras";
    select.appendChild(allOption);

    cameras.forEach((cam) => {
      const opt = document.createElement("option");
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Camera ${select.length}`;
      select.appendChild(opt);
    });

    select.value = "all";
    showAllCameras();
  } catch (err) {
    log(`❌ Error getting cameras: ${err.message}`, "red");
  }
}

// 🔹 Εμφάνιση όλων των καμερών χωρίς αναγνώριση
async function showAllCameras() {
  detectionActive = false;
  videoContainer.innerHTML = "";
  log("🟢 Showing all cameras (no detection)", "lightgreen");

  for (const cam of cameras) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
      });

      const v = document.createElement("video");
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.width = 320;
      v.height = 240;
      v.srcObject = stream;

      const box = document.createElement("div");
      box.style.display = "inline-block";
      box.style.margin = "10px";
      box.style.border = "1px solid #888";
      box.style.textAlign = "center";
      const label = document.createElement("div");
      label.textContent = cam.label || "Unnamed Camera";
      label.style.fontWeight = "bold";
      box.appendChild(label);
      box.appendChild(v);
      videoContainer.appendChild(box);
    } catch (err) {
      log(`⚠️ Could not open ${cam.label}: ${err.message}`, "orange");
    }
  }
}

// 🔹 Εμφάνιση μίας κάμερας με αναγνώριση
async function showSingleCamera(deviceId) {
  detectionActive = true;
  videoContainer.innerHTML = "";
  log("🎯 Showing single camera with detection", "lightgreen");

  // Αν υπάρχει προηγούμενο stream, σταματάμε
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }

  try {
    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { exact: "environment" } },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;

    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.width = 640;
    video.height = 480;
    videoContainer.appendChild(video);
    videoContainer.appendChild(canvas);

    detectLoop();
  } catch (err) {
    log(`❌ Camera error: ${err.name} - ${err.message}`, "red");
  }
}

// 🔹 Επανάληψη detection
async function detectLoop() {
  if (!detectionActive) return;

  if (video.readyState === 4 && bodyPixNet) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const segmentation = await bodyPixNet.segmentPerson(video);
    const colored = bodyPix.toMask(segmentation);

    ctx.putImageData(colored, 0, 0);
  }
  requestAnimationFrame(detectLoop);
}

// 🔹 Αν αλλάξει η επιλογή κάμερας
select.addEventListener("change", async () => {
  const selected = select.value;
  if (selected === "all") {
    showAllCameras();
  } else {
    showSingleCamera(selected);
  }
});

// 🔹 Εκκίνηση
(async function init() {
  await loadBodyPix();
  await getCameras();
})();
