// src/components/AnimatedBackground.jsx
import { useEffect, useRef } from "react";

export default function AnimatedBackground({ className = "" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  const mouse = useRef({ x: 0, y: 0, active: false });
  const isMouseDown = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const state = {
      w: 0,
      h: 0,
      t: 0,
      particles: [],
      // attraction radius animates in/out just from hovering
      cursorDist: 0,
      // rupture shockwaves
      shockwaves: [], // {x,y,r,vr,life}
      linkFade: 0,    // lowers link opacity briefly after rupture
    };

    function resize() {
      state.w = canvas.clientWidth;
      state.h = canvas.clientHeight;
      canvas.width = Math.floor(state.w * dpr);
      canvas.height = Math.floor(state.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- TUNABLES ----
    const P_COUNT = 260;           // particle density
    const MAX_LINK = 130;          // particle-to-particle link distance
    const HOVER_ATTR_MAX = 220;    // max attraction radius when hovering
    const HOVER_ATTR_STEP = 10;    // how fast the radius grows/shrinks
    const ATTR_FORCE = 3.2;        // attraction strength
    const BASE_DAMP = 0.99;        // velocity damping each frame
    const SHOCK_IMPULSE = 4.5;     // outward push on rupture
    const SHOCK_VR = 6.0;          // shockwave expansion speed (px/frame)
    const SHOCK_LIFE = 900;        // how long the shockwave is drawn (ms)
    const LINK_FADE_TIME = 700;    // links dim for this long (ms)
    // -------------------

    function initParticles() {
      state.particles = Array.from({ length: P_COUNT }, () => ({
        x: Math.random() * state.w,
        y: Math.random() * state.h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 0.9 + Math.random() * 1.6,
      }));
    }

    function step(dt) {
      state.t += dt;

      // Animate attraction radius based on hovering only
      const target = mouse.current.active ? HOVER_ATTR_MAX : 0;
      if (state.cursorDist < target) state.cursorDist = Math.min(target, state.cursorDist + HOVER_ATTR_STEP);
      else if (state.cursorDist > target) state.cursorDist = Math.max(0, state.cursorDist - HOVER_ATTR_STEP);

      // Decay link fade after ruptures
      if (state.linkFade > 0) state.linkFade = Math.max(0, state.linkFade - dt);

      // Advance shockwaves
      for (const sw of state.shockwaves) {
        sw.r += sw.vr;
        sw.life -= dt;
      }
      // Remove dead shockwaves
      state.shockwaves = state.shockwaves.filter(sw => sw.life > 0);

      // Update particles
      for (const p of state.particles) {
        // Hover gravitational pull
        if (mouse.current.active && state.cursorDist > 0) {
          const dx = mouse.current.x - p.x;
          const dy = mouse.current.y - p.y;
          const d2 = dx * dx + dy * dy;
          const ar = state.cursorDist;
          if (d2 < ar * ar) {
            const d = Math.sqrt(d2) || 0.001;
            const force = (ar - d) / ar;
            p.vx += (dx / d) * force * ATTR_FORCE;
            p.vy += (dy / d) * force * ATTR_FORCE;
          }
        }

        // Rupture: outward shockwave impulse
        if (state.shockwaves.length) {
          for (const sw of state.shockwaves) {
            const dx = p.x - sw.x;
            const dy = p.y - sw.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
            // Give an impulse when the wavefront passes the particle (within a band)
            const band = 18; // thickness of shock band
            if (d > sw.r - band && d < sw.r + band) {
              const push = (1 - Math.abs(d - sw.r) / band) * SHOCK_IMPULSE;
              p.vx += (dx / d) * push;
              p.vy += (dy / d) * push;
            }
          }
        }

        // Integrate & damp
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= BASE_DAMP;
        p.vy *= BASE_DAMP;

        // Wrap at edges
        if (p.x > state.w) p.x = 0;
        if (p.x < 0) p.x = state.w;
        if (p.y > state.h) p.y = 0;
        if (p.y < 0) p.y = state.h;
      }
    }

    function draw() {
      // Background gradient
      const g = ctx.createLinearGradient(0, 0, state.w, state.h);
      g.addColorStop(0, "#0b1020");
      g.addColorStop(1, "#0a0f1a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, state.w, state.h);

      // Draw links (fade when ruptured)
      const linkOpacityScale = 0.22 * (1 - Math.min(1, state.linkFade / LINK_FADE_TIME));
      for (let i = 0; i < state.particles.length; i++) {
        const p = state.particles[i];
        for (let j = i + 1; j < state.particles.length; j++) {
          const q = state.particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_LINK) {
            const a = (1 - dist / MAX_LINK) * linkOpacityScale;
            if (a > 0.002) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(255,255,255,${a})`;
              ctx.stroke();
            }
          }
        }
      }

      // Nodes
      for (const p of state.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fill();
      }

      // Links to cursor (green-ish “gravity” filaments)
      if (mouse.current.active && state.cursorDist > 0) {
        for (const p of state.particles) {
          const dx = p.x - mouse.current.x;
          const dy = p.y - mouse.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < state.cursorDist) {
            const a = 1 - dist / state.cursorDist;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.current.x, mouse.current.y);
            ctx.strokeStyle = `rgba(144,238,144,${a * 0.5})`;
            ctx.stroke();
          }
        }
      }

      // Draw shockwaves
      for (const sw of state.shockwaves) {
        const alpha = Math.max(0, sw.life / SHOCK_LIFE) * 0.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(173,216,230,${alpha})`; // soft cyan ring
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    let last = 0;
    function loop(t) {
      const dt = t - last;
      last = t;
      step(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    // === EVENTS ON WINDOW so it works even over the card ===
    function onMove(e) {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      mouse.current.x = x;
      mouse.current.y = y;
      mouse.current.active = true;
    }
    function onLeave() { mouse.current.active = false; }

    function onDown(e) {
      isMouseDown.current = true;
      // spawn a shockwave (rupture)
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      state.shockwaves.push({ x, y, r: 1, vr: SHOCK_VR, life: SHOCK_LIFE });
      state.linkFade = LINK_FADE_TIME;
      // immediate impulse so it feels punchy even before the ring reaches them
      for (const p of state.particles) {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const falloff = Math.min(1, 120 / d); // closer particles get more push
        p.vx += (dx / d) * SHOCK_IMPULSE * falloff;
        p.vy += (dy / d) * SHOCK_IMPULSE * falloff;
      }
    }
    function onUp() { isMouseDown.current = false; }

    resize();
    initParticles();
    rafRef.current = requestAnimationFrame(loop);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchend", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchend", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    // pointer-events-none so clicks reach your auth card; we listen on window anyway
    <div className={`fixed inset-0 -z-10 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
