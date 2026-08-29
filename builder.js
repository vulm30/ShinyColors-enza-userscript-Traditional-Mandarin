const fs = require('fs');
const path = require('path');

const dict = JSON.parse(fs.readFileSync(path.join(__dirname, 's2t_dict.json'), 'utf8'));

// 產生輕量且完整的繁簡轉換引擎 (無大體積 Base64)
const s2tEngineCode = `
// =========================================================================
// 內建完整繁簡轉換引擎 (含 OpenCC 4000+ 字符對照與 2500+ 高頻詞庫，體積輕巧秒加載)
// =========================================================================
const S_CHARS = ` + JSON.stringify(dict.sChars) + `;
const T_CHARS = ` + JSON.stringify(dict.tChars) + `;
const PHRASES = ` + JSON.stringify(dict.phrases) + `;

const s2tMap = new Map();
for (let i = 0; i < S_CHARS.length; i++) {
  s2tMap.set(S_CHARS[i], T_CHARS[i]);
}

const phraseMap = new Map();
PHRASES.forEach(([s, t]) => {
  phraseMap.set(s, t);
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^` + '${}()|[\\]' + `\\\\]/g, '\\\\$&');
}

const regexPhrases = new RegExp(PHRASES.map(p => escapeRegExp(p[0])).join('|'), 'g');

function s2t(text) {
  if (!text || typeof text !== 'string') return text;
  let str = text.replace(regexPhrases, matched => phraseMap.get(matched) || matched);
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    res += s2tMap.get(ch) || ch;
  }
  return res;
}

const TW_FONT_FAMILY = '"jf open 粉圓 2.1", "jf-openhuninn-2.1", "jf open 粉圓", "jf-openhuninn", "jf openhuninn", "jf粉圓", HummingStd-E, "Zen Maru Gothic", "Microsoft JhengHei", "PingFang TC", sans-serif';

(function injectOnlineHuninn() {
  try {
    if (!document.getElementById("sczh-tw-huninn-fonts")) {
      const gFont = document.createElement("link");
      gFont.id = "sczh-tw-huninn-fonts";
      gFont.rel = "stylesheet";
      gFont.href = "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+TC:wght@500;700&display=swap";
      document.head.appendChild(gFont);
    }
    
    const styleEl = document.createElement("style");
    styleEl.id = "sczh-tw-font-style";
    styleEl.innerHTML = \`
      @font-face {
        font-family: "HummingStd-E";
        src: local("jf open 粉圓 2.1"),
             local("jf-openhuninn-2.1"),
             local("jf open 粉圓"),
             local("jf-openhuninn"),
             local("jf openhuninn"),
             local("jf粉圓"),
             url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf") format("truetype"),
             local("Zen Maru Gothic Bold"),
             local("Zen Maru Gothic Medium"),
             local("Microsoft JhengHei");
        font-weight: normal 100 200 300 400 500 600 700 800 900;
        font-display: swap;
      }
      @font-face {
        font-family: "UDKakugo_SmallPr6-B";
        src: local("jf open 粉圓 2.1"),
             local("jf-openhuninn-2.1"),
             local("jf open 粉圓"),
             local("jf-openhuninn"),
             local("jf openhuninn"),
             local("jf粉圓"),
             url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf") format("truetype"),
             local("Noto Sans TC Bold"),
             local("Zen Maru Gothic Bold"),
             local("Microsoft JhengHei");
        font-weight: normal 100 200 300 400 500 600 700 800 900;
        font-display: swap;
      }
    \`;
    (document.head || document.documentElement).appendChild(styleEl);

    if (window.FontFace && document.fonts) {
      const f1 = new FontFace("HummingStd-E", 'local("jf open 粉圓 2.1"), local("jf-openhuninn-2.1"), url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf")');
      const f2 = new FontFace("UDKakugo_SmallPr6-B", 'local("jf open 粉圓 2.1"), local("jf-openhuninn-2.1"), url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf")');
      Promise.all([f1.load(), f2.load()]).then(fonts => {
        fonts.forEach(f => document.fonts.add(f));
        console.info("[ShinyColors-TW] 粉圓體與日系圓體已成功加載！");
      }).catch(()=>{});
    }
  } catch(e) {}
})();
`;

// 讀取原始主體邏輯
let currentCode = fs.readFileSync(path.join(__dirname, 'ShinyColors-tw.user.js'), 'utf8');

const logicStartIndex = currentCode.indexOf('var e="undefined"!=typeof globalThis');
if (logicStartIndex === -1) {
  console.error('Logic start not found!');
  process.exit(1);
}

let mainLogic = currentCode.slice(logicStartIndex);

// 替換 ji 函數，在 PIXI Text 渲染時注入 TW_FONT_FAMILY
const oldJiPattern = /async function ji\(\)\{[\s\S]*?Reflect\.set\(this,"_text",t\),r\.call\(this,e\);\s*\}\s*\};\s*\}/;
const newJiCode = `async function ji(){
  const e=await Oa("AOBA");
  try{
    Si=await(async()=>{if(!Ei){ki=await _i();const e=await un();ki=new Map([...e,...ki]),Ei=!0}return ki})(),xi=await gs()
  }catch(e){}
  
  const t=e.Text.prototype.typeText;
  e.Text.prototype.typeText=function(...e){
    const r=e[0];
    if(this._style){
      this._style.fontFamily=TW_FONT_FAMILY;
      this._style.fontWeight='bold';
    }
    return e[0]=Ci(r,!0),t.apply(this,e);
  };
  
  const r=e.Text.prototype.updateText;
  e.Text.prototype.updateText=function(e){
    if(this._style && this._style.fontFamily!==TW_FONT_FAMILY){
      this._style.fontFamily=TW_FONT_FAMILY;
      this._style.fontWeight='bold';
      this.dirty=!0;
    }
    if(this.localStyleID!==this._style.styleID&&(this.dirty=!0,this._style.styleID),this.dirty||!e){
      T.dev,0;
      const t=Ci(this._text);
      return Reflect.set(this,"_text",t),r.call(this,e);
    }
  };
}`;

mainLogic = mainLogic.replace(oldJiPattern, newJiCode);

// 替換 Wi 函數
const oldWiPattern = /const Ui=[\s\S]*?document\.body\.appendChild\(e\);?\s*\};/;
const newWiCode = `const Ui=e=>{},
Hi=(e,t)=>\`/data/font/\${e}.woff2?v=\${t[\`font/\${e}.woff2\`]}\`,
Wi=async()=>{};`;

mainLogic = mainLogic.replace(oldWiPattern, newWiCode);

const header = `// ==UserScript==
// @name         偶像大师ShinyColors汉化 (繁體機翻增強版 - jf粉圓體輕量版)
// @namespace    https://github.com/biuuu/ShinyColors
// @version      1.13.8
// @description  偶像大師 Shiny Colors 繁體中文漢化與機翻增強插件 (完美套用 jf open 粉圓 2.1 / 秒速載入)
// @icon         https://shinycolors.enza.fun/icon_192x192.png
// @author       biuuu & AI Enhanced
// @match        https://shinycolors.enza.fun/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      api.interpreter.caiyunai.com
// @connect      translate.google.cn
// @connect      fanyi.baidu.com
// @connect      fonts.googleapis.com
// @connect      fonts.gstatic.com
// @connect      cdn.jsdelivr.net
// @updateURL    https://www.shiny.fun/ShinyColors.user.js
// @supportURL   https://github.com/biuuu/ShinyColors/issues
// ==/UserScript==
!function(){"use strict";
`;

const finalScript = header + s2tEngineCode + '\n' + mainLogic;

const dest1 = path.join(__dirname, 'ShinyColors-enza-userscript-Traditional-Mandarin.user.js');

fs.writeFileSync(dest1, finalScript, 'utf8');

console.log('Successfully compiled lightweight ShinyColors-tw.user.js!');
console.log('File size:', finalScript.length, 'characters (~', Math.round(finalScript.length / 1024), 'KB)');
