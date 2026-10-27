// ==========================================================================
// WebAR 3D Storytelling & Monument Visualization Engine
// References: CyArk (LiDAR 3D Preservation) & WebXR/Three.js concepts
// ==========================================================================

const WebAR = {
  canvas: null,
  gl: null,
  videoEl: null,
  cameraStream: null,
  animationId: null,
  
  // State
  currentModel: 'colosseum',
  renderMode: 'realistic', // 'realistic', 'lidar', 'wireframe'
  explodeRatio: 0.0,
  scale: 1.0,
  rotationX: 0.35,
  rotationY: 0.6,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  scanSweepTime: 0,
  isCameraActive: false,
  simulatedEnv: 'forum',

  // Geometry Cache
  models: {},
  programs: {},

  init(canvasId, videoId) {
    this.canvas = document.getElementById(canvasId);
    this.videoEl = document.getElementById(videoId);
    if (!this.canvas) return;

    this.initWebGL();
    this.buildGeometries();
    this.setupInteractions();
    this.startRenderLoop();
  },

  initWebGL() {
    this.gl = this.canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true });
    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D Canvas');
      return;
    }
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Vertex Shader: Supports projection, model rotation, and layer explode offset
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec4 aColor;
      attribute float aLayer;

      uniform mat4 uProjection;
      uniform mat4 uModelView;
      uniform float uExplode;
      uniform float uPointSize;

      varying vec3 vNormal;
      varying vec4 vColor;
      varying vec3 vFragPos;

      void main() {
        vec3 displaced = aPosition;
        displaced.y += aLayer * uExplode * 1.8;
        
        vec4 pos = uModelView * vec4(displaced, 1.0);
        gl_Position = uProjection * pos;
        gl_PointSize = uPointSize;
        vNormal = mat3(uModelView) * aNormal;
        vColor = aColor;
        vFragPos = displaced;
      }
    `;

    // Fragment Shader: Supports realistic shading, CyArk LiDAR laser sweep, and wireframe
    const fsSource = `
      precision mediump float;
      varying vec3 vNormal;
      varying vec4 vColor;
      varying vec3 vFragPos;

      uniform int uRenderMode; // 0 = realistic, 1 = lidar, 2 = wireframe
      uniform float uScanTime;

      void main() {
        if (uRenderMode == 1) {
          // CyArk LiDAR Mode: Glowing neon phosphor with moving laser sweep
          float sweep = sin(vFragPos.y * 3.5 - uScanTime * 4.0);
          float laserIntensity = smoothstep(0.7, 1.0, sweep);
          vec3 lidarColor = mix(vec3(0.0, 0.95, 0.8), vec3(0.1, 1.0, 0.4), laserIntensity);
          gl_FragColor = vec4(lidarColor, 0.95);
        } else if (uRenderMode == 2) {
          // Wireframe Blueprint Mode
          gl_FragColor = vec4(0.2, 0.7, 1.0, 0.9);
        } else {
          // Realistic Shading
          vec3 lightDir = normalize(vec3(0.6, 1.2, 0.8));
          vec3 norm = normalize(vNormal);
          float diff = max(dot(norm, lightDir), 0.25);
          vec3 ambient = vec3(0.35, 0.32, 0.30);
          vec3 col = vColor.rgb * (ambient + diff * 0.75);
          gl_FragColor = vec4(col, vColor.a);
        }
      }
    `;

    const shaderProgram = this.createProgram(gl, vsSource, fsSource);
    this.programs.main = shaderProgram;

    this.locations = {
      position: gl.getAttribLocation(shaderProgram, 'aPosition'),
      normal: gl.getAttribLocation(shaderProgram, 'aNormal'),
      color: gl.getAttribLocation(shaderProgram, 'aColor'),
      layer: gl.getAttribLocation(shaderProgram, 'aLayer'),
      projection: gl.getUniformLocation(shaderProgram, 'uProjection'),
      modelView: gl.getUniformLocation(shaderProgram, 'uModelView'),
      explode: gl.getUniformLocation(shaderProgram, 'uExplode'),
      pointSize: gl.getUniformLocation(shaderProgram, 'uPointSize'),
      renderMode: gl.getUniformLocation(shaderProgram, 'uRenderMode'),
      scanTime: gl.getUniformLocation(shaderProgram, 'uScanTime')
    };
  },

  createProgram(gl, vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS compile error:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS compile error:', gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  },

  // Procedural 3D Monument Geometries
  buildGeometries() {
    this.models['colosseum'] = this.generateColosseumGeometry();
    this.models['tajmahal'] = this.generateTajMahalGeometry();
    this.models['dome-tomb'] = this.generateTajMahalGeometry();
    this.models['pagoda-gold'] = this.generatePagodaGeometry();
    this.models['wooden-stage'] = this.generateKiyomizuStageGeometry();
    this.models['torii-gate'] = this.generateToriiGeometry();
    this.models['pyramid'] = this.generatePyramidGeometry();
    this.models['sphinx'] = this.generateSphinxGeometry();
    this.models['arch'] = this.generateArchGeometry();
    this.models['pantheon'] = this.generatePantheonGeometry();
    this.models['rotunda'] = this.generateColosseumGeometry();
    this.models['fortress'] = this.generateRedFortGeometry();
    this.models['mamluk-mosque'] = this.generateSultanHassanGeometry();
    this.models['tower'] = this.generateQutbMinarGeometry();
    this.models['parthenon'] = this.generateParthenonGeometry();
    this.models['machu-picchu'] = this.generateMachuPicchuGeometry();
  },

  generateColosseumGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Base podium & hypogeum trenches (Layer 0)
    for (let r = 0; r < 20; r++) {
      for (let s = 0; s < 24; s++) {
        const rad = 0.5 + (r / 20) * 1.5;
        const theta = (s / 24) * Math.PI * 2;
        const x = Math.cos(theta) * rad;
        const z = Math.sin(theta) * rad;
        positions.push(x, -0.6, z);
        normals.push(0, 1, 0);
        colors.push(0.72, 0.65, 0.55, 1.0);
        layers.push(0.0);
      }
    }

    // Tier 1 Arches (Layer 1)
    const tiers = 4;
    for (let t = 0; t < tiers; t++) {
      const height = -0.6 + t * 0.35;
      const count = 36;
      const radius = 1.8 - t * 0.08;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Arched pillar
        for (let dy = 0; dy <= 4; dy++) {
          positions.push(x, height + dy * 0.08, z);
          normals.push(Math.cos(angle), 0.2, Math.sin(angle));
          colors.push(0.85 - t * 0.05, 0.78 - t * 0.05, 0.66 - t * 0.05, 1.0);
          layers.push(t * 0.3 + 0.2);
        }
      }
    }

    // Inner elliptical seating cavea (Layer 2)
    for (let level = 0; level < 6; level++) {
      const y = -0.5 + level * 0.2;
      const rad = 0.8 + level * 0.15;
      for (let a = 0; a < 32; a++) {
        const theta = (a / 32) * Math.PI * 2;
        positions.push(Math.cos(theta) * rad, y, Math.sin(theta) * rad);
        normals.push(0, 0.8, 0.2);
        colors.push(0.9, 0.85, 0.78, 1.0);
        layers.push(0.5);
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateTajMahalGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Layer 0: Marble Plinth Platform
    for (let x = -1.6; x <= 1.6; x += 0.2) {
      for (let z = -1.6; z <= 1.6; z += 0.2) {
        positions.push(x, -0.6, z);
        normals.push(0, 1, 0);
        colors.push(0.85, 0.35, 0.25, 1.0); // Red sandstone courtyard plinth
        layers.push(0.0);
      }
    }

    // Layer 1: White Marble Main Mausoleum Cube
    for (let y = -0.55; y <= 0.35; y += 0.12) {
      for (let a = 0; a < 24; a++) {
        const theta = (a / 24) * Math.PI * 2;
        const r = 0.9;
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        normals.push(Math.cos(theta), 0, Math.sin(theta));
        colors.push(0.96, 0.96, 0.98, 1.0);
        layers.push(0.3);
      }
    }

    // Layer 2: Iconic Central Onion Dome
    for (let v = 0; v <= 12; v++) {
      const phi = (v / 12) * Math.PI * 0.5;
      const y = 0.4 + Math.sin(phi) * 0.75;
      // Bulbous swelling profile
      const r = Math.cos(phi) * 0.65 * (1.0 + Math.sin(phi * 2.0) * 0.25);
      for (let u = 0; u < 24; u++) {
        const theta = (u / 24) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        normals.push(Math.cos(theta), Math.sin(phi), Math.sin(theta));
        colors.push(0.98, 0.98, 1.0, 1.0); // Makrana marble
        layers.push(0.8);
      }
    }

    // Layer 3: 4 Flanking Minarets
    const minaretOffsets = [
      [-1.3, -1.3], [1.3, -1.3],
      [-1.3, 1.3], [1.3, 1.3]
    ];
    minaretOffsets.forEach(([ox, oz]) => {
      for (let y = -0.6; y <= 1.1; y += 0.08) {
        for (let a = 0; a < 8; a++) {
          const theta = (a / 8) * Math.PI * 2;
          const r = 0.09 * (1.0 - (y + 0.6) * 0.15); // gentle taper
          // 2 degree lean away from dome
          const leanX = ox * 0.05 * (y + 0.6);
          const leanZ = oz * 0.05 * (y + 0.6);
          positions.push(ox + Math.cos(theta) * r + leanX, y, oz + Math.sin(theta) * r + leanZ);
          normals.push(Math.cos(theta), 0, Math.sin(theta));
          colors.push(0.95, 0.95, 0.96, 1.0);
          layers.push(0.1);
        }
      }
    });

    return this.bufferData(positions, normals, colors, layers);
  },

  generatePagodaGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // 5-Tiered Japanese Wooden Pagoda
    const storeys = 5;
    for (let s = 0; s < storeys; s++) {
      const baseY = -0.6 + s * 0.35;
      const roofRadius = 1.5 - s * 0.18;

      // Timber columns (Layer 0.2 * s)
      for (let a = 0; a < 12; a++) {
        const theta = (a / 12) * Math.PI * 2;
        const colR = roofRadius * 0.55;
        for (let dy = 0; dy <= 3; dy++) {
          positions.push(Math.cos(theta) * colR, baseY + dy * 0.06, Math.sin(theta) * colR);
          normals.push(Math.cos(theta), 0, Math.sin(theta));
          colors.push(0.78, 0.25, 0.18, 1.0); // Vermilion lacquer
          layers.push(s * 0.2);
        }
      }

      // Curved Hipped Eaves / Roofs (Layer 0.2 * s + 0.1)
      for (let r = 0; r <= 8; r++) {
        const rad = (r / 8) * roofRadius;
        const curvey = Math.pow(rad / roofRadius, 2.0) * 0.12;
        for (let u = 0; u < 20; u++) {
          const theta = (u / 20) * Math.PI * 2;
          positions.push(Math.cos(theta) * rad, baseY + 0.22 - curvey, Math.sin(theta) * rad);
          normals.push(0, 1, 0);
          colors.push(0.95, 0.78, 0.2, 1.0); // Gold leaf / copper thatch
          layers.push(s * 0.25 + 0.1);
        }
      }
    }

    // Sorin Spire at top
    for (let y = 1.2; y <= 1.8; y += 0.06) {
      positions.push(0, y, 0);
      normals.push(0, 1, 0);
      colors.push(1.0, 0.85, 0.2, 1.0);
      layers.push(1.2);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generatePyramidGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Stepped Tura Limestone Courses (Layer 0 to 1)
    const courses = 18;
    for (let c = 0; c <= courses; c++) {
      const y = -0.6 + (c / courses) * 1.5;
      const halfW = 1.4 * (1.0 - (c / courses));
      for (let step = -halfW; step <= halfW; step += 0.15) {
        // Front & Back edges
        positions.push(step, y, halfW);
        normals.push(0, 0.6, 0.8);
        colors.push(0.88, 0.78, 0.58, 1.0);
        layers.push((c / courses) * 0.5);

        positions.push(step, y, -halfW);
        normals.push(0, 0.6, -0.8);
        colors.push(0.85, 0.75, 0.55, 1.0);
        layers.push((c / courses) * 0.5);

        // Left & Right edges
        positions.push(halfW, y, step);
        normals.push(0.8, 0.6, 0);
        colors.push(0.90, 0.80, 0.60, 1.0);
        layers.push((c / courses) * 0.5);

        positions.push(-halfW, y, step);
        normals.push(-0.8, 0.6, 0);
        colors.push(0.82, 0.72, 0.52, 1.0);
        layers.push((c / courses) * 0.5);
      }
    }

    // Gilded Electrum Benben Apex Pyramidion (Top Layer)
    for (let p = 0; p < 8; p++) {
      positions.push((Math.random() - 0.5) * 0.1, 0.95 + Math.random() * 0.15, (Math.random() - 0.5) * 0.1);
      normals.push(0, 1, 0);
      colors.push(1.0, 0.88, 0.25, 1.0); // Gilded Electrum
      layers.push(0.8);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateArchGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Twin Piers & Corinthian Columns
    const pierX = [-0.9, 0.9];
    pierX.forEach(px => {
      for (let y = -0.6; y <= 0.6; y += 0.08) {
        for (let z = -0.5; z <= 0.5; z += 0.15) {
          positions.push(px, y, z);
          normals.push(px > 0 ? 1 : -1, 0, 0);
          colors.push(0.88, 0.82, 0.72, 1.0);
          layers.push(0.1);
        }
      }
    });

    // Central Semicircular Vault
    for (let a = 0; a <= 16; a++) {
      const angle = (a / 16) * Math.PI;
      const vx = Math.cos(angle) * 0.65;
      const vy = 0.5 + Math.sin(angle) * 0.45;
      for (let z = -0.5; z <= 0.5; z += 0.1) {
        positions.push(vx, vy, z);
        normals.push(-Math.cos(angle), -Math.sin(angle), 0);
        colors.push(0.92, 0.86, 0.76, 1.0);
        layers.push(0.4);
      }
    }

    // Triumphal Attic Story with Inscription
    for (let x = -1.1; x <= 1.1; x += 0.12) {
      for (let y = 1.0; y <= 1.4; y += 0.08) {
        positions.push(x, y, 0.4);
        normals.push(0, 0, 1);
        colors.push(0.95, 0.90, 0.80, 1.0);
        layers.push(0.7);

        positions.push(x, y, -0.4);
        normals.push(0, 0, -1);
        colors.push(0.85, 0.80, 0.70, 1.0);
        layers.push(0.7);
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generatePantheonGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Classical Octastyle Portico (8 Travertine Columns)
    for (let c = -1.2; c <= 1.2; c += 0.35) {
      for (let y = -0.6; y <= 0.4; y += 0.08) {
        positions.push(c, y, 1.3);
        normals.push(0, 0, 1);
        colors.push(0.9, 0.86, 0.78, 1.0);
        layers.push(0.1);
      }
    }
    // Portico Pediment Gable (Triangular)
    for (let x = -1.4; x <= 1.4; x += 0.15) {
      const topY = 0.4 + (1.0 - Math.abs(x) / 1.4) * 0.35;
      for (let y = 0.4; y <= topY; y += 0.08) {
        positions.push(x, y, 1.25);
        normals.push(0, 0.3, 0.9);
        colors.push(0.95, 0.9, 0.8, 1.0);
        layers.push(0.2);
      }
    }

    // Giant Cylindrical Rotunda Wall
    for (let y = -0.6; y <= 0.45; y += 0.09) {
      for (let a = 0; a < 36; a++) {
        const theta = (a / 36) * Math.PI * 2;
        const r = 1.35;
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        normals.push(Math.cos(theta), 0, Math.sin(theta));
        colors.push(0.85, 0.78, 0.68, 1.0);
        layers.push(0.3);
      }
    }

    // Stepped Hemispherical Concrete Dome with 9m Oculus
    for (let v = 0; v <= 10; v++) {
      const phi = (v / 10) * (Math.PI * 0.46); // leaves top open for oculus!
      const y = 0.45 + Math.sin(phi) * 0.85;
      const r = Math.cos(phi) * 1.35;
      for (let u = 0; u < 32; u++) {
        const theta = (u / 32) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        normals.push(Math.cos(theta), Math.sin(phi), Math.sin(theta));
        colors.push(0.82, 0.82, 0.84, 1.0); // Roman pozzolanic concrete
        layers.push(0.7);
      }
    }

    // Celestial Sunbeam streaming through Oculus
    for (let y = -0.5; y <= 1.2; y += 0.08) {
      const beamR = 0.15 + (1.2 - y) * 0.2;
      for (let b = 0; b < 8; b++) {
        const theta = (b / 8) * Math.PI * 2;
        positions.push(Math.cos(theta) * beamR, y, Math.sin(theta) * beamR);
        normals.push(0, 1, 0);
        colors.push(1.0, 0.95, 0.6, 0.8); // radiant solar beam
        layers.push(0.9);
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateToriiGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Twin Vermilion Cylindrical Pillars (Hashira)
    const pillarX = [-0.9, 0.9];
    pillarX.forEach(px => {
      positions.push(px, -0.6, 0);
      normals.push(0, 1, 0);
      colors.push(0.2, 0.2, 0.2, 1.0);
      layers.push(0.0);

      for (let y = -0.55; y <= 0.8; y += 0.07) {
        for (let a = 0; a < 10; a++) {
          const theta = (a / 10) * Math.PI * 2;
          const r = 0.11;
          positions.push(px + Math.cos(theta) * r, y, Math.sin(theta) * r);
          normals.push(Math.cos(theta), 0, Math.sin(theta));
          colors.push(0.95, 0.22, 0.12, 1.0); // Vibrant Cinnabar
          layers.push(0.2);
        }
      }
    });

    // Lower Horizontal Nuki Tie-Beam
    for (let x = -1.1; x <= 1.1; x += 0.1) {
      for (let dy = 0; dy <= 2; dy++) {
        positions.push(x, 0.45 + dy * 0.04, 0);
        normals.push(0, 0, 1);
        colors.push(0.95, 0.22, 0.12, 1.0);
        layers.push(0.4);
      }
    }

    // Upper Curved Kasagi Lintel (Winged Upturned Ends)
    for (let x = -1.4; x <= 1.4; x += 0.08) {
      const curve = Math.pow(x / 1.4, 2.0) * 0.12;
      for (let dy = 0; dy <= 2; dy++) {
        positions.push(x, 0.85 + dy * 0.05 + curve, 0);
        normals.push(0, 1, 0);
        colors.push(0.95, 0.22, 0.12, 1.0);
        layers.push(0.6);
      }
      positions.push(x, 0.98 + curve, 0);
      normals.push(0, 1, 0);
      colors.push(0.15, 0.15, 0.18, 1.0);
      layers.push(0.7);
    }

    // Sacred Gakuzuka Central Tablet
    for (let y = 0.55; y <= 0.82; y += 0.05) {
      positions.push(0, y, 0.06);
      normals.push(0, 0, 1);
      colors.push(0.1, 0.1, 0.1, 1.0);
      layers.push(0.5);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateKiyomizuStageGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Mount Otowa Cliff Foundation
    for (let x = -1.4; x <= 1.4; x += 0.25) {
      for (let z = -1.2; z <= 1.0; z += 0.25) {
        const cliffY = -0.7 + (z + 1.2) * 0.2;
        positions.push(x, cliffY, z);
        normals.push(0, 0.8, -0.4);
        colors.push(0.35, 0.45, 0.35, 1.0);
        layers.push(0.0);
      }
    }

    // 139 Interlocking Zelkova Columns (Kakezukuri Joinery)
    for (let ix = -1.1; ix <= 1.1; ix += 0.4) {
      for (let iz = -0.8; iz <= 0.8; iz += 0.4) {
        const bottomY = -0.6 + (iz + 0.8) * 0.15;
        for (let y = bottomY; y <= 0.3; y += 0.07) {
          positions.push(ix, y, iz);
          normals.push(1, 0, 0);
          colors.push(0.5, 0.32, 0.2, 1.0); // Aged Zelkova timber
          layers.push(0.2);
        }
      }
    }

    // Main Wooden Observation Stage Deck
    for (let px = -1.3; px <= 1.3; px += 0.1) {
      for (let pz = -0.9; pz <= 0.9; pz += 0.1) {
        positions.push(px, 0.32, pz);
        normals.push(0, 1, 0);
        colors.push(0.65, 0.48, 0.32, 1.0); // Hinoki cypress deck
        layers.push(0.4);
      }
    }

    // Main Temple Hall & Hinoki Bark Thatched Roof (Hiwada-buki)
    for (let ry = 0.35; ry <= 1.1; ry += 0.08) {
      const r = (1.1 - ry) * 1.2;
      for (let a = 0; a < 24; a++) {
        const theta = (a / 24) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, ry, Math.sin(theta) * r * 0.8 - 0.2);
        normals.push(0, 1, 0);
        colors.push(0.35, 0.26, 0.22, 1.0);
        layers.push(0.7);
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateSphinxGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Recumbent Lion Body
    for (let x = -0.45; x <= 0.45; x += 0.1) {
      for (let z = -1.2; z <= 0.6; z += 0.1) {
        const bodyH = 0.35 * Math.sin(((z + 1.2) / 1.8) * Math.PI);
        for (let y = -0.6; y <= -0.6 + bodyH; y += 0.08) {
          positions.push(x, y, z);
          normals.push(0, 1, 0);
          colors.push(0.85, 0.74, 0.52, 1.0);
          layers.push(0.2);
        }
      }
    }

    // Outstretched Forepaws
    [-0.3, 0.3].forEach(pawX => {
      for (let pz = 0.6; pz <= 1.3; pz += 0.08) {
        positions.push(pawX, -0.55, pz);
        normals.push(0, 1, 0);
        colors.push(0.82, 0.72, 0.5, 1.0);
        layers.push(0.1);
      }
    });

    // Dream Stele Tablet between paws
    for (let sy = -0.55; sy <= 0.0; sy += 0.06) {
      for (let sx = -0.12; sx <= 0.12; sx += 0.05) {
        positions.push(sx, sy, 0.9);
        normals.push(0, 0, 1);
        colors.push(0.92, 0.4, 0.25, 1.0);
        layers.push(0.3);
      }
    }

    // Sculpted Royal Nemes Portrait Head of Khafre
    for (let hy = -0.15; hy <= 0.65; hy += 0.07) {
      for (let a = 0; a < 20; a++) {
        const theta = (a / 20) * Math.PI * 2;
        const hr = 0.35 * (1.0 - (hy * 0.3));
        positions.push(Math.cos(theta) * hr, hy, Math.sin(theta) * hr + 0.3);
        normals.push(Math.cos(theta), 0.2, Math.sin(theta));
        const stripe = Math.sin(hy * 25.0) > 0;
        if (stripe) colors.push(0.92, 0.8, 0.3, 1.0);
        else colors.push(0.2, 0.4, 0.7, 1.0);
        layers.push(0.6);
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateQutbMinarGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // 5 Tapering Storeys of Fluted Red Sandstone
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const bottomY = -0.6 + t * 0.42;
      const topY = bottomY + 0.38;
      const baseR = 0.55 - t * 0.08;
      const topR = baseR - 0.06;

      for (let y = bottomY; y <= topY; y += 0.05) {
        const prog = (y - bottomY) / 0.38;
        const r = baseR + (topR - baseR) * prog;
        const flutes = 24;

        for (let f = 0; f < flutes; f++) {
          const theta = (f / flutes) * Math.PI * 2;
          const fluteMod = (f % 2 === 0) ? Math.sin(f * 2) * 0.04 : 0;
          positions.push(Math.cos(theta) * (r + fluteMod), y, Math.sin(theta) * (r + fluteMod));
          normals.push(Math.cos(theta), 0, Math.sin(theta));

          if (t >= 3) colors.push(0.92, 0.9, 0.92, 1.0);
          else colors.push(0.85 - t * 0.04, 0.32, 0.22, 1.0);
          layers.push(t * 0.2);
        }
      }

      // Stalactite Corbelled Projecting Balcony
      for (let b = 0; b < 28; b++) {
        const bTheta = (b / 28) * Math.PI * 2;
        positions.push(Math.cos(bTheta) * (topR + 0.12), topY, Math.sin(bTheta) * (topR + 0.12));
        normals.push(0, 1, 0);
        colors.push(0.95, 0.45, 0.25, 1.0);
        layers.push(t * 0.2 + 0.05);
      }
    }

    // Ancient Iron Pillar (400 AD) standing nearby
    for (let py = -0.6; py <= 0.2; py += 0.06) {
      positions.push(1.0, py, 0.6);
      normals.push(1, 0, 0);
      colors.push(0.25, 0.28, 0.32, 1.0);
      layers.push(0.1);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateRedFortGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Red Sandstone Ramparts (Enclosure Wall)
    for (let a = 0; a < 32; a++) {
      const theta = (a / 32) * Math.PI * 2;
      const r = 1.35;
      for (let y = -0.6; y <= 0.2; y += 0.07) {
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        normals.push(Math.cos(theta), 0, Math.sin(theta));
        colors.push(0.82, 0.28, 0.2, 1.0);
        layers.push(0.2);
      }
      if (a % 2 === 0) {
        positions.push(Math.cos(theta) * r, 0.26, Math.sin(theta) * r);
        normals.push(0, 1, 0);
        colors.push(0.88, 0.3, 0.22, 1.0);
        layers.push(0.3);
      }
    }

    // Twin Octagonal Bastions of Lahori Gate
    const bastionX = [-0.65, 0.65];
    bastionX.forEach(bx => {
      for (let y = -0.6; y <= 0.6; y += 0.08) {
        for (let o = 0; o < 8; o++) {
          const theta = (o / 8) * Math.PI * 2;
          const br = 0.25;
          positions.push(bx + Math.cos(theta) * br, y, 1.35 + Math.sin(theta) * br);
          normals.push(Math.cos(theta), 0, Math.sin(theta));
          colors.push(0.85, 0.3, 0.22, 1.0);
          layers.push(0.3);
        }
      }
      // White Marble Domed Chattri Kiosk on Bastions
      for (let cy = 0.6; cy <= 0.95; cy += 0.06) {
        const cr = (0.95 - cy) * 0.4;
        for (let c = 0; c < 12; c++) {
          const cTheta = (c / 12) * Math.PI * 2;
          positions.push(bx + Math.cos(cTheta) * cr, cy, 1.35 + Math.sin(cTheta) * cr);
          normals.push(0, 1, 0);
          colors.push(0.96, 0.96, 0.98, 1.0);
          layers.push(0.6);
        }
      }
    });

    // Central Vaulted Gate Arch
    for (let a = 0; a <= 12; a++) {
      const theta = (a / 12) * Math.PI;
      positions.push(Math.cos(theta) * 0.45, 0.15 + Math.sin(theta) * 0.35, 1.35);
      normals.push(0, 0, 1);
      colors.push(0.95, 0.4, 0.25, 1.0);
      layers.push(0.4);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateSultanHassanGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Monumental Four-Iwan Courtyard Walls
    for (let x = -1.2; x <= 1.2; x += 0.15) {
      for (let z = -1.2; z <= 1.2; z += 0.15) {
        if (Math.abs(x) > 0.9 || Math.abs(z) > 0.9) {
          for (let y = -0.6; y <= 0.5; y += 0.1) {
            positions.push(x, y, z);
            normals.push(0, 0, 1);
            colors.push(0.86, 0.78, 0.64, 1.0);
            layers.push(0.2);
          }
        }
      }
    }

    // Soaring Central Pointed Iwan Arch
    for (let a = 0; a <= 16; a++) {
      const angle = (a / 16) * Math.PI;
      const ix = Math.cos(angle) * 0.7;
      const iy = 0.2 + Math.sin(angle) * 0.6;
      for (let z = 0.2; z <= 0.9; z += 0.15) {
        positions.push(ix, iy, z);
        normals.push(-Math.cos(angle), -Math.sin(angle), 0);
        colors.push(0.9, 0.82, 0.68, 1.0);
        layers.push(0.4);
      }
    }

    // 68-Meter Soaring Mamluk Minaret
    for (let my = -0.6; my <= 1.6; my += 0.08) {
      for (let ma = 0; ma < 8; ma++) {
        const theta = (ma / 8) * Math.PI * 2;
        const mr = 0.16 * (1.0 - (my + 0.6) * 0.12);
        positions.push(-1.0 + Math.cos(theta) * mr, my, -1.0 + Math.sin(theta) * mr);
        normals.push(Math.cos(theta), 0, Math.sin(theta));
        colors.push(0.88, 0.8, 0.65, 1.0);
        layers.push(0.3);
      }
    }

    // Central Marble Ablution Fountain Pavilion
    for (let a = 0; a < 16; a++) {
      const theta = (a / 16) * Math.PI * 2;
      positions.push(Math.cos(theta) * 0.35, -0.4, Math.sin(theta) * 0.35);
      normals.push(0, 1, 0);
      colors.push(0.95, 0.95, 0.98, 1.0);
      layers.push(0.1);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  bufferData(positions, normals, colors, layers) {
    const gl = this.gl;
    const vao = {
      count: positions.length / 3,
      posBuf: gl.createBuffer(),
      normBuf: gl.createBuffer(),
      colBuf: gl.createBuffer(),
      layBuf: gl.createBuffer()
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.layBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(layers), gl.STATIC_DRAW);

    return vao;
  },

  setupInteractions() {
    if (!this.canvas) return;

    // Mouse Controls
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.rotationY += dx * 0.01;
      this.rotationX += dy * 0.01;
      this.rotationX = Math.max(-1.2, Math.min(1.2, this.rotationX));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scale += e.deltaY * -0.0015;
      this.scale = Math.max(0.5, Math.min(2.5, this.scale));
    }, { passive: false });

    // Touch Controls
    let lastTouchDist = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouseX;
        const dy = e.touches[0].clientY - this.lastMouseY;
        this.rotationY += dx * 0.01;
        this.rotationX += dy * 0.01;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist > 0) {
          this.scale += (dist - lastTouchDist) * 0.005;
          this.scale = Math.max(0.5, Math.min(2.5, this.scale));
        }
        lastTouchDist = dist;
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      lastTouchDist = 0;
    });
  },

  startRenderLoop() {
    const render = (time) => {
      this.scanSweepTime = time * 0.001;
      this.renderFrame();
      this.animationId = requestAnimationFrame(render);
    };
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(render);
  },

  renderFrame() {
    const gl = this.gl;
    if (!gl) return;

    // Auto-resize
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
    const displayHeight = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    gl.clearColor(0, 0, 0, 0); // Transparent background for camera feed
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const modelKey = this.models[this.currentModel] ? this.currentModel : 'colosseum';
    const geo = this.models[modelKey];
    if (!geo) return;

    const prog = this.programs.main;
    gl.useProgram(prog);

    // Matrix Computations
    const aspect = gl.canvas.width / (gl.canvas.height || 1);
    const projMat = this.createPerspectiveMatrix(45 * Math.PI / 180, aspect, 0.1, 100.0);
    
    // ModelView Matrix with rotations and zoom
    if (this.autoOrbit) {
      this.rotationY += 0.008;
    }
    let mvMat = this.createIdentityMatrix();
    mvMat = this.translateMatrix(mvMat, 0.0, 0.0, -3.8);
    mvMat = this.rotateX(mvMat, this.rotationX);
    mvMat = this.rotateY(mvMat, this.rotationY);
    mvMat = this.scaleMatrix(mvMat, this.scale, this.scale, this.scale);

    gl.uniformMatrix4fv(this.locations.projection, false, projMat);
    gl.uniformMatrix4fv(this.locations.modelView, false, mvMat);
    gl.uniform1f(this.locations.explode, this.explodeRatio);
    gl.uniform1f(this.locations.scanTime, this.scanSweepTime);

    let modeCode = 0;
    let pointSize = 3.5;
    if (this.renderMode === 'lidar') {
      modeCode = 1;
      pointSize = 4.0;
    } else if (this.renderMode === 'wireframe') {
      modeCode = 2;
      pointSize = 2.0;
    }
    gl.uniform1i(this.locations.renderMode, modeCode);
    gl.uniform1f(this.locations.pointSize, pointSize);

    // Bind Buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.posBuf);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.locations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, geo.normBuf);
    gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.locations.normal);

    gl.bindBuffer(gl.ARRAY_BUFFER, geo.colBuf);
    gl.vertexAttribPointer(this.locations.color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.locations.color);

    gl.bindBuffer(gl.ARRAY_BUFFER, geo.layBuf);
    gl.vertexAttribPointer(this.locations.layer, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.locations.layer);

    // Draw
    if (this.renderMode === 'lidar') {
      gl.drawArrays(gl.POINTS, 0, geo.count);
    } else if (this.renderMode === 'wireframe') {
      gl.drawArrays(gl.LINE_STRIP, 0, geo.count);
    } else {
      gl.drawArrays(gl.POINTS, 0, geo.count);
      gl.drawArrays(gl.LINE_STRIP, 0, geo.count);
    }
  },

  // Matrix Helpers
  createIdentityMatrix() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  },

  createPerspectiveMatrix(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  },

  translateMatrix(m, tx, ty, tz) {
    const out = new Float32Array(m);
    out[12] = m[0] * tx + m[4] * ty + m[8] * tz + m[12];
    out[13] = m[1] * tx + m[5] * ty + m[9] * tz + m[13];
    out[14] = m[2] * tx + m[6] * ty + m[10] * tz + m[14];
    out[15] = m[3] * tx + m[7] * ty + m[11] * tz + m[15];
    return out;
  },

  rotateX(m, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(m);
    out[4] = m[4] * c + m[8] * s;
    out[5] = m[5] * c + m[9] * s;
    out[6] = m[6] * c + m[10] * s;
    out[7] = m[7] * c + m[11] * s;
    out[8] = m[8] * c - m[4] * s;
    out[9] = m[9] * c - m[5] * s;
    out[10] = m[10] * c - m[6] * s;
    out[11] = m[11] * c - m[7] * s;
    return out;
  },

  rotateY(m, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(m);
    out[0] = m[0] * c - m[8] * s;
    out[1] = m[1] * c - m[9] * s;
    out[2] = m[2] * c - m[10] * s;
    out[3] = m[3] * c - m[11] * s;
    out[8] = m[0] * s + m[8] * c;
    out[9] = m[1] * s + m[9] * c;
    out[10] = m[2] * s + m[10] * c;
    out[11] = m[3] * s + m[11] * c;
    return out;
  },

  scaleMatrix(m, sx, sy, sz) {
    const out = new Float32Array(m);
    out[0] *= sx; out[1] *= sx; out[2] *= sx; out[3] *= sx;
    out[4] *= sy; out[5] *= sy; out[6] *= sy; out[7] *= sy;
    out[8] *= sz; out[9] *= sz; out[10] *= sz; out[11] *= sz;
    return out;
  },

  // WebAR Camera Controller
  async toggleCamera() {
    if (this.isCameraActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  },

  async startCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (this.videoEl) {
          this.videoEl.srcObject = this.cameraStream;
          await this.videoEl.play();
          this.videoEl.style.display = 'block';
          this.isCameraActive = true;
          document.getElementById('simulated-env').style.display = 'none';
          App.showToast('✨ Camera WebAR Connected: Point at landmark horizon');
        }
      } else {
        throw new Error('Camera API not available');
      }
    } catch (err) {
      console.warn('Real camera stream unavailable or denied, using simulated environment:', err.message);
      this.isCameraActive = false;
      if (this.videoEl) this.videoEl.style.display = 'none';
      document.getElementById('simulated-env').style.display = 'block';
      App.showToast('📷 Camera unavailable: Switched to Simulated Heritage Plaza Panorama');
    }
  },

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    if (this.videoEl) this.videoEl.style.display = 'none';
    this.isCameraActive = false;
    document.getElementById('simulated-env').style.display = 'block';
  },

  setRenderMode(mode) {
    this.renderMode = mode;
    document.querySelectorAll('.ar-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    App.showToast(`Rendering mode switched to: ${mode.toUpperCase()}`);
  },

  setModel(modelType) {
    this.currentModel = modelType;
  },

  setExplode(val) {
    this.explodeRatio = parseFloat(val);
  },

  setScale(val) {
    this.scale = parseFloat(val);
  },

  setViewpoint(view) {
    if (view === 'front') {
      this.rotationX = 0.15;
      this.rotationY = 0.0;
      this.scale = 1.0;
      this.autoOrbit = false;
      App.showToast('👁️ Viewpoint: Monument Front Facade');
    } else if (view === 'drone') {
      this.rotationX = 0.95;
      this.rotationY = 0.78;
      this.scale = 0.85;
      this.autoOrbit = false;
      App.showToast('🦅 Viewpoint: Aerial Drone Telemetry');
    } else if (view === 'hypogeum') {
      this.rotationX = -0.35;
      this.rotationY = 0.45;
      this.scale = 1.25;
      this.autoOrbit = false;
      this.setExplode(0.5);
      const expEl = document.getElementById('explode-val-txt');
      if (expEl) expEl.textContent = '50%';
      App.showToast('🔍 Viewpoint: Subterranean Hypogeum & Vaults');
    } else if (view === 'orbit') {
      this.autoOrbit = !this.autoOrbit;
      App.showToast(this.autoOrbit ? '🔄 360° Continuous Orbit Mode Active' : '⏸ Orbit Mode Paused');
    }
  },

  setSimulatedEnv(env) {
    this.simulatedEnv = env;
    const el = document.getElementById('simulated-env');
    if (!el) return;

    const envs = {
      forum: 'https://images.unsplash.com/photo-1543429776-2782fb5a3887?auto=format&fit=crop&w=1200&q=80',
      mughal: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
      kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
      giza: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80'
    };
    el.style.backgroundImage = `url('${envs[env] || envs.forum}')`;
  },

  setChronoRatio(ratio) {
    this.chronoRatio = parseFloat(ratio);
    const label = document.getElementById('chrono-val');
    if (label) {
      if (this.chronoRatio < 0.25) label.textContent = 'Modern Preserved State';
      else if (this.chronoRatio < 0.75) label.textContent = 'Partial Classical Restoration';
      else label.textContent = 'Ancient Golden Era Glory ✨';
    }
  },

  setLidarDensity(density) {
    this.lidarDensity = parseFloat(density);
  },

  generateParthenonGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Stepped Stylobate Podium (3 marble steps, Layer 0.0)
    for (let step = 0; step < 3; step++) {
      const w = 1.9 - step * 0.08;
      const d = 1.2 - step * 0.06;
      const y = -0.6 + step * 0.06;
      for (let x = -w; x <= w; x += 0.12) {
        for (let z = -d; z <= d; z += 0.12) {
          positions.push(x, y, z);
          normals.push(0, 1, 0);
          colors.push(0.92, 0.90, 0.85, 1.0);
          layers.push(0.0);
        }
      }
    }

    // Outer Peristyle Colonnade (Doric columns: 8 front/back, 17 along flanks, Layer 0.3)
    const colCols = [-1.6, -1.2, -0.8, -0.4, 0.0, 0.4, 0.8, 1.2, 1.6];
    const colRows = [-0.95, -0.65, -0.35, 0.0, 0.35, 0.65, 0.95];

    const placeCol = (cx, cz) => {
      for (let y = -0.42; y <= 0.45; y += 0.07) {
        for (let a = 0; a < 8; a++) {
          const theta = (a / 8) * Math.PI * 2;
          const r = 0.08 * (1.0 - (y + 0.42) * 0.08); // subtle entasis
          positions.push(cx + Math.cos(theta) * r, y, cz + Math.sin(theta) * r);
          normals.push(Math.cos(theta), 0, Math.sin(theta));
          colors.push(0.96, 0.94, 0.90, 1.0);
          layers.push(0.3);
        }
      }
    };

    colCols.forEach(x => {
      placeCol(x, -0.95);
      placeCol(x, 0.95);
    });
    colRows.forEach(z => {
      placeCol(-1.6, z);
      placeCol(1.6, z);
    });

    // Entablature & Architrave (Layer 0.6)
    for (let x = -1.75; x <= 1.75; x += 0.08) {
      for (let z = -1.05; z <= 1.05; z += 0.08) {
        if (Math.abs(x) >= 1.4 || Math.abs(z) >= 0.8) {
          positions.push(x, 0.52, z);
          normals.push(0, 1, 0);
          colors.push(0.94, 0.92, 0.86, 1.0);
          layers.push(0.6);
        }
      }
    }

    // Triangular Pediments & Roof Gables (Layer 0.9)
    for (let side = -1; side <= 1; side += 2) {
      const z = side * 1.0;
      for (let x = -1.7; x <= 1.7; x += 0.08) {
        const peakY = 0.55 + (1.0 - Math.abs(x) / 1.7) * 0.35;
        for (let y = 0.55; y <= peakY; y += 0.06) {
          positions.push(x, y, z);
          normals.push(0, 0, side);
          colors.push(0.98, 0.88, 0.45, 1.0); // gilded pediment sculptures
          layers.push(0.9);
        }
      }
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  generateMachuPicchuGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    const layers = [];

    // Stepped Andean Agricultural Terraces (Granite Bedrock Contours, Layer 0.0 - 0.2)
    for (let t = 0; t < 5; t++) {
      const y = -0.7 + t * 0.2;
      const r = 2.0 - t * 0.25;
      for (let a = 0; a < 36; a++) {
        const theta = (a / 36) * Math.PI * 2;
        const x = Math.cos(theta) * r + Math.sin(theta * 3.0) * 0.15;
        const z = Math.sin(theta) * r * 0.7;
        positions.push(x, y, z);
        normals.push(0, 1, 0);
        // Andean grass green & granite gray
        colors.push(0.25 + t * 0.05, 0.45 + t * 0.04, 0.22, 1.0);
        layers.push(t * 0.05);
      }
    }

    // Semicircular Torreón (Temple of the Sun, Curved Wall, Layer 0.5)
    for (let a = 0; a <= 20; a++) {
      const theta = (a / 20) * Math.PI * 1.2 - 0.3;
      const r = 0.45;
      for (let y = 0.0; y <= 0.6; y += 0.08) {
        positions.push(-0.6 + Math.cos(theta) * r, y, -0.2 + Math.sin(theta) * r);
        normals.push(Math.cos(theta), 0, Math.sin(theta));
        colors.push(0.82, 0.80, 0.78, 1.0); // Imperial Inca Ashlar
        layers.push(0.5);
      }
    }

    // Sacred Plaza Principal Temple (Three Walls, Layer 0.6)
    for (let x = 0.1; x <= 0.9; x += 0.08) {
      for (let y = 0.1; y <= 0.7; y += 0.08) {
        positions.push(x, y, 0.5);
        normals.push(0, 0, -1);
        colors.push(0.85, 0.83, 0.80, 1.0);
        layers.push(0.6);
      }
    }
    for (let z = 0.0; z <= 0.5; z += 0.08) {
      for (let y = 0.1; y <= 0.7; y += 0.08) {
        positions.push(0.1, y, z);
        normals.push(1, 0, 0);
        colors.push(0.85, 0.83, 0.80, 1.0);
        layers.push(0.6);

        positions.push(0.9, y, z);
        normals.push(-1, 0, 0);
        colors.push(0.85, 0.83, 0.80, 1.0);
        layers.push(0.6);
      }
    }

    // Intihuatana Bedrock Monolith & Inclined Solar Prism (Layer 0.9)
    for (let dy = 0.4; dy <= 0.95; dy += 0.06) {
      positions.push(0.0, dy, 0.0);
      normals.push(0, 1, 0);
      colors.push(0.95, 0.88, 0.55, 1.0); // sacred solar stone
      layers.push(0.9);

      positions.push(Math.sin((dy - 0.4) * 0.22), dy, 0.05);
      normals.push(0.2, 0.9, 0.0);
      colors.push(1.0, 0.92, 0.5, 1.0);
      layers.push(0.9);
    }

    return this.bufferData(positions, normals, colors, layers);
  },

  // Take Composite AR Snapshot
  captureSnapshot() {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 1280;
    snapCanvas.height = 720;
    const ctx = snapCanvas.getContext('2d');

    // 1. Draw Background (Video or Simulated Environment)
    if (this.isCameraActive && this.videoEl && this.videoEl.videoWidth) {
      ctx.drawImage(this.videoEl, 0, 0, snapCanvas.width, snapCanvas.height);
    } else {
      ctx.fillStyle = '#141A24';
      ctx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);
      ctx.fillStyle = '#D4AF37';
      ctx.font = '24px Cinzel, serif';
      ctx.fillText('HERITAGE ROUTE AUGMENTED REALITY', 40, 60);
    }

    // 2. Draw 3D Model WebGL Canvas
    if (this.canvas) {
      ctx.drawImage(this.canvas, 0, 0, snapCanvas.width, snapCanvas.height);
    }

    // 3. Draw CyArk / izi.TRAVEL Archival Watermark & GPS Telemetry
    ctx.fillStyle = 'rgba(11, 14, 20, 0.75)';
    ctx.fillRect(20, snapCanvas.height - 80, snapCanvas.width - 40, 60);

    ctx.fillStyle = '#E5B842';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('🏛️ HERITAGE ROUTE DIGITAL GUIDE • AR ARCHIVAL SNAPSHOT', 40, snapCanvas.height - 44);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px JetBrains Mono, monospace';
    const timestamp = new Date().toUTCString();
    ctx.fillText(`CyArk 3D Mode: ${this.renderMode.toUpperCase()} | GPS: 41.8902°N, 12.4922°E | Captured: ${timestamp}`, 40, snapCanvas.height - 26);

    // Auto-download as JPEG
    const link = document.createElement('a');
    link.download = `Heritage_AR_Snapshot_${Date.now()}.jpg`;
    link.href = snapCanvas.toDataURL('image/jpeg', 0.92);
    link.click();

    App.showToast('📸 AR Snapshot Captured and Saved to Gallery!');
    App.trackEvent('ar_interaction', App.state.activeLandmarkId);
  }
};

window.WebAR = WebAR;
