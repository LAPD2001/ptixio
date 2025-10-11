const logDiv = document.getElementById('log');
const cameraContainer = document.getElementById('cameraContainer');
const cameraSelect = document.getElementById('cameraSelect');

let net;
let cameras = [];
let activeStreams = [];

// απλή logging function
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
}

// αρχή
window.onload = init;

async function init() {
  log("🚀 Initializing...");
  await navigator.mediaDevices.getUserMedia({ video: true }); // ζητάει άδεια

  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');
  log(`📷 Found ${cameras.length} camera(s)`);

  if (cameras.length === 0) {
    log("⚠️ No cameras found.");
    return;
  }

  // Προσθέτουμε επιλογές στο dropdown
  cameraSelect.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📸 All cameras';
  cameraSelect.appendChild(allOption);

  cameras.forEach((cam, i) => {
    const option = document.createElement('option');
    option.value = cam.deviceId;
    option.textContent = cam.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(option);
  });

  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  // όταν αλλάζει επιλογή στο select
  cameraSelect.onchange = () => handleCameraSelection(cameraSelect.value);

  // ξεκινάμε με “All cameras”
  handleCameraSelection('all');
}

// χειρίζεται ποια κάμερα να δείξει
async function handleCameraSelection(value) {
  // καθαρίζει ό,τι υπήρχε
  cameraContainer.innerHTML = '';
  activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
  activeStreams = [];

  if (value === 'all') {
    log("🌐 Displaying ALL cameras...");
    for (let i = 0; i < cameras.length; i++) {
      await createCameraBlock(cameras[i], i);
    }
  } else {
    const camera = cameras.find(c => c.deviceId === value);
    if (camera) {
      log(`🎥 Displaying only camera: ${camera.label || camera.deviceId}`);
      await createCameraBlock(camera, cameras.indexOf(camera));
    } else {
      log("⚠️ Camera not found!");
    }
  }
}

// δημιουργεί video + canvas για κάθε κάμερα
async function createCameraBlock(camera, index) {
  const block = document.createElement('div');
  block.style.border = "1px solid #333";
  block.style.margin = "10px";
  block.style.padding = "10px";
  block.style.display = "inline-block";
  block.style.verticalAlign = "top";

  const title = document.createElement('div');
  title.textContent = `🎥 Camera ${index + 1}: ${camera.label || camera.deviceId}`;
  block.appendChild(title);

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.width = "320px";
  block.appendChild(video);

  const canvas = document.createElement('canvas');
  canvas.style.display = "block";
  canvas.style.marginTop = "5px";
  block.appendChild(canvas);

  const countDiv = document.createElement('div');
  countDiv.textContent = "People: 0";
  countDiv.style.marginTop = "5px";
  block.appendChild(countDiv);

  cameraContainer.appendChild(block);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: camera.deviceId } }
    });
    video.srcObject = stream;
    await video.play();
    activeStreams.push(stream);
    log(`✅ Started camera ${index + 1}`);

    detectLoop(video, canvas, countDiv);
  } catch (err) {
    log(`❌ Error starting camera ${index + 1}: ${err.message}`);
  }
}

// BodyPix detection loop για κάθε κάμερα
// Αντικατάστησε την υπάρχουσα detectLoop με αυτή
async function detectLoop(video, canvas, countDiv) {
  const ctx = canvas.getContext('2d');

  // περιμένετε να έχει το video διαστάσεις
  await new Promise(resolve => {
    if (video.readyState >= 2 && video.videoWidth) resolve();
    else {
      video.onloadeddata = () => resolve();
      // μικρό timeout fallback
      setTimeout(resolve, 2000);
    }
  });

  async function detect() {
    if (!video.videoWidth) {
      requestAnimationFrame(detect);
      return;
    }

    // set canvas size to match video (pixel-size)
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      // χρησιμοποιούμε segmentPerson (επισημαίνει ΟΛΑ τα άτομα σε ένα segmentation)
      const segmentation = await net.segmentPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      // έλεγξε το segmentation για debugging
      // console.log('segmentation:', segmentation);

      // αν segmentation είναι έγκυρο, φτιάχνουμε μάσκα και τη ζωγραφίζουμε
      if (segmentation && segmentation.data) {
        const mask = bodyPix.toMask(segmentation); // επιστρέφει ImageData-like
        // σχεδιάζουμε τη μάσκα πάνω στο video στο canvas
        bodyPix.drawMask(canvas, video, mask, 0.6, 3, false);
        // αν θες να σχεδιάσεις και το ίδιο το video κάτω από τη μάσκα:
        // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // ctx.putImageData(maskImageData, 0, 0);
      } else {
        // αν δεν έχει segmentation, σχεδιάζουμε απλά το video (για να μην εμφανίζεται μαύρο)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // count: segmentation may be single mask -> count by checking number of connected components is harder.
      // Αν θες απλό count: μπορείς να fallback στο segmentMultiPerson για μέτρηση:
      const multi = await net.segmentMultiPerson(video, { internalResolution: 'low', segmentationThreshold: 0.7 });
      const count = Array.isArray(multi) ? multi.length : 0;
      countDiv.textContent = `People: ${count}`;
    } catch (err) {
      log(`⚠️ Detect error: ${err && err.message ? err.message : err}`);
    }

    requestAnimationFrame(detect);
  }

  detect();
}

