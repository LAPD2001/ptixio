// --- Global additions near the top of το script ---
let feedBuffers = [];   // offscreen buffers για κάθε feed
let singleBuffer = null; // buffer για single video
let lastSegTime = 0;
const SEG_INTERVAL = 120; // ms (δοκίμασε 120-250 για σταθερότητα)

// --- startCamera (αντικατάσταση / ενημέρωση) ---
async function startCamera(deviceId) {
  stopAllFeeds();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
    video.srcObject = stream;
    await video.play();

    ensureSingleWrapper(); // όπως πριν: βάζει video+canvasMask σε wrapper

    // περιμένουμε metadata και ορίζουμε canvas μια φορά
    await new Promise(resolve => {
      if (video.readyState >= 1 && video.videoWidth) resolve();
      else video.onloadedmetadata = () => resolve();
    });

    // pixel sizes (μόνο μία φορά)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvasMask.width = vw;
    canvasMask.height = vh;
    canvasMask.style.width = video.clientWidth + 'px';
    canvasMask.style.height = video.clientHeight + 'px';
    canvasMask.style.position = 'absolute';
    canvasMask.style.left = '4px';
    canvasMask.style.top = '4px';
    canvasMask.style.pointerEvents = 'none';

    // δημιουργία singleBuffer (offscreen) αν δεν υπάρχει ή αν μέγεθος άλλαξε
    if (!singleBuffer) singleBuffer = document.createElement('canvas');
    if (singleBuffer.width !== vw || singleBuffer.height !== vh) {
      singleBuffer.width = vw;
      singleBuffer.height = vh;
    }

    cameraContainer.innerHTML = '';
    if (net) detect();
    log("🎥 Camera started successfully");
  } catch (err) { log("❌ Error starting camera: " + err.message); }
}

// --- startAllCameras (αντικατάσταση / ενημέρωση) ---
async function startAllCameras() {
  stopAllFeeds();
  cameraContainer.innerHTML = '';
  feedVideos = [];
  feedCanvases = [];
  feedStreams = [];
  feedBadges = [];
  feedBuffers = [];

  for (let i = 0; i < cameras.length; i++) {
    const device = cameras[i];
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false
      });

      const v = document.createElement('video');
      v.autoplay = true; v.playsInline = true; v.muted = true;
      v.srcObject = s;
      v.style.width = '100%';
      v.style.height = 'auto';
      v.style.zIndex = '1';
      v.style.display = 'block';

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

      // περιμένουμε metadata ώστε να πάρουμε video pixel size
      await new Promise((resolve) => {
        if (v.readyState >= 1 && v.videoWidth) resolve();
        else v.onloadedmetadata = () => resolve();
      });

      // ΟΡΙΖΟΥΜΕ pixel μεγέθη ΜΙΑ φορά
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      // CSS μέγεθος (client) μπορεί να παραμείνει όπως είναι
      c.style.width = v.clientWidth + 'px';
      c.style.height = v.clientHeight + 'px';

      // Δημιουργία offscreen buffer για αυτό το feed
      const buffer = document.createElement('canvas');
      buffer.width = v.videoWidth;
      buffer.height = v.videoHeight;
      feedBuffers.push(buffer);

      feedVideos.push(v);
      feedCanvases.push(c);
      feedStreams.push(s);
      feedBadges.push(badge);
    } catch (e) {
      log("⚠️ Couldn't start camera " + (device.label || device.deviceId) + ": " + e.message);
    }
  }

  if (canvasMask) canvasMask.style.display = 'none';

  if (net) detectAll();
}

// --- stopAllFeeds (ελαφρώς ενημερωμένο για buffers) ---
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
  feedBuffers = [];
  cameraContainer.innerHTML = '';

  // κρύβουμε single buffer / canvas
  if (singleBuffer) { /* keep or null out if you want */ }
  if (singleWrapper && canvasMask) canvasMask.style.display = 'none';
}

// --- detect (single) using buffer + drawImage ---
async function detect() {
  if (!net || !video.videoWidth) { requestAnimationFrame(detect); return; }
  const now = performance.now();
  if (now - lastSegTime < SEG_INTERVAL) { requestAnimationFrame(detect); return; }
  lastSegTime = now;

  try {
    const segmentation = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    // δημιουργούμε mask ImageData
    const mask = bodyPix.toMask(segmentation, {r:0,g:255,b:0,a:120}, {r:0,g:0,b:0,a:0});

    // βάζουμε στο singleBuffer και μετά σχεδιάζουμε στο ορατό canvas με drawImage
    if (!singleBuffer) singleBuffer = document.createElement('canvas');
    if (singleBuffer.width !== canvasMask.width || singleBuffer.height !== canvasMask.height) {
      singleBuffer.width = canvasMask.width;
      singleBuffer.height = canvasMask.height;
    }
    const bufCtx = singleBuffer.getContext('2d');
    // putImageData στον buffer (μην αγγίζεις το ορατό canvas εδώ)
    bufCtx.putImageData(mask, 0, 0);

    // τώρα αντιγράφουμε μία φορά στο ορατό canvas
    const visCtx = ctxMask;
    visCtx.clearRect(0, 0, canvasMask.width, canvasMask.height);
    visCtx.drawImage(singleBuffer, 0, 0);

    const total = (segmentation && segmentation.length) ? segmentation.length : 0;
    countDiv.textContent = `Number of people (total): ${total}`;
  } catch (err) {
    log("⚠️ Detect error: " + err.message);
  }

  requestAnimationFrame(detect);
}

// --- detectAll (multi feeds) using buffers ---
async function detectAll() {
  if (!net) { requestAnimationFrame(detectAll); return; }
  if (!feedVideos || feedVideos.length === 0) { requestAnimationFrame(detectAll); return; }

  const now = performance.now();
  if (now - lastSegTime < SEG_INTERVAL) { requestAnimationFrame(detectAll); return; }
  lastSegTime = now;

  let total = 0;

  for (let i = 0; i < feedVideos.length; i++) {
    const v = feedVideos[i];
    const c = feedCanvases[i];
    const badge = feedBadges[i];
    const buffer = feedBuffers[i];
    if (!v || !v.videoWidth || !c || !buffer) continue;

    try {
      const segmentation = await net.segmentMultiPerson(v, { internalResolution: 'low', segmentationThreshold: 0.7 });
      const count = (segmentation && segmentation.length) ? segmentation.length : 0;
      total += count;
      if (badge) badge.textContent = `People: ${count}`;

      const mask = bodyPix.toMask(segmentation, {r:255,g:0,b:0,a:120}, {r:0,g:0,b:0,a:0});

      // putImageData στον offscreen buffer
      const bufCtx = buffer.getContext('2d');
      // βάζουμε pixel size σωστό (αν χρειαστεί)
      if (buffer.width !== v.videoWidth || buffer.height !== v.videoHeight) {
        buffer.width = v.videoWidth;
        buffer.height = v.videoHeight;
      }
      bufCtx.putImageData(mask, 0, 0);

      // τώρα ένα drawImage στο ορατό canvas σε ένα βήμα
      const visCtx = c.getContext('2d');
      visCtx.clearRect(0, 0, c.width, c.height);
      visCtx.drawImage(buffer, 0, 0, c.width, c.height);
    } catch (e) {
      log("⚠️ segmentation error for feed " + i + ": " + e.message);
      if (badge) badge.textContent = `People: ?`;
    }
  }

  countDiv.textContent = `Number of people (total): ${total}`;

  requestAnimationFrame(detectAll);
}
