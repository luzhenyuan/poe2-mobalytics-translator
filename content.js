(function () {
  'use strict';

  /**
   * 配置类：存储所有的翻译映射和选择器配置。
   */
  class TranslationConfig {
    constructor() {
      this.exactMap = { ...window.Others, ...window.legendaryItems, ...window.passives, ...window.Skills };
      this.templateMap = window.templateMap || {};
      this.fixedTextMap = window.fixedTextMap || {};
      this.selectorConfig = [
        { selectors: ['[data-tippy-root] p', '[data-tippy-root] span'] },
        { selectors: ['p.x2fl5vp.x1g1qkmr', 'p[data-test="skill-name"]'] },
        { selectors: ['img[alt]', 'img.skill-icon'], attribute: 'alt' },
        { selectors: ['span.x5qbwci.xggjnk3', 'span.skill-name'] },
        { selectors: ['p.x1cabzks'] }
      ];
    }
  }

  /**
   * 翻译类：处理网页中的所有翻译操作。
   */
  class Translator {
    constructor(config) {
      this.config = config;
      this.translatedSet = new WeakSet();
      this.compiledTemplates = this.compileTemplates();
      this.debouncedTranslate = this.debounce(this.translateAll.bind(this), 200);
      this.initObserver();
    }

    /**
     * 编译模板映射，生成匹配的正则表达式。
     */
    compileTemplates() {
      return Object.entries(this.config.templateMap).map(([tpl, trans]) => {
        const escapedTemplate = tpl.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
        const pattern = '^([+\\-]?)' + escapedTemplate.replace(/#/g, '([\\d.\\-()]+)') + '$';
        return { regex: new RegExp(pattern, 'i'), translation: trans };
      });
    }

    /**
     * 防抖函数：减少频繁执行的操作。
     */
    debounce(fn, delay) {
      let timer = null;
      return function () {
        clearTimeout(timer);
        timer = setTimeout(fn, delay);
      };
    }

    /**
     * 初始化 DOM 变化观察器，用于触发翻译操作。
     */
    initObserver() {
      const observer = new MutationObserver(this.debouncedTranslate);
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('load', this.translateAll.bind(this));
      document.addEventListener('click', () => setTimeout(this.translateAll.bind(this), 500));
    }

    /**
     * 根据选择器查询 DOM 元素。
     */
    multiQuery(selectors) {
      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length) return nodes;
      }
      return [];
    }

    /**
     * 适用精确翻译：根据文本内容查找并替换翻译。
     */
    applyExactTranslation(elements, prop = 'textContent') {
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;
        const val = prop === 'textContent' ? el.textContent.trim() : el.getAttribute(prop)?.trim();
        if (val && this.config.exactMap[val] && !val.includes(this.config.exactMap[val])) {
          const newVal = `${this.config.exactMap[val]} (${val})`;
          if (prop === 'textContent') {
            el.textContent = newVal;
          } else {
            el.setAttribute(prop, newVal);
          }
          this.translatedSet.add(el);
        }
      });
    }

    /**
     * 只替换文本节点中的内容，不改变其他 DOM 子节点。
     */
    applyExactTextOnlyTranslation(elements) {
      elements.forEach(el => {
        if (this.translatedSet.has(el)) return;
        const original = el.textContent.trim();
        if (this.config.exactMap[original] && !el.textContent.includes(this.config.exactMap[original])) {
          el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent = `${this.config.exactMap[original]} (${original})`;
            }
          });
          this.translatedSet.add(el);
        }
      });
    }

    /**
     * 翻译物品属性：处理与模板匹配的翻译。
     */
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

    /**
     * 翻译固定文本：将文本替换为对应的固定翻译。
     */
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

    /**
     * 翻译 Tippy 提示框中的文本。
     */
    translateTippyRootText() {
      const elements = Array.from(document.querySelectorAll('[data-tippy-root] span, [data-tippy-root] div'));
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

    /**
     * 翻译所有需要翻译的内容。
     */
    translateAll() {
      // 遍历配置的选择器，动态翻译页面中的文本
      this.config.selectorConfig.forEach(config => {
        this.applyExactTranslation(this.multiQuery(config.selectors), config.attribute || 'textContent');
      });

      // 翻译物品属性、固定文本和 Tippy 提示框
      this.translateItemAttributes();
      this.translateFixedText();
      this.translateTippyRootText();
    }
  }

  // 初始化翻译配置和翻译器实例
  const config = new TranslationConfig();
  const translator = new Translator(config);

})();
