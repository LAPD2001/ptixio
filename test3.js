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
const cameraContainer = document.getElementById('cameraContainer');
const logDiv = document.getElementById('log');

let net;
let stream; // για single camera / screen
let useScreen = false;
let cameras = [];

// πολλαπλά feeds
let feedVideos = [];
let feedCanvases = [];
let feedStreams = [];

function log(msg) {
  console.log(msg);
  if (logDiv) {
    logDiv.textContent += msg + "\n";
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

window.onload = init;

async function init() {
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

  await listCameras();

  // Προσθήκη επιλογής "All cameras"
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All cameras';
  cameraSelect.insertBefore(allOption, cameraSelect.firstChild);

  if (useScreen) {
    log("📺 Using screen share...");
    try { await startScreen(); } catch (e) { log("❌ Screen share failed: " + e.message); return; }
    cameraSelect.disabled = true;
  } else {
    if (cameras.length === 0) { alert("Δεν βρέθηκαν διαθέσιμες κάμερες."); return; }
    await startCamera(cameras[0].deviceId);
  }

  cameraSelect.onchange = async () => {
    const value = cameraSelect.value;
    if (useScreen) return;
    if (value === 'all') await startAllCameras();
    else await startCamera(value);
  };

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  if (!useScreen && cameraSelect.value !== 'all') detect();
  else if (useScreen) detect();
}

async function listCameras() {
  try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch (e) { log("⚠️ getUserMedia permission: " + e.message); }
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';

  cameras.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  if (cameras.length > 0) {
    log("📷 Found " + cameras.length + " camera(s)");
    cameras.forEach((c, i) => log(`   ${i + 1}. ${c.label || c.deviceId}`));
  } else log("⚠️ No cameras found");
}

async function startCamera(deviceId) {
  stopAllFeeds();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
    video.srcObject = stream;
    await video.play();
    canvasMask.style.display = 'block';
    cameraContainer.innerHTML = '';
    if (net) detect();
    log("🎥 Camera started successfully");
  } catch (err) { log("❌ Error starting camera: " + err.message); }
}

async function startScreen() {
  stopAllFeeds();
  stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  video.srcObject = stream;
  await video.play();
  canvasMask.style.display = 'block';
  cameraContainer.innerHTML = '';
  if (net) detect();
}

async function startAllCameras() {
  stopAllFeeds();
  cameraContainer.innerHTML = '';

  for (let i = 0; i < cameras.length; i++) {
    const device = cameras[i];
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId } }, audio: false });
      const v = document.createElement('video');
      v.autoplay = true; v.playsInline = true; v.muted = true;
      v.srcObject = s; await v.play();

      const wrapper = document.createElement('div');
      wrapper.appendChild(v);

      const c = document.createElement('canvas');
      wrapper.appendChild(c);

      const label = document.createElement('div');
      label.textContent = device.label || `Camera ${i+1}`;
      label.style.fontSize = '12px';
      label.style.marginTop = '4px';
      wrapper.appendChild(label);

      cameraContainer.appendChild(wrapper);

      feedVideos.push(v);
      feedCanvases.push(c);
      feedStreams.push(s);
    } catch (e) { log("⚠️ Couldn't start camera " + device.label + ": " + e.message); }
  }

  canvasMask.style.display = 'none';
  if (net) detectAll();
}

function stopAllFeeds() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (feedStreams.length > 0) { feedStreams.forEach(s => s.getTracks().forEach(t => t.stop())); feedStreams = []; }
  feedVideos.forEach(v => { v.pause(); v.srcObject = null; });
  feedVideos = [];
  feedCanvases = [];
  cameraContainer.innerHTML = '';
}

async function detect() {
  if (!net || !video.videoWidth) { requestAnimationFrame(detect); return; }
  try {
    const segmentation = await net.segmentMultiPerson(video, { internalResolution: 'medium', segmentationThreshold: 0.7 });
    canvasMask.width = video.videoWidth; canvasMask.height = video.videoHeight;
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
    const mask = bodyPix.toMask(segmentation);
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);
    countDiv.textContent = `Number of people: ${segmentation.length}`;
  } catch (err) { log("⚠️ Detect error: " + err.message); }
  requestAnimationFrame(detect);
}

async function detectAll() {
  if (!net || feedVideos.length === 0) return;
  for (let i = 0; i < feedVideos.length; i++) {
    const v = feedVideos[i]; const c = feedCanvases[i];
    if (!v.videoWidth) continue;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    try {
      const segmentation = await net.segmentMultiPerson(v, { internalResolution: 'low', segmentationThreshold: 0.7 });
      const mask = bodyPix.toMask(segmentation);
      bodyPix.drawMask(c, v, mask, 0.6, 3, false);
    } catch (e) { log("⚠️ segmentation error for feed " + i + ": " + e.message); }
  }
  requestAnimationFrame(detectAll);
}
