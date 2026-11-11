import type { SpatialCursor } from "./protocol";

export interface HUDRenderer {
  initialize(): void;
  update(cursor: SpatialCursor): void;
  remove(id: string): void;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

const vertices = new Float32Array([
  -1, 1.618, 0, 1, 1.618, 0, -1, -1.618, 0, 1, -1.618, 0,
  0, -1, 1.618, 0, 1, 1.618, 0, -1, 1.618, 0, -1, -1.618,
  1.618, 0, -1, -1.618, 1.618, 0, 1, 1.618, 0, 1, -1,
  -1.618, 0, -1, 1.618, 0, -1, -1.618, 0, 1, 1.618, 0,
  1, -1.618, 0, -1, 1, -1.618, 0, 1, 1.618, 0, 1, -1,
  1.618, 0, 1, -1.618, 0, -1, 1.618, 0, -1, -1.618,
  1.618, 0, -1, -1.618, 1.618, 0, 1, -1.618, 0, 1,
  1.618, 0, 1, -1.618, 0, -1, 1.618, 0,
]);
const edgeIndices = new Uint16Array([
  0,1, 0,5, 0,7, 0,10, 0,11, 1,5, 1,7, 1,8, 1,9, 2,4,
  2,6, 2,10, 2,11, 3,4, 3,6, 3,8, 3,9, 4,5, 4,6, 4,9,
  5,8, 6,10, 7,8, 7,9, 7,10, 7,11, 8,9, 9,11, 10,11, 5,6,
]);
const vertexShader = `attribute vec3 aPosition; uniform float uAngle; uniform float uAspect; uniform float uPoints; void main(){ if(uPoints > 0.5){ gl_Position=vec4(aPosition,1.0); gl_PointSize=6.0; } else { float c=cos(uAngle); float s=sin(uAngle); vec3 p=vec3(c*aPosition.x+s*aPosition.z,aPosition.y,-s*aPosition.x+c*aPosition.z); float d=4.8+p.z; gl_Position=vec4(p.x*2.7/d/uAspect,p.y*2.7/d,0.0,1.0); gl_PointSize=1.0; } }`;
const fragmentShader = `precision mediump float; uniform float uPoints; void main(){ if(uPoints > 0.5){ gl_FragColor=vec4(1.0,0.67,0.0,0.95); } else { gl_FragColor=vec4(0.0,1.0,0.8,0.92); } }`;

export class WebGLHUDRenderer implements HUDRenderer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private geometryBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private pointBuffer: WebGLBuffer | null = null;
  private frame = 0;
  private startedAt = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private cursors = new Map<string, SpatialCursor>();
  private angleLocation: WebGLUniformLocation | null = null;
  private aspectLocation: WebGLUniformLocation | null = null;
  private pointsLocation: WebGLUniformLocation | null = null;
  private positionLocation = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  initialize() {
    const gl = this.canvas.getContext("webgl2", { alpha: true, antialias: true }) ?? this.canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) throw new Error("WebGL is unavailable");
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error("Could not create WebGL program");
    const vertex = this.compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const reason = gl.getProgramInfoLog(program) ?? "WebGL program link failed";
      gl.deleteProgram(program);
      throw new Error(reason);
    }
    this.program = program;
    this.positionLocation = gl.getAttribLocation(program, "aPosition");
    this.angleLocation = gl.getUniformLocation(program, "uAngle");
    this.aspectLocation = gl.getUniformLocation(program, "uAspect");
    this.pointsLocation = gl.getUniformLocation(program, "uPoints");
    this.geometryBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.pointBuffer = gl.createBuffer();
    if (!this.geometryBuffer || !this.indexBuffer || !this.pointBuffer) throw new Error("Could not allocate WebGL buffers");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeIndices, gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.startedAt = performance.now();
    this.resize(this.width, this.height, this.pixelRatio);
    this.draw();
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create WebGL shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const reason = gl.getShaderInfoLog(shader) ?? "WebGL shader compilation failed";
      gl.deleteShader(shader);
      throw new Error(reason);
    }
    return shader;
  }

  update(cursor: SpatialCursor) { this.cursors.set(cursor.id, cursor); }
  remove(id: string) { this.cursors.delete(id); }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.min(2, Math.max(1, pixelRatio));
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw = () => {
    const gl = this.gl;
    if (!gl || !this.program || gl.isContextLost()) return;
    const program = this.program;
    gl.clearColor(0.004, 0.008, 0.012, 0.94);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.uniform1f(this.aspectLocation, this.canvas.width / Math.max(1, this.canvas.height));
    gl.uniform1f(this.angleLocation, (performance.now() - this.startedAt) * 0.00025);
    gl.uniform1f(this.pointsLocation, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
    gl.vertexAttribPointer(this.positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.LINES, edgeIndices.length, gl.UNSIGNED_SHORT, 0);
    if (this.cursors.size && this.pointBuffer) {
      const positions = new Float32Array(this.cursors.size * 3);
      let i = 0;
      for (const cursor of this.cursors.values()) {
        positions[i++] = cursor.x * 2 - 1;
        positions[i++] = 1 - cursor.y * 2;
        positions[i++] = 0;
      }
      gl.uniform1f(this.pointsLocation, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, positions.length / 3);
    }
    this.frame = requestAnimationFrame(this.draw);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      if (this.geometryBuffer) gl.deleteBuffer(this.geometryBuffer);
      if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
      if (this.pointBuffer) gl.deleteBuffer(this.pointBuffer);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.geometryBuffer = this.indexBuffer = this.pointBuffer = null;
    this.program = null;
    this.gl = null;
    this.cursors.clear();
  }
}

export class Canvas2DHUDRenderer implements HUDRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private frame = 0;
  private startedAt = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private cursors = new Map<string, SpatialCursor>();
  constructor(private readonly canvas: HTMLCanvasElement) {}
  initialize() {
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) throw new Error("2D canvas is unavailable");
    this.startedAt = performance.now();
    this.draw();
  }
  update(cursor: SpatialCursor) { this.cursors.set(cursor.id, cursor); }
  remove(id: string) { this.cursors.delete(id); }
  resize(width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.pixelRatio = Math.min(2, Math.max(1, pixelRatio));
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
  }
  private draw = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = "#030507";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(0,255,204,.08)";
    for (let x = 0; x < this.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
    for (let y = 0; y < this.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }
    const pulse = Math.sin((performance.now() - this.startedAt) / 650) * 10;
    ctx.strokeStyle = "#00ffcc";
    ctx.beginPath(); ctx.arc(this.width / 2, this.height / 2, 110 + pulse, 0, Math.PI * 2); ctx.stroke();
    for (const [id, cursor] of this.cursors) {
      const x = cursor.x * this.width, y = cursor.y * this.height;
      ctx.fillStyle = cursor.mode.toLowerCase().includes("active") ? "#00ffcc" : "#ffaa00";
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "11px monospace"; ctx.fillText(id, x + 9, y + 4);
    }
    void w; void h;
    this.frame = requestAnimationFrame(this.draw);
  };
  dispose() { cancelAnimationFrame(this.frame); this.cursors.clear(); this.ctx = null; }
}
