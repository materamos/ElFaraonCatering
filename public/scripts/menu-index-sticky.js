const menuIndex = document.querySelector(".menu-index");
const menuIndexSentinel = document.querySelector("[data-menu-index-sentinel]");
const menuIndexList = menuIndex?.querySelector(".menu-index__list");
const menuIndexLinks = Array.from(menuIndex?.querySelectorAll(".menu-index__link") ?? []);
const menuSectionTargets = menuIndexLinks
  .map((link) => {
    const sectionId = decodeURIComponent(link.hash.slice(1));
    const section = document.getElementById(sectionId);

    return section ? { link, section, sectionId } : undefined;
  })
  .filter(Boolean);
let updateScheduled = false;
let activeSectionId;
const activeSectionOffset = 24;
const activeSectionEpsilon = 2;
const scrollTargetTolerance = 4;
let pendingScrollSectionId;
let pendingScrollTargetY = 0;
let pendingScrollUntil = 0;

const getScrollY = () => {
  const scrollingElement = document.scrollingElement || document.documentElement;

  return window.scrollY || window.pageYOffset || scrollingElement.scrollTop || 0;
};

const getMaxScrollY = () => {
  const scrollingElement = document.scrollingElement || document.documentElement;

  return Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
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

const getScrollBehavior = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

const centerMenuIndexLink = (link) => {
  if (!menuIndexList || menuIndexList.scrollWidth <= menuIndexList.clientWidth) {
    return;
  }

  const listRect = menuIndexList.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const targetLeft =
    menuIndexList.scrollLeft +
    linkRect.left -
    listRect.left -
    (listRect.width - linkRect.width) / 2;

  menuIndexList.scrollTo({
    left: targetLeft,
    behavior: getScrollBehavior(),
  });
};

const setActiveSection = (sectionId) => {
  if (!sectionId || sectionId === activeSectionId) {
    return;
  }

  activeSectionId = sectionId;

  for (const { link, sectionId: targetSectionId } of menuSectionTargets) {
    const isActive = targetSectionId === sectionId;

    link.classList.toggle("menu-index__link--active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "true");
      centerMenuIndexLink(link);
    } else {
      link.removeAttribute("aria-current");
    }
  }
};

const scrollToSection = (section, hash, sectionId) => {
  setMenuIndexStuck(true);

  window.requestAnimationFrame(() => {
    const stickyBottom = menuIndex.getBoundingClientRect().bottom;
    const targetTop =
      section.getBoundingClientRect().top +
      getScrollY() -
      stickyBottom -
      activeSectionOffset -
      activeSectionEpsilon;
    const targetY = Math.min(getMaxScrollY(), Math.max(0, targetTop));

    pendingScrollSectionId = sectionId;
    pendingScrollTargetY = targetY;
    pendingScrollUntil = window.performance.now() + 1200;

    window.scrollTo({
      top: targetY,
      behavior: getScrollBehavior(),
    });

    if (hash && window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  });
};

const getActiveSectionId = () => {
  if (menuSectionTargets.length === 0) {
    return undefined;
  }

  const maxScrollY = getMaxScrollY();

  if (maxScrollY > 0 && getScrollY() >= maxScrollY - scrollTargetTolerance) {
    return menuSectionTargets[menuSectionTargets.length - 1].sectionId;
  }

  const activationLine = Math.min(
    window.innerHeight - 1,
    menuIndex.getBoundingClientRect().bottom + activeSectionOffset + activeSectionEpsilon,
  );
  let activeTarget = menuSectionTargets[0];

  for (const target of menuSectionTargets) {
    if (target.section.getBoundingClientRect().top <= activationLine) {
      activeTarget = target;
    } else {
      break;
    }
  }

  return activeTarget.sectionId;
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

  if (pendingScrollSectionId) {
    const currentScrollY = getScrollY();
    const reachedTarget =
      Math.abs(currentScrollY - pendingScrollTargetY) <= scrollTargetTolerance ||
      currentScrollY >= getMaxScrollY() - scrollTargetTolerance;
    const isExpired = window.performance.now() > pendingScrollUntil;

    if (!reachedTarget && !isExpired) {
      return;
    }

    pendingScrollSectionId = undefined;
  }

  setActiveSection(getActiveSectionId());
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
  for (const { link, section, sectionId } of menuSectionTargets) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveSection(sectionId);
      scrollToSection(section, link.hash, sectionId);
    });
  }

  updateMenuIndexState();
  window.addEventListener("hashchange", scheduleMenuIndexUpdate);
  window.addEventListener("scroll", scheduleMenuIndexUpdate, { passive: true });
  window.addEventListener("resize", scheduleMenuIndexUpdate);
  window.addEventListener("orientationchange", scheduleMenuIndexUpdate);
  window.addEventListener("pageshow", scheduleMenuIndexUpdate);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", scheduleMenuIndexUpdate, { passive: true });
    window.visualViewport.addEventListener("resize", scheduleMenuIndexUpdate);
  }
}
