let mode = 'cover';
let coverImage = null;
let coverOffsetX = 0;
let coverOffsetY = 0;
let coverDragging = false;

function setMode(selectedMode) {
  mode = selectedMode;
  document.getElementById('cover-generator').style.display = mode === 'cover' ? 'block' : 'none';
  document.getElementById('poster-generator').style.display = mode === 'poster' ? 'block' : 'none';
}

const coverCanvas = document.getElementById("cover-canvas");
const posterCanvas = document.getElementById("poster-canvas");
const coverCtx = coverCanvas.getContext("2d");
const posterCtx = posterCanvas.getContext("2d");

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
overlayImage.src = "assets/templates/cover-template.png";
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
    coverOffsetX = x - coverDrawnImage.x;
    coverOffsetY = y - coverDrawnImage.y;
  }
});

// Touch move
coverCanvas.addEventListener("touchmove", function(e) {
  if (coverDragging) {
    e.preventDefault(); // very important
    const rect = coverCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    coverDrawnImage.x = x - coverOffsetX;
    coverDrawnImage.y = y - coverOffsetY;
    drawCoverCanvas();
  }
}, { passive: false });

// Touch end
coverCanvas.addEventListener("touchend", function() {
  coverDragging = false;
});

// Poster logic (unchanged, still minimal)
document.getElementById("poster-image-before").addEventListener("change", function(e) {
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

function downloadImage(type) {
  const canvas = type === 'cover' ? document.getElementById("cover-canvas") : document.getElementById("poster-canvas");
  const link = document.createElement("a");
  link.download = type + "-me-awareness.png";
  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  });
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


let selectedTemplate = "cover-template.png";

function selectCoverTemplate(templateFile) {
  selectedTemplate = templateFile;
  if (overlayImage.src.indexOf(templateFile) === -1) {
    overlayImage.src = "assets/templates/" + templateFile;
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
  link.download = type + "-me-awareness.png";

  if (canvas.toBlob) {
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  } else {
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
