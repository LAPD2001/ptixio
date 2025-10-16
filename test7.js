let bodyPixNet;
let currentStream = null;
let cameras = [];
let detectionActive = false;

const select = document.getElementById("cameraSelect");
const logDiv = document.getElementById("log");
const cameraContainer = document.getElementById("cameraContainer");
const canvasMask = document.getElementById("canvasMask");
const ctx = canvasMask.getContext("2d");

function log(msg, color = "#0f0") {
  const line = document.createElement("div");
  line.style.color = color;
  line.textContent = msg;
  logDiv.appendChild(line);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// 🔹 Φόρτωση BodyPix
async function loadBodyPix() {
  log("Loading BodyPix...");
  bodyPixNet = await bodyPix.load();
  log("✅ BodyPix loaded.");
}

// 🔹 Λήψη όλων των καμερών
async function getCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === "videoinput");

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All cameras";
  select.appendChild(allOption);

  cameras.forEach((cam, i) => {
    const opt = document.createElement("option");
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${i + 1}`;
    select.appendChild(opt);
  });

  select.value = "all";
  showAllCameras();
}

// 🔹 Δείξε όλες τις κάμερες (χωρίς ανίχνευση)
async function showAllCameras() {
  detectionActive = false;
  cameraContainer.innerHTML = "";
  canvasMask.style.display = "none";

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

      const wrapper = document.createElement("div");
      wrapper.appendChild(v);
      cameraContainer.appendChild(wrapper);
    } catch (err) {
      log(`⚠️ Could not open camera: ${err.message}`, "orange");
    }
  }
}

// 🔹 Δείξε μία κάμερα με ανίχνευση
async function showSingleCamera(deviceId) {
  detectionActive = true;
  cameraContainer.innerHTML = "";
  canvasMask.style.display = "block";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  try {
    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "environment" },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    cameraContainer.appendChild(video);

    video.addEventListener("loadeddata", () => detectLoop(video));
  } catch (err) {
    log(`❌ Camera error: ${err.message}`, "red");
  }
}

// 🔹 Loop ανίχνευσης
async function detectLoop(video) {
  if (!detectionActive || !bodyPixNet) return;
  canvasMask.width = video.videoWidth;
  canvasMask.height = video.videoHeight;

  const segmentation = await bodyPixNet.segmentPerson(video);
  const mask = bodyPix.toMask(segmentation);

  ctx.putImageData(mask, 0, 0);
  requestAnimationFrame(() => detectLoop(video));
}

// 🔹 Όταν αλλάζει επιλογή στο select
select.addEventListener("change", () => {
  const id = select.value;
  if (id === "all") showAllCameras();
  else showSingleCamera(id);
});

// 🔹 Εκκίνηση
(async () => {
  await loadBodyPix();
  await getCameras();
})();
