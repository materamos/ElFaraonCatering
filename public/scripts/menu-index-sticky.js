const menuIndex = document.querySelector(".menu-index");
const menuIndexSentinel = document.querySelector("[data-menu-index-sentinel]");
const mobileMenuIndexQuery = window.matchMedia("(max-width: 639px)");

const getScrollY = () => {
  const scrollingElement = document.scrollingElement || document.documentElement;

  return window.scrollY || window.pageYOffset || scrollingElement.scrollTop || 0;
};

const setMenuIndexStuck = (isStuck) => {
  menuIndex.classList.toggle("menu-index--stuck", isStuck);
};

const getStickyActivationOffset = () => {
  const value = window
    .getComputedStyle(menuIndex)
    .getPropertyValue("--menu-index-sticky-offset")
    .trim();

  return Number.parseFloat(value) || 0;
};

const updateMenuIndexState = () => {
  if (!menuIndex) {
    return;
  }

  const sentinelTop = menuIndexSentinel
    ? menuIndexSentinel.getBoundingClientRect().top
    : menuIndex.getBoundingClientRect().top;
  const menuIndexTop = menuIndex.getBoundingClientRect().top;
  const isMobile = mobileMenuIndexQuery.matches;
  const activationOffset = getStickyActivationOffset();
  const isPastIndexStart =
    sentinelTop <= activationOffset || (menuIndexTop <= 0 && getScrollY() > 0);

  setMenuIndexStuck(isMobile && isPastIndexStart);
};

if (menuIndex) {
  updateMenuIndexState();
  window.addEventListener("scroll", updateMenuIndexState, { passive: true });
  document.addEventListener("scroll", updateMenuIndexState, { passive: true });
  window.addEventListener("touchmove", updateMenuIndexState, { passive: true });
  window.addEventListener("resize", updateMenuIndexState);
  window.addEventListener("orientationchange", updateMenuIndexState);
  window.addEventListener("pageshow", updateMenuIndexState);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", updateMenuIndexState, { passive: true });
    window.visualViewport.addEventListener("resize", updateMenuIndexState);
  }

  window.setInterval(updateMenuIndexState, 200);
}
