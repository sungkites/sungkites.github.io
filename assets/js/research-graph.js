/* A small 3D knowledge network projected into SVG, with no external runtime. */
(() => {
  "use strict";
  const root = document.getElementById("research-knowledge-graph");
  if (!root) return;
  const data = JSON.parse(root.querySelector("#research-graph-data").textContent);
  const stage = root.querySelector(".rg-stage"),
    svg = root.querySelector(".rg-canvas");
  const ns = "http://www.w3.org/2000/svg";
  const make = (tag, attrs = {}, text = "") => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text) el.textContent = text;
    return el;
  };
  const defs = make("defs");
  svg.append(defs);
  ["core", "theme", "paper", "project", "concept"].forEach((kind) => {
    const gradient = make("radialGradient", { id: `rg-sphere-${kind}-v3`, cx: "32%", cy: "26%", r: "78%" });
    gradient.append(
      make("stop", { offset: "0%", style: `stop-color:color-mix(in srgb,var(--rg-${kind}) 68%,white)` }),
      make("stop", { offset: "72%", style: `stop-color:var(--rg-${kind})` }),
      make("stop", { offset: "100%", style: `stop-color:color-mix(in srgb,var(--rg-${kind}) 88%,black)` })
    );
    defs.append(gradient);
  });
  const edgesLayer = make("g"),
    nodesLayer = make("g");
  svg.append(edgesLayer, nodesLayer);
  const nodes = data.nodes.map((n, i) => ({ ...n, index: i, vx: 0, vy: 0, vz: 0 })),
    byId = new Map(nodes.map((n) => [n.id, n]));
  const near = new Map(nodes.map((n) => [n.id, new Set()]));
  const edges = data.edges.map((e) => ({ ...e, a: byId.get(e.source), b: byId.get(e.target) }));
  edges.forEach((e) => {
    near.get(e.source).add(e.target);
    near.get(e.target).add(e.source);
    e.el = make("line", { class: "rg-edge" });
    edgesLayer.append(e.el);
  });
  let width = 1,
    height = 1,
    baseScale = 1,
    zoom = 1,
    panX = 0,
    panY = 0,
    narrow = null;
  let visible = false,
    hovered = null,
    held = null,
    drag = null,
    pinch = null,
    frame = null,
    paused = false,
    moved = false,
    energy = 1;
  let yaw = 0.19,
    pitch = -0.09,
    aimX = 0,
    aimY = 0,
    viewX = 0,
    viewY = 0,
    motionTime = 0,
    lastFrame = 0;
  const pointers = new Map();
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionPreference.matches;
  const fixed = (n) => n.kind === "core" || n.kind === "theme";
  const radius = (n) =>
    n.kind === "core"
      ? 8.5
      : n.kind === "theme"
        ? n.level === 1
          ? 6.3
          : 5.3
        : n.kind === "paper"
          ? 5
          : n.kind === "project"
            ? 3.8
            : 2.6 + Math.min(1, near.get(n.id).size * 0.13);

  nodes.forEach((n) => {
    const el = make("g", { class: fixed(n) ? "rg-node rg-major" : "rg-node", "data-node-id": n.id, role: "img", "aria-label": n.title });
    const hit = make("circle", { class: "rg-hit" }),
      mark = make("circle", { class: "rg-mark", fill: `url(#rg-sphere-${n.kind}-v3)` }),
      label = make("text", { class: "rg-label" }, n.label);
    el.append(make("title", {}, n.title), hit, mark, label);
    nodesLayer.append(el);
    Object.assign(n, { el, hit, mark, label });
    el.addEventListener("pointerenter", () => {
      hovered = n.id;
      requestRender();
    });
    el.addEventListener("pointerleave", () => {
      hovered = null;
      requestRender();
    });
  });

  function layout(mobile) {
    const centers = mobile
      ? {
          overview: [0, -20, 20],
          memory: [-125, -215, 70],
          multimodal: [125, -215, -35],
          safety: [-130, -35, -45],
          evidence: [130, -25, 80],
          finance: [130, 155, -55],
          uav: [-135, 150, 50],
          systems: [-130, 340, -30],
          agriculture: [130, 340, 30],
        }
      : {
          overview: [0, 0, 20],
          memory: [-175, -145, 80],
          multimodal: [175, -135, -40],
          safety: [-165, 100, -60],
          evidence: [165, 100, 85],
          finance: [345, -50, -85],
          uav: [-355, -5, 10],
          systems: [-185, 275, 70],
          agriculture: [240, 270, -55],
        };
    nodes.filter(fixed).forEach((n) => {
      [n.x, n.y, n.z] = centers[n.group];
    });
    data.groups.forEach((group) => {
      const members = nodes.filter((n) => n.group === group.id && !fixed(n));
      members
        .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
        .forEach((n, i) => {
          const center = centers[group.id],
            angle = i * 2.399963 + 0.5;
          const distance = (mobile ? 42 : 48) + Math.sqrt(i + 1) * (mobile ? 18 : 21);
          n.x = center[0] + Math.cos(angle) * distance;
          n.y = center[1] + Math.sin(angle) * distance * 0.8;
          n.z = center[2] + Math.sin(i * 1.7 + 0.8) * 40;
        });
    });
    nodes.forEach((n) => {
      n.ax = n.x;
      n.ay = n.y;
      n.az = n.z;
      n.vx = n.vy = n.vz = 0;
    });
    // A brief deterministic relaxation separates close nodes while preserving branches.
    energy = 1;
    for (let i = 0; i < 45; i++) physics();
    if (reduced) {
      for (let i = 0; i < 45; i++) physics();
      energy = 0;
    }
  }
  function physics() {
    if (energy < 0.002) return;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        let dx = b.x - a.x,
          dy = b.y - a.y,
          dz = (b.z - a.z) * 0.5;
        const distance = Math.max(0.1, Math.hypot(dx, dy, dz)),
          gap = fixed(a) || fixed(b) ? 47 : 31;
        if (distance >= gap) continue;
        const force = ((gap - distance) / distance) * 0.08 * energy;
        if (!fixed(a) && a.id !== drag?.id) {
          a.vx -= dx * force;
          a.vy -= dy * force;
          a.vz -= dz * force;
        }
        if (!fixed(b) && b.id !== drag?.id) {
          b.vx += dx * force;
          b.vy += dy * force;
          b.vz += dz * force;
        }
      }
    nodes.forEach((n) => {
      if (fixed(n) || n.id === drag?.id) return;
      n.vx = (n.vx + (n.ax - n.x) * 0.012 * energy) * 0.75;
      n.vy = (n.vy + (n.ay - n.y) * 0.012 * energy) * 0.75;
      n.vz = (n.vz + (n.az - n.z) * 0.012 * energy) * 0.75;
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;
    });
    energy *= 0.972;
  }
  function project(n, angleY, angleX) {
    const x = n.x * Math.cos(angleY) + n.z * Math.sin(angleY),
      z = -n.x * Math.sin(angleY) + n.z * Math.cos(angleY);
    const y = n.y * Math.cos(angleX) - z * Math.sin(angleX),
      depth = n.y * Math.sin(angleX) + z * Math.cos(angleX);
    const perspective = 1050 / (1050 - depth);
    return { x: x * perspective, y: y * perspective, z: depth, p: perspective };
  }
  function fit() {
    const projected = nodes.map((n) => project(n, yaw, pitch));
    const x0 = Math.min(...projected.map((n) => n.x)) - 65,
      x1 = Math.max(...projected.map((n) => n.x)) + 65;
    const y0 = Math.min(...projected.map((n) => n.y)) - 55,
      y1 = Math.max(...projected.map((n) => n.y)) + 60;
    baseScale = Math.min((width - 12) / (x1 - x0), (height - 16) / (y1 - y0));
    svg.dataset.originX = String((x0 + x1) / 2);
    svg.dataset.originY = String((y0 + y1) / 2);
    zoom = 1;
    panX = panY = 0;
  }
  function render() {
    const active = hovered || held,
      adjacent = active ? near.get(active) : null;
    const angleY = yaw + (reduced ? 0 : Math.sin(motionTime * 0.16) * 0.065) + viewX;
    const angleX = pitch + (reduced ? 0 : Math.sin(motionTime * 0.13) * 0.025) + viewY;
    const originX = Number(svg.dataset.originX || 0),
      originY = Number(svg.dataset.originY || 0);
    nodes.forEach((n) => {
      const point = project(n, angleY, angleX);
      n.depth = point.z;
      n.perspective = point.p;
      n.sx = width / 2 + panX + (point.x - originX) * baseScale * zoom;
      n.sy = height / 2 + panY + (point.y - originY) * baseScale * zoom;
      n.screenR = radius(n) * Math.max(0.8, Math.min(1.2, point.p)) * Math.pow(zoom, 0.22);
      n.el.setAttribute("transform", `translate(${n.sx},${n.sy})`);
      n.mark.setAttribute("r", n.screenR);
      n.hit.setAttribute("r", Math.max(10, n.screenR + 4));
      const opacity = active && n.id !== active && !adjacent.has(n.id) ? 0.18 : Math.max(0.58, Math.min(1, 0.8 + point.z / 800));
      n.el.setAttribute("opacity", opacity);
      n.mark.setAttribute("stroke", n.id === active ? "var(--rg-text)" : "none");
      n.mark.setAttribute("stroke-width", n.id === active ? 1 : 0);
    });
    edges.forEach((e) => {
      Object.entries({ x1: e.a.sx, y1: e.a.sy, x2: e.b.sx, y2: e.b.sy }).forEach(([key, value]) => e.el.setAttribute(key, value));
      const isNear = active && (e.source === active || e.target === active),
        main = e.tier === "primary" || e.tier === "secondary";
      const depth = (e.a.depth + e.b.depth) / 2;
      e.el.setAttribute("opacity", active ? (isNear ? 0.66 : 0.035) : Math.max(0.1, Math.min(0.42, (main ? 0.32 : 0.18) + depth / 1800)));
      e.el.setAttribute("stroke-width", isNear ? 1.15 : main ? 0.95 : 0.55);
    });
    // Sort by depth only when the ordering changes; front nodes naturally occlude back nodes.
    const order = [...nodes].sort((a, b) => a.depth - b.depth);
    const key = order.map((n) => n.id).join("|");
    if (nodesLayer.dataset.order !== key) {
      order.forEach((n) => nodesLayer.append(n.el));
      nodesLayer.dataset.order = key;
    }
    const boxes = [];
    const priority = (n) =>
      n.id === active
        ? -10
        : n.kind === "core"
          ? 0
          : n.kind === "theme"
            ? 1
            : n.kind === "paper"
              ? 2
              : near.get(n.id).size >= 4
                ? 3
                : n.kind === "project"
                  ? 4
                  : 5;
    [...nodes]
      .sort((a, b) => priority(a) - priority(b) || b.depth - a.depth)
      .forEach((n) => {
        n.label.style.display = "none";
        if (active && n.id !== active && !adjacent.has(n.id)) return;
        if (!active && n.kind === "concept" && near.get(n.id).size < 3 && zoom < 1.18) return;
        const font = n.kind === "core" ? 13.5 : n.kind === "theme" ? 12.2 : n.kind === "paper" ? 11.8 : 11.2;
        const w = [...n.label.textContent].reduce((sum, c) => sum + (/[^\x00-\x7F]/.test(c) ? font : font * 0.6), 0);
        if (n.sx < -w || n.sx > width + w || n.sy < -20 || n.sy > height + 20) return;
        const candidates = [
          { x: n.sx, y: n.sy + n.screenR + 15 },
          { x: n.sx, y: n.sy - n.screenR - 6 },
          { x: n.sx + n.screenR + 7 + w / 2, y: n.sy + font * 0.35 },
          { x: n.sx - n.screenR - 7 - w / 2, y: n.sy + font * 0.35 },
        ];
        let placement = null;
        for (const candidate of candidates) {
          const x = Math.max(w / 2 + 3, Math.min(width - w / 2 - 3, candidate.x));
          const y = candidate.y;
          if (y < font + 3 || y > height - 3) continue;
          const box = { x: x - w / 2 - 3, y: y - font - 2, w: w + 6, h: font + 6 };
          if (n.id !== active && boxes.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
          placement = { x, y, box };
          break;
        }
        if (!placement) return;
        n.label.style.display = "";
        n.label.setAttribute("x", placement.x - n.sx);
        n.label.setAttribute("y", placement.y - n.sy);
        n.label.setAttribute("font-size", font);
        n.label.setAttribute("text-anchor", "middle");
        boxes.push(placement.box);
      });
    svg.dataset.zoom = String(zoom);
    svg.dataset.pan = `${panX},${panY}`;
    svg.dataset.camera = `${angleY},${angleX}`;
    svg.dataset.motion = reduced ? "reduced" : paused ? "paused" : active ? "focused" : "active";
  }
  const canMove = () => visible && !document.hidden && !reduced && !paused && !hovered && !held && !drag && !pinch;
  function tick(now) {
    frame = null;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;
    if (canMove()) {
      motionTime += dt;
      viewX += (aimX - viewX) * 0.07;
      viewY += (aimY - viewY) * 0.07;
      physics();
    }
    render();
    if (canMove()) frame = requestAnimationFrame(tick);
  }
  function requestRender() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function zoomAt(factor, x, y) {
    const next = Math.max(0.65, Math.min(zoom * factor, 6));
    panX = x - width / 2 - ((x - width / 2 - panX) * next) / zoom;
    panY = y - height / 2 - ((y - height / 2 - panY) * next) / zoom;
    zoom = next;
    requestRender();
  }
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const box = svg.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
    },
    { passive: false }
  );
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    svg.focus({ preventScroll: true });
    const r = svg.getBoundingClientRect();
    pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    svg.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom, panX, panY };
      drag = null;
    } else if (pointers.size === 1) {
      const id = e.target.closest("[data-node-id]")?.dataset.nodeId,
        n = byId.get(id);
      drag = { id, x: e.clientX, y: e.clientY, panX, panY, yaw, pitch, rotate: e.shiftKey, nx: n?.x, ny: n?.y };
      moved = false;
    }
    svg.classList.add("rg-dragging");
    requestRender();
  });
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    if (!pointers.has(e.pointerId)) {
      aimX = ((e.clientX - r.left) / width - 0.5) * 0.08;
      aimY = -((e.clientY - r.top) / height - 0.5) * 0.045;
      requestRender();
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const next = Math.max(0.65, Math.min((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(pinch.distance, 1), 6));
      panX = (a.x + b.x) / 2 - width / 2 - ((pinch.x - width / 2 - pinch.panX) * next) / pinch.zoom;
      panY = (a.y + b.y) / 2 - height / 2 - ((pinch.y - height / 2 - pinch.panY) * next) / pinch.zoom;
      zoom = next;
      moved = true;
      requestRender();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (drag.rotate) {
      yaw = drag.yaw + dx * 0.004;
      pitch = Math.max(-0.8, Math.min(0.8, drag.pitch + dy * 0.003));
    } else if (drag.id) {
      const n = byId.get(drag.id);
      n.x = drag.nx + dx / (baseScale * zoom * n.perspective);
      n.y = drag.ny + dy / (baseScale * zoom * n.perspective);
      n.ax = n.x;
      n.ay = n.y;
      energy = 0.1;
    } else {
      panX = drag.panX + dx;
      panY = drag.panY + dy;
    }
    requestRender();
  });
  function end(e) {
    pointers.delete(e.pointerId);
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (pinch) {
      pinch = null;
      drag = null;
    } else if (drag) {
      if (!moved && e.type !== "pointercancel") held = held === drag.id ? null : drag.id || null;
      drag = null;
    }
    if (!pointers.size) svg.classList.remove("rg-dragging");
    requestRender();
  }
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("pointerleave", () => {
    hovered = null;
    aimX = aimY = 0;
    requestRender();
  });
  svg.addEventListener("dblclick", (e) => {
    e.preventDefault();
    held = hovered = null;
    yaw = 0.19;
    pitch = -0.09;
    viewX = viewY = aimX = aimY = 0;
    fit();
    requestRender();
  });
  svg.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      paused = !paused;
      requestRender();
    }
    if (e.key === "Escape") {
      held = hovered = null;
      requestRender();
    }
    if (e.key === "Home" || e.key === "0") {
      e.preventDefault();
      held = null;
      fit();
      requestRender();
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAt(1.25, width / 2, height / 2);
    }
    if (e.key === "-") {
      e.preventDefault();
      zoomAt(1 / 1.25, width / 2, height / 2);
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -20 : e.key === "ArrowRight" ? 20 : 0,
        dy = e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0;
      if (e.shiftKey) {
        yaw += dx * 0.003;
        pitch += dy * 0.003;
      } else {
        panX += dx;
        panY += dy;
      }
      requestRender();
    }
  });
  motionPreference.addEventListener("change", (e) => {
    reduced = e.matches;
    if (reduced) energy = 0;
    lastFrame = 0;
    requestRender();
  });
  document.addEventListener("visibilitychange", () => {
    lastFrame = 0;
    requestRender();
  });
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      lastFrame = 0;
      requestRender();
    },
    { rootMargin: "30px" }
  ).observe(stage);
  new ResizeObserver(() => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const mobile = width < 600;
    if (mobile !== narrow) {
      narrow = mobile;
      layout(mobile);
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    fit();
    requestRender();
  }).observe(stage);
})();
