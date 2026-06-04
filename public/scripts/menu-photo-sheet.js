const dialog = document.querySelector("[data-photo-sheet]");
const photoTitle = document.querySelector("[data-photo-title]");
const photoFrame = document.querySelector("[data-photo-frame]");
const photoControls = document.querySelector("[data-photo-controls]");
const photoCount = document.querySelector("[data-photo-count]");
const previousButton = document.querySelector("[data-photo-prev]");
const nextButton = document.querySelector("[data-photo-next]");
const closeButton = document.querySelector("[data-photo-close]");

if (
  dialog instanceof HTMLDialogElement &&
  typeof dialog.showModal === "function" &&
  photoTitle instanceof HTMLElement &&
  photoFrame instanceof HTMLElement &&
  photoControls instanceof HTMLElement &&
  photoCount instanceof HTMLElement &&
  previousButton instanceof HTMLButtonElement &&
  nextButton instanceof HTMLButtonElement &&
  closeButton instanceof HTMLButtonElement
) {
  let lastTrigger = null;
  let currentImage = null;
  let currentPhotoName = "plato";
  let currentPhotoSources = [];
  let currentPhotoIndex = 0;

  const setPhotoMessage = (message) => {
    const paragraph = document.createElement("p");
    paragraph.className = "photo-sheet__message";
    paragraph.textContent = message;
    photoFrame.replaceChildren(paragraph);
  };

  const resetPhotoState = () => {
    currentImage = null;
    currentPhotoName = "plato";
    currentPhotoSources = [];
    currentPhotoIndex = 0;
    photoControls.hidden = true;
    photoCount.textContent = "";
    photoFrame.replaceChildren();
  };

  const closeSheet = () => dialog.close();

  const getPhotoSources = (trigger) => {
    const fallbackPhotoSrc = trigger.dataset.photoSrc?.trim();
    const rawPhotoSources = trigger.dataset.photoSrcs?.trim();

    if (!rawPhotoSources) {
      return fallbackPhotoSrc ? [fallbackPhotoSrc] : [];
    }

    try {
      const parsedSources = JSON.parse(rawPhotoSources);

      if (!Array.isArray(parsedSources)) {
        return fallbackPhotoSrc ? [fallbackPhotoSrc] : [];
      }

      const photoSources = [];

      for (const source of parsedSources) {
        if (typeof source === "string") {
          const trimmedSource = source.trim();

          if (trimmedSource && !photoSources.includes(trimmedSource)) {
            photoSources.push(trimmedSource);
          }
        }
      }

      return photoSources.length > 0 ? photoSources : fallbackPhotoSrc ? [fallbackPhotoSrc] : [];
    } catch {
      return fallbackPhotoSrc ? [fallbackPhotoSrc] : [];
    }
  };

  const updatePhotoControls = () => {
    const hasMultiplePhotos = currentPhotoSources.length > 1;

    photoControls.hidden = !hasMultiplePhotos;
    photoCount.textContent = hasMultiplePhotos
      ? `${currentPhotoIndex + 1} / ${currentPhotoSources.length}`
      : "";
  };

  const loadPhoto = (index) => {
    if (currentPhotoSources.length === 0) {
      return;
    }

    currentPhotoIndex = (index + currentPhotoSources.length) % currentPhotoSources.length;
    updatePhotoControls();

    const image = new Image();
    const photoNumber = currentPhotoIndex + 1;

    image.className = "photo-frame__image";
    image.decoding = "async";
    image.alt =
      currentPhotoSources.length > 1
        ? `Foto ${photoNumber} de ${currentPhotoName}`
        : `Foto de ${currentPhotoName}`;

    image.addEventListener("load", () => {
      if (currentImage === image) {
        photoFrame.replaceChildren(image);
      }
    });

    image.addEventListener("error", () => {
      if (currentImage === image) {
        setPhotoMessage("No se pudo cargar la foto.");
      }
    });

    currentImage = image;
    setPhotoMessage("Cargando foto...");
    image.src = currentPhotoSources[currentPhotoIndex];
  };

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest("[data-photo-trigger]");

    if (!(trigger instanceof HTMLAnchorElement)) {
      return;
    }

    const photoSources = getPhotoSources(trigger);

    if (photoSources.length === 0) {
      return;
    }

    event.preventDefault();

    lastTrigger = trigger;
    currentPhotoName = trigger.dataset.photoName?.trim() || "plato";
    currentPhotoSources = photoSources;
    currentPhotoIndex = 0;
    photoTitle.textContent = currentPhotoName;
    dialog.showModal();
    loadPhoto(0);
  });

  previousButton.addEventListener("click", () => {
    loadPhoto(currentPhotoIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    loadPhoto(currentPhotoIndex + 1);
  });

  closeButton.addEventListener("click", closeSheet);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeSheet();
    }
  });

  dialog.addEventListener("close", () => {
    resetPhotoState();

    if (lastTrigger instanceof HTMLElement) {
      lastTrigger.focus();
    }
  });
}
