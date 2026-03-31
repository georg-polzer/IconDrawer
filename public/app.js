const searchInput = document.querySelector("#search-input");
const styleToggle = document.querySelector("#style-toggle");
const colorInput = document.querySelector("#color-input");
const hexInput = document.querySelector("#hex-input");
const sizeSelect = document.querySelector("#size-select");
const resultCount = document.querySelector("#result-count");
const selectionLabel = document.querySelector("#selection-label");
const iconGrid = document.querySelector("#icon-grid");
const previewStage = document.querySelector("#preview-stage");
const svgPreview = document.querySelector("#svg-preview");
const previewTitle = document.querySelector("#preview-title");
const dragImage = document.querySelector("#drag-image");
const dragHelp = document.querySelector("#drag-help");
const downloadButton = document.querySelector("#download-button");

const state = {
  icons: [],
  filteredIcons: [],
  selectedIcon: null,
  selectedSvg: "",
  style: "outline",
  color: "#1F6FEB",
  pngUrl: "",
};

const MAX_GRID_ITEMS = 120;

initialize();

async function initialize() {
  setupEvents();
  syncStyleButtons();

  try {
    const response = await fetch("/api/icons");
    const payload = await response.json();
    state.icons = payload.icons;
    applySearch();
  } catch (error) {
    resultCount.textContent = "Failed to load Tabler icons.";
    console.error(error);
  }
}

function setupEvents() {
  searchInput.addEventListener("input", () => {
    applySearch();
  });

  styleToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-style]");
    if (!button || button.disabled) {
      return;
    }

    state.style = button.dataset.style;
    syncStyleButtons();
    renderGrid();
    void updateSelectedAsset();
  });

  colorInput.addEventListener("input", () => {
    updateColor(colorInput.value);
  });

  hexInput.addEventListener("change", () => {
    updateColor(hexInput.value);
  });

  hexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      updateColor(hexInput.value);
    }
  });

  sizeSelect.addEventListener("change", () => {
    void renderSelectedIcon();
  });

  downloadButton.addEventListener("click", () => {
    if (!state.pngUrl || !state.selectedIcon) {
      return;
    }

    const link = document.createElement("a");
    link.href = state.pngUrl;
    link.download = `${state.selectedIcon.name}-${state.style}-${sizeSelect.value}px-${state.color.slice(1)}.png`;
    link.click();
  });

  dragImage.addEventListener("dragstart", (event) => {
    if (!state.pngUrl || !state.selectedIcon) {
      event.preventDefault();
      return;
    }

    const filename = `${state.selectedIcon.name}-${state.style}.png`;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", state.pngUrl);
    event.dataTransfer.setData("text/uri-list", state.pngUrl);
    event.dataTransfer.setData("DownloadURL", `image/png:${filename}:${state.pngUrl}`);

    if (typeof event.dataTransfer.setDragImage === "function") {
      event.dataTransfer.setDragImage(dragImage, dragImage.width / 2, dragImage.height / 2);
    }
  });
}

function updateColor(rawValue) {
  const normalized = normalizeHex(rawValue);
  state.color = normalized;
  colorInput.value = normalized;
  hexInput.value = normalized.toUpperCase();
  void renderSelectedIcon();
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  state.filteredIcons = state.icons.filter((icon) => matchesQuery(icon, query));
  renderGrid();
}

function matchesQuery(icon, query) {
  if (!query) {
    return true;
  }

  const haystack = [icon.name, icon.category, ...icon.tags].join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderGrid() {
  iconGrid.textContent = "";

  const visibleIcons = state.filteredIcons.slice(0, MAX_GRID_ITEMS);
  resultCount.textContent = `${state.filteredIcons.length.toLocaleString()} matches`;

  if (!visibleIcons.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "hint";
    emptyState.textContent = "No icons match that search yet.";
    iconGrid.append(emptyState);
    return;
  }

  for (const icon of visibleIcons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    if (state.selectedIcon?.name === icon.name) {
      button.classList.add("selected");
    }

    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = "";
    image.src = `/api/icon/${resolveAvailableStyle(icon)}/${icon.name}`;

    const label = document.createElement("span");
    label.className = "icon-name";
    label.textContent = icon.name;

    button.append(image, label);
    button.addEventListener("click", async () => {
      state.selectedIcon = icon;
      if (!icon.styles.includes(state.style)) {
        state.style = resolveAvailableStyle(icon);
      }
      updateSelectionLabel();
      syncStyleButtons();
      renderGrid();
      await updateSelectedAsset();
    });

    iconGrid.append(button);
  }
}

async function loadSelectedIcon() {
  if (!state.selectedIcon) {
    return;
  }

  const response = await fetch(`/api/icon/${state.style}/${state.selectedIcon.name}`);
  state.selectedSvg = await response.text();
}

async function updateSelectedAsset() {
  if (!state.selectedIcon) {
    return;
  }

  if (!state.selectedIcon.styles.includes(state.style)) {
    state.style = resolveAvailableStyle(state.selectedIcon);
    syncStyleButtons();
  }

  updateSelectionLabel();
  await loadSelectedIcon();
  await renderSelectedIcon();
}

async function renderSelectedIcon() {
  if (!state.selectedIcon || !state.selectedSvg) {
    svgPreview.classList.add("empty");
    svgPreview.textContent = "Select an icon to preview it here.";
    previewTitle.textContent = "Choose an icon";
    previewStage.classList.remove("is-draggable");
    svgPreview.classList.remove("hidden");
    dragImage.classList.add("hidden");
    downloadButton.disabled = true;
    return;
  }

  previewTitle.textContent = `${state.selectedIcon.name} (${state.style})`;

  const recoloredSvg = recolorSvg(state.selectedSvg, state.color);
  const svgDataUrl = createSvgDataUrl(recoloredSvg);
  const pngResult = await rasterizeSvg(svgDataUrl, Number(sizeSelect.value));
  state.pngUrl = pngResult.url;

  svgPreview.classList.remove("empty", "hidden");
  svgPreview.innerHTML = recoloredSvg;
  dragImage.src = state.pngUrl;
  dragImage.classList.remove("hidden");
  previewStage.classList.add("is-draggable");
  svgPreview.classList.add("hidden");
  dragHelp.textContent = "Drag this preview into Google Slides, or use Download PNG if the browser blocks the drop.";
  downloadButton.disabled = false;
}

function resolveAvailableStyle(icon) {
  return icon.styles.includes(state.style) ? state.style : icon.styles[0] || "outline";
}

function updateSelectionLabel() {
  if (!state.selectedIcon) {
    selectionLabel.textContent = "No icon selected";
    return;
  }

  selectionLabel.textContent = `${state.selectedIcon.name} · ${state.style}`;
}

function syncStyleButtons() {
  const selectedIcon = state.selectedIcon;

  for (const button of styleToggle.querySelectorAll("[data-style]")) {
    const style = button.dataset.style;
    const supported = !selectedIcon || selectedIcon.styles.includes(style);
    const active = state.style === style;
    button.disabled = !supported;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
    button.title = supported ? "" : "This icon does not have that variant.";
  }
}

function recolorSvg(svg, color) {
  const withCurrentColor = svg
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/fill="currentColor"/g, `fill="${color}"`);

  return withCurrentColor.replace(/<svg\b([^>]*)>/, "<svg$1 aria-hidden=\"true\" focusable=\"false\">");
}

function createSvgDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

async function rasterizeSvg(svgUrl, size) {
  const image = new Image();
  image.decoding = "async";

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("PNG generation failed.");
  }

  return {
    url: await new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.readAsDataURL(blob);
    }),
  };
}

function normalizeHex(value) {
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : state.color;
}
