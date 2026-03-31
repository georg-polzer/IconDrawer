const searchInput = document.querySelector("#search-input");
const libraryMenu = document.querySelector("#library-menu");
const libraryMenuButton = document.querySelector("#library-menu-button");
const libraryMenuOptions = document.querySelector("#library-menu-options");
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
  libraries: [],
  selectedLibraries: new Set(),
  filteredIcons: [],
  selectedIcon: null,
  selectedSvg: "",
  style: "outline",
  color: "#1F6FEB",
  pngUrl: "",
};

const MAX_GRID_ITEMS = 160;

initialize();

async function initialize() {
  setupEvents();
  syncStyleButtons();

  try {
    const response = await fetch("/api/icons");
    const payload = await response.json();
    state.icons = payload.icons;
    state.libraries = payload.libraries;
    state.selectedLibraries = new Set(payload.libraries.map((library) => library.key));
    renderLibraryOptions();
    updateLibraryMenuButton();
    applySearch();
  } catch (error) {
    resultCount.textContent = "Failed to load icon libraries.";
    console.error(error);
  }
}

function setupEvents() {
  searchInput.addEventListener("input", () => {
    applySearch();
  });

  libraryMenuButton.addEventListener("click", () => {
    libraryMenu.toggleAttribute("open");
    libraryMenuButton.setAttribute("aria-expanded", String(libraryMenu.hasAttribute("open")));
  });

  document.addEventListener("click", (event) => {
    if (!libraryMenu.contains(event.target)) {
      libraryMenu.removeAttribute("open");
      libraryMenuButton.setAttribute("aria-expanded", "false");
    }
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
    link.download = `${state.selectedIcon.library}-${state.selectedIcon.name}-${state.style}-${sizeSelect.value}px-${state.color.slice(1)}.png`;
    link.click();
  });

  dragImage.addEventListener("dragstart", (event) => {
    if (!state.pngUrl || !state.selectedIcon) {
      event.preventDefault();
      return;
    }

    const filename = `${state.selectedIcon.library}-${state.selectedIcon.name}-${state.style}.png`;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", state.pngUrl);
    event.dataTransfer.setData("text/uri-list", state.pngUrl);
    event.dataTransfer.setData("DownloadURL", `image/png:${filename}:${state.pngUrl}`);

    if (typeof event.dataTransfer.setDragImage === "function") {
      event.dataTransfer.setDragImage(dragImage, dragImage.width / 2, dragImage.height / 2);
    }
  });
}

function renderLibraryOptions() {
  libraryMenuOptions.textContent = "";

  for (const library of state.libraries) {
    const option = document.createElement("label");
    option.className = "library-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = library.key;
    checkbox.checked = state.selectedLibraries.has(library.key);
    checkbox.addEventListener("change", () => {
      toggleLibrary(library.key, checkbox.checked);
    });

    const text = document.createElement("span");
    text.textContent = library.label;

    option.append(checkbox, text);
    libraryMenuOptions.append(option);
  }
}

function toggleLibrary(libraryKey, enabled) {
  if (enabled) {
    state.selectedLibraries.add(libraryKey);
  } else if (state.selectedLibraries.size > 1) {
    state.selectedLibraries.delete(libraryKey);
  } else {
    const checkbox = libraryMenuOptions.querySelector(`input[value="${libraryKey}"]`);
    if (checkbox) {
      checkbox.checked = true;
    }
    return;
  }

  updateLibraryMenuButton();
  applySearch();
}

function updateLibraryMenuButton() {
  const selectedLabels = state.libraries
    .filter((library) => state.selectedLibraries.has(library.key))
    .map((library) => library.label);

  if (selectedLabels.length === state.libraries.length) {
    libraryMenuButton.textContent = "All libraries";
    return;
  }

  if (selectedLabels.length === 1) {
    libraryMenuButton.textContent = selectedLabels[0];
    return;
  }

  libraryMenuButton.textContent = `${selectedLabels.length} libraries`;
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
  state.filteredIcons = state.icons.filter((icon) => state.selectedLibraries.has(icon.library) && matchesQuery(icon, query));
  renderGrid();
}

function matchesQuery(icon, query) {
  if (!query) {
    return true;
  }

  const haystack = [icon.name, icon.category, icon.library, ...icon.tags].join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderGrid() {
  iconGrid.textContent = "";

  const visibleIcons = state.filteredIcons.slice(0, MAX_GRID_ITEMS);
  resultCount.textContent = `${state.filteredIcons.length.toLocaleString()} matches`;

  if (!visibleIcons.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "hint";
    emptyState.textContent = "No icons match that search and library combination yet.";
    iconGrid.append(emptyState);
    return;
  }

  for (const icon of visibleIcons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    if (state.selectedIcon?.library === icon.library && state.selectedIcon?.name === icon.name) {
      button.classList.add("selected");
    }

    const badge = document.createElement("span");
    badge.className = "icon-library";
    badge.textContent = getLibraryLabel(icon.library);

    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = "";
    image.src = `/api/icon/${icon.library}/${resolveAvailableStyle(icon)}/${icon.name}`;

    const label = document.createElement("span");
    label.className = "icon-name";
    label.textContent = icon.name;

    button.append(badge, image, label);
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

  const response = await fetch(`/api/icon/${state.selectedIcon.library}/${state.style}/${state.selectedIcon.name}`);
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

  previewTitle.textContent = `${state.selectedIcon.name} (${getLibraryLabel(state.selectedIcon.library)} · ${state.style})`;

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

  selectionLabel.textContent = `${getLibraryLabel(state.selectedIcon.library)} · ${state.selectedIcon.name} · ${state.style}`;
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
  return svg
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/fill="currentColor"/g, `fill="${color}"`)
    .replace(/stroke="#(?:[0-9a-fA-F]{3}){1,2}"/g, `stroke="${color}"`)
    .replace(/fill="#(?:[0-9a-fA-F]{3}){1,2}"/g, `fill="${color}"`)
    .replace(/<svg\b([^>]*)>/, "<svg$1 aria-hidden=\"true\" focusable=\"false\">");
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

function getLibraryLabel(libraryKey) {
  return state.libraries.find((library) => library.key === libraryKey)?.label || libraryKey;
}

function normalizeHex(value) {
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : state.color;
}
