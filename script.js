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