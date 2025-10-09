    window.onload = init;   
    
    const video = document.getElementById('video');
    const canvasMask = document.getElementById('canvasMask');
    const ctxMask = canvasMask.getContext('2d');
    const countDiv = document.getElementById('count');
    const reloadBtn = document.getElementById('reloadBtn');

    let hls;
    const hlsUrlBase = "https://s76.ipcamlive.com/streams/4c3txyv0fs2dw4ok6/stream.m3u8";
    const token = "lto204k576bji6q344unuf7jk5";     // ""; //"qp7eg58atl7m23qdvm8q200og0"; 


    function loadVideo() {
      //const url = `${hlsUrlBase}?a=${token}`; //gia skylinewebcams
      const url = hlsUrlBase;

      // HLS (HTTP Live Streaming) einai ena protokollo streaming ,
      // pou diaspaei to video se mikra kommata (.ts) kai exei ena playlist (.m3u8).
      // Den to ypostirizoun oloi oi browsers, gia auto xrhsimopoioume ti vivliothiki hls.js
      // pou kanei dynamiko katevazma kai anaparagogi aftwn twn kommatiwn mesa se HTML5 video.
      if (Hls.isSupported()) {
        if (hls) {
          hls.destroy();                  //katharizoume pithanos palia mnhmh 
        }
        hls = new Hls();
        hls.loadSource(url);             //fortwnoume to playlist tou stream
        hls.attachMedia(video);          //Syndedoume to video tag me to hls instance
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          video.play();                  //Meta to fortwma tou manifest, arxizei to video 
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function () {
          video.play();
        });
      } else {
        alert("Το HLS δεν υποστηρίζεται στον browser.");
      }
    }

    async function init() {
      loadVideo();

      //koumpi gia reload tou video
      reloadBtn.addEventListener('click', loadVideo);

      const net = await bodyPix.load();
      console.log("BodyPix model loaded");


      //Synartisi pou tha trexei epanaliptika gia anixneusi anthropwn kai sxediash maskas
      async function detect() {

        
        if (video.readyState < 2) {             //Elegxoume an to video einai etoimo gia epeksergasia
          requestAnimationFrame(detect);
          return;
        }

        //Kaloume to segmentMultiPerson gia na entopisoume pollous anthropous sto video
        const segmentation = await net.segmentMultiPerson(video, {
          internalResolution: 'high', // 'low', 'medium', 'high' (default is 'medium')
          segmentationThreshold: 0.6,
          maxDetections: 10 //10 is the default value
        });
        console.log('segmentation:', segmentation);

        
        ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height); // Katharizoume ton kamva maskas prin sxediasoume ksana
        const mask = bodyPix.toMask(segmentation);      // Metatrepoume to apotelesma tis segmentMultiPerson se maska eikonas (mask)

        bodyPix.drawMask(canvasMask, video, mask, 0.5, 3, false);   // Sxediazoume pano ston kamva ti maska

        
        //const segmentations = await net.segmentMultiPerson(video, {
        //  internalResolution: 'medium',
        //  segmentationThreshold: 0.7,
        //  maxDetections: 8 //10 is the default value
        //}); 

        const count = segmentation.length; //const count = segmentations.length;
        //const count = segmentation.allPoses?.length || 0;
        countDiv.textContent = `Number of people: ${count}`;

        //Otan exoume neo frame ekteloume ksana thn detect
        requestAnimationFrame(detect);
      }

      detect();
    }

    //init();