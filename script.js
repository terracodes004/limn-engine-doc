import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const burgerBtn = document.getElementById('nav-burger');
  const asideNav = document.querySelector('aside');

  if (burgerBtn && asideNav) {
    burgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      asideNav.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (asideNav.classList.contains('open') && !asideNav.contains(e.target)) {
        asideNav.classList.remove('open');
      }
    });
  }

  const navLinks = document.querySelectorAll('nav ul li a');
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  navLinks.forEach((link) => {
    if (link.getAttribute('href') === currentPath) {
      link.parentElement.classList.add('active');
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  const codeBlocks = document.querySelectorAll('pre');

  codeBlocks.forEach((pre) => {
    pre.style.position = 'relative';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-code-btn';
    copyBtn.innerText = '📋 Copy';

    Object.assign(copyBtn.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      background: 'var(--surface, #05083d)',
      color: 'var(--accent2, #7fffb2)',
      border: '1px solid var(--border, rgba(255,99,140,0.2))',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '11px',
      fontFamily: "'Space Mono', monospace",
      cursor: 'pointer',
      zIndex: '10',
      transition: 'all 0.2s ease'
    });

    copyBtn.addEventListener('click', async () => {
      const codeText = pre.querySelector('code')?.innerText || pre.innerText;
      try {
        await navigator.clipboard.writeText(codeText);
        copyBtn.innerText = '✅ Copied!';
        copyBtn.style.color = '#7fffb2';

        setTimeout(() => {
          copyBtn.innerText = '📋 Copy';
          copyBtn.style.color = 'var(--accent2, #7fffb2)';
        }, 2000);
      } catch (err) {
        copyBtn.innerText = '❌ Failed';
      }
    });

    pre.appendChild(copyBtn);
  });

  checkUnreadBadge();
  setupSettingsBadge();
  setupProfileLink();
  setupInboxBadge();
  setupCtaSlider();
});

async function checkUnreadBadge() {
  const badge = document.getElementById('avatar-badge');
  if (!badge) return;

  try {
    let allIds = [];

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userDocs } = await supabase
        .from('user_documents')
        .select('id')
        .eq('user_id', user.id);

      if (userDocs) {
        userDocs.forEach(doc => allIds.push('doc-' + doc.id));
      }
    }

    const { data: engineUpdates } = await supabase
      .from('engine_updates')
      .select('id');

    if (engineUpdates) {
      engineUpdates.forEach(update => allIds.push('update-' + update.id));
    }

    const readIds = JSON.parse(localStorage.getItem('limn_read_notifications') || '[]');
    const unreadCount = allIds.filter(id => !readIds.includes(id)).length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }

  } catch (err) {
    console.log('Error checking unread badge:', err);
  }
}

function setupSettingsBadge() {
  const hasVisited = localStorage.getItem('limn_settings_visited');
  const badge = document.getElementById('settings-badge');

  if (!hasVisited && badge) {
    badge.style.display = 'inline-block';
  }

  const settingsLink = document.getElementById('settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', () => {
      if (badge) badge.style.display = 'none';
    });
  }
}

function setupProfileLink() {
  const profileLink = document.getElementById('my-profile-link');
  const profileBadge = document.getElementById('profile-badge');
  if (!profileLink) return;

  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && profile.username) {
        profileLink.href = '/u/?u=' + encodeURIComponent(profile.username);
      } else {
        profileLink.href = '/settings.html';
        if (profileBadge) profileBadge.style.display = 'inline-block';
      }
    } catch (e) {
      console.log('Profile link setup skipped:', e.message);
    }
  })();
}

function setupInboxBadge() {
  const inboxBadge = document.getElementById('inbox-badge');
  if (!inboxBadge) return;

  const INBOX_SEEN_KEY = 'limn_inbox_seen';

  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const lastSeen = localStorage.getItem(INBOX_SEEN_KEY) || '1970-01-01T00:00:00Z';

      const { count } = await supabase
        .from('engine_updates')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastSeen);

      if (count && count > 0) {
        inboxBadge.style.display = 'inline-block';
      } else {
        inboxBadge.style.display = 'none';
      }
    } catch (e) {
      console.log('Inbox badge check skipped:', e.message);
    }
  })();

  const inboxLink = document.getElementById('inbox-link');
  if (inboxLink) {
    inboxLink.addEventListener('click', () => {
      localStorage.setItem(INBOX_SEEN_KEY, new Date().toISOString());
      inboxBadge.style.display = 'none';
    });
  }
}

function setupCtaSlider() {
  const slider = document.getElementById('ctaSlider');
  const track = document.getElementById('ctaTrack');
  const dotsEl = document.getElementById('ctaDots');
  if (!slider || !track || !dotsEl) return;

  const slides = Array.from(track.children);
  const total = slides.length;
  if (total === 0) return;

  let current = 0;
  let timer = null;
  const INTERVAL = 3500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'cta-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Show call to action ' + (i + 1));
    dot.addEventListener('click', () => goTo(i, true));
    dotsEl.appendChild(dot);
  });
  const dots = Array.from(dotsEl.children);

  function goTo(index, userAction) {
    current = (index + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === current);
      d.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });
    slides.forEach((s, i) => {
      s.setAttribute('aria-hidden', i === current ? 'false' : 'true');
      s.tabIndex = i === current ? 0 : -1;
    });
    if (userAction) restartAuto();
  }

  function next() { goTo(current + 1, false); }

  function startAuto() {
    if (reduceMotion) return;
    stopAuto();
    timer = setInterval(next, INTERVAL);
  }
  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function restartAuto() {
    stopAuto();
    startAuto();
  }

  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  slider.addEventListener('focusin', stopAuto);
  slider.addEventListener('focusout', startAuto);

  let touchStartX = 0;
  let touchDeltaX = 0;
  slider.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
    stopAuto();
  }, { passive: true });
  slider.addEventListener('touchmove', (e) => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
  }, { passive: true });
  slider.addEventListener('touchend', () => {
    if (Math.abs(touchDeltaX) > 40) {
      if (touchDeltaX < 0) goTo(current + 1, false);
      else goTo(current - 1, false);
    }
    restartAuto();
  });

  slider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1, true); }
  });

  goTo(0, false);
  startAuto();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');

      window.addEventListener('online', () => {
        registration.update();
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New PWA version found. Reloading...');
            window.location.reload();
          }
        });
      });
    } catch (err) {
      console.error('Service worker registration failed:', err);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
                                          }
