//exei thema sto all cameras. Den emfanizei thn eikona ths kameras + to number of people (total) tremopaizei otan einai >0
// test-fixed.js

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
let feedBadges = []; // για count ανά feed

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

  // Προσθήκη επιλογής "All cameras" στην κορυφή
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
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
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
      // Προσπαθούμε να ανοίξουμε stream για κάθε camera
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false
      });

      // video element (θα είναι INVISIBLE αλλά κρατάει το μέγεθος)
      const v = document.createElement('video');
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.srcObject = s;
      v.style.width = '100%';
      v.style.height = 'auto';
      // Κάνουμε το raw video αόρατο αλλά κρατάει χώρο (opacity=0)
      v.style.opacity = '0';
      v.style.display = 'block';

      // wrapper
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = '320px';
      wrapper.style.margin = '5px';
      wrapper.style.padding = '6px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.background = '#0b0b0b';
      wrapper.style.color = '#fff';
      wrapper.style.borderRadius = '4px';
      wrapper.style.verticalAlign = 'top';

      wrapper.appendChild(v);

      // canvas που θα δείχνει το masked αποτέλεσμα (πάνω από το video)
      const c = document.createElement('canvas');
      c.style.position = 'absolute';
      c.style.left = '6px';  // αντιστοιχεί στο padding του wrapper
      c.style.top = '6px';
      c.style.pointerEvents = 'none';
      c.style.zIndex = '2';
      c.style.width = 'calc(100% - 12px)'; // λαμβάνει υπόψη padding
      c.style.height = 'auto';

      wrapper.appendChild(c);

      // label και badge για count
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

      // περιμένουμε metadata ώστε να πάρουμε videoWidth/videoHeight
      await new Promise((resolve) => {
        if (v.readyState >= 1 && v.videoWidth) resolve();
        else v.onloadedmetadata = () => resolve();
      });

      // ορισμός κανονικού μεγέθους canvas σε εικονοστοιχεία
      // χρησιμοποιούμε τις πραγματικές διαστάσεις του video
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      // το css ύψος θα κλιμακωθεί αυτόματα επειδή βάλαμε width calc και height auto

      feedVideos.push(v);
      feedCanvases.push(c);
      feedStreams.push(s);
      feedBadges.push(badge);
    } catch (e) {
      log("⚠️ Couldn't start camera " + (device.label || device.deviceId) + ": " + e.message);
    }
  }

  // κρύβουμε το κεντρικό canvas (το χρησιμοποιούμε μόνο για single feed)
  canvasMask.style.display = 'none';

  if (net) detectAll();
}

function stopAllFeeds() {
  // stop single stream
  if (stream) {
    try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    stream = null;
  }
  // stop per-feed streams
  if (feedStreams && feedStreams.length > 0) {
    feedStreams.forEach(s => {
      try { s.getTracks().forEach(t => t.stop()); } catch (e) {}
    });
  }
  feedStreams = [];
  // remove video srcObject
  feedVideos.forEach(v => {
    try { v.pause(); v.srcObject = null; } catch (e) {}
  });
  feedVideos = [];
  feedCanvases = [];
  feedBadges = [];
  cameraContainer.innerHTML = '';
}

async function detect() {
  if (!net || !video.videoWidth) { requestAnimationFrame(detect); return; }
  try {
    const segmentation = await net.segmentMultiPerson(video, { internalResolution: 'medium', segmentationThreshold: 0.7 });
    canvasMask.width = video.videoWidth; canvasMask.height = video.videoHeight;
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
    const mask = bodyPix.toMask(segmentation || []);
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);
    countDiv.textContent = `Number of people (total): ${ (segmentation && segmentation.length) ? segmentation.length : 0 }`;
  } catch (err) { log("⚠️ Detect error: " + err.message); }
  requestAnimationFrame(detect);
}

async function detectAll() {
  if (!net) return;
  if (!feedVideos || feedVideos.length === 0) {
    // αν δεν υπάρχουν feeds, περιμένουμε
    requestAnimationFrame(detectAll);
    return;
  }

  let total = 0;

  for (let i = 0; i < feedVideos.length; i++) {
    const v = feedVideos[i];
    const c = feedCanvases[i];
    const badge = feedBadges[i];
    if (!v || !v.videoWidth) continue;

    // βεβαιώνουμε ότι το canvas έχει τις σωστές pixel διαστάσεις
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
      // Ενημέρωση badge (άτομα σε αυτή την κάμερα)
      if (badge) badge.textContent = `People: ${count}`;

      const mask = bodyPix.toMask(segmentation || []);
      // Σχεδιάζουμε τη μάσκα στο canvas (source = video)
      // Αντί να σχεδιάζουμε ταυτόχρονα το raw video, αφήνουμε ΜΟΝΟ το drawMask να ζωγραφίσει
      bodyPix.drawMask(c, v, mask, 0.6, 3, false);
    } catch (e) {
      log("⚠️ segmentation error for feed " + i + ": " + e.message);
      if (badge) badge.textContent = `People: ?`;
    }
  }

  countDiv.textContent = `Number of people (total): ${total}`;

  requestAnimationFrame(detectAll);
}
