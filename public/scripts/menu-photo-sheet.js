const dialog = document.querySelector("[data-photo-sheet]");
const photoTitle = document.querySelector("[data-photo-title]");
const photoFrame = document.querySelector("[data-photo-frame]");
const closeButton = document.querySelector("[data-photo-close]");

if (
  dialog instanceof HTMLDialogElement &&
  typeof dialog.showModal === "function" &&
  photoTitle instanceof HTMLElement &&
  photoFrame instanceof HTMLElement &&
  closeButton instanceof HTMLButtonElement
) {
  let lastTrigger = null;
  let currentImage = null;

  const setPhotoMessage = (message) => {
    const paragraph = document.createElement("p");
    paragraph.className = "photo-sheet__message";
    paragraph.textContent = message;
    photoFrame.replaceChildren(paragraph);
  };

  const resetPhotoState = () => {
    currentImage = null;
    photoFrame.replaceChildren();
  };

  const closeSheet = () => dialog.close();

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest("[data-photo-trigger]");

    if (!(trigger instanceof HTMLAnchorElement)) {
      return;
    }

    const photoSrc = trigger.dataset.photoSrc?.trim();

    if (!photoSrc) {
      return;
    }

    event.preventDefault();

    const photoName = trigger.dataset.photoName?.trim() || "plato";
    const photoAlt = trigger.dataset.photoAlt?.trim() || `Imagen de ${photoName}`;
    const image = new Image();

    image.className = "photo-frame__image";
    image.decoding = "async";
    image.alt = photoAlt;

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

    lastTrigger = trigger;
    currentImage = image;
    photoTitle.textContent = photoName;
    setPhotoMessage("Cargando foto...");
    dialog.showModal();
    image.src = photoSrc;
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
