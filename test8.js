// test7_robust_cycle.js
// Πιο επιθετική/αναλυτική προσπάθεια για να ανοίξει πίσω κάμερα σε κινητό.
// HTML: needs elements with ids: cameraSelect, log, cameraContainer, canvasMask, count
// Run on HTTPS for mobile browsers.

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = 'none';
document.body.appendChild(video);

const cameraSelect = document.getElementById('cameraSelect');
const logDiv = document.getElementById('log');
const cameraContainer = document.getElementById('cameraContainer');
const canvasMask = document.getElementById('canvasMask');
const countDiv = document.getElementById('count');

let net = null;
let currentStream = null;
let cameras = [];

function log(msg, level = 'info') {
  const el = document.createElement('div');
  el.textContent = msg;
  if (level === 'error') el.style.color = '#f66';
  else if (level === 'warn') el.style.color = '#f90';
  else el.style.color = '#0f0';
  logDiv.appendChild(el);
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(msg);
}

function stopStream(s) {
  if (!s) return;
  try {
    s.getTracks().forEach(t => t.stop());
  } catch (e) { /* ignore */ }
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// try a list of constraints and return stream or throw
async function tryConstraintsList(constraintsList) {
  let lastError = null;
  for (const c of constraintsList) {
    try {
      log(`Attempting getUserMedia with: ${JSON.stringify(c.video)}`);
      const s = await navigator.mediaDevices.getUserMedia(c);
      log('✅ getUserMedia succeeded with above constraints');
      return s;
    } catch (err) {
      lastError = err;
      log(`✖ failed: ${err.name} — ${err.message}`, 'warn');
      // If user denied permanently, rethrow to stop attempts
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        throw err;
      }
      // small delay then continue trying other constraints
      await sleep(200);
    }
  }
  throw lastError || new Error('All getUserMedia attempts failed');
}

async function refreshDeviceList() {
  try {
    // try to get permission to reveal labels
    try { await navigator.mediaDevices.getUserMedia({video:true}); } catch(e){ /* ignore */ }
    const list = await navigator.mediaDevices.enumerateDevices();
    cameras = list.filter(d => d.kind === 'videoinput');
    cameraSelect.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All cameras';
    cameraSelect.appendChild(allOpt);
    cameras.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || `Camera ${i+1}`;
      cameraSelect.appendChild(opt);
    });
    log(`Found ${cameras.length} camera(s)`);
  } catch (err) {
    log('Error enumerating devices: ' + (err.message||err), 'error');
  }
}

async function openSingleCameraWithFallback(deviceId = null) {
  // stop prior
  stopStream(currentStream);
  currentStream = null;
  cameraContainer.innerHTML = '';
  canvasMask.style.display = 'none';

  // build prioritized constraints list
  const list = [];

  if (deviceId) {
    // desktop-friendly attempt
    list.push({video: { deviceId: { exact: deviceId } }, audio:false});
  }

  // try exact facing if mobile
  list.push({video: { facingMode: { exact: 'environment' } }, audio:false});
  // relaxed facing
  list.push({video: { facingMode: 'environment' }, audio:false});
  // generic
  list.push({video: true, audio:false});
  // small resolution hint
  list.push({video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio:false});

  try {
    const s = await tryConstraintsList(list);
    currentStream = s;
    video.srcObject = s;
    // keep video hidden (canvas will display)
    video.style.display = 'none';
    await video.play().catch(()=>{});
    // wait until video has size
    await new Promise(resolve => {
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) resolve();
      else {
        const onLoaded = () => { video.removeEventListener('loadeddata', onLoaded); resolve(); };
        video.addEventListener('loadeddata', onLoaded);
        // safety timeout
        setTimeout(resolve, 1200);
      }
    });

    canvasMask.width = video.videoWidth || 640;
    canvasMask.height = video.videoHeight || 360;
    canvasMask.style.display = 'block';
    log(`Started camera (stream size: ${canvasMask.width}x${canvasMask.height})`);
    return true;
  } catch (err) {
    log('Final open camera error: ' + (err.name||'') + ' ' + (err.message||''), 'error');
    return false;
  }
}

async function showAllCamerasSimple() {
  // stop single stream
  stopStream(currentStream);
  currentStream = null;
  canvasMask.style.display = 'none';
  cameraContainer.innerHTML = '<h3>All cameras (no detection)</h3>';
  for (const cam of cameras) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '320px';
    wrapper.style.margin = '6px';
    const lab = document.createElement('div'); lab.textContent = cam.label || 'Unnamed';
    wrapper.appendChild(lab);
    const v = document.createElement('video');
    v.autoplay = true; v.muted = true; v.playsInline = true;
    v.style.width = '100%';
    wrapper.appendChild(v);
    cameraContainer.appendChild(wrapper);
    try {
      const s = await tryConstraintsList([{video:{deviceId:{exact:cam.deviceId}}, audio:false}, {video:true, audio:false}]);
      v.srcObject = s;
    } catch (err) {
      lab.textContent = `❌ ${err.name||''} ${err.message||''}`;
    }
  }
}

// cycle through devices attempting to open each and report results
async function cycleCamerasTest() {
  log('--- Cycle cameras test starting ---');
  for (const cam of cameras) {
    log(`Testing device: ${cam.label || cam.deviceId}`);
    const ok = await openSingleCameraWithFallback(cam.deviceId);
    log(`Result for ${cam.label || cam.deviceId}: ${ok ? 'OK' : 'FAILED'}`);
    // display result snapshot
    await sleep(700);
    stopStream(currentStream);
    currentStream = null;
    await sleep(300);
  }
  log('--- Cycle cameras test finished ---');
}

// detection loop (BodyPix) — simple
async function detectLoop() {
  if (!net) { requestAnimationFrame(detectLoop); return; }
  if (!currentStream || !video.videoWidth || !video.videoHeight) { requestAnimationFrame(detectLoop); return; }

  try {
    // keep canvas size in sync
    if (canvasMask.width !== video.videoWidth || canvasMask.height !== video.videoHeight) {
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
    }

    const segmentation = await net.segmentMultiPerson(video, { internalResolution: 'medium', segmentationThreshold: 0.7 });
    const mask = bodyPix.toMask(segmentation);
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);
    const count = Array.isArray(segmentation) ? segmentation.length : 0;
    countDiv.textContent = `Number of people: ${count}`;
  } catch (err) {
    log('Detect error: ' + (err.message||err), 'warn');
  }

  requestAnimationFrame(detectLoop);
}

// wire UI & init
(async function init() {
  await refreshDeviceList();
  // add cycle button to help debugging
  const btn = document.createElement('button');
  btn.textContent = 'Cycle Cameras (debug)';
  btn.onclick = cycleCamerasTest;
  document.body.insertBefore(btn, cameraContainer);

  // add open-environment quick button
  const envBtn = document.createElement('button');
  envBtn.textContent = 'Try environment facing';
  envBtn.onclick = async () => { await openSingleCameraWithFallback(null); };
  document.body.insertBefore(envBtn, cameraContainer);

  cameraSelect.onchange = async () => {
    const val = cameraSelect.value;
    if (val === 'all') {
      await showAllCamerasSimple();
    } else {
      await openSingleCameraWithFallback(val);
    }
  };

  // load BodyPix
  try {
    net = await bodyPix.load();
    log('BodyPix loaded');
  } catch (err) {
    log('BodyPix load error: ' + (err.message||err), 'error');
  }

  // default: select 'all'
  cameraSelect.value = 'all';
  await showAllCamerasSimple();
  detectLoop();
})();
