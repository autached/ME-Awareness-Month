let mode = 'cover';
let coverImage = null;
let coverOffsetX = 0;
let coverOffsetY = 0;
let coverDragging = false;
let lastTouchDistance = null;

const coverCanvas = document.getElementById("cover-canvas");
// const posterCanvas = document.getElementById("poster-canvas");
const coverCtx = coverCanvas.getContext("2d");
// const posterCtx = posterCanvas.getContext("2d");

let coverDrawnImage = {
  img: null,
  x: 0,
  y: 0,
  width: 0,
  height: 0
};

document.getElementById("cover-image-upload").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    const img = new Image();
    img.onload = function() {
      coverImage = img;
      const scale = 1080 / Math.min(img.width, img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      coverDrawnImage = {
        img: img,
        x: (1080 - width) / 2,
        y: (1080 - height) / 2,
        width: width,
        height: height
      };
      drawCoverCanvas();
    };
    img.src = URL.createObjectURL(file);
  }
});


let overlayImage = new Image();
overlayImage.src = "assets/templates/profile/profile-monat2-de.png";
overlayImage.onload = function() {
  drawCoverCanvas(); // trigger initial draw when overlay is ready
};

function drawCoverCanvas() {
  coverCtx.clearRect(0, 0, 1080, 1080);
  if (coverDrawnImage.img) {
    coverCtx.drawImage(coverDrawnImage.img, coverDrawnImage.x, coverDrawnImage.y, coverDrawnImage.width, coverDrawnImage.height);
  }
  if (overlayImage.complete) {
    coverCtx.drawImage(overlayImage, 0, 0, 1080, 1080);
  }
}


// Dragging functionality MOUSE
coverCanvas.addEventListener("mousedown", function(e) {
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

coverCanvas.addEventListener("mousemove", function(e) {
  if (coverDragging) {
    const rect = coverCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    coverDrawnImage.x = x - coverOffsetX;
    coverDrawnImage.y = y - coverOffsetY;
    drawCoverCanvas();
  }
});

coverCanvas.addEventListener("mouseup", function() {
  coverDragging = false;
});

coverCanvas.addEventListener("mouseleave", function() {
  coverDragging = false;
});

// Touch drag start
coverCanvas.addEventListener("touchstart", function(e) {
  const rect = coverCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  if (
    x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
    y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height
  ) {
    coverDragging = true;
   // Make sure offset is based on current zoom + position
    const imageX = coverDrawnImage.x;
    const imageY = coverDrawnImage.y;
    const imageW = coverDrawnImage.width;
    const imageH = coverDrawnImage.height;
    
    if (
      x >= imageX && x <= imageX + imageW &&
      y >= imageY && y <= imageY + imageH
    ) {
      coverDragging = true;
      coverOffsetX = x - imageX;
      coverOffsetY = y - imageY;
    }
  }
});

// Touch move
coverCanvas.addEventListener("touchmove", function(e) {
  if (e.touches.length === 1 && coverDragging) {
    e.preventDefault();
    const rect = coverCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    coverDrawnImage.x = x - coverOffsetX;
    coverDrawnImage.y = y - coverOffsetY;
    drawCoverCanvas();
  }

  if (e.touches.length === 2) {
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (lastTouchDistance !== null) {
      const zoomChange = distance / lastTouchDistance;
      zoomFactor *= zoomChange;

      // Clamp zoomFactor
      zoomFactor = Math.max(0.2, Math.min(3, zoomFactor));

      const newWidth = coverImage.width * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
      const newHeight = coverImage.height * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
      const centerX = coverDrawnImage.x + coverDrawnImage.width / 2;
      const centerY = coverDrawnImage.y + coverDrawnImage.height / 2;

      coverDrawnImage.width = newWidth;
      coverDrawnImage.height = newHeight;
      coverDrawnImage.x = centerX - newWidth / 2;
      coverDrawnImage.y = centerY - newHeight / 2;

      drawCoverCanvas();
    }

    lastTouchDistance = distance;
  }
}, { passive: false });

// Touch end
coverCanvas.addEventListener("touchend", function() {
  coverDragging = false;
  lastTouchDistance = null;
});

// ===========================================================
// Poster-generator (DOM) – drag + zoom for each photo
// ===========================================================

// -------- element shortcuts --------------------------------
const beforeInput  = document.getElementById('poster-image-before');
const afterInput   = document.getElementById('poster-image-after');
const beforeImg    = document.getElementById('before-img');
const afterImg     = document.getElementById('after-img');

const nameInput    = document.getElementById('poster-name-info');
const noteInput    = document.getElementById('poster-note');
const namePill     = document.getElementById('name-pill');
const noteBox      = document.getElementById('note-box');

const posterNode   = document.getElementById('poster');   // whole poster div
const downloadBtn  = document.getElementById('poster-download');

// -------- simple helpers -----------------------------------
function setSrc(imgEl, file){
  imgEl.src = URL.createObjectURL(file);
}

// -------- upload handlers ----------------------------------
beforeInput.onchange = e => {
  const file = e.target.files[0];
  if(file) setSrc(beforeImg, file);
};
afterInput.onchange  = e => {
  const file = e.target.files[0];
  if(file) setSrc(afterImg, file);
};

// -------- live text binding --------------------------------
nameInput.oninput = () => namePill.textContent = nameInput.value;
noteInput.oninput = () => noteBox.textContent = noteInput.value;

// -------- drag + zoom per image ----------------------------
// each img keeps its own transform state
function enableDragZoom(imgEl){
  let scale = 1, posX = 0, posY = 0;
  let startX=0, startY=0, dragging=false, lastDist=null;

  // helper to apply CSS transform
  const apply = () =>
    imgEl.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;

  // mouse drag
  imgEl.addEventListener('mousedown', e=>{
    dragging=true; startX=e.clientX-posX; startY=e.clientY-posY;
    imgEl.style.cursor='grabbing';
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    posX = e.clientX-startX; posY = e.clientY-startY; apply();
  });
  window.addEventListener('mouseup', ()=>{ dragging=false; imgEl.style.cursor='grab'; });

  // wheel zoom
  imgEl.addEventListener('wheel', e=>{
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.05 : 0.95;
    scale = Math.max(0.2, Math.min(3, scale*delta));
    apply();
  }, {passive:false});

  // pinch-zoom + drag on touch
  imgEl.addEventListener('touchstart', e=>{
    if(e.touches.length===1){
      dragging=true;
      const t=e.touches[0];
      startX=t.clientX-posX; startY=t.clientY-posY;
    }
    lastDist=null;
  },{passive:false});

  imgEl.addEventListener('touchmove', e=>{
    if(e.touches.length===1 && dragging){
      e.preventDefault();
      const t=e.touches[0];
      posX=t.clientX-startX; posY=t.clientY-startY; apply();
    }
    if(e.touches.length===2){
      e.preventDefault();
      const [t1,t2]=e.touches;
      const dist=Math.hypot(t1.clientX-t2.clientX, t1.clientY-t2.clientY);
      if(lastDist){
        scale = Math.max(0.2, Math.min(3, scale*dist/lastDist));
        apply();
      }
      lastDist=dist;
    }
  },{passive:false});
  window.addEventListener('touchend', ()=>{ dragging=false; lastDist=null; });
}

// enable on both images
enableDragZoom(beforeImg);
enableDragZoom(afterImg);

// -------- export poster to PNG -----------------------------
downloadBtn.onclick = ()=>{
  html2canvas(posterNode,{backgroundColor:null,scale:2}).then(canvas=>{
    canvas.toBlob(blob=>{
      const a=document.createElement('a');
      a.download='ME-poster.png';
      a.href=URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    },'image/png');
  });
};

// -------- make sure mode switch shows poster UI ------------
function setMode(selectedMode){
  mode = selectedMode;
  document.getElementById('cover-generator').style.display =
      mode==='cover' ? 'block':'none';
  document.getElementById('poster-generator').style.display =
      mode==='poster'? 'block':'none';
}


// Poster logic (unchanged, still minimal)
/* document.getElementById("poster-image-before").addEventListener("change", function(e) {
  drawPosterCanvas();
});
document.getElementById("poster-image-now").addEventListener("change", function(e) {
  drawPosterCanvas();
});
document.getElementById("poster-name-info").addEventListener("input", function() {
  drawPosterCanvas();
});
document.getElementById("poster-note").addEventListener("input", function() {
  drawPosterCanvas();
});

function drawPosterCanvas() {
  posterCtx.clearRect(0, 0, 1080, 1350);
  const overlay = new Image();
  overlay.src = "assets/templates/poster-template.png";
  overlay.onload = function() {
    posterCtx.drawImage(overlay, 0, 0, 1080, 1350);
    posterCtx.fillStyle = "#000";
    posterCtx.font = "28px sans-serif";
    posterCtx.fillText(document.getElementById("poster-name-info").value, 300, 750);
    posterCtx.font = "24px sans-serif";
    wrapText(posterCtx, document.getElementById("poster-note").value, 100, 1300, 880, 28);

    const beforeFile = document.getElementById("poster-image-before").files[0];
    const nowFile = document.getElementById("poster-image-now").files[0];
    if (beforeFile) {
      const beforeImg = new Image();
      beforeImg.onload = function() {
        posterCtx.drawImage(beforeImg, 100, 320, 300, 300);
      };
      beforeImg.src = URL.createObjectURL(beforeFile);
    }
    if (nowFile) {
      const nowImg = new Image();
      nowImg.onload = function() {
        posterCtx.drawImage(nowImg, 650, 320, 300, 300);
      };
      nowImg.src = URL.createObjectURL(nowFile);
    }
  };
}
*/

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for(let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

// Zoom functionality
let zoomFactor = 1;
coverCanvas.addEventListener("wheel", function(e) {
  e.preventDefault();
  const scaleAmount = 0.05;
  if (e.deltaY < 0) {
    zoomFactor += scaleAmount;
  } else {
    zoomFactor = Math.max(0.1, zoomFactor - scaleAmount);
  }

  // Adjust size and center position
  if (coverImage) {
    const newWidth = coverImage.width * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
    const newHeight = coverImage.height * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
    coverDrawnImage.width = newWidth;
    coverDrawnImage.height = newHeight;

    // Optional: keep the image centered
    const centerX = coverDrawnImage.x + coverDrawnImage.width / 2;
    const centerY = coverDrawnImage.y + coverDrawnImage.height / 2;
    coverDrawnImage.x = centerX - newWidth / 2;
    coverDrawnImage.y = centerY - newHeight / 2;

    drawCoverCanvas();
  }
}, { passive: false });


let selectedTemplate = "profile-monat2-de";

function selectCoverTemplate(templateFile) {
  selectedTemplate = templateFile;
  if (overlayImage.src.indexOf(templateFile) === -1) {
    overlayImage.src = "assets/templates/profile/" + templateFile;
  } else {
    drawCoverCanvas();
  }
}

document.getElementById("zoom-slider").addEventListener("input", function(e) {
  zoomFactor = parseFloat(e.target.value);

  if (coverImage) {
    const newWidth = coverImage.width * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
    const newHeight = coverImage.height * (1080 / Math.min(coverImage.width, coverImage.height)) * zoomFactor;
    const centerX = coverDrawnImage.x + coverDrawnImage.width / 2;
    const centerY = coverDrawnImage.y + coverDrawnImage.height / 2;
    coverDrawnImage.width = newWidth;
    coverDrawnImage.height = newHeight;
    coverDrawnImage.x = centerX - newWidth / 2;
    coverDrawnImage.y = centerY - newHeight / 2;
    drawCoverCanvas();
  }
});

// Improved download fallback
function downloadImage(type) {
  const canvas = type === 'cover' ? document.getElementById("cover-canvas") : document.getElementById("poster-canvas");
  const link = document.createElement("a");

  let filename = "ME-profile-image.png"; // fallback

  if (type === 'cover' && typeof selectedTemplate !== 'undefined') {
    const baseName = selectedTemplate.split("/").pop().replace(/\.[^/.]+$/, ""); // remove extension
    filename = "ME-" + baseName + ".png";
  } else if (type === 'poster') {
    filename = "ME-poster.png";
  }

  link.download = filename;

  // Prefer toBlob if available
  if (canvas.toBlob) {
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
        /* +++ NEU: nur für Cover das CountAPI-Hit auslösen + Text aktualisieren +++ */
      if (type === 'cover') {
        fetch('https://api.countapi.xyz/hit/memonat.mecfs.space/cover-generator')
          .then(res => res.json())
          .then(data => {
            const el = document.getElementById('cover-download-count');
            if (el) el.textContent =
              `Es wurden ${data.value} Profilbilder insgesamt bereits heruntergeladen.`;
          });
      }
    }, "image/png");
  } else {
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}

document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove from all buttons first (optional, for exclusive selection)
    document.querySelectorAll('button').forEach(b => b.classList.remove('sticky-active'));

    // Then add to clicked one
    btn.classList.add('sticky-active');
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("cover-button");
  if (btn) {
    btn.classList.add("sticky-active");
  }
});

function loadCoverTemplates() {
  fetch('assets/templates/cover.json')
    .then(res => res.json())
    .then(files => {
      const box = document.querySelector('.template-selector');
      box.innerHTML = '';                           // clear old content

      files.forEach(filename => {
        const img = document.createElement('img');
        img.src = `assets/templates/profile/${filename}`;
        img.className = 'template-thumb';
        img.onclick = () => selectCoverTemplate(filename);
        box.appendChild(img);
      });

      // automatically pick the first template
      if (files.length) selectCoverTemplate(files[0]);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cover-button')?.classList.add('sticky-active');
  loadCoverTemplates();          //  👈  new line
});
