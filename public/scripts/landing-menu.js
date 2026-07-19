(function () {
  var landingHeader = document.querySelector("[data-landing-header]");
  var landingMenuToggle = document.querySelector("[data-landing-menu-toggle]");
  var landingMobileNav = document.querySelector("[data-landing-mobile-nav]");
  var landingMenuClose = document.querySelector("[data-landing-menu-close]");
  var landingMenuLabel = document.querySelector("[data-landing-menu-label]");
  var lastFocusedElement = null;
  var landingMenuCloseTimeout = null;
  var landingMenuTransitionDuration = 200;

  if (!landingHeader || !landingMenuToggle || !landingMobileNav) {
    return;
  }

  var finishLandingMenuClose = function () {
    landingMenuCloseTimeout = null;
    landingMobileNav.hidden = true;
    landingMobileNav.removeAttribute("aria-hidden");
    landingMobileNav.removeAttribute("inert");
    landingMobileNav.removeAttribute("data-closing");
  };

  var shouldReduceLandingMenuMotion = function () {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  var setLandingMenuOpen = function (open, shouldRestoreFocus) {
    var isOpen = Boolean(open);

    if (landingMenuCloseTimeout !== null) {
      window.clearTimeout(landingMenuCloseTimeout);
      landingMenuCloseTimeout = null;
    }

    landingMenuToggle.setAttribute("aria-expanded", String(isOpen));
    document.documentElement.classList.toggle("landing-menu-lock", isOpen);

    if (landingMenuLabel) {
      landingMenuLabel.textContent = isOpen ? "Cerrar menú" : "Abrir menú";
    }

    if (isOpen) {
      landingMobileNav.hidden = false;
      landingMobileNav.removeAttribute("aria-hidden");
      landingMobileNav.removeAttribute("inert");
      landingMobileNav.removeAttribute("data-closing");
      lastFocusedElement = document.activeElement;
      if (landingMenuClose) {
        landingMenuClose.focus();
      }
      return;
    }

    if (shouldRestoreFocus && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }

    if (landingMobileNav.hidden || shouldReduceLandingMenuMotion()) {
      finishLandingMenuClose();
      return;
    }

    landingMobileNav.setAttribute("aria-hidden", "true");
    landingMobileNav.setAttribute("inert", "");
    landingMobileNav.setAttribute("data-closing", "");
    landingMenuCloseTimeout = window.setTimeout(finishLandingMenuClose, landingMenuTransitionDuration);
  };

  landingMenuToggle.addEventListener("click", function () {
    var isOpen = landingMenuToggle.getAttribute("aria-expanded") === "true";
    setLandingMenuOpen(!isOpen, isOpen);
  });

  if (landingMenuClose) {
    landingMenuClose.addEventListener("click", function () {
      setLandingMenuOpen(false, true);
    });
  }

  landingMobileNav.addEventListener("click", function (event) {
    var target = event.target;
    var link = target instanceof Element ? target.closest("a") : null;

    if (link && landingMobileNav.contains(link)) {
      setLandingMenuOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setLandingMenuOpen(false, true);
    }
  });

  if (window.matchMedia) {
    var desktopQuery = window.matchMedia("(min-width: 521px)");
    var closeOnDesktop = function (event) {
      if (event.matches) {
        setLandingMenuOpen(false);
      }
    };

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener("change", closeOnDesktop);
    } else {
      var legacyAddListener = desktopQuery["add" + "Listener"];

      if (typeof legacyAddListener === "function") {
        legacyAddListener.call(desktopQuery, closeOnDesktop);
      }
    }
  }
})();

(function () {
  var serviceImages = document.querySelector(".landing-services");
  var imageDialog = document.querySelector(".landing-image-dialog");

  if (!serviceImages || !(imageDialog instanceof HTMLDialogElement)) {
    return;
  }

  var imageDialogImage = imageDialog.querySelector(".landing-image-dialog__image");
  var imageDialogClose = imageDialog.querySelector(".landing-image-dialog__close");

  if (!(imageDialogImage instanceof HTMLImageElement)) {
    return;
  }

  serviceImages.addEventListener("click", function (event) {
    var target = event.target;
    var button = target instanceof Element ? target.closest(".landing-card__media-button") : null;

    if (!(button instanceof HTMLElement) || !serviceImages.contains(button)) {
      return;
    }

    imageDialogImage.src = button.dataset.fullImageSrc || "";
    imageDialogImage.alt = button.dataset.fullImageAlt || "";
    imageDialog.showModal();
  });

  if (imageDialogClose) {
    imageDialogClose.addEventListener("click", function () {
      imageDialog.close();
    });
  }

  imageDialog.addEventListener("click", function (event) {
    if (event.target === imageDialog) {
      imageDialog.close();
    }
  });
})();
