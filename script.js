// =============================================================
//  ME Awareness Image Generator – main client-side script
//  -------------------------------------------------------
//  • Displays cover‑template thumbnails loaded from auto‑generated
//    JSON, but does **not** preload any overlay
//  • Lets the user upload a photo, zoom & drag it, then download
//    the composed image – pure client‑side (GitHub Pages‑friendly)
// =============================================================

//--------------------------------------------------------------
// 1. GLOBAL STATE & CONSTANTS
//--------------------------------------------------------------
let mode = 'cover';                 // current generator mode
let coverImage = null;              // user‑uploaded image element
let coverDrawnImage = {             // tracking the drawn photo
  img: null,
  x: 0,
  y: 0,
  width: 0,
  height: 0
};
let zoomFactor = 1;                 // zoom level for cover photo
let coverDragging = false;          // is user dragging the photo?
let coverOffsetX = 0, coverOffsetY = 0;
let lastTouchDistance = null;       // for pinch‑zoom on mobile
let selectedTemplate = null;        // filename of the current overlay

//--------------------------------------------------------------
// 2. DOM ELEMENT REFERENCES
//--------------------------------------------------------------
const coverCanvas   = document.getElementById('cover-canvas');
const coverCtx      = coverCanvas.getContext('2d');
const zoomSlider    = document.getElementById('zoom-slider');
const templateBox   = document.querySelector('.template-selector');

//--------------------------------------------------------------
// 3. HELPER – DRAW THE COVER CANVAS
//--------------------------------------------------------------
const overlayImage = new Image();   // src set only after click
function drawCoverCanvas() {
  coverCtx.clearRect(0, 0, 1080, 1080);

  // user photo
  if (coverDrawnImage.img) {
    const { img, x, y, width, height } = coverDrawnImage;
    coverCtx.drawImage(img, x, y, width, height);
  }

  // template overlay (only after user selects one)
  if (selectedTemplate && overlayImage.complete) {
    coverCtx.drawImage(overlayImage, 0, 0, 1080, 1080);
  }
}

//--------------------------------------------------------------
// 4. LOAD COVER TEMPLATES & BUILD THUMBNAILS (no auto select)
//--------------------------------------------------------------
function loadCoverTemplates() {
  fetch('assets/templates/cover.json')
    .then(res => res.json())
    .then(files => {
      templateBox.innerHTML = '';
      files.forEach(filename => {
        const thumb = document.createElement('img');
        thumb.src = `assets/templates/profile/${filename}`;
        thumb.className = 'template-thumb';
        thumb.title = filename;
        thumb.onclick = () => selectCoverTemplate(filename);
        templateBox.appendChild(thumb);
      });
      // No default selection – user decides
    })
    .catch(console.error);
}

function selectCoverTemplate(filename) {
  if (filename === selectedTemplate) return;    // already selected
  selectedTemplate = filename;
  overlayImage.onload = drawCoverCanvas;
  overlayImage.src = `assets/templates/profile/${filename}`;
}

//--------------------------------------------------------------
// 5. HANDLE USER IMAGE UPLOAD, DRAG & ZOOM
//--------------------------------------------------------------
// ------- upload -------
document.getElementById('cover-image-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    coverImage = img;
    zoomFactor = 1;
    const scale = 1080 / Math.min(img.width, img.height);
    coverDrawnImage = {
      img,
      width: img.width * scale,
      height: img.height * scale,
      x: (1080 - img.width * scale) / 2,
      y: (1080 - img.height * scale) / 2
    };
    drawCoverCanvas();
  };
  img.src = URL.createObjectURL(file);
});

// ------- drag (mouse) -------
coverCanvas.addEventListener('mousedown', e => {
  const rect = coverCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (
    x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
    y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height
  ) {
    coverDragging = true;
    coverOffsetX = x - coverDrawnImage.x;
    coverOffsetY = y - coverDrawnImage.y;
  }
});
coverCanvas.addEventListener('mousemove', e => {
  if (!coverDragging) return;
  const rect = coverCanvas.getBoundingClientRect();
  coverDrawnImage.x = e.clientX - rect.left - coverOffsetX;
  coverDrawnImage.y = e.clientY - rect.top  - coverOffsetY;
  drawCoverCanvas();
});
window.addEventListener('mouseup',   () => (coverDragging = false));
window.addEventListener('mouseleave',() => (coverDragging = false));

// ------- drag & pinch (touch) -------
coverCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const rect = coverCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    if (
      x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
      y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height
    ) {
      coverDragging = true;
      coverOffsetX = x - coverDrawnImage.x;
      coverOffsetY = y - coverDrawnImage.y;
    }
  }
  lastTouchDistance = null;
}, { passive: false });

coverCanvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && coverDragging) {
    e.preventDefault();
    const rect = coverCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    coverDrawnImage.x = touch.clientX - rect.left - coverOffsetX;
    coverDrawnImage.y = touch.clientY - rect.top  - coverOffsetY;
    drawCoverCanvas();
  }
  if (e.touches.length === 2) {
    e.preventDefault();
    const [t1, t2] = e.touches;
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const distance = Math.hypot(dx, dy);
    if (lastTouchDistance) {
      zoomFactor = Math.max(0.2, Math.min(3, zoomFactor * distance / lastTouchDistance));
      resizeCoverImage();
    }
    lastTouchDistance = distance;
  }
}, { passive: false });
window.addEventListener('touchend', () => { coverDragging = false; lastTouchDistance = null; });

// ------- scroll wheel zoom -------
coverCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomFactor += (e.deltaY < 0 ? 1 : -1) * 0.05;
  zoomFactor = Math.max(0.1, Math.min(3, zoomFactor));
  resizeCoverImage();
}, { passive: false });

function resizeCoverImage() {
  if (!coverImage) return;
  const scale = 1080 / Math.min(coverImage.width, coverImage.height) * zoomFactor;
  const centerX = coverDrawnImage.x + coverDrawnImage.width  / 2;
  const centerY = coverDrawnImage.y + coverDrawnImage.height / 2;
  coverDrawnImage.width  = coverImage.width  * scale;
  coverDrawnImage.height = coverImage.height * scale;
  coverDrawnImage.x = centerX - coverDrawnImage.width  / 2;
  coverDrawnImage.y = centerY - coverDrawnImage.height / 2;
  drawCoverCanvas();
}

// slider mirrors wheel / pinch zoom
zoomSlider.addEventListener('input', e => {
  zoomFactor = parseFloat(e.target.value);
  resizeCoverImage();
});

//--------------------------------------------------------------
// 6. DOWNLOAD COMPOSED IMAGE
//--------------------------------------------------------------
function downloadImage(type = 'cover') {
  const canvas = type === 'cover' ? coverCanvas : document.getElementById('poster-canvas');
  const link   = document.createElement('a');
  const base   = selectedTemplate ? selectedTemplate.replace(/\.[^.]+$/, '') : 'generated';
  link.download = `ME-${base}.png`;

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

//--------------------------------------------------------------
// 7. MISCELLANEOUS UI (mode toggle, button styling)
//--------------------------------------------------------------
function setMode(selected) {
  mode = selected;
  document.getElementById('cover-generator').style.display  = (mode === 'cover')  ? 'block' : 'none';
  document.getElementById('poster-generator').style.display = (mode === 'poster') ? 'block' : 'none';
}

document.querySelectorAll('#mode-select button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mode-select button').forEach(b => b.classList.remove('sticky-active'));
    btn.classList.add
