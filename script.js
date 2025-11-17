
        // Anti-FOUC (Flash of Unstyled Content) 脚本，防止加载时样式闪烁
        try {
            if (localStorage.getItem('blokkoTheme') === 'dark') {
                document.documentElement.classList.add('dark-mode');
            }
        } catch (e) {
            console.error('从 localStorage 应用主题失败', e);
        }
    

// --- (split from html) --- 


        /**
         * @description 创建一个紧急备份 .zip 包，该函数独立于主应用初始化流程。
         * 它会直接尝试读取 localStorage 和 IndexedDB，用于在应用无法启动时抢救数据。
         */
        async function createEmergencyBackup() {
            const backupBtn = document.getElementById('fatal-backup-btn');
            const resetBtn = document.getElementById('fatal-reset-btn');

            if (backupBtn) {
                backupBtn.disabled = true;
                backupBtn.textContent = '正在打包...';
            }

            // 1. 检查 JSZip 库是否已加载
            if (typeof JSZip === 'undefined') {
                alert('错误：备份所需的 JSZip 库未能加载。请检查您的网络连接，刷新页面后在初始化失败时重试。');
                if (backupBtn) backupBtn.textContent = '备份失败 (缺少组件)';
                return;
            }

            // 2. 尝试从 localStorage 读取主要状态数据
            const rawState = localStorage.getItem('blokkoState');
            if (!rawState) {
                alert('未在浏览器中找到可备份的数据。');
                if (backupBtn) backupBtn.textContent = '无数据可备份';
                return;
            }

            try {
                const zip = new JSZip();
                let stateClone = JSON.parse(rawState);
                let db;

                // 3. 尝试独立连接到 IndexedDB
                try {
                    db = await new Promise((resolve, reject) => {
                        const request = indexedDB.open('BlokkoDB', 2);
                        request.onsuccess = e => resolve(e.target.result);
                        request.onerror = e => reject(e.target.error);
                    });
                } catch (dbError) {
                    console.error("紧急备份时无法连接到IndexedDB:", dbError);
                    alert("警告：无法访问数据库，备份将只包含文本和配置，不包含图片。");
                }

                // 4. 如果数据库连接成功，则遍历状态树，将图片数据打包进 zip
                if (db) {
                    const imageMap = new Map();

                    const getImageFromEmergencyDB = (id) => {
                        return new Promise((resolve, reject) => {
                            const transaction = db.transaction(['images'], 'readonly');
                            const store = transaction.objectStore('images');
                            const request = store.get(id);
                            request.onsuccess = () => resolve(request.result);
                            request.onerror = reject;
                        });
                    };

                    // 递归处理状态对象，查找并替换图片路径
                    const processObject = async (obj) => {
                        for (const key in obj) {
                            if (typeof obj[key] === 'string' && obj[key].startsWith('idb://')) {
                                const imageId = obj[key].substring(6);
                                if (!imageMap.has(imageId)) {
                                    try {
                                        const record = await getImageFromEmergencyDB(imageId);
                                        if (record && record.blob) {
                                            const fileExtension = record.blob.type.split('/')[1] || 'png';
                                            const filename = `img-${imageId}.${fileExtension}`;
                                            const path = `images/${filename}`;
                                            zip.file(path, record.blob);
                                            imageMap.set(imageId, { path });
                                            obj[key] = path;
                                        }
                                    } catch (e) {
                                        console.warn(`无法从DB备份图片ID ${imageId}:`, e);
                                    }
                                } else if (imageMap.has(imageId)) {
                                    obj[key] = imageMap.get(imageId).path;
                                }
                            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                await processObject(obj[key]);
                            }
                        }
                    };

                    await processObject(stateClone);
                }

                zip.file("config.json", JSON.stringify(stateClone, null, 2));
                zip.file("readme-EMERGENCY-BACKUP.txt", `Blokko 紧急备份\n\n此 .zip 文件是在应用初始化失败时生成的紧急备份。\n它包含了您的配置文件 (config.json) 和尽可能多地从数据库中抢救出的图片资源。\n\n导出时间: ${new Date().toLocaleString()}`);

                const blob = await zip.generateAsync({ type: "blob" });

                // 创建并触发下载链接
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                const date = new Date();
                const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
                downloadLink.download = `Blokko-Emergency-Backup-${dateString}.zip`;

                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadLink.href);

                if (backupBtn) backupBtn.textContent = '备份已下载！';
                if (resetBtn) resetBtn.textContent = '现在可以安全重置';

            } catch (error) {
                console.error("创建紧急备份失败:", error);
                alert(`创建备份时发生严重错误: ${error.message}\n\n我们将尝试为您下载纯文本配置。`);
                // 降级方案：只下载 JSON 文件
                try {
                    const blob = new Blob([rawState], { type: 'application/json' });
                    const downloadLink = document.createElement('a');
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `Blokko-Emergency-Config-Backup.json`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(downloadLink.href);
                    if (backupBtn) backupBtn.textContent = 'JSON备份已下载';
                } catch (e) {
                    if (backupBtn) backupBtn.textContent = '备份彻底失败';
                }
            }
        }

        // Hero Patterns SVG 背景纹理数据. 来源: https://heropatterns.com/
        const HeroPatterns = [
            { name: 'Jigsaw', svg: (c, o) => `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><path d="M41.512 41.512c.976.976 2.256.488 2.256-1.024v-6.728c0-1.512.732-2.256 2.256-2.256h6.728c1.512 0 2.016-.244 1.024-2.256-3.904-7.808-7.808-11.712-11.712-11.712-3.904 0-7.808 3.904-11.712 11.712-.992 2.012-.504 2.256 1.024 2.256h6.728c1.512 0 2.256.732 2.256 2.256v6.728c0 1.512.244 2.016 2.256 1.024zM59 60c.504 0 1-.488 1-1V38.864c0-1.512.732-2.256 2.256-2.256h10.128c1.008 0 1.512.22 1.512 1.248 0 4.88-3.904 9.76-11.712 9.76-7.808 0-11.712-4.88-11.712-9.76 0-1.028.504-1.248 1.512-1.248h10.128c1.512 0 2.256.732 2.256 2.256V59c0 .512.488 1 1 1h16.336c.512 0 1-.488 1-1V38.864c0-1.512.732-2.256 2.256-2.256h10.128c1.008 0 1.512.22 1.512 1.248 0 4.88-3.904 9.76-11.712 9.76-7.808 0-11.712-4.88-11.712-9.76 0-1.028.504-1.248 1.512-1.248h10.128c1.512 0 2.256.732 2.256 2.256V59c0 .512.488 1 1 1H59z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Overlapping Circles', svg: (c, o) => `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><circle cx="5" cy="5" r="5"/><circle cx="15" cy="5" r="5"/><circle cx="5" cy="15" r="5"/><circle cx="15" cy="15" r="5"/></g></svg>` },
            { name: 'Plus', svg: (c, o) => `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h2v2H2V2zm4 0h2v2H6V2zm4 0h2v2h-2V2zm4 0h2v2h-2V2zM2 6h2v2H2V6zm4 0h2v2H6V6zm4 0h2v2h-2V6zm4 0h2v2h-2V6zM2 10h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM2 14h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'X-Equals', svg: (c, o) => `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 2.5a.5.5 0 01.5-.5h14a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-14a.5.5 0 01-.5-.5v-1zM17 6H3a1 1 0 000 2h14a1 1 0 000-2zM3 12h14a1 1 0 000-2H3a1 1 0 100 2zm15 3.5a.5.5 0 01-.5.5h-14a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h14a.5.5 0 01.5.5v1z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Brick Wall', svg: (c, o) => `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h20v20H0V0zm10 12h10v2H10v-2zM0 2h10v2H0V2zm0 8h10v2H0v-2zm10 0h10v2H10v-2zM0 6h10v2H0V6zm10-4h10v2H10V2zM0 14h10v2H0v-2zm10 4h10v2H10v-2z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Floating Cogs', svg: (c, o) => `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><path d="M9 13.09V5.5c0-.828.672-1.5 1.5-1.5h5c.828 0 1.5.672 1.5 1.5v7.59a4.5 4.5 0 10-8 0zM5.5 13a3.5 3.5 0 000 7h15a3.5 3.5 0 000-7H5.5z"/><path d="M9 13.09V5.5c0-.828.672-1.5 1.5-1.5h5c.828 0 1.5.672 1.5 1.5v7.59a4.5 4.5 0 10-8 0zM5.5 13a3.5 3.5 0 000 7h15a3.5 3.5 0 000-7H5.5z" transform="rotate(180 13 13)"/></g></svg>` },
            { name: 'Polka Dots', svg: (c, o) => `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><circle cx="3" cy="3" r="3"/><circle cx="13" cy="13" r="3"/></g></svg>` },
            { name: 'Faceted', svg: (c, o) => `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><path d="M0 40L40 0H20L0 20z" /><path d="M40 40V20L20 40z" /></g></svg>` },
            { name: 'Topography', svg: (c, o) => `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm5 8c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm10 0c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm13-8c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-5 8c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-10 0c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-5-18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Lines In Motion', svg: (c, o) => `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><path d="M20 20v40h40V20H20zm20 38c-9.94 0-18-8.06-18-18s8.06-18 18-18 18 8.06 18 18-8.06 18-18 18z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Cicada Stripe', svg: (c, o) => `<svg width="6" height="6" viewBox="0 0 6 6" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><path d="M5 0h1L0 6V5zM6 5v1H5z"/></g></svg>` },
            { name: 'Diamonds', svg: (c, o) => `<svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 5h5L0 0v5zm10 0h-5l5-5v5zM0 5h5l5 5H5L0 5zm10 0h-5l-5 5h5l5-5z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Texture', svg: (c, o) => `<svg width="52" height="26" viewBox="0 0 52 26" xmlns="http://www.w3.org/2000/svg"><g fill="${c}" fill-opacity="${o}" fill-rule="evenodd"><path d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z" /><path d="M41.464 15.05l8.486-8.486-1.414-1.414-8.486 8.486 1.414 1.414z" /></g></svg>` },
            { name: 'Cross', svg: (c, o) => `<svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><path d="M4 0h1v3h3v1H5v3H4V4H1V3h3z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Rain', svg: (c, o) => `<svg width="4" height="4" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg"><path d="M1 3h1v1H1V3zm2-2h1v1H3V1z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Diagonal Lines', svg: (c, o) => `<svg width="4" height="4" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg"><path d="M-1 3h1v1H-1V3zm2-2h1v1H1V1zm2-2h1v1H3V-1z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
            { name: 'Chevrons', svg: (c, o) => `<svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0l5 5-5 5h5l5-5-5-5H0z" fill="${c}" fill-opacity="${o}" fill-rule="evenodd"/></svg>` },
        ];

        document.addEventListener('DOMContentLoaded', () => {
            /**
             * @description Blokko 主应用对象，封装了所有状态管理和UI逻辑。
             * @type {object}
             */
            const App = {
                // NEW: Pixabay API Key
                pixabayApiKey: '23863777-a87f73315a013444469228d4e',
                // 数据库实例
                db: null,
                // 标记浏览器存储空间是否已满
                isStorageFull: false,
                // 应用的核心状态对象，包含所有用户数据和设置
                state: {},
                // 当前选中的编辑目标 (例如: 全局, 某个区块, 某个卡片)
                selection: { type: 'global', cardId: null },
                // 操作历史记录，用于实现撤销/重做
                history: [],
                // 当前历史记录的指针
                historyIndex: -1,
                // 标记是否正在从历史记录中恢复状态，防止触发不必要的回调
                isRestoringState: false,
                // 标记是否正在进行内联文本编辑，防止冲突
                isEditingText: false,
                // Cropper.js 实例
                cropper: null,
                // 当前裁剪操作的目标信息
                currentCropTarget: null,
                // 当前裁剪会话中的滤镜状态
                currentFilterState: {},
                // 当前图标选择器的目标信息
                currentIconTarget: null,
                // Quill.js 富文本编辑器实例
                richTextEditor: null,
                // 当前富文本编辑器的目标信息
                currentRichTextTarget: null,
                // SortableJS 实例
                sortableLayers: null,
                sortablePreview: null,
                sortableTags: null,
                sortablePreviewTags: null,
                cardLayerSortables: {},
                cardSortables: {},
                imageCardSortables: {},
                buttonCardSortables: {}, // NEW: For button cards
                // Masonry 瀑布流布局实例
                masonryInstances: {},
                // 防抖处理后的本地保存函数
                debouncedSaveToLocal: null,
                // 从用户本地系统加载的字体列表
                localFonts: [],
                // 用户上传的字体元信息列表
                uploadedFonts: [],
                // 内置的预设主题
                presets: {},
                // 自定义上传的图标列表
                icons: [],
                // 标记纹理选择器是否已初始化
                texturePickerInitialized: false,
                // 标记图标选择器是否已初始化
                iconPickerInitialized: false,
                // ColorThief 实例
                colorThief: null,
                // 移动端长按计时器
                longPressTimer: null,
                // 上一次从图片提取的调色板
                lastPalette: [],
                // 彩蛋点击计数器
                easterEggCounter: 0,
                // 彩蛋计时器
                easterEggTimer: null,
                // 提示框 (Tooltip) 的显示计时器
                tooltipTimeout: null,

                /**
                 * @description 应用初始化入口函数。
                 */
                init() {
                    // MODIFIED: Version Log
                    console.log("Blokko 初始化 v1.7.0 ...");

                    this.elements = this.queryElements();
                    this.presets = this.getPresets();
                    this.state = this.getDefaultState();
                    this.debouncedSaveToLocal = this.debounce(this.saveToLocal, 500);

                    this.initDB().then(async () => {
                        this.bindCoreEvents();
                        // OPTIMIZATION: Defer non-critical initializations
                        // this.bindEditorEvents(); // deferred
                        this.bindPreviewEvents();
                        // this.initResizer(); // deferred

                        this.loadPreferences();
                        await this.loadFromLocal();

                        this.history = [{ state: this.deepClone(this.state), description: '初始状态' }];
                        this.historyIndex = 0;

                        this.renderAll(true);
                        this.syncAllControls();
                        this.populateFontList();
                        // this.initAllSortables(); // deferred

                        this.setSelection({ type: 'global' });
                        this.updateUndoRedoButtons();
                        this.updatePreviewAspectRatio(); // NEW: Initial aspect ratio update

                        // OPTIMIZATION: Defer non-critical initializations to improve TTI
                        setTimeout(() => {
                            this.bindEditorEvents();
                            this.initResizer();
                            this.initAllSortables();
                        }, 0);


                        // MODIFIED: Version Bump
                        const currentVersion = '1.7.0';
                        const lastVisitedVersion = localStorage.getItem('blokkoLastVersion');
                        const hasSeenTutorial = localStorage.getItem('blokkoHasSeenTutorial');

                        if (!hasSeenTutorial) {
                            setTimeout(() => {
                                this.elements.helpModal.classList.add('visible');
                                const helpContainer = this.elements.helpModal.querySelector('.modal-container');
                                helpContainer.querySelector('.tab-btn[data-tab="help-tutorial"]').click();
                                localStorage.setItem('blokkoHasSeenTutorial', 'true');
                                localStorage.setItem('blokkoLastVersion', currentVersion);
                            }, 1000);
                        } else if (currentVersion !== lastVisitedVersion) {
                            setTimeout(() => {
                                this.showToast(`已更新到 v${currentVersion}！点击“帮助”查看更新日志。`, 'success');
                                this.elements.helpModal.classList.add('visible');
                                this.elements.helpModal.querySelector('.tab-btn[data-tab="help-changelog"]').click();
                            }, 1500);
                            localStorage.setItem('blokkoLastVersion', currentVersion);
                        }

                    }).catch(err => {
                        console.error("数据库初始化失败:", err);
                        this.showFatalErrorModal('初始化失败', '无法初始化本地数据库，这可能是由于浏览器缓存损坏。您可以尝试重置应用来解决此问题。', err);
                    });
                },

                /**
                 * @description 获取应用的默认初始状态。
                 */
                getDefaultState() {
                    const lightTheme = this.getPresets().light;
                    return {
                        customIcons: [],
                        personalInfo: {
                            isVisible: true,
                            layout: 'default',
                            nickname: "你的昵称", nicknameColor: lightTheme.pNicknameColor,
                            subtitle: "这是副标题，双击可编辑", subtitleColor: lightTheme.pSubtitleColor,
                            bio: "这是简介，双击可编辑", bioColor: lightTheme.pBioColor,
                            avatarDataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E",
                            avatarShape: '50%', avatarBorderSize: 4, avatarBorderColor: '#ffffff',
                            avatarSize: 100,
                            avatarOffsetX: 0,
                            // NEW: Floating Avatar Offset
                            avatarOffsetY: 0,
                            tags: [
                                { id: this.generateId('t'), icon: 'mdi:palette', text: '设计师' },
                                { id: this.generateId('t'), icon: 'mdi:github', text: '可以放社交账号' }
                            ],
                            tagBgColor: lightTheme.pTagBgColor, tagTextColor: lightTheme.pTagTextColor
                        },
                        pageStyles: {
                            pageBgMode: 'solid',
                            pageBgSolidColor: lightTheme.pageBgSolidColor, pageBgImageDataUrl: null,
                            // NEW: Attribution for online images
                            pageBgImageAttribution: null,
                            pageBgGradientStart: lightTheme.pageBgGradientStart, pageBgGradientEnd: lightTheme.pageBgGradientEnd,
                            pageBgGradientAngle: 135,
                            pageOverlayColor: "#000000", pageOverlayOpacity: 0.3,
                            pageBgPattern: '', pageBgPatternColor: '#000000', pageBgPatternOpacity: 0.1, pageBgPatternDensity: 30,
                            headerBgMode: 'solid',
                            headerBorderRadius: 16,
                            headerBgColor: lightTheme.headerBgColor, headerTextColor: lightTheme.headerTextColor, headerOpacity: 1.0,
                            headerBgGradientStart: lightTheme.headerBgGradientStart, headerBgGradientEnd: lightTheme.headerBgGradientEnd,
                            headerBgGradientAngle: 135,
                        },
                        blocks: [
                            {
                                id: this.generateId('b'), type: 'text', title: "单排卡片区块", isVisible: true, isExpanded: false, settings: { layout: 'single', masonryEnabled: false }, cards: [
                                    { id: this.generateId('c'), icon: '', title: "这是单排卡片", content: "双击这里或手机端点击铅笔进行编辑，现在支持<b>富文本</b>了哦！", opacity: 1.0, followGlobalOpacity: true, textShadowEnabled: false, titleColor: null, titleFontSize: null, contentFontSize: null }
                                ]
                            },
                            // NEW: Default Button Block
                            {
                                id: this.generateId('b'), type: 'button', title: "按钮区块", isVisible: true, isExpanded: false, settings: { gap: 15 }, cards: [
                                    { id: this.generateId('c'), icon: 'mdi:github', text: "访问我的主页" }
                                ]
                            },
                            { id: this.generateId('b'), type: 'separator', title: "分割线", isVisible: true, isExpanded: false, settings: { style: 'solid', color: '#dddddd', thickness: 1, margin: 20, text: '', icon: null, textColor: '#555555' } },
                            { id: this.generateId('b'), type: 'image', title: "图片区块", isVisible: true, isExpanded: false, settings: { layout: 'dual', masonryEnabled: false, textColor: '' }, cards: [] },
                            { id: this.generateId('b'), type: 'spacer', title: "留白块", isVisible: true, isExpanded: false, settings: { height: 20 } },
                        ],
                        globalCardStyles: {
                            bgMode: 'solid',
                            bgColor: lightTheme.gCardBgColor, textColor: lightTheme.gCardTextColor, opacity: 1.0,
                            bgGradientStart: lightTheme.gCardBgGradientStart, bgGradientEnd: lightTheme.gCardBgGradientEnd,
                            bgGradientAngle: 135,
                            radius: 12, textAlign: "left", lineHeight: "1.5",
                            fontFamily: "",
                            titleColor: null,
                            titleFontSize: "1.1em",
                            contentFontSize: "0.95em",
                            textStrokeWidth: 0, textStrokeColor: "#000000",
                            borderWidth: 0, borderStyle: 'none', borderColor: '#cccccc',
                        },
                        // NEW: Global Button Styles
                        globalButtonStyles: {
                            bgColor: '#007AFF',
                            textColor: '#FFFFFF',
                            radius: 8,
                            textAlign: 'center'
                        },
                        // NEW: Export Settings State
                        exportSettings: {
                            lockAspectRatio: true,
                            customWidth: 1200,
                            customHeight: 750
                        }
                    };
                },

                /**
                 * @description 获取内置的预设主题颜色配置。
                 * @returns {object} - 包含多个主题的对象。
                 */
                getPresets() {
                    return {
                        light: {
                            pageBgSolidColor: "#f0f2f5", pageBgGradientStart: "#f0f2f5", pageBgGradientEnd: "#e6e9ed",
                            headerBgColor: "#ffffff", headerBgGradientStart: "#ffffff", headerBgGradientEnd: "#f7f7f7",
                            headerTextColor: "#1a1a1a",
                            gCardBgColor: "#ffffff", gCardTextColor: "#1a1a1a", gCardOpacity: 1.0,
                            gCardBgGradientStart: "#ffffff", gCardBgGradientEnd: "#f5f5f5",
                            pNicknameColor: "#1a1a1a", pSubtitleColor: "#555555", pBioColor: "#555555",
                            pTagBgColor: "#eef1f5", pTagTextColor: "#3c3c43",
                        },
                        dark: {
                            pageBgSolidColor: "#121417", pageBgGradientStart: "#121417", pageBgGradientEnd: "#1a1d21",
                            headerBgColor: "#1f2229", headerBgGradientStart: "#1f2229", headerBgGradientEnd: "#252930",
                            headerTextColor: "#f0f2f5",
                            gCardBgColor: "#2c303a", gCardTextColor: "#f0f2f5", gCardOpacity: 0.95,
                            gCardBgGradientStart: "#2c303a", gCardBgGradientEnd: "#343946",
                            pNicknameColor: "#f0f2f5", pSubtitleColor: "#a0aec0", pBioColor: "#a0aec0",
                            pTagBgColor: "#3e4451", pTagTextColor: "#e2e8f0",
                        },
                        mint: {
                            pageBgSolidColor: "#ccfbf1", pageBgGradientStart: "#ccfbf1", pageBgGradientEnd: "#a7f3d0",
                            headerBgColor: "#f0fdfa", headerBgGradientStart: "#f0fdfa", headerBgGradientEnd: "#e6fcf5",
                            headerTextColor: "#0f766e",
                            gCardBgColor: "#ffffff", gCardTextColor: "#134e4a", gCardOpacity: 1.0,
                            gCardBgGradientStart: "#ffffff", gCardBgGradientEnd: "#fafffd",
                            pNicknameColor: "#064e3b", pSubtitleColor: "#115e59", pBioColor: "#134e4a",
                            pTagBgColor: "#a7f3d0", pTagTextColor: "#065f46",
                        },
                        coffee: {
                            pageBgSolidColor: "#f3e8e2", pageBgGradientStart: "#f3e8e2", pageBgGradientEnd: "#e9d8cf",
                            headerBgColor: "#fdf8f6", headerBgGradientStart: "#fdf8f6", headerBgGradientEnd: "#faf3ef",
                            headerTextColor: "#432818",
                            gCardBgColor: "#ffffff", gCardTextColor: "#5e4534", gCardOpacity: 1.0,
                            gCardBgGradientStart: "#ffffff", gCardBgGradientEnd: "#fffbf8",
                            pNicknameColor: "#432818", pSubtitleColor: "#6f4e37", pBioColor: "#5e4534",
                            pTagBgColor: "#e3d5ca", pTagTextColor: "#432818",
                        }
                    };
                },

                /**
                 * @description 查询并缓存所有需要操作的DOM元素。
                 * @returns {object} - 包含所有DOM元素引用的对象。
                 */
                queryElements() {
                    const q = (selector) => document.querySelector(selector);
                    return {
                        appContainer: q('.app-container'),
                        layerPanel: q('#layer-panel'),
                        inspectorPanel: q('#inspector-panel'),
                        layerList: q('#layer-list'),
                        previewPanel: q('#preview-panel'),
                        resizer: q('#resizer'),
                        themeToggleBtn: q('#theme-toggle-btn'),
                        previewWrapper: q('#preview-wrapper'), previewOverlay: q('#preview-overlay'),
                        previewBlocksContainer: q('#preview-blocks-container'),
                        previewHeader: q('#preview-header'),
                        addTextBlockBtn: q('#add-text-block-btn'), addImageBlockBtn: q('#add-image-block-btn'),
                        addSeparatorBlockBtn: q('#add-separator-block-btn'), addSpacerBlockBtn: q('#add-spacer-block-btn'),
                        // NEW: Button block button
                        addButtonBlockBtn: q('#add-button-block-btn'),
                        cropperModal: q('#cropper-modal'), cropperImage: q('#cropper-image'),
                        cropperCancelBtn: q('#cropper-cancel-btn'), cropperSaveBtn: q('#cropper-save-btn'),
                        downloadModal: q('#download-modal'), downloadModalTitle: q('#download-modal-title'),
                        downloadModalContent: q('#download-modal-content'), downloadModalCloseBtn: q('#download-modal-close-btn'),
                        loadingOverlay: q('#loading-overlay'), loadingText: q('#loading-text'),
                        toastContainer: q('#toast-container'),
                        mobileLayerToggle: q('#mobile-layer-toggle'),
                        mobileInspectorToggle: q('#mobile-inspector-toggle'),
                        body: document.body,
                        showHelpBtn: q('#show-help-btn'),
                        helpModal: q('#help-modal'),
                        helpModalCloseBtn: q('#help-modal-close-btn'),
                        iconPickerModal: q('#icon-picker-modal'),
                        iconGrid: q('#icon-grid'),
                        iconSearch: q('#icon-search'),
                        removeIconBtn: q('#remove-icon-btn'),
                        iconPickerCloseBtn: q('#icon-picker-close-btn'),
                        uploadIconBtn: q('#upload-icon-btn'), iconUploadInput: q('#icon-upload-input'),
                        lockModeToggle: q('#lock-mode-toggle'),
                        texturePickerModal: q('#texture-picker-modal'),
                        textureGrid: q('#texture-grid'),
                        removeTextureBtn: q('#remove-texture-btn'),
                        texturePickerCloseBtn: q('#texture-picker-close-btn'),
                        confirmModal: q('#confirm-modal'),
                        colorContextMenu: q('#color-context-menu'),
                        fontManagerModal: q('#font-manager-modal'),
                        storageWarningBanner: q('#storage-warning-banner'),
                        richTextEditorModal: q('#rich-text-editor-modal'),
                        richTextEditorContainer: q('#rich-text-editor-container'),
                        richTextSaveBtn: q('#rich-text-save-btn'),
                        richTextCancelBtn: q('#rich-text-cancel-btn'),
                        showExportModalBtn: q('#show-export-modal-btn'),
                        exportModal: q('#export-modal'),
                        // NEW: Image Source and Pixabay Modals
                        imageSourceModal: q('#image-source-modal'),
                        pixabaySearchModal: q('#pixabay-search-modal'),
                    };
                },

                /**
                 * @description 绑定应用的核心事件监听器 (例如: 主题切换, 添加区块等)。
                 */
                bindCoreEvents() {
                    this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
                    this.elements.addTextBlockBtn.addEventListener('click', () => this.addBlock('text'));
                    this.elements.addImageBlockBtn.addEventListener('click', () => this.addBlock('image'));
                    // NEW: Button block event
                    this.elements.addButtonBlockBtn.addEventListener('click', () => this.addBlock('button'));
                    this.elements.addSeparatorBlockBtn.addEventListener('click', () => this.addBlock('separator'));
                    this.elements.addSpacerBlockBtn.addEventListener('click', () => this.addBlock('spacer'));
                    this.elements.downloadModalCloseBtn.addEventListener('click', () => this.hideDownloadModal());
                    this.elements.cropperCancelBtn.addEventListener('click', () => this.hideCropper());
                    this.elements.cropperSaveBtn.addEventListener('click', () => this.saveCrop());
                    this.elements.cropperModal.querySelector('.crop-ratios').addEventListener('change', () => this.updateCropAspectRatio());

                    // NEW: Image Source Modal Events
                    this.elements.imageSourceModal.addEventListener('click', e => {
                        const target = e.target.closest('button');
                        if (!target) return;
                        if (target.id === 'upload-from-device-btn') {
                            const pageBgUploadInput = this.elements.inspectorPanel.querySelector('#page-bg-upload-physical');
                            if (pageBgUploadInput) pageBgUploadInput.click();
                        } else if (target.id === 'search-online-btn') {
                            this.showPixabaySearch();
                        }
                        this.elements.imageSourceModal.classList.remove('visible');
                    });

                    // NEW: Pixabay Search Modal Events
                    this.elements.pixabaySearchModal.addEventListener('keydown', e => {
                        if (e.key === 'Enter') {
                            const input = this.elements.pixabaySearchModal.querySelector('#pixabay-search-input');
                            this.searchPixabayImages(input.value);
                        }
                    });
                    this.elements.pixabaySearchModal.querySelector('#pixabay-grid').addEventListener('click', e => {
                        const item = e.target.closest('.pixabay-grid-item');
                        if (item) {
                            this.handlePixabayImageSelection(JSON.parse(item.dataset.imageData));
                            this.elements.pixabaySearchModal.classList.remove('visible');
                        }
                    });

                    this.elements.imageSourceModal.querySelector('#image-source-cancel-btn').addEventListener('click', () => {
                        this.elements.imageSourceModal.classList.remove('visible');
                    });

                    this.elements.pixabaySearchModal.querySelector('#pixabay-search-btn').addEventListener('click', () => {
                        const input = this.elements.pixabaySearchModal.querySelector('#pixabay-search-input');
                        this.searchPixabayImages(input.value);
                    });

                    this.elements.pixabaySearchModal.querySelector('#pixabay-search-close-btn').addEventListener('click', () => {
                        this.elements.pixabaySearchModal.classList.remove('visible');
                    });


                    this.elements.mobileLayerToggle.addEventListener('click', () => this.togglePanelDrawer('layer-panel'));
                    this.elements.mobileInspectorToggle.addEventListener('click', () => this.togglePanelDrawer('inspector-panel'));

                    // 优化: 移动端点击遮罩层关闭面板的逻辑，仅当直接点击背景时触发
                    this.elements.appContainer.addEventListener('click', (e) => {
                        if (e.target === this.elements.appContainer && this.elements.body.classList.contains('panels-open')) {
                            this.togglePanelDrawer(false);
                        }
                    });

                    this.elements.showHelpBtn.addEventListener('click', () => this.elements.helpModal.classList.add('visible'));
                    this.elements.helpModalCloseBtn.addEventListener('click', () => this.elements.helpModal.classList.remove('visible'));

                    this.elements.storageWarningBanner.querySelector('#storage-warning-manage-link').addEventListener('click', () => {
                        // Placeholder for future resource manager
                        this.showToast('资源管理器功能正在开发中...', 'info');
                    });

                    // 帮助弹窗内的 Tab 切换逻辑
                    let aboutClickCount = 0;
                    let aboutClickTimer = null;
                    this.elements.helpModal.querySelector('.tabs').addEventListener('click', (e) => {
                        const tabBtn = e.target.closest('.tab-btn');
                        if (tabBtn) {
                            const parent = tabBtn.closest('.modal-container');
                            parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                            tabBtn.classList.add('active');
                            parent.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                            const targetTab = parent.querySelector(`#${tabBtn.dataset.tab}`);
                            if (targetTab) targetTab.classList.add('active');

                            this.elements.helpModalCloseBtn.textContent = (tabBtn.dataset.tab === 'help-tutorial') ? "我已了解，开始使用" : "关闭";

                            // 连续点击"关于"标签5次以上，激活调试模式
                            if (tabBtn.dataset.tab === 'help-about') {
                                clearTimeout(aboutClickTimer);
                                aboutClickCount++;
                                aboutClickTimer = setTimeout(() => aboutClickCount = 0, 2000);
                                if (aboutClickCount >= 5) {
                                    aboutClickCount = 0;
                                    clearTimeout(aboutClickTimer);
                                    this.activateDebugMode();
                                }
                            }
                        }
                    });

                    // 图标选择器相关事件
                    this.elements.iconPickerCloseBtn.addEventListener('click', () => this.hideIconPicker());
                    this.elements.removeIconBtn.addEventListener('click', () => this.selectIcon(null));
                    this.elements.iconSearch.addEventListener('input', this.debounce((e) => this.renderIconGrid(e.target.value), 300));
                    this.elements.iconGrid.addEventListener('click', (e) => {
                        const item = e.target.closest('.icon-grid-item');
                        if (item) {
                            if (e.target.closest('.delete-custom-icon-btn')) {
                                this.deleteCustomIcon(item.dataset.iconName);
                            } else {
                                this.selectIcon(item.dataset.icon);
                            }
                        }
                    });

                    this.elements.uploadIconBtn.addEventListener('click', () => this.elements.iconUploadInput.click());
                    this.elements.iconUploadInput.addEventListener('change', e => this.handleIconUpload(e));

                    // 锁定模式切换
                    this.elements.lockModeToggle.addEventListener('click', () => this.toggleLockMode());

                    // 富文本编辑器模态框事件
                    this.elements.richTextSaveBtn.addEventListener('click', () => this.saveRichText());
                    this.elements.richTextCancelBtn.addEventListener('click', () => this.hideRichTextEditor());

                    // 导出模态框事件
                    this.elements.exportModal.addEventListener('click', async e => {
                        if (e.target.closest('#export-modal-close-btn') || e.target === this.elements.exportModal) {
                            this.elements.exportModal.classList.remove('visible');
                            return;
                        }
                        const option = e.target.closest('.export-option');
                        if (option && option.dataset.action) {
                            const action = option.dataset.action;
                            switch (action) {
                                case 'standard': this.exportConfig(false); break;
                                case 'enhanced': await this.exportEnhancedPackage(); break;
                                case 'template': this.exportConfig(true); break;
                                case 'legacy': await this.exportLegacyConfig(); break;
                            }
                            this.elements.exportModal.classList.remove('visible');
                        }
                    });

                    // 左侧图层面板的事件委托
                    this.elements.layerList.addEventListener('click', e => {
                        const layerItemContainer = e.target.closest('.layer-item-container');
                        if (!layerItemContainer) return;

                        const layerItem = layerItemContainer.querySelector('.layer-item');
                        const cardItem = e.target.closest('.card-layer-item');

                        // 处理图层上的动作按钮 (可见性, 复制, 添加卡片, 展开/折叠)
                        const actionBtn = e.target.closest('.layer-actions button, .layer-toggle');
                        if (actionBtn) {
                            const id = layerItem.dataset.id;
                            const type = layerItem.dataset.type;

                            if (type === 'personalInfo') {
                                // This action is now handled in the inspector, layer panel only has selection
                                return;
                            }

                            if (actionBtn.matches('.toggle-visibility-btn')) {
                                this.toggleBlockVisibility(id);
                            } else if (actionBtn.matches('.duplicate-block-btn')) {
                                this.duplicateBlock(id);
                            } else if (actionBtn.matches('.add-card-to-block-btn')) {
                                const block = this.findBlock(id);
                                // MODIFIED: Handle button quick add
                                if (block.type === 'text') this.addCard(id, true);
                                else if (block.type === 'image') this.addImageCard(id);
                                else if (block.type === 'button') this.addButtonCard(id, true);
                            } else if (actionBtn.matches('.layer-toggle')) {
                                this.toggleLayerExpansion(id);
                            }
                            return;
                        }

                        // 处理点击卡片子图层
                        if (cardItem) {
                            const blockId = cardItem.closest('.layer-item-container').dataset.blockId;
                            const cardId = cardItem.dataset.cardId;
                            this.setSelection({ type: 'block', id: blockId, cardId: cardId });
                            const cardEditorEl = this.elements.inspectorPanel.querySelector(`.editor-card[data-card-id="${cardId}"]`);
                            if (cardEditorEl) {
                                cardEditorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                        // 处理点击区块主图层
                        else {
                            const { type, id } = layerItem.dataset;
                            this.setSelection({ type, id });
                        }
                    });

                    // 纹理选择器事件
                    this.elements.texturePickerCloseBtn.addEventListener('click', () => this.elements.texturePickerModal.classList.remove('visible'));
                    this.elements.removeTextureBtn.addEventListener('click', () => this.selectTexture(null));
                    this.elements.textureGrid.addEventListener('click', e => {
                        const item = e.target.closest('.texture-grid-item');
                        if (item) this.selectTexture(item.dataset.textureName);
                    });

                    // 双击图层名称进行重命名
                    this.elements.layerList.addEventListener('dblclick', e => {
                        const layerNameEl = e.target.closest('.layer-name');
                        const layerItem = e.target.closest('.layer-item');
                        if (!layerNameEl || !layerItem || layerItem.dataset.type === 'personalInfo' || this.isEditingText) return;

                        this.isEditingText = true;
                        layerNameEl.contentEditable = true;
                        layerNameEl.focus();
                        document.execCommand('selectAll', false, null);

                        const handleEditEnd = () => {
                            this.isEditingText = false;
                            layerNameEl.contentEditable = false;
                            layerNameEl.removeEventListener('blur', handleEditEnd);
                            layerNameEl.removeEventListener('keydown', handleKeydown);

                            const blockId = layerItem.dataset.id;
                            this.updateBlockTitle(blockId, layerNameEl.innerText, true, `重命名区块为 "${layerNameEl.innerText}"`);
                            const inspectorTitleInput = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${blockId}"] .editor-block-title-input`);
                            if (inspectorTitleInput) inspectorTitleInput.value = layerNameEl.innerText;
                        };
                        const handleKeydown = (ev) => {
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                layerNameEl.blur();
                            } else if (ev.key === 'Escape') {
                                layerNameEl.innerText = this.findBlock(layerItem.dataset.id).title;
                                layerNameEl.blur();
                            }
                        };
                        layerNameEl.addEventListener('blur', handleEditEnd);
                        layerNameEl.addEventListener('keydown', handleKeydown);
                    });

                    // 颜色右键菜单事件
                    this.elements.colorContextMenu.addEventListener('click', e => {
                        const action = e.target.dataset.action;
                        const color = this.elements.colorContextMenu.dataset.color;
                        if (action && color) this.applyQuickColor(action, color);
                        this.hideColorContextMenu();
                    });
                    document.addEventListener('click', (e) => {
                        if (!e.target.closest('#color-context-menu')) {
                            this.hideColorContextMenu();
                        }
                    });

                    // 彩蛋: 连续点击标题
                    const titleEl = document.querySelector('.app-header-title');
                    if (titleEl) {
                        titleEl.addEventListener('click', () => {
                            clearTimeout(this.easterEggTimer);
                            this.easterEggCounter++;
                            if (this.easterEggCounter >= 10) {
                                window.open('https://www.bilibili.com/video/BV1es41137fA/', '_blank');
                                this.showToast('时之歌十周年快乐！', 'success');
                                this.easterEggCounter = 0;
                            } else {
                                this.easterEggTimer = setTimeout(() => {
                                    this.easterEggCounter = 0;
                                }, 2000);
                            }
                        });
                    }

                    // 全局快捷键: 撤销/重做
                    document.addEventListener('keydown', e => {
                        if (this.richTextEditor && this.richTextEditor.hasFocus()) {
                            return;
                        }
                        const activeEl = document.activeElement;
                        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                            return;
                        }
                        const isModifierPressed = e.ctrlKey || e.metaKey;
                        if (!isModifierPressed) return;
                        const key = e.key.toLowerCase();
                        if (key === 'z' && !e.shiftKey) {
                            e.preventDefault();
                            this.undo();
                        }
                        if (key === 'y' || (key === 'z' && e.shiftKey)) {
                            e.preventDefault();
                            this.redo();
                        }
                    });
                },

                /**
                 * @description 绑定右侧检查器面板内的所有事件。
                 */
                bindEditorEvents() {
                    const panel = this.elements.inspectorPanel;

                    // 使用事件委托处理所有输入控件的 `input` 事件
                    panel.addEventListener('input', e => {
                        if (this.isRestoringState) return;
                        const target = e.target;

                        // 处理标签管理器中的文本输入
                        if (target.matches('.tag-manager-item .tag-text-input')) {
                            const tagItem = target.closest('.tag-manager-item');
                            if (tagItem) this.updateTag(tagItem.dataset.tagId, 'text', target.value, false);
                        }

                        // 处理字体搜索
                        if (target.matches('#font-search-input')) {
                            this.populateFontList(target.value);
                            return;
                        }

                        // 找到触发事件的控件的最近的数据源祖先元素
                        const updateSource = target.closest('[data-state-key], [data-setting-key], [data-card-key], [data-color-sync-key], [data-block-id-for-title]');
                        if (!updateSource) return;

                        // 获取控件的值
                        let value = target.type === 'checkbox' ? target.checked : (target.type === 'number' || target.type === 'range') ? parseFloat(target.value) : target.value;

                        // 同步颜色选择器和十六进制文本框
                        if (target.matches('.color-hex-input')) {
                            let hexValue = target.value.replace(/[^#0-9a-fA-F]/g, '');
                            const colorInput = target.previousElementSibling;

                            if (colorInput) {
                                let validHexForPicker = hexValue.startsWith('#') ? hexValue : '#' + hexValue;
                                if (/^#[0-9a-fA-F]{3}$/.test(validHexForPicker)) {
                                    validHexForPicker = '#' + validHexForPicker[1] + validHexForPicker[1] + validHexForPicker[2] + validHexForPicker[2] + validHexForPicker[3] + validHexForPicker[3];
                                    colorInput.value = validHexForPicker;
                                }
                                else if (/^#[0-9a-fA-F]{6}$/.test(validHexForPicker)) {
                                    colorInput.value = validHexForPicker;
                                }
                            }
                        }
                        else if (target.type === 'color') {
                            const hexInput = target.nextElementSibling;
                            if (hexInput && hexInput.matches('.color-hex-input')) hexInput.value = value;
                        }

                        const colorInput = target.closest('.input-group')?.querySelector('input[type="color"]');
                        const keySource = colorInput || target;

                        const stateKey = keySource.dataset.stateKey;
                        const blockEl = keySource.closest('.editor-block');
                        const settingKey = keySource.dataset.settingKey;
                        const cardKey = keySource.dataset.cardKey;
                        const blockIdForTitle = updateSource.dataset.blockIdForTitle;

                        // 根据数据源更新相应的状态
                        if (stateKey) {
                            this.updateState(stateKey, value, false);
                        } else if (blockIdForTitle) {
                            this.updateBlockTitle(blockIdForTitle, value, false);
                        } else if (blockEl && settingKey) {
                            this.updateBlockSettings(blockEl.dataset.blockId, settingKey, value, false);
                        } else if (blockEl && cardKey) {
                            const cardEl = keySource.closest('.editor-card');
                            if (cardEl) this.updateCard(blockEl.dataset.blockId, cardEl.dataset.cardId, cardKey, value, false);
                        }

                        // 更新 range 输入条旁边的数值显示
                        if (target.type === 'range') {
                            const valueDisplay = target.closest('.form-group').querySelector('.angle-value, .spacer-height-value, #gCardRadiusValue, .avatar-size-value, .avatar-offsetY-value, .header-radius-value, .shadow-blur-value, .shadow-offset-value');
                            if (valueDisplay) valueDisplay.textContent = value;
                        }
                    });

                    // BUG FIX: 校验并格式化十六进制颜色输入框
                    panel.addEventListener('blur', e => {
                        const target = e.target;
                        if (target.matches('.color-hex-input')) {
                            let value = target.value.replace(/#/g, '');
                            if (/^[0-9a-fA-F]{3}$/.test(value)) {
                                value = value.split('').map(char => char + char).join('');
                            }
                            if (/^[0-9a-fA-F]{6}$/.test(value)) {
                                target.value = '#' + value;
                            } else {
                                // If invalid, reset to the current state value
                                const stateKey = target.dataset.stateKey;
                                if (stateKey) {
                                    const currentStateValue = stateKey.split('.').reduce((o, k) => o && o[k], this.state);
                                    target.value = currentStateValue || '#000000';
                                }
                            }
                            // Trigger input and change to ensure state is updated if corrected
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            target.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, true);

                    // 使用事件委托处理所有输入控件的 `change` 事件
                    panel.addEventListener('change', e => {
                        if (this.isRestoringState) return;
                        const target = e.target;

                        // "高级设置" 开关
                        if (target.matches('.advanced-toggle')) {
                            const section = target.closest('.editor-section, .editor-card-content');
                            const isOpen = section.classList.toggle('show-advanced');
                            if (section.id) {
                                localStorage.setItem(`blokko-advanced-${section.id}`, isOpen);
                            }
                            return;
                        }

                        // 如果是状态相关的修改，则推入历史记录
                        if (target.dataset.stateKey || target.closest('.editor-block') || target.dataset.colorSyncKey || target.matches('.tag-manager-item .tag-text-input')) {
                            let description = '修改样式';
                            if (target.dataset.stateKey) description = `修改 ${target.dataset.stateKey}`;
                            if (target.closest('.editor-block')) description = `修改区块设置`;
                            this.pushHistory(description);
                        }

                        // 如果切换了卡片内的单选按钮，重新渲染检查器以更新UI
                        if (target.type === 'radio' && target.closest('.editor-card')) {
                            this.renderInspector();
                        }

                        // 处理文件上传
                        const fileInputs = {
                            '#avatar-upload': 'avatar',
                            '#page-bg-upload-physical': 'pageBg', // MODIFIED: Physical upload input
                            '#color-thief-upload': 'colorThief'
                        };
                        for (const selector in fileInputs) {
                            if (target.matches(selector)) this.handleImageUpload(e, fileInputs[selector]);
                        }
                        if (target.matches('#font-upload-input')) this.handleFontUpload(e);
                        if (target.matches('#config-file-input')) this.handleConfigFile(e);
                        if (target.matches('.card-bg-upload')) {
                            const cardEl = target.closest('.editor-card');
                            const blockEl = target.closest('.editor-block');
                            if (cardEl && blockEl) this.handleCardBgUpload(e, blockEl.dataset.blockId, cardEl.dataset.cardId);
                        }
                        if (target.matches('.image-upload-input')) {
                            const blockEl = target.closest('.editor-block');
                            if (blockEl) {
                                this.handleImageGalleryUpload(blockEl.dataset.blockId, e.target.files);
                            }
                        }

                        // NEW: Handle aspect ratio lock and custom dimensions
                        if (target.matches('#lock-aspect-ratio-toggle, #custom-width-input, #custom-height-input')) {
                            this.updatePreviewAspectRatio();
                        }

                        // 处理导出选项的联动
                        if (target.matches('#hd-export-toggle, #custom-width-toggle, #export-rounded-corners-toggle, #export-corner-radius-input, #mobile-export-toggle, #lock-aspect-ratio-toggle')) { // FIX: Add lock toggle to the match list
                            // Mobile Export Logic
                            const mobileExportToggle = panel.querySelector('#mobile-export-toggle');
                            const customWidthToggle = panel.querySelector('#custom-width-toggle');
                            const customWidthInput = panel.querySelector('#custom-width-input');
                            const customHeightInput = panel.querySelector('#custom-height-input');
                            const lockRatioToggle = panel.querySelector('#lock-aspect-ratio-toggle');
                            const hdExportToggle = panel.querySelector('#hd-export-toggle');

                            if (target.id === 'mobile-export-toggle') {
                                this.elements.body.classList.toggle('mobile-export-preview-mode', target.checked);
                                if (target.checked) {
                                    hdExportToggle.checked = false;
                                    customWidthToggle.checked = false;
                                    customWidthInput.disabled = true;
                                    customHeightInput.disabled = true;
                                    lockRatioToggle.disabled = true;
                                } else if (!customWidthToggle.checked) {
                                    lockRatioToggle.disabled = false;
                                }
                                this.updatePreviewAspectRatio();
                            } else if (target.id === 'custom-width-toggle') {
                                const customDimControls = panel.querySelector('#custom-dimensions-controls');
                                if (customDimControls) customDimControls.style.display = target.checked ? 'block' : 'none';
                                
                                // FIX: More robust logic for enabling/disabling inputs
                                customWidthInput.disabled = !target.checked;
                                lockRatioToggle.disabled = !target.checked;
                                customHeightInput.disabled = !target.checked || lockRatioToggle.checked; // Height is disabled if custom is off OR lock is on

                                if (target.checked) {
                                    hdExportToggle.checked = false;
                                    mobileExportToggle.checked = false;
                                    this.elements.body.classList.remove('mobile-export-preview-mode');
                                }
                                this.updatePreviewAspectRatio();
                            } else if (target.id === 'lock-aspect-ratio-toggle') { // NEW: Added logic for the lock toggle itself
                                // Height input is only enabled when custom dimensions is on AND lock is off
                                customHeightInput.disabled = target.checked || !customWidthToggle.checked;
                                this.updatePreviewAspectRatio();
                            } else if (target.id === 'hd-export-toggle') {
                                if (target.checked) {
                                    customWidthToggle.checked = false;
                                    customWidthInput.disabled = true;
                                    customHeightInput.disabled = true;
                                    lockRatioToggle.disabled = true;
                                    mobileExportToggle.checked = false;
                                    this.elements.body.classList.remove('mobile-export-preview-mode');
                                } else {
                                    lockRatioToggle.disabled = !customWidthToggle.checked;
                                }
                                this.updatePreviewAspectRatio();
                            }

                            if (target.id === 'export-rounded-corners-toggle') {
                                panel.querySelector('#export-corner-radius-input').disabled = !target.checked;
                            }

                            this.updateExportSizePreview();
                        }

                        // 处理布局切换时，是否显示瀑布流选项
                        if (target.matches('[name^="block-layout"]')) {
                            const blockEl = target.closest('.editor-block');
                            if (blockEl) {
                                const masonryToggle = blockEl.querySelector('.masonry-toggle-container');
                                if (masonryToggle) masonryToggle.style.display = ['dual', 'triple'].includes(target.value) ? 'block' : 'none';
                            }
                            this.renderInspector();
                        }

                        // 处理卡片不透明度是否跟随全局的切换
                        if (target.matches('[data-card-key="followGlobalOpacity"]')) {
                            const opacitySliderGroup = target.closest('.editor-card-content').querySelector('.advanced-setting.opacity-control');
                            if (opacitySliderGroup) opacitySliderGroup.style.display = target.checked ? 'none' : 'block';
                        }
                    });

                    // 使用事件委托处理所有 `click` 事件
                    panel.addEventListener('click', e => {
                        const target = e.target;

                        // 触发富文本编辑器
                        const richTextTrigger = target.closest('.rich-text-editor-trigger, .edit-content-btn');
                        if (richTextTrigger) {
                            const cardEl = richTextTrigger.closest('.editor-card');
                            const blockEl = richTextTrigger.closest('.editor-block');
                            if (cardEl && blockEl) {
                                const cardId = cardEl.dataset.cardId;
                                const previewCardContent = this.elements.previewBlocksContainer
                                    .querySelector(`.preview-card[data-card-id="${cardId}"] .preview-card-content`);
                                if (previewCardContent) this.showRichTextEditor(previewCardContent);
                            }
                            return;
                        }

                        // +/- 微调按钮
                        const stepperBtn = e.target.closest('.btn-stepper');
                        if (stepperBtn) {
                            const rangeInput = stepperBtn.parentElement.querySelector('input[type="range"]');
                            if (rangeInput) {
                                const step = parseFloat(rangeInput.step) || 1;
                                const currentValue = parseFloat(rangeInput.value);
                                let newValue = stepperBtn.classList.contains('plus') ? currentValue + step : currentValue - step;

                                const min = parseFloat(rangeInput.min);
                                const max = parseFloat(rangeInput.max);
                                if (!isNaN(min)) newValue = Math.max(min, newValue);
                                if (!isNaN(max)) newValue = Math.min(max, newValue);

                                rangeInput.value = newValue;
                                rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            return;
                        }

                        // 可折叠区域的标题
                        const legend = target.closest('.editor-section > legend');
                        if (legend) {
                            legend.parentElement.classList.toggle('collapsed');
                            return;
                        }

                        // 各种功能按钮
                        const actionButton = target.closest('button, .back-to-global-btn');
                        if (!actionButton) return;

                        const actions = {
                            '#undo-btn': () => this.undo(),
                            '#redo-btn': () => this.redo(),
                            '#import-btn': () => panel.querySelector('#config-file-input')?.click(),
                            '#show-export-modal-btn': () => this.elements.exportModal.classList.add('visible'),
                            '#export-png-btn': () => this.exportPNG(),
                            '#load-local-fonts-btn': () => this.loadLocalFonts(),
                            '#upload-font-btn': () => panel.querySelector('#font-upload-input')?.click(),
                            '#manage-fonts-btn': () => this.showFontManager(),
                            '#add-new-tag-btn': () => this.addNewTag(),
                            '#show-texture-picker-btn': () => this.initTexturePicker(),
                            '#clear-texture-btn': () => this.selectTexture(null),
                            '.back-to-global-btn': () => this.setSelection({ type: 'global' }),
                            '#reset-btn': () => this.resetToDefault(),
                            // MODIFIED: Page background upload now opens source modal
                            '#page-bg-upload-btn': () => this.elements.imageSourceModal.classList.add('visible'),
                            '#clear-page-bg-btn': () => {
                                const oldImageUrl = this.state.pageStyles.pageBgImageDataUrl;
                                this.updateState('pageStyles.pageBgImageDataUrl', null, false);
                                this.updateState('pageStyles.pageBgImageAttribution', null, true, '清除页面背景图');
                                this.deleteImageByUrl(oldImageUrl);
                                this.showToast('背景图已清除', 'info');
                            },
                            '#pick-color-btn': () => panel.querySelector('#color-thief-upload')?.click(),
                            '#reset-avatar-transform-btn': () => {
                                this.pushHistory('重置头像位置与大小');
                                this.updateState('personalInfo.avatarSize', 100, false);
                                this.updateState('personalInfo.avatarOffsetX', 0, false);
                                this.updateState('personalInfo.avatarOffsetY', 0, false);
                                this.showToast('头像位置与大小已重置', 'info');
                            },
                        };
                        for (const selector in actions) {
                            if (actionButton.matches(selector)) {
                                actions[selector]();
                                return;
                            }
                        }

                        // 应用预设主题
                        if (actionButton.dataset.preset) this.applyPreset(this.presets[actionButton.dataset.preset]);

                        // 重置颜色
                        if (actionButton.dataset.resetKey) {
                            const keyPath = actionButton.dataset.resetKey;
                            const keyMap = { nicknameColor: 'pNicknameColor', subtitleColor: 'pSubtitleColor', bioColor: 'pBioColor', tagBgColor: 'pTagBgColor', tagTextColor: 'pTagTextColor' };
                            const basePreset = this.presets.light;
                            const key = keyPath.split('.')[1];
                            const defaultValue = basePreset[keyMap[key]] || '#ffffff';
                            this.updateState(keyPath, defaultValue, true, '重置颜色');
                            this.showToast('颜色已重置', 'info');
                        }

                        // 标签管理器内的按钮
                        const tagItem = target.closest('.tag-manager-item');
                        if (tagItem) {
                            if (target.closest('.tag-icon-btn')) { this.initIconPicker(); this.showIconPicker('tag', tagItem.dataset.tagId); }
                            if (target.closest('.tag-delete-btn')) this.deleteTag(tagItem.dataset.tagId);
                        }

                        // 区块编辑器内的按钮
                        const blockEl = target.closest('.editor-block');
                        if (blockEl) {
                            const blockId = blockEl.dataset.blockId;
                            if (target.closest('.block-delete-btn')) { this.deleteBlock(blockId); }
                            else if (target.closest('.add-card-btn')) this.addCard(blockId);
                            // NEW: Add button card
                            else if (target.closest('.add-button-card-btn')) this.addButtonCard(blockId);
                            else if (target.closest('.add-image-btn')) this.addImageCard(blockId);


                            // 卡片编辑器内的按钮
                            const cardEl = target.closest('.editor-card');
                            if (cardEl) {
                                const cardId = cardEl.dataset.cardId;
                                if (target.closest('.card-delete-btn')) this.deleteCard(blockId, cardId);
                                else if (target.closest('.card-clear-bg-btn')) {
                                    const card = this.findBlock(blockId)?.cards.find(c => c.id === cardId);
                                    const oldImageUrl = card?.bgImageDataUrl;
                                    this.updateCard(blockId, cardId, 'bgImageDataUrl', null, true, '清除卡片背景图');
                                    this.deleteImageByUrl(oldImageUrl);
                                    this.showToast('卡片背景图已清除', 'info');
                                }
                                else if (target.closest('.crop-image-btn')) this.cropImage(blockId, cardId);
                                else if (target.closest('.select-icon-btn')) {
                                    this.initIconPicker();
                                    const block = this.findBlock(blockId);
                                    // MODIFIED: Handle icon picker for buttons too
                                    const pickerType = block.type === 'button' ? 'button' : 'card';
                                    this.showIconPicker(pickerType, blockId, cardId);
                                }
                                else if (target.closest('[data-reset-card-key]')) {
                                    const keyToReset = target.closest('[data-reset-card-key]').dataset.resetCardKey;
                                    this.updateCard(blockId, cardId, keyToReset, null, true, '重置卡片样式');
                                    this.showToast('已重置为全局样式', 'info');
                                }
                            } else if (target.closest('.select-icon-btn[data-separator-icon-btn]')) {
                                this.initIconPicker();
                                this.showIconPicker('separator', blockId);
                            } else if (target.closest('[data-reset-block-key]')) {
                                const keyToReset = target.closest('[data-reset-block-key]').dataset.resetBlockKey;
                                this.updateBlockSettings(blockId, keyToReset, null, true, '重置区块样式');
                                this.showToast('已重置', 'info');
                            }
                        }

                        // Tab 切换
                        const tabBtn = target.closest('.tabs .tab-btn');
                        if (tabBtn) {
                            const parent = tabBtn.closest('.tab-group-wrapper, .editor-section > .section-content, .editor-section > .inset-controls');
                            if (!parent) return;
                            parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                            tabBtn.classList.add('active');
                            parent.querySelectorAll(':scope > .tab-content').forEach(content => content.classList.remove('active'));
                            const targetTab = parent.querySelector(`#${tabBtn.dataset.tab}`);
                            if (targetTab) targetTab.classList.add('active');

                            const newMode = tabBtn.dataset.tab.includes('gradient') ? 'gradient' : 'solid';
                            if (parent.closest('#global-card-styles-section')) {
                                this.updateState('globalCardStyles.bgMode', newMode, true, '切换全局卡片背景模式');
                            } else if (parent.closest('#page-styles-section')) {
                                if (tabBtn.dataset.tab.startsWith('page-bg')) {
                                    this.updateState('pageStyles.pageBgMode', newMode, true, '切换页面背景模式');
                                } else if (tabBtn.dataset.tab.startsWith('header-bg')) {
                                    this.updateState('pageStyles.headerBgMode', newMode, true, '切换头部背景模式');
                                }
                            }
                        }
                    });

                    // 字体管理器事件
                    const fontManagerModal = this.elements.fontManagerModal;
                    fontManagerModal.querySelector('#font-manager-close-btn').addEventListener('click', () => {
                        fontManagerModal.classList.remove('visible');
                    });
                    fontManagerModal.addEventListener('click', e => {
                        const deleteBtn = e.target.closest('.font-delete-btn');
                        if (deleteBtn) {
                            const item = deleteBtn.closest('.font-manager-item');
                            if (item) {
                                this.deleteFont(item.dataset.fontFamily);
                            }
                        }
                    });

                    // 悬浮提示框 (Tooltip)
                    panel.addEventListener('mouseover', e => {
                        const trigger = e.target.closest('.tooltip-trigger');
                        if (trigger) {
                            const tooltipText = trigger.dataset.tooltip;
                            if (!tooltipText) return;

                            this.tooltipTimeout = setTimeout(() => {
                                let tooltip = document.getElementById('floating-tooltip');
                                if (!tooltip) {
                                    tooltip = document.createElement('div');
                                    tooltip.id = 'floating-tooltip';
                                    document.body.appendChild(tooltip);
                                }
                                tooltip.textContent = tooltipText;

                                const triggerRect = trigger.getBoundingClientRect();
                                tooltip.style.left = `${triggerRect.left + triggerRect.width / 2}px`;
                                tooltip.style.top = `${triggerRect.top - 8}px`;
                                tooltip.style.opacity = '1';
                            }, 300);
                        }
                    });

                    panel.addEventListener('mouseout', e => {
                        const trigger = e.target.closest('.tooltip-trigger');
                        if (trigger) {
                            clearTimeout(this.tooltipTimeout);
                            let tooltip = document.getElementById('floating-tooltip');
                            if (tooltip) {
                                tooltip.style.opacity = '0';
                                setTimeout(() => {
                                    if (tooltip && tooltip.style.opacity === '0') tooltip.remove();
                                }, 200);
                            }
                        }
                    });
                },

                /**
                 * @description 绑定中间预览区域的所有交互事件。
                 */
                bindPreviewEvents() {
                    this.elements.previewPanel.addEventListener('click', e => {
                        // 处理移动端的铅笔编辑图标
                        const pencil = e.target.closest('.mobile-edit-pencil');
                        if (pencil) {
                            e.preventDefault();
                            e.stopPropagation();
                            const target = pencil.parentElement;
                            if (target.matches('.preview-card-content[data-card-key="content"]')) {
                                this.showRichTextEditor(target);
                            } else if (target.closest('[data-state-key], [data-card-key], [data-tag-text-id], [data-separator-text-key]')) {
                                this.triggerInlineEdit(target);
                            }
                            return;
                        }

                        // 处理点击头像更换
                        if (e.target.closest('#preview-avatar')) {
                            if (this.selection.type !== 'personalInfo') {
                                this.setSelection({ type: 'personalInfo' });
                            }
                            setTimeout(() => {
                                const avatarUploadInput = this.elements.inspectorPanel.querySelector('#avatar-upload');
                                if (avatarUploadInput) {
                                    avatarUploadInput.click();
                                }
                            }, 50);
                            return;
                        }

                        // 如果正在编辑文本，则忽略点击事件
                        if (this.isEditingText) return;

                        // 点击头部区域，选中个人信息
                        const header = e.target.closest('.preview-header');
                        if (header) {
                            this.setSelection({ type: 'personalInfo' });
                            return;
                        }

                        // 点击区块或卡片，进行选中
                        const blockWrapper = e.target.closest('.preview-block-wrapper');
                        if (blockWrapper && blockWrapper.dataset.blockId) {
                            // MODIFIED: Handle button card selection
                            const cardWrapper = e.target.closest('.preview-card, figure, .preview-button');
                            const cardId = cardWrapper ? cardWrapper.dataset.cardId : null;
                            this.setSelection({ type: 'block', id: blockWrapper.dataset.blockId, cardId: cardId });
                            if (cardId) {
                                const cardEditorEl = this.elements.inspectorPanel.querySelector(`.editor-card[data-card-id="${cardId}"]`);
                                if (cardEditorEl) {
                                    cardEditorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }
                        } else {
                            // 点击预览区空白处，选中全局
                            if (e.target.closest('.preview-wrapper')) {
                                this.setSelection({ type: 'global' });
                            }
                        }
                    });

                    // 双击预览区内容进行内联编辑
                    this.elements.previewWrapper.addEventListener('dblclick', e => {
                        if (this.elements.previewBlocksContainer.classList.contains('locked-mode')) return;

                        // 双击卡片内容，打开富文本编辑器
                        const cardContentTarget = e.target.closest('.preview-card-content[data-card-key="content"]');
                        if (cardContentTarget) {
                            this.showRichTextEditor(cardContentTarget);
                            return;
                        }

                        // 双击其他可编辑文本
                        const target = e.target.closest('[data-state-key], [data-card-key], [data-tag-text-id], [data-separator-text-key]');
                        if (target) {
                            this.triggerInlineEdit(target);
                        }
                    });

                    // 内联编辑时，实时更新 state
                    this.elements.previewWrapper.addEventListener('input', e => {
                        const target = e.target;
                        if (target.contentEditable === 'true') {
                            const stateKey = target.dataset.stateKey;
                            const cardKey = target.dataset.cardKey;
                            const separatorKey = target.dataset.separatorTextKey;
                            const tagId = target.dataset.tagTextId;
                            const value = target.innerText;

                            const updateStateObject = (path, val) => {
                                let obj = this.state;
                                const keys = path.split('.');
                                for (let i = 0; i < keys.length - 1; i++) { obj = obj?.[keys[i]]; }
                                if (obj) obj[keys[keys.length - 1]] = val;
                            };

                            if (stateKey) {
                                updateStateObject(stateKey, value);
                                this.syncControl(stateKey);
                            } else if (cardKey) {
                                const cardEl = target.closest('.preview-card, figure, .preview-button');
                                const blockEl = target.closest('.preview-block-wrapper');
                                if (cardEl && blockEl) {
                                    const block = this.findBlock(blockEl.dataset.blockId);
                                    const card = block?.cards.find(c => c.id === cardEl.dataset.cardId);
                                    if (card) card[cardKey] = value;

                                    const editorInput = this.elements.inspectorPanel.querySelector(`.editor-card[data-card-id="${cardEl.dataset.cardId}"] [data-card-key="${cardKey}"]`);
                                    if (editorInput) editorInput.value = value;
                                    this.renderLayerPanel();
                                }
                            } else if (separatorKey) {
                                const block = this.findBlock(separatorKey);
                                if (block) block.settings.text = value;
                                const editorInput = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${separatorKey}"] [data-setting-key="text"]`);
                                if (editorInput) editorInput.value = value;
                            } else if (tagId) {
                                const tag = this.state.personalInfo.tags.find(t => t.id === tagId);
                                if (tag) {
                                    tag.text = value;
                                    const inspectorInput = this.elements.inspectorPanel.querySelector(`.tag-manager-item[data-tag-id="${tagId}"] .tag-text-input`);
                                    if (inspectorInput) inspectorInput.value = value;
                                }
                            }
                        }
                    });

                    // 移动端长按打开样式面板并定位 (修正版)
                    this.elements.previewWrapper.addEventListener('touchstart', e => {
                        if (this.elements.previewBlocksContainer.classList.contains('locked-mode')) return;

                        clearTimeout(this.longPressTimer);

                        this.longPressTimer = setTimeout(() => {
                            e.preventDefault();

                            let selection = null;
                            let controlToHighlight = null;
                            
                            const cardTarget = e.target.closest('.preview-card, figure, .preview-button');
                            const blockWrapperTarget = e.target.closest('.preview-block-wrapper');
                            const headerTarget = e.target.closest('.preview-header');
                            const separatorTarget = e.target.closest('.separator-preview');
                            const spacerTarget = e.target.closest('.spacer-preview');

                            if (cardTarget && blockWrapperTarget) {
                                const blockId = blockWrapperTarget.dataset.blockId;
                                const cardId = cardTarget.dataset.cardId;
                                selection = { type: 'block', id: blockId, cardId: cardId };
                                controlToHighlight = `.editor-card[data-card-id="${cardId}"]`;
                            } else if ((separatorTarget || spacerTarget) && blockWrapperTarget) {
                                const blockId = blockWrapperTarget.dataset.blockId;
                                selection = { type: 'block', id: blockId };
                                controlToHighlight = `.editor-block[data-block-id="${blockId}"]`;
                            } else if (headerTarget) {
                                selection = { type: 'personalInfo' };
                                controlToHighlight = '#personal-info-section';
                            } else if (blockWrapperTarget) {
                                const blockId = blockWrapperTarget.dataset.blockId;
                                selection = { type: 'block', id: blockId };
                                controlToHighlight = `.editor-block[data-block-id="${blockId}"]`;
                            }

                            if (selection) {
                                this.setSelection(selection);
                                this.togglePanelDrawer('inspector-panel');

                                setTimeout(() => {
                                    if (controlToHighlight) {
                                        const control = this.elements.inspectorPanel.querySelector(controlToHighlight);
                                        if (control) {
                                            control.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            const highlightTarget = control.closest('.editor-section, .editor-card');
                                            if (highlightTarget) {
                                                highlightTarget.classList.remove('highlight-animation');
                                                void highlightTarget.offsetWidth;
                                                highlightTarget.classList.add('highlight-animation');
                                            }
                                        }
                                    }
                                }, 350);
                            }
                        }, 600);
                    }, { passive: false });

                    const cancelLongPress = () => clearTimeout(this.longPressTimer);
                    this.elements.previewWrapper.addEventListener('touchend', cancelLongPress);
                    this.elements.previewWrapper.addEventListener('touchmove', cancelLongPress);
                },

                /**
                 * @description 激活预览区内的文本进行内联编辑。
                 * @param {HTMLElement} target - 需要编辑的DOM元素。
                 */
                triggerInlineEdit(target) {
                    if (!target || this.isEditingText) return;
                    this.isEditingText = true;
                    target.contentEditable = true;
                    target.focus();
                    document.execCommand('selectAll', false, null);

                    const handleEditEnd = () => {
                        target.contentEditable = false;
                        this.isEditingText = false;
                        target.removeEventListener('blur', handleEditEnd);
                        target.removeEventListener('keydown', handleKeydown);

                        this.pushHistory('编辑文本');

                        // 如果在瀑布流布局中，编辑后需要重新计算布局
                        const blockEl = target.closest('.preview-block-wrapper');
                        if (blockEl && this.masonryInstances[blockEl.dataset.blockId]) {
                            this.masonryInstances[blockEl.dataset.blockId].layout();
                        }
                    };

                    const handleKeydown = (ev) => {
                        // 按 Enter 结束编辑
                        if (ev.key === 'Enter' && !ev.shiftKey) {
                            ev.preventDefault();
                            target.blur();
                        }
                    };

                    target.addEventListener('blur', handleEditEnd);
                    target.addEventListener('keydown', handleKeydown);
                },

                /**
                 * @description 初始化右侧面板的拖拽缩放功能。
                 */
                initResizer() {
                    const resizer = this.elements.resizer;
                    const inspectorPanel = this.elements.inspectorPanel;
                    let isResizing = false;

                    resizer.addEventListener('mousedown', (e) => {
                        isResizing = true;
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', stopResize);
                    });

                    const handleMouseMove = (e) => {
                        if (!isResizing) return;
                        const newWidth = window.innerWidth - e.clientX;
                        if (newWidth > 350 && newWidth < window.innerWidth * 0.6) {
                            inspectorPanel.style.width = `${newWidth}px`;
                            this.relayoutAllMasonry();
                        }
                    };

                    const stopResize = () => {
                        isResizing = false;
                        document.body.style.cursor = 'default';
                        document.body.style.userSelect = 'auto';
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', stopResize);
                        this.updateExportSizePreview();
                    };
                },

                /**
                 * @description 重新计算所有瀑布流布局。
                 */
                relayoutAllMasonry() {
                    Object.values(this.masonryInstances).forEach(m => m && m.layout());
                    this.updateExportSizePreview();
                },

                /**
                 * @description 渲染所有UI组件，isInitial用于标记是否是首次渲染。
                 * @param {boolean} isInitial - 是否是首次渲染。
                 */
                renderAll(isInitial = false) {
                    this.updateGlobalCardStyleVars();
                    this.renderPersonalInfo();
                    this.renderPageStyles();
                    this.renderLayerPanel();
                    this.renderInspector();
                    this.renderPreviewBlocks();
                    this.renderMobileEditPencils();
                },

                /**
                 * @description 渲染个人信息区域 (头像, 昵称, 简介, 标签等)。
                 */
                async renderPersonalInfo() {
                    const info = this.state.personalInfo;
                    const header = this.elements.previewHeader;
                    let innerHTML;
                    if (info.layout === 'card') {
                        innerHTML = `
                            <div class="info-left-col">
                                <img id="preview-avatar" src="" alt="Avatar" title="点击更换头像">
                                <h1 id="preview-nickname" data-state-key="personalInfo.nickname"></h1>
                            </div>
                            <div class="info-right-col">
                                <h2 id="preview-subtitle" data-state-key="personalInfo.subtitle"></h2>
                                <p id="preview-bio" data-state-key="personalInfo.bio"></p>
                                <div class="tags-container" id="preview-tags-container"></div>
                            </div>
                        `;
                    } else {
                        innerHTML = `
                            <img id="preview-avatar" src="" alt="Avatar" title="点击更换头像">
                            <h1 id="preview-nickname" data-state-key="personalInfo.nickname"></h1>
                            <h2 id="preview-subtitle" data-state-key="personalInfo.subtitle"></h2>
                            <p id="preview-bio" data-state-key="personalInfo.bio"></p>
                            <div class="tags-container" id="preview-tags-container"></div>
                        `;
                    }
                    header.innerHTML = innerHTML;
                    const previewAvatar = header.querySelector('#preview-avatar');
                    const previewNickname = header.querySelector('#preview-nickname');
                    const previewSubtitle = header.querySelector('#preview-subtitle');
                    const previewBio = header.querySelector('#preview-bio');
                    const previewTagsContainer = header.querySelector('#preview-tags-container');
                    const setAvatarSrc = async (url) => {
                        if (url && url.startsWith('idb://')) {
                            try {
                                const imageId = url.substring(6);
                                const imageRecord = await this.getImageFromDB(imageId);
                                if (imageRecord && imageRecord.blob) {
                                    previewAvatar.src = URL.createObjectURL(imageRecord.blob);
                                } else {
                                    previewAvatar.src = this.getDefaultState().personalInfo.avatarDataUrl;
                                }
                            } catch (e) {
                                console.error('从数据库加载头像失败:', e);
                                previewAvatar.src = this.getDefaultState().personalInfo.avatarDataUrl;
                            }
                        } else {
                            previewAvatar.src = url || this.getDefaultState().personalInfo.avatarDataUrl;
                        }
                    };
                    await setAvatarSrc(info.avatarDataUrl);
                    previewNickname.textContent = info.nickname;
                    previewSubtitle.textContent = info.subtitle;
                    previewBio.textContent = info.bio;
                    previewNickname.style.color = info.nicknameColor;
                    previewSubtitle.style.color = info.subtitleColor;
                    previewBio.style.color = info.bioColor;
                    const baseSize = 90;
                    const newSize = baseSize * ((info.avatarSize || 100) / 100);
                    const offsetX = info.avatarOffsetX || 0;
                    const offsetY = info.avatarOffsetY || 0;
                    previewAvatar.style.width = `${newSize}px`;
                    previewAvatar.style.height = `${newSize}px`;
                    previewAvatar.style.transform = `translateX(${offsetX}%)`;
                    const overflowAmount = (newSize * (offsetY / 100));
                    previewAvatar.style.marginTop = `-${overflowAmount}px`;
                    this.elements.previewWrapper.style.paddingTop = `${20 + overflowAmount / 2}px`;
                    previewAvatar.style.borderRadius = info.avatarShape;
                    previewAvatar.style.borderWidth = `${info.avatarBorderSize}px`;
                    previewAvatar.style.borderColor = info.avatarBorderColor;
                    previewTagsContainer.innerHTML = (info.tags || [])
                        .map(tag => {
                            const iconHTML = tag.icon ? `<span class="iconify" data-icon="${tag.icon}"></span>` : '';
                            return `<span class="tag-pill" style="background-color:${info.tagBgColor}; color:${info.tagTextColor};">${iconHTML}<span data-tag-text-id="${tag.id}">${this.escapeHTML(tag.text)}</span></span>`;
                        }).join('');
                    header.classList.toggle('layout-card', info.layout === 'card');
                    header.style.display = info.isVisible ? '' : 'none';
                    this.initSortablePreviewTags();
                },

                /**
                 * @description 渲染页面和头部的背景样式。
                 */
                async renderPageStyles() {
                    const styles = this.state.pageStyles;
                    const wrapper = this.elements.previewWrapper;

                    let bgLayers = [];
                    let bgSizes = [];
                    let bgPositions = [];
                    let bgColor = 'transparent';

                    // 1. 处理背景纹理
                    if (styles.pageBgPattern) {
                        const pattern = HeroPatterns.find(p => p.name === styles.pageBgPattern);
                        if (pattern) {
                            const coloredSvg = pattern.svg(styles.pageBgPatternColor, styles.pageBgPatternOpacity);
                            const base64Svg = btoa(unescape(encodeURIComponent(coloredSvg)));
                            bgLayers.push(`url("data:image/svg+xml;base64,${base64Svg}")`);
                            bgSizes.push(`${styles.pageBgPatternDensity}px`);
                            bgPositions.push('center');
                        }
                    }

                    // 2. 处理背景图片
                    if (styles.pageBgImageDataUrl) {
                        let imageUrl = styles.pageBgImageDataUrl;
                        if (imageUrl.startsWith('idb://')) {
                            try {
                                const imageId = imageUrl.substring(6);
                                const imageRecord = await this.getImageFromDB(imageId);
                                if (imageRecord && imageRecord.blob) {
                                    imageUrl = URL.createObjectURL(imageRecord.blob);
                                }
                            } catch (e) { console.error('从数据库加载页面背景失败:', e); }
                        } else if (!imageUrl.startsWith('http')) {
                            // Fallback for potentially broken links after import
                        }

                        // 添加图片遮罩层
                        const overlayOpacity = parseFloat(styles.pageOverlayOpacity);
                        if (overlayOpacity > 0) {
                            const finalOverlayColor = this.hexToRgba(styles.pageOverlayColor, overlayOpacity);
                            bgLayers.push(`linear-gradient(${finalOverlayColor}, ${finalOverlayColor})`);
                            bgSizes.push('cover');
                            bgPositions.push('center');
                        }
                        bgLayers.push(`url(${imageUrl})`);
                        bgSizes.push('cover');
                        bgPositions.push('center');
                    }

                    // 3. 处理背景颜色/渐变
                    if (styles.pageBgMode === 'gradient') {
                        bgLayers.push(`linear-gradient(${styles.pageBgGradientAngle}deg, ${styles.pageBgGradientStart}, ${styles.pageBgGradientEnd})`);
                        bgSizes.push('cover');
                        bgPositions.push('center');
                    } else {
                        bgColor = styles.pageBgSolidColor;
                    }

                    // 应用最终的背景样式
                    wrapper.style.backgroundColor = bgColor;
                    wrapper.style.backgroundImage = bgLayers.join(', ');
                    wrapper.style.backgroundSize = bgSizes.join(', ');
                    wrapper.style.backgroundPosition = bgPositions.join(', ');

                    // 处理头部背景
                    if (styles.headerBgMode === 'gradient') {
                        const gradient = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})`;
                        this.elements.previewHeader.style.background = gradient;
                    } else {
                        this.elements.previewHeader.style.background = this.hexToRgba(styles.headerBgColor, styles.headerOpacity);
                    }

                    this.elements.previewHeader.style.borderRadius = `${styles.headerBorderRadius}px`;

                    // 确保头部文字颜色正确
                    const nicknameEl = this.elements.previewHeader.querySelector('#preview-nickname');
                    const subtitleEl = this.elements.previewHeader.querySelector('#preview-subtitle');
                    const bioEl = this.elements.previewHeader.querySelector('#preview-bio');
                    if (nicknameEl) nicknameEl.style.color = this.state.personalInfo.nicknameColor;
                    if (subtitleEl) subtitleEl.style.color = this.state.personalInfo.subtitleColor;
                    if (bioEl) bioEl.style.color = this.state.personalInfo.bioColor;
                },

                /**
                 * @description 渲染左侧的内容图层面板。
                 */
                renderLayerPanel() {
                    const list = this.elements.layerList;
                    const { type, id, cardId } = this.selection;
                    const info = this.state.personalInfo;
                    const isInfoHidden = info.isVisible === false;

                    // 个人信息图层
                    let html = `<div class="layer-item-container">
                                    <div class="layer-item ${type === 'personalInfo' ? 'selected' : ''}" data-type="personalInfo">
                                        <button class="layer-toggle"></button>
                                        <span class="layer-icon iconify" data-icon="mdi:account-circle-outline"></span>
                                        <span class="layer-name">个人信息</span>
                                        <div class="layer-actions">
                                        </div>
                                    </div>
                               </div><hr>`;

                    // 遍历所有区块并生成图层
                    html += this.state.blocks.map(b => {
                        // MODIFIED: Added button icon
                        const iconMap = { text: 'mdi:format-text-variant-outline', image: 'mdi:image-multiple-outline', button: 'mdi:button-pointer', separator: 'mdi:minus', spacer: 'mdi:arrow-expand-vertical' };
                        const isHidden = b.isVisible === false;
                        // MODIFIED: Buttons are also expandable
                        const isExpandable = ['text', 'image', 'button'].includes(b.type) && b.cards && b.cards.length > 0;
                        const isExpanded = b.isExpanded ? 'is-expanded' : '';
                        const hasQuickAdd = ['text', 'image', 'button'].includes(b.type);

                        // 生成卡片子图层列表
                        const cardsListHTML = isExpandable ? `<ul class="card-layer-list" data-block-id="${b.id}">
                            ${b.cards.map(c => {
                            // MODIFIED: Use text for buttons, title for others
                            const cardName = b.type === 'button' ? (c.text || '无文字按钮') : (c.title || '无标题卡片');
                            return `<li class="card-layer-item ${cardId === c.id ? 'selected' : ''}" data-card-id="${c.id}">${this.escapeHTML(cardName)}</li>`
                        }).join('')}
                        </ul>` : '';

                        const quickAddBtn = hasQuickAdd ? `<button class="btn-icon add-card-to-block-btn" title="添加卡片/图片/按钮"><span class="iconify" data-icon="mdi:plus"></span></button>` : '';

                        return `<div class="layer-item-container ${isExpandable ? 'is-expandable' : ''} ${isExpanded}" data-block-id="${b.id}">
                                    <div class="layer-item ${type === 'block' && id === b.id ? 'selected' : ''} ${isHidden ? 'is-hidden' : ''}" data-type="block" data-id="${b.id}">
                                        <button class="layer-toggle"><span class="iconify" data-icon="mdi:chevron-right"></span></button>
                                        <span class="layer-icon iconify" data-icon="${iconMap[b.type]}"></span>
                                        <span class="layer-name">${this.escapeHTML(b.title)}</span>
                                        <div class="layer-actions">
                                            ${quickAddBtn}
                                            <button class="btn-icon toggle-visibility-btn" title="切换显示/隐藏"><span class="iconify" data-icon="${isHidden ? 'mdi:eye-off' : 'mdi:eye'}"></span></button>
                                            <button class="btn-icon duplicate-block-btn" title="复制样式"><span class="iconify" data-icon="mdi:content-copy"></span></button>
                                        </div>
                                    </div>
                                    ${cardsListHTML}
                                </div>`;
                    }).join('');

                    list.innerHTML = html;
                    // 初始化嵌套的卡片拖拽排序
                    this.initNestedSortables();
                },

                /**
                 * @description 根据当前 selection 渲染右侧的检查器面板。
                 */
                renderInspector() {
                    const panel = this.elements.inspectorPanel;
                    const { type, id } = this.selection;
                    let html = '';

                    switch (type) {
                        case 'personalInfo':
                            html = this.createPersonalInfoInspectorHTML();
                            break;
                        case 'block':
                            const block = this.findBlock(id);
                            if (block) html = this.createEditorBlockHTML(block);
                            break;
                        default:
                            html = this.createGlobalInspectorHTML();
                    }

                    panel.innerHTML = html;

                    // 恢复"高级设置"的展开状态
                    panel.querySelectorAll('.editor-section').forEach(section => {
                        if (section.id) {
                            const isOpen = localStorage.getItem(`blokko-advanced-${section.id}`) === 'true';
                            if (isOpen) {
                                section.classList.add('show-advanced');
                                const toggle = section.querySelector('.advanced-toggle');
                                if (toggle) toggle.checked = true;
                            }
                        }
                    });

                    if (this.selection.type === 'global') {
                        this.populateFontList();
                        this.bindColorThiefEvents();
                        if (this.lastPalette && this.lastPalette.length > 0) {
                            this.renderPalette(this.lastPalette);
                        }
                    }

                    // 异步加载图片缩略图
                    panel.querySelectorAll('.thumbnail-wrapper img').forEach(img => {
                        const cardEl = img.closest('.editor-card');
                        if (!cardEl) return;
                        const cardId = cardEl.dataset.cardId;
                        const blockEl = img.closest('.editor-block');
                        if (!blockEl) return;
                        const blockId = blockEl.dataset.blockId;
                        const block = this.findBlock(blockId);
                        const card = block?.cards.find(c => c.id === cardId);
                        if (card && card.url) {
                            const setSrc = async (url) => {
                                if (url && url.startsWith('idb://')) {
                                    const imageId = url.substring(6);
                                    const record = await this.getImageFromDB(imageId);
                                    if (record && record.blob) img.src = URL.createObjectURL(record.blob);
                                } else {
                                    img.src = url;
                                }
                            };
                            setSrc(card.url);
                        }
                    });

                    // 同步所有控件的值
                    this.syncAllControls();
                    this.updateUndoRedoButtons();

                    // 初始化拖拽排序
                    if (type === 'block') {
                        const block = this.findBlock(id);
                        if (block.type === 'text') {
                            this.initSortableCards(id);
                        } else if (block.type === 'image') {
                            this.initSortableImageCards(id);
                        } else if (block.type === 'button') { // NEW: Init sortable buttons
                            this.initSortableButtonCards(id);
                        }
                    } else if (type === 'personalInfo') {
                        this.renderTagManager();
                        this.initSortableTags();
                    }
                },

                createGlobalInspectorHTML() {
                    const backBtn = this.selection.type !== 'global' ? `<button class="back-to-global-btn">← 返回全局</button>` : '';
                    const headerBorderRadiusHTML = `
                        <div class="form-group advanced-setting">
                            <label>头部圆角 (px): <span class="header-radius-value">16</span></label>
                            <div class="input-group simple stepper-group">
                                <button class="btn btn-default btn-stepper minus" aria-label="减少">-</button>
                                <input type="range" data-state-key="pageStyles.headerBorderRadius" min="0" max="50" step="1">
                                <button class="btn btn-default btn-stepper plus" aria-label="增加">+</button>
                            </div>
                        </div>`;
                    // NEW: Watermark/Attribution Checkbox HTML
                    const attributionLink = this.state.pageStyles.pageBgImageAttribution ? `<a href="${this.state.pageStyles.pageBgImageAttribution.pageURL}" target="_blank" style="margin-left: 5px; font-weight: normal;">(查看作者)</a>` : `<a href="https://weibo.com/u/5095783616" target="_blank" style="margin-left: 5px; font-weight: normal;">(开发者主页)</a>`;
                    
                    


                    return `
                        <h3 class="panel-header">全局样式与导出 ${backBtn}</h3>
                        <div class="inspector-state active">
                             <fieldset class="editor-section" id="page-styles-section">
                                <legend>页面与头部样式</legend>
                                <div class="section-content">
                                 <!-- MOVED: personalInfo.isVisible checkbox -->
                                 <div class="form-group">
                                     <label class="checkbox-group" style="font-weight: bold;"><input type="checkbox" data-state-key="personalInfo.isVisible"> 显示个人信息区域</label>
                                 </div>
                                 <hr class="separator">
								 <div class="tab-group-wrapper">
                                 <div class="section-header" style="margin-bottom: 5px;">
                                 <h4 style="margin: 0;">头部背景</h4>
                                 <label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle"> 高级</label>
                                    </div>
                                        <div class="tabs"><button class="tab-btn" data-tab="header-bg-solid">纯色</button><button class="tab-btn advanced-setting" data-tab="header-bg-gradient">渐变</button></div>
                                        <div id="header-bg-solid" class="tab-content"><div class="form-group"><label>头部背景颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.headerBgColor"><input type="text" class="color-hex-input" data-state-key="pageStyles.headerBgColor"></div></div></div>
                                        <div id="header-bg-gradient" class="tab-content advanced-setting"><div class="gradient-controls"><div class="form-group"><label>起始颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.headerBgGradientStart"><input type="text" class="color-hex-input" data-state-key="pageStyles.headerBgGradientStart"></div></div><div class="form-group"><label>结束颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.headerBgGradientEnd"><input type="text" class="color-hex-input" data-state-key="pageStyles.headerBgGradientEnd"></div></div><div class="gradient-angle-control form-group"><label>角度 (<span class="angle-value">135</span>°):<span class="tooltip-trigger" data-tooltip="设置渐变的方向，0度为从下到上，90度为从左到右。"><span class="iconify" data-icon="mdi:help-circle-outline"></span></span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.headerBgGradientAngle" min="0" max="360" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div></div></div>
                                        <div class="form-group advanced-setting"><label>头部不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.headerOpacity" min="0" max="1" step="0.05"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                        ${headerBorderRadiusHTML}
                                    </div>
								<hr class="separator">
                                    <div class="tab-group-wrapper">
                                        <div class="section-header" style="margin-bottom: 5px;">
                                            <h4 style="margin: 0;">页面背景</h4>   
                                        </div>
                                        <div class="tabs"><button class="tab-btn" data-tab="page-bg-solid">纯色/图片</button><button class="tab-btn advanced-setting" data-tab="page-bg-gradient">渐变</button></div>
                                        <div id="page-bg-solid" class="tab-content">
                                            <div class="form-group"><label>页面背景颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageBgSolidColor"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageBgSolidColor"></div></div>
                                            <!-- MODIFIED: Background upload buttons -->
                                            <div class="form-group"><label>背景图 (可选):</label>
                                                <div class="input-group simple">
                                                    <button id="page-bg-upload-btn" class="btn btn-default">选择图片...</button>
                                                    <button id="clear-page-bg-btn" class="btn btn-default btn-small">清除</button>
                                                    <input type="file" id="page-bg-upload-physical" accept="image/*" style="display: none;">
                                                </div>
                                            </div>
                                            <div id="page-image-controls" class="advanced-setting">
                                                <div class="form-group"><label>图片遮罩颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageOverlayColor"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageOverlayColor"></div></div>
                                                <div class="form-group"><label>图片遮罩不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.pageOverlayOpacity" min="0" max="1" step="0.05"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                            </div>
                                        </div>
                                        <div id="page-bg-gradient" class="tab-content advanced-setting"><div class="gradient-controls"><div class="form-group"><label>起始颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageBgGradientStart"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageBgGradientStart"></div></div><div class="form-group"><label>结束颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageBgGradientEnd"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageBgGradientEnd"></div></div><div class="gradient-angle-control form-group"><label>角度 (<span class="angle-value">135</span>°):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.pageBgGradientAngle" min="0" max="360" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div></div></div>
                                        <div class="advanced-setting" style="margin-top: 10px;">
                                            <div class="form-group"><button id="show-texture-picker-btn" class="btn btn-default">🎨 添加纹理</button></div>
                                            <div id="page-texture-controls" class="inset-controls">
                                                <div class="form-group"><label>当前纹理: <span
                                                            id="current-texture-name">无</span></label><button
                                                        id="clear-texture-btn"
                                                        class="btn btn-default btn-small">清除纹理</button></div>
                                                <div class="color-control-row">
                                                    <div class="color-control-group"><label>纹理颜色:</label>
                                                        <div class="input-group"><input type="color"
                                                                data-state-key="pageStyles.pageBgPatternColor"><input
                                                                type="text" class="color-hex-input"
                                                                data-state-key="pageStyles.pageBgPatternColor"></div>
                                                    </div>
                                                    <div class="color-control-group"><label>纹理不透明度:</label>
                                                        <div class="input-group simple stepper-group"><button
                                                                class="btn btn-default btn-stepper minus"
                                                                aria-label="减少">-</button><input type="range"
                                                                data-state-key="pageStyles.pageBgPatternOpacity" min="0"
                                                                max="1" step="0.05"><button
                                                                class="btn btn-default btn-stepper plus"
                                                                aria-label="增加">+</button></div>
                                                    </div>
                                                </div>
                                                <div class="form-group"><label>纹理密度:</label>
                                                    <div class="input-group simple stepper-group"><button
                                                            class="btn btn-default btn-stepper minus"
                                                            aria-label="减少">-</button><input type="range"
                                                            data-state-key="pageStyles.pageBgPatternDensity" min="10"
                                                            max="100" step="2"><button
                                                            class="btn btn-default btn-stepper plus"
                                                            aria-label="增加">+</button></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                            <fieldset class="editor-section" id="color-thief-section">
                                <legend>🎨 智能取色</legend>
                                <div class="section-content">
                                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: -10px; margin-bottom: 15px;">
                                        上传图片，自动提取调色板。右键 (PC) 或长按 (手机) 色块可快捷应用。</p>
                                    <button id="pick-color-btn" class="btn btn-default">上传图片分析颜色</button>
                                    <input type="file" id="color-thief-upload" accept="image/*" style="display: none;">
                                    <div class="palette-container" id="color-thief-palette"></div>
                                </div>
                            </fieldset>
                            <fieldset class="editor-section" id="global-card-styles-section">
                                <legend>全局卡片样式</legend>
                                <div class="section-content">
                                    <div style="text-align: right; margin-bottom: 10px;">
                                        <label class="checkbox-group advanced-toggle-label"><input type="checkbox"
                                                class="advanced-toggle"> 高级</label>
                                    </div>
                                    <div class="tabs"><button class="tab-btn" data-tab="card-bg-solid">纯色</button><button
                                            class="tab-btn advanced-setting" data-tab="card-bg-gradient">渐变</button>
                                    </div>
                                    <div id="card-bg-solid" class="tab-content">
                                        <div class="color-control-row">
                                            <div class="color-control-group"><label>背景色:</label>
                                                <div class="input-group"><input type="color"
                                                        data-state-key="globalCardStyles.bgColor"><input type="text"
                                                        class="color-hex-input"
                                                        data-state-key="globalCardStyles.bgColor"></div>
                                            </div>
                                            <div class="color-control-group"><label>不透明度:</label>
                                                <div class="input-group simple stepper-group"><button
                                                        class="btn btn-default btn-stepper minus"
                                                        aria-label="减少">-</button><input type="range"
                                                        data-state-key="globalCardStyles.opacity" min="0" max="1"
                                                        step="0.05"><button class="btn btn-default btn-stepper plus"
                                                        aria-label="增加">+</button></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="card-bg-gradient" class="tab-content advanced-setting">
                                        <div class="gradient-controls">
                                            <div class="form-group"><label>起始颜色:</label>
                                                <div class="input-group"><input type="color"
                                                        data-state-key="globalCardStyles.bgGradientStart"><input
                                                        type="text" class="color-hex-input"
                                                        data-state-key="globalCardStyles.bgGradientStart"></div>
                                            </div>
                                            <div class="form-group"><label>结束颜色:</label>
                                                <div class="input-group"><input type="color"
                                                        data-state-key="globalCardStyles.bgGradientEnd"><input
                                                        type="text" class="color-hex-input"
                                                        data-state-key="globalCardStyles.bgGradientEnd"></div>
                                            </div>
                                            <div class="gradient-angle-control form-group"><label>角度 (<span
                                                        class="angle-value">135</span>°):</label>
                                                <div class="input-group simple stepper-group"><button
                                                        class="btn btn-default btn-stepper minus"
                                                        aria-label="减少">-</button><input type="range"
                                                        data-state-key="globalCardStyles.bgGradientAngle" min="0"
                                                        max="360" step="1"><button
                                                        class="btn btn-default btn-stepper plus"
                                                        aria-label="增加">+</button></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="form-group advanced-setting"><label>圆角 (px): <span
                                                id="gCardRadiusValue">12</span></label>
                                        <div class="input-group simple stepper-group"><button
                                                class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input
                                                type="range" data-state-key="globalCardStyles.radius" min="0" max="40"
                                                step="1"><button class="btn btn-default btn-stepper plus"
                                                aria-label="增加">+</button></div>
                                    </div>
                                    <div class="advanced-setting">
                                        <hr class="separator"><label>卡片边框:<span class="tooltip-trigger"
                                                data-tooltip="边框在编辑器预览区可能显示不完美（如产生缝隙），但在最终导出的图片中是正常的。"><span class="iconify"
                                                    data-icon="mdi:help-circle-outline"></span></span></label>
                                        <div class="form-group inset-controls">
                                            <div class="form-group"><label>样式:</label><select
                                                    data-state-key="globalCardStyles.borderStyle">
                                                    <option value="none">无</option>
                                                    <option value="solid">实线</option>
                                                    <option value="dashed">虚线</option>
                                                    <option value="dotted">点状</option>
                                                    <option value="double">双实线</option>
                                                </select></div>
                                            <div class="color-control-row">
                                                <div class="color-control-group"><label>粗细(px):</label>
                                                    <div class="input-group simple stepper-group"><button
                                                            class="btn btn-default btn-stepper minus"
                                                            aria-label="减少">-</button><input type="range"
                                                            data-state-key="globalCardStyles.borderWidth" min="0"
                                                            max="10" step="1"><button
                                                            class="btn btn-default btn-stepper plus"
                                                            aria-label="增加">+</button></div>
                                                </div>
                                                <div class="color-control-group"><label>颜色:</label>
                                                    <div class="input-group"><input type="color"
                                                            data-state-key="globalCardStyles.borderColor"><input
                                                            type="text" class="color-hex-input"
                                                            data-state-key="globalCardStyles.borderColor"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <hr class="separator">
                                    <div class="color-control-row">
                                        <div class="color-control-group"><label>标题颜色:</label>
                                            <div class="input-group"><input type="color"
                                                    data-state-key="globalCardStyles.titleColor"><input type="text"
                                                    class="color-hex-input" data-state-key="globalCardStyles.titleColor"
                                                    placeholder="同正文色"></div>
                                        </div>
                                        <div class="color-control-group"><label>正文颜色:</label>
                                            <div class="input-group"><input type="color"
                                                    data-state-key="globalCardStyles.textColor"><input type="text"
                                                    class="color-hex-input"
                                                    data-state-key="globalCardStyles.textColor"></div>
                                        </div>
                                    </div>
                                    <div class="form-group"><label>对齐:</label>
                                        <div class="radio-group"><label><input type="radio" name="gCardAlign"
                                                    value="left" data-state-key="globalCardStyles.textAlign">居左</label><label><input
                                                    type="radio" name="gCardAlign" value="center"
                                                    data-state-key="globalCardStyles.textAlign">居中</label><label><input
                                                    type="radio" name="gCardAlign" value="right"
                                                    data-state-key="globalCardStyles.textAlign">居右</label></div>
                                    </div>
                                    <div class="form-group"><label>行高:</label>
                                        <div class="radio-group"><label><input type="radio" name="gCardLineHeight"
                                                    value="1.4"
                                                    data-state-key="globalCardStyles.lineHeight">紧凑</label><label><input
                                                    type="radio" name="gCardLineHeight" value="1.5"
                                                    data-state-key="globalCardStyles.lineHeight">中等</label><label><input
                                                    type="radio" name="gCardLineHeight" value="1.6"
                                                    data-state-key="globalCardStyles.lineHeight">宽松</label></div>
                                    </div>
                                    <hr class="separator">
                                    <div class="form-group"><label>字体:</label>
                                        <div class="font-controls"><input type="text" id="font-search-input"
                                                placeholder="搜索本地字体..." style="margin-bottom: 5px;"><select
                                                id="font-family-select"
                                                data-state-key="globalCardStyles.fontFamily"></select>
                                            <div class="buttons"><button id="load-local-fonts-btn"
                                                    class="btn btn-default">加载本地</button><button id="upload-font-btn"
                                                    class="btn btn-default">上传字体</button><button id="manage-fonts-btn"
                                                    class="btn btn-default">管理</button></div><input type="file"
                                                id="font-upload-input" accept=".ttf,.woff,.woff2,.otf" multiple
                                                style="display: none;">
                                        </div>
                                    </div>
                                    <div class="color-control-row">
                                        <div class="color-control-group"><label>标题字号:</label><select
                                                data-state-key="globalCardStyles.titleFontSize">
                                                <option value="1em">小</option>
                                                <option value="1.1em">中</option>
                                                <option value="1.2em">大</option>
                                                <option value="1.4em">特大</option>
                                            </select></div>
                                        <div class="color-control-group"><label>正文字号:</label><select
                                                data-state-key="globalCardStyles.contentFontSize">
                                                <option value="0.8em">特小</option>
                                                <option value="0.95em">小</option>
                                                <option value="1em">中</option>
                                                <option value="1.1em">大</option>
                                            </select></div>
                                    </div>
                                    <div class="advanced-setting"><label>文字描边:<span class="tooltip-trigger"
                                                data-tooltip="为文字添加边框，建议宽度不超过2px，以保证可读性。"><span class="iconify"
                                                    data-icon="mdi:help-circle-outline"></span></span></label>
                                        <div class="color-control-row">
                                            <div class="color-control-group"><label>粗细(px):</label>
                                                <div class="input-group simple stepper-group"><button
                                                        class="btn btn-default btn-stepper minus"
                                                        aria-label="减少">-</button><input type="range"
                                                        data-state-key="globalCardStyles.textStrokeWidth" min="0"
                                                        max="5" step="0.5"><button
                                                        class="btn btn-default btn-stepper plus"
                                                        aria-label="增加">+</button></div>
                                            </div>
                                            <div class="color-control-group"><label>颜色:</label>
                                                <div class="input-group"><input type="color"
                                                        data-state-key="globalCardStyles.textStrokeColor"><input
                                                        type="text" class="color-hex-input"
                                                        data-state-key="globalCardStyles.textStrokeColor"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                            <!-- NEW: Global Button Styles Section -->
                            <fieldset class="editor-section" id="global-button-styles-section">
                                <legend>全局按钮样式</legend>
                                <div class="section-content">
                                    <div class="color-control-row">
                                        <div class="color-control-group"><label>背景色:</label>
                                            <div class="input-group"><input type="color"
                                                    data-state-key="globalButtonStyles.bgColor"><input type="text"
                                                    class="color-hex-input" data-state-key="globalButtonStyles.bgColor">
                                            </div>
                                        </div>
                                        <div class="color-control-group"><label>文字颜色:</label>
                                            <div class="input-group"><input type="color"
                                                    data-state-key="globalButtonStyles.textColor"><input type="text"
                                                    class="color-hex-input"
                                                    data-state-key="globalButtonStyles.textColor"></div>
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin-top: 15px;"><label>圆角 (px):</label>
                                        <div class="input-group simple stepper-group"><button
                                                class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input
                                                type="range" data-state-key="globalButtonStyles.radius" min="0" max="40"
                                                step="1"><button class="btn btn-default btn-stepper plus"
                                                aria-label="增加">+</button></div>
                                    </div>
                                    <div class="form-group"><label>内容对齐:</label>
                                        <div class="radio-group">
                                            <label><input type="radio" name="gButtonAlign" value="flex-start"
                                                    data-state-key="globalButtonStyles.textAlign">居左</label>
                                            <label><input type="radio" name="gButtonAlign" value="center"
                                                    data-state-key="globalButtonStyles.textAlign">居中</label>
                                            <label><input type="radio" name="gButtonAlign" value="flex-end"
                                                    data-state-key="globalButtonStyles.textAlign">居右</label>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                            <fieldset class="editor-section" id="export-section">
                                <legend>操作</legend>
                                <div class="section-content">
                                    <div class="form-group" style="display: flex; gap: 10px;"> <button id="undo-btn"
                                            class="btn btn-default" disabled>撤回</button> <button id="redo-btn"
                                            class="btn btn-default" disabled>重做</button> </div>
                                    <div class="form-group" style="display: flex; gap: 10px;"> <button id="import-btn"
                                            class="btn btn-secondary">导入配置</button> <button
                                            id="show-export-modal-btn" class="btn btn-secondary">导出数据...</button>
                                    </div>
                                    <div class="form-group">
                                        <div class="checkbox-group" style="margin-bottom: 10px;"><label><input
                                                    type="checkbox" id="mobile-export-toggle"> 优化手机端导出</label></div>
                                        <div class="checkbox-group" style="margin-bottom: 10px;"><label><input
                                                    type="checkbox" id="hd-export-toggle"> 超清导出 (1800px)</label></div>
                                        <div class="checkbox-group" style="margin-bottom: 10px;"><label><input
                                                    type="checkbox" id="custom-width-toggle"> 自定义尺寸</label></div>
                                        <div id="custom-dimensions-controls" style="display: none; padding-left: 20px;">
                                            <div class="checkbox-group" style="margin-bottom: 10px;"><label><input type="checkbox" id="lock-aspect-ratio-toggle" data-state-key="exportSettings.lockAspectRatio" checked> 锁定比例</label></div>
                                            <div style="display: flex; gap: 10px; align-items: center;">
                                                <input type="number" id="custom-width-input" data-state-key="exportSettings.customWidth" value="1200" style="width: 80px; padding: 4px 8px;">
                                                <span>x</span>
                                                <input type="number" id="custom-height-input" data-state-key="exportSettings.customHeight" value="750" style="width: 80px; padding: 4px 8px;" disabled>
                                            </div>
                                        </div>
                                        <div class="checkbox-group" style="margin-bottom: 10px;"><label><input
                                                    type="checkbox" id="export-rounded-corners-toggle"> 导出为圆角图片</label><input
                                                type="number" id="export-corner-radius-input" value="20"
                                                style="width: 60px; padding: 4px 8px;" disabled></div>
                                        <!-- NEW: Watermark/Attribution Checkbox -->
                                        <div class="checkbox-group" style="margin-bottom: 10px;">
                                            <label><input type="checkbox" id="export-attribution-toggle">
                                                显示blokko水印/背景作者</label>
                                            <span id="attribution-link-wrapper"></span>
                                        </div>
                                        <div id="export-size-preview"
                                            style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">
                                        </div>
                                        <button id="export-png-btn" class="btn btn-primary"
                                            style="margin-top:10px;">导出为图片 (1200px)</button>
                                    </div>
                                    <hr class="separator">
                                    <div class="form-group"><label>预设主题:</label>
                                        <div class="input-group simple"> <button data-preset="light"
                                                class="btn btn-default btn-small">明亮</button> <button
                                                data-preset="dark" class="btn btn-default btn-small">暗黑</button> <button
                                                data-preset="mint" class="btn btn-default btn-small">薄荷</button> <button
                                                data-preset="coffee" class="btn btn-default btn-small">咖啡</button>
                                        </div>
                                    </div>
                                    <div class="form-group"><button id="reset-btn"
                                            class="btn btn-danger">恢复默认模板</button></div>
                                    <input type="file" id="config-file-input" accept=".json,.zip"
                                        style="display: none;">
                                </div>
                            </fieldset>
                        </div>
                    `;
                },

                createPersonalInfoInspectorHTML() {
                    const backBtn = this.selection.type !== 'global' ? `<button class="back-to-global-btn">← 返回全局</button>` : '';
                    return `
                        <h3 class="panel-header">个人信息设置 ${backBtn}</h3>
                        <div class="inspector-state active">
                             <fieldset class="editor-section" id="personal-info-section">
                                <legend>个人信息</legend>
                                <div class="section-content">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <!-- MOVED: Layout controls -->
                                        <div class="form-group" style="margin: 0;">
                                            <label>布局:</label>
                                            <div class="radio-group" style="padding: 5px;">
                                                <label><input type="radio" name="personal-info-layout" value="default" data-state-key="personalInfo.layout"> 默认</label>
                                                <label><input type="radio" name="personal-info-layout" value="card" data-state-key="personalInfo.layout"> 名片</label>
                                            </div>
                                        </div>
                                        <label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle"> 高级</label>
                                    </div>
                                    <div class="form-group"><label>头像上传 (点击左侧预览区的头像也可上传):</label><input type="file" id="avatar-upload" accept="image/*"></div>
                                    <div class="form-group advanced-setting"><label>头像形状:</label><div class="radio-group"><label><input type="radio" name="avatarShape" value="50%" data-state-key="personalInfo.avatarShape">圆形</label><label><input type="radio" name="avatarShape" value="16px" data-state-key="personalInfo.avatarShape">圆角</label><label><input type="radio" name="avatarShape" value="0px" data-state-key="personalInfo.avatarShape">方形</label></div></div>
                                    <div class="form-group advanced-setting"><label>头像边框:</label><div class="color-control-row"><div class="color-control-group"><label>粗细(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarBorderSize" min="0" max="10" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div><div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-state-key="personalInfo.avatarBorderColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.avatarBorderColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.avatarBorderColor">重置</button></div></div></div></div>
                                    
                                    <hr class="separator advanced-setting">
                                    <div class="form-group advanced-setting"><label>头像大小 (%): <span class="avatar-size-value">100</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarSize" min="50" max="200" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                    <div class="form-group advanced-setting"><label>头像水平位置:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarOffsetX" min="-100" max="100" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                    <!-- NEW: Floating Avatar Control -->
<div id="avatar-offsetY-control" class="form-group advanced-setting">
                                        <label>头像垂直偏移 (悬浮): <span class="avatar-offsetY-value">0</span>%</label>
                                        <div class="input-group simple stepper-group">
                                            <button class="btn btn-default btn-stepper minus" aria-label="减少">-</button>
                                            <input type="range" data-state-key="personalInfo.avatarOffsetY" min="0" max="100" step="1">
                                            <button class="btn btn-default btn-stepper plus" aria-label="增加">+</button>
                                        </div>
                                    </div>
                                    <div class="form-group advanced-setting"><button id="reset-avatar-transform-btn" class="btn btn-default btn-small">恢复默认位置与大小</button></div>

                                    <hr class="separator">
                                    <div class="form-group"><label>昵称:</label><input type="text" data-state-key="personalInfo.nickname" data-preview-target="#preview-nickname"></div>
                                    <div class="form-group"><label>昵称颜色:</label><div class="input-group"><input type="color" data-state-key="personalInfo.nicknameColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.nicknameColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.nicknameColor">重置</button></div></div>
                                    <div class="form-group"><label>副标题 (可选):</label><input type="text" data-state-key="personalInfo.subtitle" data-preview-target="#preview-subtitle"></div>
                                    <div class="form-group advanced-setting"><label>副标题颜色:</label><div class="input-group"><input type="color" data-state-key="personalInfo.subtitleColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.subtitleColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.subtitleColor">重置</button></div></div>
                                    <div class="form-group"><label>简介 (可选):</label><textarea data-state-key="personalInfo.bio" rows="3" data-preview-target="#preview-bio"></textarea></div>
                                    <div class="form-group advanced-setting"><label>简介颜色:</label><div class="input-group"><input type="color" data-state-key="personalInfo.bioColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.bioColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.bioColor">重置</button></div></div>
                                    <hr class="separator">
                                    <div class="form-group"><label>标签管理器 (可点击标签前拖拽排序):</label><div id="tag-manager-list"></div><div class="input-group simple" style="margin-top: 10px;"><input type="text" id="new-tag-text-input" placeholder="输入新标签文字..."><button id="add-new-tag-btn" class="btn btn-default btn-small">添加标签</button></div></div>
                                    <div class="form-group advanced-setting"><label>标签样式:</label><div class="color-control-row"><div class="color-control-group"><label>背景</label><div class="input-group"><input type="color" data-state-key="personalInfo.tagBgColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.tagBgColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.tagBgColor">重置</button></div></div><div class="color-control-group"><label>文字</label><div class="input-group"><input type="color" data-state-key="personalInfo.tagTextColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.tagTextColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.tagTextColor">重置</button></div></div></div></div>
                                </div>
                            </fieldset>
                        </div>
                    `;
                },

                /**
                 * @description 渲染所有区块的预览效果。
                 */
                renderPreviewBlocks() {
                    this.elements.previewBlocksContainer.innerHTML = this.state.blocks.length ? this.state.blocks.map(b => `<div class="preview-block-wrapper ${b.isVisible === false ? 'is-hidden' : ''}" data-block-id="${b.id}">${this.createPreviewBlockHTML(b)}</div>`).join('') : '<div class="empty-placeholder">(预览区) 无区块</div>';
                    this.postRenderAsyncUpdates(this.elements.previewBlocksContainer);
                    this.updateHighlights();
                    this.renderMobileEditPencils();
                },

                createEditorBlockHTML(block) {
                    let content = '';
                    const backBtn = this.selection.type !== 'global' ? `<button class="back-to-global-btn">← 返回全局</button>` : '';
                    const masonryCheckboxHTML = `
                        <div class="masonry-toggle-container" style="${['dual', 'triple'].includes(block.settings.layout) ? 'display: block;' : 'display: none;'}">
                            <div class="checkbox-group" style="margin-top: 10px;">
                                <label><input type="checkbox" data-setting-key="masonryEnabled" ${block.settings.masonryEnabled ? 'checked' : ''}> 启用瀑布流
                                <span class="tooltip-trigger" data-tooltip="使卡片高度自适应内容，实现紧凑的砌体式布局。适合图片或文字长短不一的场景。"><span class="iconify" data-icon="mdi:help-circle-outline"></span></span>
                                </label>
                            </div>
                        </div>`;
                    const layoutRadiosHTML = `
                        <div class="radio-group">
                            <label><input type="radio" data-setting-key="layout" name="block-layout-${block.id}" value="single" ${block.settings.layout === 'single' ? 'checked' : ''}> 单排</label>
                            <label><input type="radio" data-setting-key="layout" name="block-layout-${block.id}" value="dual" ${block.settings.layout === 'dual' ? 'checked' : ''}> 双排</label>
                            <label><input type="radio" data-setting-key="layout" name="block-layout-${block.id}" value="triple" ${block.settings.layout === 'triple' ? 'checked' : ''}> 三排</label>
                        </div>`;

                    if (block.type === 'text') {
                        let cardsHTML = !block.cards?.length ? '<div class="empty-placeholder">暂无卡片</div>' : block.cards.map(c => `<div class="editor-card ${this.selection.cardId === c.id ? 'is-active' : ''}" data-card-id="${c.id}">${this.createEditorCardHTML(c)}</div>`).join('');
                        content = `<div class="form-group"><label>布局:</label>${layoutRadiosHTML}${masonryCheckboxHTML}</div>
                                   <hr class="separator"><div class="card-editors-list">${cardsHTML}</div><button class="btn btn-default add-card-btn" style="margin-top: 15px;">➕ 添加卡片</button>`;
                    } else if (block.type === 'image') {
                        let imageCardsHTML = !block.cards?.length ? '<div class="empty-placeholder">暂无图片</div>' : block.cards.map(c => `<div class="editor-card ${this.selection.cardId === c.id ? 'is-active' : ''}" data-card-id="${c.id}">${this.createEditorImageCardHTML(c)}</div>`).join('');
                        content = `<div class="form-group"><label>布局:</label>${layoutRadiosHTML}${masonryCheckboxHTML}</div>
                                   <div class="form-group"><label>文字颜色:</label><div class="input-group"><input type="color" data-setting-key="textColor" value="${block.settings.textColor || ''}"><input type="text" class="color-hex-input" data-setting-key="textColor" value="${block.settings.textColor || ''}" placeholder="全局默认"><button class="btn btn-default btn-small" data-reset-block-key="textColor">重置</button></div></div>
                                   <hr class="separator"><div class="image-card-editors-list">${imageCardsHTML}</div><button class="btn btn-default add-image-btn" style="margin-top: 15px;">➕ 添加图片</button>
                                   <input type="file" class="image-upload-input" multiple accept="image/*" style="display: none;">`;
                        // NEW: Button block editor
                    } else if (block.type === 'button') {
                        let buttonCardsHTML = !block.cards?.length ? '<div class="empty-placeholder">暂无按钮</div>' : block.cards.map(c => `<div class="editor-card ${this.selection.cardId === c.id ? 'is-active' : ''}" data-card-id="${c.id}">${this.createEditorButtonCardHTML(c)}</div>`).join('');
                        content = `<div class="form-group"><label>按钮间距 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-setting-key="gap" min="0" max="40" value="${block.settings.gap || 15}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                   <hr class="separator"><div class="button-card-editors-list">${buttonCardsHTML}</div><button class="btn btn-default add-button-card-btn" style="margin-top: 15px;">➕ 添加按钮</button>`;
                    } else if (block.type === 'separator') {
                        const s = block.settings;
                        const iconHTML = s.icon ? `<span class="iconify" data-icon="${s.icon}"></span>` : '选择图标';
                        content = `<div class="form-group"><label>样式:</label><div class="radio-group"><label><input type="radio" name="sep-style-${block.id}" data-setting-key="style" value="solid" ${s.style === 'solid' ? 'checked' : ''}>实线</label><label><input type="radio" name="sep-style-${block.id}" data-setting-key="style" value="dashed" ${s.style === 'dashed' ? 'checked' : ''}>虚线</label><label><input type="radio" name="sep-style-${block.id}" data-setting-key="style" value="dotted" ${s.style === 'dotted' ? 'checked' : ''}>点状</label></div></div><div class="color-control-row"><div class="color-control-group"><label>线条颜色:</label><div class="input-group"><input type="color" data-setting-key="color" value="${s.color}"><input type="text" class="color-hex-input" data-setting-key="color" value="${s.color}"><button class="btn btn-default btn-small" data-reset-block-key="color">重置</button></div></div><div class="color-control-group"><label>粗细(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-setting-key="thickness" min="1" max="10" value="${s.thickness}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div></div><div class="form-group"><label>垂直间距(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-setting-key="margin" min="0" max="50" value="${s.margin}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div><hr class="separator"><div class="form-group"><label>嵌入文本 (可选):</label><div class="input-group"><input type="text" data-setting-key="text" value="${this.escapeHTML(s.text || '')}" style="border-right: none;"><button class="btn btn-default select-icon-btn" data-separator-icon-btn="true" style="width: auto; flex-shrink: 0; border-radius: 0 6px 6px 0;">${iconHTML}</button></div></div><div class="form-group"><label>文本颜色:</label><div class="input-group"><input type="color" data-setting-key="textColor" value="${s.textColor}"><input type="text" class="color-hex-input" data-setting-key="textColor" value="${s.textColor}"><button class="btn btn-default btn-small" data-reset-block-key="textColor">重置</button></div></div>`;
                    } else if (block.type === 'spacer') {
                        const s = block.settings;
                        content = `<div class="form-group"><label>高度 (px): <span class="spacer-height-value">${s.height}</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-setting-key="height" min="1" max="200" value="${s.height}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>`;
                    }

                    return `<h3 class="panel-header">区块设置 ${backBtn}</h3><div class="editor-block" data-block-id="${block.id}"><div class="editor-block-header"><input type="text" class="editor-block-title-input" data-block-id-for-title="${block.id}" value="${this.escapeHTML(block.title || '')}" placeholder="区块标题 (可编辑)"><div class="block-actions"><button class="btn btn-danger btn-small block-delete-btn">删除</button></div></div><div class="editor-block-content">${content}</div></div>`;
                },

                createPreviewBlockHTML(block) {
                    let layoutClass = 'preview-cards-single';
                    if (block.settings.layout === 'dual') layoutClass = 'preview-cards-dual';
                    if (block.settings.layout === 'triple') layoutClass = 'preview-cards-triple';

                    let cardsHTML = '';
                    if (block.type === 'text') {
                        cardsHTML = (block.cards || []).map(card => this.createPreviewCardHTML(card)).join('');
                    } else if (block.type === 'image') {
                        cardsHTML = (block.cards || []).map(card => this.createPreviewImageCardHTML(card, block.settings)).join('');
                        // NEW: Render button previews
                    } else if (block.type === 'button') {
                        return `<div class="preview-buttons-container" style="gap: ${block.settings.gap || 15}px;">
                            ${(block.cards || []).map(card => this.createPreviewButtonCardHTML(card)).join('')}
                        </div>`;
                    }

                    if (block.type === 'text' || block.type === 'image') {
                        return `<div class="preview-cards-container ${layoutClass}">${cardsHTML}</div>`;
                    } else if (block.type === 'separator') {
                        const s = block.settings;
                        const hasTextOrIcon = s.text || s.icon;
                        const iconHTML = s.icon ? `<span class="iconify" data-icon="${s.icon}" style="margin-right: 8px; vertical-align: -0.15em;"></span>` : '';
                        const textHTML = `<span data-separator-text-key="${block.id}" style="color: ${s.textColor}; padding: 0 12px; flex-shrink: 0;">${iconHTML}${this.escapeHTML(s.text || '')}</span>`;
                        const lineHTML = `<div class="separator-preview-line" style="flex-grow: 1; border-top: ${s.thickness}px ${s.style} ${s.color};"></div>`;
                        return `<div class="separator-preview" style="margin: ${s.margin}px 0;">${lineHTML}${hasTextOrIcon ? textHTML + lineHTML : ''}</div>`;
                    } else if (block.type === 'spacer') {
                        return `<div class="spacer-preview" style="height: ${block.settings.height}px;"></div>`;
                    }
                    return '';
                },

                createPreviewCardHTML(card) {
                    const cardEl = document.createElement('div');
                    cardEl.className = 'preview-card';
                    cardEl.dataset.cardId = card.id;
                    cardEl.style.setProperty('--card-transition-name', `card-${card.id}`);
                    const iconHTML = card.icon ? `<span class="iconify" data-icon="${card.icon}"></span>` : '';

                    const g = this.state.globalCardStyles;
                    const finalAlign = card.textAlign || g.textAlign;
                    const justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[finalAlign] || 'flex-start';
                    const finalTitleColor = card.titleColor || g.titleColor || g.textColor;

                    cardEl.innerHTML = `<div class="preview-card-inner">
                            <h3 class="preview-card-title" data-card-key="title" style="justify-content: ${justifyContent}; color: ${finalTitleColor};">${iconHTML}${this.escapeHTML(card.title || '')}</h3>
                            <div class="preview-card-content" data-card-key="content">${this.sanitizeHTML(card.content || '')}</div>
                        </div>`;
                    return cardEl.outerHTML;
                },

                createPreviewImageCardHTML(card, blockSettings = {}) {
                    const textColorStyle = blockSettings.textColor ? `style="color: ${blockSettings.textColor};"` : '';
                    const figcaptionContent = (card.title || card.description) ?
                        `<figcaption ${textColorStyle}>
                            ${card.title ? `<strong data-card-key="title">${this.escapeHTML(card.title)}</strong>` : ''}
                            <span data-card-key="description">${this.escapeHTML(card.description || '')}</span>
                        </figcaption>`
                        : '';

                    const figureHTML = `<figure data-card-id="${card.id}">
                        <img src="" alt="${this.escapeHTML(card.title || '')}" loading="lazy">
                        ${figcaptionContent}
                    </figure>`;

                    return figureHTML;
                },

                // NEW: Function to render a single preview button
                createPreviewButtonCardHTML(card) {
                    const g = this.state.globalButtonStyles;
                    const iconHTML = card.icon ? `<span class="iconify" data-icon="${card.icon}"></span>` : '';
                    const alignSelf = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' }[card.textAlign] || 'center';

                    const styles = [];
                    if (card.bgColor) styles.push(`--button-bg-color: ${card.bgColor}`);
                    if (card.textColor) styles.push(`--button-text-color: ${card.textColor}`);
                    if (card.radius != null) styles.push(`--button-border-radius: ${card.radius}px`); // Use != null to allow 0
                    if (card.textAlign) styles.push(`--button-text-align: ${card.textAlign}`);
                    if (card.width) styles.push(`--button-width: ${card.width}`);
                    styles.push(`--button-align-self: ${alignSelf}`);
                    const styleString = styles.join(';');
                    return `<div class="preview-button" data-card-id="${card.id}" style="${styleString}">
                        ${iconHTML}<span data-card-key="text">${this.escapeHTML(card.text || '')}</span>
                    </div>`;
                },

                createEditorCardHTML(card) {
                    const iconHTML = card.icon ? `<span class="iconify" data-icon="${card.icon}" style="font-size: 1.2em; vertical-align: middle; margin-right: 5px;"></span>` : '选择图标';
                    const g = this.state.globalCardStyles;
                    const contentPreview = card.content || '<span style="color: var(--text-placeholder);">点击编辑内容...</span>';

                    return `<span class="card-drag-handle">☰</span><div class="editor-card-header"><button class="btn btn-danger btn-small card-delete-btn">删</button></div>
                        <div class="editor-card-content">
                            <h4>基础设置</h4>
                            <div class="form-group"><label>标题:</label><div class="input-group"><input type="text" data-card-key="title" value="${this.escapeHTML(card.title || '')}" style="border-right: none;"><button class="btn btn-default select-icon-btn" style="width: auto; flex-shrink: 0; border-radius: 0 6px 6px 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${iconHTML}</button></div></div>
                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <label style="margin-bottom: 0;">内容:<span class="tooltip-trigger" data-tooltip="此处支持富文本编辑。卡片内部设置的文本颜色、背景色等设置会覆盖外部的样式。"><span class="iconify" data-icon="mdi:help-circle-outline"></span></span></label>
                                    <button class="btn btn-default btn-small edit-content-btn"><span class="iconify" data-icon="mdi:pencil"></span> 编辑内容</button>
                                </div>
                                <div class="rich-text-editor-trigger">
                                    <div class="rich-text-preview">${contentPreview}</div>
                                </div>
                            </div>
                            <div class="form-group"><label>对齐:</label><div class="radio-group">
                                <label><input type="radio" name="card-${card.id}-align" value="" data-card-key="textAlign" ${!['left', 'center', 'right'].includes(card.textAlign) ? 'checked' : ''}>默认</label>
                                <label><input type="radio" name="card-${card.id}-align" value="left" data-card-key="textAlign" ${card.textAlign === 'left' ? 'checked' : ''}>左</label>
                                <label><input type="radio" name="card-${card.id}-align" value="center" data-card-key="textAlign" ${card.textAlign === 'center' ? 'checked' : ''}>中</label>
                                <label><input type="radio" name="card-${card.id}-align" value="right" data-card-key="textAlign" ${card.textAlign === 'right' ? 'checked' : ''}>右</label>
                            </div></div>
                             <div style="text-align: right; margin-bottom: 10px;">
                                <label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle"> 高级独立样式</label>
                            </div>
                            <div class="advanced-setting">
                                <hr class="separator">
                                <h4>独立样式</h4>
                                <div class="color-control-row">
                                    <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-card-key="bgColor" value="${card.bgColor || ''}"><input class="color-hex-input" type="text" data-card-key="bgColor" value="${card.bgColor || ''}" placeholder="${g.bgColor} (全局)"><button class="btn btn-default btn-small" data-reset-card-key="bgColor">重置</button></div></div>
                                    <div class="color-control-group"><label>正文颜色:</label><div class="input-group"><input type="color" data-card-key="textColor" value="${card.textColor || ''}"><input class="color-hex-input" type="text" data-card-key="textColor" value="${card.textColor || ''}" placeholder="${g.textColor} (全局)"><button class="btn btn-default btn-small" data-reset-card-key="textColor">重置</button></div></div>
                                </div>
                                <div class="color-control-row" style="margin-top: 10px;">
                                    <div class="color-control-group"><label>标题颜色:</label><div class="input-group"><input type="color" data-card-key="titleColor" value="${card.titleColor || ''}"><input class="color-hex-input" type="text" data-card-key="titleColor" value="${card.titleColor || ''}" placeholder="同正文色"><button class="btn btn-default btn-small" data-reset-card-key="titleColor">重置</button></div></div>
                                </div>
                                <div class="color-control-row" style="margin-top: 10px;">
                                    <div class="color-control-group"><label>标题字号:</label><select data-card-key="titleFontSize"><option value="">默认</option><option value="1em">小</option><option value="1.1em">中</option><option value="1.2em">大</option><option value="1.4em">特大</option></select></div>
                                    <div class="color-control-group"><label>正文字号:</label><select data-card-key="contentFontSize"><option value="">默认</option><option value="0.8em">特小</option><option value="0.95em">小</option><option value="1em">中</option><option value="1.1em">大</option></select></div>
                                </div>
                                <hr class="separator">
                                <div class="form-group"><label>背景图:</label><div class="input-group simple"><input type="file" class="card-bg-upload" accept="image/*"><button class="btn btn-default btn-small card-clear-bg-btn">清除</button></div></div>
                                <div class="card-overlay-controls" style="${card.bgImageDataUrl ? '' : 'display:none;'}"><label>图片蒙版:</label><div class="color-control-row"><div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-card-key="overlayColor" value="${card.overlayColor || '#ffffff'}"><input class="color-hex-input" type="text" data-card-key="overlayColor" value="${card.overlayColor || '#ffffff'}"></div></div><div class="color-control-group"><label>不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-card-key="overlayOpacity" min="0" max="1" step="0.05" value="${card.overlayOpacity ?? 0.5}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div></div></div>
                            </div>
                        </div>`;
                },

                // NEW: Function to create the editor for a single button card
                createEditorButtonCardHTML(card) {
                    const iconHTML = card.icon ? `<span class="iconify" data-icon="${card.icon}"></span>` : '图标';
                    return `
                        <span class="card-drag-handle">☰</span>
                        <div class="editor-card-header"><button class="btn btn-danger btn-small card-delete-btn">删</button></div>
                        <div class="editor-card-content">
                            <div class="form-group">
                                <label>按钮内容:</label>
                                <div class="input-group">
                                    <button class="btn btn-default select-icon-btn" style="width: auto; flex-shrink: 0; border-radius: 6px 0 0 6px;">${iconHTML}</button>
                                    <input type="text" data-card-key="text" value="${this.escapeHTML(card.text || '')}" placeholder="按钮文字" style="border-left: none;">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>宽度:</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="btn-width-${card.id}" value="" data-card-key="width" ${!card.width ? 'checked' : ''}>自动</label>
                                    <label><input type="radio" name="btn-width-${card.id}" value="50%" data-card-key="width" ${card.width === '50%' ? 'checked' : ''}>50%</label>
                                    <label><input type="radio" name="btn-width-${card.id}" value="100%" data-card-key="width" ${card.width === '100%' ? 'checked' : ''}>100%</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>对齐:</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="btn-align-${card.id}" value="" data-card-key="textAlign" ${!card.textAlign ? 'checked' : ''}>默认</label>
                                    <label><input type="radio" name="btn-align-${card.id}" value="flex-start" data-card-key="textAlign" ${card.textAlign === 'flex-start' ? 'checked' : ''}>居左</label>
                                    <label><input type="radio" name="btn-align-${card.id}" value="center" data-card-key="textAlign" ${card.textAlign === 'center' ? 'checked' : ''}>居中</label>
                                    <label><input type="radio" name="btn-align-${card.id}" value="flex-end" data-card-key="textAlign" ${card.textAlign === 'flex-end' ? 'checked' : ''}>居右</label>
                                </div>
                            </div>
                            <hr class="separator">
                            <h4>独立样式 (可选)</h4>
                            <div class="color-control-row">
                                <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-card-key="bgColor"><input type="text" class="color-hex-input" data-card-key="bgColor" placeholder="全局"><button class="btn btn-default btn-small" data-reset-card-key="bgColor">重置</button></div></div>
                                <div class="color-control-group"><label>文字颜色:</label><div class="input-group"><input type="color" data-card-key="textColor"><input type="text" class="color-hex-input" data-card-key="textColor" placeholder="全局"><button class="btn btn-default btn-small" data-reset-card-key="textColor">重置</button></div></div>
                            </div>
                             <div class="form-group" style="margin-top: 15px;"><label>圆角 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-card-key="radius" min="0" max="40"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                             <button class="btn btn-default btn-small" data-reset-card-key="radius" style="margin-left: 10px;">重置</button>
                        </div>`;
                },

                createEditorImageCardHTML(card) {
                    const imgHTML = `<img src="" loading="lazy">`;

                    return `<span class="card-drag-handle">☰</span>
                        <div class="editor-card-header"><button class="btn btn-danger btn-small card-delete-btn">删</button></div>
                        <div class="editor-card-content">
                            <div class="image-card-editor-content">
                                <div class="image-card-editor-thumb">
                                    <div class="thumbnail-wrapper">
                                        ${imgHTML}
                                        <div class="thumbnail-actions">
                                            <button class="btn btn-icon crop-image-btn" title="裁剪与调整"><span class="iconify" data-icon="mdi:crop-rotate"></span></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="image-card-editor-fields">
                                    <div class="form-group"><label>标题:</label><input type="text" data-card-key="title" value="${this.escapeHTML(card.title || '')}"></div>
                                    <div class="form-group"><label>描述:</label><textarea data-card-key="description" rows="2">${this.escapeHTML(card.description || '')}</textarea></div>
                                </div>
                            </div>
                        </div>`;
                },

                /**
                 * @description 将卡片的样式（包括全局样式和独立样式）应用到指定的DOM元素上。
                 * @param {HTMLElement} cardEl - 目标卡片的DOM元素。
                 * @param {object} cardData - 卡片的状态数据。
                 */
                async applyCardStyles(cardEl, cardData) {
                    const g = this.state.globalCardStyles;
                    const use = (key, val) => (val === undefined || val === null || val === '') ? g[key] : val;

                    const followGlobalOpacity = cardData.followGlobalOpacity !== false;
                    const finalOpacity = followGlobalOpacity ? g.opacity : (cardData.opacity ?? 1.0);

                    const innerEl = cardEl.querySelector('.preview-card-inner');
                    if (!innerEl) return;

                    const titleEl = cardEl.querySelector('.preview-card-title');
                    const contentEl = cardEl.querySelector('.preview-card-content');
                    innerEl.style.textAlign = use('textAlign', cardData.textAlign);
                    if (titleEl) {
                        titleEl.style.fontSize = cardData.titleFontSize ? cardData.titleFontSize : '';
                    }
                    if (contentEl) {
                        contentEl.style.fontSize = cardData.contentFontSize ? cardData.contentFontSize : '';
                    }


                    const finalTextColor = use('textColor', cardData.textColor);
                    const finalTitleColor = cardData.titleColor || g.titleColor || finalTextColor;
                    if (titleEl) titleEl.style.color = finalTitleColor;


                    let finalBg;
                    if (cardData.bgImageDataUrl) {
                        let imageUrl = cardData.bgImageDataUrl;
                        if (imageUrl.startsWith('idb://')) {
                            try {
                                const imageId = imageUrl.substring(6);
                                const record = await this.getImageFromDB(imageId);
                                if (record && record.blob) imageUrl = URL.createObjectURL(record.blob);
                            } catch (e) { console.error('从数据库加载卡片背景失败:', e); }
                        }
                        finalBg = `url(${imageUrl})`;
                    } else if (cardData.bgColor) {
                        finalBg = cardData.bgColor;
                    } else {
                        finalBg = g.bgMode === 'gradient' ? `linear-gradient(${g.bgGradientAngle}deg, ${g.bgGradientStart}, ${g.bgGradientEnd})` : g.bgColor;
                    }

                    innerEl.style.setProperty('--card-bg-final', finalBg);
                    innerEl.style.setProperty('--card-bg-opacity', finalOpacity);

                    if (parseFloat(finalOpacity) < 0.01) {
                        innerEl.style.boxShadow = 'none';
                        innerEl.style.border = 'var(--active-card-border)';
                    } else {
                        innerEl.style.setProperty('--card-text-color', finalTextColor);
                        innerEl.style.setProperty('--active-card-text-shadow', 'none');
                        const overlayOpacity = cardData.bgImageDataUrl ? (cardData.overlayOpacity ?? 0.5) : 0;
                        innerEl.style.setProperty('--card-overlay-color', cardData.overlayColor || '#FFF');
                        innerEl.style.setProperty('--card-overlay-opacity', parseFloat(overlayOpacity) > 0 ? overlayOpacity : 0);
                        innerEl.style.boxShadow = 'var(--active-card-shadow)';
                        innerEl.style.border = 'var(--active-card-border)';
                    }
                },

                /**
                 * @description 更新 state 对象中的某个值。
                 * @param {string} keyPath - 状态路径，例如 'personalInfo.nickname'。
                 * @param {*} value - 新的值。
                 * @param {boolean} pushHistory - 是否将此操作推入历史记录。
                 * @param {string|null} historyDescription - 操作的历史描述。
                 */
                updateState(keyPath, value, pushHistory = true, historyDescription = null) {
                    if (pushHistory && !this.isRestoringState) {
                        this.pushHistory(historyDescription || '修改样式');
                    }
                    // 通过路径字符串安全地更新深层嵌套的对象属性
                    let obj = this.state;
                    const keys = keyPath.split('.');
                    for (let i = 0; i < keys.length - 1; i++) { obj = obj?.[keys[i]]; }
                    if (obj) obj[keys[keys.length - 1]] = value;

                    this.debouncedSaveToLocal();
                    this.triggerRender(keyPath);
                    this.syncControl(keyPath);
                },

                /**
                 * @description 根据更新的状态路径，触发最高效的局部UI渲染。
                 * @param {string} keyPath - 被更新的状态路径。
                 */
                triggerRender(keyPath) {
                    const styles = this.state.pageStyles;
                    const gCard = this.state.globalCardStyles;
                    const gButton = this.state.globalButtonStyles; // NEW
                    const info = this.state.personalInfo;
                    const r = document.documentElement.style;

                    // 定义一个映射表，对于某些特定的状态更新，直接操作DOM，避免重渲染整个组件
                    const directUpdateMap = {
                        'pageStyles.headerBgColor': () => { if (styles.headerBgMode === 'solid') this.elements.previewHeader.style.background = this.hexToRgba(styles.headerBgColor, styles.headerOpacity); },
                        'pageStyles.headerBgGradientStart': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerBgGradientEnd': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerBgGradientAngle': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerOpacity': () => this.renderPageStyles(),
                        'pageStyles.headerBorderRadius': () => { this.elements.previewHeader.style.borderRadius = `${styles.headerBorderRadius}px`; },
                        'pageStyles.pageBgSolidColor': () => { if (styles.pageBgMode === 'solid') this.elements.previewWrapper.style.backgroundColor = styles.pageBgSolidColor; },
                        'pageStyles.pageBgGradientStart': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageBgGradientEnd': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageBgGradientAngle': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageOverlayOpacity': () => this.renderPageStyles(),
                        'pageStyles.pageOverlayColor': () => this.renderPageStyles(),
                        // NEW: Global button style direct updates
                        'globalButtonStyles.bgColor': () => r.setProperty('--g-button-bg-color', gButton.bgColor),
                        'globalButtonStyles.textColor': () => r.setProperty('--g-button-text-color', gButton.textColor),
                        'globalButtonStyles.radius': () => r.setProperty('--g-button-border-radius', `${gButton.radius}px`),
                        'globalButtonStyles.textAlign': () => r.setProperty('--g-button-text-align', gButton.textAlign),

                        'globalCardStyles.opacity': () => { r.setProperty('--g-card-opacity', gCard.opacity); this.renderPreviewBlocks(); },
                        'globalCardStyles.radius': () => r.setProperty('--g-card-border-radius', `${gCard.radius}px`),
                        'globalCardStyles.bgColor': () => { r.setProperty('--g-card-bg-color', gCard.bgColor); if (gCard.bgMode === 'solid') this.renderPreviewBlocks(); },
                        'globalCardStyles.textColor': () => { r.setProperty('--g-card-text-color', gCard.textColor); this.renderPreviewBlocks(); },
                        'globalCardStyles.bgGradientStart': () => { if (gCard.bgMode === 'gradient') this.renderPreviewBlocks(); },
                        'globalCardStyles.bgGradientEnd': () => { if (gCard.bgMode === 'gradient') this.renderPreviewBlocks(); },
                        'globalCardStyles.bgGradientAngle': () => { if (gCard.bgMode === 'gradient') this.renderPreviewBlocks(); },
                        'globalCardStyles.borderWidth': () => { r.setProperty('--active-card-border', gCard.borderWidth > 0 && gCard.borderStyle !== 'none' ? `${gCard.borderWidth}px ${gCard.borderStyle} ${gCard.borderColor}` : 'none'); },
                        'globalCardStyles.borderStyle': () => { r.setProperty('--active-card-border', gCard.borderWidth > 0 && gCard.borderStyle !== 'none' ? `${gCard.borderWidth}px ${gCard.borderStyle} ${gCard.borderColor}` : 'none'); },
                        'globalCardStyles.borderColor': () => { r.setProperty('--active-card-border', gCard.borderWidth > 0 && gCard.borderStyle !== 'none' ? `${gCard.borderWidth}px ${gCard.borderStyle} ${gCard.borderColor}` : 'none'); },
                        'globalCardStyles.textStrokeWidth': () => { r.setProperty('--g-card-text-stroke', gCard.textStrokeWidth > 0 ? `${gCard.textStrokeWidth}px ${gCard.textStrokeColor}` : '0px transparent'); },
                        'globalCardStyles.textStrokeColor': () => { r.setProperty('--g-card-text-stroke', gCard.textStrokeWidth > 0 ? `${gCard.textStrokeWidth}px ${gCard.textStrokeColor}` : '0px transparent'); },
                        'globalCardStyles.titleColor': () => { this.renderPreviewBlocks(); },
                        'globalCardStyles.titleFontSize': () => { r.setProperty('--g-card-title-font-size', gCard.titleFontSize); },
                        'globalCardStyles.contentFontSize': () => { r.setProperty('--g-card-content-font-size', gCard.contentFontSize); },

                        'personalInfo.nicknameColor': () => { this.elements.previewHeader.querySelector('#preview-nickname').style.color = info.nicknameColor; },
                        'personalInfo.subtitleColor': () => { this.elements.previewHeader.querySelector('#preview-subtitle').style.color = info.subtitleColor; },
                        'personalInfo.bioColor': () => { this.elements.previewHeader.querySelector('#preview-bio').style.color = info.bioColor; },
                        'personalInfo.tagBgColor': () => { this.elements.previewHeader.querySelectorAll('.tag-pill').forEach(el => el.style.backgroundColor = info.tagBgColor); },
                        'personalInfo.tagTextColor': () => { this.elements.previewHeader.querySelectorAll('.tag-pill').forEach(el => el.style.color = info.tagTextColor); },
                        'personalInfo.avatarBorderSize': () => { this.elements.previewHeader.querySelector('#preview-avatar').style.borderWidth = `${info.avatarBorderSize}px`; },
                        'personalInfo.avatarBorderColor': () => { this.elements.previewHeader.querySelector('#preview-avatar').style.borderColor = info.avatarBorderColor; },
                    };

                    if (directUpdateMap[keyPath]) {
                        directUpdateMap[keyPath]();
                        return;
                    }

                    const mainKey = keyPath.split('.')[0];
                    const keyParts = keyPath.split('.');

                    // 如果更新的是个人信息相关
                    if (mainKey === 'personalInfo') {
                        const subKey = keyParts[1];

                        // FIX: Add specific render paths to avoid full re-render
                        const previewAvatar = this.elements.previewHeader.querySelector('#preview-avatar');
                        switch (subKey) {
                            case 'nickname': this.elements.previewHeader.querySelector('#preview-nickname').textContent = this.state.personalInfo.nickname; break;
                            case 'subtitle': this.elements.previewHeader.querySelector('#preview-subtitle').textContent = this.state.personalInfo.subtitle; break;
                            case 'bio': this.elements.previewHeader.querySelector('#preview-bio').textContent = this.state.personalInfo.bio; break;
                            case 'avatarSize':
                        case 'avatarOffsetX':
                        case 'avatarOffsetY':
                            if (previewAvatar) {
                                const baseSize = 90;
                                const newSize = baseSize * ((info.avatarSize || 100) / 100);
                                const offsetX = info.avatarOffsetX || 0;
                                const offsetY = info.avatarOffsetY || 0;
                                previewAvatar.style.width = `${newSize}px`;
                                previewAvatar.style.height = `${newSize}px`;
                                previewAvatar.style.transform = `translateX(${offsetX}%)`;
                                const overflowAmount = (newSize * (offsetY / 100));
                                previewAvatar.style.marginTop = `-${overflowAmount}px`;
                                this.elements.previewWrapper.style.paddingTop = `${20 + (overflowAmount / 2.5)}px`;
                            }
                            break;
                            case 'avatarShape':
                                if (previewAvatar) previewAvatar.style.borderRadius = info.avatarShape;
                                break;
                            default:
                                // Only fully re-render for layout changes or tag additions/deletions
                                this.renderPersonalInfo();
                                this.renderLayerPanel();
                                if (subKey === 'tags') this.renderTagManager();
                        }
                        this.renderMobileEditPencils();
                        return;
                    }

                    // 如果更新的是页面或全局卡片样式
                    if (mainKey === 'pageStyles' || mainKey === 'globalCardStyles' || mainKey === 'globalButtonStyles' || mainKey === 'exportSettings') {
                        if (mainKey === 'globalCardStyles' || mainKey === 'globalButtonStyles') this.updateGlobalCardStyleVars();
                        if (mainKey === 'exportSettings') this.updatePreviewAspectRatio();
                        this.renderPageStyles();
                        this.renderPreviewBlocks();
                        if (this.selection.type === 'global') this.syncAllControls();
                        return;
                    }

                    // 如果更新的是区块或卡片
                    if (mainKey === 'blocks') {
                        if (keyParts.length <= 2) {
                            this.renderLayerPanel();
                            this.renderPreviewBlocks();
                            return;
                        }

                        const blockIndex = parseInt(keyParts[1], 10);
                        const block = this.state.blocks[blockIndex];
                        if (!block) return;

                        const updatedProperty = keyParts[2];

                        if (updatedProperty === 'title') {
                            const layerItem = this.elements.layerList.querySelector(`.layer-item[data-id="${block.id}"] .layer-name`);
                            if (layerItem) layerItem.textContent = block.title;
                            return;
                        }

                        if (updatedProperty === 'isVisible' || updatedProperty === 'settings' || updatedProperty === 'isExpanded') {
                            this.renderPreviewBlockById(block.id);
                            const layerItemContainer = this.elements.layerList.querySelector(`.layer-item-container[data-block-id="${block.id}"]`);
                            if (layerItemContainer) {
                                layerItemContainer.querySelector('.layer-item').classList.toggle('is-hidden', block.isVisible === false);
                                const eyeIcon = layerItemContainer.querySelector('.toggle-visibility-btn .iconify');
                                if (eyeIcon) eyeIcon.dataset.icon = block.isVisible === false ? 'mdi:eye-off' : 'mdi:eye';
                                layerItemContainer.classList.toggle('is-expanded', block.isExpanded === true);
                            }
                            return;
                        }

                        if (updatedProperty === 'cards') {
                            if (keyParts.length <= 4) {
                                this.renderLayerPanel();
                                this.renderPreviewBlockById(block.id);
                                return;
                            }

                            const cardIndex = parseInt(keyParts[3], 10);
                            const cardProp = keyParts[4];
                            const card = block.cards[cardIndex];
                            if (!card) return;
                            
                            // OPTIMIZATION: More granular rendering
                            if (['title', 'content', 'icon', 'text', 'bgColor', 'textColor'].includes(cardProp)) {
                                this.renderPreviewCardById(block.id, card.id);
                                if (cardProp === 'title' || cardProp === 'text') {
                                    this.renderLayerPanel();
                                }
                            } else {
                                this.renderPreviewBlockById(block.id);
                            }
                            return;
                        }
                    }
                },

                /**
                 * @description 向指定区块添加一个新卡片。
                 * @param {string} blockId - 目标区块的ID。
                 * @param {boolean} isQuickAdd - 是否是通过图层面板的快捷按钮添加。
                 */
                addCard(blockId, isQuickAdd = false) {
                    const block = this.findBlock(blockId);
                    if (!block || block.type !== 'text') return;

                    const newCard = { id: this.generateId('c'), icon: '', title: `新卡片`, content: '点击编辑内容', opacity: 1.0, followGlobalOpacity: true, textShadowEnabled: false, titleColor: null, titleFontSize: null, contentFontSize: null };

                    this.pushHistory('添加卡片');
                    block.cards.push(newCard);
                    this.debouncedSaveToLocal();

                    if (isQuickAdd) {
                        const cardListEl = this.elements.layerList.querySelector(`.layer-item-container[data-block-id="${blockId}"] .card-layer-list`);
                        if (cardListEl) {
                            const newCardLayerItem = document.createElement('li');
                            newCardLayerItem.className = 'card-layer-item';
                            newCardLayerItem.dataset.cardId = newCard.id;
                            newCardLayerItem.textContent = newCard.title || '无标题卡片';
                            cardListEl.appendChild(newCardLayerItem);
                            this.toggleLayerExpansion(blockId, true);
                        }
                    } else {
                        this.renderLayerPanel();
                    }

                    this.renderInspector();

                    const container = this.elements.previewBlocksContainer.querySelector(`[data-block-id="${blockId}"] > div`);
                    if (!container) {
                        this.renderPreviewBlockById(blockId);
                        return;
                    };

                    // 动态添加新卡片到预览区并播放动画
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.createPreviewCardHTML(newCard);
                    const newCardEl = tempDiv.firstChild;
                    this.applyCardStyles(newCardEl, newCard);
                    container.appendChild(newCardEl);

                    const masonry = this.masonryInstances[blockId];
                    if (masonry) {
                        masonry.appended(newCardEl);
                        masonry.layout();
                    }

                    newCardEl.classList.add('adding');
                    newCardEl.addEventListener('animationend', () => newCardEl.classList.remove('adding'), { once: true });

                    const newCardEditorEl = this.elements.inspectorPanel.querySelector(`.editor-card[data-card-id="${newCard.id}"]`);
                    if (newCardEditorEl) {
                        newCardEditorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },

                // NEW: Add Button Card
                addButtonCard(blockId, isQuickAdd = false) {
                    const block = this.findBlock(blockId);
                    if (!block || block.type !== 'button') return;

                    const newButton = { id: this.generateId('c'), icon: '', text: '新按钮' };

                    this.pushHistory('添加按钮');
                    block.cards.push(newButton);
                    this.debouncedSaveToLocal();

                    this.renderLayerPanel();
                    this.renderInspector();
                    this.renderPreviewBlockById(blockId);

                    if (isQuickAdd) {
                        this.toggleLayerExpansion(blockId, true);
                    }

                    const newButtonEditorEl = this.elements.inspectorPanel.querySelector(`.editor-card[data-card-id="${newButton.id}"]`);
                    if (newButtonEditorEl) {
                        newButtonEditorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },

                /**
                 * @description 触发图片上传流程以添加图片卡片。
                 * @param {string} blockId - 目标区块的ID。
                 */
                addImageCard(blockId) {
                    const blockEl = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${blockId}"]`);
                    if (blockEl) {
                        blockEl.querySelector('.image-upload-input').click();
                    }
                },

                /**
                 * @description 从指定区块中删除一个卡片。
                 * @param {string} blockId - 目标区块的ID。
                 * @param {string} cardId - 目标卡片的ID。
                 */
                // MODIFIED: Simplified and more robust deleteCard function
                async deleteCard(blockId, cardId) {
                    const block = this.findBlock(blockId);
                    if (!block) return;

                    const confirmed = await this.showConfirm('确认删除', '确定要删除这个项目吗？');
                    if (!confirmed) return;

                    //  删除卡片前，先清理其可能引用的图片资源
                    const cardToDelete = block.cards.find(c => c.id === cardId);
                    if (cardToDelete) {
                        await this.deleteImageByUrl(cardToDelete.url);
                        await this.deleteImageByUrl(cardToDelete.bgImageDataUrl);
                    }

                    this.pushHistory('删除卡片/按钮');
                    block.cards = block.cards.filter(c => c.id !== cardId);
                    this.debouncedSaveToLocal();

                    // 如果当前选中的就是这个被删除的卡片，则切换回选择区块
                    if (this.selection.cardId === cardId) {
                        this.setSelection({ type: 'block', id: blockId });
                    } else {
                        // 否则，仅重新渲染检查器以移除卡片编辑器
                        this.renderInspector();
                    }

                    // 重新渲染图层和预览区
                    this.renderLayerPanel();
                    this.renderPreviewBlockById(blockId);

                    this.showToast('项目已删除', 'info');
                },

                /**
                 * @description 从本地存储 (localStorage 和 IndexedDB) 加载应用状态。
                 */
                async loadFromLocal() {
                    const json = localStorage.getItem('blokkoState');
                    if (!json) {
                        await this.loadFontsFromDB();
                        return;
                    };
                    try {
                        let saved = JSON.parse(json);
                        if (saved && saved.personalInfo) {
                            // 迁移旧版 (v1.6.0之前) 的 base64 图片数据到 IndexedDB
                            saved = await this.processStateForImageMigration(saved);

                            // 迁移旧版标签数据格式
                            if (typeof saved.personalInfo.tags === 'string') {
                                saved.personalInfo.tags = saved.personalInfo.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
                                    .map(text => ({ id: this.generateId('t'), icon: null, text }));
                                this.showToast('旧版配置已加载，标签数据已自动转换。', 'info');
                            }

                            // 迁移旧版图片区块数据格式
                            let migrated = false;
                            saved.blocks.forEach(block => {
                                if (block.type === 'image' && block.images && !block.cards) {
                                    block.cards = block.images.map(img => ({ ...img, id: this.generateId('ic') }));
                                    delete block.images;
                                    migrated = true;
                                }
                                if (block.isVisible === undefined) block.isVisible = true;
                                if (block.isExpanded === undefined) block.isExpanded = false;
                            });
                            if (migrated) this.showToast('旧版图片区块已自动升级', 'info');

                            // 合并加载的数据和默认状态，以兼容未来新增的配置项
                            const defaultState = this.getDefaultState();
                            this.state = this.mergeDeep(defaultState, saved);

                            // 迁移旧版 (localStorage) 字体数据到 IndexedDB
                            if (saved.uploadedFonts) {
                                for (const font of saved.uploadedFonts) {
                                    if (font.data) {
                                        try {
                                            const fontBuffer = this.base64ToArrayBuffer(font.data);
                                            await this.saveFontToDB({ family: font.family, fullName: font.fullName, data: fontBuffer });
                                        } catch (e) { console.error("从localStorage迁移字体失败:", e) }
                                    }
                                }
                                delete this.state.uploadedFonts;
                                this.saveToLocal();
                            }
                        }
                    } catch (e) {
                        localStorage.removeItem('blokkoState');
                        this.showFatalErrorModal('加载存档失败', '您的本地存档可能已损坏，已为您加载默认模板。错误信息: ' + e.message);
                        console.error("从 localStorage 加载状态失败:", e);
                    } finally {
                        await this.loadFontsFromDB();
                        this.hideLoading();
                    }
                },

                /**
                 * @description 深层合并两个对象。
                 * @param {object} target - 目标对象。
                 * @param {object} source - 源对象。
                 * @returns {object} - 合并后的新对象。
                 */
                mergeDeep(target, source) {
                    const isObject = (obj) => obj && typeof obj === 'object';
                    let output = { ...target };
                    if (isObject(target) && isObject(source)) {
                        Object.keys(source).forEach(key => {
                            if (isObject(source[key])) {
                                if (!(key in target)) {
                                    Object.assign(output, { [key]: source[key] });
                                } else if (Array.isArray(source[key])) {
                                    output[key] = source[key];
                                } else {
                                    output[key] = this.mergeDeep(target[key], source[key]);
                                }
                            } else {
                                Object.assign(output, { [key]: source[key] });
                            }
                        });
                    }
                    return output;
                },

                syncControl(keyPath) {
                    this.isRestoringState = true;
                    try {
                        const inputs = this.elements.inspectorPanel.querySelectorAll(`[data-state-key="${keyPath}"], [data-setting-key="${keyPath.split('.').slice(2).join('.')}"]`);
                        if (inputs.length === 0) return;

                        const value = keyPath.split('.').reduce((o, k) => o && o[k], this.state);

                        inputs.forEach(input => {
                            if (input.type === 'radio') {
                                input.checked = (input.value == value);
                            } else if (input.type === 'checkbox') {
                                input.checked = !!value;
                            } else {
                                input.value = value ?? '';
                            }

                            if (input.type === 'range') {
                                const valueDisplay = input.closest('.form-group').querySelector('.angle-value, .spacer-height-value, #gCardRadiusValue, .avatar-size-value, .avatar-offsetY-value, .header-radius-value, .shadow-blur-value, .shadow-offset-value');
                                if (valueDisplay) valueDisplay.textContent = value;
                            }
                        });
                    } catch (e) {
                        console.error(`同步控件 ${keyPath} 时出错:`, e);
                    } finally {
                        this.isRestoringState = false;
                    }
                },

                syncAllControls() {
                    this.isRestoringState = true;
                    try {
                        this.elements.inspectorPanel.querySelectorAll('[data-state-key], [data-setting-key]').forEach(input => {
                            try {
                                const stateKey = input.dataset.stateKey;
                                const settingKey = input.dataset.settingKey;
                                let value;

                                if (stateKey) {
                                    if (stateKey === 'personalInfo.tags') return;
                                    value = stateKey.split('.').reduce((o, k) => o && o[k], this.state);
                                } else if (settingKey && this.selection.type === 'block') {
                                    const block = this.findBlock(this.selection.id);
                                    if (block) value = block.settings[settingKey];
                                }

                                if (value !== undefined) {
                                    if (input.type === 'radio') {
                                        input.checked = (input.value == value);
                                    } else if (input.type === 'checkbox') {
                                        input.checked = !!value;
                                    } else if (input.matches('textarea[data-card-key="content"]')) {
                                        input.value = (value || '').replace(/<[^>]*>?/gm, '');
                                    }
                                    else {
                                        input.value = value ?? '';
                                    }

                                    if (input.type === 'color') {
                                        const hexInput = input.nextElementSibling;
                                        if (hexInput && hexInput.matches('.color-hex-input')) {
                                            hexInput.value = value || (input.placeholder || '');
                                        }
                                    }
                                    if (input.type === 'range') {
                                        const valueDisplay = input.closest('.form-group').querySelector('.angle-value, .spacer-height-value, #gCardRadiusValue, .avatar-size-value, .avatar-offsetY-value, .header-radius-value, .shadow-blur-value, .shadow-offset-value');
                                        if (valueDisplay) valueDisplay.textContent = value;
                                    }
                                }
                            } catch (e) { }
                        });

                        // NEW: Sync attribution checkbox
                        const attrToggle = this.elements.inspectorPanel.querySelector('#export-attribution-toggle');
                        if (attrToggle) {
                            if (this.state.pageStyles.pageBgImageAttribution) {
                                attrToggle.checked = true;
                            } else {
                                attrToggle.checked = false;
                            }
                            this.updateAttributionLink();
                        }

                        const gCardSection = this.elements.inspectorPanel.querySelector('#global-card-styles-section');
                        if (gCardSection) {
                            const gCardActiveTab = this.state.globalCardStyles.bgMode === 'gradient' ? 'card-bg-gradient' : 'card-bg-solid';
                            gCardSection.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === gCardActiveTab));
                            gCardSection.querySelectorAll(':scope > .section-content > .tab-content').forEach(c => c.classList.toggle('active', c.id === gCardActiveTab));
                        }
                        
                        // NEW: Sync export dimension controls visibility
                        const customDimControls = this.elements.inspectorPanel.querySelector('#custom-dimensions-controls');
                        if(customDimControls) {
                            const customWidthToggle = this.elements.inspectorPanel.querySelector('#custom-width-toggle');
                            customDimControls.style.display = customWidthToggle.checked ? 'block' : 'none';
                        }


                        const pageSection = this.elements.inspectorPanel.querySelector('#page-styles-section');
                        if (pageSection) {
                            const pageActiveTab = this.state.pageStyles.pageBgMode === 'gradient' ? 'page-bg-gradient' : 'page-bg-solid';
                            const headerActiveTab = this.state.pageStyles.headerBgMode === 'gradient' ? 'header-bg-gradient' : 'header-bg-solid';
                            pageSection.querySelectorAll('[data-tab^="page-bg-"]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === pageActiveTab));
                            pageSection.querySelectorAll('#page-bg-solid, #page-bg-gradient').forEach(c => c.classList.toggle('active', c.id === pageActiveTab));
                            pageSection.querySelectorAll('[data-tab^="header-bg-"]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === headerActiveTab));
                            pageSection.querySelectorAll('#header-bg-solid, #header-bg-gradient').forEach(c => c.classList.toggle('active', c.id === headerActiveTab));
                        }

                        const pageImageControls = this.elements.inspectorPanel.querySelector('#page-image-controls');
                        if (pageImageControls) {
                            pageImageControls.style.display = this.state.pageStyles.pageBgImageDataUrl ? 'block' : 'none';
                        }
                        const pageTextureControls = this.elements.inspectorPanel.querySelector('#page-texture-controls');
                        if (pageTextureControls) {
                            pageTextureControls.style.display = this.state.pageStyles.pageBgPattern ? 'block' : 'none';
                            const currentTextureName = pageTextureControls.querySelector('#current-texture-name');
                            if (currentTextureName) currentTextureName.textContent = this.state.pageStyles.pageBgPattern || '无';
                        }

                    } finally {
                        this.isRestoringState = false;
                    }
                },

                findBlock(blockId) { return this.state.blocks.find(b => b.id === blockId); },
                findBlockIndex(blockId) { return this.state.blocks.findIndex(b => b.id === blockId); },
                updateBlockTitle(blockId, title, pushHistory, historyDescription) {
                    const blockIndex = this.findBlockIndex(blockId);
                    if (blockIndex > -1) this.updateState(`blocks.${blockIndex}.title`, title, pushHistory, historyDescription);
                },
                updateBlockSettings(blockId, key, value, pushHistory, historyDescription) {
                    const blockIndex = this.findBlockIndex(blockId);
                    if (blockIndex > -1) this.updateState(`blocks.${blockIndex}.settings.${key}`, value, pushHistory, historyDescription);
                },
                updateCard(blockId, cardId, key, value, pushHistory, historyDescription) {
                    const blockIndex = this.findBlockIndex(blockId);
                    if (blockIndex > -1) {
                        const cardIndex = this.state.blocks[blockIndex].cards.findIndex(c => c.id === cardId);
                        if (cardIndex > -1) this.updateState(`blocks.${blockIndex}.cards.${cardIndex}.${key}`, value, pushHistory, historyDescription);
                    }
                },

                renderPreviewBlockById(blockId) {
                    const wrapper = this.elements.previewBlocksContainer.querySelector(`.preview-block-wrapper[data-block-id="${blockId}"]`);
                    const block = this.findBlock(blockId);
                    if (block && wrapper) {
                        wrapper.classList.toggle('is-hidden', block.isVisible === false);
                        wrapper.innerHTML = this.createPreviewBlockHTML(block);
                        this.postRenderAsyncUpdates(wrapper);
                        this.initMasonryForBlock(blockId);
                    }
                    this.renderMobileEditPencils();
                },
                
                // OPTIMIZATION: More granular card rendering
                renderPreviewCardById(blockId, cardId) {
                    const block = this.findBlock(blockId);
                    const cardData = block?.cards.find(c => c.id === cardId);
                    if (!cardData) return;
                    
                    const cardEl = this.elements.previewBlocksContainer.querySelector(`[data-card-id="${cardId}"]`);
                    if (!cardEl) {
                        // Element not found, fall back to full block render
                        this.renderPreviewBlockById(blockId);
                        return;
                    }

                    if (cardEl.matches('.preview-card')) { // Handle text card
                        const titleEl = cardEl.querySelector('.preview-card-title');
                        const contentEl = cardEl.querySelector('.preview-card-content');
                        
                        if (titleEl) {
                            const iconHTML = cardData.icon ? `<span class="iconify" data-icon="${cardData.icon}"></span>` : '';
                            titleEl.innerHTML = iconHTML + this.escapeHTML(cardData.title || '');
                        }
                        if (contentEl) {
                            contentEl.innerHTML = this.sanitizeHTML(cardData.content || '');
                        }
                        this.applyCardStyles(cardEl, cardData);
                    } else if (cardEl.matches('.preview-button')) { // Handle button card
                        const textSpan = cardEl.querySelector('span[data-card-key="text"]');
                        const iconSpan = cardEl.querySelector('.iconify');
                        if(textSpan) textSpan.textContent = cardData.text || '';
                        
                        if(cardData.icon) {
                            if(iconSpan) {
                                iconSpan.dataset.icon = cardData.icon;
                            } else {
                                const newIcon = document.createElement('span');
                                newIcon.className = 'iconify';
                                newIcon.dataset.icon = cardData.icon;
                                cardEl.insertBefore(newIcon, textSpan);
                            }
                        } else if (iconSpan) {
                            iconSpan.remove();
                        }
                        // Re-apply inline styles for buttons
                        const g = this.state.globalButtonStyles;
                        const alignSelf = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' }[cardData.textAlign] || 'center';
                        cardEl.style.setProperty('--button-bg-color', cardData.bgColor || g.bgColor);
                        cardEl.style.setProperty('--button-text-color', cardData.textColor || g.textColor);
                        cardEl.style.setProperty('--button-border-radius', (cardData.radius != null ? cardData.radius : g.radius) + 'px');
                        cardEl.style.setProperty('--button-text-align', cardData.textAlign || g.textAlign);
                        cardEl.style.setProperty('--button-width', cardData.width || '100%');
                        cardEl.style.setProperty('--button-align-self', alignSelf);

                    }
                },

                // ... 历史记录 (撤销/重做) 相关函数 ...
                pushHistory(description = '操作') {
                    if (this.isRestoringState) return;
                    if (this.historyIndex < this.history.length - 1) {
                        this.history = this.history.slice(0, this.historyIndex + 1);
                    }
                    this.history.push({ state: this.deepClone(this.state), description });
                    if (this.history.length > 50) this.history.shift();
                    this.historyIndex = this.history.length - 1;
                    this.updateUndoRedoButtons();
                },
                undo() {
                    if (document.activeElement && (document.activeElement.isContentEditable || /INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
                        document.activeElement.blur();
                    }
                    if (this.historyIndex <= 0) return;

                    const actionDescription = this.history[this.historyIndex].description;

                    this.isRestoringState = true;
                    this.historyIndex--;
                    this.state = this.deepClone(this.history[this.historyIndex].state);
                    this.renderAll();
                    this.syncAllControls();
                    this.updateUndoRedoButtons();
                    this.isRestoringState = false;
                    this.showToast(`已撤销: ${actionDescription}`, 'info');
                },
                redo() {
                    if (document.activeElement && (document.activeElement.isContentEditable || /INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
                        document.activeElement.blur();
                    }
                    if (this.historyIndex >= this.history.length - 1) return;
                    this.isRestoringState = true;
                    this.historyIndex++;

                    const actionDescription = this.history[this.historyIndex].description;

                    this.state = this.deepClone(this.history[this.historyIndex].state);
                    this.renderAll();
                    this.syncAllControls();
                    this.updateUndoRedoButtons();
                    this.isRestoringState = false;
                    this.showToast(`已重做: ${actionDescription}`, 'info');
                },
                updateUndoRedoButtons() {
                    const undoBtn = this.elements.inspectorPanel.querySelector('#undo-btn');
                    const redoBtn = this.elements.inspectorPanel.querySelector('#redo-btn');
                    if (undoBtn) {
                        undoBtn.disabled = this.historyIndex <= 0;
                        if (this.historyIndex > 0) {
                            undoBtn.title = `撤销: ${this.history[this.historyIndex].description}`;
                        } else {
                            undoBtn.title = '撤销';
                        }
                    }
                    if (redoBtn) {
                        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
                        if (this.historyIndex < this.history.length - 1) {
                            redoBtn.title = `重做: ${this.history[this.historyIndex + 1].description}`;
                        } else {
                            redoBtn.title = '重做';
                        }
                    }
                },

                // ... 图片处理相关函数 ...
                async handleImageUpload(event, target, cardInfo = null) {
                    const file = event.target.files[0];
                    if (!file) return;
                    this.showLoading('正在处理图片...');

                    const objectUrl = URL.createObjectURL(file);

                    try {
                        if (target === 'colorThief') {
                            await this.loadScript('https://cdn.bootcdn.net/ajax/libs/color-thief/2.3.2/color-thief.umd.min.js');
                            this.colorThief = new ColorThief();
                            const dataUrl = await this.readFileAsDataURL(file);
                            this.analyzeColorsFromImage(dataUrl);
                            URL.revokeObjectURL(objectUrl);
                            return;
                        }

                        // 对于头像和页面背景，图片尺寸可以大一些
                        const maxDim = (target === 'pageBg') ? 1920 : 1200;
                        const compressedUrl = await this.compressImage(objectUrl, 0.9, maxDim);

                        // 显示裁剪器
                        if (['avatar', 'pageBg', 'cardBg', 'imageCard'].includes(target)) {
                            // NEW: For page background, clear attribution info
                            if (target === 'pageBg') {
                                this.updateState('pageStyles.pageBgImageAttribution', null, false);
                            }
                            this.showCropper(compressedUrl, { type: target, ...cardInfo, originalType: file.type });
                        } else {
                            this.hideLoading();
                        }
                    } catch (err) {
                        this.showErrorModal('图片处理失败', err.message);
                        this.hideLoading();
                    } finally {
                        event.target.value = '';
                    }
                },

                handleCardBgUpload(event, blockId, cardId) {
                    const card = this.findBlock(blockId)?.cards.find(c => c.id === cardId);
                    // 在上传新图前，记录旧图的URL，以便后续清理
                    this.handleImageUpload(event, 'cardBg', { blockId, cardId, oldImageUrl: card?.bgImageDataUrl });
                },

                /**
                 * @description 健壮性优化: 处理批量图片上传，即使部分失败也能继续。
                 * @param {string} blockId - 目标区块的ID。
                 * @param {FileList} files - 用户选择的文件列表。
                 */
                async handleImageGalleryUpload(blockId, files) {
                    const block = this.findBlock(blockId);
                    if (!block || !files.length) return;
                    this.showLoading(`正在上传 ${files.length} 张图片...`);

                    const successCards = [];
                    const failedFiles = [];

                    // 使用 Promise.allSettled 并行处理所有文件，收集成功和失败的结果
                    const results = await Promise.allSettled(Array.from(files).map(async file => {
                        const objectUrl = URL.createObjectURL(file);
                        const compressedUrl = await this.compressImage(objectUrl, 0.9, 1200, file.type);
                        const blob = this.dataURLToBlob(compressedUrl);
                        const imageId = this.generateId('img');
                        await this.saveImageToDB({ id: imageId, blob });
                        return { id: this.generateId('ic'), url: `idb://${imageId}`, title: '', description: '' };
                    }));

                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            successCards.push(result.value);
                        } else {
                            failedFiles.push(files[index].name);
                            console.error(`处理文件 ${files[index].name} 失败:`, result.reason);
                        }
                    });

                    if (successCards.length > 0) {
                        this.pushHistory(`添加 ${successCards.length} 张图片`);
                        block.cards.push(...successCards);
                        this.debouncedSaveToLocal();
                    }

                    this.renderInspector();
                    this.renderLayerPanel();
                    this.renderPreviewBlockById(blockId);
                    this.hideLoading();

                    if (failedFiles.length > 0) {
                        this.showErrorModal('部分图片上传失败', `以下文件未能成功上传: ${failedFiles.join(', ')}`);
                    }
                },

                // NEW: Pixabay related functions
                showPixabaySearch() {
                    this.elements.pixabaySearchModal.classList.add('visible');
                    this.elements.pixabaySearchModal.querySelector('#pixabay-search-input').focus();
                },
                async searchPixabayImages(query) {
                    const grid = this.elements.pixabaySearchModal.querySelector('#pixabay-grid');
                    if (!query.trim()) {
                        grid.innerHTML = '<p style="text-align:center; color:var(--text-placeholder);">请输入关键词搜索</p>';
                        return;
                    }
                    grid.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';

                    try {
                        const response = await fetch(`https://pixabay.com/api/?key=${this.pixabayApiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=50&safesearch=true`);
                        if (!response.ok) throw new Error(`Pixabay API error: ${response.status}`);
                        const data = await response.json();

                        if (data.hits && data.hits.length > 0) {
                            grid.innerHTML = data.hits.map(hit => `
                                <div class="pixabay-grid-item" data-image-data='${JSON.stringify(hit)}'>
                                    <img src="${hit.previewURL}" loading="lazy">
                                    <div class="photographer-info">${this.escapeHTML(hit.user)}</div>
                                </div>
                            `).join('');
                        } else {
                            grid.innerHTML = '<p style="text-align:center; color:var(--text-placeholder);">未找到匹配的图片，请尝试其他关键词</p>';
                        }
                    } catch (error) {
                        console.error('Pixabay search failed:', error);
                        grid.innerHTML = '<p style="text-align:center; color:var(--color-danger);">搜索失败，请检查网络连接或API密钥</p>';
                    }
                },
                handlePixabayImageSelection(imageData) {
                    this.showLoading('正在加载高清图片...');
                    // Store attribution info
                    const attribution = {
                        user: imageData.user,
                        pageURL: imageData.pageURL
                    };
                    this.updateState('pageStyles.pageBgImageAttribution', attribution, true);
                    // Show cropper with the selected image
                    this.showCropper(imageData.largeImageURL, { type: 'pageBg', originalType: 'image/jpeg' });
                },

                // ... 裁剪器与滤镜相关函数 ...
                async cropImage(blockId, cardId) {
                    const block = this.findBlock(blockId);
                    const card = block?.cards.find(c => c.id === cardId);
                    if (card && card.url) {
                        let imageUrl = card.url;
                        if (imageUrl.startsWith('idb://')) {
                            const record = await this.getImageFromDB(imageUrl.substring(6));
                            if (record && record.blob) {
                                imageUrl = URL.createObjectURL(record.blob);
                            }
                        }
                        this.showCropper(imageUrl, { type: 'imageCard', blockId, cardId, oldImageUrl: card.url, originalType: 'image/png' });
                    }
                },

                async showCropper(imageSrc, target) {
                    try {
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/cropperjs/1.6.1/cropper.min.js');
                    } catch (error) {
                        this.showErrorModal('加载失败', '图片裁剪功能所需组件加载失败，请检查你的网络连接。');
                        return;
                    }

                    this.currentCropTarget = target;
                    const cropperImage = this.elements.cropperImage;
                    const modal = this.elements.cropperModal;

                    if (this.cropper) {
                        this.cropper.destroy();
                        this.cropper = null;
                    }
                    cropperImage.src = '';

                    //  Reset and bind filter controls
                    this.resetAndBindFilterControls();

                    const initializeCropper = () => {
                        cropperImage.removeEventListener('load', initializeCropper);
                        cropperImage.removeEventListener('error', handleLoadError);

                        if (cropperImage.naturalWidth === 0 || cropperImage.naturalHeight === 0) {
                            handleLoadError();
                            return;
                        }

                        this.cropper = new Cropper(cropperImage, {
                            aspectRatio: NaN,
                            viewMode: 1,
                            background: false,
                            ready: () => {
                                this.hideLoading();
                                document.getElementById('filter-controls').style.display = 'block';
                                this.applyFiltersAndPreview();
                            },
                            crop: this.debounce(() => { // Debounce crop event
                                if (this.cropper && this.cropper.ready) {
                                    this.applyFiltersAndPreview();
                                }
                            }, 50)
                        });

                        const freeRatioInput = modal.querySelector('input[name="crop-ratio"][value="NaN"]');
                        if (freeRatioInput) freeRatioInput.checked = true;
                    };

                    const handleLoadError = () => {
                        cropperImage.removeEventListener('load', initializeCropper);
                        cropperImage.removeEventListener('error', handleLoadError);
                        this.showErrorModal('图片加载失败', '无法在裁剪器中加载图片，文件可能已损坏或格式不受支持。');
                        this.hideCropper();
                        this.hideLoading();
                    };

                    cropperImage.crossOrigin = "anonymous"; // IMPORTANT for online images
                    cropperImage.addEventListener('load', initializeCropper);
                    cropperImage.addEventListener('error', handleLoadError);

                    this.showLoading('正在加载图片...');
                    modal.classList.add('visible');
                    cropperImage.src = imageSrc;
                },

                hideCropper() {
                    this.elements.cropperModal.classList.remove('visible');
                    if (this.cropper) {
                        this.cropper.destroy();
                        this.cropper = null;
                    }
                    this.elements.cropperImage.src = '';
                },

                saveCrop() {
                    if (!this.cropper || !this.currentCropTarget) return;
                    this.showLoading('正在保存图片...');
                    try {
                        const { type, blockId, cardId, originalType, oldImageUrl } = this.currentCropTarget;
                        let quality = 0.9;

                        // Use the preview canvas which has filters applied
                        let finalCanvas = document.getElementById('cropper-preview-canvas');

                        if (!finalCanvas || finalCanvas.width === 0) {
                            console.warn("Preview canvas is invalid, falling back to original crop.");
                            finalCanvas = this.cropper.getCroppedCanvas();
                        }

                        finalCanvas.toBlob(async (blob) => {
                            if (!blob) {
                                this.showErrorModal('裁剪失败', '无法生成图片 Blob。');
                                this.hideLoading();
                                return;
                            }

                            const imageId = this.generateId('img');
                            await this.saveImageToDB({ id: imageId, blob: blob });
                            const idbUrl = `idb://${imageId}`;

                            await this.deleteImageByUrl(oldImageUrl);

                            this.pushHistory('裁剪与调整图片');
                            if (type === 'avatar') {
                                this.updateState('personalInfo.avatarDataUrl', idbUrl, false);
                            } else if (type === 'pageBg') {
                                this.updateState('pageStyles.pageBgImageDataUrl', idbUrl, false);
                            } else if (type === 'imageCard') {
                                this.updateCard(blockId, cardId, 'url', idbUrl, false);
                            } else if (type === 'cardBg') {
                                this.updateCard(blockId, cardId, 'bgImageDataUrl', idbUrl, false);
                            }
                            this.hideCropper();
                            this.hideLoading();

                        }, originalType || 'image/jpeg', quality);

                    } catch (err) {
                        console.error('保存裁剪失败:', err);
                        this.showErrorModal('保存裁剪失败', '处理图片时发生错误。');
                        this.hideLoading();
                    }
                },
                updateCropAspectRatio() {
                    if (this.cropper) {
                        this.cropper.setAspectRatio(parseFloat(document.querySelector('input[name="crop-ratio"]:checked').value));
                        this.applyFiltersAndPreview();
                    }
                },

                //  Filter logic
                applyFiltersAndPreview() {
                    if (!this.cropper || !this.cropper.ready) return;

                    const filters = {
                        brightness: document.getElementById('brightness-slider').value,
                        contrast: document.getElementById('contrast-slider').value,
                        saturate: document.getElementById('saturation-slider').value,
                        grayscale: document.getElementById('grayscale-slider').value,
                        sepia: document.getElementById('sepia-slider').value,
                        blur: document.getElementById('blur-slider').value,
                    };
                    this.currentFilterState = filters;

                    const sourceCanvas = this.cropper.getCroppedCanvas();
                    const previewCanvas = document.getElementById('cropper-preview-canvas');
                    const ctx = previewCanvas.getContext('2d');

                    previewCanvas.width = sourceCanvas.width;
                    previewCanvas.height = sourceCanvas.height;

                    ctx.filter = `
                        brightness(${filters.brightness}%) 
                        contrast(${filters.contrast}%) 
                        saturate(${filters.saturate}%) 
                        grayscale(${filters.grayscale}%) 
                        sepia(${filters.sepia}%) 
                        blur(${filters.blur}px)
                    `.trim();

                    ctx.drawImage(sourceCanvas, 0, 0);
                },

                resetAndBindFilterControls() {
                    const sliders = {
                        'brightness': { slider: 'brightness-slider', value: 'brightness-value', default: 100 },
                        'contrast': { slider: 'contrast-slider', value: 'contrast-value', default: 100 },
                        'saturation': { slider: 'saturation-slider', value: 'saturation-value', default: 100 },
                        'grayscale': { slider: 'grayscale-slider', value: 'grayscale-value', default: 0 },
                        'sepia': { slider: 'sepia-slider', value: 'sepia-value', default: 0 },
                        'blur': { slider: 'blur-slider', value: 'blur-value', default: 0 }
                    };

                    const handler = this.debounce(() => this.applyFiltersAndPreview(), 20);

                    for (const key in sliders) {
                        const config = sliders[key];
                        const sliderEl = document.getElementById(config.slider);
                        const valueEl = document.getElementById(config.value);

                        sliderEl.value = config.default;
                        valueEl.textContent = config.default;

                        // Remove old listener before adding new one
                        sliderEl.replaceWith(sliderEl.cloneNode(true));
                        document.getElementById(config.slider).addEventListener('input', (e) => {
                            valueEl.textContent = e.target.value;
                            handler();
                        });
                    }
                    document.getElementById('filter-controls').style.display = 'none';
                },

                // ... 富文本编辑器相关函数 ...
                /**
                 * @description 显示富文本编辑器模态框。
                 * @param {HTMLElement} targetElement - 触发编辑的预览区内容元素。
                 */
                showRichTextEditor(targetElement) {
                    if (!targetElement) return;

                    const cardEl = targetElement.closest('.preview-card');
                    const blockEl = targetElement.closest('.preview-block-wrapper');
                    if (!cardEl || !blockEl) return;

                    this.currentRichTextTarget = {
                        blockId: blockEl.dataset.blockId,
                        cardId: cardEl.dataset.cardId,
                        element: targetElement
                    };

                    const block = this.findBlock(this.currentRichTextTarget.blockId);
                    const card = block.cards.find(c => c.id === this.currentRichTextTarget.cardId);

                    const container = this.elements.richTextEditorContainer;
                    const parent = container.parentElement; // 获取父容器 (modal-container)

                    // 1寻找并移除旧的工具栏
                    const oldToolbar = parent.querySelector('.ql-toolbar');
                    if (oldToolbar) {
                        oldToolbar.remove();
                    }

                    // 清空编辑器容器并重置实例
                    container.innerHTML = ''; // 使用 innerHTML = '' 更简洁
                    this.richTextEditor = null;

                    const isMobile = window.innerWidth <= 768;
                    let quillOptions;

                    if (isMobile) {
                        quillOptions = {
                            theme: 'bubble',
                            modules: {
                                toolbar: [
                                    ['bold', 'italic', 'underline', 'strike'], ['link'],
                                    [{ 'color': [] }, { 'background': [] }],
                                    [{ 'header': 1 }, { 'header': 2 }],
                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                    ['clean']
                                ]
                            },
                        };
                    } else {
                        quillOptions = {
                            theme: 'snow',
                            modules: {
                                toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline', 'strike'], ['link'],
                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                    [{ 'color': [] }, { 'background': [] }],
                                    ['clean']
                                ]
                            },
                        };
                    }

                    this.richTextEditor = new Quill(container, quillOptions);

                    this.richTextEditor.root.innerHTML = card.content || '';

                    this.elements.richTextEditorModal.classList.add('visible');
                    this.richTextEditor.focus();
                },

                hideRichTextEditor() {
                    this.elements.richTextEditorModal.classList.remove('visible');
                    this.currentRichTextTarget = null;
                },

                saveRichText() {
                    if (!this.richTextEditor || !this.currentRichTextTarget) return;

                    const { blockId, cardId } = this.currentRichTextTarget;
                    const newContent = this.richTextEditor.root.innerHTML;

                    this.updateCard(blockId, cardId, 'content', newContent, true, '编辑卡片内容');
                    this.hideRichTextEditor();
                    this.showToast('内容已保存', 'success');
                },

                async loadLocalFonts() {
                    if (!window.queryLocalFonts) {
                        this.showErrorModal('功能不支持', '您的浏览器不支持访问本地字体。请尝试使用“上传字体”功能。');
                        return;
                    }
                    try {
                        this.showLoading('正在加载本地字体...');
                        const fonts = await window.queryLocalFonts();
                        this.localFonts = fonts.map(font => ({ family: font.family, fullName: font.fullName, type: 'local' }));
                        this.populateFontList();
                        this.showToast(`加载了 ${this.localFonts.length} 个本地字体`, 'success');
                    } catch (err) {
                        console.error('无法访问本地字体:', err);
                        this.showErrorModal('加载本地字体失败', '这是一个实验性的浏览器功能，可能因安全设置或浏览器版本而不稳定。如果持续失败，建议使用“上传字体”功能。');
                    } finally {
                        this.hideLoading();
                    }
                },
                async handleFontUpload(event) {
                    const files = event.target.files;
                    if (!files.length) return;
                    this.showLoading(`正在上传 ${files.length} 个字体...`);

                    let successCount = 0;
                    let lastUploadedFontFamily = null;

                    for (const file of files) {
                        try {
                            const fontData = await this.readFileAsArrayBuffer(file);
                            const fontName = file.name.replace(/\.[^/.]+$/, "");
                            if (this.uploadedFonts.some(f => f.family === fontName) || this.localFonts.some(f => f.family === fontName)) {
                                console.warn(`字体 "${fontName}" 已存在，跳过。`);
                                continue;
                            }

                            await this.saveFontToDB({ family: fontName, fullName: `${fontName} (上传)`, data: fontData });

                            const fontFace = new FontFace(fontName, fontData.slice(0));
                            await fontFace.load();
                            document.fonts.add(fontFace);

                            this.uploadedFonts.push({ family: fontName, fullName: `${fontName} (上传)`, type: 'uploaded' });
                            lastUploadedFontFamily = fontName;
                            successCount++;

                        } catch (error) {
                            console.error(`字体 "${file.name}" 上传失败:`, error);
                            this.showErrorModal(`字体 "${file.name}" 上传失败`, '字体文件无效或加载失败。');
                        }
                    }

                    event.target.value = '';
                    this.hideLoading();

                    if (successCount > 0) {
                        this.populateFontList();
                        if (lastUploadedFontFamily) {
                            this.updateState('globalCardStyles.fontFamily', lastUploadedFontFamily, true, `上传 ${successCount} 个字体`);
                        }
                        this.showToast(`${successCount} 个字体上传成功！`, 'success');
                    }
                },

                populateFontList(searchTerm = '') {
                    const select = this.elements.inspectorPanel.querySelector('#font-family-select');
                    if (!select) return;
                    const currentFont = this.state.globalCardStyles.fontFamily;
                    select.innerHTML = '';

                    const recommendedFonts = [
                        { family: 'Noto Sans CJK', fullName: '思源黑体' },
                        { family: 'Noto Serif CJK', fullName: '思源宋体' },
                        { family: 'HappyZcool-2016', fullName: '站酷快乐体' },
                        { family: 'ZCOOL XiaoWei', fullName: '站酷小薇体' },
                        { family: 'LXGW WenKai', fullName: '霞鹜文楷' },
                    ];

                    const allFonts = [...this.uploadedFonts, ...this.localFonts];
                    const categories = { cjk: [], sans: [], serif: [], uploaded: [], other: [] };

                    const filteredFonts = searchTerm
                        ? allFonts.filter(font =>
                            font.family.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            font.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
                        : allFonts;

                    filteredFonts.forEach(font => {
                        if (recommendedFonts.some(rf => rf.family === font.family)) return;
                        const category = this.getFontCategory(font);
                        if (!categories[category].some(f => f.family === font.family)) {
                            categories[category].push(font);
                        }
                    });

                    const requiredFonts = this.getAllRequiredFonts();
                    requiredFonts.forEach(reqFont => {
                        if (!allFonts.some(f => f.family === reqFont) && !recommendedFonts.some(rf => rf.family === reqFont)) {
                            const placeholderFont = { family: reqFont, fullName: `${reqFont} (需要重新上传)`, type: 'uploaded', missing: true };
                            if (!categories.uploaded.some(f => f.family === reqFont)) {
                                categories.uploaded.push(placeholderFont);
                            }
                        }
                    });

                    const createOptgroup = (label, fonts) => {
                        if (fonts.length === 0) return '';
                        const options = fonts
                            .sort((a, b) => a.fullName.localeCompare(b.fullName))
                            .map(f => `<option value="${this.escapeHTML(f.family)}" style="font-family: '${this.escapeHTML(f.family)}', sans-serif;" ${f.missing ? 'disabled' : ''}>${this.escapeHTML(f.fullName)}</option>`)
                            .join('');
                        return `<optgroup label="${label}">${options}</optgroup>`;
                    };

                    let html = '<option value="">系统默认</option>';
                    html += createOptgroup('推荐字体', recommendedFonts);
                    html += createOptgroup('已上传字体', categories.uploaded);
                    html += createOptgroup('中文 / CJK', categories.cjk);
                    html += createOptgroup('无衬线 (Sans-serif)', categories.sans);
                    html += createOptgroup('衬线 (Serif)', categories.serif);
                    html += createOptgroup('其他', categories.other);

                    select.innerHTML = html;
                    select.value = currentFont;
                },

                getFontCategory(font) {
                    if (font.type === 'uploaded') return 'uploaded';
                    const name = (font.family + font.fullName).toLowerCase();
                    if (/(hei|song|ming|gothic|kai|fang|yuan|deng|黑|宋|明|ゴシック|楷|圓)/.test(name) || /[\u4e00-\u9fa5]/.test(name)) {
                        return 'cjk';
                    }
                    if (name.includes('serif')) return 'serif';
                    if (name.includes('sans')) return 'sans';
                    return 'other';
                },
                getAllRequiredFonts() {
                    const fonts = new Set();
                    if (this.state.globalCardStyles.fontFamily) {
                        fonts.add(this.state.globalCardStyles.fontFamily);
                    }
                    return Array.from(fonts);
                },

                applyPreset(preset) {
                    this.pushHistory('应用预设主题');

                    this.state.pageStyles.pageBgSolidColor = preset.pageBgSolidColor;
                    this.state.pageStyles.pageBgGradientStart = preset.pageBgGradientStart;
                    this.state.pageStyles.pageBgGradientEnd = preset.pageBgGradientEnd;

                    this.state.pageStyles.headerBgColor = preset.headerBgColor;
                    this.state.pageStyles.headerBgGradientStart = preset.headerBgGradientStart;
                    this.state.pageStyles.headerBgGradientEnd = preset.headerBgGradientEnd;
                    this.state.pageStyles.headerTextColor = preset.headerTextColor;

                    this.state.globalCardStyles.bgColor = preset.gCardBgColor;
                    this.state.globalCardStyles.bgGradientStart = preset.gCardBgGradientStart;
                    this.state.globalCardStyles.bgGradientEnd = preset.gCardBgGradientEnd;
                    this.state.globalCardStyles.textColor = preset.gCardTextColor;
                    this.state.globalCardStyles.opacity = preset.gCardOpacity;

                    this.state.personalInfo.nicknameColor = preset.pNicknameColor;
                    this.state.personalInfo.subtitleColor = preset.pSubtitleColor;
                    this.state.personalInfo.bioColor = preset.pBioColor;
                    this.state.personalInfo.tagBgColor = preset.pTagBgColor;
                    this.state.personalInfo.tagTextColor = preset.pTagTextColor;

                    this.state.pageStyles.pageBgMode = 'solid';
                    this.state.pageStyles.headerBgMode = 'solid';
                    this.state.globalCardStyles.bgMode = 'solid';

                    this.debouncedSaveToLocal();
                    this.renderAll();
                    this.syncAllControls();
                    this.showToast('预设已应用', 'success');
                },

                // ... 文件读写与格式转换工具函数 ...
                readFileAsDataURL(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    })
                },
                readFileAsArrayBuffer(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(file);
                    })
                },
                compressImage(imageUrl, quality = 0.9, maxWidth = 1024, originalType = 'image/jpeg') {
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        img.crossOrigin = "Anonymous"; // IMPORTANT for online images
                        img.onload = () => {
                            let { width, height } = img;
                            if (width > maxWidth) {
                                height = (maxWidth / width) * height;
                                width = maxWidth;
                            }
                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);

                            if (imageUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(imageUrl);
                            }

                            const outputType = originalType === 'image/png' ? 'image/png' : 'image/jpeg';
                            resolve(canvas.toDataURL(outputType, quality));
                        };
                        img.onerror = (err) => {
                            if (imageUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(imageUrl);
                            }
                            reject(new Error('图片加载失败，请检查文件是否损坏或是否跨域。'));
                        };
                        img.src = imageUrl;
                    })
                },

                // ... UI 状态切换函数 ...
                toggleTheme() {
                    const isDark = document.documentElement.classList.toggle('dark-mode');
                    localStorage.setItem('blokkoTheme', isDark ? 'dark' : 'light');
                    this.elements.themeToggleBtn.textContent = isDark ? '暗黑模式' : '明亮模式';
                },
                loadPreferences() {
                    const isDark = localStorage.getItem('blokkoTheme') === 'dark';
                    if (isDark) {
                        document.documentElement.classList.add('dark-mode');
                    }
                    this.elements.themeToggleBtn.textContent = isDark ? '暗黑模式' : '明亮模式';
                },
                saveToLocal() {
                    try {
                        const stateToSave = this.deepClone(this.state);
                        // 不将字体数据存入 localStorage
                        delete stateToSave.uploadedFonts;
                        localStorage.setItem('blokkoState', JSON.stringify(stateToSave));
                        if (this.isStorageFull) {
                            this.isStorageFull = false;
                            this.removeStorageFullToast();
                        }
                    } catch (e) {
                        console.error("保存到 localStorage 失败:", e);
                        if (e.name === 'QuotaExceededError') {
                            this.isStorageFull = true;
                            this.showStorageFullToast();
                        }
                    }
                },

                // ... 导入/导出相关函数 ...
                generateFilename(type) {
                    const nickname = (this.state.personalInfo.nickname || '').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').substring(0, 15) || 'Blokko';
                    const date = new Date();
                    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
                    const randomString = Math.random().toString(36).substring(2, 8);
                    return `${nickname}-${dateString}-${type}-${randomString}`;
                },

                exportConfig(isTemplate = false) {
                    let stateToSave = this.deepClone(this.state);

                    if (isTemplate) {
                        stateToSave.personalInfo.nickname = "你的昵称";
                        stateToSave.personalInfo.subtitle = "这是副标题";
                        stateToSave.personalInfo.bio = "这是简介";
                        stateToSave.personalInfo.tags = this.getDefaultState().personalInfo.tags;
                        stateToSave.personalInfo.avatarDataUrl = this.getDefaultState().personalInfo.avatarDataUrl;
                        stateToSave.pageStyles.pageBgImageDataUrl = null;
                        stateToSave.pageStyles.pageBgPattern = '';
                        stateToSave.customIcons = [];

                        stateToSave.blocks.forEach(block => {
                            if (block.type === 'text' || block.type === 'image' || block.type === 'button') {
                                block.title = block.type === 'text' ? "文本区块" : (block.type === 'image' ? "图片区块" : "按钮区块");
                                block.cards.forEach(card => {
                                    if (block.type === 'text') {
                                        card.title = "卡片标题";
                                        card.content = "卡片内容";
                                        card.bgImageDataUrl = null;
                                    } else if (block.type === 'button') {
                                        card.text = "按钮文字";
                                    }
                                });
                                if (block.type === 'image') block.cards = [];
                            }
                        });
                        this.showToast('模板已导出', 'success');
                    } else {
                        stateToSave.customIcons = this.state.customIcons;
                        this.showToast('配置已导出', 'success');
                    }

                    const blob = new Blob([JSON.stringify(stateToSave, null, 2)], { type: 'application/json' });
                    const filename = this.generateFilename(isTemplate ? 'Template' : 'Config') + '.json';
                    this.showDownloadModal(URL.createObjectURL(blob), filename, isTemplate ? '模板已生成' : '配置已生成');
                },

                async exportEnhancedPackage() {
                    try {
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js');
                    } catch (e) {
                        this.showErrorModal('导出失败', 'JSZip 库未能加载，请检查网络连接或刷新页面后重试。');
                        return;
                    }

                    this.showLoading('正在打包 .zip 文件...');
                    try {
                        const zip = new JSZip();
                        const stateClone = this.deepClone(this.state);
                        const imageMap = new Map();

                        const processObject = async (obj) => {
                            for (const key in obj) {
                                if (typeof obj[key] === 'string' && obj[key].startsWith('idb://')) {
                                    const imageId = obj[key].substring(6);
                                    if (imageMap.has(imageId)) {
                                        obj[key] = imageMap.get(imageId).path;
                                    } else {
                                        const record = await this.getImageFromDB(imageId);
                                        if (record && record.blob) {
                                            const fileExtension = record.blob.type.split('/')[1] || 'png';
                                            const filename = `img-${this.generateId('p')}.${fileExtension}`;
                                            const path = `images/${filename}`;
                                            zip.file(path, record.blob);
                                            imageMap.set(imageId, { path });
                                            obj[key] = path;
                                        }
                                    }
                                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                    await processObject(obj[key]);
                                }
                            }
                        };

                        await processObject(stateClone);

                        zip.file("config.json", JSON.stringify(stateClone, null, 2));
                        zip.file("readme.txt", `Blokko 强化导出备份\n版本: 1.7.0\n导出时间: ${new Date().toLocaleString()}\n\n此 .zip 文件包含了您的配置文件 (config.json) 和所有图片资源 (images/ 文件夹)。`);

                        const blob = await zip.generateAsync({ type: "blob" });
                        const filename = this.generateFilename('Enhanced-Backup') + '.zip';
                        this.showDownloadModal(URL.createObjectURL(blob), filename, '强化导出包已生成');
                        this.showToast('强化导出成功！', 'success');
                    } catch (error) {
                        this.showErrorModal('强化导出失败', `打包 .zip 文件时出错: ${error.message}`);
                    } finally {
                        this.hideLoading();
                    }
                },

                async exportLegacyConfig() {
                    const confirmed = await this.showConfirm(
                        '⚠️ 性能警告：不推荐的操作',
                        '“过时导出”会将所有图片数据直接写入一个巨大的JSON文件。如果您的图片较多或较大，此操作极有可能导致浏览器卡死甚至崩溃。强烈推荐使用“强化导出(.zip)”。您真的确定要继续吗？'
                    );

                    if (!confirmed) return;

                    this.showLoading('正在生成过时配置文件(可能需要很长时间)...');
                    try {
                        const stateClone = this.deepClone(this.state);

                        const processObject = async (obj) => {
                            for (const key in obj) {
                                if (typeof obj[key] === 'string' && obj[key].startsWith('idb://')) {
                                    const imageId = obj[key].substring(6);
                                    const record = await this.getImageFromDB(imageId);
                                    if (record && record.blob) {
                                        obj[key] = await this.blobToDataURL(record.blob);
                                    }
                                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                    await processObject(obj[key]);
                                }
                            }
                        };

                        await processObject(stateClone);

                        const jsonString = JSON.stringify(stateClone, null, 2);
                        const blob = new Blob([jsonString], { type: 'application/json' });
                        const filename = this.generateFilename('Legacy-Config') + '.json';
                        this.showDownloadModal(URL.createObjectURL(blob), filename, '过时配置文件已生成');
                        this.showToast('过时导出成功！', 'success');

                    } catch (error) {
                        this.showErrorModal('过时导出失败', `处理数据时出错: ${error.message}`);
                    } finally {
                        this.hideLoading();
                    }
                },

                async handleZipImport(file) {
                    try {
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js');
                    } catch (e) {
                        this.showErrorModal('导入失败', '必需的 JSZip 库未能加载，请检查网络或刷新页面后重试。');
                        return;
                    }

                    this.showLoading('正在解压并导入 .zip...');
                    try {
                        const zip = await JSZip.loadAsync(file);
                        const configFile = zip.file("config.json");
                        if (!configFile) {
                            throw new Error("压缩包中未找到 config.json 文件。");
                        }
                        const configContent = await configFile.async("string");
                        let importedState = JSON.parse(configContent);
                        if (!importedState || !importedState.personalInfo) throw new Error('无效的 config.json 格式');

                        const processObject = async (obj) => {
                            for (const key in obj) {
                                if (typeof obj[key] === 'string' && obj[key].startsWith('images/')) {
                                    const imagePath = obj[key];
                                    const imageFile = zip.file(imagePath);
                                    if (imageFile) {
                                        const blob = await imageFile.async("blob");
                                        const imageId = this.generateId('img');
                                        await this.saveImageToDB({ id: imageId, blob: blob });
                                        obj[key] = `idb://${imageId}`;
                                    } else {
                                        obj[key] = null;
                                    }
                                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                    await processObject(obj[key]);
                                }
                            }
                        };

                        this.showLoading('正在导入图片资源...');
                        await processObject(importedState);

                        this.state = this.mergeDeep(this.getDefaultState(), importedState);
                        // 导入成功后立即保存
                        localStorage.setItem('blokkoState', JSON.stringify(this.state));

                        this.history = [{ state: this.deepClone(this.state), description: '导入ZIP配置' }];
                        this.historyIndex = 0;
                        this.setSelection({ type: 'global' });
                        this.renderAll(true);
                        this.syncAllControls();
                        this.populateFontList();
                        this.initAllSortables();
                        this.updateExportSizePreview();
                        this.showToast('ZIP 包导入成功！', 'success');

                    } catch (err) {
                        this.showErrorModal('ZIP 导入失败', `处理文件时出错: ${err.message}`);
                        console.error(err);
                    } finally {
                        this.hideLoading();
                    }
                },

                async handleConfigFile(e) {
                    const file = e.target.files[0];
                    if (!file) return;

                    const confirmed = await this.showConfirm('导入配置', '此操作将覆盖当前所有内容（字体除外），确定要继续吗？');
                    if (!confirmed) {
                        e.target.value = '';
                        return;
                    }

                    if (file.name.toLowerCase().endsWith('.zip')) {
                        await this.handleZipImport(file);
                        e.target.value = '';
                        return;
                    }

                    this.showLoading('正在导入配置...');
                    await this.sleep(100);

                    const reader = new FileReader();
                    reader.onload = async (re) => {
                        try {
                            let importedState = JSON.parse(re.target.result);
                            if (!importedState || !importedState.personalInfo || !importedState.blocks) throw new Error('无效的文件格式');

                            importedState = await this.processStateForImageMigration(importedState);

                            if (typeof importedState.personalInfo.tags === 'string') {
                                importedState.personalInfo.tags = importedState.personalInfo.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
                                    .map(text => ({ id: this.generateId('t'), icon: null, text }));
                                this.showToast('旧版配置已导入并自动升级。', 'info');
                            }

                            let migrated = false;
                            importedState.blocks.forEach(block => {
                                if (block.type === 'image' && block.images && !block.cards) {
                                    block.cards = block.images.map(img => ({ ...img, id: this.generateId('ic') }));
                                    delete block.images;
                                    migrated = true;
                                }
                            });
                            if (migrated) this.showToast('旧版图片区块已自动升级', 'info');

                            this.state = this.mergeDeep(this.getDefaultState(), importedState);
                            //导入成功后立即保存
                            localStorage.setItem('blokkoState', JSON.stringify(this.state));

                            if (importedState.uploadedFonts) {
                                this.showToast('检测到旧版字体数据，正在尝试迁移...', 'info');
                                for (const font of importedState.uploadedFonts) {
                                    if (font.data) {
                                        try {
                                            const fontBuffer = this.base64ToArrayBuffer(font.data);
                                            await this.saveFontToDB({ family: font.family, fullName: font.fullName, data: fontBuffer });
                                        } catch (fontError) { console.error(`迁移字体 ${font.family} 失败:`, fontError); }
                                    }
                                }
                                await this.loadFontsFromDB();
                                this.showToast('旧字体数据迁移完成！', 'success');
                            }

                            this.history = [{ state: this.deepClone(this.state), description: '导入配置' }];
                            this.historyIndex = 0;
                            this.setSelection({ type: 'global' });
                            this.renderAll(true);
                            this.syncAllControls();
                            this.populateFontList();
                            this.initAllSortables();
                            this.updateExportSizePreview();
                            this.showToast('配置导入成功', 'success');
                        } catch (err) {
                            this.showErrorModal('导入失败', '配置文件格式不正确或已损坏。请确保您导入的是由本工具生成的 .json 文件。');
                            console.error(err);
                        } finally {
                            this.hideLoading();
                        }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                },

                // ... 导出PNG相关函数 ...
                async bakeOverlaysForExport(clone) {
                    // This function is assumed to be correct
                },

                async exportPNG() {
                    try {
                        this.showLoading('加载导出组件...');
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                    } catch (error) {
                        this.hideLoading();
                        this.showErrorModal('加载失败', '导出功能所需组件加载失败，请检查你的网络连接。');
                        return;
                    }
                    this.showLoading('正在准备导出...');

                    const mobileExportToggle = this.elements.inspectorPanel.querySelector('#mobile-export-toggle');
                    const customWidthToggle = this.elements.inspectorPanel.querySelector('#custom-width-toggle');
                    const hdExportToggle = this.elements.inspectorPanel.querySelector('#hd-export-toggle');

                    const isMobileExport = mobileExportToggle.checked;
                    const isCustomWidth = customWidthToggle.checked;
                    const isHD = hdExportToggle.checked;
                    
                    const sourceElement = this.elements.previewWrapper;
                    // NEW: Use the actual element's dimensions for scaling calculation
                    const sourceWidth = sourceElement.offsetWidth;
                    const sourceHeight = sourceElement.offsetHeight;

                    let targetWidth, targetHeight;

                    if (isMobileExport) {
                        targetWidth = 1200;
                        targetHeight = Math.round(targetWidth * (sourceHeight / sourceWidth));
                    } else if (isCustomWidth) {
                        targetWidth = this.state.exportSettings.customWidth;
                        targetHeight = this.state.exportSettings.lockAspectRatio
                            ? Math.round(targetWidth * (sourceHeight / sourceWidth))
                            : this.state.exportSettings.customHeight;
                    } else if (isHD) {
                        targetWidth = 1800;
                        targetHeight = Math.round(targetWidth * (sourceHeight / sourceWidth));
                    } else {
                        targetWidth = 1200;
                        targetHeight = Math.round(targetWidth * (sourceHeight / sourceWidth));
                    }

                    const scale = targetWidth / sourceWidth;

                    const exportRounded = this.elements.inspectorPanel.querySelector('#export-rounded-corners-toggle').checked;
                    const cornerRadius = parseInt(this.elements.inspectorPanel.querySelector('#export-corner-radius-input').value, 10) || 20;

                    let clone = null;

                    const wasLayerOpen = this.elements.layerPanel.classList.contains('is-open');
                    const wasInspectorOpen = this.elements.inspectorPanel.classList.contains('is-open');
                    if (wasLayerOpen || wasInspectorOpen) {
                        this.togglePanelDrawer(false);
                        await this.sleep(100);
                    }

                    document.body.classList.add('export-mode');

                    try {
                        clone = sourceElement.cloneNode(true);
                        clone.id = `export-clone-${Date.now()}`;

                        // NEW: Watermark/Attribution logic
                        const showAttribution = this.elements.inspectorPanel.querySelector('#export-attribution-toggle').checked;
                        if (showAttribution) {
                            const attr = this.state.pageStyles.pageBgImageAttribution;
                            let attrHTML = '';
                            if (attr && attr.user) {
                                attrHTML = `Photo by ${this.escapeHTML(attr.user)} on Pixabay / `;
                            }
                            attrHTML += `Made with Blokko`;

                            const attrDiv = document.createElement('div');
                            attrDiv.style.cssText = `
                                position: absolute;
                                bottom: 10px;
                                right: 15px;
                                font-size: 10px;
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                color: rgba(255, 255, 255, 0.7);
                                background-color: rgba(0, 0, 0, 0.3);
                                padding: 3px 6px;
                                border-radius: 4px;
                                z-index: 100;
                                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                            `;
                            attrDiv.textContent = attrHTML;
                            clone.appendChild(attrDiv);
                        }

                        const style = document.createElement('style');
                        style.innerHTML = `#${clone.id}, #${clone.id} * { transition: none !important; animation: none !important; } #${clone.id} .preview-card:hover .preview-card-inner { transform: none !important; box-shadow: var(--active-card-shadow, none) !important; }`;
                        clone.appendChild(style);

                        clone.style.position = 'absolute';
                        clone.style.left = '-9999px';
                        clone.style.top = '0px';
                        clone.style.borderRadius = '0';
                        clone.style.width = `${sourceWidth}px`;
                        // NEW: Set height for unlocked aspect ratio
                        if (isCustomWidth && !this.state.exportSettings.lockAspectRatio) {
                            clone.style.height = `${sourceHeight}px`; // Keep original height for rendering, but canvas will be different size
                        }
                        clone.style.maxWidth = 'none';

                        document.body.appendChild(clone);
                        await this.sleep(100);

                        this.showLoading('正在计算瀑布流布局...');
                        const masonryBlocks = this.state.blocks.filter(b => b.settings.masonryEnabled);
                        if (masonryBlocks.length > 0) {
                            await this.loadScript('https://cdn.bootcdn.net/ajax/libs/masonry/4.2.2/masonry.pkgd.min.js');
                            for (const block of masonryBlocks) {
                                const containerInClone = clone.querySelector(`.preview-block-wrapper[data-block-id="${block.id}"] .preview-cards-container`);
                                if (containerInClone) {
                                    containerInClone.classList.add('masonry-active');
                                    const itemSelector = block.type === 'text' ? '.preview-card' : 'figure';
                                    const msnry = new Masonry(containerInClone, { itemSelector: itemSelector, gutter: 15 });
                                    msnry.layout();
                                }
                            }
                            await this.sleep(200);
                        }

                        this.showLoading('正在处理样式 (烘焙)...');
                        await this.bakeOverlaysForExport(clone);
                        await this.sleep(100);

                        this.showLoading('正在渲染图片...');

                        const canvas = await html2canvas(clone, {
                            scale: scale, // Use calculated high-res scale
                            useCORS: true,
                            backgroundColor: null,
                            logging: false,
                            width: sourceWidth,
                            // NEW: Use custom height for unlocked aspect ratio
                            height: (isCustomWidth && !this.state.exportSettings.lockAspectRatio) ? targetHeight / scale : sourceHeight,
                            windowWidth: sourceWidth,
                            windowHeight: sourceHeight,
                        });
                        
                        const g = this.state.globalCardStyles;
                        let finalCanvas = canvas;


                        if (exportRounded && cornerRadius > 0) {
                            this.showLoading('正在应用圆角...');
                            const roundedCanvas = document.createElement('canvas');
                            roundedCanvas.width = finalCanvas.width;
                            roundedCanvas.height = finalCanvas.height;
                            const ctx = roundedCanvas.getContext('2d');
                            const scaledRadius = cornerRadius * scale;

                            ctx.beginPath();
                            ctx.moveTo(scaledRadius, 0);
                            ctx.lineTo(roundedCanvas.width - scaledRadius, 0);
                            ctx.arcTo(roundedCanvas.width, 0, roundedCanvas.width, scaledRadius, scaledRadius);
                            ctx.lineTo(roundedCanvas.width, roundedCanvas.height - scaledRadius);
                            ctx.arcTo(roundedCanvas.width, roundedCanvas.height, roundedCanvas.width - scaledRadius, roundedCanvas.height, scaledRadius);
                            ctx.lineTo(scaledRadius, roundedCanvas.height);
                            ctx.arcTo(0, roundedCanvas.height, 0, roundedCanvas.height - scaledRadius, scaledRadius);
                            ctx.lineTo(0, scaledRadius);
                            ctx.arcTo(0, 0, scaledRadius, 0, scaledRadius);
                            ctx.closePath();
                            ctx.clip();
                            ctx.drawImage(finalCanvas, 0, 0);
                            finalCanvas = roundedCanvas;
                        }

                        const dataUrl = finalCanvas.toDataURL('image/png');
                        const filename = this.generateFilename('Image') + '.png';
                        this.showDownloadModal(dataUrl, filename, '图片已生成');

                    } catch (err) {
                        console.error("PNG 导出失败:", err);
                        this.showErrorModal('导出失败', `生成图片时发生错误: ${err.message}.`);
                    } finally {
                        if (clone && clone.parentNode) {
                            clone.parentNode.removeChild(clone);
                        }
                        if (wasLayerOpen) this.togglePanelDrawer('layer-panel');
                        if (wasInspectorOpen) this.togglePanelDrawer('inspector-panel');
                        document.body.classList.remove('export-mode');
                        this.hideLoading();
                    }
                },

                // NEW: Update attribution link visibility and content
                updateAttributionLink() {
                    const wrapper = this.elements.inspectorPanel.querySelector('#attribution-link-wrapper');
                    if (!wrapper) return;

                    const attr = this.state.pageStyles.pageBgImageAttribution;
                    if (attr && attr.user) {
                        wrapper.innerHTML = `<a href="${attr.pageURL}" target="_blank" style="margin-left: 5px; font-weight: normal;">(查看作者: ${this.escapeHTML(attr.user)})</a>`;
                    } else {
                         wrapper.innerHTML = '';
                    }
                },

                // ... 辅助函数和工具函数 ...
                // MODIFIED: Renamed from updateExportSizePreview to updatePreviewAspectRatio and added more logic
                updatePreviewAspectRatio() {
                    const s = this.state.exportSettings;
                    const el = this.elements.previewWrapper;
                    const panel = this.elements.inspectorPanel;
                    if (!el || !panel) return;
                    
                    const customWidthToggle = panel.querySelector('#custom-width-toggle');
                    
                    if (customWidthToggle && customWidthToggle.checked && !s.lockAspectRatio) {
                        const aspectRatio = s.customWidth / s.customHeight;
                        el.style.aspectRatio = `${aspectRatio}`;
                        el.style.height = 'auto';
                    } else {
                        el.style.aspectRatio = '';
                        el.style.height = '';
                    }
                    this.updateExportSizePreview();
                },

                updateExportSizePreview() {
                    const el = this.elements.previewWrapper;
                    if (!el || el.clientWidth === 0) return;

                    const mobileExportToggle = document.getElementById('mobile-export-toggle');
                    const customWidthToggle = document.getElementById('custom-width-toggle');
                    const hdExportToggle = document.getElementById('hd-export-toggle');
                    if (!customWidthToggle || !hdExportToggle || !mobileExportToggle) return;
                    
                    const s = this.state.exportSettings;
                    const isMobileExport = mobileExportToggle.checked;
                    const isCustomWidth = customWidthToggle.checked;
                    const isHD = hdExportToggle.checked;

                    let targetWidth, targetHeight;
                    const originalAspectRatio = el.offsetHeight / el.offsetWidth;

                    if (isMobileExport) {
                        targetWidth = 1200;
                        targetHeight = Math.round(targetWidth * originalAspectRatio);
                    } else if (isCustomWidth) {
                        targetWidth = s.customWidth;
                        targetHeight = s.lockAspectRatio ? Math.round(targetWidth * originalAspectRatio) : s.customHeight;
                    } else if (isHD) {
                        targetWidth = 1800;
                        targetHeight = Math.round(targetWidth * originalAspectRatio);
                    } else {
                        targetWidth = 1200;
                        targetHeight = Math.round(targetWidth * originalAspectRatio);
                    }

                    const previewEl = document.getElementById('export-size-preview');
                    if (previewEl) {
                        previewEl.textContent = `导出尺寸: ${targetWidth}x${targetHeight}px`;
                    }

                    const exportBtn = document.getElementById('export-png-btn');
                    if (exportBtn) {
                        let buttonText = '导出为图片';
                        buttonText += ` (${targetWidth}px)`;
                        exportBtn.textContent = buttonText;
                    }
                },

                arrayBufferToBase64(buffer) {
                    return new Promise((resolve, reject) => {
                        const blob = new Blob([buffer], { type: 'application/octet-stream' });
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = e => reject(e);
                        reader.readAsDataURL(blob);
                    });
                },
                base64ToArrayBuffer(base64) {
                    const binaryString = atob(base64.split(',')[1]);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    return bytes.buffer;
                },
                blobToDataURL(blob) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = e => reject(e.target.error);
                        reader.readAsDataURL(blob);
                    });
                },

                // ... 弹窗和提示相关函数 ...
                showDownloadModal(url, filename, title) {
                    this.elements.downloadModalTitle.textContent = title;
                    const content = this.elements.downloadModalContent;
                    content.innerHTML = `<a href="${url}" download="${filename}">点击下载: ${filename}</a>`;
                    if (url.startsWith('data:image') || url.startsWith('blob:')) content.insertAdjacentHTML('afterbegin', `<img src="${url}">`);
                    this.elements.downloadModal.classList.add('visible');
                },
                hideDownloadModal() { this.elements.downloadModal.classList.remove('visible'); },
                showErrorModal(title, message) {
                    const existingModal = document.querySelector('.error-modal');
                    if (existingModal) existingModal.remove();
                    const modal = document.createElement('div');
                    modal.className = 'error-modal';
                    modal.innerHTML = `<h3>${title}</h3><p>${message}</p><button class="btn btn-primary" onclick="this.closest('.error-modal').remove()">确定</button>`;
                    document.body.appendChild(modal);
                },
                showFatalErrorModal(title, message, error) {
                    const existingModal = document.querySelector('.error-modal');
                    if (existingModal) existingModal.remove();
                    const modal = document.createElement('div');
                    modal.className = 'error-modal';
                    modal.innerHTML = `
                        <h3>${title}</h3>
                        <p>${message}</p>
                        <p style="font-size: 0.9rem; color: var(--color-danger);"><b>在重置前，强烈建议您先尝试下载一份紧急备份，软件会尽可能保留您的创作记录！</b></p>
                        <details style="margin-top: 10px;">
                            <summary style="font-size:0.8rem; cursor:pointer;">错误详情</summary>
                            <pre style="white-space:pre-wrap; font-size:0.7rem; background: var(--bg-input); padding: 5px; border-radius: 4px; max-height: 100px; overflow-y: auto;">${error ? this.escapeHTML(error.toString()) : '无'}</pre>
                        </details>
                        <div class="modal-actions" style="margin-top: 20px;">
                             <button id="fatal-backup-btn" class="btn btn-secondary">下载备份 (.zip)</button>
                             <button id="fatal-reset-btn" class="btn btn-danger">重置并重载</button>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    modal.querySelector('#fatal-backup-btn').addEventListener('click', createEmergencyBackup);

                    modal.querySelector('#fatal-reset-btn').addEventListener('click', async () => {
                        try {
                            localStorage.clear();
                            const dbs = await indexedDB.databases();
                            dbs.forEach(db => indexedDB.deleteDatabase(db.name));
                            window.location.reload();
                        } catch (e) {
                            alert('自动重置失败，请手动清除浏览器缓存后重试！');
                        }
                    });
                },
                showConfirm(title, message) {
                    return new Promise(resolve => {
                        const modal = this.elements.confirmModal;
                        modal.querySelector('#confirm-modal-title').textContent = title;
                        modal.querySelector('#confirm-modal-message').textContent = message;

                        const okBtn = modal.querySelector('#confirm-modal-ok-btn');
                        const cancelBtn = modal.querySelector('#confirm-modal-cancel-btn');

                        const cleanup = () => {
                            modal.classList.remove('visible');
                            okBtn.replaceWith(okBtn.cloneNode(true));
                            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                        };

                        okBtn.addEventListener('click', () => {
                            cleanup();
                            resolve(true);
                        }, { once: true });

                        cancelBtn.addEventListener('click', () => {
                            cleanup();
                            resolve(false);
                        }, { once: true });

                        modal.classList.add('visible');
                    });
                },
                showLoading(text = '正在处理...') {
                    this.elements.loadingText.textContent = text;
                    this.elements.loadingOverlay.classList.add('visible');
                },
                hideLoading() {
                    this.elements.loadingOverlay.classList.remove('visible');
                },
                showToast(message, type = 'info') {
                    const toast = document.createElement('div');
                    toast.className = `toast-notification ${type}`;
                    toast.textContent = message;
                    this.elements.toastContainer.appendChild(toast);
                    setTimeout(() => {
                        toast.remove();
                    }, 5000);
                },

                // ... CSS 变量和样式更新函数 ...
                updateGlobalCardStyleVars() {
                    const g = this.state.globalCardStyles;
                    const gBtn = this.state.globalButtonStyles; // NEW
                    const r = document.documentElement.style;

                    r.setProperty('--g-card-bg-color', g.bgColor);
                    r.setProperty('--g-card-text-color', g.textColor);
                    r.setProperty('--g-card-opacity', g.opacity);
                    r.setProperty('--g-card-border-radius', `${g.radius}px`);
                    r.setProperty('--g-card-text-align', g.textAlign);
                    r.setProperty('--g-card-line-height', g.lineHeight);
                    r.setProperty('--active-card-font-family', g.fontFamily ? `'${g.fontFamily}', sans-serif` : '');
                    r.setProperty('--g-card-title-font-size', g.titleFontSize);
                    r.setProperty('--g-card-content-font-size', g.contentFontSize);
                    r.setProperty('--g-card-text-stroke', g.textStrokeWidth > 0 ? `${g.textStrokeWidth}px ${g.textStrokeColor}` : '0px transparent');
                    r.setProperty('--active-card-border', g.borderWidth > 0 && g.borderStyle !== 'none' ? `${g.borderWidth}px ${g.borderStyle} ${g.borderColor}` : 'none');
                    


                    // NEW: Set global button styles
                    r.setProperty('--g-button-bg-color', gBtn.bgColor);
                    r.setProperty('--g-button-text-color', gBtn.textColor);
                    r.setProperty('--g-button-border-radius', `${gBtn.radius}px`);
                    r.setProperty('--g-button-text-align', gBtn.textAlign);
                },

                // ... SortableJS 拖拽排序初始化函数 ...
                initAllSortables() {
                    this.initLayerSortables();
                    this.initSortablePreviewBlocks();
                    this.initSortablePreviewTags();
                },

                initLayerSortables() {
                    if (this.sortableLayers) this.sortableLayers.destroy();
                    this.sortableLayers = new Sortable(this.elements.layerList, {
                        group: 'layers',
                        animation: 150,
                        handle: '.layer-item',
                        ghostClass: 'sortable-ghost',
                        filter: 'hr, .layer-item[data-type="personalInfo"], .layer-actions, .layer-toggle, .card-layer-list',
                        onEnd: e => {
                            const oldIndex = e.oldIndex - 2;
                            const newIndex = e.newIndex - 2;
                            if (oldIndex === newIndex) return;
                            this.pushHistory('排序区块');
                            const [moved] = this.state.blocks.splice(oldIndex, 1);
                            this.state.blocks.splice(newIndex, 0, moved);
                            this.debouncedSaveToLocal();
                            this.renderLayerPanel();
                            this.renderPreviewBlocks();
                        }
                    });
                },

                initNestedSortables() {
                    Object.values(this.cardLayerSortables).forEach(s => s.destroy());
                    this.cardLayerSortables = {};
                    this.elements.layerList.querySelectorAll('.card-layer-list').forEach(list => {
                        const blockId = list.dataset.blockId;
                        this.cardLayerSortables[blockId] = new Sortable(list, {
                            group: `cards-${blockId}`,
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            onEnd: e => {
                                const block = this.findBlock(blockId);
                                if (!block) return;
                                this.pushHistory('排序卡片');
                                const [movedCard] = block.cards.splice(e.oldIndex, 1);
                                block.cards.splice(e.newIndex, 0, movedCard);
                                this.debouncedSaveToLocal();
                                this.renderPreviewBlockById(blockId);
                            }
                        });
                    });
                },

                initSortablePreviewBlocks() {
                    if (this.sortablePreview) this.sortablePreview.destroy();
                    this.sortablePreview = new Sortable(this.elements.previewBlocksContainer, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        onEnd: e => {
                            if (e.oldIndex === e.newIndex) return;
                            this.pushHistory('排序区块');
                            const [movedBlock] = this.state.blocks.splice(e.oldIndex, 1);
                            this.state.blocks.splice(e.newIndex, 0, movedBlock);
                            this.debouncedSaveToLocal();
                            this.renderLayerPanel();
                        }
                    });
                },

                initSortableTags() {
                    const list = this.elements.inspectorPanel.querySelector('#tag-manager-list');
                    if (list) {
                        if (this.sortableTags) this.sortableTags.destroy();
                        this.sortableTags = new Sortable(list, {
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            handle: '.tag-drag-handle',
                            onEnd: e => {
                                if (e.oldIndex === e.newIndex) return;
                                this.pushHistory('排序标签');
                                const [movedTag] = this.state.personalInfo.tags.splice(e.oldIndex, 1);
                                this.state.personalInfo.tags.splice(e.newIndex, 0, movedTag);
                                this.debouncedSaveToLocal();
                                this.renderPersonalInfo();
                            }
                        });
                    }
                },

                initSortablePreviewTags() {
                    const container = this.elements.previewHeader.querySelector('#preview-tags-container');
                    if (container) {
                        if (this.sortablePreviewTags) this.sortablePreviewTags.destroy();
                        this.sortablePreviewTags = new Sortable(container, {
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            onEnd: (e) => {
                                if (e.oldIndex === e.newIndex) return;
                                this.pushHistory('排序标签');
                                const [movedTag] = this.state.personalInfo.tags.splice(e.oldIndex, 1);
                                this.state.personalInfo.tags.splice(e.newIndex, 0, movedTag);
                                this.debouncedSaveToLocal();
                                this.renderTagManager();
                            }
                        });
                    }
                },

                initSortableCards(blockId) {
                    const list = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${blockId}"] .card-editors-list`);
                    if (list) { if (this.cardSortables[blockId]) this.cardSortables[blockId].destroy(); this.cardSortables[blockId] = new Sortable(list, { handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: e => { const b = this.findBlock(blockId); if (b) { this.pushHistory('排序卡片'); const [m] = b.cards.splice(e.oldIndex, 1); b.cards.splice(e.newIndex, 0, m); this.debouncedSaveToLocal(); this.renderPreviewBlockById(blockId); this.renderLayerPanel(); } } }); }
                },
                initSortableImageCards(blockId) {
                    const container = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${blockId}"] .image-card-editors-list`);
                    if (container) { if (this.imageCardSortables[blockId]) this.imageCardSortables[blockId].destroy(); this.imageCardSortables[blockId] = new Sortable(container, { handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: e => { const block = this.findBlock(blockId); if (block) { this.pushHistory('排序图片'); const [moved] = block.cards.splice(e.oldIndex, 1); block.cards.splice(e.newIndex, 0, moved); this.debouncedSaveToLocal(); this.renderPreviewBlockById(blockId); this.renderLayerPanel(); } } }); }
                },
                // NEW: Init sortable button cards
                initSortableButtonCards(blockId) {
                    const container = this.elements.inspectorPanel.querySelector(`.editor-block[data-block-id="${blockId}"] .button-card-editors-list`);
                    if (container) {
                        if (this.buttonCardSortables[blockId]) this.buttonCardSortables[blockId].destroy();
                        this.buttonCardSortables[blockId] = new Sortable(container, {
                            handle: '.card-drag-handle',
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            onEnd: e => {
                                const block = this.findBlock(blockId);
                                if (block) {
                                    this.pushHistory('排序按钮');
                                    const [moved] = block.cards.splice(e.oldIndex, 1);
                                    block.cards.splice(e.newIndex, 0, moved);
                                    this.debouncedSaveToLocal();
                                    this.renderPreviewBlockById(blockId);
                                    this.renderLayerPanel();
                                }
                            }
                        });
                    }
                },


                // ... Masonry 瀑布流布局相关函数 ...
                async initMasonryForBlock(blockId) {
                    this.destroyMasonryForBlock(blockId);
                    const block = this.findBlock(blockId);
                    if (block && (block.type === 'text' || block.type === 'image') && ['dual', 'triple'].includes(block.settings.layout) && block.settings.masonryEnabled) {
                        const previewEl = this.elements.previewBlocksContainer.querySelector(`[data-block-id="${blockId}"] .preview-cards-container`);
                        if (previewEl) {
                            try {
                                await this.loadScript('https://cdn.bootcdn.net/ajax/libs/masonry/4.2.2/masonry.pkgd.min.js');
                            } catch (e) {
                                console.error("Masonry.js load failed.", e);
                                this.showToast("瀑布流组件加载失败，请检查网络。", "error");
                                return;
                            }
                            // 修复瀑布流重叠的核心逻辑
                            const images = Array.from(previewEl.querySelectorAll('img'));
                            // 创建一个 Promise 数组，每个 Promise 对应一张图片的加载
                            const imageLoadPromises = images.map(img => {
                                // 如果图片已经加载完成（例如从缓存加载），并且有有效尺寸，则立即 resolve
                                if (img.complete && img.naturalHeight !== 0) {
                                    return Promise.resolve();
                                }
                                // 否则，返回一个新的 Promise，它会在图片加载成功或失败时 resolve
                                return new Promise(resolve => {
                                    img.addEventListener('load', resolve, { once: true });
                                    img.addEventListener('error', resolve, { once: true }); // 加载失败也 resolve，避免阻塞整个布局
                                });
                            });

                            // 等待所有图片的 Promise 都完成后，再执行瀑布流初始化
                            await Promise.all(imageLoadPromises);

                            previewEl.classList.add('masonry-active');
                            const itemSelector = block.type === 'image' ? 'figure' : '.preview-card';
                            this.masonryInstances[blockId] = new Masonry(previewEl, {
                                itemSelector: itemSelector,
                                gutter: 15,
                                fitWidth: false,
                                percentPosition: true
                            });
                        }
                    }
                },
                destroyMasonryForBlock(blockId) {
                    if (this.masonryInstances[blockId]) {
                        this.masonryInstances[blockId].destroy();
                        delete this.masonryInstances[blockId];
                        const previewEl = this.elements.previewBlocksContainer.querySelector(`[data-block-id="${blockId}"] .preview-cards-container`);
                        if (previewEl) {
                            previewEl.classList.remove('masonry-active');
                            // Clean up masonry styles
                            Array.from(previewEl.children).forEach(child => {
                                child.style.position = '';
                                child.style.left = '';
                                child.style.top = '';
                                child.style.width = '';
                            });
                        }
                    }
                },

                // ... 移动端与UI布局相关函数 ...
                togglePanelDrawer(panelId) {
                    if (panelId === false) {
                        this.elements.layerPanel.classList.remove('is-open');
                        this.elements.inspectorPanel.classList.remove('is-open');
                        this.elements.body.classList.remove('panels-open');
                        return;
                    }
                    const panel = document.getElementById(panelId);
                    const isOpen = panel.classList.toggle('is-open');
                    const anyPanelOpen = this.elements.layerPanel.classList.contains('is-open') || this.elements.inspectorPanel.classList.contains('is-open');
                    this.elements.body.classList.toggle('panels-open', anyPanelOpen);

                    if (isOpen) {
                        if (panelId === 'layer-panel' && this.elements.inspectorPanel.classList.contains('is-open')) this.elements.inspectorPanel.classList.remove('is-open');
                        if (panelId === 'inspector-panel' && this.elements.layerPanel.classList.contains('is-open')) this.elements.layerPanel.classList.remove('is-open');
                    }
                },
                async resetToDefault() {
                    if (await this.showConfirm('恢复默认模板', '警告：此操作将清空您所有的内容和样式设置，并恢复到初始模板。此过程不可撤销，确定要继续吗？')) {
                        localStorage.removeItem('blokkoState');
                        this.state = this.getDefaultState();
                        this.history = [{ state: this.deepClone(this.state), description: '恢复默认' }];
                        this.historyIndex = 0;
                        this.updateUndoRedoButtons();
                        this.renderAll(true);
                        this.syncAllControls();
                        this.setSelection({ type: 'global' });
                        this.showToast('已恢复为默认模板', 'success');
                    }
                },

                toggleLockMode() {
                    const isLocked = this.elements.previewBlocksContainer.classList.toggle('locked-mode');
                    const button = this.elements.lockModeToggle;

                    button.textContent = isLocked ? '预览中' : '编辑中';
                    button.title = isLocked ? '预览模式 (点击切换为编辑模式)' : '编辑模式 (点击切换为预览模式)';
                    this.renderMobileEditPencils();

                    const shouldDisable = isLocked;

                    if (this.sortableLayers) this.sortableLayers.option('disabled', shouldDisable);
                    if (this.sortablePreview) this.sortablePreview.option('disabled', shouldDisable);
                    if (this.sortableTags) this.sortableTags.option('disabled', shouldDisable);
                    if (this.sortablePreviewTags) this.sortablePreviewTags.option('disabled', shouldDisable);
                    Object.values(this.cardLayerSortables).forEach(s => { if (s) s.option('disabled', shouldDisable); });
                    Object.values(this.cardSortables).forEach(s => { if (s) s.option('disabled', shouldDisable); });
                    Object.values(this.imageCardSortables).forEach(s => { if (s) s.option('disabled', shouldDisable); });
                },

                // ... 标签管理器相关函数 ...
                renderTagManager() {
                    const container = this.elements.inspectorPanel.querySelector('#tag-manager-list');
                    if (!container) return;
                    const tags = this.state.personalInfo.tags || [];
                    if (!tags.length) {
                        container.innerHTML = `<div class="empty-tag-list">暂无标签</div>`;
                        return;
                    }
                    container.innerHTML = tags.map(tag => {
                        const iconHTML = tag.icon ? `<span class="iconify" data-icon="${tag.icon}"></span>` : '无';
                        return `<div class="tag-manager-item" data-tag-id="${tag.id}">
                            <span class="tag-drag-handle iconify" data-icon="mdi:drag-horizontal-variant"></span>
                            <button class="btn btn-default btn-icon tag-icon-btn">${iconHTML}</button>
                            <input type="text" class="tag-text-input" value="${this.escapeHTML(tag.text)}">
                            <button class="btn btn-danger btn-icon tag-delete-btn"><span class="iconify" data-icon="mdi:delete"></span></button>
                        </div>`;
                    }).join('');
                },
                addNewTag() {
                    const textInput = this.elements.inspectorPanel.querySelector('#new-tag-text-input');
                    if (!textInput) return;
                    const text = textInput.value.trim();
                    if (!text) return;
                    this.pushHistory('添加标签');
                    if (!this.state.personalInfo.tags) this.state.personalInfo.tags = [];
                    this.state.personalInfo.tags.push({ id: this.generateId('t'), icon: null, text });
                    this.debouncedSaveToLocal();
                    this.renderPersonalInfo();
                    this.renderTagManager();
                    textInput.value = '';
                    textInput.focus();
                },
                deleteTag(tagId) {
                    this.pushHistory('删除标签');
                    this.state.personalInfo.tags = this.state.personalInfo.tags.filter(t => t.id !== tagId);
                    this.debouncedSaveToLocal();
                    this.renderPersonalInfo();
                    this.renderTagManager();
                },
                updateTag(tagId, key, value, pushHistory, historyDescription) {
                    const tagIndex = this.state.personalInfo.tags.findIndex(t => t.id === tagId);
                    if (tagIndex > -1) this.updateState(`personalInfo.tags.${tagIndex}.${key}`, value, pushHistory, historyDescription);
                },

                // ... 图标/纹理选择器相关函数 ...
                initIconPicker() {
                    if (this.iconPickerInitialized) return;
                    this.loadIcons();
                    this.iconPickerInitialized = true;
                },
                initTexturePicker() {
                    if (!this.texturePickerInitialized) {
                        this.renderTexturePicker();
                        this.texturePickerInitialized = true;
                    }
                    this.elements.texturePickerModal.classList.add('visible');
                },
                async loadIcons() {
                    // No need to actually load anything with Iconify's on-demand nature
                    this.showToast('图标库已准备就绪', 'info');
                },
                async renderIconGrid(searchTerm = '') {
                    this.elements.iconGrid.innerHTML = `<div class="spinner" style="margin: 40px auto;"></div>`;
                    let customIconsHTML = '';
                    if (this.state.customIcons && this.state.customIcons.length > 0) {
                        customIconsHTML = this.state.customIcons.map(icon =>
                            `<div class="icon-grid-item" data-icon="${icon.dataUrl}" data-icon-name="${icon.name}" title="${this.escapeHTML(icon.name)}">
                                <img src="${icon.dataUrl}" style="width: 24px; height: 24px;">
                                <button class="btn btn-icon btn-danger btn-small delete-custom-icon-btn" title="删除此图标">
                                    <span class="iconify" data-icon="mdi:delete"></span>
                                </button>
                            </div>`
                        ).join('');
                        customIconsHTML = `<h4>自定义图标</h4><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 10px;">${customIconsHTML}</div><hr class="separator"><h4>在线图标</h4>`;
                    }

                    if (!searchTerm) {
                        this.elements.iconGrid.innerHTML = customIconsHTML + '<p style="text-align: center; color: var(--text-placeholder);">请输入关键词搜索在线图标</p>';
                        return;
                    }
                    try {
                        const prefixes = 'lucide,tabler,mdi,ph,heroicons,ri,icon-park-outline,icon-park-solid,icon-park-twotone,simple-icons,noto,bx,bxs,bxl,carbon,pixelarticons,feather,fluent,eva'; const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(searchTerm)}&limit=99&prefixes=${prefixes}`);
                        const data = await response.json();

                        let onlineIconsHTML;
                        if (data.icons.length === 0) {
                            onlineIconsHTML = '<p style="text-align: center; color: var(--text-placeholder);">未找到匹配的在线图标</p>';
                        } else {
                            onlineIconsHTML = data.icons.map(name =>
                                `<div class="icon-grid-item" data-icon="${name}" title="${name}"><span class="iconify" data-icon="${name}"></span></div>`
                            ).join('');
                        }
                        this.elements.iconGrid.innerHTML = customIconsHTML + onlineIconsHTML;
                    } catch (e) {
                        this.elements.iconGrid.innerHTML = customIconsHTML + '<p style="text-align: center; color: var(--color-danger);">搜索失败，请检查网络。</p>';
                    }
                },
                showIconPicker(type, id, cardId = null) {
                    this.currentIconTarget = { type, id, cardId };
                    this.elements.iconPickerModal.classList.add('visible');
                    this.renderIconGrid(this.elements.iconSearch.value);
                    this.elements.iconSearch.focus();
                },
                hideIconPicker() {
                    this.elements.iconPickerModal.classList.remove('visible');
                    this.currentIconTarget = null;
                    this.elements.iconSearch.value = '';
                    this.elements.iconGrid.innerHTML = '';
                },
                selectIcon(iconClass) {
                    if (this.currentIconTarget) {
                        const { type, id, cardId } = this.currentIconTarget;
                        if (type === 'card' || type === 'button') {
                            this.updateCard(id, cardId, 'icon', iconClass, true, '更改卡片图标');
                        } else if (type === 'tag') {
                            this.updateTag(id, 'icon', iconClass, true, '更改标签图标');
                        } else if (type === 'separator') {
                            this.updateBlockSettings(id, 'icon', iconClass, true, '更改分隔线图标');
                        }
                    }
                    this.hideIconPicker();
                },
                async handleIconUpload(event) {
                    const file = event.target.files[0];
                    if (!file || file.type !== 'image/svg+xml') {
                        this.showToast('请上传一个.svg格式的图标文件', 'error');
                        return;
                    }
                    if (this.state.customIcons.some(icon => icon.name === file.name)) {
                        this.showToast(`已存在名为 "${file.name}" 的图标`, 'error');
                        return;
                    }
                    try {
                        const dataUrl = await this.readFileAsDataURL(file);
                        this.pushHistory(`上传图标 ${file.name}`);
                        if (!this.state.customIcons) this.state.customIcons = [];
                        this.state.customIcons.push({ name: file.name, dataUrl: dataUrl });
                        this.debouncedSaveToLocal();
                        this.renderIconGrid(this.elements.iconSearch.value);
                        this.showToast(`图标 "${file.name}" 上传成功`, 'success');
                    } catch (error) {
                        this.showErrorModal('图标上传失败', error.message);
                    } finally {
                        event.target.value = '';
                    }
                },
                deleteCustomIcon(iconName) {
                    this.showConfirm('删除自定义图标', `确定要删除自定义图标 "${iconName}" 吗？`).then(confirmed => {
                        if (confirmed) {
                            this.pushHistory(`删除图标 ${iconName}`);
                            this.state.customIcons = this.state.customIcons.filter(icon => icon.name !== iconName);
                            this.debouncedSaveToLocal();
                            this.renderIconGrid(this.elements.iconSearch.value);
                            this.showToast(`图标 "${iconName}" 已删除`, 'info');
                        }
                    });
                },

                renderTexturePicker() {
                    this.elements.textureGrid.innerHTML = HeroPatterns.map(p => {
                        const svg = p.svg('var(--text-primary)', 0.5);
                        const base64Svg = btoa(unescape(encodeURIComponent(svg)));
                        return `<div class="texture-grid-item" data-texture-name="${p.name}">
                                    <div class="texture-preview" style="background-image: url(data:image/svg+xml;base64,${base64Svg});"></div>
                                    <span class="texture-name">${p.name}</span>
                                </div>`;
                    }).join('');
                },
                selectTexture(textureName) {
                    this.updateState('pageStyles.pageBgPattern', textureName, true, '选择背景纹理');
                    const currentTextureName = this.elements.inspectorPanel.querySelector('#current-texture-name');
                    if (currentTextureName) currentTextureName.textContent = textureName || '无';
                    this.elements.texturePickerModal.classList.remove('visible');
                },

                // ... 选中状态管理函数 ...
                setSelection(newSelection) {
                    this.selection = newSelection;
                    this.updateHighlights();
                    this.renderInspector();
                },
                updateHighlights() {
                    document.querySelectorAll('.layer-item.selected, .card-layer-item.selected, .preview-block-wrapper.selected, .preview-header.selected, .editor-card.is-active').forEach(el => el.classList.remove('selected', 'is-active'));

                    const { type, id, cardId } = this.selection;

                    if (type === 'personalInfo') {
                        document.querySelector('.layer-item[data-type="personalInfo"]')?.classList.add('selected');
                        this.elements.previewHeader.classList.add('selected');
                    } else if (type === 'block' && id) {
                        document.querySelector(`.layer-item[data-id="${id}"]`)?.classList.add('selected');
                        document.querySelector(`.preview-block-wrapper[data-block-id="${id}"]`)?.classList.add('selected');
                        if (cardId) {
                            document.querySelector(`.card-layer-item[data-card-id="${cardId}"]`)?.classList.add('selected');
                            document.querySelector(`.editor-card[data-card-id="${cardId}"]`)?.classList.add('is-active');
                        }
                    }
                },

                // ... ColorThief 智能取色相关函数 ...
                analyzeColorsFromImage(dataUrl) {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";

                    img.onload = () => {
                        setTimeout(() => {
                            try {
                                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                                    throw new Error("图片加载后尺寸为0，可能已损坏。");
                                }
                                const palette = this.colorThief.getPalette(img, 10);

                                if (!palette || palette.length === 0) {
                                    throw new Error("Color-Thief未能成功提取调色板。");
                                }

                                this.lastPalette = palette;
                                this.renderPalette(palette);
                                this.showToast('颜色提取成功！', 'success');

                            } catch (e) {
                                console.error("Color-Thief error:", e);
                                this.showErrorModal('颜色提取失败', `无法从图片中提取有效颜色。请尝试另一张图片。(${e.message})`);
                            } finally {
                                this.hideLoading();
                            }
                        }, 100);
                    };

                    img.onerror = () => {
                        this.showErrorModal('图片加载失败', '无法从该图片提取颜色，请检查图片文件。');
                        this.hideLoading();
                    };

                    img.src = dataUrl;
                },

                renderPalette(palette) {
                    const container = document.getElementById('color-thief-palette');
                    if (!container) return;
                    container.innerHTML = palette.map(rgb => {
                        const hex = `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
                        return `<div class="palette-color" data-color="${hex}" style="background-color: ${hex};"><div class="color-tooltip">${hex}</div></div>`;
                    }).join('');
                },
                bindColorThiefEvents() {
                    const paletteContainer = document.getElementById('color-thief-palette');
                    if (!paletteContainer) return;

                    const handleInteraction = (e) => {
                        const colorEl = e.target.closest('.palette-color');
                        if (!colorEl) return;
                        e.preventDefault();
                        this.showColorContextMenu(e.clientX, e.clientY, colorEl.dataset.color);
                    };

                    paletteContainer.addEventListener('contextmenu', handleInteraction);
                    paletteContainer.addEventListener('touchstart', e => {
                        const colorEl = e.target.closest('.palette-color');
                        if (!colorEl) return;
                        this.longPressTimer = setTimeout(() => {
                            const touch = e.touches[0];
                            this.showColorContextMenu(touch.clientX, touch.clientY, colorEl.dataset.color);
                        }, 500);
                    });
                    paletteContainer.addEventListener('touchend', () => clearTimeout(this.longPressTimer));
                    paletteContainer.addEventListener('touchmove', () => clearTimeout(this.longPressTimer));
                },
                showColorContextMenu(x, y, color) {
                    const menu = this.elements.colorContextMenu;
                    menu.style.display = 'block';

                    const menuRect = menu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    if (x + menuRect.width > viewportWidth) {
                        x = viewportWidth - menuRect.width - 5;
                    }
                    if (y + menuRect.height > viewportHeight) {
                        y = viewportHeight - menuRect.height - 5;
                    }

                    menu.style.left = `${x}px`;
                    menu.style.top = `${y}px`;
                    menu.dataset.color = color;
                },
                hideColorContextMenu() {
                    this.elements.colorContextMenu.style.display = 'none';
                },

                // ... 颜色快捷应用与Tab切换辅助函数 ...
                switchTab(sectionSelector, desiredTabId) {
                    const section = this.elements.inspectorPanel.querySelector(sectionSelector);
                    if (!section) return;

                    const tabButton = section.querySelector(`.tab-btn[data-tab="${desiredTabId}"]`);
                    if (!tabButton) return;

                    section.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    tabButton.classList.add('active');

                    section.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    const tabContent = section.querySelector(`#${desiredTabId}`);
                    if (tabContent) {
                        tabContent.classList.add('active');
                    }
                },

                applyQuickColor(action, color) {
                    const actionMap = {
                        'apply-page-bg-solid': 'pageStyles.pageBgSolidColor',
                        'apply-page-bg-gradient-start': 'pageStyles.pageBgGradientStart',
                        'apply-page-bg-gradient-end': 'pageStyles.pageBgGradientEnd',
                        'apply-header-bg-solid': 'pageStyles.headerBgColor',
                        'apply-header-bg-gradient-start': 'pageStyles.headerBgGradientStart',
                        'apply-header-bg-gradient-end': 'pageStyles.headerBgGradientEnd',
                        'apply-header-text': 'pageStyles.headerTextColor',
                        'apply-gcard-bg': 'globalCardStyles.bgColor',
                        'apply-gcard-bg-gradient-start': 'globalCardStyles.bgGradientStart',
                        'apply-gcard-bg-gradient-end': 'globalCardStyles.bgGradientEnd',
                        'apply-gcard-text': 'globalCardStyles.textColor',
                        'apply-gcard-title-text': 'globalCardStyles.titleColor',
                    };

                    if (actionMap[action]) {
                        this.updateState(actionMap[action], color, true, '通过取色器应用颜色');
                        this.showToast('颜色已应用', 'info');

                        if (action.includes('gradient')) {
                            if (action.startsWith('apply-page-bg')) {
                                this.updateState('pageStyles.pageBgMode', 'gradient', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:first-child', 'page-bg-gradient');
                            } else if (action.startsWith('apply-header-bg')) {
                                this.updateState('pageStyles.headerBgMode', 'gradient', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:last-child', 'header-bg-gradient');
                            } else if (action.startsWith('apply-gcard-bg')) {
                                this.updateState('globalCardStyles.bgMode', 'gradient', false);
                                this.switchTab('#global-card-styles-section', 'card-bg-gradient');
                            }
                        } else if (action.includes('solid')) {
                            if (action.startsWith('apply-page-bg')) {
                                this.updateState('pageStyles.pageBgMode', 'solid', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:first-child', 'page-bg-solid');
                            } else if (action.startsWith('apply-header-bg')) {
                                this.updateState('pageStyles.headerBgMode', 'solid', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:last-child', 'header-bg-solid');
                            } else if (action.startsWith('apply-gcard-bg')) {
                                this.updateState('globalCardStyles.bgMode', 'solid', false);
                                this.switchTab('#global-card-styles-section', 'card-bg-solid');
                            }
                        }
                    }
                },

                // ... 颜色和字符串工具函数 ...
                hexToRgba(hex, alpha = 1) {
                    if (!hex || parseFloat(alpha) === 0) return 'transparent';
                    if (hex.startsWith('rgba')) {
                        return hex.replace(/, ?\d?\.?\d+\)$/, `, ${alpha})`);
                    }
                    const match = hex.match(/\w\w/g);
                    if (!match) return `rgba(0,0,0,${alpha})`;
                    const [r, g, b] = match.map(x => parseInt(x, 16));
                    return `rgba(${r},${g},${b},${alpha})`;
                },

                debounce(func, wait) {
                    let timeout;
                    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
                },
                generateId(p) { return `${p}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
                postRenderAsyncUpdates(container) {
                    const imageLoadPromises = [];
                    container.querySelectorAll('figure[data-card-id] img').forEach(img => {
                        const cardId = img.closest('figure').dataset.cardId;
                        const blockId = img.closest('.preview-block-wrapper').dataset.blockId;
                        const card = this.findBlock(blockId)?.cards.find(c => c.id === cardId);

                        if (card && card.url) {
                            const promise = new Promise(async (resolve) => {
                                img.addEventListener('load', resolve, { once: true });
                                img.addEventListener('error', resolve, { once: true }); // 失败也 resolve

                                let srcToSet = card.url;
                                if (card.url.startsWith('idb://')) {
                                    try {
                                        const record = await this.getImageFromDB(card.url.substring(6));
                                        srcToSet = (record && record.blob) ? URL.createObjectURL(record.blob) : '';
                                    } catch {
                                        srcToSet = '';
                                    }
                                }

                                if (img.src === srcToSet && img.complete) {
                                    return resolve(); // 如果图片已加载，立即完成
                                }
                                if (!srcToSet) {
                                    return resolve(); // 如果没有有效的 src，也立即完成
                                }
                                img.src = srcToSet;
                            });
                            imageLoadPromises.push(promise);
                        }
                    });

                    container.querySelectorAll('.preview-card[data-card-id]').forEach(cardEl => {
                        const cardId = cardEl.dataset.cardId;
                        const blockId = cardEl.closest('.preview-block-wrapper').dataset.blockId;
                        const cardData = this.findBlock(blockId)?.cards.find(c => c.id === cardId);
                        if (cardData) {
                            this.applyCardStyles(cardEl, cardData);
                        }
                    });

                    Promise.all(imageLoadPromises).then(() => {
                        this.state.blocks.forEach(block => {
                            if (block.settings.masonryEnabled) {
                                this.initMasonryForBlock(block.id);
                            }
                        });
                    });
                },
                deepClone(obj) { return JSON.parse(JSON.stringify(obj)) },
                escapeHTML(str) { return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) },
                sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) },

                //  Script Loader for Performance
                loadScript(url) {
                    return new Promise((resolve, reject) => {
                        if (document.querySelector(`script[src="${url}"]`)) {
                            return resolve();
                        }
                        const script = document.createElement('script');
                        script.src = url;
                        script.onload = resolve;
                        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
                        document.body.appendChild(script);
                    });
                },


                // ... 区块操作函数 ...
                async addBlock(type, sourceBlock = null) {
                    this.pushHistory(sourceBlock ? '复制区块' : '添加新区块');
                    let newBlock;

                    if (sourceBlock) {
                        newBlock = this.deepClone(sourceBlock);
                        newBlock.title = `${sourceBlock.title} (副本)`;
                        if (newBlock.cards) {
                            newBlock.cards.forEach(card => {
                                card.title = "";
                                card.content = "";
                                card.description = "";
                                card.text = ""; // NEW for buttons
                            });
                        }
                    } else {
                        const defaultState = this.getDefaultState();
                        const blockTemplate = defaultState.blocks.find(b => b.type === type);
                        newBlock = this.deepClone(blockTemplate);
                    }

                    newBlock.id = this.generateId('b');
                    if (newBlock.cards) {
                        newBlock.cards.forEach(c => c.id = this.generateId('c'));
                    }

                    const insertIndex = sourceBlock ? this.findBlockIndex(sourceBlock.id) + 1 : this.state.blocks.length;
                    this.state.blocks.splice(insertIndex, 0, newBlock);

                    this.debouncedSaveToLocal();
                    this.renderLayerPanel();
                    this.renderPreviewBlocks();
                    await this.sleep(10);
                    this.setSelection({ type: 'block', id: newBlock.id });

                    if (sourceBlock) this.showToast('样式已复制', 'success');
                },
                async deleteBlock(blockId) {
                    const block = this.findBlock(blockId);
                    if (!block) return;

                    if (await this.showConfirm('删除区块', `确定要删除区块 "${block.title}" 吗？`)) {
                        this.pushHistory(`删除区块 "${block.title}"`);

                        // 删除区块前，清理其包含的所有图片
                        if (block.cards) {
                            for (const card of block.cards) {
                                await this.deleteImageByUrl(card.url);
                                await this.deleteImageByUrl(card.bgImageDataUrl);
                            }
                        }

                        this.destroyMasonryForBlock(blockId);
                        this.state.blocks = this.state.blocks.filter(b => b.id !== blockId);
                        this.debouncedSaveToLocal();

                        if (this.selection.type === 'block' && this.selection.id === blockId) {
                            this.setSelection({ type: 'global' });
                        }

                        this.renderLayerPanel();
                        this.renderPreviewBlocks();
                        this.showToast('区块已删除', 'info');
                    }
                },

                toggleBlockVisibility(blockId) {
                    const blockIndex = this.findBlockIndex(blockId);
                    if (blockIndex > -1) {
                        const currentVisibility = this.state.blocks[blockIndex].isVisible;
                        this.updateState(`blocks.${blockIndex}.isVisible`, currentVisibility === false ? true : false, true, '切换区块可见性');
                    }
                },

                toggleLayerExpansion(blockId, forceOpen = null) {
                    const blockIndex = this.findBlockIndex(blockId);
                    if (blockIndex > -1) {
                        const currentExpansion = this.state.blocks[blockIndex].isExpanded;
                        const newExpansion = forceOpen === null ? !currentExpansion : forceOpen;
                        if (currentExpansion !== newExpansion) {
                            this.state.blocks[blockIndex].isExpanded = newExpansion;
                            this.renderLayerPanel();
                        }
                    }
                },

                duplicateBlock(blockId) {
                    const block = this.findBlock(blockId);
                    if (block) {
                        this.addBlock(block.type, block);
                    }
                },

                // ... 调试模式相关函数 ...
                async activateDebugMode() {
                    if (await this.showConfirm('激活调试模式', '此操作将随机化当前所有设置并替换内容，此过程不可撤销。是否继续？')) {
                        this.showLoading('正在生成随机数据...');
                        this.state = this.generateRandomState();
                        this.history = [{ state: this.deepClone(this.state), description: '调试模式' }];
                        this.historyIndex = 0;
                        this.setSelection({ type: 'global' });
                        this.renderAll(true);
                        this.syncAllControls();
                        this.updateUndoRedoButtons();
                        this.hideLoading();
                        this.showToast('调试模式已激活，所有设置已随机化！', 'success');
                    }
                },
                generateRandomState() {
                    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
                    const randFloat = (min, max) => Math.random() * (max - min) + min;
                    const randBool = () => Math.random() > 0.5;
                    const randChoice = (arr) => arr[rand(0, arr.length - 1)];
                    const safeColors = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#000000', '#ffffff'];
                    const randColor = () => randChoice(safeColors);

                    let randomState = this.deepClone(this.getDefaultState());

                    randomState.personalInfo.nickname = "调试昵称";
                    randomState.personalInfo.subtitle = `Debug Subtitle ${rand(100, 999)}`;
                    randomState.personalInfo.bio = `这是随机生成的简介文本。 The quick brown fox jumps over the lazy dog.`;
                    randomState.personalInfo.nicknameColor = randColor();
                    randomState.personalInfo.subtitleColor = randColor();
                    randomState.personalInfo.bioColor = randColor();
                    randomState.personalInfo.avatarShape = randChoice(['50%', '16px', '0px']);
                    randomState.personalInfo.avatarBorderSize = rand(0, 10);
                    randomState.personalInfo.avatarBorderColor = randColor();
                    randomState.personalInfo.tags = Array.from({ length: rand(3, 5) }, (_, i) => ({ id: this.generateId('t'), icon: null, text: `标签${i + 1}` }));
                    randomState.personalInfo.tagBgColor = randColor();
                    randomState.personalInfo.tagTextColor = randColor();
                    randomState.pageStyles.pageBgMode = randChoice(['solid', 'gradient']);
                    randomState.pageStyles.pageBgSolidColor = randColor();
                    randomState.globalCardStyles.bgColor = randColor();
                    randomState.globalCardStyles.textColor = randColor();

                    randomState.blocks = [];
                    const blockTypes = ['text', 'image', 'button', 'separator', 'spacer'];
                    for (let i = 0; i < rand(5, 8); i++) {
                        const type = randChoice(blockTypes);
                        let newBlock;
                        switch (type) {
                            case 'text':
                                newBlock = { id: this.generateId('b'), isVisible: true, isExpanded: randBool(), type: 'text', title: `随机文本区块 ${i + 1}`, settings: { layout: randChoice(['single', 'dual', 'triple']), masonryEnabled: randBool() }, cards: Array.from({ length: rand(2, 5) }, (_, j) => ({ id: this.generateId('c'), icon: '', title: `随机卡片 ${j + 1}`, content: `随机内容 - ${Math.random().toString(36).substring(2)}`, opacity: 1.0, followGlobalOpacity: true })) };
                                break;
                            case 'image':
                                newBlock = { id: this.generateId('b'), isVisible: true, isExpanded: randBool(), type: 'image', title: `随机图片区块 ${i + 1}`, settings: { layout: randChoice(['single', 'dual', 'triple']), masonryEnabled: randBool(), textColor: randColor() }, cards: [] };
                                break;
                            case 'button':
                                newBlock = { id: this.generateId('b'), isVisible: true, isExpanded: randBool(), type: 'button', title: `随机按钮区块 ${i + 1}`, settings: { gap: rand(10, 25) }, cards: Array.from({ length: rand(1, 3) }, (_, j) => ({ id: this.generateId('c'), icon: '', text: `随机按钮 ${j + 1}` })) };
                                break;
                            case 'separator':
                                newBlock = { id: this.generateId('b'), isVisible: true, isExpanded: false, type: 'separator', title: `随机分割线 ${i + 1}`, settings: { style: randChoice(['solid', 'dashed', 'dotted']), color: randColor(), thickness: rand(1, 5), margin: rand(10, 40), text: 'Random Text', icon: null, textColor: randColor() } };
                                break;
                            case 'spacer':
                                newBlock = { id: this.generateId('b'), isVisible: true, isExpanded: false, type: 'spacer', title: `随机留白 ${i + 1}`, settings: { height: rand(20, 100) } };
                                break;
                        }
                        randomState.blocks.push(newBlock);
                    }
                    return randomState;
                },

                // --- IndexedDB 数据库操作 --- //

                /**
                 * @description 初始化 IndexedDB 数据库。
                 */
                initDB() {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open('BlokkoDB', 2);
                        request.onupgradeneeded = event => {
                            const db = event.target.result;
                            if (!db.objectStoreNames.contains('fonts')) {
                                db.createObjectStore('fonts', { keyPath: 'family' });
                            }
                            if (!db.objectStoreNames.contains('images')) {
                                db.createObjectStore('images', { keyPath: 'id' });
                            }
                        };
                        request.onsuccess = event => {
                            this.db = event.target.result;
                            console.log("数据库初始化成功。");
                            this.checkStorageUsage();
                            resolve();
                        };
                        request.onerror = event => reject(event.target.error);
                    });
                },
                dataURLToBlob(dataurl) {
                    const arr = dataurl.split(',');
                    const header = arr[0];
                    const data = arr[1];

                    const isBase64 = header.includes(';base64');

                    const mimeMatch = header.match(/:(.*?)(;base64)?$/);

                    if (!mimeMatch) {
                        throw new Error('Invalid Data URL header');
                    }

                    const mime = mimeMatch[1]; // e.g., 'image/svg+xml' 或 'image/png'

                    if (isBase64) {
                        const bstr = atob(data);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) u8arr[n] = bstr.charCodeAt(n);
                        return new Blob([u8arr], { type: mime });
                    } else {
                        const decodedData = decodeURIComponent(data);
                        return new Blob([decodedData], { type: mime });
                    }
                },
                async migrateAndSaveImage(dataUrl) {
                    if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
                    try {
                        const blob = this.dataURLToBlob(dataUrl);
                        const imageId = this.generateId('img');
                        await this.saveImageToDB({ id: imageId, blob: blob });
                        return `idb://${imageId}`;
                    } catch (error) {
                        console.error('图片迁移失败:', error);
                        return dataUrl;
                    }
                },
                async processStateForImageMigration(obj) {
                    for (const key in obj) {
                        if (typeof obj[key] === 'string' && obj[key].startsWith('data:image')) {
                            this.showLoading('正在迁移图片数据...');
                            obj[key] = await this.migrateAndSaveImage(obj[key]);
                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                            await this.processStateForImageMigration(obj[key]);
                        }
                    }
                    return obj;
                },
                saveImageToDB(imageData) {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['images'], 'readwrite');
                        const store = transaction.objectStore('images');
                        const request = store.put(imageData);
                        request.onsuccess = () => {
                            this.checkStorageUsage();
                            resolve();
                        };
                        request.onerror = reject;
                    });
                },
                getImageFromDB(id) {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['images'], 'readonly');
                        const store = transaction.objectStore('images');
                        const request = store.get(id);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = reject;
                    });
                },
                saveFontToDB(fontData) {
                    return new Promise((resolve, reject) => {
                        if (!this.db) return reject("数据库未初始化");
                        const transaction = this.db.transaction(['fonts'], 'readwrite');
                        const store = transaction.objectStore('fonts');
                        const request = store.put(fontData);
                        request.onsuccess = () => {
                            this.checkStorageUsage();
                            resolve();
                        };
                        request.onerror = event => {
                            console.error("保存字体到DB失败:", event.target.error);
                            if (event.target.error.name === 'QuotaExceededError') {
                                this.isStorageFull = true;
                                this.showStorageFullToast();
                            }
                            reject(event.target.error);
                        };
                    });
                },
                getFontFromDB(fontFamily) {
                    return new Promise((resolve, reject) => {
                        if (!this.db) return reject("数据库未初始化");
                        const transaction = this.db.transaction(['fonts'], 'readonly');
                        const store = transaction.objectStore('fonts');
                        const request = store.get(fontFamily);
                        request.onsuccess = event => resolve(event.target.result);
                        request.onerror = event => reject(event.target.error);
                    });
                },
                deleteFontFromDB(fontFamily) {
                    return new Promise((resolve, reject) => {
                        if (!this.db) return reject("数据库未初始化");
                        const transaction = this.db.transaction(['fonts'], 'readwrite');
                        const store = transaction.objectStore('fonts');
                        const request = store.delete(fontFamily);
                        request.onsuccess = () => resolve();
                        request.onerror = event => reject(event.target.error);
                    });
                },
                getAllFontsFromDB() {
                    return new Promise((resolve, reject) => {
                        if (!this.db) return reject("数据库未初始化");
                        const transaction = this.db.transaction(['fonts'], 'readonly');
                        const store = transaction.objectStore('fonts');
                        const request = store.getAll();
                        request.onsuccess = event => resolve(event.target.result);
                        request.onerror = event => reject(event.target.error);
                    });
                },
                async loadFontsFromDB() {
                    try {
                        const fonts = await this.getAllFontsFromDB();
                        this.uploadedFonts = [];
                        for (const font of fonts) {
                            this.uploadedFonts.push({ family: font.family, fullName: font.fullName, type: 'uploaded' });
                            try {
                                const fontFace = new FontFace(font.family, font.data);
                                await fontFace.load();
                                document.fonts.add(fontFace);
                            } catch (e) {
                                console.error(`从DB加载字体 "${font.family}" 失败:`, e);
                            }
                        }
                        console.log(`从数据库加载了 ${this.uploadedFonts.length} 个字体。`);
                    } catch (e) {
                        console.error("从DB加载所有字体失败:", e);
                    }
                },
                async showFontManager() {
                    const listEl = this.elements.fontManagerModal.querySelector('#font-manager-list');
                    if (!listEl) return;
                    listEl.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
                    this.elements.fontManagerModal.classList.add('visible');

                    const fonts = await this.getAllFontsFromDB();
                    if (!fonts || fonts.length === 0) {
                        listEl.innerHTML = '<div class="empty-font-list">暂无已上传的字体</div>';
                        return;
                    }

                    listEl.innerHTML = fonts.map(font => `
                        <div class="font-manager-item" data-font-family="${this.escapeHTML(font.family)}">
                            <span class="font-manager-item-name">${this.escapeHTML(font.fullName)}</span>
                            <button class="btn btn-danger btn-icon font-delete-btn" title="删除字体">
                                <span class="iconify" data-icon="mdi:delete"></span>
                            </button>
                        </div>
                    `).join('');
                },
                async deleteFont(fontFamily) {
                    if (await this.showConfirm('删除字体', `确定要删除字体 "${fontFamily}" 吗？此操作不可撤销。`)) {
                        try {
                            this.pushHistory(`删除字体 ${fontFamily}`);
                            await this.deleteFontFromDB(fontFamily);
                            this.uploadedFonts = this.uploadedFonts.filter(f => f.family !== fontFamily);
                            if (this.state.globalCardStyles.fontFamily === fontFamily) {
                                this.updateState('globalCardStyles.fontFamily', '', false);
                            }
                            this.populateFontList();
                            this.showFontManager();
                            this.showToast(`字体 "${fontFamily}" 已删除。`, 'success');
                        } catch (e) {
                            this.showErrorModal('删除失败', '从数据库删除字体时出错。');
                        }
                    }
                },

                /**
                 * @description 根据图片URL从数据库中删除图片。
                 * @param {string|null} url - 图片的URL, 格式为 'idb://<id>'。
                 */
                async deleteImageByUrl(url) {
                    if (url && url.startsWith('idb://')) {
                        const imageId = url.substring(6);
                        try {
                            await this.deleteImageFromDB(imageId);
                        } catch (e) {
                            console.error(`删除图片 ${imageId} 失败:`, e);
                        }
                    }
                },

                /**
                 * @description 从数据库中删除图片。
                 * @param {string} id - 图片的ID。
                 */
                deleteImageFromDB(id) {
                    if (!id || !this.db) return Promise.resolve();
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['images'], 'readwrite');
                        const store = transaction.objectStore('images');
                        const request = store.delete(id);
                        request.onsuccess = () => {
                            console.log(`图片 ${id} 已从数据库删除。`);
                            this.checkStorageUsage();
                            resolve();
                        };
                        request.onerror = (e) => {
                            console.error(`从数据库删除图片 ${id} 失败:`, e.target.error);
                            reject(e.target.error);
                        };
                    });
                },

                async checkStorageUsage() {
                    if ('storage' in navigator && 'estimate' in navigator.storage) {
                        try {
                            const { usage, quota } = await navigator.storage.estimate();
                            const usagePercent = (usage / quota) * 100;
                            if (usagePercent > 80) {
                                this.showStorageFullToast(true);
                            } else {
                                this.showStorageFullToast(false);
                            }
                        } catch (error) {
                            console.warn('无法获取存储估算:', error);
                        }
                    }
                },

                showStorageFullToast(show) {
                    if (show) {
                        this.elements.storageWarningBanner.style.display = 'block';
                        this.elements.body.classList.add('storage-warning');
                    } else {
                        this.elements.storageWarningBanner.style.display = 'none';
                        this.elements.body.classList.remove('storage-warning');
                    }
                },

                sanitizeHTML(htmlString) {
                    if (!htmlString) return '';
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlString;
                    tempDiv.querySelectorAll('script, style, link, object, embed, iframe').forEach(el => el.remove());
                    tempDiv.querySelectorAll('*').forEach(el => {
                        for (const attr of [...el.attributes]) {
                            if (attr.name.startsWith('on')) {
                                el.removeAttribute(attr.name);
                            }
                        }
                    });
                    return tempDiv.innerHTML;
                },

                renderMobileEditPencils() {
                    this.elements.previewWrapper.querySelectorAll('.mobile-edit-pencil').forEach(p => p.remove());

                    const isLocked = this.elements.previewBlocksContainer.classList.contains('locked-mode');
                    if (isLocked) return;

                    this.elements.previewWrapper.querySelectorAll('[data-state-key], [data-card-key], [data-separator-text-key], .tag-pill span[data-tag-id]').forEach(el => {
                        const pencil = document.createElement('div');
                        pencil.className = 'mobile-edit-pencil';
                        pencil.innerHTML = '<span class="iconify" data-icon="mdi:pencil"></span>';
                        el.appendChild(pencil);
                    });
                },
            };
            App.init();
        });
    