//psilokomple gia pollew kameres kai screen share apla vgazei to mask me allo
// test-overlay-fixed.js

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
// δεν κρύβουμε πια το single video — θα το εμφανίσουμε στο wrapper
video.style.display = 'block';
video.style.width = '100%';
video.style.height = 'auto';
video.style.zIndex = '1';
document.body.appendChild(video);

const canvasMask = document.getElementById('canvasMask');
const ctxMask = canvasMask.getContext('2d');
const countDiv = document.getElementById('count');
const cameraSelect = document.getElementById('cameraSelect');
const cameraContainer = document.getElementById('cameraContainer');
const logDiv = document.getElementById('log');

let net;
let stream; // single camera / screen
let useScreen = false;
let cameras = [];

// πολλαπλά feeds
let feedVideos = [];
let feedCanvases = [];
let feedStreams = [];
let feedBadges = [];

// wrapper για single feed (θα βάλει video + canvas μαζί)
let singleWrapper = null;

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

  // Προσθήκη "All cameras"
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

function ensureSingleWrapper() {
  if (singleWrapper) return singleWrapper;
  // δημιουργούμε wrapper και τοποθετούμε video + canvasMask μέσα
  singleWrapper = document.createElement('div');
  singleWrapper.id = 'singleWrapper';
  singleWrapper.style.position = 'relative';
  singleWrapper.style.display = 'inline-block';
  singleWrapper.style.width = '640px';
  singleWrapper.style.maxWidth = '100%';
  singleWrapper.style.background = '#000';
  singleWrapper.style.padding = '4px';
  // το video element ήδη υπάρχει — το μεταφέρουμε μέσα
  singleWrapper.appendChild(video);
  // μεταφέρουμε canvasMask μέσα
  singleWrapper.appendChild(canvasMask);

  // style του canvasMask ώστε να κάθεται πάνω στο video
  canvasMask.style.position = 'absolute';
  canvasMask.style.left = '4px';
  canvasMask.style.top = '4px';
  canvasMask.style.pointerEvents = 'none';
  canvasMask.style.zIndex = '2';
  canvasMask.style.background = 'transparent';
  canvasMask.style.width = 'calc(100% - 8px)';
  canvasMask.style.height = 'auto';

  // τοποθετούμε τον wrapper πριν το cameraContainer
  cameraContainer.parentNode.insertBefore(singleWrapper, cameraContainer);
  return singleWrapper;
}

async function startCamera(deviceId) {
  stopAllFeeds();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
    video.srcObject = stream;
    await video.play();

    // βάζουμε video+canvas μέσα σε wrapper και εμφανίζουμε canvasMask ως overlay
    ensureSingleWrapper();

    // set canvas pixel size after loaded metadata
    await new Promise(resolve => {
      if (video.readyState >= 1 && video.videoWidth) resolve();
      else video.onloadedmetadata = () => resolve();
    });

    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;

    canvasMask.style.width = video.clientWidth + 'px';
    canvasMask.style.height = video.clientHeight + 'px';
    canvasMask.style.display = 'block';

    cameraContainer.innerHTML = '';
    if (net) detect();
    log("🎥 Camera started successfully");
  } catch (err) { log("❌ Error starting camera: " + err.message); }
}

async function startScreen() {
  stopAllFeeds();
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    ensureSingleWrapper();

    await new Promise(resolve => {
      if (video.readyState >= 1 && video.videoWidth) resolve();
      else video.onloadedmetadata = () => resolve();
    });

    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;
    canvasMask.style.width = video.clientWidth + 'px';
    canvasMask.style.height = video.clientHeight + 'px';
    canvasMask.style.display = 'block';

    cameraContainer.innerHTML = '';
    if (net) detect();
  } catch (e) {
    throw e;
  }
}

async function startAllCameras() {
  stopAllFeeds();
  cameraContainer.innerHTML = '';
  feedVideos = [];
  feedCanvases = [];
  feedStreams = [];
  feedBadges = [];

  for (let i = 0; i < cameras.length; i++) {
    const device = cameras[i];
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId } }, audio: false });

      const v = document.createElement('video');
      v.autoplay = true; v.playsInline = true; v.muted = true;
      v.srcObject = s;
      v.style.width = '100%';
      v.style.height = 'auto';
      v.style.zIndex = '1';
      v.style.display = 'block';

      // wrapper (relative)
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = '320px';
      wrapper.style.margin = '5px';
      wrapper.style.padding = '6px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.background = '#000';
      wrapper.style.borderRadius = '4px';
      wrapper.style.verticalAlign = 'top';

      wrapper.appendChild(v);

      // canvas overlay που θα κάθεται πάνω στο video
      const c = document.createElement('canvas');
      c.style.position = 'absolute';
      c.style.left = '6px';
      c.style.top = '6px';
      c.style.pointerEvents = 'none';
      c.style.zIndex = '2';
      c.style.width = 'calc(100% - 12px)';
      c.style.height = 'auto';
      c.style.background = 'transparent';
      wrapper.appendChild(c);

      // label + badge
      const labelWrap = document.createElement('div');
      labelWrap.style.marginTop = '6px';
      labelWrap.style.display = 'flex';
      labelWrap.style.justifyContent = 'space-between';
      labelWrap.style.alignItems = 'center';
      labelWrap.style.gap = '8px';

      const label = document.createElement('div');
      label.textContent = device.label || `Camera ${i+1}`;
      label.style.fontSize = '12px';
      label.style.whiteSpace = 'nowrap';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.flex = '1';

      const badge = document.createElement('div');
      badge.textContent = 'People: -';
      badge.style.fontSize = '12px';
      badge.style.background = '#222';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '12px';
      badge.style.flex = 'none';

      labelWrap.appendChild(label);
      labelWrap.appendChild(badge);
      wrapper.appendChild(labelWrap);

      cameraContainer.appendChild(wrapper);

      // περιμένουμε metadata
      await new Promise((resolve) => {
        if (v.readyState >= 1 && v.videoWidth) resolve();
        else v.onloadedmetadata = () => resolve();
      });

      // set canvas pixel size
      c.width = v.videoWidth;
      c.height = v.videoHeight;

      feedVideos.push(v);
      feedCanvases.push(c);
      feedStreams.push(s);
      feedBadges.push(badge);
    } catch (e) {
      log("⚠️ Couldn't start camera " + (device.label || device.deviceId) + ": " + e.message);
    }
  }

  // κρύβουμε το κεντρικό canvasMask όταν βλέπουμε πολλά feeds
  if (canvasMask) canvasMask.style.display = 'none';

  if (net) detectAll();
}

function stopAllFeeds() {
  if (stream) {
    try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    stream = null;
  }
  if (feedStreams && feedStreams.length > 0) {
    feedStreams.forEach(s => {
      try { s.getTracks().forEach(t => t.stop()); } catch (e) {}
    });
  }
  feedStreams = [];
  feedVideos.forEach(v => {
    try { v.pause(); v.srcObject = null; } catch (e) {}
  });
  feedVideos = [];
  feedCanvases = [];
  feedBadges = [];
  cameraContainer.innerHTML = '';

  // αν υπάρχει single wrapper, αφαιρούμε canvas ή το κρύβουμε
  if (singleWrapper && canvasMask) {
    canvasMask.style.display = 'none';
  }
}

async function detect() {
  if (!net || !video.videoWidth) { requestAnimationFrame(detect); return; }
  try {
    const segmentation = await net.segmentMultiPerson(video, { internalResolution: 'medium', segmentationThreshold: 0.7 });
    // Δημιουργούμε μάσκα με ΔΙΑΦΑΝΕΣ background και ημιδιαφανές foreground
    const mask = bodyPix.toMask(segmentation, {r:0,g:255,b:0,a:120}, {r:0,g:0,b:0,a:0});
    // Βεβαιωνόμαστε ότι το canvas έχει pixel διαστάσεις
    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;
    // καθαρίζουμε και γράφουμε μόνο τη μάσκα (χωρίς να ξανα-σχεδιάσουμε το video)
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
    ctxMask.putImageData(mask, 0, 0);
    // ενημέρωση count (σύνολο)
    const total = (segmentation && segmentation.length) ? segmentation.length : 0;
    countDiv.textContent = `Number of people (total): ${total}`;
  } catch (err) { log("⚠️ Detect error: " + err.message); }
  requestAnimationFrame(detect);
}

async function detectAll() {
  if (!net) return;
  if (!feedVideos || feedVideos.length === 0) {
    requestAnimationFrame(detectAll);
    return;
  }

  let total = 0;

  for (let i = 0; i < feedVideos.length; i++) {
    const v = feedVideos[i];
    const c = feedCanvases[i];
    const badge = feedBadges[i];
    if (!v || !v.videoWidth) continue;

    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }

    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    try {
      const segmentation = await net.segmentMultiPerson(v, { internalResolution: 'low', segmentationThreshold: 0.7 });
      const count = (segmentation && segmentation.length) ? segmentation.length : 0;
      total += count;
      if (badge) badge.textContent = `People: ${count}`;

      // μάσκα με διάφανο background + ημιδιαφανές χρώμα foreground
      const mask = bodyPix.toMask(segmentation, {r:255,g:0,b:0,a:120}, {r:0,g:0,b:0,a:0});
      ctx.putImageData(mask, 0, 0);
    } catch (e) {
      log("⚠️ segmentation error for feed " + i + ": " + e.message);
      if (badge) badge.textContent = `People: ?`;
    }
  }

  countDiv.textContent = `Number of people (total): ${total}`;

  requestAnimationFrame(detectAll);
}
