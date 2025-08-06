(function() {
  'use strict';

  // 从全局对象读取字典
  const exactMap = window.exactMap || {};
  const templateMap = window.templateMap || {};
  const fixedTextMap = window.fixedTextMap || {};

  // 预编译带 # 的属性模板正则，方便快速匹配替换
  const compiledTemplates = Object.entries(templateMap).map(([tpl, trans]) => {
    // 转义正则特殊字符
    const esc = tpl.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
    // 构造正则匹配数字替换#
    const pattern = '^([+\\-]?)' + esc.replace(/#/g, '([\\d.\\-()]+)') + '$';
    return { regex: new RegExp(pattern, 'i'), translation: trans };
  });

  // 用WeakSet防止重复翻译同一元素，提升效率
  const translatedSet = new WeakSet();

  // 简单防抖函数，避免短时间内多次执行
  function debounce(fn, delay) {
    let timer = null;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  // 尝试多选择器查询，返回第一个匹配集合
  function multiQuery(selectors) {
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length) return nodes;
    }
    return [];
  }

  // 精确匹配翻译，适用于整句或词组（exactMap）
  function applyExactTranslation(elements, prop = 'textContent') {
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      const txt = el[prop]?.trim();
      if (txt && exactMap[txt] && !el[prop].includes(exactMap[txt])) {
        el[prop] = `${exactMap[txt]} (${txt})`;
        translatedSet.add(el);
      }
    });
  }

  // 装备属性模板翻译，使用templateMap正则匹配
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

  // 逐词翻译，针对句中关键词（fixedTextMap），避免破坏整句翻译
  function translateFixedText() {
    const selector = 'p, span, li';
    const elements = Array.from(document.querySelectorAll(selector)).filter(el => {
      const txt = el.textContent;
      if (!txt?.trim()) return false;
      // 如果全文在exactMap中存在，跳过
      if (exactMap[txt.trim()]) return false;
      // 判断文本是否包含任意 fixedTextMap 关键词
      return Object.keys(fixedTextMap).some(key => txt.includes(key));
    });
    elements.forEach(el => {
      if (translatedSet.has(el)) return;
      let txt = el.textContent;
      for (const [en, zh] of Object.entries(fixedTextMap)) {
        // 只替换单词边界内的英文，避免误替换
        txt = txt.replace(new RegExp(`\\b${en}\\b`, 'g'), zh);
      }
      if (txt !== el.textContent) {
        el.textContent = txt;
        translatedSet.add(el);
      }
    });
  }

  // 翻译悬浮提示里单词（data-tippy-root）
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

  // 翻译支援宝石名称
  function translateSupportGems() {
    const selectors = ['div.x1eedua1 div.x1gslohp', 'div.support-gem-name'];
    const nodes = [];
    selectors.forEach(sel => nodes.push(...document.querySelectorAll(sel)));
    applyExactTranslation(nodes);
  }

  // 执行所有翻译
  function translateAll() {
    applyExactTranslation(multiQuery(['[data-tippy-root] p', '[data-tippy-root] span']));
    applyExactTranslation(multiQuery(['p.x2fl5vp.x1g1qkmr', 'p[data-test="skill-name"]']));
    applyExactTranslation(multiQuery(['img[alt]', 'img.skill-icon']), 'alt');
    applyExactTranslation(multiQuery(['span.x5qbwci.xggjnk3', 'span.skill-name']));
    applyExactTranslation(multiQuery(['p.x1cabzks'])); // 处理标题类文本

    translateSupportGems();
    translateItemAttributes();
    translateFixedText();
    translateTippyRootText();
  }

  // 防抖处理的翻译函数
  const debouncedTranslate = debounce(translateAll, 200);

  // 监听 DOM 变化，动态页面自动翻译
  const observer = new MutationObserver(debouncedTranslate);
  observer.observe(document.body, { childList: true, subtree: true });

  // 页面加载完成时翻译
  window.addEventListener('load', () => {
    translateAll();
  });

  // 点击页面后延迟翻译，防止动态内容遗漏
  document.addEventListener('click', () => {
    setTimeout(translateAll, 500);
  });

})();
