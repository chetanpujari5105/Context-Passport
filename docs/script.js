document.documentElement.classList.add('js');

const toast = document.querySelector('.copy-toast');
let toastTimer;

function announce(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', '');
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand('copy');
  fallback.remove();
  if (!copied) throw new Error('Copy is not available in this browser.');
}

document.querySelectorAll('[data-copy-target]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    const label = button.querySelector('.button-label');
    const originalLabel = label?.textContent;
    const originalAriaLabel = button.getAttribute('aria-label');
    try {
      await copyText(target.textContent.trim());
      if (label) label.textContent = 'Copied';
      button.setAttribute('aria-label', 'Command copied to clipboard');
      announce('Command copied to clipboard.');
      window.setTimeout(() => {
        if (label && originalLabel) label.textContent = originalLabel;
        if (originalAriaLabel) button.setAttribute('aria-label', originalAriaLabel);
        else button.removeAttribute('aria-label');
      }, 1800);
    } catch {
      announce('Could not copy automatically. Select the command and copy it manually.');
    }
  });
});

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const navLinks = [...document.querySelectorAll('.nav-links a')];
const sections = navLinks
  .map((link) => document.querySelector(link.hash))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length) {
  const navigationObserver = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!active) return;
    navLinks.forEach((link) => {
      if (link.hash === `#${active.target.id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0.05, 0.3, 0.7] });
  sections.forEach((section) => navigationObserver.observe(section));
}
