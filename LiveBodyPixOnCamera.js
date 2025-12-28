// Doulevei kanonika gia screen share kai kamera me maska.
// Mporei na deixnei kai oles tis kameres mazi (xoris maskes).
// Xreiazetai https gia na doulepsei (logo twn getUserMedia kai getDisplayMedia).
// Den doulevei kapoies fores h piso kamera se kinita.


// ftiaxniume to video sto opoio tha paizei to stream apo kamera h screen share
const video= document.createElement('video');
 video.autoplay = false;
 video.playsInline = false;
 video.muted = true;
 video.style.display = 'none';
 video.display = 'none';
 let useScreen = false;

//document.body.appendChild(video);

// Pairnoume ta stoixeia apo to html
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

// Logging function - Sinartisi gia emfanish minimaton
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Intialization - Trexei molis fortosei h selida
window.onload = init;



//initialization function
async function init() {
  // rotame ton xrhsth an thelei na xrhsimopoihsei screen share h kamera
  useScreen = confirm("Do you want to share your screen? Press 'Cancel' to use the camera.");

// Epilogh: Kamera
  if (!useScreen) {
    await listCameras();          //pairnoyme th lista twn kamerwn
    if (cameras.length === 0) {
      alert("Δεν βρέθηκαν διαθέσιμες κάμερες.");
      return;
    }
    await showAllCameras(); // proepilogh “Show all cameras”
  
  // Epilogh: Screen share  
  } else {  
    log("📺 Using screen share...");

    // pairnoume to stream ths othonis
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

    // perimenoume na fortosei to video
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


// Allagh kameras (select mesw tou dropdown)
  cameraSelect.onchange = async () => {
    if (useScreen) return;                // An eimaste se screen share agnohse to
    const deviceId = cameraSelect.value;
    if (deviceId === "all") {
      await showAllCameras();
    } else {
      await startCamera(deviceId);
    }
  };

  // Fortwnoume to BodyPix montelo
  log("⏳ Loading BodyPix model...");
  net = await bodyPix.load();
  log("✅ BodyPix model loaded");

  // Na ksekinaei h anixneush otan einai etoimo to video
  await new Promise(resolve => {
    if (video.readyState >= 2) resolve();
    else video.onloadeddata = () => resolve();
  });

  //ksekina h anixneush swmatwn
  detect();
}



// Vriskoume th lista sindedemenon kameron
async function listCameras() {
  //Zhtame adeia prosvashs gia thn kamera
  await navigator.mediaDevices.getUserMedia({ video: true });

  //pairnoume oles tis siskeves pou einai sindedemenes kai kratame mono tis kameres
  const devices = await navigator.mediaDevices.enumerateDevices();
  cameras = devices.filter(d => d.kind === 'videoinput');

  //katharizei to dropdown
  cameraSelect.innerHTML = '';

  //prosthetoume epilogh show all cameras
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📹 Show all cameras';
  cameraSelect.appendChild(allOption);

  //prosthetoume kathe kamera sto dropdown
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



// Ekkinisi mias kameras me maska
async function startCamera(deviceId) {
  showingAll = false;                   // De deixnoume oles tis kameres
  cameraContainer.innerHTML = '';       // katharizoume to container twn kameron

  //an uparxei proigoumeno stream tote to stamatame
  if (stream) stream.getTracks().forEach(track => track.stop());

  //pairnoume to stream apo thn epilegmenh kamera
  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });


  video.srcObject = stream;     // sindeoume to stream sto video
  await video.play();           // perimenoume na ksekinaei to video

  // prosarmogh tou canvas sto megethos tou video
  canvasMask.width = video.videoWidth;
  canvasMask.height = video.videoHeight;
  canvasMask.style.display = 'block';
  log("🎥 Camera started: " + deviceId);
}



// Emfanish olwn twn kamerwn (xwris anixneush)
async function showAllCameras() {
  showingAll = true;    //Energopoiei th leitourgeia na deixnei oles tis kameres (to xrhsimopoioume sth detect() )

  // An uparxei energo stream tote to stamata
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  // katharizei thn othoni kai to canvas
  ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);
  canvasMask.style.display = 'none';
  cameraContainer.innerHTML = "<h3>All cameras view (no detection active)</h3>";

  // Gia kathe kamera ftiaxnoume ena video element sto opoio deixnoume to stream tis
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
      //pairnei stream apo kathe kamera kai to sindeei sto video element
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false
      });
      v.srcObject = s;
    } catch (err) {   
      //an apotuxei (px h kamera den einai diathesimi) petaei error
      block.textContent = "❌ " + (err.message || err);
    }
  }

  log("📺 Showing all cameras (no detection)");
}



// Anixneush swmatwn kai emfanish maskas mesw BodyPix
async function detect() {
  // An deixnoume oles tis kameres den kanoume anixneush
  if (showingAll) {
    requestAnimationFrame(detect);
    return;
  }

  //An den exei fortosei akome to video h h kamera tote perimenoume
  if (!net || !video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    // Kanei anixneush gia polla atoma (segmentMultiPerson)
    const segmentation = await net.segmentMultiPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    // An allaksoun oi diastaseis tote prosarmozoume to canvas
    if (canvasMask.width !== video.videoWidth || canvasMask.height !== video.videoHeight) {
      canvasMask.width = video.videoWidth;
      canvasMask.height = video.videoHeight;
    }

    //katharizoume to canvas
    ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);

    //Dimiourgei maska me vash to segmentation
    const mask = bodyPix.toMask(segmentation);

    //Sxediazei th maska sto canvas
    bodyPix.drawMask(canvasMask, video, mask, 0.6, 3, false);

    //Metrame posa atoma anixnefthikan
    const count = segmentation.length;
    countDiv.textContent = `Number of people: ${count}`;
  } catch (err) {
    //log("⚠️ Detect error: " + err.message);
  }

  // kalei ksana thn detect gia na ginetai sinexeia to detection, dld se kathe frame
  requestAnimationFrame(detect);
}
