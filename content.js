(function () {
  'use strict';

  class TranslationConfig {
    constructor() {
      this.exactMap = { ...window.Others, ...window.legendaryItems, ...window.passives, ...window.Skills };
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
      this.compiledTemplates = this.compileTemplates();
      this.debouncedTranslate = this.debounce(this.translateAll.bind(this), 200);
      this.initObserver();
    }

    compileTemplates() {
      return Object.entries(this.config.templateMap).map(([tpl, trans]) => {
        const escapedTemplate = tpl.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
        const pattern = '^([+\\-]?)' + escapedTemplate.replace(/#/g, '([\\d.\\-()]+)') + '$';
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
      const observer = new MutationObserver(this.debouncedTranslate);
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('load', this.translateAll.bind(this));
      document.addEventListener('click', () => setTimeout(this.translateAll.bind(this), 500));
    }

    multiQuery(selectors) {
      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length) return nodes;
      }
      return [];
    }

    replaceTextNode(el, zh, en, useBreak = false) {
      const frag = document.createDocumentFragment();
      frag.append(zh);
      if (useBreak) {
        frag.append(document.createElement('br'));
        frag.append(`(${en})`);
      } else {
        frag.append(` (${en})`);
      }
      el.textContent = ''; // 清空原内容
      el.appendChild(frag);
    }

    applyExactTranslation(elements, prop = 'textContent') {
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;
        if (prop === 'textContent') {
          const val = el.textContent.trim();
          if (val && this.config.exactMap[val] && !el.textContent.includes(this.config.exactMap[val])) {
            this.replaceTextNode(el, this.config.exactMap[val], val, false);
            this.translatedSet.add(el);
          }
        } else {
          const val = el.getAttribute(prop)?.trim();
          if (val && this.config.exactMap[val] && !val.includes(this.config.exactMap[val])) {
            el.setAttribute(prop, `${this.config.exactMap[val]} (${val})`);
            this.translatedSet.add(el);
          }
        }
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
            match.slice(2).forEach(val => result = result.replace('#', val));
            el.textContent = (match[1] || '') + result;
            this.translatedSet.add(el);
            break;
          }
        }
      });
    }

    translateFixedText() {
      const elements = Array.from(document.querySelectorAll('p, span, li')).filter(el => {
        const txt = el.textContent;
        if (!txt?.trim()) return false;
        if (this.config.exactMap[txt.trim()]) return false;
        return Object.keys(this.config.fixedTextMap).some(key => txt.includes(key));
      });
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;
        let txt = el.textContent;
        for (const [en, zh] of Object.entries(this.config.fixedTextMap)) {
          txt = txt.replace(new RegExp(`\\b${en}\\b`, 'g'), zh);
        }
        if (txt !== el.textContent) {
          el.textContent = txt;
          this.translatedSet.add(el);
        }
      });
    }

    translateTippyRootText() {
      const elements = Array.from(document.querySelectorAll('[data-tippy-root] span, [data-tippy-root] div'));
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;
        const txt = el.textContent.trim();
        if (!txt) return;
        if (this.config.exactMap[txt]) {
          this.replaceTextNode(el, this.config.exactMap[txt], txt, false);
          this.translatedSet.add(el);
        } else if (this.config.fixedTextMap[txt]) {
          el.textContent = this.config.fixedTextMap[txt];
          this.translatedSet.add(el);
        }
      });
    }

    /**
     * 翻译展开后的辅助技能
     */
    translateSupportGems() {
      // 找到所有展开状态的技能块
      const expandedBlocks = document.querySelectorAll('img[src*="triangle-up.svg"], span[style*="triangle-up.svg"]');
      expandedBlocks.forEach(icon => {
        const container = icon.closest('div');
        if (!container) return;
        // 在容器里找文字
        const texts = container.querySelectorAll('div, span, p');
        texts.forEach(el => {
          if (this.translatedSet.has(el)) return;
          const val = el.textContent.trim();
          if (!val) return;
          if (this.config.exactMap[val] && !el.textContent.includes(this.config.exactMap[val])) {
            this.replaceTextNode(el, this.config.exactMap[val], val, true); // 🔥 换行格式
            this.translatedSet.add(el);
          }
        });
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
      this.config.selectorConfig.forEach(config => {
        this.applyExactTranslation(this.multiQuery(config.selectors), config.attribute || 'textContent');
      });
      this.translateItemAttributes();
      this.translateFixedText();
      this.translateTippyRootText();
      this.translateSupportGems(); // 🔥 专门处理展开的辅助宝石
      this.translateFallback();
    }
  }

  const config = new TranslationConfig();
  const translator = new Translator(config);

})();
