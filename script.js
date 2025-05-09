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
let selectedTemplate = null; // Stores only the filename string for cover templates
// let zoomFactor = 1; // Not actively used by current cover zoom logic

// Poster Generator DOM Elements (will be assigned in DOMContentLoaded)
let beforeImg, afterImg, namePill, noteBox, posterNode;

// NEW: To store colors from the last simple preset
let lastAppliedPresetColors = null;

// ===========================================================
// 3. Cover Image Generator Functions
// ===========================================================
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

function loadCoverTemplates() { // Assumes cover.json is an array of filename STRINGS
    fetch('assets/templates/cover.json')
        .then(res => {
            if (!res.ok) { console.error(`Cover Templates: HTTP error! status: ${res.status} for URL: ${res.url}`); throw new Error(`HTTP error! status: ${res.status}`); }
            return res.json();
        })
        .then(filenames => { 
            if (!Array.isArray(filenames)) {
                console.error("Cover Templates: Data from cover.json is not an array of filenames.", filenames);
                const box = document.querySelector('.template-selector');
                if (box) box.innerHTML = "<p>Error: Template data format incorrect.</p>";
                return;
            }
            filenames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            const box = document.querySelector('.template-selector');
            if (!box) { console.error("Cover Templates: .template-selector div not found."); return; }
            box.innerHTML = '';
            filenames.forEach(filename => {
                if (typeof filename !== 'string' || filename.trim() === '') { console.warn("Cover Templates: Skipping invalid filename:", filename); return; }
                const img = document.createElement('img');
                img.src = `assets/templates/profile/${filename}`;
                img.className = 'template-thumb';
                img.alt = `Vorlage: ${filename.substring(0, filename.lastIndexOf('.')) || filename}`;
                img.onclick = () => selectCoverTemplate(filename);
                img.onerror = () => { console.error(`Cover Templates: Failed to load: ${img.src}`); img.style.border = "2px dashed red"; };
                box.appendChild(img);
            });
            if (filenames.length > 0) {
                const isCurrentSelectedStillValid = selectedTemplate && filenames.includes(selectedTemplate);
                if (!selectedTemplate || !isCurrentSelectedStillValid) {
                    selectCoverTemplate(filenames[0]);
                } else { selectCoverTemplate(selectedTemplate); }
            } else { box.innerHTML = '<p>No cover templates found.</p>'; }
        })
        .catch(error => {
            console.error("Cover Templates: Failed to load/process cover.json:", error);
            const box = document.querySelector('.template-selector');
            if (box) box.innerHTML = "<p>Error loading cover templates. Check console.</p>";
        });
}

function selectCoverTemplate(templateFile) {
    if (!templateFile || typeof templateFile !== 'string') { console.error("selectCoverTemplate: Invalid filename.", templateFile); return; }
    selectedTemplate = templateFile;
    const newSrc = `assets/templates/profile/${templateFile}`;
    if (overlayImage.src !== newSrc || !overlayImage.complete) {
        overlayImage.src = newSrc;
    } else { drawCoverCanvas(); }
}
// ===========================================================
// 4. Poster Generator Functions
// ===========================================================
function setSrc(imgEl, file) {
    if(!imgEl) return;
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
    imgEl.style.cursor = 'grab'; apply();
    imgEl.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; startX = e.clientX - posX; startY = e.clientY - posY; imgEl.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; posX = e.clientX - startX; posY = e.clientY - startY; apply(); });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; imgEl.style.cursor = 'grab'; } });
    imgEl.addEventListener('wheel', e => { e.preventDefault(); const r=imgEl.getBoundingClientRect(); const mx=e.clientX-r.left-r.width/2,my=e.clientY-r.top-r.height/2; const d=e.deltaY<0?1.05:0.95,oS=scale; scale=Math.max(0.1,Math.min(10,scale*d));posX-=mx*(scale/oS-1);posY-=my*(scale/oS-1);apply();},{passive:false});
    imgEl.addEventListener('touchstart', e => {if(e.touches.length===1){e.preventDefault();dragging=true;const t=e.touches[0];startX=t.clientX-posX;startY=t.clientY-posY;}else if(e.touches.length===2){e.preventDefault();dragging=false;const [t1,t2]=e.touches;lastDist=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);}},{passive:false});
    imgEl.addEventListener('touchmove', e => {if(e.touches.length===1&&dragging){e.preventDefault();const t=e.touches[0];posX=t.clientX-startX;posY=t.clientY-startY;apply();}else if(e.touches.length===2&&lastDist){e.preventDefault();const [t1,t2]=e.touches;const d=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);const r=imgEl.getBoundingClientRect();const tcX=(t1.clientX+t2.clientX)/2-r.left-r.width/2,tcY=(t1.clientY+t2.clientY)/2-r.top-r.height/2;const oS=scale;scale=Math.max(0.1,Math.min(10,scale*d/lastDist));posX-=tcX*(scale/oS-1);posY-=tcY*(scale/oS-1);apply();lastDist=d;}},{passive:false});
    window.addEventListener('touchend', e => {if(e.touches.length<2)lastDist=null;if(e.touches.length<1)dragging=false;});
}

function updatePoster() {
    const beforeInput = document.getElementById('poster-image-before');
    const afterInput = document.getElementById('poster-image-after');
    // Renamed beforeImgEl/afterImgEl to beforeImg/afterImg to match global vars
    const nameInput = document.getElementById('poster-name-info');
    const noteInput = document.getElementById('poster-note');

    if (beforeImg) {
        if (beforeInput && beforeInput.files && beforeInput.files[0]) setSrc(beforeImg, beforeInput.files[0]);
        else if (!beforeImg.src || beforeImg.src === window.location.href || beforeImg.src.endsWith("#")) beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
    if (afterImg) {
        if (afterInput && afterInput.files && afterInput.files[0]) setSrc(afterImg, afterInput.files[0]);
        else if (!afterImg.src || afterImg.src === window.location.href || afterImg.src.endsWith("#")) afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }

    if (namePill && nameInput) namePill.textContent = nameInput.value;
    if (noteBox && noteInput) noteBox.textContent = noteInput.value;
    // These were removed as per earlier request to always show them
    // if (namePill) namePill.classList.remove('hidden');
    // if (noteBox) noteBox.classList.remove('hidden');
}

// ===========================================================
// 5. Utility Functions (General Purpose)
// ===========================================================
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
        const tsBox = document.querySelector('.template-selector');
        if (tsBox && (tsBox.children.length === 0 || !selectedTemplate)) {
            loadCoverTemplates();
        } else if (selectedTemplate) {
            selectCoverTemplate(selectedTemplate); // Ensure overlay is correctly applied
        }
    } else if (mode === 'poster') {
        updateColorModeUIVisibility();
    }
}

function downloadImage(type) {
    let filename = "ME-awareness-image.png";
    if (type === 'cover') {
        const canvasToDownload = document.getElementById("cover-canvas"); if (!canvasToDownload) { alert("Cover canvas not found."); return; }
        if (selectedTemplate) filename = "ME-" + selectedTemplate.split("/").pop().replace(/\.[^/.]+$/, "") + ".png"; else filename = "ME-profile-image.png";
        triggerDownload(canvasToDownload, filename);
    } else if (type === 'poster') {
        const posterElement = document.getElementById('poster'); if (!posterElement) { alert("Poster element not found."); return; }
        html2canvas(posterElement, { scale: 2, useCORS: true, logging: false, allowTaint: true, onclone: (clonedDoc) => { const cB = clonedDoc.getElementById('before-img'), cA = clonedDoc.getElementById('after-img'); if (beforeImg&&cB&&beforeImg.src) cB.src=beforeImg.src; if(afterImg&&cA&&afterImg.src)cA.src=afterImg.src;} }).then(canvas => triggerDownload(canvas, "ME-poster.png")).catch(err => { console.error("html2canvas failed:", err); alert("Error generating poster image."); });
    } else { alert("Invalid download type."); }
}

function triggerDownload(canvas, filename) {
    const link = document.createElement("a"); link.download = filename;
    if (canvas.toBlob) { canvas.toBlob(blob => { if (blob) { link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); } else { console.error("Canvas toBlob returned null."); alert("Error creating image blob."); } }, "image/png"); }
    else { try { link.href = canvas.toDataURL("image/png"); link.click(); } catch (e) { console.error("Canvas toDataURL failed:", e); alert("Error converting canvas to image."); } }
}

// ===========================================================
// 6. Event Listeners - Cover Generator (Included from your last full script)
// ===========================================================
if (coverCanvas) {
    coverCanvas.addEventListener("mousedown", function (e) { if (!coverImage || !coverDrawnImage.img) return; const rect = coverCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width && y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) { coverDragging = true; coverOffsetX = x - coverDrawnImage.x; coverOffsetY = y - coverDrawnImage.y; } });
    coverCanvas.addEventListener("mousemove", function (e) { if (coverDragging && coverImage) { const rect = coverCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; coverDrawnImage.x = x - coverOffsetX; coverDrawnImage.y = y - coverOffsetY; drawCoverCanvas(); } });
    coverCanvas.addEventListener("mouseup", () => coverDragging = false);
    coverCanvas.addEventListener("mouseleave", () => coverDragging = false);
    coverCanvas.addEventListener("touchstart", function (e) { if (!coverImage || !coverDrawnImage.img) return; const rect = coverCanvas.getBoundingClientRect(); if (e.touches.length === 1) { const touch = e.touches[0]; const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width && y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) { coverDragging = true; coverOffsetX = x - coverDrawnImage.x; coverOffsetY = y - coverDrawnImage.y; e.preventDefault(); } } else if (e.touches.length === 2) { coverDragging = false; const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastTouchDistance = Math.sqrt(dx * dx + dy * dy); e.preventDefault(); } }, { passive: false });
    coverCanvas.addEventListener("touchmove", function (e) { if (!coverImage || !coverDrawnImage.img) return; if (e.touches.length === 1 && coverDragging) { e.preventDefault(); const rect = coverCanvas.getBoundingClientRect(); const touch = e.touches[0]; const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; coverDrawnImage.x = x - coverOffsetX; coverDrawnImage.y = y - coverOffsetY; drawCoverCanvas(); } else if (e.touches.length === 2 && lastTouchDistance !== null) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const distance = Math.sqrt(dx * dx + dy * dy); const zoomChange = distance / lastTouchDistance; const newWidth = coverDrawnImage.width * zoomChange; const newHeight = coverDrawnImage.height * zoomChange; const rect = coverCanvas.getBoundingClientRect(); const t1 = e.touches[0], t2 = e.touches[1]; const pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left; const pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top; const dxZoom = (pinchCenterX - coverDrawnImage.x) * (zoomChange - 1); const dyZoom = (pinchCenterY - coverDrawnImage.y) * (zoomChange - 1); coverDrawnImage.x -= dxZoom; coverDrawnImage.y -= dyZoom; coverDrawnImage.width = newWidth; coverDrawnImage.height = newHeight; drawCoverCanvas(); lastTouchDistance = distance; } }, { passive: false });
    coverCanvas.addEventListener("touchend", function (e) { if (e.touches.length < 1) coverDragging = false; if (e.touches.length < 2) lastTouchDistance = null; });
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload) coverImageUpload.addEventListener("change", function (e) { const file = e.target.files[0]; if (!file) return; const img = new Image(); img.onload = function () { coverImage = img; const canvasWidth = coverCanvas.width; const canvasHeight = coverCanvas.height; const imgAspectRatio = img.width / img.height; const canvasAspectRatio = canvasWidth / canvasHeight; let drawWidth, drawHeight, drawX, drawY; if (imgAspectRatio > canvasAspectRatio) { drawWidth = canvasWidth; drawHeight = drawWidth / imgAspectRatio; } else { drawHeight = canvasHeight; drawWidth = drawHeight * imgAspectRatio; } drawX = (canvasWidth - drawWidth) / 2; drawY = (canvasHeight - drawHeight) / 2; coverDrawnImage = { img: img, x: drawX, y: drawY, width: drawWidth, height: drawHeight }; /* zoomFactor = 1; */ drawCoverCanvas(); }; img.onerror = () => { alert("Error loading image."); coverImage = null; }; if (e.target.dataset.previousUrl) URL.revokeObjectURL(e.target.dataset.previousUrl); img.src = URL.createObjectURL(file); e.target.dataset.previousUrl = img.src; });
}

// ===========================================================
// 7. Poster Color Logic & Event Listeners (Renumbered from 13 to 7)
// ===========================================================
const colorPresets = [ // Using your re-ordered presets
  { name: "Tiefes Mitternachtsblau", background1: "#1A237E", background2: "#1D2025", text: "#E8EAF6", noteBg: "#3949AB", noteText: "#FFFFFF", namePillBg: "#C5CAE9", namePillText: "#1A237E" },
  { name: "Graphit & Silber", background1: "#263238", background2: "#37474F", text: "#CFD8DC", noteBg: "#455A64", noteText: "#FFFFFF", namePillBg: "#B0BEC5", namePillText: "#263238" },
  { name: "Klassisch Blau", background1: "#0068b5", background2: "#3b86c4", text: "#FFFFFF", noteBg: "#FFFFFF", noteText: "#333344", namePillBg: "#FFFFFF", namePillText: "#333344" },
  { name: "Sanftes Salbei", background1: "#A5D6A7", background2: "#C8E6C9", text: "#2E7D32", noteBg: "#FFFFFF", noteText: "#388E3C", namePillBg: "#FFFFFF", namePillText: "#1B5E20" },
  { name: "Warmer Sonnenuntergang", background1: "#FF8A65", background2: "#FFAB91", text: "#BF360C", noteBg: "#FFFFFF", noteText: "#D84315", namePillBg: "#FFFFFF", namePillText: "#BF360C" }
];

function populatePresets() {
    const simpleModeDiv = document.getElementById('simple-mode');
    if (!simpleModeDiv) { console.error("'simple-mode' div not found for populatePresets."); return; }
    simpleModeDiv.innerHTML = ''; 
    let presetHtml = "";
    colorPresets.forEach((preset, i) => {
        presetHtml += `<label><input type="radio" name="color-preset" value="${i}" ${i === 0 ? 'checked' : ''}> ${preset.name}</label><br>`;
    });
    simpleModeDiv.insertAdjacentHTML('beforeend', presetHtml);
}

// MODIFIED applyPreset
function applyPreset(preset) {
    if (!posterNode || !preset) return;
    // Store these colors for potential switch to advanced mode
    lastAppliedPresetColors = {
        bgColor1: preset.background1, bgColor2: preset.background2, textColor: preset.text,
        namePillBgColor: preset.namePillBg, namePillTextColor: preset.namePillText,
        noteBgColor: preset.noteBg, noteTextColor: preset.noteText
    };
    posterNode.style.background = `linear-gradient(to bottom, ${preset.background1}, ${preset.background2})`;
    posterNode.style.color = preset.text;
    ['h1', 'h2', 'blockquote', '.credit'].forEach(sel => { // Assuming '.credit' is used instead of 'footer'
        const el = posterNode.querySelector(sel); if (el) el.style.color = preset.text;
    });
    if (noteBox) { noteBox.style.backgroundColor = preset.noteBg; noteBox.style.color = preset.noteText; }
    if (namePill) { namePill.style.backgroundColor = preset.namePillBg; namePill.style.color = preset.namePillText; }
}

// applyAdvancedColors remains as you provided
function applyAdvancedColors() {
    if (!posterNode) return;
    const c = id => { const el = document.getElementById(id); return el ? el.value : null; }; // Helper from previous good version

    const bgColor1Val = c('bg-color1'), bgColor2Val = c('bg-color2');
    if(bgColor1Val && bgColor2Val) posterNode.style.background = `linear-gradient(to bottom, ${bgColor1Val}, ${bgColor2Val})`;
    
    const mainTextColorVal = c('text-color');
    if(mainTextColorVal) {
        posterNode.style.color = mainTextColorVal;
        ['h1', 'h2', 'blockquote', '.credit'].forEach(sel => { // Assuming '.credit'
            const el = posterNode.querySelector(sel); if (el) el.style.color = mainTextColorVal;
        });
    }
    if (noteBox) { 
        const nbBg = c('note-bg-color'), nbTxt = c('note-text-color');
        if(nbBg !== null) noteBox.style.backgroundColor = nbBg; 
        if(nbTxt !== null) noteBox.style.color = nbTxt; 
    }
    if (namePill) { 
        const npBg = c('name-pill-bg-color'), npTxt = c('name-pill-text-color');
        if(npBg !== null) namePill.style.backgroundColor = npBg; 
        if(npTxt !== null) namePill.style.color = npTxt; 
    }
}


// MODIFIED updateColorModeUIVisibility
function updateColorModeUIVisibility() {
    const simpleModeDiv = document.getElementById('simple-mode');
    const advancedModeDiv = document.getElementById('advanced-mode');
    const simpleBtn = document.getElementById('color-mode-simple-btn');
    const advancedBtn = document.getElementById('color-mode-advanced-btn');
    if (!simpleModeDiv || !advancedModeDiv || !simpleBtn || !advancedBtn) { return; }

    const isSimple = currentPosterColorMode === 'simple';
    simpleModeDiv.classList.toggle('hidden', !isSimple);
    advancedModeDiv.classList.toggle('hidden', isSimple);
    simpleModeDiv.style.display = isSimple ? 'block' : 'none';
    advancedModeDiv.style.display = isSimple ? 'none' : 'block';
    simpleBtn.classList.toggle('sticky-active', isSimple);
    advancedBtn.classList.toggle('sticky-active', !isSimple);

    if (isSimple) {
        const checkedPresetRadio = simpleModeDiv.querySelector('input[name="color-preset"]:checked');
        let presetToApply = colorPresets.length > 0 ? colorPresets[0] : null; 
        if (checkedPresetRadio && colorPresets[checkedPresetRadio.value]) {
            presetToApply = colorPresets[checkedPresetRadio.value];
        }
        // If switching from advanced, try to restore selection based on lastAppliedPresetColors
        if(lastAppliedPresetColors && !checkedPresetRadio) { 
            const matchingPresetIndex = colorPresets.findIndex(p => 
                p.background1 === lastAppliedPresetColors.bgColor1 &&
                p.background2 === lastAppliedPresetColors.bgColor2 &&
                p.text === lastAppliedPresetColors.textColor 
                // Add more properties for a more unique match if necessary
            );
            if (matchingPresetIndex !== -1) {
                presetToApply = colorPresets[matchingPresetIndex];
                const radioToSelect = simpleModeDiv.querySelector(`input[name="color-preset"][value="${matchingPresetIndex}"]`);
                if (radioToSelect) radioToSelect.checked = true;
            }
        }
        if (presetToApply) {
            applyPreset(presetToApply); // This also updates lastAppliedPresetColors
        }
    } else { // Advanced mode
        if (lastAppliedPresetColors) { // If switching from Simple to Advanced, populate advanced pickers
            const inputIdsAndProperties = {
                'bg-color1': 'bgColor1', 'bg-color2': 'bgColor2', 'text-color': 'textColor',
                'name-pill-bg-color': 'namePillBgColor', 'name-pill-text-color': 'namePillTextColor',
                'note-bg-color': 'noteBgColor', 'note-text-color': 'noteTextColor'
            };
            for (const id in inputIdsAndProperties) {
                const inputEl = document.getElementById(id);
                const propName = inputIdsAndProperties[id];
                if (inputEl && lastAppliedPresetColors[propName] !== undefined) {
                    if (inputEl.value !== lastAppliedPresetColors[propName]) {
                        inputEl.value = lastAppliedPresetColors[propName];
                        // Dispatch 'input' event so native pickers might visually update their swatch
                        // if they don't do it automatically on .value change by JS.
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }
        }
        applyAdvancedColors(); // Apply current values from advanced pickers
    }
}

// ===========================================================
// 8. DOMContentLoaded - Main Initialization (Renumbered)
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Assign global DOM elements
    beforeImg = document.getElementById('before-img');
    afterImg = document.getElementById('after-img');
    namePill = document.getElementById('name-pill');
    noteBox = document.getElementById('note-box');
    posterNode = document.getElementById('poster');

    if (beforeImg) enableDragZoom(beforeImg);
    if (afterImg) enableDragZoom(afterImg);

    setMode('cover'); // Initialize default mode

    const posterGenSection = document.getElementById('poster-generator');
    if (posterGenSection) {
        populatePresets(); // Creates radio buttons. Does NOT apply preset here.

        // Set initial values for advanced pickers AND initialize lastAppliedPresetColors
        if (colorPresets.length > 0) {
            const dp = colorPresets[0]; // Use the first preset as the initial source
            lastAppliedPresetColors = {
                bgColor1: dp.background1, bgColor2: dp.background2, textColor: dp.text,
                namePillBgColor: dp.namePillBg, namePillTextColor: dp.namePillText,
                noteBgColor: dp.noteBg, noteTextColor: dp.noteText
            };
            const inputIdsAndProperties = {
                'bg-color1': 'bgColor1', 'bg-color2': 'bgColor2', 'text-color': 'textColor',
                'name-pill-bg-color': 'namePillBgColor', 'name-pill-text-color': 'namePillTextColor',
                'note-bg-color': 'noteBgColor', 'note-text-color': 'noteTextColor'
            };
            for (const id in inputIdsAndProperties) {
                const inputEl = document.getElementById(id);
                const propName = inputIdsAndProperties[id];
                if (inputEl && lastAppliedPresetColors[propName] !== undefined) {
                    inputEl.value = lastAppliedPresetColors[propName];
                    // No need to dispatch 'input' here, updateColorModeUIVisibility will handle
                    // calling applyPreset or applyAdvancedColors which reads these values.
                }
            }
        }
        
        updatePoster(); // Sets initial text for name/note from inputs

        const simpleBtn = document.getElementById('color-mode-simple-btn');
        const advancedBtn = document.getElementById('color-mode-advanced-btn');
        if (simpleBtn) simpleBtn.addEventListener('click', () => { currentPosterColorMode = 'simple'; updateColorModeUIVisibility(); });
        if (advancedBtn) advancedBtn.addEventListener('click', () => { currentPosterColorMode = 'advanced'; updateColorModeUIVisibility(); });
        
        // Add event listeners for NATIVE color pickers in advanced mode
        const advancedColorPickerSelector = '#advanced-mode.color-options .color-picker-row input[type="color"]';
        document.querySelectorAll(advancedColorPickerSelector).forEach(picker => {
            picker.addEventListener('input', () => { 
                if (currentPosterColorMode === 'advanced') {
                    applyAdvancedColors();
                }
            });
        });
        
        // This call is crucial to set the initial visual state (simple mode colors)
        updateColorModeUIVisibility(); 

        const simpleModeDiv = document.getElementById('simple-mode');
        if (simpleModeDiv) simpleModeDiv.addEventListener('change', (event) => {
            if (event.target.name === 'color-preset' && currentPosterColorMode === 'simple') {
                const selectedPreset = colorPresets[event.target.value];
                if (selectedPreset) applyPreset(selectedPreset); // This also updates lastAppliedPresetColors
            }
        });

        ['poster-name-info', 'poster-note', 'poster-image-before', 'poster-image-after'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = (el.tagName === 'TEXTAREA' || el.type === 'text') ? 'input' : 'change';
                el.addEventListener(eventType, updatePoster);
            }
        });

        const posterDownloadButton = document.getElementById('poster-download');
        if (posterDownloadButton) posterDownloadButton.addEventListener('click', () => downloadImage('poster'));
    }
});
