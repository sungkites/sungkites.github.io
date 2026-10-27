/* Independent, dependency-free graph. All styling and events are scoped to its section. */
(() => {
  "use strict";
  const root = document.getElementById("research-knowledge-graph");
  if (!root) return;
  const data = JSON.parse(
    root.querySelector("#research-graph-data").textContent,
  );
  const svg = root.querySelector(".rg-canvas");
  const stage = root.querySelector(".rg-stage");
  const search = root.querySelector("#rg-search");
  const groupSelect = root.querySelector("#rg-group");
  const picker = root.querySelector("#rg-node-picker");
  const stats = root.querySelector(".rg-stats");
  const kindLabels = {
    theme: "研究领域",
    paper: "公开论文",
    project: "项目 / 资料主题",
    concept: "知识概念",
  };
  const ns = "http://www.w3.org/2000/svg";
  const make = (name, attrs = {}, text = "") => {
    const element = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) =>
      element.setAttribute(key, value),
    );
    if (text) element.textContent = text;
    return element;
  };
  const camera = make("g");
  const hullLayer = make("g");
  const edgeLayer = make("g");
  const nodeLayer = make("g");
  camera.append(hullLayer, edgeLayer, nodeLayer);
  svg.append(camera);
  const centers = [
    [230, 180],
    [700, 175],
    [1170, 185],
    [230, 510],
    [700, 510],
    [1170, 510],
    [440, 850],
    [1010, 850],
  ];
  const desktopCenters = centers.map((center) => [...center]);
  const mobileCenters = [
    [230, 180],
    [700, 180],
    [230, 510],
    [700, 510],
    [230, 840],
    [700, 840],
    [230, 1170],
    [700, 1170],
  ];
  let narrowLayout = false;
  const nodes = data.nodes.map((node) => ({ ...node }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const groupMap = new Map(
    data.groups.map((group, index) => [group.id, { ...group, index }]),
  );
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
  data.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.label;
    groupSelect.append(option);
    const members = nodes.filter((node) => node.group === group.id);
    const center = centers[groupMap.get(group.id).index];
    members.forEach((node, index) => {
      if (node.kind === "theme") {
        node.x = center[0];
        node.y = center[1];
      } else {
        const rank = members
          .filter((member) => member.kind !== "theme")
          .indexOf(node);
        const inner = rank < 7;
        const count = inner
          ? Math.min(7, members.length - 1)
          : members.length - 8;
        const angle =
          ((inner ? rank : rank - 7) * 2 * Math.PI) / Math.max(count, 1) + 0.23;
        node.x = center[0] + Math.cos(angle) * (inner ? 90 : 185);
        node.y = center[1] + Math.sin(angle) * (inner ? 58 : 123);
      }
    });
  });
  const hulls = new Map(
    data.groups.map((group) => {
      const center = centers[groupMap.get(group.id).index];
      const hull = make("ellipse", {
        class: "rg-hull",
        cx: center[0],
        cy: center[1],
        rx: 225,
        ry: 154,
      });
      hullLayer.append(hull);
      return [group.id, hull];
    }),
  );
  edges.forEach((edge) => {
    edge.element = make("line", {
      class: edge.a.group === edge.b.group ? "rg-edge" : "rg-edge rg-cross",
    });
    edgeLayer.append(edge.element);
  });
  nodes.forEach((node) => {
    const group = make("g", { class: "rg-node", "data-node-id": node.id });
    const hit = make("circle", { class: "rg-hit" });
    const type =
      node.kind === "project"
        ? "rect"
        : node.kind === "paper"
          ? "polygon"
          : "circle";
    const mark = make(type, {
      class: "rg-mark",
      fill: `var(--rg-${node.kind})`,
    });
    const label = make("text", { class: "rg-label" }, node.label);
    group.append(
      make("title", {}, `${node.label} · ${kindLabels[node.kind]}`),
      hit,
      mark,
      label,
    );
    nodeLayer.append(group);
    node.element = group;
    node.mark = mark;
    node.hit = hit;
    node.labelElement = label;
    group.addEventListener("click", (event) => {
      if (!moved) select(node.id);
      event.stopPropagation();
    });
    group.addEventListener("pointerenter", () => {
      hovered = node.id;
      updateLabels();
    });
    group.addEventListener("pointerleave", () => {
      hovered = null;
      updateLabels();
    });
  });
  let width = 1,
    height = 1,
    scale = 1,
    tx = 0,
    ty = 0,
    fitScale = 1;
  let selected = null,
    hovered = null,
    visible = new Set(nodes.map((node) => node.id));
  let dragging = null,
    moved = false,
    searchMatches = new Set(),
    frame = null;
  const radius = (node) =>
    ({ theme: 7, paper: 6, project: 4.5, concept: 3.1 })[node.kind];
  function updateLabels() {
    const occupied = [];
    const priority = (node) =>
      node.id === hovered || node.id === selected
        ? -10
        : searchMatches.has(node.id)
          ? -5
          : node.kind === "theme"
            ? 0
            : node.kind === "paper"
              ? 1
              : node.kind === "project"
                ? 2
                : selected &&
                    adjacency
                      .get(selected)
                      .some((item) => item.node.id === node.id)
                  ? 3
                  : 5;
    [...nodes]
      .sort((a, b) => priority(a) - priority(b))
      .forEach((node) => {
        const label = node.labelElement;
        label.style.display = "none";
        if (!visible.has(node.id)) return;
        const x = node.x * scale + tx,
          y = node.y * scale + ty + radius(node) + 15;
        const fontSize = node.kind === "theme" ? 13 : 11.5;
        const labelWidth = [...node.label].reduce(
          (sum, char) =>
            sum + (/[^\x00-\x7F]/.test(char) ? fontSize : fontSize * 0.62),
          0,
        );
        const labelX = Math.max(
          labelWidth / 2 + 4,
          Math.min(width - labelWidth / 2 - 4, x),
        );
        const box = {
          x: labelX - labelWidth / 2 - 4,
          y: y - fontSize - 2,
          w: labelWidth + 8,
          h: fontSize + 7,
        };
        const overlaps = occupied.some(
          (b) =>
            box.x < b.x + b.w &&
            box.x + box.w > b.x &&
            box.y < b.y + b.h &&
            box.y + box.h > b.y,
        );
        if (
          x < -labelWidth ||
          x > width + labelWidth ||
          y < 0 ||
          y > height + 20
        )
          return;
        if (overlaps && node.id !== selected && node.id !== hovered) return;
        if (
          selected &&
          node.id !== selected &&
          node.id !== hovered &&
          !adjacency.get(selected).some((item) => item.node.id === node.id)
        )
          return;
        label.style.display = "";
        label.setAttribute("x", (labelX - x) / scale);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("y", (radius(node) + 15) / scale);
        label.setAttribute("font-size", fontSize / scale);
        occupied.push(box);
      });
  }
  function draw() {
    camera.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    nodes.forEach((node) => {
      const r = radius(node) / scale;
      node.element.setAttribute("transform", `translate(${node.x},${node.y})`);
      node.hit.setAttribute("r", 12 / scale);
      if (node.kind === "project") {
        Object.entries({
          x: -r,
          y: -r,
          width: r * 2,
          height: r * 2,
          rx: r * 0.2,
        }).forEach(([k, v]) => node.mark.setAttribute(k, v));
      } else if (node.kind === "paper") {
        node.mark.setAttribute(
          "points",
          `0,${-r * 1.3} ${r * 1.3},0 0,${r * 1.3} ${-r * 1.3},0`,
        );
      } else node.mark.setAttribute("r", r);
    });
    edges.forEach((edge) => {
      Object.entries({
        x1: edge.a.x,
        y1: edge.a.y,
        x2: edge.b.x,
        y2: edge.b.y,
      }).forEach(([key, value]) => edge.element.setAttribute(key, value));
    });
    updateLabels();
  }
  function scheduleDraw() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = null;
        draw();
      });
  }
  function fit() {
    const shown = nodes.filter((node) => visible.has(node.id));
    if (!shown.length) return;
    const minX = Math.min(...shown.map((n) => n.x)) - 65,
      maxX = Math.max(...shown.map((n) => n.x)) + 65;
    const minY = Math.min(...shown.map((n) => n.y)) - 55,
      maxY = Math.max(...shown.map((n) => n.y)) + 65;
    fitScale = Math.min(
      (width - 20) / (maxX - minX),
      (height - 35) / (maxY - minY),
    );
    scale = fitScale;
    tx = width / 2 - ((minX + maxX) / 2) * scale;
    ty = height / 2 - ((minY + maxY) / 2) * scale;
    draw();
  }
  function zoom(factor, x = width / 2, y = height / 2) {
    const next = Math.max(
      fitScale * 0.65,
      Math.min(scale * factor, fitScale * 8),
    );
    tx = x - ((x - tx) * next) / scale;
    ty = y - ((y - ty) * next) / scale;
    scale = next;
    draw();
  }
  function paintSelection() {
    const near = selected
      ? new Set([
          selected,
          ...adjacency.get(selected).map((item) => item.node.id),
        ])
      : null;
    nodes.forEach((node) => {
      node.element.classList.toggle("rg-selected", node.id === selected);
      node.element.classList.toggle(
        "rg-muted",
        Boolean(near && !near.has(node.id)),
      );
    });
    edges.forEach((edge) => {
      const connected = Boolean(
        selected && (edge.source === selected || edge.target === selected),
      );
      edge.element.classList.toggle("rg-connected", connected);
      edge.element.classList.toggle(
        "rg-muted",
        Boolean(selected && !connected),
      );
    });
    updateLabels();
  }
  function select(id) {
    const node = byId.get(id);
    if (!node || !visible.has(id)) return;
    selected = id;
    picker.value = id;
    paintSelection();
    root.querySelector(".rg-detail-kind").textContent =
      kindLabels[node.kind] + (node.status ? ` · ${node.status}` : "");
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
    const caption = document.createElement("span");
    caption.textContent = "关联知识：";
    neighbors.append(caption);
    const seen = new Set();
    adjacency.get(id).forEach((item) => {
      if (seen.has(item.node.id) || !visible.has(item.node.id)) return;
      seen.add(item.node.id);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.node.label;
      button.title = item.relation;
      button.addEventListener("click", () => select(item.node.id));
      neighbors.append(button);
    });
  }
  function clearSelection() {
    selected = null;
    picker.value = "";
    paintSelection();
    root.querySelector(".rg-detail-kind").textContent = "";
    root.querySelector(".rg-detail-title").textContent = "从一个知识点开始探索";
    root.querySelector(".rg-detail-description").textContent =
      "图谱依据研究资料整理。公开论文提供原文链接，其他节点用于展示研究与工程知识的关联。";
    root.querySelector(".rg-detail-links").replaceChildren();
    root.querySelector(".rg-neighbors").replaceChildren();
  }
  function filter() {
    clearSelection();
    const query = search.value.trim().toLocaleLowerCase();
    const gid = groupSelect.value;
    searchMatches = new Set(
      nodes
        .filter((node) =>
          (node.label + " " + node.title + " " + node.summary)
            .toLocaleLowerCase()
            .includes(query),
        )
        .map((node) => node.id),
    );
    visible = new Set(
      nodes
        .filter(
          (node) =>
            (gid === "all" || node.group === gid) &&
            (!query || searchMatches.has(node.id)),
        )
        .map((node) => node.id),
    );
    if (!query) searchMatches.clear();
    nodes.forEach((node) => {
      node.element.style.display = visible.has(node.id) ? "" : "none";
    });
    edges.forEach((edge) => {
      edge.element.style.display =
        visible.has(edge.source) && visible.has(edge.target) ? "" : "none";
    });
    hulls.forEach((hull, id) => {
      hull.style.display = nodes.some(
        (node) => node.group === id && visible.has(node.id),
      )
        ? ""
        : "none";
    });
    picker.replaceChildren(new Option("选择知识点，查看简介与关联", ""));
    data.groups.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      nodes
        .filter((node) => node.group === group.id && visible.has(node.id))
        .forEach((node) => optgroup.append(new Option(node.label, node.id)));
      if (optgroup.children.length) picker.append(optgroup);
    });
    const edgeCount = edges.filter(
      (edge) => visible.has(edge.source) && visible.has(edge.target),
    ).length;
    stats.textContent = `${visible.size} 个节点 · ${edgeCount} 条关联`;
    root.querySelector(".rg-empty").hidden = visible.size > 0;
    if (!visible.size) {
      hulls.forEach((hull) => {
        hull.style.display = "none";
      });
    }
    fit();
  }
  search.addEventListener("input", filter);
  groupSelect.addEventListener("change", filter);
  picker.addEventListener("change", () => {
    if (picker.value) select(picker.value);
    else clearSelection();
  });
  root.querySelectorAll("[data-rg-action]").forEach((button) =>
    button.addEventListener("click", () => {
      const action = button.dataset.rgAction;
      if (action === "zoom-in") zoom(1.4);
      if (action === "zoom-out") zoom(1 / 1.4);
      if (action === "fit") {
        clearSelection();
        fit();
      }
      if (action === "fullscreen") {
        if (document.fullscreenElement === root)
          document.exitFullscreen().catch(() => {});
        else if (root.requestFullscreen)
          root.requestFullscreen().catch(() => {});
      }
    }),
  );
  const fullscreen = root.querySelector('[data-rg-action="fullscreen"]');
  if (!document.fullscreenEnabled) fullscreen.hidden = true;
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent =
      document.fullscreenElement === root ? "退出全屏" : "全屏";
  });
  svg.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const r = svg.getBoundingClientRect();
      zoom(
        Math.exp(-event.deltaY * 0.002),
        event.clientX - r.left,
        event.clientY - r.top,
      );
    },
    { passive: false },
  );
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target.closest("[data-node-id]");
    dragging = {
      id: target ? target.dataset.nodeId : null,
      x: event.clientX,
      y: event.clientY,
      tx,
      ty,
    };
    moved = false;
    if (dragging.id) {
      const node = byId.get(dragging.id);
      dragging.nx = node.x;
      dragging.ny = node.y;
    }
    svg.setPointerCapture(event.pointerId);
    svg.classList.add("rg-dragging");
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragging.x,
      dy = event.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (dragging.id) {
      const node = byId.get(dragging.id);
      node.x = dragging.nx + dx / scale;
      node.y = dragging.ny + dy / scale;
    } else {
      tx = dragging.tx + dx;
      ty = dragging.ty + dy;
    }
    scheduleDraw();
  });
  const finish = (event) => {
    if (!dragging) return;
    const id = dragging.id,
      wasMoved = moved;
    dragging = null;
    svg.classList.remove("rg-dragging");
    if (svg.hasPointerCapture(event.pointerId))
      svg.releasePointerCapture(event.pointerId);
    if (!wasMoved && id) select(id);
    else if (!wasMoved) clearSelection();
  };
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", () => {
    dragging = null;
    svg.classList.remove("rg-dragging");
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSelection();
  });
  new ResizeObserver(() => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const narrow = width < 600;
    if (narrow !== narrowLayout) {
      const target = narrow ? mobileCenters : desktopCenters;
      data.groups.forEach((group, index) => {
        const dx = target[index][0] - centers[index][0],
          dy = target[index][1] - centers[index][1];
        nodes
          .filter((node) => node.group === group.id)
          .forEach((node) => {
            node.x += dx;
            node.y += dy;
          });
        centers[index][0] = target[index][0];
        centers[index][1] = target[index][1];
        hulls.get(group.id).setAttribute("cx", target[index][0]);
        hulls.get(group.id).setAttribute("cy", target[index][1]);
      });
      narrowLayout = narrow;
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    fit();
  }).observe(stage);
  filter();
})();
