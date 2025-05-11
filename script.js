// ===========================================================
// 1. Global Constants (Keep as is)
// ===========================================================
const coverCanvas = document.getElementById("cover-canvas");
const coverCtx = coverCanvas ? coverCanvas.getContext("2d") : null;
let overlayImage = new Image();

// ===========================================================
// 2. Global Variables (Keep as is)
// ===========================================================
let mode = 'cover';
let currentPosterColorMode = 'simple';
let coverImage = null; // User's uploaded image (the HTMLImageElement)
// State of the user's image drawn on canvas (includes position, size, and initial fitted size)
let coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
let coverDragging = false;
// Variables for delta drag (movement since last event)
let lastMouseX = null; // Last X position during drag (in canvas pixels)
let lastMouseY = null; // Last Y position during drag (in canvas pixels)
let lastTouchDistance = null; // For pinch zoom (distance in screen pixels)
let selectedTemplate = null; // Stores only the filename string for cover templates

// Poster Generator DOM Elements (will be assigned in DOMContentLoaded)
let beforeImg, afterImg, namePill, noteBox, posterNode;

//ADDED CANVAS MANIPULATION: Global variables for the before and after canvases and their contexts
let beforeCanvas, afterCanvas, beforeCtx, afterCtx;

// To store colors from the last simple preset or advanced pickers
let lastAppliedPresetColors = null; // Use this to remember colors when switching modes

//ADDED: drawnImage objects for beforeCanvas and afterCanvas
let beforeDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
let afterDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };



// ===========================================================
// 3. Cover Image Generator Functions (loadCoverTemplates modified)
// ===========================================================
function drawCoverCanvas() {
    if (!coverCtx) return;
    coverCtx.clearRect(0, 0, 1080, 1080); // Clear the entire canvas

        // Create a circular clipping path
    coverCtx.beginPath();
    coverCtx.arc(
        540,    // x-coordinate of the circle's center
        540,    // y-coordinate of the circle's center
        540,    // Radius of the circle
        0,      // Start angle (0 degrees)
        2 * Math.PI  // End angle (360 degrees)
    );
    coverCtx.closePath();
    coverCtx.clip();

    if (coverDrawnImage.img) {
        // Draw the user's image based on its current scaled position and dimensions
        coverCtx.drawImage(
            coverDrawnImage.img,
            0, 0, coverDrawnImage.img.width, coverDrawnImage.img.height, // Source rect (entire image)
            coverDrawnImage.x, coverDrawnImage.y, coverDrawnImage.width, coverDrawnImage.height // Destination rect on canvas
        );
    }
}

// Redraw the canvas when the overlay image finishes loading
overlayImage.onload = function() { drawCoverCanvas(); };
// Draw user image if overlay fails to load
overlayImage.onerror = function() { console.error("Failed to load overlay image: " + overlayImage.src); drawCoverCanvas(); };

function loadCoverTemplates() {
    console.log("Attempting to load cover templates from cover.json"); // Log start of function
    const box = document.querySelector('.template-selector'); // Get the container early
    if (!box) { console.error("Cover Templates: .template-selector div not found."); return; }
    box.innerHTML = '<p>Lade Vorlagen...</p>'; // Show loading indicator

    // Fetch the JSON file containing template filenames
    fetch('assets/templates/cover.json')
        .then(res => {
            console.log("Fetch responded with status:", res.status); // Log response status
            if (!res.ok) {
                // Log HTTP error and show a user-friendly message in the box
                const errorMsg = `HTTP error! Status: ${res.status}. Could not load cover.json.`;
                console.error(`Cover Templates: ${errorMsg}`);
                box.innerHTML = `<p style="color: red;">Fehler: ${errorMsg}</p>`;
                throw new Error(`HTTP error! status: ${res.status}`); // Propagate error to catch block
            }
            return res.json(); // Parse the JSON response
        })
        .then(filenames => {
             console.log("JSON data received:", filenames); // Log received data
            // Validate that the response is an array of strings
            if (!Array.isArray(filenames)) {
                // Log validation error and show a user-friendly message
                const errorMsg = "Data from cover.json is not an array of filenames.";
                console.error(`Cover Templates: ${errorMsg}`, filenames);
                box.innerHTML = `<p style="color: red;">Fehler: Vorlagendatenformat in cover.json ist falsch.</p>`;
                return; // Stop execution
            }
             console.log("Number of template filenames found:", filenames.length); // Log count

            // Sort filenames alphabetically for consistent display
            filenames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            box.innerHTML = ''; // Clear loading indicator and prepare for thumbnails

            // Create and append image elements for each template thumbnail
            if (filenames.length === 0) {
                 // Handle case where the array is empty
                 box.innerHTML = '<p>Keine Cover-Vorlagen gefunden.</p>';
                 console.log("No template filenames found in JSON.");
                 // Also ensure no overlay is drawn
                 overlayImage.src = ''; // Clear source
                 drawCoverCanvas(); // Redraw without overlay
                 selectedTemplate = null; // Clear selected template state
                 return; // Exit function
            }

            // If filenames exist, process them
            filenames.forEach(filename => {
                 // Basic validation for each filename
                 if (typeof filename !== 'string' || filename.trim() === '') {
                     console.warn("Cover Templates: Skipping invalid filename:", filename);
                     return; // Skip this filename
                 }

                 const img = document.createElement('img');
                 img.src = `assets/templates/profile/${filename}`; // Construct the full path
                 img.className = 'template-thumb'; // Apply CSS class
                 // Create informative alt text
                 img.alt = `Vorlage: ${filename.substring(0, filename.lastIndexOf('.')) || filename}`;
                 // Add click handler to select this template
                 img.onclick = () => selectCoverTemplate(filename);
                 // Handle image loading errors - This should also show in console Network tab if 404
                 img.onerror = () => {
                     console.error(`Cover Templates: Failed to load thumbnail: ${img.src}`);
                     img.style.border = "2px dashed red"; // Add visual error indicator
                     img.title = `Fehler beim Laden der Vorlage: ${filename}`; // Add title for tooltip
                 };
                 box.appendChild(img); // Add thumbnail to the container
             });


            // Select the first template initially, or re-select the previously selected one if it still exists
            console.log("Selecting initial template..."); // Added log
            const isCurrentSelectedStillValid = selectedTemplate && filenames.includes(selectedTemplate);
            if (!selectedTemplate || !isCurrentSelectedStillValid) {
                 console.log("No valid template selected or previous template not found, selecting the first:", filenames[0]);
                selectCoverTemplate(filenames[0]); // Select the first one if none selected or current is invalid
            } else {
               console.log("Re-selecting previously selected template:", selectedTemplate);
               // Re-selecting the current template reloads the overlay and redraws
               selectCoverTemplate(selectedTemplate);
            }

        })
        .catch(error => {
            // Handle errors during fetch or JSON parsing that weren't caught earlier
            console.error("Cover Templates: General error during fetch or processing:", error); // Log general error
            // Show a general error message in the box if a more specific one wasn't shown
            if (box.innerHTML.includes('Lade Vorlagen...')) {
                 box.innerHTML = '<p style="color: red;">Fehler beim Laden der Cover-Vorlagen.</p>';
            }
            // Also ensure no overlay is drawn on error
            overlayImage.src = ''; // Clear source
            drawCoverCanvas(); // Redraw without overlay
            selectedTemplate = null; // Clear selected template state
        });
}

function selectCoverTemplate(templateFile) {
    if (!templateFile || typeof templateFile !== 'string') { console.error("selectCoverTemplate: Invalid filename.", templateFile); return; }
    console.log("Selecting template:", templateFile); // Log selection
    selectedTemplate = templateFile; // Store the selected filename

    const newSrc = `assets/templates/profile/${templateFile}`; // Construct the path for the full overlay image

    // Update overlay image source only if it's different or hasn't loaded yet
    if (overlayImage.src !== newSrc || !overlayImage.complete) {
         console.log("Loading new overlay image:", newSrc); // Log loading
        overlayImage.src = newSrc; // Setting src triggers the onload/onerror handlers
    } else {
        // If source is the same and loaded, just redraw to be safe
        console.log("Overlay image already loaded, redrawing."); // Log redraw
        drawCoverCanvas();
    }
}

// Function to get mouse/touch position relative to canvas, scaled to canvas pixels
function getCanvasCoords(clientX, clientY, canvasRect, canvas) {
    // Get canvas's true drawing size vs rendered size
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const renderedWidth = canvasRect.width;
    const renderedHeight = canvasRect.height;

    // Calculate scale factors from rendered pixels to canvas pixels
    const scaleX = canvasWidth / renderedWidth;
    const scaleY = canvasHeight / renderedHeight;

    // Get mouse/touch position relative to the top-left of the rendered canvas element
    const clientXRelativeToCanvas = clientX - canvasRect.left;
    const clientYRelativeToCanvas = clientY - canvasRect.top;

    // Scale the client coordinates to canvas pixel coordinates
    const canvasX = clientXRelativeToCanvas * scaleX;
    const canvasY = clientYRelativeToCanvas * scaleY;

    return { x: canvasX, y: canvasY };
}


// ===========================================================
// 4. Poster Generator Functions (Keep as is)
// ===========================================================
function setSrc(imgEl, file) {
    if(!imgEl) return;
    // Revoke previous object URL if it exists to prevent memory leaks
    if (imgEl.dataset.objectUrl) {
        URL.revokeObjectURL(imgEl.dataset.objectUrl);
        delete imgEl.dataset.objectUrl; // Clean up the data attribute
    }
    // Create a new object URL for the file
    const newUrl = URL.createObjectURL(file);
    imgEl.src = newUrl; // Set the image source
    imgEl.dataset.objectUrl = newUrl; // Store the new object URL on the element
}

//DELETED: enableDragZoom function to work with canvases
/* function enableDragZoom(canvas) {
    if (!canvas) return;

    let ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initial scale and position
    let scale = 1;
    let posX = 0;
    let posY = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    // Apply initial transform
    applyCanvasTransform(canvas, ctx, scale, posX, posY);

    // Mouse Events
    canvas.addEventListener("mousedown", function (e) {
        e.preventDefault(); // Prevent default browser drag behavior
             dragging = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left - posX;
        startY = e.clientY - rect.top - posY;
        canvas.style.cursor = 'grabbing'; // Change cursor while dragging
    });

    canvas.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        posX = e.clientX - rect.left - startX;
        posY = e.clientY - rect.top - startY;
        applyCanvasTransform(canvas, ctx, scale, posX, posY);
    });

    canvas.addEventListener("mouseup", function (e) {
            dragging = false;
        canvas.style.cursor = 'grab';
    });

    // Mouse Wheel Zoom
    canvas.addEventListener("wheel", function (e) {
        e.preventDefault(); // Prevent page scroll zoom

        // Calculate zoom factor based on wheel delta (e.g., 1.05 for zoom in, 0.95 for zoom out)
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        posX -= (mouseX / scale) * (zoomFactor - scale);
        posY -= (mouseY / scale) * (zoomFactor - scale);

        scale = zoomFactor;

        // Apply zoom and redraw
        applyCanvasTransform(canvas, ctx, scale, posX, posY);
    }, { passive: false }); // Use passive: false to allow preventDefault
} */

//DELETED: applyCanvasTransform function to apply the transform to the canvas
/*function applyCanvasTransform(canvas, ctx, scale, posX, posY) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set the transform
    ctx.setTransform(scale, 0, 0, scale, posX, posY);

    // Redraw the image
    const img = new Image();
    img.onload = () => {
        drawCanvas(canvas, ctx, img);
    };
    img.src = canvas.toDataURL();
}*/

//MODIFIED CANVAS MANIPULATION: updatePoster function to get the canvas content
function updatePoster() {
    const beforeInput = document.getElementById('poster-image-before');
    const afterInput = document.getElementById('poster-image-after');
    const nameInput = document.getElementById('poster-name-info');
    const noteInput = document.getElementById('poster-note');
    const namePill = document.getElementById('name-pill');
    const noteBox = document.getElementById('note-box');
    // Get the "HEUTE XXXX" tag element specifically for the 'after' photo frame
    const tagAfterEl = posterNode ? posterNode.querySelector('.photo-frame.after .tag') : null;


    namePill.textContent = nameInput.value;
    noteBox.textContent = noteInput.value;
    // show pill only when there is text
    // namePill.classList.toggle('hidden', nameInput.value.trim()==='');
    noteBox.classList.toggle('hidden', noteInput.value.trim()==='');

    //MODIFIED: Update 'before' image source if a file is selected
    if (beforeImg) {
        if (beforeInput && beforeInput.files && beforeInput.files[0]) {
            //ADDED: Draw the uploaded image to the before canvas
            const file = beforeInput.files[0];
            const img = new Image();
            img.onload = () => {
                // Calculate initial dimensions and position
                const canvasWidth = beforeCanvas.width;
                const canvasHeight = beforeCanvas.height;
                const imgAspectRatio = img.width / img.height;
                const canvasAspectRatio = canvasWidth / canvasHeight;

                let initialDrawWidth, initialDrawHeight, drawX, drawY;

                if (imgAspectRatio > canvasAspectRatio) {
                    initialDrawWidth = canvasWidth;
                    initialDrawHeight = initialDrawWidth / imgAspectRatio;
                } else {
                    initialDrawHeight = canvasHeight;
                    initialDrawWidth = initialDrawHeight * imgAspectRatio;
                }

                drawX = (canvasWidth - initialDrawWidth) / 2;
                drawY = (canvasHeight - initialDrawHeight) / 2;

                //ADDED: Clear the canvas before drawing the new image
                beforeCtx.clearRect(0, 0, beforeCanvas.width, beforeCanvas.height);


                //ADDED: Store the current transformation values
                const currentX = beforeDrawnImage.x || drawX;
                const currentY = beforeDrawnImage.y || drawY;
                const currentWidth = beforeDrawnImage.width || initialDrawWidth;
                const currentHeight = beforeDrawnImage.height || initialDrawHeight;


                beforeDrawnImage = {
                    img: img, //ADDED: Add the image
                    x: currentX, //ADDED: Use the stored transformation values
                    y: currentY, //ADDED: Use the stored transformation values
                    width: currentWidth, //ADDED: Use the stored transformation values
                    height: currentHeight, //ADDED: Use the stored transformation values
                    initialWidth: initialDrawWidth,
                    initialHeight: initialDrawHeight
                };

                drawCanvas(beforeCanvas, beforeCtx, beforeDrawnImage);
                beforeImg.src = beforeCanvas.toDataURL(); // Set the img src to the canvas data URL
            };
            img.src = URL.createObjectURL(file);
        }
        // Use a transparent pixel placeholder if no image is set (or if an error occurred)
        // Check both empty src and our specific placeholder data URL (starts with "data:,")
        else if (!beforeImg.src || beforeImg.src === window.location.href + '#' || beforeImg.src.startsWith("data:,")) {
             beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
             // Also reset transform if returning to placeholder, so it's not zoomed/panned
             beforeImg.style.transform = '';
             beforeImg.style.transformOrigin = '';
        }
    }
     //MODIFIED: Update 'after' image source if a file is selected
    if (afterImg) {
        // REMOVED: File loading logic from here. This is now handled in the change event listener for the input.
         // Use a transparent pixel placeholder if no image is set (or if an error occurred)
         // Keep this placeholder logic here as it's needed when the input is cleared
         if ((!afterInput || !afterInput.files || !afterInput.files[0]) && (!afterDrawnImage || !afterDrawnImage.img)) {
             afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
             // Reset transform if returning to placeholder
             afterImg.style.transform = '';
             afterImg.style.transformOrigin = '';
        }
         // If an image is loaded in drawnImage state, ensure the poster img reflects the canvas
         else if (afterCanvas && afterDrawnImage && afterDrawnImage.img) {
             // This might be redundant if updatePosterImagesFromCanvases is called elsewhere,
             // but good for initial state.
             afterImg.src = afterCanvas.toDataURL();
         }
    }
}

//ADDED: drawCanvas function to draw the image on the canvas
function drawCanvas(canvas, ctx, drawnImage) {
    if (!canvas || !ctx || !drawnImage || !drawnImage.img) {
        // If no image, just clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return; // Exit if no image is available to draw
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    ctx.drawImage(
        drawnImage.img,
        0, 0, drawnImage.img.width, drawnImage.img.height, // Source rect (entire image)
        drawnImage.x, drawnImage.y, drawnImage.width, drawnImage.height // Destination rect on canvas
    );
}

// NEW FUNCTION: Update the poster <img> elements from the canvases
function updatePosterImagesFromCanvases() {
    if (beforeImg && beforeCanvas) {
         beforeImg.src = beforeCanvas.toDataURL();
         // Ensure transforms are captured if set on the canvas context
         // This is typically handled by toDataURL() but mentioning for clarity
    }
     if (afterImg && afterCanvas) {
         afterImg.src = afterCanvas.toDataURL();
     }
}

// ===========================================================
// 5. Utility Functions (General Purpose)
// ===========================================================
function setMode(selectedAppMode) {
    mode = selectedAppMode;
    const coverGen = document.getElementById('cover-generator');
    const posterGen = document.getElementById('poster-generator');

    // Hide both generators first
    if (coverGen) coverGen.style.display = 'none';
    if (posterGen) posterGen.style.display = 'none';

    // Show the selected generator and perform mode-specific initialization
    if (mode === 'cover' && coverGen) {
        coverGen.style.display = 'block';
        // Load templates if they haven't been loaded yet or if the selector is empty
        const tsBox = document.querySelector('#cover-generator .template-selector');
        // Check if box exists and if it has no children OR if a template was selected but isn't represented
        // (e.g., navigating back after an error clearing the box)
        if (tsBox && (tsBox.children.length === 0 || !tsBox.querySelector(`.template-thumb[src$="${selectedTemplate}"]`))) {
             loadCoverTemplates();
        } else if (selectedTemplate) {
             // If templates were loaded and a template is selected, ensure overlay is loaded and drawn
             selectCoverTemplate(selectedTemplate);
        }
         // Ensure cover canvas cursor is correct based on whether an image is loaded
         if (coverCanvas) coverCanvas.style.cursor = coverImage ? 'grab' : 'default';
    } else if (mode === 'poster' && posterGen) {
        posterGen.style.display = 'block';
         // Ensure poster state is updated (text, images)
        updatePoster();
        // Ensure correct color UI is shown and colors are applied based on current state
        updateColorModeUIVisibility();
    }

    // Update the active state for the mode selection buttons
    document.querySelectorAll('#mode-select button').forEach(btn => {
        btn.classList.toggle('sticky-active', btn.id === (mode + '-button'));
    });
}

function downloadImage(type) {
    let filename = "ME-awareness-image.png"; // Default filename
    if (type === 'cover') {
        const canvasToDownload = document.getElementById("cover-canvas");
        if (!canvasToDownload) { alert("Cover canvas not found."); return; }
        // Construct filename from template name if selected
        if (selectedTemplate) {
            // Remove path and extension
            filename = "ME-" + selectedTemplate.split("/").pop().replace(/\.[^/.]+$/, "") + ".png";
        } else {
            filename = "ME-profile-image.png";
        }
        // Trigger the download using the cover canvas
        triggerDownload(canvasToDownload, filename);

    } else if (type === 'poster') {
        const posterElement = document.getElementById('poster');
        if (!posterElement) { alert("Poster element not found."); return; }

        // html2canvas clone function to handle images and styles
        // This function is called by html2canvas on a temporary copy of the element before rendering
        const oncloneHandler = (clonedDoc) => {
            const clonedBeforeImg = clonedDoc.getElementById('before-img');
            const clonedAfterImg = clonedDoc.getElementById('after-img');

            // Copy the original image sources (which might be blob URLs) and transform styles
            // This is crucial because html2canvas might not capture blob URLs or transforms correctly by default
            if (beforeImg && clonedBeforeImg) {
                clonedBeforeImg.src = beforeImg.src; // Use current src
                clonedBeforeImg.style.transform = beforeImg.style.transform;
                clonedBeforeImg.style.transformOrigin = beforeImg.style.transformOrigin;
                clonedBeforeImg.style.objectFit = beforeImg.style.objectFit || 'contain'; // Ensure object-fit is copied
            } else if(clonedBeforeImg) { // If original img el wasn't found or had no src, set placeholder
                 clonedBeforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                 clonedBeforeImg.style.objectFit = 'contain';
            }
             if (afterImg && clonedAfterImg) {
                clonedAfterImg.src = afterImg.src; // Use current src
                 clonedAfterImg.style.transform = afterImg.style.transform;
                 clonedAfterImg.style.transformOrigin = afterImg.style.transformOrigin;
                 clonedAfterImg.style.objectFit = afterImg.style.objectFit || 'contain'; // Ensure object-fit is copied
            } else if (clonedAfterImg) { // If original img el wasn't found or had no src, set placeholder
                 clonedAfterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                 clonedAfterImg.style.objectFit = 'contain';
            }

            // Copy computed styles for elements whose colors or content are set programmatically
             const clonedPosterEl = clonedDoc.getElementById('poster');
             if (clonedPosterEl) {
                 const originalPosterStyle = getComputedStyle(posterElement);
                 // Copy background style (gradient)
                 clonedPosterEl.style.background = originalPosterStyle.background;

                 // Copy styles and content for name pill and note box
                 const namePillClone = clonedDoc.getElementById('name-pill');
                 if (namePillClone && namePill) {
                     namePillClone.style.backgroundColor = getComputedStyle(namePill).backgroundColor;
                     namePillClone.style.color = getComputedStyle(namePill).color;
                     namePillClone.textContent = namePill.textContent; // Copy text content
                 }
                 const noteBoxClone = clonedDoc.getElementById('note-box');
                 if (noteBoxClone && noteBox) {
                     noteBoxClone.style.backgroundColor = getComputedStyle(noteBox).backgroundColor;
                     noteBoxClone.style.color = getComputedStyle(noteBox).color;
                     noteBoxClone.textContent = noteBox.textContent; // Copy text content
                 }

                 // Apply text colors to specific elements (h1, h2, blockquote, .credit, .tag)
                 // Find the corresponding original elements to get their computed styles
                 const elementsToColor = clonedPosterEl.querySelectorAll('h1, h2, blockquote, .credit, .tag');
                 elementsToColor.forEach(clonedEl => {
                      let originalEl = null;
                     // Find the matching element in the original DOM
                     if(clonedEl.classList.contains('credit')) originalEl = posterElement.querySelector('.credit');
                     else if(clonedEl.classList.contains('tag')) originalEl = posterElement.querySelector('.tag');
                     else originalEl = posterElement.querySelector(clonedEl.tagName.toLowerCase()); // h1, h2, blockquote

                     if (originalEl) {
                          clonedEl.style.color = getComputedStyle(originalEl).color;
                           // Tags also have a background color set programmatically or by CSS
                           if (clonedEl.classList.contains('tag')) {
                                clonedEl.style.backgroundColor = getComputedStyle(originalEl).backgroundColor;
                           }
                     }
                 });
             }
        };

        // Use html2canvas to render the poster element into a canvas
        html2canvas(posterElement, {
            scale: 2, // Render at 2x the element's layout size for better resolution
            useCORS: true, // Allow cross-origin images (if server sends CORS headers)
            logging: false, // Disable html2canvas logs
            allowTaint: true, // Allow rendering images without CORS headers, but canvas might be tainted
            onclone: oncloneHandler, // Use the custom clone handler to copy dynamic state
            // Capture the element's actual layout size (offsetWidth/offsetHeight)
            width: posterElement.offsetWidth,
            height: posterElement.offsetHeight
        })
        .then(canvas => {
             // The desired output size is 1080x1350.
             // html2canvas with scale:2 applied to an element that's e.g., 540px wide
             // should produce a canvas 1080px wide. The height should be proportional.
             // We need to ensure the final output canvas is exactly 1080x1350.
            const targetWidth = 1080;
            const targetHeight = 1350; // Calculated aspect ratio: 1080 * (1350/1080) = 1350

            if (canvas.width === targetWidth && canvas.height === targetHeight) {
                 // If html2canvas already produced the correct size, just use it
                 triggerDownload(canvas, "ME-poster.png");
            } else {
                // If the size is different, create a new canvas and draw the generated one onto it scaled
                console.warn(`html2canvas output size mismatch: ${canvas.width}x${canvas.height}. Rescaling to ${targetWidth}x${targetHeight}.`);
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                const finalCtx = finalCanvas.getContext('2d');
                // Draw the html2canvas output onto the final canvas, scaling it to the target size
                finalCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
                triggerDownload(finalCanvas, "ME-poster.png");
            }
        })
        .catch(err => {
            console.error("html2canvas failed:", err);
            alert("Error generating poster image. See console for details.");
        });
    } else {
        // Alert if an invalid type was passed
        alert("Invalid download type.");
    }
}

function triggerDownload(canvas, filename) {
    const link = document.createElement("a");
    link.download = filename; // Set the filename for the download
    // Use toBlob for potentially better performance and memory handling
    if (canvas.toBlob) {
        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob); // Create a temporary URL for the blob
                link.href = url; // Set the link's href to the blob URL
                link.click(); // Programmatically click the link to trigger download
                // Clean up the object URL after the browser has initiated the download.
                // Use a short timeout to ensure the click event completes
                setTimeout(() => URL.revokeObjectURL(url), 100);
            } else {
                console.error("Canvas toBlob returned null.");
                alert("Error creating image blob for download.");
            }
        }, "image/png"); // Specify the output format
    } else {
        // Fallback for browsers that don't support toBlob (less common now)
        try {
            link.href = canvas.toDataURL("image/png"); // Get data URL directly
            link.click(); // Trigger download
        } catch (e) {
            console.error("Canvas toDataURL failed:", e);
            alert("Error converting canvas to image for download.");
        }
    }
}

// ===========================================================
// 6. Event Listeners - Cover Generator (Modified for Zoom)
// ===========================================================
if (coverCanvas) {
    // Mouse Events
    coverCanvas.addEventListener("mousedown", function (e) {
        // Only start if an image is loaded and the drawn image object is ready
        if (!coverImage || !coverDrawnImage.img) return;
        e.preventDefault(); // Prevent default browser drag behavior

        const rect = coverCanvas.getBoundingClientRect(); // Get canvas position/size on screen
        // Convert mouse coordinates to canvas pixel coordinates (1080x1080 space)
        const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, coverCanvas);
        const x = canvasCoords.x;
        const y = canvasCoords.y;

        // Check if click is within the drawn image bounds (in canvas pixels)
        if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
            y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) {
            coverDragging = true; // Start dragging state
            lastMouseX = x; // Record starting point for delta calculation in canvas pixels
            lastMouseY = y;
            coverCanvas.style.cursor = 'grabbing'; // Change cursor while dragging
        }
    });

    // Use window for mousemove and mouseup to handle drags that might go outside the canvas boundary
    window.addEventListener("mousemove", function (e) {
        if (coverDragging && coverImage) { // Continue drag only if dragging is active and image is loaded
            const rect = coverCanvas.getBoundingClientRect(); // Get current canvas position/size
            // Convert current mouse coordinates to canvas pixel coordinates
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, coverCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            // Calculate movement delta in canvas pixels since the last mousemove event
            const deltaX = x - lastMouseX;
            const deltaY = y - lastMouseY;

            // Update image position by adding the delta
            coverDrawnImage.x += deltaX;
            coverDrawnImage.y += deltaY;

            // Record current position for the next delta calculation
            lastMouseX = x;
            lastMouseY = y;

            drawCoverCanvas(); // Redraw the canvas with the new image position
        }
    });

    window.addEventListener("mouseup", () => {
        if (coverDragging) { // Only reset state if dragging was active
            coverDragging = false; // Stop dragging
            lastMouseX = null; // Clear last position
            lastMouseY = null;
            // Reset cursor back to grab if an image is loaded, otherwise default
            coverCanvas.style.cursor = coverImage ? 'grab' : 'default';
        }
    });

     // Mouse Wheel Zoom
     coverCanvas.addEventListener("wheel", function (e) {
         // Ensure image and its initial dimensions are available before zooming
         if (!coverImage || !coverDrawnImage.img || !coverDrawnImage.initialWidth) return;
         e.preventDefault(); // Prevent page scroll zoom

         const rect = coverCanvas.getBoundingClientRect();
         // Get mouse position relative to the canvas in canvas pixels
         const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, coverCanvas);
         const mouseCanvasX = canvasCoords.x;
         const mouseCanvasY = canvasCoords.y;

         // Calculate ideal zoom factor based on wheel delta (e.g., 1.05 for zoom in, 0.95 for zoom out)
         const idealZoomFactor = e.deltaY < 0 ? 1.05 : 0.95;

         // Calculate current scale relative to the initial 'contain' fitted size
         const currentScaleRelativeToFit = coverDrawnImage.width / coverDrawnImage.initialWidth;

         // Calculate potential new scale relative to initial fit
         let potentialNewScaleRelativeToFit = currentScaleRelativeToFit * idealZoomFactor;

         // Clamp the new scale relative to fit between defined min and max limits
         const minScale = 0.1; // Allow scaling down to 10% of original fitted size
         const maxScale = 10; // Allow scaling up to 1000% of original fitted size
         const clampedNewScaleRelativeToFit = Math.max(minScale, Math.min(maxScale, potentialNewScaleRelativeToFit));

         // Calculate the actual zoom factor applied, based on the difference between the clamped scale and current scale
         // This will be 1 if the scale is already at the limit
         const actualZoomFactor = clampedNewScaleRelativeToFit / currentScaleRelativeToFit;

         // If actualZoomFactor is 1, no zoom needs to be applied
         if (actualZoomFactor === 1) return;

         // Calculate new dimensions based on the actual zoom factor
         const newWidth = coverDrawnImage.width * actualZoomFactor;
         const newHeight = coverDrawnImage.height * actualZoomFactor; // Height scales proportionally


         // Adjust position to keep the mouse cursor point fixed relative to the image content
         // The formula translates the image's top-left corner (coverDrawnImage.x, coverDrawnImage.y)
         // so that the point under the mouse pointer (mouseCanvasX, mouseCanvasY)
         // remains at the same relative position *within the image itself* after scaling.
         coverDrawnImage.x -= (mouseCanvasX - coverDrawnImage.x) * (actualZoomFactor - 1);
         coverDrawnImage.y -= (mouseCanvasY - coverDrawnImage.y) * (actualZoomFactor - 1);

         // Update the image's drawn dimensions
         coverDrawnImage.width = newWidth;
         coverDrawnImage.height = newHeight;

         drawCoverCanvas(); // Redraw the canvas with the scaled and repositioned image
     }, { passive: false }); // Use passive: false to allow preventDefault


    // Touch Events
    coverCanvas.addEventListener("touchstart", function (e) {
        // Only start touch interaction if an image is loaded
        if (!coverImage || !coverDrawnImage.img) return;

        const rect = coverCanvas.getBoundingClientRect(); // Get canvas position/size on screen

        if (e.touches.length === 1) {
            e.preventDefault(); // Prevent default scrolling/gestures

            const touch = e.touches[0];
            // Convert touch coordinates to canvas pixel coordinates
            const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, coverCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            // Check if touch starts within the drawn image bounds (in canvas pixels)
            if (x >= coverDrawnImage.x && x <= coverDrawnImage.x + coverDrawnImage.width &&
                y >= coverDrawnImage.y && y <= coverDrawnImage.y + coverDrawnImage.height) {
                coverDragging = true; // Enable dragging for single touch
                lastMouseX = x; // Record starting canvas point for delta drag
                lastMouseY = y;
            }
            lastTouchDistance = null; // Reset pinch distance if single touch starts
        } else if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default scrolling/gestures

            coverDragging = false; // Stop dragging if two fingers are down
            lastMouseX = null; lastMouseY = null; // Clear drag state for delta method

            const [t1, t2] = e.touches;
            // Calculate initial distance between fingers (using screen coordinates is fine for ratio)
            lastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        }
    }, { passive: false });

    coverCanvas.addEventListener("touchmove", function (e) {
        // Only process touchmove if an image is loaded
        if (!coverImage || !coverDrawnImage.img) return;
        const rect = coverCanvas.getBoundingClientRect(); // Get current canvas position/size

        if (e.touches.length === 1 && coverDragging) {
            e.preventDefault(); // Prevent default scrolling/gestures

            const touch = e.touches[0];
            // Convert current touch coordinates to canvas pixel coordinates
            const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, coverCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

             // Calculate movement delta in canvas pixels since the last touchmove event
            const deltaX = x - lastMouseX;
            const deltaY = y - lastMouseY;

            // Update image position by adding the delta
            coverDrawnImage.x += deltaX;
            coverDrawnImage.y += deltaY;

            // Record current canvas position for the next delta calculation
            lastMouseX = x;
            lastMouseY = y;

            drawCoverCanvas(); // Redraw with the new position
            updatePoster();

        } else if (e.touches.length === 2 && lastTouchDistance !== null) {
             // Ensure initial dimensions are available for scaling calculations
            if (!coverDrawnImage.initialWidth) return;
            e.preventDefault(); // Prevent default scrolling/gestures

            const [t1, t2] = e.touches;
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); // Current distance (screen coords)
            if (distance === 0) {
                // If fingers haven't moved, update lastTouchDistance and return
                lastTouchDistance = distance;
                return;
            }

            // Calculate ideal zoom factor based on distance change ratio
            const idealZoomFactor = distance / lastTouchDistance;

             // Calculate current scale relative to initial fit
            const currentScaleRelativeToFit = coverDrawnImage.width / coverDrawnImage.initialWidth;

            // Calculate potential new scale relative to initial fit
            let potentialNewScaleRelativeToFit = currentScaleRelativeToFit * idealZoomFactor;

            // Clamp the new scale relative to fit between defined limits
             const minScale = 0.1;
             const maxScale = 10;
            const clampedNewScaleRelativeToFit = Math.max(minScale, Math.min(maxScale, potentialNewScaleRelativeToFit));

             // Calculate the actual zoom factor applied based on the clamped scale change
             const actualZoomFactor = clampedNewScaleRelativeToFit / currentScaleRelativeToFit;

             // If actualZoomFactor is effectively 1 (due to clamping), don't redraw or update position
             if (Math.abs(actualZoomFactor - 1) < 0.001) { // Use a small threshold for floating point comparisons
                 lastTouchDistance = distance; // Still update last distance
                 return;
             }

            // Calculate pinch center in canvas pixels
            const pinchCenterX = ((t1.clientX + t2.clientX) / 2 - rect.left) * (coverCanvas.width / rect.width);
            const pinchCenterY = ((t1.clientY + t2.clientY) / 2 - rect.top) * (coverCanvas.height / rect.height);

            // Adjust position to keep the pinch center fixed relative to the image content
            coverDrawnImage.x -= (pinchCenterX - coverDrawnImage.x) * (actualZoomFactor - 1);
            coverDrawnImage.y -= (pinchCenterY - coverDrawnImage.y) * (actualZoomFactor - 1);

            // Apply the actual zoom factor to dimensions
            coverDrawnImage.width *= actualZoomFactor;
            coverDrawnImage.height *= actualZoomFactor;


            drawCoverCanvas(); // Redraw with scaled and repositioned image
            updatePoster();
            lastTouchDistance = distance; // Update last distance for next move event
        }
    }, { passive: false });

    // Use window for touchend to ensure it's caught even if the touch ends outside the canvas
    window.addEventListener("touchend", function (e) {
        // If touches end such that less than 1 finger remains, stop dragging and clear drag state
        if (e.touches.length < 1) {
            coverDragging = false;
            lastMouseX = null; // Clear drag state for delta method
            lastMouseY = null;
            // Reset cursor back to grab if an image is loaded, otherwise default
            coverCanvas.style.cursor = coverImage ? 'grab' : 'default';
        }
        // If touches end such that less than 2 fingers remain, reset pinch distance
        if (e.touches.length < 2) {
            lastTouchDistance = null;
        }
    });


    // Image Upload Listener
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload) {
        coverImageUpload.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (!file) return; // Exit if no file was selected

            const img = new Image(); // Create a new Image object
            img.onload = function () {
                coverImage = img; // Store the loaded image object

                const canvasWidth = coverCanvas.width;
                const canvasHeight = coverCanvas.height;
                const imgAspectRatio = img.width / img.height;
                const canvasAspectRatio = canvasWidth / canvasHeight;

                let initialDrawWidth, initialDrawHeight, drawX, drawY;

                // Calculate dimensions to 'contain' the image within the canvas, preserving aspect ratio
                if (imgAspectRatio > canvasAspectRatio) {
                    // Image is wider than canvas aspect ratio (pillarbox)
                    initialDrawWidth = canvasWidth;
                    initialDrawHeight = initialDrawWidth / imgAspectRatio;
                } else {
                    // Image is taller than canvas aspect ratio (letterbox)
                    initialDrawHeight = canvasHeight;
                    initialDrawWidth = initialDrawHeight * imgAspectRatio;
                }

                // Center the drawn image initially within the canvas
                drawX = (canvasWidth - initialDrawWidth) / 2;
                drawY = (canvasHeight - initialDrawHeight) / 2;

                // Store the initial drawing state including the initial fitted size
                coverDrawnImage = {
                    img: img, // The image object itself
                    x: drawX, // Current X position (canvas pixels)
                    y: drawY, // Current Y position (canvas pixels)
                    width: initialDrawWidth, // Current width (canvas pixels)
                    height: initialDrawHeight, // Current height (canvas pixels)
                    initialWidth: initialDrawWidth,   // Store initial fitted width (canvas pixels)
                    initialHeight: initialDrawHeight // Store initial fitted height (canvas pixels)
                };

                // Reset drag/zoom state variables
                coverDragging = false;
                lastMouseX = null; // Clear drag state for delta method
                lastMouseY = null;
                lastTouchDistance = null;

                coverCanvas.style.cursor = 'grab'; // Set cursor to grab now that an image is loaded

                drawCoverCanvas(); // Draw the initial state (image + overlay)
            };

            // Handle image loading errors
            img.onerror = () => {
                alert("Error loading image.");
                coverImage = null; // Clear the image state
                // Reset the drawn image state to empty/default
                coverDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
                 coverCanvas.style.cursor = 'default'; // Reset cursor
                drawCoverCanvas(); // Redraw, which will show only the overlay (or blank if no overlay)
            };

            // Revoke the previous object URL before creating a new one to prevent memory leaks
            if (e.target.dataset.previousUrl) {
                 URL.revokeObjectURL(e.target.dataset.previousUrl);
                 delete e.target.dataset.previousUrl; // Clean up the data attribute
            }

            // Load the image using a blob URL created from the selected file
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl; // Set the image source
            e.target.dataset.previousUrl = objectUrl; // Store the new object URL on the input element
        });
    }
}

// ===========================================================
// 7. Poster Color Logic & Event Listeners (Keep as is)
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
    simpleModeDiv.innerHTML = ''; // Clear existing radio buttons
    let presetHtml = "";
    colorPresets.forEach((preset, i) => {
        // Determine if this radio button should be checked by default.
        // Check the first one if no colors are stored, OR if the stored colors match this preset exactly.
        const checked = (lastAppliedPresetColors === null && i === 0) ||
                        (lastAppliedPresetColors !== null &&
                         preset.background1.toLowerCase() === lastAppliedPresetColors.bgColor1.toLowerCase() &&
                         preset.background2.toLowerCase() === lastAppliedPresetColors.bgColor2.toLowerCase() &&
                         preset.text.toLowerCase() === lastAppliedPresetColors.textColor.toLowerCase() &&
                         preset.namePillBg.toLowerCase() === lastAppliedPresetColors.namePillBgColor.toLowerCase() &&
                         preset.namePillText.toLowerCase() === lastAppliedPresetColors.namePillTextColor.toLowerCase() &&
                         preset.noteBg.toLowerCase() === lastAppliedPresetColors.noteBgColor.toLowerCase() &&
                         preset.noteText.toLowerCase() === lastAppliedPresetColors.noteText.toLowerCase()
                         // Compare all properties for a strict match
                        );
        // Add the radio button and label HTML
        presetHtml += `<label><input type="radio" name="color-preset" value="${i}" ${checked ? 'checked' : ''}> ${preset.name}</label><br>`;
    });
    // Insert the generated HTML into the simple mode div
    simpleModeDiv.insertAdjacentHTML('beforeend', presetHtml);
}

function applyPreset(preset) {
    if (!posterNode || !preset) return;
    // Store the colors of the applied preset. These will be used to populate the advanced pickers
    // if the user switches modes, and to find a matching preset if they switch back to simple.
    lastAppliedPresetColors = {
        bgColor1: preset.background1, bgColor2: preset.background2, textColor: preset.text,
        namePillBgColor: preset.namePillBg, namePillTextColor: preset.namePillText,
        noteBgColor: preset.noteBg, noteText: preset.noteText
    };

    // Apply background gradient to the main poster element
    posterNode.style.background = `linear-gradient(to bottom, ${preset.background1}, ${preset.background2})`;

    // Apply main text color to specific elements
    const mainTextElements = posterNode.querySelectorAll('h1, h2, blockquote, .credit');
    mainTextElements.forEach(el => { el.style.color = preset.text; });

    // Apply background and text color to the note box and name pill
    if (noteBox) { noteBox.style.backgroundColor = preset.noteBg; noteBox.style.color = preset.noteText; }
    if (namePill) { namePill.style.backgroundColor = preset.namePillBg; namePill.style.color = preset.namePillText; }

    // Note: Tag colors (.tag) are currently hardcoded in CSS and not controlled by presets.
    // If they were, you would select them here and apply preset colors.

    // Update the color pickers in Advanced mode to reflect the applied preset's colors,
    // but without triggering their input events immediately.
    updateAdvancedPickers(lastAppliedPresetColors);
}

// Helper function to update the value of the advanced color picker inputs
// It takes a colors object (like lastAppliedPresetColors) and sets the picker values.
function updateAdvancedPickers(colors) {
     if (!colors) return; // Exit if no colors object is provided

     // Define the mapping between color picker element IDs and property names in the colors object
     const inputIdsAndProperties = {
        'bg-color1': 'bgColor1',
        'bg-color2': 'bgColor2',
        'text-color': 'textColor',
        'name-pill-bg-color': 'namePillBgColor',
        'name-pill-text-color': 'namePillTextColor',
        'note-bg-color': 'noteBgColor',
        'note-text-color': 'noteText'
    };

    // Iterate through the mapping and update each color picker
    for (const id in inputIdsAndProperties) {
        const inputEl = document.getElementById(id); // Get the color picker element
        const propName = inputIdsAndProperties[id]; // Get the corresponding property name

        // Ensure the element exists and the color property exists in the colors object
        if (inputEl && colors[propName] !== undefined) {
            // Only update the value if it's different (compare lowercase for robustness)
            // This prevents unnecessary DOM updates and potential event triggers
            if (inputEl.value.toLowerCase() !== colors[propName].toLowerCase()) {
                 inputEl.value = colors[propName]; // Set the new color value

                 // Dispatch 'input' event - this is needed for native color pickers
                 // in some browsers to visually update their swatch immediately after
                 // the value is changed programmatically.
                 // We add { bubbles: true } in case there are parent listeners.
                 inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
}

// Function to apply the colors selected by the advanced color pickers
function applyAdvancedColors() {
    if (!posterNode) return; // Exit if the poster element is not found

    // Helper to get the value of an element by ID, returning null if not found
    const getColorValue = id => { const el = document.getElementById(id); return el ? el.value : null; };

    // Get current color values from the pickers
    const bgColor1Val = getColorValue('bg-color1');
    const bgColor2Val = getColorValue('bg-color2');

    // Apply background gradient if both colors are valid
    if(bgColor1Val && bgColor2Val) {
        posterNode.style.background = `linear-gradient(to bottom, ${bgColor1Val}, ${bgColor2Val})`;
        // Store these colors in lastAppliedPresetColors
         lastAppliedPresetColors.bgColor1 = bgColor1Val;
         lastAppliedPresetColors.bgColor2 = bgColor2Val;
    }

    // Get main text color value
    const mainTextColorVal = getColorValue('text-color');
    // Apply main text color to specific elements if a value is retrieved
    if(mainTextColorVal !== null) { // Check against null, as value can be an empty string if picker isn't supported or has weird state
         const mainTextElements = posterNode.querySelectorAll('h1, h2, blockquote, .credit');
        mainTextElements.forEach(el => { el.style.color = mainTextColorVal; });
         // Store the text color
         lastAppliedPresetColors.textColor = mainTextColorVal;
    }

    // Apply colors to the note box
    if (noteBox) {
        const nbBg = getColorValue('note-bg-color');
        const nbTxt = getColorValue('note-text-color');
        if(nbBg !== null) { noteBox.style.backgroundColor = nbBg; lastAppliedPresetColors.noteBgColor = nbBg; }
        if(nbTxt !== null) { noteBox.style.color = nbTxt; lastAppliedPresetColors.noteText = nbTxt; }
    }

    // Apply colors to the name pill
    if (namePill) {
        const npBg = getColorValue('name-pill-bg-color');
        const npTxt = getColorValue('name-pill-text-color');
        if(npBg !== null) { namePill.style.backgroundColor = npBg; lastAppliedPresetColors.namePillBgColor = npBg; }
        if(npTxt !== null) { namePill.style.color = npTxt; lastAppliedPresetColors.namePillText = npTxt; }
    }

    // Tags colors (.tag) are currently hardcoded in CSS and not controlled by advanced pickers.
    // If they were, you would select them here and apply picker colors.
}


// Function to toggle visibility between simple and advanced color modes
function updateColorModeUIVisibility() {
    // Get the necessary DOM elements
    const simpleModeDiv = document.getElementById('simple-mode');
    const advancedModeDiv = document.getElementById('advanced-mode');
    const simpleBtn = document.getElementById('color-mode-simple-btn');
    const advancedBtn = document.getElementById('color-mode-advanced-btn');

    // Exit if any required element is missing
    if (!simpleModeDiv || !advancedModeDiv || !simpleBtn || !advancedBtn) { return; }

    // Determine if simple mode is the current mode
    const isSimple = currentPosterColorMode === 'simple';

    // Toggle visibility of the simple and advanced divs
    // Use class 'hidden' which should set display: none via CSS
    simpleModeDiv.classList.toggle('hidden', !isSimple);
    advancedModeDiv.classList.toggle('hidden', isSimple);
    // Explicitly setting style.display is redundant if CSS handles it, but can be a fallback
    simpleModeDiv.style.display = isSimple ? 'block' : 'none';
    advancedModeDiv.style.display = isSimple ? 'none' : 'block';

    // Update the active state for the mode selection buttons
    simpleBtn.classList.toggle('sticky-active', isSimple);
    advancedBtn.classList.toggle('sticky-active', !isSimple);

    if (isSimple) {
        // --- When switching TO simple mode ---
        // Find the currently checked preset radio button.
        // If none is checked (e.g., first load, or switched from advanced),
        // try to find a preset that *exactly* matches the current (last applied) colors stored in lastAppliedPresetColors.
        // If a match is found, check its radio button and apply that preset.
        // If no radio was checked and no matching preset found, apply the *first* preset and check its radio button.

        let checkedPresetRadio = simpleModeDiv.querySelector('input[name="color-preset"]:checked');
        let presetToApply = null;
        let matchedPresetIndex = -1;

        // 1. Check if a radio was already checked and corresponds to a valid preset index
        if (checkedPresetRadio && colorPresets[checkedPresetRadio.value]) {
            presetToApply = colorPresets[checkedPresetRadio.value];
             // Ensure the last applied colors reflect this preset
             if (presetToApply) {
                 lastAppliedPresetColors = {
                     bgColor1: presetToApply.background1, bgColor2: presetToApply.background2, textColor: presetToApply.text,
                     namePillBgColor: presetToApply.namePillBg, namePillTextColor: presetToApply.namePillText,
                     noteBgColor: presetToApply.noteBg, noteText: presetToApply.noteText
                 };
             }
        } else if (lastAppliedPresetColors) {
            // 2. If no radio checked, but we have stored colors, try to find a preset matching them
            matchedPresetIndex = colorPresets.findIndex(p =>
                p.background1.toLowerCase() === lastAppliedPresetColors.bgColor1.toLowerCase() &&
                p.background2.toLowerCase() === lastAppliedPresetColors.bgColor2.toLowerCase() &&
                p.text.toLowerCase() === lastAppliedPresetColors.textColor.toLowerCase() &&
                p.namePillBg.toLowerCase() === lastAppliedPresetColors.namePillBgColor.toLowerCase() &&
                p.namePillText.toLowerCase() === lastAppliedPresetColors.namePillTextColor.toLowerCase() &&
                p.noteBg.toLowerCase() === lastAppliedPresetColors.noteBgColor.toLowerCase() &&
                p.noteText.toLowerCase() === lastAppliedPresetColors.noteText.toLowerCase()
            );
            if (matchedPresetIndex !== -1) {
                presetToApply = colorPresets[matchedPresetIndex];
                // Check the found radio button
                const radioToSelect = simpleModeDiv.querySelector(`input[name="color-preset"][value="${matchedPresetIndex}"]`);
                if (radioToSelect) radioToSelect.checked = true;
                // lastAppliedPresetColors is already set correctly from the match
            }
        }

        // 3. If still no preset to apply (no radio checked, no match found), use the first one and check its radio
        if (!presetToApply && colorPresets.length > 0) {
             presetToApply = colorPresets[0];
             const firstRadio = simpleModeDiv.querySelector('input[name="color-preset"][value="0"]');
             if(firstRadio) firstRadio.checked = true;
             // Update lastAppliedPresetColors to the first preset's colors
             lastAppliedPresetColors = {
                 bgColor1: presetToApply.background1, bgColor2: presetToApply.background2, textColor: presetToApply.text,
                 namePillBgColor: presetToApply.namePillBg, namePillTextColor: presetToApply.namePillText,
                 noteBgColor: presetToApply.noteBg, noteText: presetToApply.noteText
             };
        }

        // Apply the determined preset's colors to the poster
        if (presetToApply) {
            applyPreset(presetToApply); // This also ensures lastAppliedPresetColors is updated
        } else {
             console.warn("No color presets available or matched to apply in simple mode.");
             // Potentially apply default hardcoded colors here if no presets exist at all
        }

    } else { // --- When switching TO advanced mode ---
        // Ensure advanced pickers are populated with the last applied colors (either from a preset or previous advanced changes)
         if (lastAppliedPresetColors) {
              updateAdvancedPickers(lastAppliedPresetColors);
         } else if (colorPresets.length > 0) {
              // Fallback: Initialize with first preset if no colors stored yet (shouldn't happen if init logic is correct)
               const initialPreset = colorPresets[0];
               lastAppliedPresetColors = {
                    bgColor1: initialPreset.background1, bgColor2: initialPreset.background2, textColor: initialPreset.text,
                    namePillBgColor: initialPreset.namePillBg, namePillTextColor: initialPreset.namePillText,
                    noteBgColor: initialPreset.noteBg, noteText: initialPreset.noteText
               };
               updateAdvancedPickers(lastAppliedPresetColors); // Populate pickers
         } else {
              console.warn("No colors stored and no presets available for initializing advanced mode pickers.");
               // Fallback: Initialize with some hardcoded defaults if no presets exist at all
               lastAppliedPresetColors = {
                    bgColor1: '#0068b5', bgColor2: '#3b86c4', textColor: '#FFFFFF',
                    namePillBgColor: '#FFFFFF', namePillTextColor: '#333344',
                    noteBgColor: '#FFFFFF', noteText: '#333344'
               };
              updateAdvancedPickers(lastAppliedPresetColors); // Populate pickers
         }

        // Apply the colors currently in the advanced pickers to the poster
        // This reads the values that were just set (or were already there)
        applyAdvancedColors();
    }
}

// ===========================================================
// 8. DOMContentLoaded - Main Initialization
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Assign global DOM elements once the DOM is ready
    beforeImg = document.getElementById('before-img');
    afterImg = document.getElementById('after-img');
    namePill = document.getElementById('name-pill');
    noteBox = document.getElementById('note-box');
    posterNode = document.getElementById('poster');

    //ADDED: Get the before and after canvases and their contexts
    beforeCanvas = document.getElementById('before-canvas');
    afterCanvas = document.getElementById('after-canvas');
    beforeCtx = beforeCanvas ? beforeCanvas.getContext('2d') : null;
    afterCtx = afterCanvas ? afterCanvas.getContext('2d') : null;

    // Apply the custom drag/zoom functionality to the poster image elements
    //if (beforeImg) enableDragZoom(beforeImg);
    //if (afterImg) enableDragZoom(afterImg);

    //MODIFIED: Apply the custom drag/zoom functionality to the canvases
    //if (beforeCanvas) enableDragZoom(beforeCanvas);
    //if (afterCanvas) enableDragZoom(afterCanvas);

    //NEW: Drag and zoom for beforeCanvas
    if (beforeCanvas) {
        let beforeDragging = false;
        let beforeLastMouseX, beforeLastMouseY;
        let beforeScale = 1; //ADDED: track scale

        beforeCanvas.addEventListener("mousedown", function (e) {
            // Ensure drawnImage has an image before allowing drag
            if (!beforeCanvas || !beforeCtx || !beforeDrawnImage.img) return;
            e.preventDefault();

            const rect = beforeCanvas.getBoundingClientRect();
            //MODIFIED: Use beforeCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, beforeCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            // Check if click is within the drawn image bounds (in canvas pixels)
             if (x >= beforeDrawnImage.x && x <= beforeDrawnImage.x + beforeDrawnImage.width &&
                 y >= beforeDrawnImage.y && y <= beforeDrawnImage.y + beforeDrawnImage.height) {
                beforeDragging = true;
                beforeLastMouseX = x;
                beforeLastMouseY = y;
                beforeCanvas.style.cursor = 'grabbing';
            }
        });

        beforeCanvas.addEventListener("mousemove", function (e) {
            if (!beforeDragging) return;
            e.preventDefault();

            //ADDED: Update canvasRect
            const rect = beforeCanvas.getBoundingClientRect();
             //MODIFIED: Use beforeCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, beforeCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            //MODIFIED: Apply scale factor to deltaX and deltaY
            // Removed division by beforeScale - drag delta should be in canvas pixels
            const deltaX = (x - beforeLastMouseX);
            const deltaY = (y - beforeLastMouseY);

            beforeDrawnImage.x += deltaX;
            beforeDrawnImage.y += deltaY;
            drawCanvas(beforeCanvas, beforeCtx, beforeDrawnImage); // Redraw the canvas
            updatePosterImagesFromCanvases(); // NEW: Update the visible poster image

            beforeLastMouseX = x;
            beforeLastMouseY = y;
            // REMOVED: updatePoster(); // <-- This was causing the reset
        });

        beforeCanvas.addEventListener("mouseup", () => {
            beforeDragging = false;
            beforeCanvas.style.cursor = 'grab';
        });

        beforeCanvas.addEventListener("wheel", function (e) {
            e.preventDefault();

            //MODIFIED: Reduce zoom factor
            const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;

            const rect = beforeCanvas.getBoundingClientRect();
             //MODIFIED: Use beforeCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, beforeCanvas);
            const mouseCanvasX = canvasCoords.x;
            const mouseCanvasY = canvasCoords.y;

            const newWidth = beforeDrawnImage.width * zoomFactor;
            const newHeight = beforeDrawnImage.height * zoomFactor;

            //MODIFIED: Adjust x and y coordinates for zoom centering
            beforeDrawnImage.x -= (mouseCanvasX - beforeDrawnImage.x) * (zoomFactor - 1);
            beforeDrawnImage.y -= (mouseCanvasY - beforeDrawnImage.y) * (zoomFactor - 1);
            beforeDrawnImage.width = newWidth;
            beforeDrawnImage.height = newHeight;

            drawCanvas(beforeCanvas, beforeCtx, beforeDrawnImage); // Redraw the canvas
            updatePosterImagesFromCanvases(); // NEW: Update the visible poster image
            beforeScale = beforeDrawnImage.width / beforeDrawnImage.initialWidth; //ADDED: track scale
            // REMOVED: updatePoster(); // <-- This was causing the reset
        }, { passive: false });

         // ADDED: Touch Events for beforeCanvas (Similar to Cover Canvas)
         let beforeLastTouchDistance = null; // For pinch zoom

         beforeCanvas.addEventListener("touchstart", function (e) {
              if (!beforeCanvas || !beforeDrawnImage.img) return;
              const rect = beforeCanvas.getBoundingClientRect();

              if (e.touches.length === 1) {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, beforeCanvas);
                  const x = canvasCoords.x;
                  const y = canvasCoords.y;

                  if (x >= beforeDrawnImage.x && x <= beforeDrawnImage.x + beforeDrawnImage.width &&
                      y >= beforeDrawnImage.y && y <= beforeDrawnImage.y + beforeDrawnImage.height) {
                      beforeDragging = true;
                      beforeLastMouseX = x;
                      beforeLastMouseY = y;
                  }
                   beforeLastTouchDistance = null; // Reset pinch distance
              } else if (e.touches.length === 2) {
                  e.preventDefault();
                  beforeDragging = false;
                  beforeLastMouseX = null; beforeLastMouseY = null;
                  const [t1, t2] = e.touches;
                  beforeLastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
              }
         }, { passive: false });

         beforeCanvas.addEventListener("touchmove", function (e) {
              if (!beforeCanvas || !beforeDrawnImage.img) return;
              const rect = beforeCanvas.getBoundingClientRect();

              if (e.touches.length === 1 && beforeDragging) {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, beforeCanvas);
                  const x = canvasCoords.x;
                  const y = canvasCoords.y;

                  const deltaX = x - beforeLastMouseX;
                  const deltaY = y - beforeLastMouseY;

                  beforeDrawnImage.x += deltaX;
                  beforeDrawnImage.y += deltaY;
                  drawCanvas(beforeCanvas, beforeCtx, beforeDrawnImage);
                  updatePosterImagesFromCanvases(); // NEW: Update the visible poster image

                  beforeLastMouseX = x;
                  beforeLastMouseY = y;
              } else if (e.touches.length === 2 && beforeLastTouchDistance !== null && beforeDrawnImage.initialWidth) {
                  e.preventDefault();
                  const [t1, t2] = e.touches;
                  const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                   if (distance === 0) {
                       beforeLastTouchDistance = distance;
                       return;
                   }

                  const idealZoomFactor = distance / beforeLastTouchDistance;
                  const currentScaleRelativeToFit = beforeDrawnImage.width / beforeDrawnImage.initialWidth;
                  let potentialNewScaleRelativeToFit = currentScaleRelativeToFit * idealZoomFactor;
                  const minScale = 0.1;
                  const maxScale = 10;
                  const clampedNewScaleRelativeToFit = Math.max(minScale, Math.min(maxScale, potentialNewScaleRelativeToFit));
                  const actualZoomFactor = clampedNewScaleRelativeToFit / currentScaleRelativeToFit;

                  if (Math.abs(actualZoomFactor - 1) < 0.001) {
                      beforeLastTouchDistance = distance;
                      return;
                  }

                  const pinchCenterX = ((t1.clientX + t2.clientX) / 2 - rect.left) * (beforeCanvas.width / rect.width);
                  const pinchCenterY = ((t1.clientY + t2.clientY) / 2 - rect.top) * (beforeCanvas.height / rect.height);

                  beforeDrawnImage.x -= (pinchCenterX - beforeDrawnImage.x) * (actualZoomFactor - 1);
                  beforeDrawnImage.y -= (pinchCenterY - beforeDrawnImage.y) * (actualZoomFactor - 1);
                  beforeDrawnImage.width *= actualZoomFactor;
                  beforeDrawnImage.height *= actualZoomFactor;

                  drawCanvas(beforeCanvas, beforeCtx, beforeDrawnImage);
                  updatePosterImagesFromCanvases(); // NEW: Update the visible poster image
                  beforeLastTouchDistance = distance;
              }
         }, { passive: false });

         // Use window for touchend to ensure it's caught
         window.addEventListener("touchend", function (e) {
              if (e.touches.length < 1) {
                  beforeDragging = false;
                  beforeLastMouseX = null;
                  beforeLastMouseY = null;
              }
              if (e.touches.length < 2) {
                  beforeLastTouchDistance = null;
              }
         });
    }

    //NEW: Drag and zoom for afterCanvas
    if (afterCanvas) {
        let afterDragging = false;
        let afterLastMouseX, afterLastMouseY;
        let afterScale = 1; //ADDED: track scale

        afterCanvas.addEventListener("mousedown", function (e) {
            // Ensure drawnImage has an image before allowing drag
            if (!afterCanvas || !afterCtx || !afterDrawnImage.img) return;
            e.preventDefault();

            const rect = afterCanvas.getBoundingClientRect();
             //MODIFIED: Use afterCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, afterCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            // Check if click is within the drawn image bounds (in canvas pixels)
             if (x >= afterDrawnImage.x && x <= afterDrawnImage.x + afterDrawnImage.width &&
                 y >= afterDrawnImage.y && y <= afterDrawnImage.y + afterDrawnImage.height) {
                afterDragging = true;
                afterLastMouseX = x;
                afterLastMouseY = y;
                afterCanvas.style.cursor = 'grabbing';
            }
        });

        afterCanvas.addEventListener("mousemove", function (e) {
           if (!afterDragging) return;
            e.preventDefault();

            const rect = afterCanvas.getBoundingClientRect();
             //MODIFIED: Use beforeCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, afterCanvas);
            const x = canvasCoords.x;
            const y = canvasCoords.y;

            //MODIFIED: Apply scale factor to deltaX and deltaY
            // Removed division by afterScale - drag delta should be in canvas pixels
            const deltaX = (x - afterLastMouseX);
            const deltaY = (y - afterLastMouseY);

            afterDrawnImage.x += deltaX;
            afterDrawnImage.y += deltaY;
            drawCanvas(afterCanvas, afterCtx, afterDrawnImage); // Redraw the canvas
            updatePosterImagesFromCanvases(); // NEW: Update the visible poster image

            afterLastMouseX = x;
            afterLastMouseY = y;
            // REMOVED: updatePoster(); // <-- This was causing the reset
        });

        afterCanvas.addEventListener("mouseup", () => {
            afterDragging = false;
            afterCanvas.style.cursor = 'grab';
        });

        afterCanvas.addEventListener("wheel", function (e) {
             // Ensure initial dimensions are available for scaling calculations
             if (!afterDrawnImage || !afterDrawnImage.img || !afterDrawnImage.initialWidth) return;
            e.preventDefault();

            //MODIFIED: Reduce zoom factor
            const idealZoomFactor = e.deltaY < 0 ? 1.05 : 0.95;

            const rect = afterCanvas.getBoundingClientRect();
             //MODIFIED: Use afterCanvas
            const canvasCoords = getCanvasCoords(e.clientX, e.clientY, rect, afterCanvas);
            const mouseCanvasX = canvasCoords.x;
            const mouseCanvasY = canvasCoords.y;

            // Calculate current scale relative to the initial 'contain' fitted size
            const currentScaleRelativeToFit = afterDrawnImage.width / afterDrawnImage.initialWidth;

            // Calculate potential new scale relative to initial fit
            let potentialNewScaleRelativeToFit = currentScaleRelativeToFit * idealZoomFactor;

            // Clamp the new scale relative to fit between defined min and max limits
            const minScale = 0.1; // Allow scaling down to 10% of original fitted size
            const maxScale = 10; // Allow scaling up to 1000% of original fitted size
            const clampedNewScaleRelativeToFit = Math.max(minScale, Math.min(maxScale, potentialNewScaleRelativeToFit));

            // Calculate the actual zoom factor applied
            const actualZoomFactor = clampedNewScaleRelativeToFit / currentScaleRelativeToFit;

            // If actualZoomFactor is effectively 1, no zoom needs to be applied
            if (Math.abs(actualZoomFactor - 1) < 0.001) return;

            const newWidth = afterDrawnImage.width * actualZoomFactor;
            const newHeight = afterDrawnImage.height * actualZoomFactor;

            //MODIFIED: Adjust x and y coordinates for zoom centering
            afterDrawnImage.x -= (mouseCanvasX - afterDrawnImage.x) * (actualZoomFactor - 1);
            afterDrawnImage.y -= (mouseCanvasY - afterDrawnImage.y) * (actualZoomFactor - 1);
            afterDrawnImage.width = newWidth;
            afterDrawnImage.height = newHeight;

            drawCanvas(afterCanvas, afterCtx, afterDrawnImage); // Redraw the canvas
            updatePosterImagesFromCanvases(); // NEW: Update the visible poster image
            afterScale =  afterDrawnImage.width / afterDrawnImage.initialWidth;; //ADDED: track scale
            // REMOVED: updatePoster(); // <-- This was causing the reset
        }, { passive: false });

         // ADDED: Touch Events for afterCanvas (Similar to Cover Canvas)
         let afterLastTouchDistance = null; // For pinch zoom

         afterCanvas.addEventListener("touchstart", function (e) {
             if (!afterCanvas || !afterDrawnImage.img) return;
             const rect = afterCanvas.getBoundingClientRect();

              if (e.touches.length === 1) {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, afterCanvas);
                  const x = canvasCoords.x;
                  const y = canvasCoords.y;

                   if (x >= afterDrawnImage.x && x <= afterDrawnImage.x + afterDrawnImage.width &&
                       y >= afterDrawnImage.y && y <= afterDrawnImage.y + afterDrawnImage.height) {
                      afterDragging = true;
                      afterLastMouseX = x;
                      afterLastMouseY = y;
                  }
                   afterLastTouchDistance = null; // Reset pinch distance
              } else if (e.touches.length === 2) {
                   e.preventDefault();
                   afterDragging = false;
                   afterLastMouseX = null; afterLastMouseY = null;
                   const [t1, t2] = e.touches;
                   afterLastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
               }
         }, { passive: false });

         afterCanvas.addEventListener("touchmove", function (e) {
             if (!afterCanvas || !afterDrawnImage.img) return;
             const rect = afterCanvas.getBoundingClientRect();

             if (e.touches.length === 1 && afterDragging) {
                 e.preventDefault();
                 const touch = e.touches[0];
                 const canvasCoords = getCanvasCoords(touch.clientX, touch.clientY, rect, afterCanvas);
                 const x = canvasCoords.x;
                 const y = canvasCoords.y;

                 const deltaX = x - afterLastMouseX;
                 const deltaY = y - afterLastMouseY;

                 afterDrawnImage.x += deltaX;
                 afterDrawnImage.y += deltaY;
                 drawCanvas(afterCanvas, afterCtx, afterDrawnImage);
                 updatePosterImagesFromCanvases(); // NEW: Update the visible poster image

                 afterLastMouseX = x;
                 afterLastMouseY = y;
             } else if (e.touches.length === 2 && afterLastTouchDistance !== null && afterDrawnImage.initialWidth) {
                  e.preventDefault();
                 const [t1, t2] = e.touches;
                 const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                 if (distance === 0) {
                       afterLastTouchDistance = distance;
                       return;
                   }

                 const idealZoomFactor = distance / afterLastTouchDistance;
                 const currentScaleRelativeToFit = afterDrawnImage.width / afterDrawnImage.initialWidth;
                 let potentialNewScaleRelativeToFit = currentScaleRelativeToFit * idealZoomFactor;
                 const minScale = 0.1;
                 const maxScale = 10;
                 const clampedNewScaleRelativeToFit = Math.max(minScale, Math.min(maxScale, potentialNewScaleRelativeToFit));
                 const actualZoomFactor = clampedNewScaleRelativeToFit / currentScaleRelativeToFit;

                 if (Math.abs(actualZoomFactor - 1) < 0.001) {
                      afterLastTouchDistance = distance;
                      return;
                  }

                 const pinchCenterX = ((t1.clientX + t2.clientX) / 2 - rect.left) * (afterCanvas.width / rect.width);
                 const pinchCenterY = ((t1.clientY + t2.clientY) / 2 - rect.top) * (afterCanvas.height / rect.height);

                 afterDrawnImage.x -= (pinchCenterX - afterDrawnImage.x) * (actualZoomFactor - 1);
                 afterDrawnImage.y -= (pinchCenterY - afterDrawnImage.y) * (actualZoomFactor - 1);
                 afterDrawnImage.width *= actualZoomFactor;
                 afterDrawnImage.height *= actualZoomFactor;


                 drawCanvas(afterCanvas, afterCtx, afterDrawnImage);
                 updatePosterImagesFromCanvases(); // NEW: Update the visible poster image
                 afterLastTouchDistance = distance;
             }
         }, { passive: false });

         // Use window for touchend to ensure it's caught
         window.addEventListener("touchend", function (e) {
              if (e.touches.length < 1) {
                  afterDragging = false;
                  afterLastMouseX = null;
                  afterLastMouseY = null;
              }
              if (e.touches.length < 2) {
                  afterLastTouchDistance = null;
              }
         });
    }

    // Initialize color state based on the first preset's colors
     if (colorPresets.length > 0) {
         const initialPreset = colorPresets[0];
         lastAppliedPresetColors = {
            bgColor1: initialPreset.background1, bgColor2: initialPreset.background2, textColor: initialPreset.text,
            namePillBgColor: initialPreset.namePillBg, namePillTextColor: initialPreset.namePillText,
            noteBgColor: initialPreset.noteBg, noteText: initialPreset.noteText
        };
     } else {
         // Fallback if no presets defined at all
         lastAppliedPresetColors = {
             bgColor1: '#0068b5', bgColor2: '#3b86c4', textColor: '#FFFFFF',
             namePillBgColor: '#FFFFFF', namePillTextColor: '#333344',
             noteBgColor: '#FFFFFF', noteText: '#333344'
         };
         console.warn("No color presets defined, initializing with default fallback colors.");
     }

    // Populate the simple mode radio buttons based on the presets
    populatePresets();
    // Populate the advanced color pickers with the initial/last applied colors
    updateAdvancedPickers(lastAppliedPresetColors);

    // Set the initial mode of the application (Profile Picture Generator)
    // This call handles loading cover templates and setting up the initial view.
    setMode('cover');

    // Add event listeners specific to the Poster Generator section
    const posterGenSection = document.getElementById('poster-generator');
    if (posterGenSection) {

        // Event listeners for the Simple/Advanced color mode switch buttons
        const simpleBtn = document.getElementById('color-mode-simple-btn');
        const advancedBtn = document.getElementById('color-mode-advanced-btn');
        if (simpleBtn) simpleBtn.addEventListener('click', () => { currentPosterColorMode = 'simple'; updateColorModeUIVisibility(); });
        if (advancedBtn) advancedBtn.addEventListener('click', () => { currentPosterColorMode = 'advanced'; updateColorModeUIVisibility(); });

        // Event listener for Simple mode radio buttons (using event delegation on the container)
        const simpleModeDiv = document.getElementById('simple-mode');
        if (simpleModeDiv) simpleModeDiv.addEventListener('change', (event) => {
            // Check if the change event was triggered by a radio button with the correct name
            if (event.target.name === 'color-preset' && currentPosterColorMode === 'simple') {
                const selectedPreset = colorPresets[event.target.value]; // Get the selected preset object
                if (selectedPreset) {
                    applyPreset(selectedPreset); // Apply the colors and update lastAppliedPresetColors
                    updateAdvancedPickers(lastAppliedPresetColors); // Keep advanced pickers in sync
                }
            }
        });

        // Event listeners for Advanced mode color pickers (using querySelectorAll)
        const advancedColorPickerSelector = '#advanced-mode.color-options input[type="color"]';
        document.querySelectorAll(advancedColorPickerSelector).forEach(picker => {
            // Use 'input' event for real-time updates as the picker value changes
            picker.addEventListener('input', () => {
                // Only apply colors if currently in advanced mode
                if (currentPosterColorMode === 'advanced') {
                    applyAdvancedColors(); // Apply colors and update lastAppliedPresetColors
                }
            });
        });

        // Event listeners for poster text and image inputs to trigger updates
        // Add 'input' for text fields for real-time updates, 'change' for file inputs
        ['poster-name-info', 'poster-note'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePoster);
        });
        ['poster-image-before', 'poster-image-after'].forEach(id => {
             const el = document.getElementById(id);
             if (el) {
                  el.addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        const isBefore = id === 'poster-image-before';
                        const canvas = isBefore ? beforeCanvas : afterCanvas;
                        const ctx = isBefore ? beforeCtx : afterCtx;
                        const drawnImage = isBefore ? beforeDrawnImage : afterDrawnImage;
                        const imgElement = isBefore ? beforeImg : afterImg;

                        if (!file) {
                            // Handle case where file input is cleared
                            if (isBefore) beforeDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
                            else afterDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
                            drawCanvas(canvas, ctx, isBefore ? beforeDrawnImage : afterDrawnImage); // Clear canvas
                            // Set the <img> src to a placeholder
                            if (imgElement) imgElement.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                            return;
                        }

                        const img = new Image();
                        img.onload = function () {
                            const canvasWidth = canvas.width;
                            const canvasHeight = canvas.height;
                            const imgAspectRatio = img.width / img.height;
                            const canvasAspectRatio = canvasWidth / canvasHeight;

                            let initialDrawWidth, initialDrawHeight, drawX, drawY;

                            if (imgAspectRatio > canvasAspectRatio) {
                                initialDrawWidth = canvasWidth;
                                initialDrawHeight = initialDrawWidth / imgAspectRatio;
                            } else {
                                initialDrawHeight = canvasHeight;
                                initialDrawWidth = initialDrawHeight * imgAspectRatio;
                            }

                            drawX = (canvasWidth - initialDrawWidth) / 2;
                            drawY = (canvasHeight - initialDrawHeight) / 2;

                            ctx.clearRect(0, 0, canvas.width, canvas.height);

                            // Reset the drawnImage state completely for the NEW image
                            const newDrawnImageState = {
                                img: img,
                                x: drawX,
                                y: drawY,
                                width: initialDrawWidth,
                                height: initialDrawHeight,
                                initialWidth: initialDrawWidth,
                                initialHeight: initialDrawHeight
                            };

                            if (isBefore) {
                                beforeDrawnImage = newDrawnImageState;
                                // Reset drag/zoom state variables for this canvas
                                beforeDragging = false; beforeLastMouseX = null; beforeLastMouseY = null; beforeLastTouchDistance = null; beforeScale = 1;
                            } else {
                                afterDrawnImage = newDrawnImageState;
                                // Reset drag/zoom state variables for this canvas
                                afterDragging = false; afterLastMouseX = null; afterLastMouseY = null; afterLastTouchDistance = null; afterScale = 1;
                            }


                            drawCanvas(canvas, ctx, newDrawnImageState);
                            // Update the poster <img> element from the canvas
                            if (imgElement) imgElement.src = canvas.toDataURL();
                        };

                        img.onerror = () => {
                            alert("Error loading image.");
                            // Reset drawnImage state and clear canvas/img src on error
                            if (isBefore) {
                                beforeDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
                                if (beforeImg) beforeImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Placeholder
                            } else {
                                afterDrawnImage = { img: null, x: 0, y: 0, width: 0, height: 0, initialWidth: 0, initialHeight: 0 };
                                if (afterImg) afterImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Placeholder
                            }
                            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
                        };

                        // Revoke the previous object URL before creating a new one
                        if (e.target.dataset.previousUrl) {
                            URL.revokeObjectURL(e.target.dataset.previousUrl);
                            delete e.target.dataset.previousUrl;
                        }

                        // Load the image using a blob URL
                        const objectUrl = URL.createObjectURL(file);
                        img.src = objectUrl;
                        e.target.dataset.previousUrl = objectUrl;
                   });
              }
         });


        // Download button listener for the Poster Generator
        const posterDownloadButton = document.getElementById('poster-download');
        if (posterDownloadButton) posterDownloadButton.addEventListener('click', () => downloadImage('poster'));

         // Initial update of the poster content and colors if the poster generator is visible on load.
         // Since setMode('cover') is called first, the poster generator is initially hidden,
         // so this block is mostly for safety or if the initial mode were changed.
         // The update logic will run when setMode('poster') is called by clicking the button.
         /*
         if (posterGenSection.style.display !== 'none') {
             updatePoster(); // Update text and images
             updateColorModeUIVisibility(); // Ensure colors and UI state are correct
         }
         */
    }

    // Set the initial cursor state for the cover canvas
     // This handles the state before an image is even uploaded
     if (coverCanvas && !coverImage) {
         coverCanvas.style.cursor = 'default';
     }
});

// Clean up object URLs when the page unloads to prevent memory leaks.
// This is important for blob URLs created from file inputs.
window.addEventListener('beforeunload', () => {
    const coverImageUpload = document.getElementById("cover-image-upload");
    if (coverImageUpload && coverImageUpload.dataset.previousUrl) {
        URL.revokeObjectURL(coverImageUpload.dataset.previousUrl);
        delete coverImageUpload.dataset.previousUrl; // Clean up attribute
    }
    const beforeImgEl = document.getElementById('before-img');
    if (beforeImgEl && beforeImgEl.dataset.objectUrl) {
         URL.revokeObjectURL(beforeImgEl.dataset.objectUrl);
         delete beforeImgEl.dataset.objectUrl; // Clean up attribute
    }
     const afterImgEl = document.getElementById('after-img');
     if (afterImgEl && afterImgEl.dataset.objectUrl) {
          URL.revokeObjectURL(afterImgEl.dataset.objectUrl);
           delete afterImgEl.dataset.objectUrl; // Clean up attribute
     }
});
