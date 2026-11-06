(() => {
  const changesPage = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/|$)/;
  const diffSection = '[role="region"][id^="diff-"], .file[id^="diff-"], .js-file[id^="diff-"]';
  const viewedControl = 'button[class*="MarkAsViewedButton"], button[aria-label="Viewed"], '
    + 'button[aria-label="Not Viewed"], input.js-reviewed-checkbox';
  const treeLink = '[role="treeitem"] .PRIVATE_TreeView-item-content-text > a[href^="#diff-"], '
    + 'file-tree a[href*="#diff-"]';
  const watchedElements = `${viewedControl}, ${treeLink}`;
  const viewedAttribute = 'data-pr-viewed-file-name';

  const viewedDiffIds = new Set();
  let changesUrl = null;
  let scheduledFrame = null;

  function isViewed(control) {
    if (control instanceof HTMLInputElement) return control.checked;

    const pressed = control.getAttribute('aria-pressed');
    if (pressed !== null) return pressed === 'true';

    return control.querySelector('.octicon-checkbox-fill') !== null;
  }

  function updateFileNames() {
    scheduledFrame = null;
    for (const control of document.querySelectorAll(viewedControl)) {
      const diff = control.closest(diffSection);
      if (!diff) continue;

      if (isViewed(control)) {
        viewedDiffIds.add(diff.id);
      } else {
        viewedDiffIds.delete(diff.id);
      }
    }

    for (const link of document.querySelectorAll(treeLink)) {
      const fileName = link.querySelector('.ActionList-item-label') ?? link;
      fileName.toggleAttribute(viewedAttribute, viewedDiffIds.has(link.hash.slice(1)));
    }
  }

  function scheduleUpdate() {
    if (scheduledFrame === null) scheduledFrame = requestAnimationFrame(updateFileNames);
  }

  function handleViewedChange(event) {
    if (event.target instanceof Element && event.target.closest(viewedControl)) scheduleUpdate();
  }

  function affectsFileNames({ type, target, addedNodes }) {
    if (type === 'attributes') return target.matches(watchedElements) || target.matches(diffSection);
    if (target.closest(watchedElements)) return true;

    for (const node of addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(watchedElements) || (node.childElementCount && node.querySelector(watchedElements))) {
        return true;
      }
    }
    return false;
  }

  const observer = new MutationObserver((mutations) => {
    if (scheduledFrame === null && mutations.some(affectsFileNames)) scheduleUpdate();
  });

  function handleNavigation() {
    const nextChangesUrl = changesPage.test(location.pathname) ? location.pathname + location.search : null;
    if (nextChangesUrl === changesUrl) return;

    if (nextChangesUrl && !changesUrl) {
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-label', 'checked', 'href', 'id'],
      });
      document.addEventListener('click', handleViewedChange, true);
      document.addEventListener('change', handleViewedChange, true);
    }

    changesUrl = nextChangesUrl;
    viewedDiffIds.clear();
    if (changesUrl) {
      scheduleUpdate();
      return;
    }

    observer.disconnect();
    document.removeEventListener('click', handleViewedChange, true);
    document.removeEventListener('change', handleViewedChange, true);
    if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = null;
    for (const name of document.querySelectorAll(`[${viewedAttribute}]`)) {
      name.removeAttribute(viewedAttribute);
    }
  }

  navigation.addEventListener('currententrychange', handleNavigation);
  handleNavigation();
})();
