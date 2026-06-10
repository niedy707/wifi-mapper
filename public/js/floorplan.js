/**
 * FloorPlan Module
 * Handles floor plan image loading, canvas drawing tools, pan & zoom
 */
const FloorPlan = (() => {
  // ─── State ──────────────────────────────────────────────
  let canvasFloorplan, canvasDrawing, canvasInteraction;
  let ctxFloorplan, ctxDrawing;
  let containerEl;

  let floorplanImage = null;
  let canvasWidth = 0;
  let canvasHeight = 0;

  // Transform state (pan & zoom)
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;

  // Drawing state
  let drawingShapes = []; // Saved shapes
  let currentTool = 'select';
  let drawColor = '#ffffff';
  let drawWidth = 2;
  let isDrawing = false;
  let drawStart = null;
  let drawEnd = null;
  let polygonVertices = []; // For room polygon tool
  let selectedShapeId = null; // For shape selection
  let roomsVisible = true; // Toggle room visibility

  // Callbacks
  let onTransformChange = null;
  let onCanvasClick = null;
  let onDrawingChange = null;
  let onShapeDoubleClick = null;

  // ─── Initialization ─────────────────────────────────────
  function init(options = {}) {
    containerEl = document.getElementById('canvas-container');
    canvasFloorplan = document.getElementById('canvas-floorplan');
    canvasDrawing = document.getElementById('canvas-drawing');
    canvasInteraction = document.getElementById('canvas-interaction');

    ctxFloorplan = canvasFloorplan.getContext('2d');
    ctxDrawing = canvasDrawing.getContext('2d');

    onTransformChange = options.onTransformChange || (() => {});
    onCanvasClick = options.onCanvasClick || (() => {});
    onDrawingChange = options.onDrawingChange || (() => {});
    onShapeDoubleClick = options.onShapeDoubleClick || null;

    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // Interaction events on topmost canvas
    canvasInteraction.addEventListener('wheel', handleWheel, { passive: false });
    canvasInteraction.addEventListener('mousedown', handleMouseDown);
    canvasInteraction.addEventListener('mousemove', handleMouseMove);
    canvasInteraction.addEventListener('mouseup', handleMouseUp);
    canvasInteraction.addEventListener('mouseleave', handleMouseUp);
    canvasInteraction.addEventListener('dblclick', handleDoubleClick);

    // Touch support
    canvasInteraction.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasInteraction.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasInteraction.addEventListener('touchend', handleTouchEnd);
  }

  // ─── Canvas Sizing ──────────────────────────────────────
  function resizeCanvases() {
    const rect = containerEl.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;

    const allCanvases = containerEl.querySelectorAll('canvas');
    allCanvases.forEach(c => {
      c.width = canvasWidth;
      c.height = canvasHeight;
    });

    renderAll();
  }

  // ─── Floor Plan Image ───────────────────────────────────
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          floorplanImage = img;

          // Fit to canvas
          const scaleX = canvasWidth / img.width;
          const scaleY = canvasHeight / img.height;
          scale = Math.min(scaleX, scaleY) * 0.85;
          offsetX = (canvasWidth - img.width * scale) / 2;
          offsetY = (canvasHeight - img.height * scale) / 2;

          renderAll();
          onTransformChange({ scale, offsetX, offsetY });
          resolve(img);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        floorplanImage = img;
        const scaleX = canvasWidth / img.width;
        const scaleY = canvasHeight / img.height;
        scale = Math.min(scaleX, scaleY) * 0.85;
        offsetX = (canvasWidth - img.width * scale) / 2;
        offsetY = (canvasHeight - img.height * scale) / 2;
        renderAll();
        onTransformChange({ scale, offsetX, offsetY });
        resolve(img);
      };
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  function clearFloorplan() {
    floorplanImage = null;
    drawingShapes = [];
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    renderAll();
    onTransformChange({ scale, offsetX, offsetY });
    onDrawingChange();
  }

  function getFloorplanDataURL() {
    if (!floorplanImage) return null;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = floorplanImage.width;
    tempCanvas.height = floorplanImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(floorplanImage, 0, 0);
    return tempCanvas.toDataURL('image/png');
  }

  // ─── Coordinate Transforms ──────────────────────────────
  function screenToCanvas(sx, sy) {
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale
    };
  }

  function canvasToScreen(cx, cy) {
    return {
      x: cx * scale + offsetX,
      y: cy * scale + offsetY
    };
  }

  // ─── Rendering ──────────────────────────────────────────
  function renderAll() {
    renderFloorplan();
    renderDrawing();
    // Heatmap and pins are rendered by their own modules
    if (typeof HeatmapEngine !== 'undefined') HeatmapEngine.render();
    if (typeof Survey !== 'undefined') Survey.renderPins();
  }

  function renderFloorplan() {
    ctxFloorplan.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!floorplanImage) return;

    ctxFloorplan.save();
    ctxFloorplan.translate(offsetX, offsetY);
    ctxFloorplan.scale(scale, scale);
    ctxFloorplan.drawImage(floorplanImage, 0, 0);
    ctxFloorplan.restore();
  }

  function renderDrawing() {
    ctxDrawing.clearRect(0, 0, canvasWidth, canvasHeight);

    ctxDrawing.save();
    ctxDrawing.translate(offsetX, offsetY);
    ctxDrawing.scale(scale, scale);

    // Render saved shapes
    drawingShapes.forEach(shape => {
      if (!roomsVisible && (shape.type === 'draw-rect' || shape.type === 'room-polygon')) return;
      drawShape(ctxDrawing, shape);
    });

    // Render current shape being drawn
    if (isDrawing && drawStart && drawEnd) {
      drawShape(ctxDrawing, {
        type: currentTool,
        x1: drawStart.x, y1: drawStart.y,
        x2: drawEnd.x, y2: drawEnd.y,
        color: drawColor,
        width: drawWidth
      });
    }

    // Render current polygon in progress (show only dots/points)
    if (currentTool === 'room-polygon' && polygonVertices.length > 0) {
      // Render vertex dots
      polygonVertices.forEach((v, index) => {
        ctxDrawing.beginPath();
        ctxDrawing.arc(v.x, v.y, 5 / scale, 0, Math.PI * 2);
        ctxDrawing.fillStyle = '#6366f1';
        ctxDrawing.fill();
        ctxDrawing.strokeStyle = '#ffffff';
        ctxDrawing.lineWidth = 1.5 / scale;
        ctxDrawing.stroke();

        // Draw order number
        ctxDrawing.save();
        ctxDrawing.font = `bold ${8 / scale}px Inter, sans-serif`;
        ctxDrawing.fillStyle = '#ffffff';
        ctxDrawing.textAlign = 'center';
        ctxDrawing.textBaseline = 'middle';
        ctxDrawing.fillText(index + 1, v.x, v.y);
        ctxDrawing.restore();
      });
    }

    ctxDrawing.restore();
  }

  function drawShape(ctx, shape) {
    ctx.strokeStyle = shape.color || '#ffffff';
    ctx.fillStyle = shape.color || '#ffffff';
    ctx.lineWidth = (shape.width || 2) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shape.type) {
      case 'draw-rect':
        ctx.strokeRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
        
        // Fill translucent color
        ctx.fillStyle = hexToRgba(shape.color || '#ffffff', 0.15);
        ctx.fillRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);

        // Draw text label at center
        if (shape.text) {
          const cx = (shape.x1 + shape.x2) / 2;
          const cy = (shape.y1 + shape.y2) / 2;
          ctx.save();
          ctx.font = `bold ${12 / scale}px Inter, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4 / scale;
          ctx.fillText(shape.text, cx, cy);
          ctx.restore();
        }

        // Highlight if selected
        if (shape.id === selectedShapeId) {
          ctx.save();
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 3 / scale;
          ctx.setLineDash([4 / scale, 4 / scale]);
          ctx.strokeRect(shape.x1 - 2/scale, shape.y1 - 2/scale, (shape.x2 - shape.x1) + 4/scale, (shape.y2 - shape.y1) + 4/scale);
          ctx.restore();
        }
        break;
      case 'draw-line':
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        break;
      case 'draw-text':
        ctx.font = `${14 / scale}px Inter, sans-serif`;
        ctx.fillText(shape.text || '', shape.x1, shape.y1);
        break;
      case 'room-polygon':
        if (shape.vertices && shape.vertices.length > 0) {
          ctx.beginPath();
          ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
          for (let i = 1; i < shape.vertices.length; i++) {
            ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
          }
          ctx.closePath();
          
          // Fill with translucent color (15% opacity)
          ctx.fillStyle = hexToRgba(shape.color || '#ffffff', 0.15);
          ctx.fill();
          ctx.stroke();

          // If selected, draw highlight outline
          if (shape.id === selectedShapeId) {
            ctx.save();
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3 / scale;
            ctx.setLineDash([4 / scale, 4 / scale]);
            ctx.stroke();
            ctx.restore();
          }

          // Render room name label at centroid
          if (shape.text) {
            const centroid = getCentroid(shape.vertices);
            ctx.font = `bold ${12 / scale}px Inter, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add a text shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4 / scale;
            ctx.fillText(shape.text, centroid.x, centroid.y);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          }
        }
        break;
    }
  }

  // ─── Mouse Handlers ─────────────────────────────────────
  function handleWheel(e) {
    e.preventDefault();
    const rect = containerEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));

    // Zoom toward cursor
    offsetX = mx - (mx - offsetX) * (newScale / scale);
    offsetY = my - (my - offsetY) * (newScale / scale);
    scale = newScale;

    renderAll();
    onTransformChange({ scale, offsetX, offsetY });
  }

  function handleMouseDown(e) {
    const rect = containerEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasPos = screenToCanvas(mx, my);

    if (currentTool === 'select') {
      // Check if clicking on a pin (handled by Survey module)
      if (e.button === 0) {
        const pinHit = typeof Survey !== 'undefined' && Survey.hitTestPin(canvasPos.x, canvasPos.y);
        if (!pinHit) {
          // Check shape hit test
          const shapeHit = hitTestShape(canvasPos.x, canvasPos.y);
          if (shapeHit) {
            selectShape(shapeHit.id);
          } else {
            selectShape(null);
            
            // Start panning
            isPanning = true;
            panStartX = mx - offsetX;
            panStartY = my - offsetY;
            canvasInteraction.style.cursor = 'grabbing';
          }
        } else {
          selectShape(null);
        }
      }
    } else if (currentTool === 'measure' || currentTool === 'router') {
      // Place measurement point or router
      onCanvasClick(canvasPos.x, canvasPos.y, mx, my);
    } else if (currentTool === 'room-polygon') {
      polygonVertices.push(canvasPos);
      drawEnd = canvasPos;
      renderDrawing();
    } else if (currentTool === 'eraser') {
      // Erase nearest shape
      eraseNear(canvasPos.x, canvasPos.y);
    } else if (currentTool === 'draw-text') {
      // Show text input modal
      showTextInput(canvasPos.x, canvasPos.y);
    } else if (currentTool === 'draw-rect' || currentTool === 'draw-line') {
      isDrawing = true;
      drawStart = canvasPos;
      drawEnd = canvasPos;
    }
  }

  function handleMouseMove(e) {
    const rect = containerEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Update status bar coordinates
    const canvasPos = screenToCanvas(mx, my);
    const coordsEl = document.getElementById('status-coords');
    if (coordsEl) {
      coordsEl.textContent = `X: ${Math.round(canvasPos.x)}, Y: ${Math.round(canvasPos.y)}`;
    }

    if (isPanning) {
      offsetX = mx - panStartX;
      offsetY = my - panStartY;
      renderAll();
      onTransformChange({ scale, offsetX, offsetY });
    }

    if (isDrawing && drawStart) {
      drawEnd = canvasPos;
      renderDrawing();
    }

    if (currentTool === 'room-polygon' && polygonVertices.length > 0) {
      drawEnd = canvasPos;
      renderDrawing();
    }

    // Pin hover tooltip
    if (typeof Survey !== 'undefined') {
      Survey.handleMouseMove(canvasPos.x, canvasPos.y, mx, my);
    }
  }

  function handleMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      canvasInteraction.style.cursor = getCursorForTool();
    }

    if (isDrawing && drawStart && drawEnd) {
      const dx = Math.abs(drawEnd.x - drawStart.x);
      const dy = Math.abs(drawEnd.y - drawStart.y);
      if (dx > 3 || dy > 3) {
        const shapeId = 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const name = currentTool === 'draw-rect' ? prompt('Dikdörtgen Oda İsmini Girin (Örn: Salon, Mutfak):') : null;
        if (currentTool !== 'draw-rect' || name !== null) {
          drawingShapes.push({
            id: shapeId,
            type: currentTool,
            x1: drawStart.x, y1: drawStart.y,
            x2: drawEnd.x, y2: drawEnd.y,
            color: drawColor,
            width: drawWidth,
            text: currentTool === 'draw-rect' ? (name.trim() || `Oda ${drawingShapes.length + 1}`) : ''
          });
          isDrawing = false;
          drawStart = null;
          drawEnd = null;
          renderDrawing();
          onDrawingChange();
        } else {
          isDrawing = false;
          drawStart = null;
          drawEnd = null;
          renderDrawing();
        }
      } else {
        isDrawing = false;
        drawStart = null;
        drawEnd = null;
        renderDrawing();
      }
    }
  }

  function handleDoubleClick(e) {
    const rect = containerEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasPos = screenToCanvas(mx, my);

    // Oda (şekil) çift tıklama kontrolü — polygon çizim modu hariç
    if (currentTool !== 'room-polygon') {
      const shapeHit = hitTestShape(canvasPos.x, canvasPos.y);
      if (shapeHit) {
        selectShape(shapeHit.id);
        if (onShapeDoubleClick) {
          onShapeDoubleClick(shapeHit.id, e.clientX, e.clientY);
        }
        return;
      }
    }

    if (currentTool === 'select' && typeof Survey !== 'undefined') {
      Survey.hitTestPin(canvasPos.x, canvasPos.y);
    }
  }

  // ─── Touch Handlers ─────────────────────────────────────
  let lastTouchDist = 0;
  let lastTouchCenter = null;

  function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      lastTouchDist = getTouchDist(e.touches);
      lastTouchCenter = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
      });
      handleMouseDown(mouseEvent);
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = getTouchDist(e.touches);
      const newCenter = getTouchCenter(e.touches);
      const zoomFactor = newDist / lastTouchDist;

      const rect = containerEl.getBoundingClientRect();
      const mx = newCenter.x - rect.left;
      const my = newCenter.y - rect.top;

      const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
      offsetX = mx - (mx - offsetX) * (newScale / scale);
      offsetY = my - (my - offsetY) * (newScale / scale);

      if (lastTouchCenter) {
        offsetX += (newCenter.x - lastTouchCenter.x);
        offsetY += (newCenter.y - lastTouchCenter.y);
      }

      scale = newScale;
      lastTouchDist = newDist;
      lastTouchCenter = newCenter;

      renderAll();
      onTransformChange({ scale, offsetX, offsetY });
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseMove(mouseEvent);
    }
  }

  function handleTouchEnd(e) {
    handleMouseUp(new MouseEvent('mouseup'));
    lastTouchDist = 0;
    lastTouchCenter = null;
  }

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  // ─── Tools ──────────────────────────────────────────────
  function setTool(tool) {
    currentTool = tool;
    isDrawing = false;
    drawStart = null;
    drawEnd = null;
    canvasInteraction.style.cursor = getCursorForTool();
  }

  function getCursorForTool() {
    switch (currentTool) {
      case 'select': return 'default';
      case 'measure': return 'crosshair';
      case 'draw-rect': return 'crosshair';
      case 'draw-line': return 'crosshair';
      case 'draw-text': return 'text';
      case 'room-polygon': return 'crosshair';
      case 'eraser': return 'not-allowed';
      default: return 'default';
    }
  }

  function setDrawColor(color) { drawColor = color; }
  function setDrawWidth(width) { drawWidth = parseInt(width); }

  function eraseNear(x, y) {
    const threshold = 15 / scale;
    let closestIdx = -1;
    let closestDist = Infinity;

    drawingShapes.forEach((shape, i) => {
      let dist;
      if (shape.type === 'draw-text') {
        dist = Math.sqrt((x - shape.x1) ** 2 + (y - shape.y1) ** 2);
      } else {
        const cx = (shape.x1 + shape.x2) / 2;
        const cy = (shape.y1 + shape.y2) / 2;
        dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      }
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx >= 0 && closestDist < threshold) {
      drawingShapes.splice(closestIdx, 1);
      renderDrawing();
      onDrawingChange();
    }
  }

  function showTextInput(x, y) {
    if (typeof App !== 'undefined') {
      App.showTextInputModal(x, y);
    }
  }

  function addTextShape(x, y, text) {
    if (!text) return;
    drawingShapes.push({
      id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: 'draw-text',
      x1: x, y1: y,
      x2: x, y2: y,
      text: text,
      color: drawColor,
      width: drawWidth
    });
    renderDrawing();
    onDrawingChange();
  }

  // ─── Zoom Controls ─────────────────────────────────────
  function zoomIn() {
    const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
    const newScale = Math.min(10, scale * 1.2);
    offsetX = center.x - (center.x - offsetX) * (newScale / scale);
    offsetY = center.y - (center.y - offsetY) * (newScale / scale);
    scale = newScale;
    renderAll();
    onTransformChange({ scale, offsetX, offsetY });
  }

  function zoomOut() {
    const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
    const newScale = Math.max(0.1, scale * 0.8);
    offsetX = center.x - (center.x - offsetX) * (newScale / scale);
    offsetY = center.y - (center.y - offsetY) * (newScale / scale);
    scale = newScale;
    renderAll();
    onTransformChange({ scale, offsetX, offsetY });
  }

  function zoomFit() {
    if (!floorplanImage) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    } else {
      const scaleX = canvasWidth / floorplanImage.width;
      const scaleY = canvasHeight / floorplanImage.height;
      scale = Math.min(scaleX, scaleY) * 0.85;
      offsetX = (canvasWidth - floorplanImage.width * scale) / 2;
      offsetY = (canvasHeight - floorplanImage.height * scale) / 2;
    }
    renderAll();
    onTransformChange({ scale, offsetX, offsetY });
  }

  // ─── Getters & Serialization ────────────────────────────
  function getTransform() { return { scale, offsetX, offsetY }; }
  function getScale() { return scale; }
  function hasImage() { return !!floorplanImage; }
  function getImageSize() {
    return floorplanImage ? { width: floorplanImage.width, height: floorplanImage.height } : null;
  }

  function getDrawingData() {
    return JSON.parse(JSON.stringify(drawingShapes));
  }

  function setDrawingData(shapes) {
    drawingShapes = (shapes || []).map(shape => {
      if (!shape.id) {
        shape.id = 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }
      return shape;
    });
    renderDrawing();
  }

  function completePolygon() {
    if (polygonVertices.length < 3) {
      alert('Lütfen odanın en az 3 köşesini belirleyin.');
      return;
    }
    const name = prompt('Oda İsmini Girin (Örn: Salon, Mutfak):');
    if (name !== null) {
      const roomName = name.trim() || `Oda ${drawingShapes.length + 1}`;
      drawingShapes.push({
        id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: 'room-polygon',
        vertices: [...polygonVertices],
        color: drawColor,
        width: drawWidth,
        text: roomName
      });
      onDrawingChange();
    }
    cancelPolygon();
    
    // Automatically revert tool back to select
    document.querySelector('.tool-btn[data-tool="select"]')?.click();
  }

  function cancelPolygon() {
    polygonVertices = [];
    drawEnd = null;
    renderDrawing();
  }

  function hitTestShape(cx, cy) {
    for (let i = drawingShapes.length - 1; i >= 0; i--) {
      const shape = drawingShapes[i];
      if (shape.type === 'draw-rect') {
        const xMin = Math.min(shape.x1, shape.x2);
        const xMax = Math.max(shape.x1, shape.x2);
        const yMin = Math.min(shape.y1, shape.y2);
        const yMax = Math.max(shape.y1, shape.y2);
        if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) {
          return shape;
        }
      } else if (shape.type === 'room-polygon') {
        if (isPointInPolygon({ x: cx, y: cy }, shape.vertices)) {
          return shape;
        }
      }
    }
    return null;
  }

  function selectShape(id) {
    selectedShapeId = id;
    renderDrawing();
    if (typeof Survey !== 'undefined') {
      if (id) {
        Survey.selectMeasurement(id);
      } else {
        if (Survey.getSelectedId() && Survey.getSelectedId().startsWith('shape_')) {
          Survey.selectMeasurement(null);
        }
      }
    }
  }

  function removeShape(id) {
    drawingShapes = drawingShapes.filter(s => s.id !== id);
    if (selectedShapeId === id) selectShape(null);
    renderDrawing();
    onDrawingChange();
  }

  function updateShapeLabel(id, label) {
    const shape = drawingShapes.find(s => s.id === id);
    if (shape) {
      shape.text = label;
      renderDrawing();
      onDrawingChange();
    }
  }

  function isPointInPolygon(p, polygon) {
    let isInside = false;
    let minX = polygon[0].x, maxX = polygon[0].x;
    let minY = polygon[0].y, maxY = polygon[0].y;
    for (let n = 1; n < polygon.length; n++) {
      let q = polygon[n];
      minX = Math.min(q.x, minX);
      maxX = Math.max(q.x, maxX);
      minY = Math.min(q.y, minY);
      maxY = Math.max(q.y, maxY);
    }
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
      return false;
    }
    let i = 0, j = polygon.length - 1;
    for (i = 0; i < polygon.length; j = i++) {
      if ( (polygon[i].y > p.y) !== (polygon[j].y > p.y) &&
           (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x) ) {
        isInside = !isInside;
      }
    }
    return isInside;
  }

  function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(255, 255, 255, ${alpha})`;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getCentroid(vertices) {
    let xs = 0, ys = 0;
    vertices.forEach(v => { xs += v.x; ys += v.y; });
    return { x: xs / vertices.length, y: ys / vertices.length };
  }

  // ─── Public API ─────────────────────────────────────────
  return {
    init,
    loadImage,
    loadImageFromDataURL,
    clearFloorplan,
    getFloorplanDataURL,
    screenToCanvas,
    canvasToScreen,
    setTool,
    setDrawColor,
    setDrawWidth,
    addTextShape,
    completePolygon,
    cancelPolygon,
    selectShape,
    removeShape,
    updateShapeLabel,
    zoomIn,
    zoomOut,
    zoomFit,
    renderAll,
    renderFloorplan,
    renderDrawing,
    getTransform,
    getScale,
    hasImage,
    getImageSize,
    getDrawingData,
    setDrawingData,
    hitTestShape,
    setRoomsVisible: (visible) => { roomsVisible = visible; renderDrawing(); },
    clearAllRooms: () => {
      drawingShapes = drawingShapes.filter(s => s.type !== 'draw-rect' && s.type !== 'room-polygon');
      renderDrawing();
      if (onDrawingChange) onDrawingChange();
    },
    getCanvasSize: () => ({ width: canvasWidth, height: canvasHeight })
  };
})();
