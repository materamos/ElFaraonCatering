const menuIndex = document.querySelector(".menu-index");
const menuIndexSentinel = document.querySelector("[data-menu-index-sentinel]");
let updateScheduled = false;

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
  const activationOffset = getStickyActivationOffset();
  const isPastIndexStart =
    sentinelTop <= activationOffset || (menuIndexTop <= 0 && getScrollY() > 0);

  setMenuIndexStuck(isPastIndexStart);
};

const scheduleMenuIndexUpdate = () => {
  if (updateScheduled) {
    return;
  }

  updateScheduled = true;
  window.requestAnimationFrame(() => {
    updateScheduled = false;
    updateMenuIndexState();
  });
};

if (menuIndex) {
  updateMenuIndexState();
  window.addEventListener("scroll", scheduleMenuIndexUpdate, { passive: true });
  window.addEventListener("resize", scheduleMenuIndexUpdate);
  window.addEventListener("orientationchange", scheduleMenuIndexUpdate);
  window.addEventListener("pageshow", scheduleMenuIndexUpdate);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", scheduleMenuIndexUpdate, { passive: true });
    window.visualViewport.addEventListener("resize", scheduleMenuIndexUpdate);
  }
}
