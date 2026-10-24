"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Domain-warped fbm smoke, lit with a cool white core and a lime rim.
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.045;

  vec2 m = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float md = length(p - m);
  p += (p - m) * 0.12 * exp(-md * 2.5);

  vec2 drift = vec2(-t * 0.6, -t * 1.4);
  vec2 q = vec2(fbm(p * 1.3 + drift), fbm(p * 1.3 + vec2(5.2, 1.3) - drift.yx));
  vec2 r = vec2(fbm(p * 1.5 + 3.2 * q + vec2(1.7, 9.2) + t * 1.2),
                fbm(p * 1.5 + 3.2 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.1 + 2.6 * r + drift * 1.5);

  // Plume rises from the lower right and thins toward the copy on the left.
  float plume = smoothstep(-1.1, 0.55, p.x + 0.25 * sin(p.y * 2.0 + t * 4.0));
  plume *= 0.6 + 0.4 * smoothstep(0.85, -0.6, uv.y - 0.15 * uv.x);
  float density = smoothstep(0.3, 0.82, f) * plume;
  density = pow(density, 1.25);

  vec3 base = vec3(0.051, 0.055, 0.071);
  vec3 smoke = mix(vec3(0.45, 0.48, 0.54), vec3(0.95, 0.96, 0.98), smoothstep(0.5, 0.9, f));
  vec3 lime = vec3(0.79, 0.93, 0.36);
  float rim = smoothstep(0.5, 1.1, length(r)) * density;

  vec3 col = base + smoke * density * 0.95 + lime * rim * 0.55;
  col += lime * 0.035 * smoothstep(1.2, 0.0, length(p - vec2(0.7, -0.45)));
  col *= 1.0 - 0.45 * pow(length(uv - vec2(0.62, 0.5)), 1.6);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * Procedural vapor background. Renders at reduced resolution (smoke is soft anyway),
 * pauses offscreen and in hidden tabs, and draws a single still frame for reduced motion.
 */
export function VaporCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0.75, y: 0.35, tx: 0.75, ty: 0.35 };
    const scale = 0.5;

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (time: number) => {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, 18 + time / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let frame = 0;
    let visible = true;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!frame && visible && !document.hidden && !reduce) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (e.clientY - rect.top) / rect.height;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    const ro = new ResizeObserver(() => reduce && draw(0));
    ro.observe(canvas);

    if (reduce) draw(0);
    else start();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={cn("block size-full", className)} />;
}
