import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import * as THREE from 'three';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  Grid,
  Circle,
  Crosshair,
} from 'lucide-react';
import {
  compileExpression,
  numericalDerivative,
  findRoots,
  evaluateParametric,
} from '../../utils/mathParser';

/**
 * GraphSandbox Component
 * Integrates high-performance 2D Canvas graphing + 3D Three.js surface/vector rendering
 * with dynamic sliders, geometric primitives, and mobile touch gestures.
 */
const GraphSandbox = forwardRef(function GraphSandbox(
  {
    equations = [],
    activeDimension = '2D',
    sliders = {},
  },
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const threeMountRef = useRef(null);

  // 2D Viewport state
  const [viewport, setViewport] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -7,
    yMax: 7,
  });

  const [hoverCoord, setHoverCoord] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showTangent, setShowTangent] = useState(false);
  const [showRoots, setShowRoots] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const touchDistanceRef = useRef(null);

  // Three.js refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const surfaceMeshRef = useRef(null);
  const threeAnimationIdRef = useRef(null);
  const threeOrbitRef = useRef({
    isMouseDown: false,
    prevMouseX: 0,
    prevMouseY: 0,
    spherical: { radius: 25, theta: Math.PI / 4, phi: Math.PI / 3 },
  });

  // Coordinate transformations (Math <-> Screen)
  const mathToScreen = useCallback(
    (mx, my, width, height) => {
      const sx = ((mx - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
      const sy = ((viewport.yMax - my) / (viewport.yMax - viewport.yMin)) * height;
      return { sx, sy };
    },
    [viewport]
  );

  const screenToMath = useCallback(
    (sx, sy, width, height) => {
      const mx = viewport.xMin + (sx / width) * (viewport.xMax - viewport.xMin);
      const my = viewport.yMax - (sy / height) * (viewport.yMax - viewport.yMin);
      return { mx, my };
    },
    [viewport]
  );

  // Zoom helpers
  const handleZoom = useCallback((factor) => {
    setViewport((prev) => {
      const xCenter = (prev.xMin + prev.xMax) / 2;
      const yCenter = (prev.yMin + prev.yMax) / 2;
      const xHalf = ((prev.xMax - prev.xMin) * factor) / 2;
      const yHalf = ((prev.yMax - prev.yMin) * factor) / 2;
      return {
        xMin: xCenter - xHalf,
        xMax: xCenter + xHalf,
        yMin: yCenter - yHalf,
        yMax: yCenter + yHalf,
      };
    });
  }, []);

  const handleResetViewport = () => {
    setViewport({ xMin: -10, xMax: 10, yMin: -7, yMax: 7 });
  };

  // Expose imperative export helpers via ref
  useImperativeHandle(
    ref,
    () => ({
      exportPNG: () => {
        if (activeDimension === '2D' && canvasRef.current) {
          return canvasRef.current.toDataURL('image/png');
        } else if (activeDimension === '3D' && rendererRef.current) {
          return rendererRef.current.domElement.toDataURL('image/png');
        }
        return null;
      },
      exportSVG: () => {
        if (activeDimension !== '2D') return null;
        const w = 800;
        const h = 600;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#0a0a0a">`;

        // Axes
        const { sx: ox, sy: oy } = mathToScreen(0, 0, w, h);
        svgContent += `<line x1="0" y1="${oy}" x2="${w}" y2="${oy}" stroke="#525252" stroke-width="2"/>`;
        svgContent += `<line x1="${ox}" y1="0" x2="${ox}" y2="${h}" stroke="#525252" stroke-width="2"/>`;

        // Curves
        equations.forEach((eq) => {
          if (!eq.visible) return;
          const fn = compileExpression(eq.formula);
          let pathD = '';
          const steps = 300;
          const dx = (viewport.xMax - viewport.xMin) / steps;

          for (let i = 0; i <= steps; i++) {
            const x = viewport.xMin + i * dx;
            const y = fn({ ...sliders, x });
            if (!isNaN(y) && isFinite(y)) {
              const { sx, sy } = mathToScreen(x, y, w, h);
              pathD += pathD === '' ? `M ${sx.toFixed(1)} ${sy.toFixed(1)}` : ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
            }
          }

          if (pathD) {
            svgContent += `<path d="${pathD}" fill="none" stroke="${eq.color || '#6366f1'}" stroke-width="3"/>`;
          }
        });

        svgContent += `</svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
      },
    }),
    [activeDimension, equations, sliders, viewport, mathToScreen]
  );

  // -------------------------------------------------------------
  // 2D CANVAS DRAWING ENGINE (60 FPS)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeDimension !== '2D') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render2D = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Grid
      if (showGrid) {
        ctx.strokeStyle = '#262626';
        ctx.lineWidth = 1;

        // Dynamic tick steps based on scale
        const xSpan = viewport.xMax - viewport.xMin;
        let step = 1;
        if (xSpan > 50) step = 10;
        else if (xSpan > 20) step = 5;
        else if (xSpan > 10) step = 2;
        else if (xSpan < 4) step = 0.5;

        // Vertical grid lines
        const firstX = Math.floor(viewport.xMin / step) * step;
        for (let x = firstX; x <= viewport.xMax; x += step) {
          const { sx } = mathToScreen(x, 0, width, height);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, height);
          ctx.stroke();

          // Tick numbers
          if (Math.abs(x) > 1e-6) {
            ctx.fillStyle = '#737373';
            ctx.font = '10px monospace';
            const { sy: originY } = mathToScreen(0, 0, width, height);
            const clampedY = Math.max(15, Math.min(height - 10, originY + 12));
            ctx.fillText(Number(x.toFixed(2)), sx + 2, clampedY);
          }
        }

        // Horizontal grid lines
        const firstY = Math.floor(viewport.yMin / step) * step;
        for (let y = firstY; y <= viewport.yMax; y += step) {
          const { sy } = mathToScreen(0, y, width, height);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(width, sy);
          ctx.stroke();

          // Tick numbers
          if (Math.abs(y) > 1e-6) {
            ctx.fillStyle = '#737373';
            ctx.font = '10px monospace';
            const { sx: originX } = mathToScreen(0, 0, width, height);
            const clampedX = Math.max(5, Math.min(width - 35, originX + 5));
            ctx.fillText(Number(y.toFixed(2)), clampedX, sy - 2);
          }
        }
      }

      // 2. Draw Axes
      const { sx: originX, sy: originY } = mathToScreen(0, 0, width, height);
      ctx.strokeStyle = '#525252';
      ctx.lineWidth = 1.5;

      // X-Axis
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.stroke();

      // Y-Axis
      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();

      // Origin label
      ctx.fillStyle = '#a3a3a3';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('(0,0)', originX + 4, originY - 4);

      // 3. Render Equations
      equations.forEach((eq) => {
        if (!eq.visible) return;

        if (eq.type === 'parametric') {
          const points = evaluateParametric(
            eq.xFormula || 'cos(t)',
            eq.yFormula || 'sin(t)',
            eq.tMin || 0,
            eq.tMax || Math.PI * 2,
            400,
            sliders
          );
          if (points.length < 2) return;

          ctx.strokeStyle = eq.color || '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();

          let started = false;
          points.forEach((pt) => {
            const { sx, sy } = mathToScreen(pt.x, pt.y, width, height);
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          });
          ctx.stroke();
          return;
        }

        // Explicit 2D function: y = f(x)
        const fn = compileExpression(eq.formula);
        ctx.strokeStyle = eq.color || '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const samples = width; // 1 sample per screen pixel
        const dx = (viewport.xMax - viewport.xMin) / samples;
        let isDrawing = false;
        let prevY = 0;

        for (let i = 0; i <= samples; i++) {
          const x = viewport.xMin + i * dx;
          const y = fn({ ...sliders, x });

          if (isNaN(y) || !isFinite(y)) {
            isDrawing = false;
            continue;
          }

          // Check for steep asymptotes (discontinuities like tan(x))
          if (isDrawing && Math.abs(y - prevY) > (viewport.yMax - viewport.yMin) * 2) {
            isDrawing = false;
          }

          const { sx, sy } = mathToScreen(x, y, width, height);

          if (!isDrawing) {
            ctx.moveTo(sx, sy);
            isDrawing = true;
          } else {
            ctx.lineTo(sx, sy);
          }
          prevY = y;
        }
        ctx.stroke();

        // 4. Roots / Zeros Detection & Rendering
        if (showRoots && eq.formula) {
          const roots = findRoots(fn, viewport.xMin, viewport.xMax, sliders, 100);
          roots.forEach((root) => {
            const { sx, sy } = mathToScreen(root, 0, width, height);
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#34d399';
            ctx.font = '10px monospace';
            ctx.fillText(`x=${root}`, sx - 15, sy - 8);
          });
        }
      });

      // 5. Tangent Line at hover coordinate
      if (showTangent && hoverCoord && equations[0]?.visible) {
        const fn = compileExpression(equations[0].formula);
        const y0 = fn({ ...sliders, x: hoverCoord.mx });
        const slope = numericalDerivative(fn, hoverCoord.mx, sliders);

        if (!isNaN(y0) && !isNaN(slope) && isFinite(slope)) {
          const { sx: hx, sy: hy } = mathToScreen(hoverCoord.mx, y0, width, height);

          // Draw tangent line segment
          const deltaX = 4;
          const xA = hoverCoord.mx - deltaX;
          const yA = y0 - slope * deltaX;
          const xB = hoverCoord.mx + deltaX;
          const yB = y0 + slope * deltaX;

          const pA = mathToScreen(xA, yA, width, height);
          const pB = mathToScreen(xB, yB, width, height);

          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pA.sx, pA.sy);
          ctx.lineTo(pB.sx, pB.sy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Tangent point
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fill();

          // Slope label
          ctx.fillStyle = '#f472b6';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`m = dy/dx = ${slope.toFixed(3)}`, hx + 8, hy - 8);
        }
      }

      ctx.restore();
    };

    render2D();
  }, [
    activeDimension,
    viewport,
    equations,
    sliders,
    showGrid,
    showRoots,
    showTangent,
    hoverCoord,
    mathToScreen,
  ]);

  // -------------------------------------------------------------
  // 3D THREE.JS SURFACE & VECTOR ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeDimension !== '3D') return;

    const container = threeMountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width || 800, height || 600);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      rendererRef.current = renderer;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('WebGL is not available in this environment:', e);
      return;
    }

    // Grid & Axes
    const gridHelper = new THREE.GridHelper(20, 20, 0x525252, 0x262626);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(15, 20, 15);
    scene.add(dirLight);

    // Construct 3D Surface Geometry
    const gridSegments = 40;
    const surfaceGeometry = new THREE.PlaneGeometry(16, 16, gridSegments, gridSegments);
    surfaceGeometry.rotateX(-Math.PI / 2);

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      wireframe: false,
      roughness: 0.3,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    scene.add(surfaceMesh);
    surfaceMeshRef.current = surfaceMesh;

    // 3D Animation & Orbit Loop
    const animateThree = () => {
      threeAnimationIdRef.current = requestAnimationFrame(animateThree);

      const orbit = threeOrbitRef.current;
      const { radius, theta, phi } = orbit.spherical;

      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animateThree();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(threeAnimationIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      surfaceGeometry.dispose();
      surfaceMaterial.dispose();
      if (container) container.innerHTML = '';
    };
  }, [activeDimension]);

  // Update 3D Surface heights from formula & sliders
  useEffect(() => {
    if (activeDimension !== '3D' || !surfaceMeshRef.current) return;

    const targetEq = equations.find((e) => e.dimension === '3D' || e.type === 'surface3D') || equations[0];
    const formulaStr = targetEq?.formula || 'x^2 - y^2';
    const fn = compileExpression(formulaStr);

    const mesh = surfaceMeshRef.current;
    const pos = mesh.geometry.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = fn({ ...sliders, x, y: z });
      const clampedY = isNaN(y) ? 0 : Math.max(-10, Math.min(10, y));
      pos.setY(i, clampedY);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }, [activeDimension, equations, sliders]);

  // -------------------------------------------------------------
  // PAN, ZOOM & TOUCH INTERACTION HANDLERS
  // -------------------------------------------------------------
  const handleMouseDown = (e) => {
    if (activeDimension === '2D') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      threeOrbitRef.current.isMouseDown = true;
      threeOrbitRef.current.prevMouseX = e.clientX;
      threeOrbitRef.current.prevMouseY = e.clientY;
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeDimension === '2D') {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const math = screenToMath(sx, sy, canvas.clientWidth, canvas.clientHeight);
      setHoverCoord({ ...math, sx, sy });

      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const xSpan = viewport.xMax - viewport.xMin;
        const ySpan = viewport.yMax - viewport.yMin;

        const xShift = (dx / canvas.clientWidth) * xSpan;
        const yShift = (dy / canvas.clientHeight) * ySpan;

        setViewport((prev) => ({
          xMin: prev.xMin - xShift,
          xMax: prev.xMax - xShift,
          yMin: prev.yMin + yShift,
          yMax: prev.yMax + yShift,
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    } else {
      const orbit = threeOrbitRef.current;
      if (orbit.isMouseDown) {
        const deltaX = e.clientX - orbit.prevMouseX;
        const deltaY = e.clientY - orbit.prevMouseY;

        orbit.spherical.theta -= deltaX * 0.007;
        orbit.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.spherical.phi - deltaY * 0.007));

        orbit.prevMouseX = e.clientX;
        orbit.prevMouseY = e.clientY;
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    threeOrbitRef.current.isMouseDown = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (activeDimension === '2D') {
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      handleZoom(factor);
    } else {
      const orbit = threeOrbitRef.current;
      orbit.spherical.radius = Math.max(5, Math.min(80, orbit.spherical.radius + e.deltaY * 0.03));
    }
  };

  // Mobile Pinch-to-Zoom touch handling
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && canvasRef.current) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;
      const xSpan = viewport.xMax - viewport.xMin;
      const ySpan = viewport.yMax - viewport.yMin;

      const xShift = (dx / canvasRef.current.clientWidth) * xSpan;
      const yShift = (dy / canvasRef.current.clientHeight) * ySpan;

      setViewport((prev) => ({
        xMin: prev.xMin - xShift,
        xMax: prev.xMax - xShift,
        yMin: prev.yMin + yShift,
        yMax: prev.yMax + yShift,
      }));
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && touchDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = touchDistanceRef.current / dist;
      if (Math.abs(1 - ratio) > 0.05) {
        handleZoom(ratio);
        touchDistanceRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[520px] sm:h-[600px] bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl select-none"
    >
      {/* 2D HTML5 Canvas */}
      {activeDimension === '2D' && (
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full h-full cursor-crosshair touch-none"
        />
      )}

      {/* 3D Three.js Container */}
      {activeDimension === '3D' && (
        <div
          ref={threeMountRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
      )}

      {/* Viewport Floating Controls Toolbar */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-neutral-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-800 shadow-xl z-10">
        <button
          onClick={() => handleZoom(0.8)}
          className="p-2 text-stone-300 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(1.25)}
          className="p-2 text-stone-300 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetViewport}
          className="p-2 text-stone-300 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer"
          title="Reset Viewport to (-10, 10)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {activeDimension === '2D' && (
          <>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                showGrid ? 'text-indigo-400 bg-neutral-800' : 'text-stone-500 hover:text-stone-300'
              }`}
              title="Toggle Coordinate Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRoots(!showRoots)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                showRoots ? 'text-emerald-400 bg-neutral-800' : 'text-stone-500 hover:text-stone-300'
              }`}
              title="Toggle Roots / Zeros Detection"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTangent(!showTangent)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                showTangent ? 'text-pink-400 bg-neutral-800' : 'text-stone-500 hover:text-stone-300'
              }`}
              title="Toggle Interactive Tangent Line & Derivative"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Coordinate & Status Overlay */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 text-xs font-mono text-stone-300 z-10">
        {activeDimension === '2D' ? (
          hoverCoord ? (
            <span>
              x: <strong className="text-indigo-400">{hoverCoord.mx.toFixed(3)}</strong>, y:{' '}
              <strong className="text-emerald-400">{hoverCoord.my.toFixed(3)}</strong>
            </span>
          ) : (
            <span className="text-stone-500">Hover canvas to inspect (x, y)</span>
          )
        ) : (
          <span className="text-cyan-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            3D Orbit: Click & drag to rotate | Scroll to zoom
          </span>
        )}
      </div>
    </div>
  );
});

export default GraphSandbox;
