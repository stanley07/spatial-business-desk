/**
 * Spatial Business Desk — Premium Landing Page Controller
 * Meta VR Start Developer Competition 2026
 */

export function initLandingPage(): void {
  const landingOverlay = document.getElementById('landing-overlay');
  const floatingBar = document.getElementById('floating-experience-bar');
  const videoModal = document.getElementById('video-modal');
  const demoVideo = document.getElementById('demo-video') as HTMLVideoElement | null;
  const btnCloseModal = document.getElementById('btn-close-modal');

  if (!landingOverlay || !floatingBar) {
    return;
  }

  (window as any).__LANDING_INITIALIZED__ = true;

  const enterExperience = () => {
    landingOverlay.classList.add('experience-active');
    floatingBar.classList.add('visible');
    try {
      if (window.location.hash !== '#experience') {
        window.history.replaceState(null, '', '#experience');
      }
    } catch {
      // Ignore URL state errors
    }
  };

  const returnToOverview = () => {
    landingOverlay.classList.remove('experience-active');
    floatingBar.classList.remove('visible');
    landingOverlay.scrollTop = 0;
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // Ignore URL state errors
    }
  };

  const openVideoModal = () => {
    if (videoModal) {
      videoModal.classList.add('modal-open');
      if (demoVideo) {
        demoVideo.currentTime = 0;
        demoVideo.play().catch(() => {
          // Autoplay policy fallback (user can click play manually)
        });
      }
    }
  };

  const closeVideoModal = () => {
    if (videoModal) {
      videoModal.classList.remove('modal-open');
      if (demoVideo) {
        demoVideo.pause();
      }
    }
  };

  // Bind Enter buttons
  const enterButtons = document.querySelectorAll('.action-enter-experience');
  enterButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      enterExperience();
    });
  });

  // Bind Return button
  const returnBtn = document.getElementById('btn-return-overview');
  if (returnBtn) {
    returnBtn.addEventListener('click', (e) => {
      e.preventDefault();
      returnToOverview();
    });
  }

  // Bind Watch Demo buttons
  const watchButtons = document.querySelectorAll('.action-watch-demo');
  watchButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openVideoModal();
    });
  });

  // Bind Close modal button & backdrop
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeVideoModal();
    });
  }

  if (videoModal) {
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) {
        closeVideoModal();
      }
    });
  }

  // Keyboard shortcut: ESC closes modal or returns
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (videoModal && videoModal.classList.contains('modal-open')) {
        closeVideoModal();
      }
    }
  });

  // Check URL hash / query on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const shouldEnterDirectly =
    window.location.hash === '#experience' ||
    window.location.hash === '#app' ||
    urlParams.get('mode') === 'experience' ||
    urlParams.get('mode') === 'xr' ||
    urlParams.has('skip-landing');

  if (shouldEnterDirectly) {
    enterExperience();
  }
}
