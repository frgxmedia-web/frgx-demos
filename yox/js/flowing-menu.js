/*
  FlowingMenu — vanilla JS port of React Bits' FlowingMenu component.
  Requires: GSAP (load via CDN before this script)
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>

  Full-height stacked menu items. Each row shows a small always-visible
  thumbnail + title + subtitle (works with no hover, e.g. mobile/touch).
  On hover (desktop), a colored marquee band sweeps in from the edge nearest
  the cursor, scrolling the item's text + image infinitely while hovered —
  a bonus flourish layered on top, not required for the content to be usable.

  Usage:
    <div id="flowMenu"></div>
    <script src="flowing-menu.js"></script>
    <script>
      initFlowingMenu('#flowMenu', {
        items: [
          { link:'#', text:'Kannur', sub:'K.K Building, Chalad', image:'images/store-1.jpg' },
          { link:'#', text:'Kuthuparamba', sub:'Kuthuparamba town', image:'images/store-2.jpg' },
        ],
        speed: 15,
        textColor: '#fff',
        bgColor: '#120F17',
        marqueeBgColor: '#fff',
        marqueeTextColor: '#120F17',
        borderColor: '#fff'
      });
    </script>
*/
function initFlowingMenu(selector, opts) {
  const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!root) return;

  const {
    items = [],
    speed = 15,
    textColor = '#fff',
    bgColor = '#120F17',
    marqueeBgColor = '#fff',
    marqueeTextColor = '#120F17',
    borderColor = '#fff'
  } = opts || {};

  root.classList.add('fm-wrap');
  root.style.backgroundColor = bgColor;

  const nav = document.createElement('nav');
  nav.className = 'fm-menu';
  root.innerHTML = '';
  root.appendChild(nav);

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'fm-item';
    el.style.borderColor = borderColor;

    const a = document.createElement('a');
    a.className = 'fm-item-link';
    a.href = item.link || '#';
    a.style.color = textColor;

    if (item.thumb || item.image) {
      const thumb = document.createElement('div');
      thumb.className = 'fm-thumb';
      thumb.style.backgroundImage = `url(${item.thumb || item.image})`;
      a.appendChild(thumb);
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'fm-item-text';
    const title = document.createElement('div');
    title.className = 'fm-item-title';
    title.textContent = item.text;
    textWrap.appendChild(title);
    if (item.sub) {
      const sub = document.createElement('div');
      sub.className = 'fm-item-sub';
      sub.textContent = item.sub;
      textWrap.appendChild(sub);
    }
    a.appendChild(textWrap);

    const arrow = document.createElement('span');
    arrow.className = 'fm-item-arrow';
    arrow.textContent = '↗';
    a.appendChild(arrow);

    const marquee = document.createElement('div');
    marquee.className = 'fm-marquee';
    marquee.style.backgroundColor = marqueeBgColor;

    const innerWrap = document.createElement('div');
    innerWrap.className = 'fm-marquee-inner-wrap';
    const inner = document.createElement('div');
    inner.className = 'fm-marquee-inner';

    function buildParts(n) {
      inner.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const part = document.createElement('div');
        part.className = 'fm-marquee-part';
        part.style.color = marqueeTextColor;
        const span = document.createElement('span');
        span.textContent = item.text;
        part.appendChild(span);
        if (item.image) {
          const img = document.createElement('div');
          img.className = 'fm-marquee-img';
          img.style.backgroundImage = `url(${item.image})`;
          part.appendChild(img);
        }
        inner.appendChild(part);
      }
    }
    buildParts(4);

    innerWrap.appendChild(inner);
    marquee.appendChild(innerWrap);
    el.appendChild(a);
    el.appendChild(marquee);
    nav.appendChild(el);

    let anim = null;
    function setupMarquee() {
      const part = inner.querySelector('.fm-marquee-part');
      if (!part) return;
      const contentWidth = part.offsetWidth;
      if (!contentWidth) return;
      const needed = Math.max(4, Math.ceil(innerWidth / contentWidth) + 2);
      buildParts(needed);
      const w = inner.querySelector('.fm-marquee-part').offsetWidth;
      if (anim) anim.kill();
      if (window.gsap) {
        anim = gsap.to(inner, { x: -w, duration: speed, ease: 'none', repeat: -1 });
      }
    }
    setTimeout(setupMarquee, 60);
    addEventListener('resize', () => setTimeout(setupMarquee, 60));

    function closestEdge(x, y, w, h) {
      const distTop = (x - w / 2) ** 2 + y ** 2;
      const distBottom = (x - w / 2) ** 2 + (y - h) ** 2;
      return distTop < distBottom ? 'top' : 'bottom';
    }

    // hover flourish — desktop only, mobile has no hover so content stays
    // fully usable via the always-visible thumb/title/sub row above
    el.addEventListener('mouseenter', e => {
      if (innerWidth <= 900) return;
      const rect = el.getBoundingClientRect();
      const edge = closestEdge(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
      if (!window.gsap) return;
      gsap.timeline({ defaults: { duration: 0.6, ease: 'expo' } })
        .set(marquee, { y: edge === 'top' ? '-101%' : '101%' }, 0)
        .set(inner, { y: edge === 'top' ? '101%' : '-101%' }, 0)
        .to([marquee, inner], { y: '0%' }, 0);
    });
    el.addEventListener('mouseleave', e => {
      if (innerWidth <= 900) return;
      const rect = el.getBoundingClientRect();
      const edge = closestEdge(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
      if (!window.gsap) return;
      gsap.timeline({ defaults: { duration: 0.6, ease: 'expo' } })
        .to(marquee, { y: edge === 'top' ? '-101%' : '101%' }, 0)
        .to(inner, { y: edge === 'top' ? '101%' : '-101%' }, 0);
    });
  });
}
