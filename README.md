# 帧记 · Frame Notes

HoshitoXiusun 的独立个人视频截图与音轨网站。浅牛皮纸、蓝色与橘色界面，单文件、无后台、无远程依赖。版本 v1.0.3。

- 手动截图默认不暂停播放，也不启动原本暂停的视频。可选择截图后暂停。
- 图片保留在视频右侧，支持预览、备注、随当前排序动态编号、删除 / 撤销、保留 / 排除。
- 截图默认按来源和视频时间排序；新增、删除、撤销或更换排序时重新连续编号，预览、导出文件名与清单保持一致。项目保存当前排序，旧项目默认时间排序。
- 时间 / 帧范围批量截取，起止默认空；均为空处理全片。批量期间定位取帧，结束后恢复原位置与播放状态。
- 全局与逐张时间戳开关、位置 / 字号 / 颜色；PNG / JPG / WebP、CSV 与 ZIP 导出。
- 每次载入视频默认有声（80% 音量）；调高音量自动取消静音，解除静音时若音量为零会恢复上次音量；“恢复声音”一键重置并播放。M 键静音。
- 拖拽时间轴、跳转和左右快捷键保留原播放状态；← / → 每次后退 / 快进 1.5 秒。单帧按钮仍按 FPS 定位并暂停。WAV 音轨导出支持完整音频或时间范围，保持源音量与原速，不受播放器静音影响。
- 长视频使用 metadata 预加载；预览框在导入前即独立占位，视频 / 提示层绝对定位，文件信息栏固定高度，时间与播放按钮固定宽度；预留滚动条空间并关闭页面自动滚动锚定。视频层不再使用 paint containment。加载监听先于 src/load，并清理被替换视频的监听和超时。浏览器解码取决于素材编码与机器性能。
- Zen / Gecko 自动采用兼容播放预览：播放时不叠加动态时间戳，暂停后恢复预览；截图 / 图片导出仍按原水印设置执行。播放器不再使用绘制隔离容器。Zen 使用 Firefox 内核，见[官方说明](https://docs.zen-browser.app/security)。
- `.lawdesk` 视频项目保存 / 恢复，与工作台旧项目兼容；不包含原视频。
- 离线页面下载只包含程序，不包含用户选取的视频、音频、截图或备注。

## 使用

在线站点：https://hoshitoxiusun.github.io/luotuo/ （GitHub Pages）。源码：[HoshitoXiusun/luotuo](https://github.com/HoshitoXiusun/luotuo)。

本地打开根目录 `index.html` 或 `dist/index.html`，推荐 Chrome / Edge。无需安装依赖或启动服务器。静态站点初次访问会下载程序，文件处理仍在浏览器本机完成；需要断网使用时，点击“离线页面”下载 HTML。

音轨导出使用浏览器 Web Audio 解码并重建 44.1kHz / 16-bit WAV。限 5 分钟、100MB 内的单 / 双声道源视频，限制用于控制解码与内存开销；视频播放和截图不受此时长限制。播放需要浏览器支持原视频的音频编码；无音轨的素材不会生成声音。无音轨或不支持的编码会给出提示。见 [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)。

批量帧号按设定 FPS 换算，可变帧率真实帧号可能不同。播放中的手动截图记录 canvas 取图时的浏览器时间，不保证逐帧枚举。切换音频工具或批量界面不会暂停正在播放的视频，真正开始批量截取时才临时暂停。

## 开发

```sh
npm run build
npm run check
npm test
```

无需 `npm install`。Node 24 在 CI 使用；构建仅依赖 Node 内置模块。`src/index.html` 是模板；根目录 / dist 的 index.html 是构建成品，不要直接编辑成品。

| 路径 | 用途 |
| --- | --- |
| src/index.html / styles.css | 独立站布局与主题 |
| src/video.js | 播放、画面捕获、复核与导出 |
| src/audio.js / core/audio.js | 音量、音轨解码、范围验证与 WAV 编码 |
| src/core/project.js | 项目、编号、撤销与复核 |
| src/app.js | 三种功能切换与不含用户数据的离线页面下载 |
| scripts | 单文件构建、静态审计及实际浏览器布局回归函数 |
| tests | 编号、范围、音频 PCM / WAV、播放兼容与加载竞态测试 |
| history | 设计沿革与版本文件校验清单 |

布局回归使用 `scripts/verify-layout.mjs` 导出的 `verifyLayout(task, {htmlPath, videoPath, portraitPath})`，由 ego-browser nodejs 在已有任务空间调用。传入本地、含有效索引、时长超过 3600 秒的 WebM 测试文件；可选竖屏素材。回归会逐帧记录预览框和播放器尺寸、滚动位置，测试五种窗口宽度及导入 / 播放 / 跨小时跳转 / 切换 / 失败状态。该检查需要实际浏览器，不在 Node CI 中模拟浏览器布局。

## GitHub Pages

仓库使用 main 分支根目录的 `index.html` 作为网站首页；`.nojekyll` 保留单文件静态内容。提交触发 **Check Frame Notes**，检查构建、离线约束及测试。

若自行 fork，可在 Settings → Pages 中设置 Deploy from a branch → main → /(root)。也附 **Publish GitHub Pages** 手动工作流，可选用 GitHub Actions 发布。详见 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 来源与许可

独立站从律师工作台的视频模块拆分，保留最初视频工具的本地处理思路；截图流程参考了 [FrameWow](https://framewow.toolooz.com/guide)。跨平台路径工具与 SVG 图标改编自 [Docsy](https://github.com/muxiaoxiii/docsy) 基线 `b9c2114ee2453ea73b0973f497b6818fa0e4c9a1`，MIT。原许可见 LICENSE-Docsy，当前项目许可见 LICENSE。

不依赖工作台、PDF 引擎或 Docsy 运行时，不包含其余工作空间。设计与验证过程见 `history/设计沿革.md` 和 `docs/验证记录.md`。
