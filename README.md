LiveBodyPix
Real-time human body segmentation and body part detection using TensorFlow.js and the BodyPix model directly in the browser via webcam feed or screen sharing.

Live Demo: pavlostzernias.github.io/LiveBodyPix/LiveBodyPixFromCamera.html

Overview
LiveBodyPix is a web-based computer vision project developed during academic coursework in Computer Science at the University of Crete. 
It leverages TensorFlow.js and the pre-trained BodyPix deep learning model to perform real-time person segmentation and body part detection directly on the client side, 
using either a live camera stream or browser screen sharing as the input source.

Features
Dual Video Input: Supports live segmentation using both Webcam Stream and Screen Sharing (display capture).

Body Part Identification: Visualizes and colors distinct body parts (face, arms, torso, legs, hands, feet).

Client-Side Execution: Fully runs in the browser leveraging WebGL hardware acceleration via TensorFlow.js.

No Server Setup: Runs seamlessly via GitHub Pages without any backend dependencies.

Interactive UI: Simple controls to toggle segmentation effects, adjust opacity, and switch visual modes.


Tech Stack
JavaScript

TensorFlow.js & BodyPix Model

HTML5 Canvas, Video API & Screen Capture API (getUserMedia / getDisplayMedia)

CSS3


Getting Started
Prerequisites
A modern web browser with WebGL and Webcam support (Chrome, Firefox, Edge).

A local web server (e.g., VS Code Live Server, Node http-server, or Python's http.server) to bypass browser CORS restrictions with webcam streaming.


How It Works
Video Feed Capture: Streams video frames from the user's webcam or selected screen/window via HTML5 media capture APIs.

Model Inference: Feeds the live stream into the BodyPix neural network to detect human posture and generate segmentation masks.

Canvas Visualization: Renders the resulting masks over the original video frames on an HTML5 <canvas> in real time.




Author
Pavlos Tzernias
