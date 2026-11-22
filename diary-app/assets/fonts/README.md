# 字体资源

原生 App 保留原有 Noto Serif SC OTF（Regular / SemiBold）。字体内嵌版权声明为 © 2017–2024 Adobe，许可为 SIL Open Font License 1.1，详见字体 name 表及 https://openfontlicense.org/。

Web 通过 `web/fonts.css` 引用 `public/fonts/` 中的 WOFF2 子集。两种字重各保留 30,928 个映射字符，UI 子集优先，其余按 Unicode 范围按需加载。文件名含内容摘要，便于不可变缓存；不更改原生字体。

再生成：`python3 scripts/compress-fonts.py`。需要 Python fontTools 与 Node.js；脚本使用 Node 内置 Brotli，无额外联网安装。生成后检查字形映射，并执行 Web 导出及浏览器字体加载检查。旧哈希文件可留作已打开页面的缓存兼容。
