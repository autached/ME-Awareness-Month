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
            //Removed the old buggy code
            console.log("COVER DOWNLOAD HIT - DISABLED API");

      }
    }, "image/png");
  } else {
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}

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
const downloadBtn  = document.getElementById('poster-download'); // ADD THIS LINE

Btn  = document.getElementById('poster-download');

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
/* downloadBtn.onclick = ()=>{
  html2canvas(posterNode,{backgroundColor:null,scale:2}).then(canvas=>{
    canvas.toBlob(blob=>{
      const a=document.createElement('a');
      a.download='ME-poster.png';
      a.href=URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    },'image/png');
  });
};*/

// Helper function to wait for an image to load
function waitForImageLoad(imgElement) {
    return new Promise((resolve, reject) => {
        imgElement.onload = () => resolve();
        imgElement.onerror = () => reject(`Failed to load image at ${imgElement.src}`);
        if(imgElement.complete) { //In case the image is already in cache
            resolve();
        }
    });
}

function updatePoster() {
  const beforeInput = document.getElementById('poster-image-before');
  const afterInput = document.getElementById('poster-image-after');
  const beforeImg = document.getElementById('before-img');
  const afterImg = document.getElementById('after-img');

  const nameInput = document.getElementById('poster-name-info');
  const noteInput = document.getElementById('poster-note');
  const namePill = document.getElementById('name-pill');
  const noteBox = document.getElementById('note-box');

  console.log("updatePoster() called");

  // Check for a file before creating the URL and create URL
  if (beforeInput.files && beforeInput.files[0]) {
    const url = URL.createObjectURL(beforeInput.files[0]);
    beforeImg.src = url;
    console.log("Before image updated");

    //Deallocate the URL right after use.
    URL.revokeObjectURL(url);
  } else {
    beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Clear the source, or set to a placeholder
    console.log("Before image cleared");
  }

  if (afterInput.files && afterInput.files[0]) {
     const url = URL.createObjectURL(afterInput.files[0]);
    afterImg.src = url + '?' + Math.random();
    console.log("After image updated");
      //Deallocate the URL right after use.
    URL.revokeObjectURL(url);

  } else {
    afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Clear the source, or set to a placeholder
    console.log("After image cleared");
  }

  namePill.textContent = nameInput.value;
  noteBox.textContent = noteInput.value;
    
  // show pill only when there is text
  namePill.classList.toggle('hidden', nameInput.value.trim()==='');
  noteBox.classList.toggle('hidden', noteInput.value.trim()==='');
}

downloadBtn.onclick = async () => {
    updatePoster();

    const beforeImg = document.getElementById('before-img');
    const afterImg = document.getElementById('after-img');

    let promises = [];

    if(beforeImg.src) {
        promises.push(waitForImageLoad(beforeImg));
    }

    if(afterImg.src) {
        promises.push(waitForImageLoad(afterImg));
    }

    try {
        await Promise.all(promises);

        const targetWidth = 1080;  // Desired width
        const targetHeight = 1350; // Desired height

        html2canvas(posterNode, {
            backgroundColor: null,
            width: targetWidth,
            height: targetHeight,
            scale: 1
        }).then(canvas => {
            canvas.toBlob(blob => {
                const a = document.createElement('a');
                a.download = 'ME-poster.png';
                a.href = URL.createObjectURL(blob);
                a.click();
                URL.revokeObjectURL(a.href);
            }, 'image/png');
        });
    } catch (error) {
        console.error("Image loading error:", error);
        alert("Failed to load one or more images. Please check the console for details.");
    }
};

// -----------------------------
//  Mode switching via #hash
// -----------------------------
function setMode(selected){
  mode = selected;
  location.hash = mode + '-mode';  // cover-mode | poster-mode

  document.getElementById('cover-generator').style.display  =
      mode === 'cover'  ? 'block' : 'none';
  document.getElementById('poster-generator').style.display =
      mode === 'poster' ? 'block' : 'none';

  // button highlight
  document.querySelectorAll('#mode-select button')
          .forEach(btn => btn.classList.toggle(
            'sticky-active',
            btn.id === (mode + '-button')
          ));
}

// -------- initialise on load ----------
document.addEventListener('DOMContentLoaded', () => {
  const h = location.hash.replace('#','');    // 'cover' | 'poster' | ''
  setMode(h==='poster-mode' ? 'poster' : 'cover'); // default cover
});

// -------- react to manual hash change --
window.addEventListener('hashchange', () => {
  const h = location.hash.replace('#','');
  if(h==='cover-mode' || h==='poster-mode') setMode(h.split('-')[0]);
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
    }, "image/png");
  } else {
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
