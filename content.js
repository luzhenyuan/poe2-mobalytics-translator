(function () {
  'use strict';

  class TranslationConfig {
    constructor() {
      this.exactMap = {
        ...window.Others,
        ...window.legendaryItems,
        ...window.passives,
        ...window.Skills
      };

      this.templateMap = window.templateMap || {};
      this.fixedTextMap = window.fixedTextMap || {};

      this.selectorConfig = [
        { selectors: ['[data-tippy-root] p', '[data-tippy-root] span'] },
        { selectors: ['p[data-test="skill-name"]'] },
        { selectors: ['img[alt]', 'img.skill-icon'], attribute: 'alt' }
      ];
    }
  }

  class Translator {
    constructor(config) {
      this.config = config;
      this.translatedSet = new WeakSet();
      this.translatedTextNodes = new WeakSet();
      this.observedTriangles = new WeakSet();

      this.compiledTemplates = this.compileTemplates();
      this.debouncedTranslate = this.debounce(this.translateAll.bind(this), 200);

      this.initObserver();
    }

    compileTemplates() {
      return Object.entries(this.config.templateMap).map(([tpl, trans]) => {
        const escaped = tpl.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
        const pattern = '^([+\\-]?)' + escaped.replace(/#/g, '([\\d.\\-()]+)') + '$';
        return { regex: new RegExp(pattern, 'i'), translation: trans };
      });
    }

    debounce(fn, delay) {
      let timer = null;
      return function () {
        clearTimeout(timer);
        timer = setTimeout(fn, delay);
      };
    }

    initObserver() {
      const bodyObserver = new MutationObserver(() => {
        this.debouncedTranslate();
        this.observeTriangles();
      });

      bodyObserver.observe(document.body, { childList: true, subtree: true });

      window.addEventListener('load', () => {
        this.translateAll();
        this.observeTriangles();
      });

      document.addEventListener('click', () => {
        setTimeout(() => {
          this.translateAll();
          this.observeTriangles();
        }, 300);
      });
    }

    multiQuery(selectors) {
      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length) return nodes;
      }
      return [];
    }

    applyExactTranslation(elements, prop = 'textContent') {
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;

        const value =
          prop === 'textContent'
            ? el.textContent.trim()
            : el.getAttribute(prop)?.trim();

        if (!value) return;

        const translated = this.config.exactMap[value];
        if (!translated) return;

        const formatted = `${translated} (${value})`;

        if (prop === 'textContent') {
          el.textContent = formatted;
        } else {
          el.setAttribute(prop, formatted);
        }

        this.translatedSet.add(el);
      });
    }

    translateItemAttributes() {
      document.querySelectorAll('ul li').forEach(el => {
        if (this.translatedSet.has(el)) return;

        const txt = el.textContent.trim();
        for (const { regex, translation } of this.compiledTemplates) {
          const match = txt.match(regex);
          if (match) {
            let result = translation;
            match.slice(2).forEach(val => (result = result.replace('#', val)));
            el.textContent = (match[1] || '') + result;
            this.translatedSet.add(el);
            break;
          }
        }
      });
    }

    translateFixedText() {
      const candidates = Array.from(document.querySelectorAll('p, span, li'));
      candidates.forEach(el => {
        if (this.translatedSet.has(el)) return;

        let txt = el.textContent;
        if (!txt?.trim()) return;

        if (this.config.exactMap[txt.trim()]) return;

        let changed = false;
        for (const [en, zh] of Object.entries(this.config.fixedTextMap)) {
          if (txt.includes(en)) {
            txt = txt.replace(new RegExp(`\\b${en}\\b`, 'g'), zh);
            changed = true;
          }
        }

        if (changed) {
          el.textContent = txt;
          this.translatedSet.add(el);
        }
      });
    }

    translateTippyRootText() {
      const elements = document.querySelectorAll('[data-tippy-root] span, [data-tippy-root] div');
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;

        const txt = el.textContent.trim();
        if (!txt) return;

        if (this.config.exactMap[txt]) {
          el.textContent = `${this.config.exactMap[txt]} (${txt})`;
          this.translatedSet.add(el);
        } else if (this.config.fixedTextMap[txt]) {
          el.textContent = this.config.fixedTextMap[txt];
          this.translatedSet.add(el);
        }
      });
    }

    observeTriangles() {
      const icons = document.querySelectorAll('img[src*="triangle-"], span[style*="triangle-"]');
      icons.forEach(icon => {
        if (this.observedTriangles.has(icon)) return;

        const mo = new MutationObserver(() => this.handleTriangleChange(icon));
        mo.observe(icon, { attributes: true, attributeFilter: ['src', 'style'] });

        this.observedTriangles.add(icon);
      });
    }

    handleTriangleChange(icon) {
      const src = icon.getAttribute('src') || '';
      const style = icon.getAttribute('style') || '';
      const isUp = src.includes('triangle-up.svg') || style.includes('triangle-up.svg');
      if (isUp) {
        setTimeout(() => this.translateSupportGems(), 100);
      }
    }

    // 动态探测展开后的辅助宝石节点
    getSupportGemNodes() {
      const icons = document.querySelectorAll('img[width="40"], img[height="40"], img[src*="SupportGem"]');
      const nodes = [];
      icons.forEach(icon => {
        const row = icon.closest('div');
        if (!row) return;
        const textEl = row.querySelector('div, span, p');
        if (!textEl) return;
        const en = textEl.textContent.trim();
        if (!en) return;
        if (this.config.exactMap[en]) nodes.push(textEl);
      });
      return nodes;
    }

    translateSupportGems() {
      const gemBlocks = this.getSupportGemNodes();
      gemBlocks.forEach(el => {
        if (el.dataset.supportTranslated === '1') return;

        const en = el.textContent.trim();
        const zh = this.config.exactMap[en];
        if (!zh) return;

        el.textContent = '';
        const frag = document.createDocumentFragment();
        frag.append(document.createTextNode(zh));
        frag.append(document.createElement('br'));
        frag.append(document.createTextNode(`(${en})`));
        el.appendChild(frag);

        el.dataset.supportTranslated = '1';
      });
    }

    translateFallback() {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (this.translatedTextNodes.has(node)) continue;

        const raw = node.nodeValue;
        if (!raw) continue;

        const trimmed = raw.trim();
        if (!trimmed) continue;

        const tr = this.config.exactMap[trimmed];
        if (tr && !raw.includes(tr)) {
          node.nodeValue = `${tr} (${trimmed})`;
          this.translatedTextNodes.add(node);
        }
      }
    }

    translateAll() {
      this.config.selectorConfig.forEach(cfg => {
        this.applyExactTranslation(this.multiQuery(cfg.selectors), cfg.attribute || 'textContent');
      });

      this.translateItemAttributes();
      this.translateFixedText();
      this.translateTippyRootText();
      this.translateFallback();
    }
  }

  const config = new TranslationConfig();
  new Translator(config);

})();
