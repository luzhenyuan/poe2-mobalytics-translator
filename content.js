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

        if (el.closest('[data-lexical-editor], [data-lexical-decorator]')) return;

        if (prop === 'textContent') {
          const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
          textNodes.forEach(node => {
            const raw = node.nodeValue.trim();
            if (!raw) return;
            const translated = this.config.exactMap[raw];
            if (translated) node.nodeValue = `${translated} (${raw})`;
          });
        } else {
          const value = el.getAttribute(prop)?.trim();
          if (!value) return;
          const translated = this.config.exactMap[value];
          if (translated) el.setAttribute(prop, `${translated} (${value})`);
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
      const escapeReg = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (this.translatedTextNodes.has(node)) continue;
        if (node.parentElement && node.parentElement.getAttribute('data-lexical-text') === 'true') {
          continue;
        }

        const raw = node.nodeValue;
        if (!raw) continue;

        let txt = raw;
        let changed = false;

        for (const [en, zh] of Object.entries(this.config.fixedTextMap)) {
          const re = new RegExp(`\\b${escapeReg(en)}\\b`, 'g');
          if (re.test(txt)) {
            txt = txt.replace(re, zh);
            changed = true;
          }
        }

        if (changed) {
          node.nodeValue = txt;
          this.translatedTextNodes.add(node);
        }
      }
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
      if (isUp) setTimeout(() => this.translateSupportGems(), 100);
    }

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
        if (node.parentElement && node.parentElement.getAttribute('data-lexical-text') === 'true') {
          continue;
        }

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

function cleanText(el) {
  let html = el.innerHTML;
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/p>/gi, "\n");
  html = html.replace(/<[^>]+>/g, "");
  html = html.replace(/\n\s*\n+/g, "\n\n").trim();
  return html;
}

function extractSectionText(section) {
  let parts = [];
  section.querySelectorAll("h3,h4,p,li").forEach(el => {
    if (el.closest('[role="button"]')) return;
    const txt = cleanText(el);
    if (!txt) return;
    if (txt.startsWith("Support Gem Requirements")) return;
    if (/^(Str|Dex|Int)\s*\d+$/.test(txt)) return;
    parts.push(txt);
  });
  return parts.join("\n");
}

function addCopyButtons() {
  const root = document.querySelector(
    "#container > div > main > div:nth-child(2) > div > section > section:nth-child(2) > section:nth-child(1)"
  );
  if (!root) return;

  const sections = root.querySelectorAll("section[data-allow-dnd]");
  if (!sections.length) return;


  sections.forEach((section) => {
    const header = section.querySelector("header");
    if (!header) return;
    const titleEl = header.querySelector("h2,h3,h4,h5");
    if (!titleEl) return;

    const title = titleEl.innerText.trim();
    if (title.includes("Build Overview")) return;

    if (header.querySelector(".copy-section-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "x1n2onr6 x19l6gds x19jf9pv x78zum5 x6s0dn4 x167g77z xlkovuz x1ypdohk xuxw1ft x10w6t97 x84vhe8 xl56j7k x1mx5ifq x1kylzug xsj9wuo x1g1qkmr copy-section-btn";
    btn.innerHTML = `<span role="img" style="mask:url(https://cdn.mobalytics.gg/assets/common/icons/ngf-system/share.svg) center/cover"
      class="x1kky2od xlup9mm x1vipdrg"></span>复制`;

    btn.addEventListener("click", () => {
      const stage = section.querySelector('[role="tab"][aria-selected="true"] span')?.innerText || "";
      const body = extractSectionText(section);
      const content = `${title}${stage ? " - " + stage : ""}\n\n${body}`;
      navigator.clipboard.writeText(content).then(() => {
        btn.textContent = "✅ 已複製";
        setTimeout(() => {
          btn.innerHTML = `<span role="img" style="mask:url(https://cdn.mobalytics.gg/assets/common/icons/ngf-system/share.svg) center/cover"
            class="x1kky2od xlup9mm x1vipdrg"></span>复制`;
        }, 1500);
      });
    });

    const container = titleEl.parentElement;
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.appendChild(btn);
  });

  const topTitle = root.querySelector("header h2");
  if (topTitle && !topTitle.parentElement.querySelector(".copy-all-btn")) {
    const btnAll = document.createElement("button");
    btnAll.type = "button";
    btnAll.className =
      "x1n2onr6 x19l6gds x19jf9pv x78zum5 x6s0dn4 x167g77z xlkovuz x1ypdohk xuxw1ft x10w6t97 x84vhe8 xl56j7k x1mx5ifq x1kylzug xsj9wuo x1g1qkmr copy-all-btn";
    btnAll.innerHTML = `<span role="img" style="mask:url(https://cdn.mobalytics.gg/assets/common/icons/ngf-system/share.svg) center/cover"
      class="x1kky2od xlup9mm x1vipdrg"></span>复制全部`;

    btnAll.addEventListener("click", () => {
      let content = "";
      const latestSections = root.querySelectorAll("section[data-allow-dnd]");
      latestSections.forEach((sec) => {
        const headerEl = sec.querySelector("header h2,h3,h4,h5");
        if (!headerEl) return;
        const title = headerEl.innerText.trim();
        const stage = sec.querySelector('[role="tab"][aria-selected="true"] span')?.innerText || "";
        const body = extractSectionText(sec);
        if (body) content += `${title}${stage ? " - " + stage : ""}\n\n${body}\n\n`;
      });
      if (content.trim()) {
        navigator.clipboard.writeText(content.trim()).then(() => {
          btnAll.textContent = "✅ 已复制全部";
          setTimeout(() => {
            btnAll.innerHTML = `<span role="img" style="mask:url(https://cdn.mobalytics.gg/assets/common/icons/ngf-system/share.svg) center/cover"
              class="x1kky2od xlup9mm x1vipdrg"></span>复制全部`;
          }, 1500);
        });
      }
    });

    const container = topTitle.parentElement;
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.appendChild(btnAll);
  }
}

window.addEventListener("load", addCopyButtons);
const mo = new MutationObserver(addCopyButtons);
mo.observe(document.body, { childList: true, subtree: true });



})();
