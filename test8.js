// test7.js — robust camera start (tries fallbacks) + BodyPix integration
// Προϋποθέσεις: στο HTML υπάρχουν elements με ids: cameraSelect, log, cameraContainer, canvasMask, count

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

let net = null;
let currentStream = null;
let cameras = [];
let showingAll = false;

function log(msg, level = 'info') {
  const p = document.createElement('div');
  p.textContent = msg;
  if (level === 'error') p.style.color = '#f66';
  else if (level === 'warn') p.style.color = '#f90';
  else p.style.color = '#0f0';
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Βοηθητική: σταμάτησε stream
function stopStream(s) {
  if (!s) return;
  try {
    s.getTracks().forEach(t => t.stop());
  } catch (e) { /* ignore */ }
}

// Ανιχνεύει αν είναι κινητό
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Προσπάθειες για να ανοίξουμε stream με fallback
async function tryGetStream({ deviceId = null, facing = null } = {}) {
  // sequence of constraints to try (ordered)
  const attempts = [];

  // 1) If deviceId provided, try exact deviceId
  if (deviceId) {
    attempts.push({ video: { deviceId: { exact: deviceId } }, audio: false });
  }

  // 2) If facing provided, try exact facingMode
  if (facing) {
    attempts.push({ video: { facingMode: { exact: facing } }, audio: false });
  }

  // 3) Try facingMode without exact (more relaxed)
  if (facing) {
    attempts.push({ video: { facingMode: facing }, audio: false });
  }

  // 4) Try a generic video constraint (let browser choose)
  attempts.push({ video: true, audio: false });

  // 5) Try small resolution hint (to support restrictive devices)
  attempts.push({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: false });

  let lastError = null;
  for (const c of attempts) {
    try {
      log(`Attempting getUserMedia with: ${JSON.stringify(c.video)}`);
      const s = await navigator.mediaDevices.getUserMedia(c);
      log('✅ getUserMedia succeeded with above constraints');
      return s;
    } catch (err) {
      lastError = err;
      log(`✖ getUserMedia failed: ${err.name} - ${err.message}`, 'warn');
      // If OverconstrainedError or NotAllowedError or NotFoundError, continue to next attempt
      // but if NotAllowedError, user denied permissions — stop trying further
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        throw err; // user denied — surface it
      }
    }
  }

  throw lastError || new Error('getUserMedia failed (no attempts left)');
}

// Λίστα καμερών
async function listCameras() {
  try {
    // Ensure permission to get labels on devices
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch(e) { /* ignore */ }

    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices.filter(d => d.kind === 'videoinput');
    cameraSelect.innerHTML = '';

    // προσθέτω "all" ως πρώτη επιλογή
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = '📷 All cameras';
    cameraSelect.appendChild(allOpt);

    cameras.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || `Camera ${i+1}`;
      cameraSelect.appendChild(opt);
    });

    log(`Found ${cameras.length} camera(s)`);
  } catch (err) {
    log('Error listing cameras: ' + (err.message || err), 'error');
  }
}

// show all cameras (no detection)
async function showAllCameras() {
  showingAll = true;
  // stop single stream
  stopStream(currentStream);
  currentStream = null;

  // hide mask canvas
  canvasMask.style.display = 'none';
  ctxMask.clearRect(0,0,canvasMask.width, canvasMask.height);

  cameraContainer.innerHTML = '<h3>All cameras view (no detection)</h3>';
  // open each camera (may fail for some)
  for (const cam of cameras) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '6px';
    wrapper.style.width = '320px';
    wrapper.style.textAlign = 'center';
    const label = document.createElement('div');
    label.textContent = cam.label || 'Unnamed';
    wrapper.appendChild(label);

    const v = document.createElement('video');
    v.autoplay = true; v.muted = true; v.playsInline = true;
    v.style.width = '100%';
    wrapper.appendChild(v);
    cameraContainer.appendChild(wrapper);

    try {
      const s = await tryGetStream({ deviceId: cam.deviceId });
      v.srcObject = s;
    } catch (err) {
      label.textContent = `❌ ${err.name || ''} ${err.message || ''}`;
    }
  }
}

// start single camera (with mask/detection)
// deviceId may be null (in which case we try facingMode environment)
async function startCamera(deviceId) {
  showingAll = false;
  cameraContainer.innerHTML = '';
  // stop previous
  stopStream(currentStream);
  currentStream = null;

  // choose facing if mobile and deviceId seems to indicate back
  let facingHint = null;
  if (isMobile()) {
    // try guess facing from label if available
    const camObj = cameras.find(c => c.deviceId === deviceId);
    const label = camObj ? (camObj.label || '').toLowerCase() : '';
    if (label.includes('back') || label.includes('rear') || label.includes('environment')) facingHint = 'environment';
    else if (label.includes('front') || label.includes('user') || label.includes('selfie')) facingHint = 'user';
  }

  try {
    // Try best: if desktop prefer deviceId, if mobile prefer facing
    let stream;
    if (!isMobile() && deviceId) {
      // desktop: try deviceId first, fallback inside tryGetStream
      stream = await tryGetStream({ deviceId });
    } else {
      // mobile or no deviceId: try facing then deviceId fallback
      if (facingHint) {
        try {
          stream = await tryGetStream({ facing: facingHint });
        } catch (e) {
          // fallback: try deviceId if provided
          if (deviceId) stream = await tryGetStream({ deviceId });
          else stream = await tryGetStream({});
        }
      } else {
        // unknown: try facing environment first (common need)
        try {
          stream = await tryGetStream({ facing: 'environment' });
        } catch (e) {
          if (deviceId) stream = await tryGetStream({ deviceId });
          else stream = await tryGetStream({});
        }
      }
    }

    // attach
    currentStream = stream;
    video.srcObject = stream;
    // ensure hidden or not shown (canvas is visible)
    video.style.display = 'none';
    await video.play();

    // set canvas size to video size (wait small time if not ready)
    await new Promise(resolve => {
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) resolve();
      else {
        const onLoaded = () => { video.removeEventListener('loadeddata', onLoaded); resolve(); };
        video.addEventListener('loadeddata', onLoaded);
        // safety timeout
        setTimeout(resolve, 1000);
      }
    });

    canvasMask.width = video.videoWidth;
    canvasMask.height = video.videoHeight;
    canvasMask.style.display = 'block';
    log('Camera started and ready: ' + (deviceId || 'facing/auto'));
  } catch (err) {
    log('❌ could not start camera: ' + (err.name || '') + ' ' + (err.message || ''), 'error');
  }
}

// detection loop (BodyPix)
async function detectLoop() {
  if (!net) {
    requestAnimationFrame(detectLoop);
    return;
  }
  if (showingAll) {
    requestAnimationFrame(detectLoop);
    return;
  }
  if (!video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(detectLoop);
    return;
  }

  try {
    // ensure canvas matches video
    if (canvasMask.width !== video.videoWidth || canvasMask.height !== video.videoHeight) {
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
    }

    const segmentation = await net.segmentMultiPerson(video, { internalResolution: 'medium', segmentationThreshold: 0.7, maxDetections: 6 });
    const mask = bodyPix.toMask(segmentation);
    // draw mask over canvas; drawMask handles resizing, but we keep sizes aligned
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);

    const count = Array.isArray(segmentation) ? segmentation.length : 0;
    countDiv.textContent = `Number of people: ${count}`;
  } catch (err) {
    log('Detect error: ' + (err.message || err), 'warn');
  }

  requestAnimationFrame(detectLoop);
}

// init overall
async function initApp() {
  try {
    await listCameras();
    cameraSelect.onchange = async () => {
      const val = cameraSelect.value;
      if (val === 'all') {
        await showAllCameras();
      } else {
        await startCamera(val);
      }
    };

    // load BodyPix (do it once)
    net = await bodyPix.load();
    log('BodyPix loaded');

    // default: "all" selected => showAllCameras
    if (cameraSelect.options.length > 0) {
      cameraSelect.value = 'all';
      await showAllCameras();
    }

    // start detection loop
    detectLoop();
  } catch (err) {
    log('Init error: ' + (err.message || err), 'error');
  }
}

// run
initApp();
