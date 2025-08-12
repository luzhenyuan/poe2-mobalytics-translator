(function () {
  'use strict';

  const exactMap = window.exactMap || {};
  const templateMap = window.templateMap || {};
  const fixedTextMap = window.fixedTextMap || {};

  const compiledTemplates = Object.entries(templateMap).map(([tpl, trans]) => {
    const esc = tpl.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
    const pattern = '^([+\\-]?)' + esc.replace(/#/g, '([\\d.\\-()]+)') + '$';
    return { regex: new RegExp(pattern, 'i'), translation: trans };
  });

  const translatedSet = new WeakSet();

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function multiQuery(selectors) {
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length) return nodes;
    }
    return [];
  }

  // 通用精确翻译（不会覆盖）
  function applyExactTranslation(elements, prop = 'textContent') {
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      const val = prop === 'textContent' ? el.textContent.trim() : el.getAttribute(prop)?.trim();
      if (val && exactMap[val] && !val.includes(exactMap[val])) {
        const newVal = `${exactMap[val]} (${val})`;
        if (prop === 'textContent') {
          el.textContent = newVal;
        } else {
          el.setAttribute(prop, newVal);
        }
        translatedSet.add(el);
      }
    });
  }

  // 只替换元素里的文本节点，不动其他子节点（保持图片不丢失）
  function applyExactTextOnlyTranslation(elements) {
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      const original = el.textContent.trim();
      if (exactMap[original] && !el.textContent.includes(exactMap[original])) {
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = `${exactMap[original]} (${original})`;
          }
        });
        translatedSet.add(el);
      }
    });
  }

  function translateItemAttributes() {
    document.querySelectorAll('ul li').forEach(el => {
      if (translatedSet.has(el)) return;
      const txt = el.textContent.trim();
      for (const { regex, translation } of compiledTemplates) {
        const m = txt.match(regex);
        if (m) {
          let res = translation;
          m.slice(2).forEach(val => res = res.replace('#', val));
          el.textContent = (m[1] || '') + res;
          translatedSet.add(el);
          break;
        }
      }
    });
  }

  function translateFixedText() {
    const elements = Array.from(document.querySelectorAll('p, span, li')).filter(el => {
      const txt = el.textContent;
      if (!txt?.trim()) return false;
      if (exactMap[txt.trim()]) return false;
      return Object.keys(fixedTextMap).some(key => txt.includes(key));
    });
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      let txt = el.textContent;
      for (const [en, zh] of Object.entries(fixedTextMap)) {
        txt = txt.replace(new RegExp(`\\b${en}\\b`, 'g'), zh);
      }
      if (txt !== el.textContent) {
        el.textContent = txt;
        translatedSet.add(el);
      }
    });
  }

  function translateTippyRootText() {
    const elements = Array.from(document.querySelectorAll('[data-tippy-root] span, [data-tippy-root] div'));
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      const txt = el.textContent.trim();
      if (!txt) return;
      if (exactMap[txt]) {
        el.textContent = `${exactMap[txt]} (${txt})`;
        translatedSet.add(el);
      } else if (fixedTextMap[txt]) {
        el.textContent = fixedTextMap[txt];
        translatedSet.add(el);
      }
    });
  }

  function translateSupportGems() {
    applyExactTextOnlyTranslation(document.querySelectorAll('div.x1gslohp'));
  }

  function translateAll() {
    applyExactTranslation(multiQuery(['[data-tippy-root] p', '[data-tippy-root] span']));
    applyExactTranslation(multiQuery(['p.x2fl5vp.x1g1qkmr', 'p[data-test="skill-name"]']));
    applyExactTranslation(multiQuery(['img[alt]', 'img.skill-icon']), 'alt');
    applyExactTranslation(multiQuery(['span.x5qbwci.xggjnk3', 'span.skill-name']));
    applyExactTranslation(multiQuery(['p.x1cabzks']));

    translateSupportGems();
    translateItemAttributes();
    translateFixedText();
    translateTippyRootText();
  }

  const debouncedTranslate = debounce(translateAll, 200);
  const observer = new MutationObserver(debouncedTranslate);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('load', translateAll);
  document.addEventListener('click', () => setTimeout(translateAll, 500));

})();
