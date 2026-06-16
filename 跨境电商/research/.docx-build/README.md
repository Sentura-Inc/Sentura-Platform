# docx 生成工具（server-location-llm-decision-report）

把 `../server-location-llm-decision-report.md` 渲染成排版精良的 .docx。

## 用法
```bash
npm install docx@9         # 一次性
node gen.js ../server-location-llm-decision-report.md ../server-location-llm-decision-report.docx
python3 fix_bookmarks.py   ../server-location-llm-decision-report.docx   # 修复 docx-js 书签 id 重复
```

## 关键点（踩坑记录）
- CJK 字体用 **Hiragino Sans GB**（macOS Word 与 fontconfig 都有，渲染一致；PingFang 不在 fontconfig 里）。
- docx-js 的段落边框 `pBdr` 子元素顺序固定为 top,bottom,left,right —— 与 OOXML schema(top,left,bottom,right)冲突；callout 改用单元格表格(tcBorders 顺序正确)绕开。
- docx-js 给每个 Bookmark 的数字 `w:id` 都赋 1（重复）→ 用 fix_bookmarks.py 重新编号。
- 8 列决策矩阵单独放 landscape section；列宽用 weight^0.62 抑制宽窄差，避免窄列竖排。
- **视觉验收以 Microsoft Word 导出 PDF 为准**：LibreOffice 对「emoji+CJK 紧邻 Latin」有 tofu 渲染 bug（如 RTT 显示成 □），Word 正常，是 LibreOffice 渲染器问题、非文档缺陷。
