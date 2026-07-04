(function () {
  var landingHeader = document.querySelector("[data-landing-header]");
  var landingMenuToggle = document.querySelector("[data-landing-menu-toggle]");
  var landingMobileNav = document.querySelector("[data-landing-mobile-nav]");
  var landingMenuLabel = document.querySelector("[data-landing-menu-label]");

  if (!landingHeader || !landingMenuToggle || !landingMobileNav) {
    return;
  }

  var setLandingMenuOpen = function (open) {
    var isOpen = Boolean(open);
    landingMenuToggle.setAttribute("aria-expanded", String(isOpen));
    landingMobileNav.hidden = !isOpen;

    if (landingMenuLabel) {
      landingMenuLabel.textContent = isOpen ? "Cerrar menu" : "Abrir menu";
    }
  };

  landingMenuToggle.addEventListener("click", function () {
    var isOpen = landingMenuToggle.getAttribute("aria-expanded") === "true";
    setLandingMenuOpen(!isOpen);
  });

  landingMobileNav.addEventListener("click", function (event) {
    if (event.target && event.target.tagName === "A") {
      setLandingMenuOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setLandingMenuOpen(false);
    }
  });

  document.addEventListener("click", function (event) {
    var isOpen = landingMenuToggle.getAttribute("aria-expanded") === "true";
    var target = event.target;

    if (isOpen && target && !landingHeader.contains(target)) {
      setLandingMenuOpen(false);
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
