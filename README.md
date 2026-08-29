# 偶像大師 Shiny Colors 繁體中文化與字體增強腳本 (ShinyColors-enza-userscript-Traditional-Mandarin)

本專案為網頁版遊戲《偶像大師 閃耀色彩》（THE IDOLM@STER SHINY COLORS / アイドルマスター シャイニーカラーズ）的 Tampermonkey（油猴 / 竄改猴）使用者腳本。

---

## 📌 專案聲明與致謝

1. **原作者與上游專案**：
   - 本專案修改並衍生自原作者 **biuuu** 的開源漢化專案：[biuuu/ShinyColors](https://github.com/biuuu/ShinyColors)。
   - 核心遊戲數據攔截與漢化架構均屬於原作者與原漢化翻譯團隊。

2. **本分支（Fork / Custom Version）所做的修改與增強**：
   - **繁體中文化轉換（Traditional Mandarin）**：整合 OpenCC 字符對照與詞庫轉換機制，將原本的簡體漢化即時轉為繁體中文（正體中文）。
   - **外掛指定字體**：內建字體注入機制，優先適配並套用由 Justfont 開源之「`jf open 粉圓 2.1`」（若本機未安裝則自動載入線上開源圓體作為 Fallback）。
   - **字體粗細度增強（Bold）**：全面調整 PIXI 引擎中文字渲染的 FontWeight 與樣式，提升文字對比度與閱讀舒適度。

---

## ✨ 功能特色

- **繁體中文即時呈現**：劇情對話、介面選項、卡片技能全面繁體化。
- **高清晰度視覺體驗**：搭配「jf open 粉圓」字型與粗體效果，字形飽滿且清晰易讀。
- **輕量化架構**：字典與樣式經編譯最佳化，載入迅速不卡頓。

---

## 📥 安裝與使用方式

### 步驟 1：安裝瀏覽器擴充套件
請先確保瀏覽器已安裝 Userscript 管理器（推薦使用 [Tampermonkey 竄改猴](https://www.tampermonkey.net/)）。

### 步驟 2：推薦安裝本地字體（可選，但強烈建議）
本腳本預設優先套用本地安裝的「jf open 粉圓 2.1」：
- 前往 Justfont 官方下載並安裝 [jf open 粉圓](https://justfont.com/huninn/)。
- 安裝後無需其他設定，腳本會自動讀取並套用。

### 步驟 3：安裝腳本
1. 打開 Tampermonkey 的「新增腳本」頁面。
2. 複製本專案中的 `ShinyColors-enza-userscript-Traditional-Mandarin.user.js` 全部內容並貼上儲存。
3. 進入 [偶像大師 Shiny Colors enza 平台](https://shinycolors.enza.fun/) 即可開始遊玩。

---

## 🛠️ 開發與重新編譯（進階）

若需要自訂繁簡字典或調整樣式：
- `s2t_dict.json`：繁簡字符與詞彙映射表。
- `builder.js`：構建與打包腳本。
- 執行以下指令進行重新編譯：
  ```bash
  node builder.js
  ```

---

## 📄 開源授權與免責聲明

- **開源授權**：本專案依循上游專案採用 [MIT License](LICENSE) 授權。
- **字型授權**：專案引用的「jf open 粉圓」基於 [SIL Open Font License 1.1](https://scripts.sil.org/OFL) 釋出。
- **免責聲明**：
  - 《偶像大師 閃耀色彩》（THE IDOLM@STER SHINY COLORS）的所有遊戲內容、美術資產、文字及商標權利均歸屬 **萬代南夢宮娛樂（Bandai Namco Entertainment Inc.）** 所有。
  - 本專案僅供個人學習、研究與輔助遊戲體驗使用，嚴禁任何形式的商業營利行為。
