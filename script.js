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
let coverImage = null; // User's uploaded image
let coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0 }; // State of the user's image drawn on canvas
let coverDragging = false;
let coverOffsetX = 0, coverOffsetY = 0; // Offset relative to coverDrawnImage top-left (in canvas pixels)
let lastTouchDistance = null; // For pinch zoom
let selectedTemplate = null; // Stores only the filename string for cover templates

// Poster Generator DOM Elements (will be assigned in DOMContentLoaded)
let beforeImg, afterImg, namePill, noteBox, posterNode;

// NEW: To store colors from the last simple preset or advanced pickers
let lastAppliedPresetColors = null; // Use this to remember colors when switching modes

// ===========================================================
// 3. Cover Image Generator Functions
// ===========================================================
function drawCoverCanvas() {
    if (!coverCtx) return;
    coverCtx.clearRect(0, 0, 1080, 1080);
    if (coverDrawnImage.img) {
        // Draw the user's image based on its current scaled position and dimensions
        coverCtx.drawImage(
            coverDrawnImage.img,
            0, 0, coverDrawnImage.img.width, coverDrawnImage.img.height, // Source rect (entire image)
            coverDrawnImage.x, coverDrawnImage.y, coverDrawnImage.width, coverDrawnImage.height // Destination rect on canvas
        );
    }
    if (overlayImage.complete && overlayImage.src) {
        // Draw the overlay on top, always covering the full canvas
        coverCtx.drawImage(overlayImage, 0, 0, 1080, 1080);
    }
}

overlayImage.onload = function() { drawCoverCanvas(); };
overlayImage.onerror = function() { console.error("Failed to load overlay image: " + overlayImage.src); drawCoverCanvas(); }; // Still draw user image if overlay fails

function loadCoverTemplates() {
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
                // Select the first template initially, or re-select the previously selected one if it still exists
                const isCurrentSelectedStillValid = selectedTemplate && filenames.includes(selectedTemplate);
                if (!selectedTemplate || !isCurrentSelectedStillValid) {
                    selectCoverTemplate(filenames[0]);
                } else {
                   // Re-selecting the current template reloads the overlay
                   selectCoverTemplate(selectedTemplate);
                }
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
    // Update overlay only if the source is different or image wasn't loaded
    if (overlayImage.src !== newSrc || !overlayImage.complete) {
        overlayImage.src = newSrc;
    } else {
        // If source is the same and loaded, just redraw to be safe
        drawCoverCanvas();
    }
}

// Function to get mouse/touch position relative to canvas, scaled to canvas pixels
function getCanvasCoords(clientX, clientY, canvasRect) {
    const scaleX = coverCanvas.width / canvasRect.width;
    const scaleY = coverCanvas.height / canvasRect.height;
    const canvasX = (clientX - canvasRect.left) * scaleX;
    const canvasY = (clientY - canvasRect.top) * scaleY;
    return { x: canvasX, y: canvasY };
}


// ===========================================================
// 4. Poster Generator Functions
// ===========================================================
function setSrc(imgEl, file) {
    if(!imgEl) return;
    // Revoke previous object URL if it exists to prevent memory leaks
    if (imgEl.dataset.objectUrl) {
        URL.revokeObjectURL(imgEl.dataset.objectUrl);
        delete imgEl.dataset.objectUrl; // Clean up the data attribute
    }
    const newUrl = URL.createObjectURL(file);
    imgEl.src = newUrl;
    imgEl.dataset.objectUrl = newUrl; // Store the new object URL
}

function enableDragZoom(imgEl) {
    if (!imgEl) return;
    let scale = 1, posX = 0, posY = 0;
    let startX = 0, startY = 0, dragging = false, lastDist = null;

    // Apply transform style
    const apply = () => {
        imgEl.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
        imgEl.style.transformOrigin = '0 0'; // Ensure transform is relative to the top-left of the element itself
    };

    // Initial style and state
    imgEl.style.cursor = 'grab';
    apply(); // Apply initial transform (translate 0,0 scale 1)

    // Mouse events
    imgEl.addEventListener('mousedown', e => {
        e.preventDefault(); // Prevent default drag behavior
        dragging = true;
        // Calculate offset relative to the image element's top-left
        const rect = imgEl.getBoundingClientRect();
        startX = e.clientX - rect.left - posX; // Store start position relative to the *transformed* image origin
        startY = e.clientY - rect.top - posY;
        imgEl.style.cursor = 'grabbing';
    });

    // Use window for mousemove and mouseup to handle drags outside the image element
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        // Calculate new position relative to the image element's container (photo-frame)
        posX = e.clientX - imgEl.parentElement.getBoundingClientRect().left - startX;
        posY = e.clientY - imgEl.parentElement.getBoundingClientRect().top - startY;
        apply();
    });

    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            imgEl.style.cursor = 'grab';
        }
    });

    // Wheel event for zooming
    imgEl.addEventListener('wheel', e => {
        e.preventDefault(); // Prevent page scroll
        const rect = imgEl.getBoundingClientRect();
        // Mouse position relative to the image element's top-left (post-transform)
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleChange = e.deltaY < 0 ? 1.1 : 0.9; // Zoom factor
        const newScale = Math.max(0.1, Math.min(10, scale * scaleChange)); // Limit scale between 0.1 and 10

        // Adjust position to keep the mouse cursor point fixed relative to the image content
        posX -= (mouseX / scale) * (newScale - scale);
        posY -= (mouseY / scale) * (newScale - scale);

        scale = newScale;
        apply();
    }, { passive: false }); // Use passive: false to allow preventDefault

    // Touch events
    imgEl.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            e.preventDefault(); // Prevent scrolling/default behavior
            dragging = true;
            const touch = e.touches[0];
             const rect = imgEl.getBoundingClientRect();
            // Store start position relative to the *transformed* image origin
            startX = touch.clientX - rect.left - posX;
            startY = touch.clientY - rect.top - posY;
            lastDist = null; // Reset pinch distance on single touch
        } else if (e.touches.length === 2) {
            e.preventDefault(); // Prevent scrolling/default behavior
            dragging = false; // Stop dragging if two fingers are down
            const [t1, t2] = e.touches;
            // Calculate initial distance between fingers
            lastDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        }
    }, { passive: false });

    imgEl.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && dragging) {
            e.preventDefault(); // Prevent scrolling/default behavior
            const touch = e.touches[0];
            // Calculate new position relative to the image element's container
             posX = touch.clientX - imgEl.parentElement.getBoundingClientRect().left - startX;
             posY = touch.clientY - imgEl.parentElement.getBoundingClientRect().top - startY;
            apply();
        } else if (e.touches.length === 2 && lastDist !== null) {
            e.preventDefault(); // Prevent scrolling/default behavior
            const [t1, t2] = e.touches;
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const scaleChange = distance / lastDist;
            const newScale = Math.max(0.1, Math.min(10, scale * scaleChange));

            const rect = imgEl.getBoundingClientRect();
             // Pinch center relative to the image element's top-left (post-transform)
            const pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
            const pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;

            // Adjust position to keep the pinch center fixed relative to the image content
            posX -= (pinchCenterX / scale) * (newScale - scale);
            posY -= (pinchCenterY / scale) * (newScale - scale);

            scale = newScale;
            lastDist = distance; // Update last distance
            apply();
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        // Reset touch state when touches end
        if (e.touches.length < 2) {
            lastDist = null;
        }
        if (e.touches.length < 1) {
            dragging = false;
             // No need to reset cursor for touch, but could if desired
        }
    });
}


function updatePoster() {
    const beforeInput = document.getElementById('poster-image-before');
    const afterInput = document.getElementById('poster-image-after');
    const nameInput = document.getElementById('poster-name-info');
    const noteInput = document.getElementById('poster-note');
    const tagAfterEl = posterNode ? posterNode.querySelector('.photo-frame.after .tag') : null; // Get the "HEUTE 2025" tag element

    if (beforeImg) {
        if (beforeInput && beforeInput.files && beforeInput.files[0]) setSrc(beforeImg, beforeInput.files[0]);
        // Use a transparent pixel placeholder if no image is set
        else if (!beforeImg.src || beforeImg.src.startsWith("data:,")) beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
    if (afterImg) {
        if (afterInput && afterInput.files && afterInput.files[0]) setSrc(afterImg, afterInput.files[0]);
         // Use a transparent pixel placeholder if no image is set
        else if (!afterImg.src || afterImg.src.startsWith("data:,")) afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }

    if (namePill && nameInput) namePill.textContent = nameInput.value.trim(); // Trim whitespace
    if (noteBox && noteInput) noteBox.textContent = noteInput.value.trim(); // Trim whitespace

    // Update the year in the "HEUTE" tag
    if (tagAfterEl) {
        const currentYear = new Date().getFullYear();
        tagAfterEl.textContent = `HEUTE ${currentYear}`;
    }
}


// ===========================================================
// 5. Utility Functions (General Purpose)
// ===========================================================
function setMode(selectedAppMode) {
    mode = selectedAppMode;
    const coverGen = document.getElementById('cover-generator');
    const posterGen = document.getElementById('poster-generator');

    // Hide both first
    if (coverGen) coverGen.style.display = 'none';
    if (posterGen) posterGen.style.display = 'none';

    // Show the selected one
    if (mode === 'cover' && coverGen) {
        coverGen.style.display = 'block';
        // Load templates if not already loaded or if the selector is empty
        const tsBox = document.querySelector('#cover-generator .template-selector');
        if (tsBox && (tsBox.children.length === 0 || !selectedTemplate)) {
             loadCoverTemplates();
        } else if (selectedTemplate) {
             // Ensure overlay is correctly applied if templates were loaded but mode switched away/back
             selectCoverTemplate(selectedTemplate);
        }
    } else if (mode === 'poster' && posterGen) {
        posterGen.style.display = 'block';
         // Ensure poster state is updated when switching to it
        updatePoster();
        updateColorModeUIVisibility(); // Ensure correct color UI is shown
    }

    // Update button active state
    document.querySelectorAll('#mode-select button').forEach(btn => {
        btn.classList.toggle('sticky-active', btn.id === (mode + '-button'));
    });
}

function downloadImage(type) {
    let filename = "ME-awareness-image.png";
    if (type === 'cover') {
        const canvasToDownload = document.getElementById("cover-canvas");
        if (!canvasToDownload) { alert("Cover canvas not found."); return; }
        if (selectedTemplate) filename = "ME-" + selectedTemplate.split("/").pop().replace(/\.[^/.]+$/, "") + ".png"; else filename = "ME-profile-image.png";
        triggerDownload(canvasToDownload, filename);
    } else if (type === 'poster') {
        const posterElement = document.getElementById('poster');
         // Get the current computed style of the element to include in the canvas
        const computedStyle = getComputedStyle(posterElement);

        if (!posterElement) { alert("Poster element not found."); return; }

        // html2canvas requires the element to be visible in the DOM, but the preview
        // might be scaled down. We need to capture it at its intended resolution.
        // The CSS scales it down using transform. html2canvas captures the *transformed*
        // state unless you handle scaling explicitly.
        // A better approach is to capture the element *before* the wrapper's scale transform
        // is applied, or scale html2canvas output appropriately.
        // Let's try capturing the `poster` element directly and use html2canvas's `scale` option.
        // The CSS `width: 100%; height: 100%` on #poster inside .poster-wrapper, combined
        // with the wrapper's scaling, means #poster *itself* is not at the target 1080x1350
        // resolution in the DOM layout tree when displayed scaled.

        // A robust way: Temporarily apply the full 1080x1350 size to the element
        // or its container for capture, then revert. Or, calculate the required scale
        // for html2canvas based on the desired output size (1080x1350) and the
        // actual rendered size of the #poster element *before* the wrapper scale.

        // Let's inspect the current rendered size of #poster BEFORE the wrapper scale.
        // In the DOM, #poster has width/height 100%, but inside the scaled .poster-wrapper,
        // its clientWidth/clientHeight will be small.
        // The target capture size is 1080x1350. The current #poster CSS size (before wrapper scale)
        // is relative to its parent. Let's target scale 2 relative to the rendered size,
        // as done currently, and hope it's close enough or the CSS isn't scaling it down too much.

        // html2canvas clone function to handle images potentially not loaded yet
        const oncloneHandler = (clonedDoc) => {
            const clonedBeforeImg = clonedDoc.getElementById('before-img');
            const clonedAfterImg = clonedDoc.getElementById('after-img');
            // Ensure the cloned images have the same src as the originals
            if (beforeImg && clonedBeforeImg && beforeImg.src) clonedBeforeImg.src = beforeImg.src;
            if (afterImg && clonedAfterImg && afterImg.src) clonedAfterImg.src = afterImg.src;

            // Re-apply the transform styles to the cloned images
            // html2canvas might not capture complex transforms perfectly or might
            // apply them differently. Copying the exact transform style might help.
             if (beforeImg && clonedBeforeImg && beforeImg.style.transform) {
                clonedBeforeImg.style.transform = beforeImg.style.transform;
                clonedBeforeImg.style.transformOrigin = beforeImg.style.transformOrigin;
            }
             if (afterImg && clonedAfterImg && afterImg.style.transform) {
                clonedAfterImg.style.transform = afterImg.style.transform;
                 clonedAfterImg.style.transformOrigin = afterImg.style.transformOrigin;
            }

            // Copy computed styles for background gradients etc. might be needed
            // if html2canvas doesn't pick them up, but it usually does.
             const originalPosterStyle = getComputedStyle(posterElement);
             const clonedPosterEl = clonedDoc.getElementById('poster');
             if (clonedPosterEl) {
                 clonedPosterEl.style.background = originalPosterStyle.background;
                 clonedPosterEl.style.color = originalPosterStyle.color; // Apply text color to root
                 // Copy individual element colors if they are set directly on elements
                 // (applyAdvancedColors and applyPreset do this)
                 clonedDoc.getElementById('name-pill').style.backgroundColor = getComputedStyle(namePill).backgroundColor;
                 clonedDoc.getElementById('name-pill').style.color = getComputedStyle(namePill).color;
                 clonedDoc.getElementById('note-box').style.backgroundColor = getComputedStyle(noteBox).backgroundColor;
                 clonedDoc.getElementById('note-box').style.color = getComputedStyle(noteBox).color;

                 // Apply text colors to headers, blockquote, credit if they override root color
                 // The current applyPreset/advanced sets these directly, so copy those too.
                 const elementsToColor = clonedPosterEl.querySelectorAll('h1, h2, blockquote, .credit, .tag'); // Include tag
                 elementsToColor.forEach(el => {
                     const originalEl = posterElement.querySelector(`.${el.className.split(' ')[0]}`) || posterElement.querySelector(el.tagName.toLowerCase()); // Find original element
                     if (originalEl) {
                          el.style.color = getComputedStyle(originalEl).color;
                     }
                 });
                  // Tags have background
                 clonedPosterEl.querySelectorAll('.tag').forEach(el => {
                      const originalEl = posterElement.querySelector('.tag');
                      if(originalEl) {
                           el.style.backgroundColor = getComputedStyle(originalEl).backgroundColor;
                      }
                 });

             }

        };

        html2canvas(posterElement, {
            scale: 2, // Capture at 2x resolution of the *rendered* size
            useCORS: true,
            logging: false,
            allowTaint: true, // Might need to allow taint if cross-origin images are used without CORS headers
            onclone: oncloneHandler,
            width: posterElement.offsetWidth, // Capture the element's rendered size
            height: posterElement.offsetHeight // Capture the element's rendered size
        })
        .then(canvas => {
             // html2canvas with scale:2 gives a canvas that's 2x the rendered dimensions.
             // We want a fixed 1080x1350 output.
             // Check the rendered size of the poster element *before* html2canvas captures it.
             // The CSS media query sets the wrapper width to 540px at >= 600px breakpoint.
             // Inside that, the #poster element is width: 100% height: 100% and aspect-ratio.
             // So, the rendered size of #poster *should* be 540px wide at that breakpoint,
             // or calc(90vw) below it.
             // The target output is 1080x1350. 1080 / 540 = 2. 1350 / (540 * 1350/1080) = 1350 / 675 = 2.
             // So scale: 2 relative to the *expected* rendered size (540px wide) should produce
             // a 1080px wide output. The height should also scale proportionally.

            // If the generated canvas isn't exactly 1080x1350 (due to screen size or other factors),
            // we might need to create a new canvas and draw the generated one onto it scaled.
            const targetWidth = 1080;
            const targetHeight = 1350; // 1080 * (1350/1080)

            if (canvas.width === targetWidth && canvas.height === targetHeight) {
                 // If html2canvas gave us the correct size directly
                 triggerDownload(canvas, "ME-poster.png");
            } else {
                // Otherwise, create a new canvas and scale the output onto it
                console.warn(`html2canvas output size mismatch: ${canvas.width}x${canvas.height}. Rescaling to ${targetWidth}x${targetHeight}.`);
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                const finalCtx = finalCanvas.getContext('2d');
                finalCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
                triggerDownload(finalCanvas, "ME-poster.png");
            }
        })
        .catch(err => {
            console.error("html2canvas failed:", err);
            alert("Error generating poster image. See console for details.");
        });
    } else { alert("Invalid download type."); }
}

function triggerDownload(canvas, filename) {
    const link = document.createElement("a");
    link.download = filename;
    // Use toBlob for potentially better performance and memory handling
    if (canvas.toBlob) {
        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.click();
                // Clean up the object URL
                URL.revokeObjectURL(url);
            } else {
                console.error("Canvas toBlob returned null.");
                alert("Error creating image blob for download.");
            }
        }, "image/png");
    } else {
        // Fallback for browsers that don't support toBlob
        try {
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (e) {
            console.error("Canvas toDataURL failed:", e);
            alert("Error converting canvas to image for download.");
        }
    }
}

// ===========================================================
// 6. Event Listeners - Cover Generator (Modified)
// ===========================================================
if (coverCanvas) {
    // Mouse Events
    coverCanvas.addEventListener("mousedown", function (e) {
        if (!coverImage || !coverDrawnImage.img) return;
        const rect = coverCanvas.getBoundingClientRect();
        const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect);
        const x = canvasCoords.x;
        const y = canvasCoords.y;

        // Check if click is within the drawn image bounds (in canvas pixels)
        if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
            y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) {
            coverDragging = true;
            // Calculate offset in canvas pixels
            coverOffsetX = x - coverDrawnImage.x;
            coverOffsetY = y - coverDrawnImage.y;
            // Optional: Change cursor style
            coverCanvas.style.cursor = 'grabbing';
        }
    });

    coverCanvas.addEventListener("mousemove", function (e) {
        if (coverDragging && coverImage) {
            const rect = coverCanvas.getBoundingClientRect();
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect);
            // Update image position in canvas pixels
            coverDrawnImage.x = canvasCoords.x - coverOffsetX;
            coverDrawnImage.y = canvasCoords.y - coverOffsetY;
            drawCoverCanvas();
        }
    });

    coverCanvas.addEventListener("mouseup", () => {
        coverDragging = false;
         coverCanvas.style.cursor = coverImage ? 'grab' : 'default'; // Reset cursor
    });

    coverCanvas.addEventListener("mouseleave", () => {
        // Stop dragging if mouse leaves the canvas area
        coverDragging = false;
         coverCanvas.style.cursor = coverImage ? 'grab' : 'default'; // Reset cursor
    });

    // Mouse Wheel Zoom (NEW)
     coverCanvas.addEventListener("wheel", function (e) {
         if (!coverImage || !coverDrawnImage.img) return;
         e.preventDefault(); // Prevent page scroll

         const rect = coverCanvas.getBoundingClientRect();
         const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect);
         const mouseCanvasX = canvasCoords.x;
         const mouseCanvasY = canvasCoords.y;

         const zoomAmount = e.deltaY < 0 ? 1.05 : 0.95; // Zoom factor (5% in or out)
         const oldWidth = coverDrawnImage.width;
         const oldHeight = coverDrawnImage.height;

         // Calculate new dimensions
         let newWidth = oldWidth * zoomAmount;
         let newHeight = oldHeight * zoomAmount;

         // Optional: Add zoom limits
         const minScale = 0.1; // Allow scaling down to 10% of original fitted size
         const maxScale = 10; // Allow scaling up to 1000% of original fitted size
         const initialFittedSize = (coverImage.width / coverImage.height > coverCanvas.width / coverCanvas.height)
             ? { width: coverCanvas.width, height: coverCanvas.width / (coverImage.width / coverImage.height) } // Fitted width
             : { width: coverCanvas.height * (coverImage.width / coverImage.height), height: coverCanvas.height }; // Fitted height
         const initialScale = coverDrawnImage.width / initialFittedSize.width; // Current scale relative to the initial 'contain' fit

         let potentialNewScale = initialScale * zoomAmount;
         if (potentialNewScale < minScale) {
             zoomAmount = minScale / initialScale;
             newWidth = oldWidth * zoomAmount;
             newHeight = oldHeight * zoomAmount;
         } else if (potentialNewScale > maxScale) {
              zoomAmount = maxScale / initialScale;
              newWidth = oldWidth * zoomAmount;
              newHeight = oldHeight * zoomAmount;
         }


         // Adjust position to keep the mouse cursor point fixed relative to the image content
         // This formula moves the image's top-left corner (x, y) so that the point at mouseCanvasX, mouseCanvasY
         // relative to the canvas remains at the same relative position *within the image itself* after scaling.
         coverDrawnImage.x -= (mouseCanvasX - coverDrawnImage.x) * (zoomAmount - 1);
         coverDrawnImage.y -= (mouseCanvasY - coverDrawnImage.y) * (zoomAmount - 1);

         coverDrawnImage.width = newWidth;
         coverDrawnImage.height = newHeight;

         drawCoverCanvas();
     }, { passive: false }); // Use passive: false to allow preventDefault


    // Touch Events
    coverCanvas.addEventListener("touchstart", function (e) {
        if (!coverImage || !coverDrawnImage.img) return;

        const rect = coverCanvas.getBoundingClientRect();

        if (e.touches.length === 1) {
            e.preventDefault(); // Prevent default scrolling/gestures
            const touch = e.touches[0];
            const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            // Check if touch is within the drawn image bounds (in canvas pixels)
            if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
                y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) {
                coverDragging = true;
                 // Calculate offset in canvas pixels
                coverOffsetX = x - coverDrawnImage.x;
                coverOffsetY = y - coverDrawnImage.y;
            }
            lastTouchDistance = null; // Reset pinch distance on single touch
        } else if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default scrolling/gestures
            coverDragging = false; // Stop dragging if two fingers are down
            const [t1, t2] = e.touches;
            // Calculate initial distance between fingers (using screen coordinates is fine for ratio)
            lastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        }
    }, { passive: false });

    coverCanvas.addEventListener("touchmove", function (e) {
        if (!coverImage || !coverDrawnImage.img) return;
        const rect = coverCanvas.getBoundingClientRect();

        if (e.touches.length === 1 && coverDragging) {
            e.preventDefault(); // Prevent default scrolling/gestures
            const touch = e.touches[0];
             const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect);
            // Update image position in canvas pixels
            coverDrawnImage.x = canvasCoords.x - coverOffsetX;
            coverDrawnImage.y = canvasCoords.y - coverOffsetY;
            drawCoverCanvas();
        } else if (e.touches.length === 2 && lastTouchDistance !== null) {
            e.preventDefault(); // Prevent default scrolling/gestures
            const [t1, t2] = e.touches;
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); // Current distance (screen coords)
            if (distance === 0) return; // Avoid division by zero

            const zoomChange = distance / lastTouchDistance; // Zoom ratio

            const oldWidth = coverDrawnImage.width;
            const oldHeight = coverDrawnImage.height;

            // Calculate new dimensions
            let newWidth = oldWidth * zoomChange;
            let newHeight = oldHeight * zoomChange;

             // Optional: Add zoom limits (similar logic to mouse wheel)
             const minScale = 0.1;
             const maxScale = 10;
             const initialFittedSize = (coverImage.width / coverImage.height > coverCanvas.width / coverCanvas.height)
                ? { width: coverCanvas.width, height: coverCanvas.width / (coverImage.width / coverImage.height) }
                : { width: coverCanvas.height * (coverImage.width / coverImage.height), height: coverCanvas.height };
            const initialScale = coverDrawnImage.width / initialFittedSize.width; // Current scale relative to initial fit

            let potentialNewScale = initialScale * zoomChange;
            if (potentialNewScale < minScale) {
                zoomChange = minScale / initialScale;
                newWidth = oldWidth * zoomChange;
                newHeight = oldHeight * zoomChange;
            } else if (potentialNewScale > maxScale) {
                 zoomChange = maxScale / initialScale;
                 newWidth = oldWidth * zoomChange;
                 newHeight = oldHeight * zoomChange;
            }


            // Calculate pinch center in canvas pixels
            const pinchCenterX = ((t1.clientX + t2.clientX) / 2 - rect.left) * (coverCanvas.width / rect.width);
            const pinchCenterY = ((t1.clientY + t2.clientY) / 2 - rect.top) * (coverCanvas.height / rect.height);

            // Adjust position to keep the pinch center fixed relative to the image content
            coverDrawnImage.x -= (pinchCenterX - coverDrawnImage.x) * (zoomChange - 1);
            coverDrawnImage.y -= (pinchCenterY - coverDrawnImage.y) * (zoomChange - 1);

            coverDrawnImage.width = newWidth;
            coverDrawnImage.height = newHeight;

            drawCoverCanvas();
            lastTouchDistance = distance; // Update last distance for next move event
        }
    }, { passive: false });

    coverCanvas.addEventListener("touchend", function (e) {
        // Reset touch state
        if (e.touches.length < 1) {
            coverDragging = false;
            coverCanvas.style.cursor = coverImage ? 'grab' : 'default'; // Reset cursor
        }
        if (e.touches.length < 2) {
            lastTouchDistance = null;
        }
    });

    // Image Upload Listener
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload) {
        coverImageUpload.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const img = new Image();
            img.onload = function () {
                coverImage = img; // Store the actual image object
                const canvasWidth = coverCanvas.width;
                const canvasHeight = coverCanvas.height;
                const imgAspectRatio = img.width / img.height;
                const canvasAspectRatio = canvasWidth / canvasHeight;

                let drawWidth, drawHeight, drawX, drawY;

                // Calculate dimensions to 'contain' the image within the canvas
                if (imgAspectRatio > canvasAspectRatio) {
                    // Image is wider than canvas aspect ratio (pillarbox)
                    drawWidth = canvasWidth;
                    drawHeight = drawWidth / imgAspectRatio;
                } else {
                    // Image is taller than canvas aspect ratio (letterbox)
                    drawHeight = canvasHeight;
                    drawWidth = drawHeight * imgAspectRatio;
                }

                // Center the drawn image initially
                drawX = (canvasWidth - drawWidth) / 2;
                drawY = (canvasHeight - drawHeight) / 2;

                // Store the initial drawing state
                coverDrawnImage = { img: img, x: drawX, y: drawY, width: drawWidth, height: drawHeight };

                // Reset drag/zoom state
                coverDragging = false;
                lastTouchDistance = null;
                coverCanvas.style.cursor = 'grab'; // Set cursor to grab now that an image is loaded

                // Draw the initial state
                drawCoverCanvas();
            };

            img.onerror = () => {
                alert("Error loading image.");
                coverImage = null; // Clear the image state
                coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0 }; // Clear drawn state
                 coverCanvas.style.cursor = 'default'; // Reset cursor
                drawCoverCanvas(); // Draw just the overlay
            };

            // Revoke previous object URL before creating a new one to prevent memory leaks
            if (e.target.dataset.previousUrl) {
                 URL.revokeObjectURL(e.target.dataset.previousUrl);
                 delete e.target.dataset.previousUrl; // Clean up the data attribute
            }

            // Load the image using a blob URL
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            e.target.dataset.previousUrl = objectUrl; // Store the new object URL
        });
    }
}

// ===========================================================
// 7. Poster Color Logic & Event Listeners
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
        // Check the first radio button by default if no preset is currently applied/remembered
        const checked = (lastAppliedPresetColors === null && i === 0) ||
                        (lastAppliedPresetColors !== null && preset.background1 === lastAppliedPresetColors.bgColor1 && preset.background2 === lastAppliedPresetColors.bgColor2 && preset.text === lastAppliedPresetColors.textColor /* Add more checks for a unique match */);
        presetHtml += `<label><input type="radio" name="color-preset" value="${i}" ${checked ? 'checked' : ''}> ${preset.name}</label><br>`;
    });
    simpleModeDiv.insertAdjacentHTML('beforeend', presetHtml);
}

function applyPreset(preset) {
    if (!posterNode || !preset) return;
    // Store these colors for potential switch to advanced mode
    lastAppliedPresetColors = {
        bgColor1: preset.background1, bgColor2: preset.background2, textColor: preset.text,
        namePillBgColor: preset.namePillBg, namePillTextColor: preset.namePillText,
        noteBgColor: preset.noteBg, noteTextColor: preset.noteText
    };

    // Apply background gradient
    posterNode.style.background = `linear-gradient(to bottom, ${preset.background1}, ${preset.background2})`;
    // Apply main text color to elements that should inherit or have this specific color
    // The credit class is used, let's apply color to its text content
    const mainTextElements = posterNode.querySelectorAll('h1, h2, blockquote, .credit');
    mainTextElements.forEach(el => { el.style.color = preset.text; });
    // The main .poster-preview div should maybe also get the main text color for inherited properties,
    // but let's apply it specifically to the known elements first.

    if (noteBox) { noteBox.style.backgroundColor = preset.noteBg; noteBox.style.color = preset.noteText; }
    if (namePill) { namePill.style.backgroundColor = preset.namePillBg; namePill.style.color = preset.namePillText; }
    // Apply color to the 'tag' elements (VORHER, HEUTE)
    const tags = posterNode.querySelectorAll('.tag');
     tags.forEach(tag => {
        // The tags often have a solid background derived from the theme,
        // but their text color might also be tied to the main text color or specific tag color.
        // Based on CSS, they currently have a blue background and white text.
        // Let's keep the text color white for tags unless the preset suggests otherwise.
        // The current presets don't define tag color specifically, so we'll leave their CSS color as is,
        // or explicitly set them if needed. For now, rely on CSS defaults/hardcoded styles.
        // Or, if they *should* inherit main text color: tag.style.color = preset.text;
        // Based on the Klassisch Blau preset, tags are #0057a3 background, #fff color.
        // This suggests tags have their own fixed colors, not tied to the main text color.
        // Let's *not* set tag color here unless a preset specifically defines it.
     });

    // Update the color pickers in Advanced mode *without triggering their input events*
    updateAdvancedPickers(lastAppliedPresetColors);
}

// Helper to update advanced pickers without triggering change/input events immediately
function updateAdvancedPickers(colors) {
     if (!colors) return;
     const inputIdsAndProperties = {
        'bg-color1': 'bgColor1', 'bg-color2': 'bgColor2', 'text-color': 'textColor',
        'name-pill-bg-color': 'namePillBgColor', 'name-pill-text-color': 'namePillTextColor',
        'note-bg-color': 'noteBgColor', 'note-text-color': 'noteTextColor'
    };
    for (const id in inputIdsAndProperties) {
        const inputEl = document.getElementById(id);
        const propName = inputIdsAndProperties[id];
        if (inputEl && colors[propName] !== undefined) {
            // Only update if the value is different to avoid unnecessary DOM manipulation / potential event triggers
            if (inputEl.value.toLowerCase() !== colors[propName].toLowerCase()) {
                 inputEl.value = colors[propName];
                 // For some browsers, setting value might not visually update the color swatch.
                 // Dispatching 'input' can help, but only if we don't want it to trigger applyAdvancedColors immediately.
                 // If called from applyPreset (which it is), applyAdvancedColors will be called later by updateColorModeUIVisibility
                 // if switching to advanced, so dispatching 'input' here might not be necessary or desired.
                 // Let's rely on applyAdvancedColors being called after switching mode.
            }
        }
    }
}


function applyAdvancedColors() {
    if (!posterNode) return;
    const c = id => { const el = document.getElementById(id); return el ? el.value : null; };

    const bgColor1Val = c('bg-color1');
    const bgColor2Val = c('bg-color2');
    if(bgColor1Val && bgColor2Val) {
        posterNode.style.background = `linear-gradient(to bottom, ${bgColor1Val}, ${bgColor2Val})`;
        // Store for remembering state
         lastAppliedPresetColors.bgColor1 = bgColor1Val;
         lastAppliedPresetColors.bgColor2 = bgColor2Val;
    }

    const mainTextColorVal = c('text-color');
    if(mainTextColorVal !== null) { // Check against null because value can be ''
         // Apply main text color to elements
        const mainTextElements = posterNode.querySelectorAll('h1, h2, blockquote, .credit');
        mainTextElements.forEach(el => { el.style.color = mainTextColorVal; });
         lastAppliedPresetColors.textColor = mainTextColorVal;
    }

    if (noteBox) {
        const nbBg = c('note-bg-color');
        const nbTxt = c('note-text-color');
        if(nbBg !== null) { noteBox.style.backgroundColor = nbBg; lastAppliedPresetColors.noteBgColor = nbBg; }
        if(nbTxt !== null) { noteBox.style.color = nbTxt; lastAppliedPresetColors.noteText = nbTxt; }
    }
    if (namePill) {
        const npBg = c('name-pill-bg-color');
        const npTxt = c('name-pill-text-color');
        if(npBg !== null) { namePill.style.backgroundColor = npBg; lastAppliedPresetColors.namePillBgColor = npBg; }
        if(npTxt !== null) { namePill.style.color = npTxt; lastAppliedPresetColors.namePillText = npTxt; }
    }

    // Tags colors are hardcoded in CSS for now, don't change them here.
}


function updateColorModeUIVisibility() {
    const simpleModeDiv = document.getElementById('simple-mode');
    const advancedModeDiv = document.getElementById('advanced-mode');
    const simpleBtn = document.getElementById('color-mode-simple-btn');
    const advancedBtn = document.getElementById('color-mode-advanced-btn');
    if (!simpleModeDiv || !advancedModeDiv || !simpleBtn || !advancedBtn) { return; }

    const isSimple = currentPosterColorMode === 'simple';

    // Toggle visibility using class (for CSS display: none) and style (redundant but safe)
    simpleModeDiv.classList.toggle('hidden', !isSimple);
    advancedModeDiv.classList.toggle('hidden', isSimple);
    simpleModeDiv.style.display = isSimple ? 'block' : 'none';
    advancedModeDiv.style.display = isSimple ? 'none' : 'block';

    // Update button active state
    simpleBtn.classList.toggle('sticky-active', isSimple);
    advancedBtn.classList.toggle('sticky-active', !isSimple);

    if (isSimple) {
        // When switching TO simple mode:
        // Find the currently checked preset radio button.
        // If none is checked (e.g., first load, or switched from advanced),
        // apply the first preset *and check its radio button*.
        const checkedPresetRadio = simpleModeDiv.querySelector('input[name="color-preset"]:checked');
        let presetToApply = null;

        if (checkedPresetRadio && colorPresets[checkedPresetRadio.value]) {
            presetToApply = colorPresets[checkedPresetRadio.value];
        } else if (colorPresets.length > 0) {
             // No radio checked, check the first one and apply it
             presetToApply = colorPresets[0];
             const firstRadio = simpleModeDiv.querySelector('input[name="color-preset"][value="0"]');
             if(firstRadio) firstRadio.checked = true;
        }

        if (presetToApply) {
            applyPreset(presetToApply); // Apply the colors and update lastAppliedPresetColors
        } else {
             // Fallback if no presets are defined
            console.warn("No color presets defined.");
        }

    } else { // Advanced mode
        // When switching TO advanced mode:
        // The advanced pickers should already contain the colors from the last applied preset
        // because applyPreset updates lastAppliedPresetColors which updateAdvancedPickers reads from.
        // We just need to apply the colors currently in the pickers.
        // If lastAppliedPresetColors is null (shouldn't happen after init), use defaults.
         if (!lastAppliedPresetColors && colorPresets.length > 0) {
              // Should have been initialized, but as a safeguard
               lastAppliedPresetColors = {
                    bgColor1: colorPresets[0].background1, bgColor2: colorPresets[0].background2, textColor: colorPresets[0].text,
                    namePillBgColor: colorPresets[0].namePillBg, namePillTextColor: colorPresets[0].namePillText,
                    noteBgColor: colorPresets[0].noteBg, noteText: colorPresets[0].noteText
               };
               updateAdvancedPickers(lastAppliedPresetColors); // Ensure pickers are populated
         }
        applyAdvancedColors(); // Apply current values from advanced pickers
    }
}

// ===========================================================
// 8. DOMContentLoaded - Main Initialization
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Assign global DOM elements
    beforeImg = document.getElementById('before-img');
    afterImg = document.getElementById('after-img');
    namePill = document.getElementById('name-pill');
    noteBox = document.getElementById('note-box');
    posterNode = document.getElementById('poster');

    // Apply drag/zoom to poster images
    if (beforeImg) enableDragZoom(beforeImg);
    if (afterImg) enableDragZoom(afterImg);

    // Initialize color state and populate presets
     if (colorPresets.length > 0) {
         // Initialize lastAppliedPresetColors with the first preset's colors
         const initialPreset = colorPresets[0];
         lastAppliedPresetColors = {
            bgColor1: initialPreset.background1, bgColor2: initialPreset.background2, textColor: initialPreset.text,
            namePillBgColor: initialPreset.namePillBg, namePillTextColor: initialPreset.namePillText,
            noteBgColor: initialPreset.noteBg, noteText: initialPreset.noteText
        };
     } else {
         // Fallback if no presets defined
         lastAppliedPresetColors = {
             bgColor1: '#0068b5', bgColor2: '#3b86c4', textColor: '#FFFFFF',
             namePillBgColor: '#FFFFFF', namePillTextColor: '#333344',
             noteBgColor: '#FFFFFF', noteText: '#333344'
         };
         console.warn("No color presets defined, using default fallback colors.");
     }

    populatePresets(); // Create radio buttons based on presets
    updateAdvancedPickers(lastAppliedPresetColors); // Populate advanced pickers with initial/last colors

    // Initialize default mode (this will call loadCoverTemplates or updatePoster/ColorModeUI)
    setMode('cover');

    // Add event listeners for Poster Generator
    const posterGenSection = document.getElementById('poster-generator');
    if (posterGenSection) {

        // Event listeners for mode switch buttons
        const simpleBtn = document.getElementById('color-mode-simple-btn');
        const advancedBtn = document.getElementById('color-mode-advanced-btn');
        if (simpleBtn) simpleBtn.addEventListener('click', () => { currentPosterColorMode = 'simple'; updateColorModeUIVisibility(); });
        if (advancedBtn) advancedBtn.addEventListener('click', () => { currentPosterColorMode = 'advanced'; updateColorModeUIVisibility(); });

        // Event listener for Simple mode radio buttons (using event delegation)
        const simpleModeDiv = document.getElementById('simple-mode');
        if (simpleModeDiv) simpleModeDiv.addEventListener('change', (event) => {
            if (event.target.name === 'color-preset' && currentPosterColorMode === 'simple') {
                const selectedPreset = colorPresets[event.target.value];
                if (selectedPreset) {
                    applyPreset(selectedPreset); // Apply colors and update lastAppliedPresetColors
                    updateAdvancedPickers(lastAppliedPresetColors); // Keep advanced pickers in sync
                }
            }
        });

        // Event listeners for Advanced mode color pickers
        const advancedColorPickerSelector = '#advanced-mode.color-options input[type="color"]';
        document.querySelectorAll(advancedColorPickerSelector).forEach(picker => {
            picker.addEventListener('input', () => {
                if (currentPosterColorMode === 'advanced') {
                    applyAdvancedColors(); // Apply colors and update lastAppliedPresetColors
                    // Note: We don't update the simple mode radio buttons here,
                    // as changing colors manually doesn't select a preset.
                }
            });
        });

        // Event listeners for poster text/image inputs
        ['poster-name-info', 'poster-note', 'poster-image-before', 'poster-image-after'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = (el.tagName === 'TEXTAREA' || el.type === 'text') ? 'input' : 'change';
                el.addEventListener(eventType, updatePoster);
            }
        });

        // Download button listener for Poster
        const posterDownloadButton = document.getElementById('poster-download');
        if (posterDownloadButton) posterDownloadButton.addEventListener('click', () => downloadImage('poster'));

         // Initial update of the poster content and colors when generator is visible
         if (posterGenSection.style.display !== 'none') {
             updatePoster();
             updateColorModeUIVisibility(); // Ensures colors and UI state are correct on load if starting on poster
         }
    }

    // Initial cursor state for cover canvas
     if (coverCanvas && !coverImage) {
         coverCanvas.style.cursor = 'default';
     }

});

// Clean up object URLs when the page unloads to prevent memory leaks
window.addEventListener('beforeunload', () => {
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload && coverImageUpload.dataset.previousUrl) {
        URL.revokeObjectURL(coverImageUpload.dataset.previousUrl);
    }
    const beforeInput = document.getElementById('poster-image-before');
    if (beforeInput && beforeImg && beforeImg.dataset.objectUrl) {
         URL.revokeObjectURL(beforeImg.dataset.objectUrl);
    }
     const afterInput = document.getElementById('poster-image-after');
     if (afterInput && afterImg && afterImg.dataset.objectUrl) {
          URL.revokeObjectURL(afterImg.dataset.objectUrl);
     }
});
