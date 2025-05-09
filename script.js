// ===========================================================
// 1. Global Constants & Variables
// ===========================================================
const coverCanvas = document.getElementById("cover-canvas");
const coverCtx = coverCanvas ? coverCanvas.getContext("2d") : null;
let overlayImage = new Image();

let mode = 'cover'; // 'cover' or 'poster'
let currentPosterColorMode = 'simple'; // 'simple' or 'advanced' for poster

// Cover Generator Variables
let coverImage = null;
let coverOffsetX = 0, coverOffsetY = 0;
let coverDragging = false;
let lastTouchDistance = null;
let coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0 };
let selectedTemplate = null;

// Poster Generator DOM Elements (assigned in DOMContentLoaded)
let beforeImg, afterImg, namePill, noteBox, posterNode;

// To store colors from the last simple preset for transferring to advanced mode
let lastAppliedPresetColors = null;

// ===========================================================
// 2. Cover Image Generator Functions
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

function loadCoverTemplates() {
    fetch('assets/templates/cover.json')
        .then(res => {
            if (!res.ok) { console.error(`HTTP error! status: ${res.status} for URL: ${res.url}`); throw new Error(`HTTP error! status: ${res.status}`); }
            return res.json();
        })
        .then(templateObjects => {
            templateObjects.sort((a, b) => a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()));
            const box = document.querySelector('.template-selector');
            if (!box) return;
            box.innerHTML = '';
            templateObjects.forEach(templateObj => {
                const img = document.createElement('img');
                img.src = `assets/templates/profile/${templateObj.filename}`;
                img.className = 'template-thumb';
                img.alt = templateObj.alt; // Assumes templateObjects have 'alt' property
                img.onclick = () => selectCoverTemplate(templateObj.filename);
                box.appendChild(img);
            });
            if (templateObjects.length > 0) {
                const currentSelectedFilename = selectedTemplate;
                const isCurrentSelectedValid = templateObjects.some(obj => obj.filename === currentSelectedFilename);
                if (!selectedTemplate || !isCurrentSelectedValid) {
                    selectCoverTemplate(templateObjects[0].filename);
                } else if (selectedTemplate) { 
                    const currentTemplateSrc = "assets/templates/profile/" + selectedTemplate;
                    if (overlayImage.src !== currentTemplateSrc || !overlayImage.complete) {
                        overlayImage.src = currentTemplateSrc;
                    } else { drawCoverCanvas(); }
                }
            } else if (templateObjects.length === 0) {
                box.innerHTML = '<p>No templates found in cover.json.</p>';
            }
        })
        .catch(error => {
            console.error("Failed to load or process cover templates:", error);
            const box = document.querySelector('.template-selector');
            if (box) box.innerHTML = "<p>Error loading templates. Check console.</p>";
        });
}

function selectCoverTemplate(templateFile) {
    selectedTemplate = templateFile; 
    const newSrc = "assets/templates/profile/" + templateFile;
    if (overlayImage.src !== newSrc || !overlayImage.complete) {
        overlayImage.src = newSrc;
    } else { drawCoverCanvas(); }
}

// ===========================================================
// 3. Poster Generator Utility Functions
// ===========================================================
function setSrc(imgEl, file) {
    if (!imgEl) return;
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
    imgEl.addEventListener('wheel', e => { e.preventDefault(); const r = imgEl.getBoundingClientRect(); const mx = e.clientX-r.left-r.width/2, my = e.clientY-r.top-r.height/2; const d = e.deltaY<0?1.05:0.95, oS=scale; scale=Math.max(0.1,Math.min(10,scale*d)); posX-=mx*(scale/oS-1); posY-=my*(scale/oS-1); apply(); }, {passive:false});
    imgEl.addEventListener('touchstart', e => { if(e.touches.length===1){e.preventDefault();dragging=true;const t=e.touches[0];startX=t.clientX-posX;startY=t.clientY-posY;}else if(e.touches.length===2){e.preventDefault();dragging=false;const [t1,t2]=e.touches;lastDist=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);} }, {passive:false});
    imgEl.addEventListener('touchmove', e => { if(e.touches.length===1&&dragging){e.preventDefault();const t=e.touches[0];posX=t.clientX-startX;posY=t.clientY-startY;apply();}else if(e.touches.length===2&&lastDist){e.preventDefault();const [t1,t2]=e.touches;const d=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);const r=imgEl.getBoundingClientRect();const tcX=(t1.clientX+t2.clientX)/2-r.left-r.width/2;const tcY=(t1.clientY+t2.clientY)/2-r.top-r.height/2;const oS=scale;scale=Math.max(0.1,Math.min(10,scale*d/lastDist));posX-=tcX*(scale/oS-1);posY-=tcY*(scale/oS-1);apply();lastDist=d;} }, {passive:false});
    window.addEventListener('touchend', e => { if(e.touches.length<2)lastDist=null; if(e.touches.length<1)dragging=false; });
}

function updatePoster() {
    const beforeInput = document.getElementById('poster-image-before');
    const afterInput = document.getElementById('poster-image-after');
    const nameInput = document.getElementById('poster-name-info');
    const noteInput = document.getElementById('poster-note');

    if (beforeImg) { 
        if (beforeInput && beforeInput.files && beforeInput.files[0]) {
            setSrc(beforeImg, beforeInput.files[0]);
        } else if (!beforeImg.src || beforeImg.src === window.location.href || beforeImg.src.endsWith("#")) { 
             beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }
    }
    if (afterImg) { 
        if (afterInput && afterInput.files && afterInput.files[0]) {
            setSrc(afterImg, afterInput.files[0]);
        } else if (!afterImg.src || afterImg.src === window.location.href || afterImg.src.endsWith("#")) { 
            afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }
    }

    if (namePill && nameInput) namePill.textContent = nameInput.value;
    if (noteBox && noteInput) noteBox.textContent = noteInput.value;
}

// ===========================================================
// 4. General Utility Functions
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
        const templateSelectorBox = document.querySelector('.template-selector');
        if (templateSelectorBox && (templateSelectorBox.children.length === 0 || !selectedTemplate)) {
            loadCoverTemplates();
        } else if (selectedTemplate) { drawCoverCanvas(); }
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
        html2canvas(posterElement, { scale: 2, useCORS: true, logging: false, allowTaint: true, 
            onclone: (clonedDoc) => {
                const cBefore = clonedDoc.getElementById('before-img'), cAfter = clonedDoc.getElementById('after-img');
                if (beforeImg && cBefore && beforeImg.src) cBefore.src = beforeImg.src; 
                if (afterImg && cAfter && afterImg.src) cAfter.src = afterImg.src;     
            }
        }).then(canvas => triggerDownload(canvas, "ME-poster.png"))
          .catch(err => { console.error("html2canvas failed:", err); alert("Error generating poster image."); });
    } else { alert("Invalid download type."); }
}
function triggerDownload(canvas, filename) { 
    const link = document.createElement("a"); link.download = filename;
    if (canvas.toBlob) { canvas.toBlob(blob => { if (blob) { link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); } else { console.error("Canvas toBlob returned null."); alert("Error creating image blob."); } }, "image/png"); }
    else { try { link.href = canvas.toDataURL("image/png"); link.click(); } catch (e) { console.error("Canvas toDataURL failed:", e); alert("Error converting canvas to image."); } }
}

// ===========================================================
// 5. Cover Generator Event Listeners
// ===========================================================
if (coverCanvas) {
    coverCanvas.addEventListener("mousedown", function (e) { if (!coverImage || !coverDrawnImage.img) return; const r=coverCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top; if (x>=coverDrawnImage.x && x<=coverDrawnImage.x+coverDrawnImage.width && y>=coverDrawnImage.y && y<=coverDrawnImage.y+coverDrawnImage.height) { coverDragging=true; coverOffsetX=x-coverDrawnImage.x; coverOffsetY=y-coverDrawnImage.y; } });
    coverCanvas.addEventListener("mousemove", function (e) { if (coverDragging && coverImage) { const r=coverCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top; coverDrawnImage.x=x-coverOffsetX; coverDrawnImage.y=y-coverOffsetY; drawCoverCanvas(); } });
    coverCanvas.addEventListener("mouseup", () => coverDragging = false);
    coverCanvas.addEventListener("mouseleave", () => coverDragging = false);
    coverCanvas.addEventListener("touchstart", function(e){ if(!coverImage||!coverDrawnImage.img)return; const r=coverCanvas.getBoundingClientRect(); if(e.touches.length===1){const t=e.touches[0],x=t.clientX-r.left,y=t.clientY-r.top; if(x>=coverDrawnImage.x&&x<=coverDrawnImage.x+coverDrawnImage.width&&y>=coverDrawnImage.y&&y<=coverDrawnImage.y+coverDrawnImage.height){coverDragging=true;coverOffsetX=x-coverDrawnImage.x;coverOffsetY=y-coverDrawnImage.y;e.preventDefault();}}else if(e.touches.length===2){coverDragging=false;const [t1,t2]=e.touches;lastTouchDistance=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);e.preventDefault();}}, {passive:false});
    coverCanvas.addEventListener("touchmove", function(e){ if(!coverImage||!coverDrawnImage.img)return; if(e.touches.length===1&&coverDragging){e.preventDefault();const r=coverCanvas.getBoundingClientRect(),t=e.touches[0],x=t.clientX-r.left,y=t.clientY-r.top;coverDrawnImage.x=x-coverOffsetX;coverDrawnImage.y=y-coverOffsetY;drawCoverCanvas();}else if(e.touches.length===2&&lastTouchDistance!==null){e.preventDefault();const [t1,t2]=e.touches;const d=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);const zC=d/lastTouchDistance;const nW=coverDrawnImage.width*zC,nH=coverDrawnImage.height*zC;const r=coverCanvas.getBoundingClientRect(),pcX=((t1.clientX+t2.clientX)/2)-r.left,pcY=((t1.clientY+t2.clientY)/2)-r.top;const dXz=(pcX-coverDrawnImage.x)*(zC-1),dYz=(pcY-coverDrawnImage.y)*(zC-1);coverDrawnImage.x-=dXz;coverDrawnImage.y-=dYz;coverDrawnImage.width=nW;coverDrawnImage.height=nH;drawCoverCanvas();lastTouchDistance=d;}}, {passive:false});
    coverCanvas.addEventListener("touchend", e => { if(e.touches.length<1)coverDragging=false; if(e.touches.length<2)lastTouchDistance=null; });
    const coverImageUpload = document.getElementById("cover-image-upload");
    if(coverImageUpload)coverImageUpload.addEventListener("change",function(e){const f=e.target.files[0];if(!f)return;const i=new Image();i.onload=function(){coverImage=i;const cW=coverCanvas.width,cH=coverCanvas.height;const iAR=i.width/i.height,cAR=cW/cH;let dW,dH,dX,dY;if(iAR>cAR){dW=cW;dH=dW/iAR;}else{dH=cH;dW=dH*iAR;}dX=(cW-dW)/2;dY=(cH-dH)/2;coverDrawnImage={img:i,x:dX,y:dY,width:dW,height:dH};drawCoverCanvas();};i.onerror=()=>{alert("Error loading image.");coverImage=null;};if(e.target.dataset.previousUrl)URL.revokeObjectURL(e.target.dataset.previousUrl);i.src=URL.createObjectURL(f);e.target.dataset.previousUrl=i.src;});
}

// ===========================================================
// 6. Poster Color Logic & Event Listeners
// ===========================================================
const colorPresets = [
  { name: "Tiefes Mitternachtsblau", background1: "1D2025", background2: "#283593", text: "#E8EAF6", noteBg: "#3949AB", noteText: "#FFFFFF", namePillBg: "#C5CAE9", namePillText: "#1A237E" },
  { name: "Klassisch Blau", background1: "#0068b5", background2: "#3b86c4", text: "#FFFFFF", noteBg: "#FFFFFF", noteText: "#333344", namePillBg: "#FFFFFF", namePillText: "#333344" },
  { name: "Graphit & Silber", background1: "#263238", background2: "#37474F", text: "#CFD8DC", noteBg: "#455A64", noteText: "#FFFFFF", namePillBg: "#B0BEC5", namePillText: "#263238" },
  { name: "Sanftes Salbei", background1: "#A5D6A7", background2: "#C8E6C9", text: "#2E7D32", noteBg: "#FFFFFF", noteText: "#388E3C", namePillBg: "#FFFFFF", namePillText: "#1B5E20" },
  { name: "Warmer Sonnenuntergang", background1: "#FF8A65", background2: "#FFAB91", text: "#BF360C", noteBg: "#FFFFFF", noteText: "#D84315", namePillBg: "#FFFFFF", namePillText: "#BF360C" }
];

function populatePresets() {
    const simpleModeDiv = document.getElementById('simple-mode');
    if (!simpleModeDiv) { console.error("'simple-mode' div not found."); return; }
    simpleModeDiv.innerHTML = '';
    let presetHtml = "";
    colorPresets.forEach((preset, i) => {
        presetHtml += `<label><input type="radio" name="color-preset" value="${i}" ${i === 0 ? 'checked' : ''}> ${preset.name}</label><br>`;
    });
    simpleModeDiv.insertAdjacentHTML('beforeend', presetHtml);
}

function applyPreset(preset) {
    if (!posterNode || !preset) return;
    lastAppliedPresetColors = {
        bgColor1: preset.background1, bgColor2: preset.background2, textColor: preset.text,
        namePillBgColor: preset.namePillBg, namePillTextColor: preset.namePillText,
        noteBgColor: preset.noteBg, noteTextColor: preset.noteText
    };
    posterNode.style.background = `linear-gradient(to bottom, ${preset.background1}, ${preset.background2})`;
    posterNode.style.color = preset.text;
    ['h1', 'h2', 'blockquote', '.credit'].forEach(sel => {
        const el = posterNode.querySelector(sel); if (el) el.style.color = preset.text;
    });
    if (noteBox) { noteBox.style.backgroundColor = preset.noteBg; noteBox.style.color = preset.noteText; }
    if (namePill) { namePill.style.backgroundColor = preset.namePillBg; namePill.style.color = preset.namePillText; }
}

function applyAdvancedColors() {
    if (!posterNode) return;
    const c = id => { const el = document.getElementById(id); return el ? el.value : null; };
    
    const bgColor1Val = c('bg-color1'), bgColor2Val = c('bg-color2');
    if(bgColor1Val && bgColor2Val) posterNode.style.background = `linear-gradient(to bottom, ${bgColor1Val}, ${bgColor2Val})`;
    
    const mainTextColorVal = c('text-color');
    if(mainTextColorVal) {
        posterNode.style.color = mainTextColorVal;
        ['h1', 'h2', 'blockquote', '.credit'].forEach(sel => {
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
        // If lastAppliedPresetColors is available and we are switching to simple,
        // try to find a matching preset to check its radio button.
        // This makes the UI consistent if user toggles Simple -> Advanced -> Simple.
        if(lastAppliedPresetColors) {
            const matchingPresetIndex = colorPresets.findIndex(p => 
                p.background1 === lastAppliedPresetColors.bgColor1 &&
                p.background2 === lastAppliedPresetColors.bgColor2 &&
                p.text === lastAppliedPresetColors.textColor // Add more checks if needed for uniqueness
            );
            if (matchingPresetIndex !== -1) {
                presetToApply = colorPresets[matchingPresetIndex];
                const radioToSelect = simpleModeDiv.querySelector(`input[name="color-preset"][value="${matchingPresetIndex}"]`);
                if (radioToSelect) radioToSelect.checked = true;
            }
        }
        if (presetToApply) {
            applyPreset(presetToApply);
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
                // Only update if the value is different, to avoid unnecessary event dispatches
                if (inputEl && lastAppliedPresetColors[propName] !== undefined && inputEl.value !== lastAppliedPresetColors[propName]) {
                    inputEl.value = lastAppliedPresetColors[propName];
                    inputEl.dispatchEvent(new Event('input', { bubbles: true })); // For native pickers to reflect change
                }
            }
        }
        applyAdvancedColors(); // Apply whatever is in the advanced pickers
    }
}

// ===========================================================
// 7. DOMContentLoaded - Main Initialization
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
    beforeImg = document.getElementById('before-img');
    afterImg = document.getElementById('after-img');
    namePill = document.getElementById('name-pill');
    noteBox = document.getElementById('note-box');
    posterNode = document.getElementById('poster');

    if (beforeImg) enableDragZoom(beforeImg);
    if (afterImg) enableDragZoom(afterImg);

    setMode('cover'); // Initialize mode

    const posterGenSection = document.getElementById('poster-generator');
    if (posterGenSection) {
        populatePresets(); // Populates radio buttons

        // Set initial values for advanced pickers AND initialize lastAppliedPresetColors
        // This must happen BEFORE the first call to updateColorModeUIVisibility
        // which might apply these if starting in advanced mode (though we default to simple).
        if (colorPresets.length > 0) {
            const dp = colorPresets[0]; 
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
                    // NO event dispatch here - updateColorModeUIVisibility will handle applying colors
                }
            }
        }
        
        updatePoster(); // Sets initial text for name/note

        const simpleBtn = document.getElementById('color-mode-simple-btn');
        const advancedBtn = document.getElementById('color-mode-advanced-btn');
        if (simpleBtn) simpleBtn.addEventListener('click', () => { currentPosterColorMode = 'simple'; updateColorModeUIVisibility(); });
        if (advancedBtn) advancedBtn.addEventListener('click', () => { currentPosterColorMode = 'advanced'; updateColorModeUIVisibility(); });
        
        // Add event listeners for NATIVE color pickers
        const advancedColorPickerSelector = '#advanced-mode.color-options .color-picker-row input[type="color"]';
        document.querySelectorAll(advancedColorPickerSelector).forEach(picker => {
            picker.addEventListener('input', () => { 
                if (currentPosterColorMode === 'advanced') {
                    applyAdvancedColors();
                }
            });
        });
        
        updateColorModeUIVisibility(); // Crucial call to set initial UI (simple mode) and apply its colors

        const simpleModeDiv = document.getElementById('simple-mode');
        if (simpleModeDiv) simpleModeDiv.addEventListener('change', (event) => {
            if (event.target.name === 'color-preset' && currentPosterColorMode === 'simple') {
                const selectedPreset = colorPresets[event.target.value];
                if (selectedPreset) applyPreset(selectedPreset); // applyPreset updates lastAppliedPresetColors
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
