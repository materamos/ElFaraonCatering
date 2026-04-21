const dialog = document.querySelector("[data-photo-sheet]");
const photoTitle = document.querySelector("[data-photo-title]");
const photoImage = document.querySelector("[data-photo-image]");
const photoError = document.querySelector("[data-photo-error]");
const closeButton = document.querySelector("[data-photo-close]");

if (
  dialog instanceof HTMLDialogElement &&
  typeof dialog.showModal === "function" &&
  photoTitle instanceof HTMLElement &&
  photoImage instanceof HTMLImageElement &&
  photoError instanceof HTMLElement &&
  closeButton instanceof HTMLButtonElement
) {
  let lastTrigger = null;

  const resetPhotoState = () => {
    photoImage.hidden = true;
    photoImage.removeAttribute("src");
    photoImage.alt = "";
    photoError.hidden = true;
  };

  const closeSheet = () => dialog.close();

  photoImage.addEventListener("load", () => {
    photoError.hidden = true;
    photoImage.hidden = false;
  });

  photoImage.addEventListener("error", () => {
    photoImage.hidden = true;
    photoError.hidden = false;
  });

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

    lastTrigger = trigger;
    photoTitle.textContent = photoName;
    photoError.hidden = true;
    photoImage.hidden = true;
    photoImage.alt = `Foto de ${photoName}`;
    photoImage.src = photoSrc;
    dialog.showModal();
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
