/* Personal research graph: no toolbar, dependency or global style changes. */
(() => {
  "use strict";
  const root = document.getElementById("research-knowledge-graph");
  if (!root) return;
  const data = JSON.parse(root.querySelector("#research-graph-data").textContent);
  const stage = root.querySelector(".rg-stage");
  const svg = root.querySelector(".rg-canvas");
  const detail = root.querySelector(".rg-detail");
  const ns = "http://www.w3.org/2000/svg";
  const names = {
    core: "研究主线",
    theme: "研究方向",
    paper: "公开论文",
    project: "项目 / 资料主题",
    concept: "知识概念",
  };
  const make = (tag, attrs = {}, text = "") => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text) el.textContent = text;
    return el;
  };
  const camera = make("g");
  const edgeLayer = make("g");
  const nodeLayer = make("g");
  camera.append(edgeLayer, nodeLayer);
  svg.append(camera);
  const nodes = data.nodes.map((node) => ({ ...node }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  const edges = data.edges.map((edge) => ({
    ...edge,
    a: byId.get(edge.source),
    b: byId.get(edge.target),
  }));
  edges.forEach((edge) => {
    adjacency.get(edge.source).push({ node: edge.b, relation: edge.relation });
    adjacency.get(edge.target).push({ node: edge.a, relation: edge.relation });
  });
  let width = 1,
    height = 1,
    scale = 1,
    tx = 0,
    ty = 0,
    fitScale = 1,
    selected = null,
    hovered = null,
    frame = null,
    narrow = null;
  let drag = null,
    pinch = null,
    moved = false;
  const pointers = new Map();
  const size = (node) =>
    node.kind === "core"
      ? 13
      : node.kind === "theme"
        ? node.level === 1
          ? 8
          : 6.5
        : node.kind === "paper"
          ? 5.5
          : node.kind === "project"
            ? 4.3
            : 2.8;
  const fixed = (node) => node.kind === "core" || node.kind === "theme";

  function layout(isNarrow) {
    const centers = isNarrow
      ? {
          memory: [250, 230],
          multimodal: [720, 230],
          safety: [250, 620],
          evidence: [720, 620],
          finance: [720, 1010],
          uav: [250, 1010],
          systems: [250, 1400],
          agriculture: [720, 1400],
          overview: [485, 425],
        }
      : {
          memory: [440, 245],
          multimodal: [990, 245],
          safety: [440, 690],
          evidence: [990, 690],
          finance: [1260, 55],
          uav: [120, 415],
          systems: [185, 975],
          agriculture: [1300, 975],
          overview: [720, 470],
        };
    data.groups.forEach((group) => {
      const members = nodes.filter((node) => node.group === group.id && !fixed(node));
      const center = centers[group.id];
      members
        .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
        .forEach((node, index) => {
          const angle = index * 2.3999632297 + 0.3;
          const radius = node.kind === "paper" || node.kind === "project" ? 66 + index * 4 : 55 + Math.sqrt(index + 1) * 23;
          node.x = center[0] + Math.cos(angle) * radius;
          node.y = center[1] + Math.sin(angle) * radius * 0.82;
        });
    });
    nodes.filter(fixed).forEach((node) => {
      node.x = centers[node.group][0];
      node.y = centers[node.group][1];
    });
    // Concepts shared by directions sit between their related branches.
    nodes
      .filter((node) => node.kind === "concept")
      .forEach((node) => {
        const external = adjacency.get(node.id).filter((item) => item.node.group !== node.group && item.node.kind !== "core");
        if (external.length) {
          const x = external.reduce((sum, item) => sum + centers[item.node.group][0], 0) / external.length;
          const y = external.reduce((sum, item) => sum + centers[item.node.group][1], 0) / external.length;
          node.x = node.x * 0.78 + x * 0.22;
          node.y = node.y * 0.78 + y * 0.22;
        }
      });
    // Deterministic spacing, without a continuously moving force simulation.
    for (let iteration = 0; iteration < 70; iteration++) {
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          let dx = b.x - a.x,
            dy = b.y - a.y,
            distance = Math.hypot(dx, dy);
          const gap = a.kind === "core" || b.kind === "core" ? 75 : fixed(a) || fixed(b) ? 42 : 25;
          if (distance >= gap || (fixed(a) && fixed(b))) continue;
          if (distance < 0.01) {
            dx = 0.1;
            dy = 0.1;
            distance = Math.hypot(dx, dy);
          }
          const push = (gap - distance) * 0.52;
          const ux = dx / distance,
            uy = dy / distance;
          if (!fixed(a)) {
            a.x -= ux * push;
            a.y -= uy * push;
          }
          if (!fixed(b)) {
            b.x += ux * push;
            b.y += uy * push;
          }
        }
    }
  }
  edges.forEach((edge) => {
    const classes = {
      primary: "rg-edge rg-primary",
      secondary: "rg-edge rg-secondary",
      bridge: "rg-edge rg-bridge",
      detail: "rg-edge",
    };
    edge.element = make("path", { class: classes[edge.tier] || "rg-edge" });
    edgeLayer.append(edge.element);
  });
  nodes.forEach((node) => {
    const el = make("g", {
      class: fixed(node) ? "rg-node rg-major" : "rg-node",
      "data-node-id": node.id,
      role: "button",
      tabindex: node.kind === "core" ? "0" : "-1",
      "aria-label": `${node.label}，${names[node.kind]}`,
    });
    const hit = make("circle", { class: "rg-hit" });
    const mark = make(node.kind === "project" ? "rect" : node.kind === "paper" ? "polygon" : "circle", {
      class: "rg-mark",
      fill: `var(--rg-${node.kind})`,
    });
    const label = make("text", { class: "rg-label" }, node.label);
    el.append(make("title", {}, `${node.label} · ${names[node.kind]}`));
    if (node.kind === "core") {
      node.halo = make("circle", { class: "rg-halo" });
      el.append(node.halo);
    }
    el.append(hit, mark, label);
    nodeLayer.append(el);
    Object.assign(node, { element: el, mark, hit, labelElement: label });
    el.addEventListener("pointerenter", () => {
      hovered = node.id;
      labels();
    });
    el.addEventListener("pointerleave", () => {
      hovered = null;
      labels();
    });
    el.addEventListener("focus", () => {
      hovered = node.id;
      labels();
    });
    el.addEventListener("blur", () => {
      hovered = null;
      labels();
    });
  });
  function labels() {
    const occupied = [];
    const isNear = (node) => selected && adjacency.get(selected).some((item) => item.node.id === node.id);
    const priority = (node) =>
      node.id === selected || node.id === hovered
        ? -20
        : node.kind === "core"
          ? -10
          : node.kind === "theme"
            ? node.level
            : node.kind === "paper"
              ? 3
              : isNear(node)
                ? 4
                : node.kind === "project"
                  ? 5
                  : 10 - adjacency.get(node.id).length * 0.15;
    [...nodes]
      .sort((a, b) => priority(a) - priority(b))
      .forEach((node) => {
        const label = node.labelElement;
        label.style.display = "none";
        if (selected && !fixed(node) && node.id !== selected && node.id !== hovered && !isNear(node)) return;
        const font = node.kind === "core" ? 15 : node.kind === "theme" ? (node.level === 1 ? 13 : 12) : 11.5;
        const x = node.x * scale + tx,
          y = node.y * scale + ty + size(node) + 16;
        const w = [...node.label].reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? font : font * 0.6), 0);
        if (x < -w || x > width + w || y < 0 || y > height + 20) return;
        const labelX = Math.max(w / 2 + 3, Math.min(width - w / 2 - 3, x));
        const box = {
          x: labelX - w / 2 - 3,
          y: y - font - 2,
          w: w + 6,
          h: font + 7,
        };
        const overlap = occupied.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
        if (overlap && node.id !== hovered && node.id !== selected) return;
        label.style.display = "";
        label.setAttribute("font-size", font / scale);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("x", (labelX - x) / scale);
        label.setAttribute("y", (size(node) + 16) / scale);
        occupied.push(box);
      });
  }
  function draw() {
    camera.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    nodes.forEach((node) => {
      const r = size(node) / scale;
      node.element.setAttribute("transform", `translate(${node.x},${node.y})`);
      node.hit.setAttribute("r", Math.max(size(node) + 4, 10) / scale);
      if (node.halo) node.halo.setAttribute("r", 25 / scale);
      if (node.kind === "project")
        Object.entries({
          x: -r,
          y: -r,
          width: r * 2,
          height: r * 2,
          rx: r * 0.2,
        }).forEach(([key, value]) => node.mark.setAttribute(key, value));
      else if (node.kind === "paper") node.mark.setAttribute("points", `0,${-r * 1.3} ${r * 1.3},0 0,${r * 1.3} ${-r * 1.3},0`);
      else node.mark.setAttribute("r", r);
    });
    edges.forEach((edge) => {
      const dx = edge.b.x - edge.a.x,
        dy = edge.b.y - edge.a.y;
      if (edge.tier === "primary" || edge.tier === "secondary") {
        const bend = edge.tier === "primary" ? 0.055 : 0.025;
        edge.element.setAttribute(
          "d",
          `M ${edge.a.x} ${edge.a.y} Q ${(edge.a.x + edge.b.x) / 2 - dy * bend} ${(edge.a.y + edge.b.y) / 2 + dx * bend} ${edge.b.x} ${edge.b.y}`
        );
      } else edge.element.setAttribute("d", `M ${edge.a.x} ${edge.a.y} L ${edge.b.x} ${edge.b.y}`);
    });
    labels();
  }
  function schedule() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = null;
        draw();
      });
  }
  function fit() {
    const x0 = Math.min(...nodes.map((n) => n.x)) - 75,
      x1 = Math.max(...nodes.map((n) => n.x)) + 75;
    const y0 = Math.min(...nodes.map((n) => n.y)) - 55,
      y1 = Math.max(...nodes.map((n) => n.y)) + 70;
    fitScale = Math.min((width - 12) / (x1 - x0), (height - 20) / (y1 - y0));
    scale = fitScale;
    tx = width / 2 - ((x0 + x1) / 2) * scale;
    ty = height / 2 - ((y0 + y1) / 2) * scale;
    draw();
  }
  function zoom(factor, x = width / 2, y = height / 2) {
    const next = Math.max(fitScale * 0.7, Math.min(scale * factor, fitScale * 8));
    tx = x - ((x - tx) * next) / scale;
    ty = y - ((y - ty) * next) / scale;
    scale = next;
    draw();
  }
  function paint() {
    const near = selected ? new Set([selected, ...adjacency.get(selected).map((item) => item.node.id)]) : null;
    nodes.forEach((node) => {
      node.element.classList.toggle("rg-selected", node.id === selected);
      node.element.classList.toggle("rg-muted", Boolean(near && !near.has(node.id) && !fixed(node)));
    });
    edges.forEach((edge) => {
      const connected = selected && (edge.source === selected || edge.target === selected);
      edge.element.classList.toggle("rg-connected", Boolean(connected));
      edge.element.classList.toggle("rg-muted", Boolean(selected && !connected));
    });
    labels();
  }
  function select(id) {
    const node = byId.get(id);
    if (!node) return;
    selected = id;
    paint();
    detail.hidden = false;
    root.querySelector(".rg-detail-kind").textContent = names[node.kind] + (node.status ? ` · ${node.status}` : "");
    root.querySelector(".rg-detail-title").textContent = node.title;
    root.querySelector(".rg-detail-description").textContent = node.summary;
    const links = root.querySelector(".rg-detail-links");
    links.replaceChildren();
    (node.links || []).forEach((link) => {
      const a = document.createElement("a");
      a.textContent = link.label + " ↗";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.append(a);
    });
    const neighbors = root.querySelector(".rg-neighbors");
    neighbors.replaceChildren();
    const seen = new Set();
    adjacency
      .get(id)
      .sort((a, b) => a.node.level - b.node.level)
      .forEach((item) => {
        if (seen.has(item.node.id)) return;
        seen.add(item.node.id);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.node.label;
        button.title = item.relation;
        button.addEventListener("click", () => {
          select(item.node.id);
          focus(item.node.id);
        });
        neighbors.append(button);
      });
  }
  function clear() {
    selected = null;
    detail.hidden = true;
    paint();
  }
  function focus(id) {
    nodes.forEach((node) => node.element.setAttribute("tabindex", node.id === id ? "0" : "-1"));
    byId.get(id).element.focus({ preventScroll: true });
  }
  svg.addEventListener("keydown", (event) => {
    const active = event.target.closest("[data-node-id]")?.dataset.nodeId || selected || "research-core";
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(active);
    }
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const ordered = [...nodes].sort((a, b) => a.level - b.level);
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const index = (ordered.findIndex((n) => n.id === active) + delta + ordered.length) % ordered.length;
      focus(ordered[index].id);
      select(ordered[index].id);
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(1.3);
    }
    if (event.key === "-") {
      event.preventDefault();
      zoom(1 / 1.3);
    }
    if (event.key === "0") {
      event.preventDefault();
      clear();
      fit();
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clear();
  });
  svg.addEventListener("dblclick", (event) => {
    event.preventDefault();
    clear();
    fit();
  });
  svg.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !svg.matches(":focus-within")) return;
      event.preventDefault();
      const box = svg.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.002), event.clientX - box.left, event.clientY - box.top);
    },
    { passive: false }
  );
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    svg.focus({ preventScroll: true });
    const rect = svg.getBoundingClientRect();
    pointers.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    svg.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        scale,
        tx,
        ty,
      };
      drag = null;
    } else if (pointers.size === 1) {
      const id = event.target.closest("[data-node-id]")?.dataset.nodeId;
      const node = byId.get(id);
      drag = {
        id,
        x: event.clientX,
        y: event.clientY,
        tx,
        ty,
        nx: node?.x,
        ny: node?.y,
      };
      moved = false;
    }
    svg.classList.add("rg-dragging");
  });
  svg.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const rect = svg.getBoundingClientRect();
    pointers.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const next = Math.max(fitScale * 0.7, Math.min((pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(pinch.distance, 1), fitScale * 8));
      tx = (a.x + b.x) / 2 - ((pinch.x - pinch.tx) * next) / pinch.scale;
      ty = (a.y + b.y) / 2 - ((pinch.y - pinch.ty) * next) / pinch.scale;
      scale = next;
      moved = true;
      schedule();
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (drag.id) {
      const node = byId.get(drag.id);
      node.x = drag.nx + dx / scale;
      node.y = drag.ny + dy / scale;
    } else {
      tx = drag.tx + dx;
      ty = drag.ty + dy;
    }
    schedule();
  });
  function finish(event) {
    pointers.delete(event.pointerId);
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (pinch) {
      pinch = null;
      drag = null;
    } else if (drag) {
      const id = drag.id;
      if (!moved && event.type !== "pointercancel") {
        if (id) {
          select(id);
          focus(id);
        } else clear();
      }
      drag = null;
    }
    if (!pointers.size) svg.classList.remove("rg-dragging");
  }
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
  new ResizeObserver(() => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const mode = width < 600;
    if (mode !== narrow) {
      narrow = mode;
      layout(mode);
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    fit();
  }).observe(stage);
})();
