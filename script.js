// ===========================================================
// 1. Global Constants
// ===========================================================
const coverCanvas = document.getElementById("cover-canvas");
const coverCtx = coverCanvas ? coverCanvas.getContext("2d") : null;
let overlayImage = new Image();

// ===========================================================
// 2. Global Variables
// ===========================================================
let mode = 'cover';
let currentPosterColorMode = 'simple';
let coverImage = null;
let coverOffsetX = 0, coverOffsetY = 0;
let coverDragging = false;
let lastTouchDistance = null;
let coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0 };
let selectedTemplate = null;
let zoomFactor = 1;

// ===========================================================
// 3. Cover Image Generator Functions
// (Functions: drawCoverCanvas, loadCoverTemplates, selectCoverTemplate)
// ... these remain the same as the last fully working version you had ...
// For brevity, I'll skip pasting them again if they were fine.
// Ensure loadCoverTemplates uses files.sort() and handles default selection.
// Example:
function drawCoverCanvas() {
    if (!coverCtx) return;
    coverCtx.clearRect(0, 0, 1080, 1080);
    if (coverDrawnImage.img) {
        coverCtx.drawImage(coverDrawnImage.img, coverDrawnImage.x, coverDrawnImage.y, coverDrawnImage.width, coverDrawnImage.height);
    }
    if (overlayImage.complete && overlayImage.src) {
        coverCtx.drawImage(overlayImage, 0, 0, 1080, 1080);
    }
}

overlayImage.onload = function() { drawCoverCanvas(); };
overlayImage.onerror = function() { console.error("Failed to load overlay image: " + overlayImage.src); };

function loadCoverTemplates() {
    fetch('assets/templates/cover.json')
        .then(res => {
            if (!res.ok) { console.error(`HTTP error! status: ${res.status} for URL: ${res.url}`); throw new Error(`HTTP error! status: ${res.status}`); }
            return res.json();
        })
        .then(files => {
            files.sort();
            const box = document.querySelector('.template-selector');
            if (!box) return;
            box.innerHTML = '';
            files.forEach(filename => {
                const img = document.createElement('img');
                img.src = `assets/templates/profile/${filename}`;
                img.className = 'template-thumb';
                img.alt = `Template ${filename.replace(/\.[^/.]+$/, "")}`;
                img.onclick = () => selectCoverTemplate(filename);
                box.appendChild(img);
            });
            if (files.length > 0 && (!selectedTemplate || !files.includes(selectedTemplate))) {
                 selectCoverTemplate(files[0]);
            } else if (selectedTemplate && files.includes(selectedTemplate)) {
                const currentTemplateSrc = "assets/templates/profile/" + selectedTemplate;
                if (overlayImage.src !== currentTemplateSrc || !overlayImage.complete) {
                    overlayImage.src = currentTemplateSrc;
                } else {
                    drawCoverCanvas();
                }
            } else if (files.length === 0) {
                box.innerHTML = '<p>No templates found in cover.json.</p>';
            }
        })
        .catch(error => {
            console.error("Failed to load or process cover templates:", error);
            const box = document.querySelector('.template-selector');
            if (box) box.innerHTML = "<p>Error loading templates. Check console for details.</p>";
        });
}

function selectCoverTemplate(templateFile) {
    selectedTemplate = templateFile;
    const newSrc = "assets/templates/profile/" + templateFile;
    if (overlayImage.src !== newSrc || !overlayImage.complete) {
        overlayImage.src = newSrc;
    } else {
        drawCoverCanvas();
    }
}
// ===========================================================
// 4. Poster Generator Functions
// (Functions: setSrc, enableDragZoom, updatePoster)
// ... these remain the same ...
// Example:
function setSrc(imgEl, file) {
    if (imgEl.dataset.objectUrl) URL.revokeObjectURL(imgEl.dataset.objectUrl);
    const newUrl = URL.createObjectURL(file);
    imgEl.src = newUrl;
    imgEl.dataset.objectUrl = newUrl;
}

function enableDragZoom(imgEl) {
    if (!imgEl) return;
    let scale = 1, posX = 0, posY = 0;
    let startX = 0, startY = 0, dragging = false, lastDist = null;
    const apply = () => imgEl.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
    imgEl.style.cursor = 'grab';
    apply();
    imgEl.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; startX = e.clientX - posX; startY = e.clientY - posY; imgEl.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; posX = e.clientX - startX; posY = e.clientY - startY; apply(); });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; imgEl.style.cursor = 'grab'; } });
    imgEl.addEventListener('wheel', e => { e.preventDefault(); const rect = imgEl.getBoundingClientRect(); const mouseX = e.clientX - rect.left - rect.width / 2; const mouseY = e.clientY - rect.top - rect.height / 2; const delta = e.deltaY < 0 ? 1.05 : 0.95; const oldScale = scale; scale = Math.max(0.2, Math.min(5, scale * delta)); posX -= mouseX * (scale / oldScale - 1); posY -= mouseY * (scale / oldScale - 1); apply(); }, { passive: false });
    imgEl.addEventListener('touchstart', e => { if (e.touches.length === 1) { e.preventDefault(); dragging = true; const t = e.touches[0]; startX = t.clientX - posX; startY = t.clientY - posY; } else if (e.touches.length === 2) { e.preventDefault(); dragging = false; const [t1, t2] = e.touches; lastDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); } }, { passive: false });
    imgEl.addEventListener('touchmove', e => { if (e.touches.length === 1 && dragging) { e.preventDefault(); const t = e.touches[0]; posX = t.clientX - startX; posY = t.clientY - startY; apply(); } else if (e.touches.length === 2 && lastDist) { e.preventDefault(); const [t1, t2] = e.touches; const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); const rect = imgEl.getBoundingClientRect(); const touchCenterX = (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2; const touchCenterY = (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2; const oldScale = scale; scale = Math.max(0.2, Math.min(5, scale * dist / lastDist)); posX -= touchCenterX * (scale / oldScale - 1); posY -= touchCenterY * (scale / oldScale - 1); apply(); lastDist = dist; } }, { passive: false });
    window.addEventListener('touchend', (e) => { if (e.touches.length < 2) lastDist = null; if (e.touches.length < 1) dragging = false; });
}

function updatePoster() {
    const beforeInput = document.getElementById('poster-image-before');
    const afterInput = document.getElementById('poster-image-after');
    const beforeImgEl = document.getElementById('before-img');
    const afterImgEl = document.getElementById('after-img');
    const nameInput = document.getElementById('poster-name-info');
    const noteInput = document.getElementById('poster-note');
    if (beforeInput && beforeInput.files && beforeInput.files[0]) setSrc(beforeImgEl, beforeInput.files[0]); else if (beforeImgEl) beforeImgEl.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (afterInput && afterInput.files && afterInput.files[0]) setSrc(afterImgEl, afterInput.files[0]); else if (afterImgEl) afterImgEl.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (namePill && nameInput) namePill.textContent = nameInput.value;
    if (noteBox && noteInput) noteBox.textContent = noteInput.value;
    if (namePill) namePill.classList.remove('hidden');
    if (noteBox) noteBox.classList.remove('hidden');
}
// ===========================================================
// 5. Global Constants - Poster Generator DOM Elements
// ... these remain the same ...
const beforeImg = document.getElementById('before-img');
const afterImg = document.getElementById('after-img');
const namePill = document.getElementById('name-pill');
const noteBox = document.getElementById('note-box');
const posterNode = document.getElementById('poster');

if (beforeImg) enableDragZoom(beforeImg);
if (afterImg) enableDragZoom(afterImg);

// ===========================================================
// 6. Utility Functions (General Purpose)
// (Functions: setMode, downloadImage, triggerDownload)
// ... these remain the same ...
function setMode(selectedAppMode) {
    mode = selectedAppMode;
    const coverGen = document.getElementById('cover-generator');
    const posterGen = document.getElementById('poster-generator');
    if (coverGen) coverGen.style.display = mode === 'cover' ? 'block' : 'none';
    if (posterGen) posterGen.style.display = mode === 'poster' ? 'block' : 'none';
    document.querySelectorAll('#mode-select button').forEach(btn => {
        btn.classList.toggle('sticky-active', btn.id === (mode + '-button'));
    });
    if (mode === 'cover') {
        if (document.querySelector('.template-selector') && (document.querySelector('.template-selector').children.length === 0 || !selectedTemplate)) {
            loadCoverTemplates();
        } else if (selectedTemplate) {
            drawCoverCanvas();
        }
    } else if (mode === 'poster') {
        updateColorModeUIVisibility();
    }
}

function downloadImage(type) {
    let canvasToDownload; let filename = "ME-awareness-image.png";
    if (type === 'cover') {
        canvasToDownload = document.getElementById("cover-canvas"); if (!canvasToDownload) { alert("Cover canvas not found."); return; }
        if (selectedTemplate) filename = "ME-" + selectedTemplate.split("/").pop().replace(/\.[^/.]+$/, "") + ".png"; else filename = "ME-profile-image.png";
        triggerDownload(canvasToDownload, filename);
    } else if (type === 'poster') {
        const posterElement = document.getElementById('poster'); if (!posterElement) { alert("Poster element not found."); return; }
        html2canvas(posterElement, { scale: 2, useCORS: true, logging: false, onclone: (clonedDoc) => { const clonedBeforeImg = clonedDoc.getElementById('before-img'); const clonedAfterImg = clonedDoc.getElementById('after-img'); if (beforeImg && clonedBeforeImg) clonedBeforeImg.src = beforeImg.src; if (afterImg && clonedAfterImg) clonedAfterImg.src = afterImg.src; } }).then(canvas => { triggerDownload(canvas, "ME-poster.png"); }).catch(err => { console.error("html2canvas failed:", err); alert("Error generating poster image. Please try again."); });
    } else { alert("Invalid download type."); }
}

function triggerDownload(canvas, filename) {
    const link = document.createElement("a"); link.download = filename;
    if (canvas.toBlob) { canvas.toBlob(blob => { if (blob) { link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); } else { alert("Error creating image blob."); } }, "image/png"); }
    else { try { link.href = canvas.toDataURL("image/png"); link.click(); } catch (e) { alert("Error converting canvas to image."); console.error(e); } }
}
// ===========================================================
// 7. Event Listeners - Cover Generator
// ... these remain the same ...
if (coverCanvas) {
    coverCanvas.addEventListener("mousedown", function (e) { if (!coverImage || !coverDrawnImage.img) return; const rect = coverCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width && y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) { coverDragging = true; coverOffsetX = x - coverDrawnImage.x; coverOffsetY = y - coverDrawnImage.y; } });
    coverCanvas.addEventListener("mousemove", function (e) { if (coverDragging && coverImage) { const rect = coverCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; coverDrawnImage.x = x - coverOffsetX; coverDrawnImage.y = y - coverOffsetY; drawCoverCanvas(); } });
    coverCanvas.addEventListener("mouseup", () => coverDragging = false);
    coverCanvas.addEventListener("mouseleave", () => coverDragging = false);
    coverCanvas.addEventListener("touchstart", function (e) { if (!coverImage || !coverDrawnImage.img) return; const rect = coverCanvas.getBoundingClientRect(); if (e.touches.length === 1) { const touch = e.touches[0]; const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width && y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) { coverDragging = true; coverOffsetX = x - coverDrawnImage.x; coverOffsetY = y - coverDrawnImage.y; e.preventDefault(); } } else if (e.touches.length === 2) { coverDragging = false; const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastTouchDistance = Math.sqrt(dx * dx + dy * dy); e.preventDefault(); } }, { passive: false });
    coverCanvas.addEventListener("touchmove", function (e) { if (!coverImage || !coverDrawnImage.img) return; if (e.touches.length === 1 && coverDragging) { e.preventDefault(); const rect = coverCanvas.getBoundingClientRect(); const touch = e.touches[0]; const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; coverDrawnImage.x = x - coverOffsetX; coverDrawnImage.y = y - coverOffsetY; drawCoverCanvas(); } else if (e.touches.length === 2 && lastTouchDistance !== null) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const distance = Math.sqrt(dx * dx + dy * dy); const zoomChange = distance / lastTouchDistance; const newWidth = coverDrawnImage.width * zoomChange; const newHeight = coverDrawnImage.height * zoomChange; const rect = coverCanvas.getBoundingClientRect(); const t1 = e.touches[0], t2 = e.touches[1]; const pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left; const pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top; const dxZoom = (pinchCenterX - coverDrawnImage.x) * (zoomChange - 1); const dyZoom = (pinchCenterY - coverDrawnImage.y) * (zoomChange - 1); coverDrawnImage.x -= dxZoom; coverDrawnImage.y -= dyZoom; coverDrawnImage.width = newWidth; coverDrawnImage.height = newHeight; drawCoverCanvas(); lastTouchDistance = distance; } }, { passive: false });
    coverCanvas.addEventListener("touchend", function (e) { if (e.touches.length < 1) coverDragging = false; if (e.touches.length < 2) lastTouchDistance = null; });
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload) coverImageUpload.addEventListener("change", function (e) { const file = e.target.files[0]; if (!file) return; const img = new Image(); img.onload = function () { coverImage = img; const canvasWidth = coverCanvas.width; const canvasHeight = coverCanvas.height; const imgAspectRatio = img.width / img.height; const canvasAspectRatio = canvasWidth / canvasHeight; let drawWidth, drawHeight, drawX, drawY; if (imgAspectRatio > canvasAspectRatio) { drawWidth = canvasWidth; drawHeight = drawWidth / imgAspectRatio; } else { drawHeight = canvasHeight; drawWidth = drawHeight * imgAspectRatio; } drawX = (canvasWidth - drawWidth) / 2; drawY = (canvasHeight - drawHeight) / 2; coverDrawnImage = { img: img, x: drawX, y: drawY, width: drawWidth, height: drawHeight }; zoomFactor = 1; drawCoverCanvas(); }; img.onerror = () => { alert("Error loading image."); coverImage = null; }; if (e.target.dataset.previousUrl) URL.revokeObjectURL(e.target.dataset.previousUrl); img.src = URL.createObjectURL(file); e.target.dataset.previousUrl = img.src; });
}
// ===========================================================
// 13. Poster Color Logic & Event Listeners
// ===========================================================

// UPDATED colorPresets ARRAY
const colorPresets = [
  {
    name: "Tiefes Mitternachtsblau",
    background1: "#1A237E", background2: "#283593", text: "#E8EAF6",
    noteBg: "#3949AB", noteText: "#FFFFFF",
    namePillBg: "#C5CAE9", namePillText: "#1A237E"
  },
  {
    name: "Graphit & Silber",
    background1: "#263238", background2: "#37474F", text: "#CFD8DC",
    noteBg: "#455A64", noteText: "#FFFFFF",
    namePillBg: "#B0BEC5", namePillText: "#263238"
  },
  {
    name: "Klassisch Blau",
    background1: "#0068b5", background2: "#3b86c4", text: "#FFFFFF",
    noteBg: "#FFFFFF", noteText: "#333344",
    namePillBg: "#FFFFFF", namePillText: "#333344"
  },
  {
    name: "Sanftes Salbei",
    background1: "#A5D6A7", background2: "#C8E6C9", text: "#2E7D32",
    noteBg: "#FFFFFF", noteText: "#388E3C",
    namePillBg: "#FFFFFF", namePillText: "#1B5E20"
  },
  {
    name: "Warmer Sonnenuntergang",
    background1: "#FF8A65", background2: "#FFAB91", text: "#BF360C",
    noteBg: "#FFFFFF", noteText: "#D84315",
    namePillBg: "#FFFFFF", namePillText: "#BF360C"
  }
];

// SIMPLIFIED AND CORRECTED populatePresets
function populatePresets() {
    const simpleModeDiv = document.getElementById('simple-mode');
    if (!simpleModeDiv) {
        console.error("'simple-mode' div not found for populatePresets.");
        return;
    }

    // Clear the entire content of the simple-mode div
    simpleModeDiv.innerHTML = ''; 

    let presetHtml = ""; // This will hold the HTML for the new radio buttons
    colorPresets.forEach((preset, i) => {
        presetHtml += `<label><input type="radio" name="color-preset" value="${i}" ${i === 0 ? 'checked' : ''}> ${preset.name}</label><br>`;
    });
    
    // Append the new radio buttons
    simpleModeDiv.insertAdjacentHTML('beforeend', presetHtml);

    // Apply the default preset (first one) if we are currently in simple mode
    if (colorPresets.length > 0 && currentPosterColorMode === 'simple') {
        // Ensure the first radio button is indeed checked before applying
        // (it should be by default from the HTML string, but this is an extra check)
        const firstRadio = simpleModeDiv.querySelector('input[name="color-preset"][value="0"]');
        if (firstRadio) {
            firstRadio.checked = true;
        }
        applyPreset(colorPresets[0]);
    }
}

// applyPreset function (should be correct from before)
function applyPreset(preset) {
    if (!posterNode || !preset) return;
    posterNode.style.background = `linear-gradient(to bottom, ${preset.background1}, ${preset.background2})`;
    posterNode.style.color = preset.text;
    ['h1', 'h2', 'blockquote', 'footer'].forEach(sel => {
        const el = posterNode.querySelector(sel); if (el) el.style.color = preset.text;
    });
    if (noteBox) { noteBox.style.backgroundColor = preset.noteBg; noteBox.style.color = preset.noteText; }
    if (namePill) { namePill.style.backgroundColor = preset.namePillBg; namePill.style.color = preset.namePillText; }
}

// applyAdvancedColors function (should be correct from before)
function applyAdvancedColors() {
    if (!posterNode) return;
    const bgColor1 = document.getElementById('bg-color1').value;
    const bgColor2 = document.getElementById('bg-color2').value;
    const textColor = document.getElementById('text-color').value;
    const noteBgColor = document.getElementById('note-bg-color').value;
    const noteTextColor = document.getElementById('note-text-color').value;
    const namePillBgColor = document.getElementById('name-pill-bg-color').value;
    const namePillTextColor = document.getElementById('name-pill-text-color').value;

    posterNode.style.background = `linear-gradient(to bottom, ${bgColor1}, ${bgColor2})`;
    posterNode.style.color = textColor;
    ['h1', 'h2', 'blockquote', 'footer'].forEach(sel => {
        const el = posterNode.querySelector(sel); if (el) el.style.color = textColor;
    });
    if (noteBox) { noteBox.style.backgroundColor = noteBgColor; noteBox.style.color = noteTextColor; }
    if (namePill) { namePill.style.backgroundColor = namePillBgColor; namePill.style.color = namePillTextColor; }
}

// updateColorModeUIVisibility function (should be correct from before - using classList.toggle)
function updateColorModeUIVisibility() {
    const simpleModeDiv = document.getElementById('simple-mode');
    const advancedModeDiv = document.getElementById('advanced-mode');
    const simpleBtn = document.getElementById('color-mode-simple-btn');
    const advancedBtn = document.getElementById('color-mode-advanced-btn');

    if (!simpleModeDiv || !advancedModeDiv || !simpleBtn || !advancedBtn) {
        console.error("Color mode UI elements not found!");
        return;
    }

    const isSimple = currentPosterColorMode === 'simple';
    simpleModeDiv.classList.toggle('hidden', !isSimple);
    advancedModeDiv.classList.toggle('hidden', isSimple);
    // Ensure display style is also set correctly if hidden class isn't enough (though it should be with !important)
    simpleModeDiv.style.display = isSimple ? 'block' : 'none';
    advancedModeDiv.style.display = isSimple ? 'none' : 'block';


    simpleBtn.classList.toggle('sticky-active', isSimple);
    advancedBtn.classList.toggle('sticky-active', !isSimple);

    if (isSimple) {
        const checkedPresetRadio = simpleModeDiv.querySelector('input[name="color-preset"]:checked');
        if (checkedPresetRadio && colorPresets[checkedPresetRadio.value]) {
            applyPreset(colorPresets[checkedPresetRadio.value]);
        } else if (colorPresets.length > 0) {
            applyPreset(colorPresets[0]);
        }
    } else {
        applyAdvancedColors();
    }
}

// DOMContentLoaded (should be mostly correct from before)
document.addEventListener('DOMContentLoaded', () => {
    setMode('cover');

    const posterGenSection = document.getElementById('poster-generator');
    if (posterGenSection) {
        populatePresets();
        updatePoster();

        const simpleBtn = document.getElementById('color-mode-simple-btn');
        const advancedBtn = document.getElementById('color-mode-advanced-btn');

        if (simpleBtn) simpleBtn.addEventListener('click', () => {
            currentPosterColorMode = 'simple';
            updateColorModeUIVisibility();
        });
        if (advancedBtn) advancedBtn.addEventListener('click', () => {
            currentPosterColorMode = 'advanced';
            updateColorModeUIVisibility();
        });

        if (colorPresets.length > 0) {
            const dp = colorPresets[0];
            const advancedColorInputs = {
                'bg-color1': dp.background1, 'bg-color2': dp.background2,
                'text-color': dp.text, 'note-bg-color': dp.noteBg,
                'note-text-color': dp.noteText, 'name-pill-bg-color': dp.namePillBg,
                'name-pill-text-color': dp.namePillText
            };
            for (const id in advancedColorInputs) {
                const inputEl = document.getElementById(id);
                if (inputEl) inputEl.value = advancedColorInputs[id];
            }
        }
        updateColorModeUIVisibility(); // Call to set initial state and apply colors

        ['bg-color1', 'bg-color2', 'text-color', 'note-bg-color', 'note-text-color', 'name-pill-bg-color', 'name-pill-text-color'].forEach(id => {
            const picker = document.getElementById(id);
            if (picker) picker.addEventListener('input', () => {
                if (currentPosterColorMode === 'advanced') applyAdvancedColors();
            });
        });

        const simpleModeDiv = document.getElementById('simple-mode');
        if (simpleModeDiv) simpleModeDiv.addEventListener('change', (event) => {
            if (event.target.name === 'color-preset' && currentPosterColorMode === 'simple') {
                const selectedPreset = colorPresets[event.target.value];
                if (selectedPreset) applyPreset(selectedPreset);
            }
        });

        ['poster-name-info', 'poster-note', 'poster-image-before', 'poster-image-after'].forEach(id => {
            const el = document.getElementById(id);
            const eventType = (el && el.tagName === 'TEXTAREA') || (el && el.type === 'text') ? 'input' : 'change';
            if (el) el.addEventListener(eventType, updatePoster);
        });

        const posterDownloadButton = document.getElementById('poster-download');
        if (posterDownloadButton) posterDownloadButton.addEventListener('click', () => downloadImage('poster'));
    }
});
