
        // Anti-FOUC (Flash of Unstyled Content) 脚本
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
             * @description Blokko 2.0 主应用对象，封装了所有状态管理和UI逻辑。
             * @type {object}
             */
            const App = {
                version: '2.0.0',
                pixabayApiKey: '53274475-6295c67fa26c85aa8b2331ee7',
                db: null, // 数据库实例
                isStorageFull: false, // 标记浏览器存储空间是否已满
                state: {}, // 应用的核心状态对象，包含所有用户数据和设置
                selection: { type: 'global', itemId: null }, // 当前选中的编辑目标
                history: [], // 操作历史记录，用于实现撤销/重做
                historyIndex: -1, // 当前历史记录的指针
                isRestoringState: false, // 标记是否正在从历史记录中恢复状态，防止触发不必要的回调
                isEditingText: false, // 标记是否正在进行内联文本编辑，防止冲突
                cropper: null, // Cropper.js 实例
                currentCropTarget: null, // 当前裁剪操作的目标信息
                currentFilterState: {}, // 当前裁剪会话中的滤镜状态
                currentIconTarget: null, // 当前图标选择器的目标信息
                richTextEditor: null, // Quill.js 富文本编辑器实例
                currentRichTextTarget: null, // 当前富文本编辑器的目标信息
                sortableLayers: null, // SortableJS 实例
                sortablePreview: null,
                sortableTags: null,
                sortablePreviewTags: null,
                debouncedSaveToLocal: null, // 防抖处理后的本地保存函数
                localFonts: [], // 从用户本地系统加载的字体列表
                uploadedFonts: [], // 用户上传的字体元信息列表
                presets: {}, // 内置的预设主题
                icons: [], // 自定义上传的图标列表
                texturePickerInitialized: false, // 标记纹理选择器是否已初始化
                iconPickerInitialized: false, // 标记图标选择器是否已初始化
                colorThief: null, // ColorThief 实例
                longPressTimer: null, // 移动端长按计时器
                lastPalette: [], // 上一次从图片提取的调色板
                easterEggCounter: 0, // 彩蛋点击计数器
                easterEggTimer: null, // 彩蛋计时器
                tooltipTimeout: null, // 提示框 (Tooltip) 的显示计时器
                stashedBorderRadius: null, // 用于暂存被禁用的圆角值

                /**
                 * @description 应用初始化入口函数。
                 */
                init() {
                    console.log(`Blokko 初始化 v${this.version} ...`);

                    this.elements = this.queryElements();
                    this.presets = this.getPresets();
                    this.state = this.getDefaultState();
                    this.debouncedSaveToLocal = this.debounce(this.saveToLocal, 500);
                    
                    this.debouncedApplySmartPalette = this.debounce(this.applySmartPalette, 200);

                    this.initDB().then(async () => {
                        this.bindCoreEvents();
                        this.bindPreviewEvents();

                        this.loadPreferences();
                        await this.loadFromLocal();

                        this.history = [{ state: this.deepClone(this.state), description: '初始状态' }];
                        this.historyIndex = 0;

                        this.renderAll(true);
                        this.syncAllControls();
                        this.populateFontList();

                        this.setSelection({ type: 'global' });
                        this.updateUndoRedoButtons();
                        this.updatePreviewAspectRatio();

                        // 延迟加载非关键任务，优化首次可交互时间(TTI)
                        setTimeout(() => {
                            this.bindEditorEvents();
                            this.initResizer();
                            this.initAllSortables();
                        }, 0);

                        const lastVisitedVersion = localStorage.getItem('blokkoLastVersion');
                        const hasSeenTutorial = localStorage.getItem('blokkoHasSeenTutorial');

                        if (!hasSeenTutorial) {
                            setTimeout(() => {
                                this.elements.helpModal.classList.add('visible');
                                const helpContainer = this.elements.helpModal.querySelector('.modal-container');
                                helpContainer.querySelector('.tab-btn[data-tab="help-tutorial"]').click();
                                localStorage.setItem('blokkoHasSeenTutorial', 'true');
                                localStorage.setItem('blokkoLastVersion', this.version);
                            }, 1000);
                        } else if (this.version !== lastVisitedVersion) {
                            setTimeout(() => {
                                this.showToast(`已更新到 v${this.version}！点击“帮助”查看更新日志。`, 'success');
                                this.elements.helpModal.classList.add('visible');
                                this.elements.helpModal.querySelector('.tab-btn[data-tab="help-changelog"]').click();
                            }, 1500);
                            localStorage.setItem('blokkoLastVersion', this.version);
                        }

                    }).catch(err => {
                        console.error("数据库初始化失败:", err);
                        this.showFatalErrorModal('初始化失败', '无法初始化本地数据库，这可能是由于浏览器缓存损坏。您可以先尝试刷新页面，若刷新无果，请尝试备份数据后重置应用来解决此问题。', err);
                    });
                },

                /**
                 * @description 获取应用的默认初始状态。
                 */
                getDefaultState() {
                    const lightTheme = this.getPresets().light;
                    return {
                        version: this.version,
                        ui: { // 用户界面相关的状态
                            activeInspectorTab: 'global'
                        },
                        systemSettings: {
                            exportFilePrefix: 'Blokko',
                            masonryEnabled: false,
                            previewGap: 20
                        },
                        globalTheme: { // 全局色板
                            primary: '#007AFF',
                            accent: '#007AFF',
                            background: '#FFFFFF',
                            text: '#1a1a1a',
                        },
                        customIcons: [],
                        personalInfo: {
                            isVisible: true,
                            layout: 'default',
                            statusBadge: 'none', // 状态挂件: 'none', 'online', 'dnd', 'idle', 'invisible', 'emoji'
                            statusBadgeEmoji: '🟢',
                            nickname: "你的昵称", nicknameColor: lightTheme.pNicknameColor,
                            subtitle: "这是副标题，双击可编辑", subtitleColor: lightTheme.pSubtitleColor,
                            bio: "这是简介，双击可编辑", bioColor: lightTheme.pBioColor,
                            avatarDataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E",
                            avatarShape: '50%', avatarBorderSize: 4, avatarBorderColor: '#ffffff',
                            avatarSize: 100,
                            avatarOffsetX: 0,
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
                        globalBorderSettings: { // 全局边框系统
                            style: 'solid',
                            width: 1,
                            color: '#e0e0e0',
                            shadowOffset: 4,
                            shadowColor: '#000000',
                            applyTo: {
                                personalInfo: true,
                                card: true,
                                image: true,
                                button: false,
                                music: false,
                                progress: false,
                                timeline: false,
                            },
                            
                            globalShadowSettings: {
                                color: "#000000", opacity: 0, // 默认关闭
                                offsetX: 0, offsetY: 4, blur: 10,
                                applyTo: {
                                    personalInfo: true, card: true, image: true,
                                    button: false, music: true, progress: false, timeline: false
                                }
                            }
                        },
                        items: [ 
                            { id: this.generateId('c'), type: 'card', isVisible: true, title: "这是卡片模块", content: "双击这里或手机端点击铅笔进行编辑，现在支持<b>富文本</b>了哦！", sticker: 'none', imageFillMode: 'cover', layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'button', isVisible: true, title: "按钮模块", icon: 'mdi:github', text: "访问我的主页", layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'music', isVisible: true, title: "音乐模块", style: 'default', coverArt: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E", songTitle: '歌曲名称', artist: '歌手', lyrics: '上一句歌词\n当前播放的高亮歌词\n下一句歌词', currentTime: '01:30', totalTime: '03:45', accentColor: lightTheme.accent, bgColor: '#ffffff', opacity: 1, radius: 12, layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'progress', isVisible: true, title: "进度条模块", label: '技能点', percentage: 75, color: '#007AFF', trackColor: '#eeeeee', thickness: 8, layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'timeline', isVisible: true, title: "时间轴模块", timeColor: '#888888', accentColor: lightTheme.accent, cards: [{ id: this.generateId('c'), time: '2025-11-21', content: '《时之歌Project》十周年快乐！' }], layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'separator', isVisible: true, title: "分隔线", style: 'solid', color: '#dddddd', thickness: 1, margin: 20, text: '', icon: null, textColor: '#555555', layout: { width: 100 } },
                            { id: this.generateId('c'), type: 'spacer', isVisible: true, title: "留白占位", height: 20, layout: { width: 100 } },
                        ],
                        globalComponentStyles: { 
                            bgMode: 'solid',
                            bgColor: lightTheme.gCardBgColor, textColor: lightTheme.gCardTextColor, opacity: 1.0,
                            bgGradientStart: lightTheme.gCardBgGradientStart, bgGradientEnd: lightTheme.gCardBgGradientEnd,
                            bgGradientAngle: 135,
                            radius: 12, textAlign: "left", lineHeight: "1.5", padding: 15,
                            fontFamily: "",
                            titleColor: null,
                            titleFontSize: "1.1em",
                            contentFontSize: "0.95em",
                            textStrokeWidth: 0, textStrokeColor: "#000000",
                            
                            shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 10,
                            shadowColor: "#000000", shadowOpacity: 0,
                        },
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
                            accent: '#007AFF',
                        },
                        dark: {
                            pageBgSolidColor: "#121417", pageBgGradientStart: "#121417", pageBgGradientEnd: "#1a1d21",
                            headerBgColor: "#1f2229", headerBgGradientStart: "#1f2229", headerBgGradientEnd: "#252930",
                            headerTextColor: "#f0f2f5",
                            gCardBgColor: "#2c303a", gCardTextColor: "#f0f2f5", gCardOpacity: 0.95,
                            gCardBgGradientStart: "#2c303a", gCardBgGradientEnd: "#343946",
                            pNicknameColor: "#f0f2f5", pSubtitleColor: "#a0aec0", pBioColor: "#a0aec0",
                            pTagBgColor: "#3e4451", pTagTextColor: "#e2e8f0",
                            accent: '#3498db',
                        },
                        mint: {
                            pageBgSolidColor: "#ccfbf1", pageBgGradientStart: "#ccfbf1", pageBgGradientEnd: "#a7f3d0",
                            headerBgColor: "#f0fdfa", headerBgGradientStart: "#f0fdfa", headerBgGradientEnd: "#e6fcf5",
                            headerTextColor: "#0f766e",
                            gCardBgColor: "#ffffff", gCardTextColor: "#134e4a", gCardOpacity: 1.0,
                            gCardBgGradientStart: "#ffffff", gCardBgGradientEnd: "#fafffd",
                            pNicknameColor: "#064e3b", pSubtitleColor: "#115e59", pBioColor: "#134e4a",
                            pTagBgColor: "#a7f3d0", pTagTextColor: "#065f46",
                            accent: '#10b981',
                        },
                        coffee: {
                            pageBgSolidColor: "#f3e8e2", pageBgGradientStart: "#f3e8e2", pageBgGradientEnd: "#e9d8cf",
                            headerBgColor: "#fdf8f6", headerBgGradientStart: "#fdf8f6", headerBgGradientEnd: "#faf3ef",
                            headerTextColor: "#432818",
                            gCardBgColor: "#ffffff", gCardTextColor: "#5e4534", gCardOpacity: 1.0,
                            gCardBgGradientStart: "#ffffff", gCardBgGradientEnd: "#fffbf8",
                            pNicknameColor: "#432818", pSubtitleColor: "#6f4e37", pBioColor: "#5e4534",
                            pTagBgColor: "#e3d5ca", pTagTextColor: "#432818",
                            accent: '#967259',
                        }
                    };
                },

                /**
                 * @description 查询并缓存所有需要操作的DOM元素。
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
                        previewItemsContainer: q('#preview-items-container'),
                        previewHeader: q('#preview-header'),
                        addCardItemBtn: q('#add-card-item-btn'),
                        addImageItemBtn: q('#add-image-item-btn'),
                        addButtonItemBtn: q('#add-button-item-btn'),
                        addMusicItemBtn: q('#add-music-item-btn'),
                        addProgressItemBtn: q('#add-progress-item-btn'),
                        addTimelineItemBtn: q('#add-timeline-item-btn'),
                        addSeparatorItemBtn: q('#add-separator-item-btn'),
                        addSpacerItemBtn: q('#add-spacer-item-btn'),
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
                        exportModal: q('#export-modal'),
                        imageSourceModal: q('#image-source-modal'),
                        pixabaySearchModal: q('#pixabay-search-modal'),
                    };
                },

                /**
                 * @description 绑定应用的核心事件监听器 (例如: 主题切换, 添加区块等)。
                 */
                bindCoreEvents() {
                    this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
                    this.elements.addCardItemBtn.addEventListener('click', () => this.addItem('card'));
                    this.elements.addImageItemBtn.addEventListener('click', () => document.getElementById('add-image-file-input').click());
                    this.elements.addButtonItemBtn.addEventListener('click', () => this.addItem('button'));
                    this.elements.addMusicItemBtn.addEventListener('click', () => this.addItem('music'));
                    this.elements.addProgressItemBtn.addEventListener('click', () => this.addItem('progress'));
                    this.elements.addTimelineItemBtn.addEventListener('click', () => this.addItem('timeline'));
                    this.elements.addSeparatorItemBtn.addEventListener('click', () => this.addItem('separator'));
                    this.elements.addSpacerItemBtn.addEventListener('click', () => this.addItem('spacer'));

                    this.elements.downloadModalCloseBtn.addEventListener('click', () => this.hideDownloadModal());
                    this.elements.cropperCancelBtn.addEventListener('click', () => this.hideCropper());
                    this.elements.cropperSaveBtn.addEventListener('click', () => this.saveCrop());
                    this.elements.cropperModal.querySelector('.crop-ratios').addEventListener('change', () => this.updateCropAspectRatio());

                    this.elements.imageSourceModal.addEventListener('click', e => {
                        const target = e.target.closest('button');
                        if (!target) return;
                        if (target.id === 'upload-from-device-btn') {
                            const input = document.getElementById('physical-image-upload-input');
                            if (input) input.click();
                        } else if (target.id === 'search-online-btn') {
                            this.showPixabaySearch(); // 这个函数将在下一步添加
                        }
                        // 点击取消按钮时才关闭
                        if (target.id !== 'search-online-btn' && target.id !== 'upload-from-device-btn') {
                            this.elements.imageSourceModal.classList.remove('visible');
                        }
                    });

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

                    this.elements.appContainer.addEventListener('click', (e) => {
                        if (e.target === this.elements.appContainer && this.elements.body.classList.contains('panels-open')) {
                            this.togglePanelDrawer(false);
                        }
                    });

                    this.elements.showHelpBtn.addEventListener('click', () => this.elements.helpModal.classList.add('visible'));
                    this.elements.helpModalCloseBtn.addEventListener('click', () => this.elements.helpModal.classList.remove('visible'));

                    this.elements.storageWarningBanner.querySelector('#storage-warning-manage-link').addEventListener('click', () => {
                        this.showToast('资源管理器功能正在开发中...', 'info');
                    });

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

                    this.elements.lockModeToggle.addEventListener('click', () => this.toggleLockMode());
                    document.getElementById('add-image-file-input').addEventListener('change', e => {
                        this.handleImageGalleryUpload(e.target.files);
                        e.target.value = '';
                    });

                    this.elements.richTextSaveBtn.addEventListener('click', () => this.saveRichText());
                    this.elements.richTextCancelBtn.addEventListener('click', () => this.hideRichTextEditor());

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

                    this.elements.layerList.addEventListener('click', e => {
                        const layerItem = e.target.closest('.layer-item');
                        if (!layerItem) return;

                        const actionBtn = e.target.closest('.layer-actions button');
                        if (actionBtn) {
                            const { type, id } = layerItem.dataset;
                            if (type === 'personalInfo') return;

                            if (actionBtn.matches('.toggle-visibility-btn')) this.toggleItemVisibility(id);
                            else if (actionBtn.matches('.duplicate-item-btn')) this.duplicateItem(id);

                            return;
                        }

                        const { type, id } = layerItem.dataset;
                        this.setSelection({ type, id });
                    });

                    this.elements.texturePickerCloseBtn.addEventListener('click', () => this.elements.texturePickerModal.classList.remove('visible'));
                    this.elements.removeTextureBtn.addEventListener('click', () => this.selectTexture(null));
                    this.elements.textureGrid.addEventListener('click', e => {
                        const item = e.target.closest('.texture-grid-item');
                        if (item) this.selectTexture(item.dataset.textureName);
                    });

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

                            const itemId = layerItem.dataset.id;
                            this.updateItem(itemId, 'title', layerNameEl.innerText, true, `重命名模块为 "${layerNameEl.innerText}"`);
                            const inspectorTitleInput = this.elements.inspectorPanel.querySelector(`.editor-item[data-item-id="${itemId}"] .editor-item-title-input`);
                            if (inspectorTitleInput) inspectorTitleInput.value = layerNameEl.innerText;
                        };
                        const handleKeydown = (ev) => {
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                layerNameEl.blur();
                            } else if (ev.key === 'Escape') {
                                layerNameEl.innerText = this.findItem(layerItem.dataset.id).title;
                                layerNameEl.blur();
                            }
                        };
                        layerNameEl.addEventListener('blur', handleEditEnd);
                        layerNameEl.addEventListener('keydown', handleKeydown);
                    });

                    this.elements.colorContextMenu.addEventListener('click', e => {
                        const action = e.target.dataset.action;
                        const color = this.elements.colorContextMenu.dataset.color;
                        if (action && color) this.applyQuickColor(action, color);
                        this.hideColorContextMenu();
                    });
                    document.addEventListener('click', (e) => {
                        if (!e.target.closest('#color-context-menu')) this.hideColorContextMenu();
                        if (!e.target.closest('#preview-context-menu')) document.getElementById('preview-context-menu').style.display = 'none';
                    });

                    // 绑定右键菜单
                    this.bindPreviewContextMenu();

                    // 初始化分享系统的事件绑定
                    this.initShareSystem();

                    // 绑定分享按钮
                    this.elements.inspectorPanel.addEventListener('click', e => {
                        if (e.target.id === 'share-style-btn') this.openShareModal();
                    });
                    document.getElementById('share-style-close-btn').addEventListener('click', () => {
                        document.getElementById('share-style-modal').classList.remove('visible');
                    });

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

                    // 移动端滑块拖动优化
                    const handleSliderStart = (e) => {
                        if (e.target.matches('input[type="range"]')) {
                            panel.classList.add('is-dragging-slider');
                            document.addEventListener('touchend', handleSliderEnd, { once: true });
                            document.addEventListener('mouseup', handleSliderEnd, { once: true });
                        }
                    };
                    const handleSliderEnd = () => {
                        panel.classList.remove('is-dragging-slider');
                    };
                    panel.addEventListener('touchstart', handleSliderStart, { passive: true });
                    panel.addEventListener('mousedown', handleSliderStart);

                    // Inspector Tab 切换
                    panel.querySelector('.inspector-tabs').addEventListener('click', (e) => {
                        const tabBtn = e.target.closest('.inspector-tab-btn');
                        if (tabBtn && !tabBtn.classList.contains('active')) {
                            this.updateState('ui.activeInspectorTab', tabBtn.dataset.tab, false);
                            this.renderInspector();
                        }
                    });

                    panel.addEventListener('input', e => {
                        if (this.isRestoringState) return;
                        const target = e.target;

                        if (target.id === 'smart-palette-input') {
                            // [修改] 调用防抖后的函数，防止拖动时卡顿
                            this.debouncedApplySmartPalette(target.value);
                            return;
                        }

                        if (target.matches('.tag-manager-item .tag-text-input')) {
                            const tagItem = target.closest('.tag-manager-item');
                            if (tagItem) this.updateTag(tagItem.dataset.tagId, 'text', target.value, false);
                        }

                        if (target.matches('#font-search-input')) {
                            this.populateFontList(target.value);
                            return;
                        }

                        const updateSource = target.closest('[data-state-key], [data-item-key], [data-color-sync-key], [data-item-id-for-title]');
                        if (!updateSource) return;

                        let value = target.type === 'checkbox' ? target.checked : (target.type === 'number' || target.type === 'range') ? parseFloat(target.value) : target.value;

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
                        const itemEl = keySource.closest('.editor-item');
                        const itemKey = keySource.dataset.itemKey;
                        const itemIdForTitle = updateSource.dataset.itemIdForTitle;

                        if (stateKey) {
                            this.updateState(stateKey, value, false);
                            if (stateKey === 'globalBorderSettings.style') {
                                this.updateBorderRadiusControls();
                            }
                        } else if (itemIdForTitle) {
                            this.updateItem(itemIdForTitle, 'title', value, false);
                        } else if (itemEl && itemKey) {
                            this.updateItem(itemEl.dataset.itemId, itemKey, value, false);
                        }

                        else if (itemEl && keySource.dataset.timelineCardKey) {
                            const cardEl = keySource.closest('.timeline-event-editor');
                            if (cardEl) {
                                this.updateTimelineCard(itemEl.dataset.itemId, cardEl.dataset.cardId, keySource.dataset.timelineCardKey, value, false);
                            }
                        }

                        if (target.type === 'range') {
                            const valueDisplay = target.closest('.form-group').querySelector('span[class*="-value"]');
                            if (valueDisplay) valueDisplay.textContent = value;
                        }
                    });

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
                                const stateKey = target.dataset.stateKey;
                                if (stateKey) {
                                    const currentStateValue = stateKey.split('.').reduce((o, k) => o && o[k], this.state);
                                    target.value = currentStateValue || '#000000';
                                }
                            }
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            target.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, true);

                    panel.addEventListener('change', e => {
                        if (this.isRestoringState) return;
                        const target = e.target;

                        if (target.matches('.advanced-toggle')) {
                            const section = target.closest('.editor-section, .editor-item-content');
                            const isOpen = section.classList.toggle('show-advanced');

                            if (section.id) {
                                localStorage.setItem(`blokko-advanced-${section.id}`, isOpen);
                            } else {
                                const itemEl = target.closest('.editor-item');
                                if (itemEl) {
                                    this.updateItem(itemEl.dataset.itemId, 'isAdvancedOpen', isOpen, false);
                                }
                            }
                            return;
                        }

                        if (target.dataset.stateKey || target.closest('.editor-item') || target.dataset.colorSyncKey || target.matches('.tag-manager-item .tag-text-input')) {
                            let description = '修改样式';
                            if (target.dataset.stateKey) description = `修改 ${target.dataset.stateKey.split('.').pop()}`;
                            if (target.closest('.editor-item')) description = `修改模块设置`;
                            if (target.matches('.tag-text-input')) description = '修改标签';
                            this.pushHistory(description);
                        }

                        if (target.type === 'radio') {
                            if (target.name === 'avatarBadge') {
                                const emojiContainer = panel.querySelector('#emoji-input-container');
                                if (emojiContainer) emojiContainer.style.display = target.value === 'emoji' ? 'block' : 'none';
                            }
                            if (target.closest('.editor-item')) {
                                this.renderInspectorContent();
                            }
                        }

                        const fileInputs = {
                            '#avatar-upload': 'avatar',
                            '#physical-image-upload-input': 'pageBg',
                            '#color-thief-upload': 'colorThief'
                        };
                        for (const selector in fileInputs) {
                            if (target.matches(selector)) this.handleImageUpload(e, fileInputs[selector]);
                        }
                        if (target.matches('#font-upload-input')) this.handleFontUpload(e);
                        if (target.matches('#config-file-input')) this.handleConfigFile(e);
                        if (target.matches('.card-bg-upload')) {
                            const itemEl = target.closest('.editor-item');
                            if (itemEl) this.handleItemBgUpload(e, itemEl.dataset.itemId);
                        }
                        if (target.matches('.image-upload-input')) {
                            const itemEl = target.closest('.editor-item');
                            if (itemEl) {
                                this.handleImageGalleryUpload(itemEl.dataset.itemId, e.target.files);
                            }
                        }
                        if (target.matches('#music-cover-upload')) {
                            const itemEl = target.closest('.editor-item');
                            if (itemEl) this.handleMusicCoverUpload(e, itemEl.dataset.itemId);
                        }

                        if (target.matches('#lock-aspect-ratio-toggle, #custom-width-input, #custom-height-input')) {
                            this.updatePreviewAspectRatio();
                        }

                        if (target.matches('#hd-export-toggle, #custom-width-toggle, #export-rounded-corners-toggle, #export-corner-radius-input, #mobile-export-toggle, #lock-aspect-ratio-toggle')) {
                            const mobileExportToggle = panel.querySelector('#mobile-export-toggle');
                            const customWidthToggle = panel.querySelector('#custom-width-toggle');
                            const customWidthInput = panel.querySelector('#custom-width-input');
                            const customHeightInput = panel.querySelector('#custom-height-input');
                            const lockRatioToggle = panel.querySelector('#lock-aspect-ratio-toggle');
                            const hdExportToggle = panel.querySelector('#hd-export-toggle');

                            if (target.id === 'mobile-export-toggle') {
                                this.elements.body.classList.toggle('mobile-export-preview-mode', target.checked);
                                if (target.checked) {
                                    this.elements.body.classList.remove('mobile-wide-export-preview');
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

                                customWidthInput.disabled = !target.checked;
                                lockRatioToggle.disabled = !target.checked;
                                customHeightInput.disabled = !target.checked || lockRatioToggle.checked;

                                if (target.checked) {
                                    hdExportToggle.checked = false;
                                    mobileExportToggle.checked = false;
                                    this.elements.body.classList.remove('mobile-export-preview-mode');
                                }
                                this.updatePreviewAspectRatio();
                            } else if (target.id === 'lock-aspect-ratio-toggle') {
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
                    });

                    panel.addEventListener('click', e => {
                        const target = e.target;

                        const richTextTrigger = target.closest('.rich-text-editor-trigger, .edit-content-btn');
                        if (richTextTrigger) {
                            const itemEl = richTextTrigger.closest('.editor-item');
                            if (itemEl) {
                                const itemId = itemEl.dataset.itemId;
                                const previewItemContent = this.elements.previewItemsContainer
                                    .querySelector(`.preview-item-wrapper[data-item-id="${itemId}"] .preview-card-content`);
                                if (previewItemContent) this.showRichTextEditor(previewItemContent);
                            }
                            return;
                        }

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

                        const legend = target.closest('.editor-section > legend');
                        if (legend) {
                            legend.parentElement.classList.toggle('collapsed');
                            return;
                        }

                        const tabBtn = target.closest('.tabs .tab-btn');
                        if (tabBtn) {
                            const parent = tabBtn.closest('.tab-group-wrapper, .editor-section > .section-content');
                            if (parent) {
                                parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                                tabBtn.classList.add('active');
                                parent.querySelectorAll(':scope > .tab-content').forEach(content => content.classList.remove('active'));
                                const targetTab = parent.querySelector(`#${tabBtn.dataset.tab}`);
                                if (targetTab) targetTab.classList.add('active');

                                const newMode = tabBtn.dataset.tab.includes('gradient') ? 'gradient' : 'solid';

                                // 关键修复：根据不同的父容器，更新对应的mode状态
                                if (parent.closest('#global-component-styles-section')) {
                                    this.updateState('globalComponentStyles.bgMode', newMode, true, '切换全局组件背景模式');
                                } else if (parent.closest('#page-styles-section')) {
                                    if (tabBtn.dataset.tab.startsWith('page-bg-')) {
                                        this.updateState('pageStyles.pageBgMode', newMode, true, '切换页面背景模式');
                                    } else if (tabBtn.dataset.tab.startsWith('header-bg-')) {
                                        this.updateState('pageStyles.headerBgMode', newMode, true, '切换头部背景模式');
                                    }
                                }
                                return; // 处理完Tab点击，提前返回
                            }
                        }

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
                            '#random-palette-btn': () => this.applyRandomPalette(),
                            '#smart-palette-btn': () => panel.querySelector('#smart-palette-input')?.click(),
                        };
                        for (const selector in actions) {
                            if (actionButton.matches(selector)) {
                                actions[selector]();
                                return;
                            }
                        }

                        if (actionButton.dataset.preset) this.applyPreset(this.presets[actionButton.dataset.preset]);

                        if (actionButton.dataset.resetKey) {
                            const keyPath = actionButton.dataset.resetKey;
                            const keyMap = { nicknameColor: 'pNicknameColor', subtitleColor: 'pSubtitleColor', bioColor: 'pBioColor', tagBgColor: 'pTagBgColor', tagTextColor: 'pTagTextColor' };
                            const basePreset = this.presets.light;
                            const key = keyPath.split('.')[1];
                            const defaultValue = basePreset[keyMap[key]] || '#ffffff';
                            this.updateState(keyPath, defaultValue, true, '重置颜色');
                            this.showToast('颜色已重置', 'info');
                        }

                        const tagItem = target.closest('.tag-manager-item');
                        if (tagItem) {
                            if (target.closest('.tag-icon-btn')) { this.initIconPicker(); this.showIconPicker('tag', tagItem.dataset.tagId); }
                            if (target.closest('.tag-delete-btn')) this.deleteTag(tagItem.dataset.tagId);
                        }

                        const historyItem = target.closest('.history-item');
                        if (historyItem) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.jumpToHistory(parseInt(historyItem.dataset.index, 10));
                            return;
                        }

                        const itemEl = target.closest('.editor-item');
                        if (itemEl) {
                            const itemId = itemEl.dataset.itemId;
                            if (target.closest('.item-delete-btn')) { this.deleteItem(itemId); }
                            else if (target.closest('.card-delete-btn')) {
                                const cardEl = target.closest('.timeline-event-editor');
                                if (cardEl) this.deleteTimelineCard(itemId, cardEl.dataset.cardId);
                            }
                            else if (target.closest('.add-timeline-event-btn')) this.addTimelineEvent(itemId);
                            else if (target.closest('.card-clear-bg-btn')) {
                                const item = this.findItem(itemId);
                                const oldImageUrl = item?.bgImageDataUrl;
                                this.updateItem(itemId, 'bgImageDataUrl', null, true, '清除卡片背景图');
                                this.deleteImageByUrl(oldImageUrl);
                                this.showToast('卡片背景图已清除', 'info');
                            }
                            else if (target.closest('.crop-image-btn')) this.cropImage(itemId);
                            else if (target.closest('.select-icon-btn')) {
                                this.initIconPicker();
                                this.showIconPicker('item', itemId);
                            }
                            else if (target.closest('[data-reset-item-key]')) {
                                const keyToReset = target.closest('[data-reset-item-key]').dataset.resetItemKey;
                                this.updateItem(itemId, keyToReset, null, true, '重置模块样式');
                                this.showToast('已重置为全局样式', 'info');
                            }
                        }
                    });

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
                        const pencil = e.target.closest('.mobile-edit-pencil');
                        if (pencil) {
                            e.preventDefault();
                            e.stopPropagation();
                            const target = pencil.parentElement;
                            if (target.matches('.preview-card-content[data-item-key="content"]')) {
                                this.showRichTextEditor(target);
                            } else if (target.closest('[data-state-key], [data-item-key], [data-tag-text-id], [data-separator-text-key]')) {
                                this.triggerInlineEdit(target);
                            }
                            return;
                        }

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

                        if (this.isEditingText) return;

                        const header = e.target.closest('.preview-header');
                        if (header) {
                            this.setSelection({ type: 'personalInfo' });
                            return;
                        }

                        const itemWrapper = e.target.closest('.preview-item-wrapper');
                        if (itemWrapper && itemWrapper.dataset.itemId) {
                            this.setSelection({ type: 'item', id: itemWrapper.dataset.itemId });
                        } else {
                            if (e.target.closest('.preview-wrapper')) {
                                this.setSelection({ type: 'global' });
                            }
                        }
                    });

                    this.elements.previewWrapper.addEventListener('dblclick', e => {
                        if (this.elements.previewItemsContainer.classList.contains('locked-mode')) return;

                        const cardContentTarget = e.target.closest('.preview-card-content[data-item-key="content"]');
                        if (cardContentTarget) {
                            this.showRichTextEditor(cardContentTarget);
                            return;
                        }

                        const target = e.target.closest('[data-state-key], [data-item-key], [data-tag-text-id], [data-separator-text-key]');
                        if (target) {
                            this.triggerInlineEdit(target);
                        }
                    });

                    this.elements.previewWrapper.addEventListener('input', e => {
                        const target = e.target;
                        if (target.contentEditable === 'true') {
                            const stateKey = target.dataset.stateKey;
                            const itemKey = target.dataset.itemKey;
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
                            } else if (itemKey) {
                                const itemEl = target.closest('.preview-item-wrapper');
                                if (itemEl) {
                                    const item = this.findItem(itemEl.dataset.itemId);
                                    if (item) item[itemKey] = value;

                                    const editorInput = this.elements.inspectorPanel.querySelector(`[data-item-id="${itemEl.dataset.itemId}"] [data-item-key="${itemKey}"]`);
                                    if (editorInput) editorInput.value = value;
                                    this.renderLayerPanel();
                                }
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

                    this.elements.previewWrapper.addEventListener('touchstart', e => {
                        if (this.elements.previewItemsContainer.classList.contains('locked-mode')) return;

                        clearTimeout(this.longPressTimer);

                        this.longPressTimer = setTimeout(() => {
                            e.preventDefault();
                            this.vibrate(70);

                            let selection = null;
                            let controlToHighlight = null;

                            const itemWrapperTarget = e.target.closest('.preview-item-wrapper');
                            const headerTarget = e.target.closest('.preview-header');

                            if (itemWrapperTarget) {
                                const itemId = itemWrapperTarget.dataset.itemId;
                                selection = { type: 'item', id: itemId };
                                controlToHighlight = `.editor-item[data-item-id="${itemId}"]`;
                            } else if (headerTarget) {
                                selection = { type: 'personalInfo' };
                                controlToHighlight = '#personal-info-section';
                            }

                            if (selection) {
                                this.setSelection(selection);
                                this.togglePanelDrawer('inspector-panel');

                                setTimeout(() => {
                                    if (controlToHighlight) {
                                        const control = this.elements.inspectorPanel.querySelector(controlToHighlight);
                                        if (control) {
                                            control.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            const highlightTarget = control.closest('.editor-section, .editor-item');
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
                    };

                    const handleKeydown = (ev) => {
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
                    let animationFrameId = null;

                    resizer.addEventListener('mousedown', (e) => {
                        isResizing = true;
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', stopResize);
                    });

                    const handleMouseMove = (e) => {
                        if (!isResizing) return;
                        if (animationFrameId) return;
                        animationFrameId = requestAnimationFrame(() => {
                            const newWidth = window.innerWidth - e.clientX;
                            if (newWidth > 350 && newWidth < window.innerWidth * 0.6) {
                                inspectorPanel.style.width = `${newWidth}px`;
                            }
                            animationFrameId = null;
                        });
                    };

                    const stopResize = () => {
                        isResizing = false;
                        if (animationFrameId) cancelAnimationFrame(animationFrameId);
                        document.body.style.cursor = 'default';
                        document.body.style.userSelect = 'auto';
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', stopResize);
                        this.updateExportSizePreview();
                    };
                },

                bindResizeListener() {
                    window.addEventListener('resize', this.debounce(() => {
                        // 只有在紧凑模式开启时才需要重新计算
                        if (this.state.systemSettings.masonryEnabled) {
                            this.applyGridCompactLayout();
                        }
                        this.updateExportSizePreview();
                    }, 200));
                },

                /**
                 * @description 渲染所有UI组件，isInitial用于标记是否是首次渲染。
                 * @param {boolean} isInitial - 是否是首次渲染。
                 */
                renderAll(isInitial = false) {
                    this.updateGlobalComponentStyleVars();
                    this.updateGlobalBorderVars();
                    this.renderPersonalInfo();
                    this.renderPageStyles();
                    this.renderLayerPanel();
                    this.renderInspector();
                    this.renderPreviewItems();
                    this.renderMobileEditPencils();
                    this.applyLayout();
                },

                /**
                 * @description 渲染个人信息区域 (头像, 昵称, 简介, 标签等)。
                 */
                async renderPersonalInfo() {
                    const info = this.state.personalInfo;
                    const header = this.elements.previewHeader;

                    const borderSettings = this.state.globalBorderSettings;
                    header.classList.toggle('apply-global-border', borderSettings.applyTo.personalInfo);
                    
                    header.classList.toggle('apply-global-shadow', borderSettings.globalShadowSettings?.applyTo?.personalInfo);
                    header.dataset.borderStyle = borderSettings.style;

                    let innerHTML;
                    if (info.layout === 'card') {
                        innerHTML = `
                            <div class="info-left-col">
                                <div id="preview-avatar-wrapper">
                                    <img id="preview-avatar" src="" alt="Avatar" title="点击更换头像">
                                    <div id="avatar-status-badge"></div>
                                </div>
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
                            <div id="preview-avatar-wrapper">
                                <img id="preview-avatar" src="" alt="Avatar" title="点击更换头像">
                                <div id="avatar-status-badge"></div>
                            </div>
                            <h1 id="preview-nickname" data-state-key="personalInfo.nickname"></h1>
                            <h2 id="preview-subtitle" data-state-key="personalInfo.subtitle"></h2>
                            <p id="preview-bio" data-state-key="personalInfo.bio"></p>
                            <div class="tags-container" id="preview-tags-container"></div>
                        `;
                    }
                    header.innerHTML = innerHTML;
                    const previewAvatar = header.querySelector('#preview-avatar');
                    const statusBadge = header.querySelector('#avatar-status-badge');
                    const previewNickname = header.querySelector('#preview-nickname');
                    const previewSubtitle = header.querySelector('#preview-subtitle');
                    const previewBio = header.querySelector('#preview-bio');
                    const previewTagsContainer = header.querySelector('#preview-tags-container');

                    // 渲染状态挂件
                    const badgeMap = { online: '🟢', dnd: '⛔', idle: '🌙', invisible: '⚪', busy: '🔴', working: '💻' };
                    statusBadge.className = '';
                    if (info.statusBadge === 'none' || !info.statusBadge) {
                        statusBadge.style.display = 'none';
                    } else {
                        statusBadge.style.display = 'flex';
                        if (info.statusBadge === 'red-dot') {
                            statusBadge.textContent = '99+';
                            statusBadge.classList.add('badge-red-dot');
                        } else {
                            statusBadge.textContent = info.statusBadge === 'emoji' ? info.statusBadgeEmoji : badgeMap[info.statusBadge] || '❔';
                        }
                    }

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
                    const wrapper = header.querySelector('#preview-avatar-wrapper');
                    if (wrapper) {
                        wrapper.style.transform = `translateX(${offsetX}%)`;
                    }
                    const overflowAmount = (newSize * (offsetY / 100));
                    if (wrapper) {
                        wrapper.style.marginTop = `-${overflowAmount}px`;
                    }
                    previewAvatar.style.transform = 'none';
                    previewAvatar.style.marginTop = '0';
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
                        }

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

                    if (styles.pageBgMode === 'gradient') {
                        bgLayers.push(`linear-gradient(${styles.pageBgGradientAngle}deg, ${styles.pageBgGradientStart}, ${styles.pageBgGradientEnd})`);
                        bgSizes.push('cover');
                        bgPositions.push('center');
                    } else {
                        bgColor = styles.pageBgSolidColor;
                    }

                    wrapper.style.backgroundColor = bgColor;
                    wrapper.style.backgroundImage = bgLayers.join(', ');
                    wrapper.style.backgroundSize = bgSizes.join(', ');
                    wrapper.style.backgroundPosition = bgPositions.join(', ');

                    if (styles.headerBgMode === 'gradient') {
                        const gradient = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})`;
                        this.elements.previewHeader.style.background = gradient;
                    } else {
                        this.elements.previewHeader.style.background = this.hexToRgba(styles.headerBgColor, styles.headerOpacity);
                    }

                    this.elements.previewHeader.style.borderRadius = `${styles.headerBorderRadius}px`;

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
                    const { type, id } = this.selection;
                    const info = this.state.personalInfo;
                    const isInfoHidden = info.isVisible === false;

                    let html = `<div class="layer-item-container">
                                    <div class="layer-item ${type === 'personalInfo' ? 'selected' : ''}" data-type="personalInfo">
                                        <span class="layer-icon iconify" data-icon="mdi:account-circle-outline"></span>
                                        <span class="layer-name">个人信息</span>
                                        <div class="layer-actions">
                                        </div>
                                    </div>
                               </div><hr>`;

                    html += this.state.items.map(item => {
                        const iconMap = { card: 'mdi:format-text-variant-outline', image: 'mdi:image-multiple-outline', button: 'mdi:button-pointer', separator: 'mdi:minus', spacer: 'mdi:arrow-expand-vertical', music: 'mdi:music-box-outline', progress: 'mdi:progress-check', timeline: 'mdi:timeline-text-outline' };
                        const isHidden = item.isVisible === false;

                        const title = item.title || item.text || item.label || `${item.type}模块`;

                        return `<div class="layer-item-container">
                                    <div class="layer-item ${type === 'item' && id === item.id ? 'selected' : ''} ${isHidden ? 'is-hidden' : ''}" data-type="item" data-id="${item.id}">
                                        <span class="layer-icon iconify" data-icon="${iconMap[item.type] || 'mdi:puzzle-outline'}"></span>
                                        <span class="layer-name">${this.escapeHTML(title)}</span>
                                        <div class="layer-actions">
                                            <button class="btn-icon toggle-visibility-btn" title="切换显示/隐藏"><span class="iconify" data-icon="${isHidden ? 'mdi:eye-off' : 'mdi:eye'}"></span></button>
                                            <button class="btn-icon duplicate-item-btn" title="复制样式"><span class="iconify" data-icon="mdi:content-copy"></span></button>
                                        </div>
                                    </div>
                                </div>`;
                    }).join('');

                    list.innerHTML = html;
                },

                /**
                 * @description 根据当前 selection 渲染右侧的检查器面板。
                 */
                renderInspector() {
                    this.renderInspectorTabs();
                    this.renderInspectorContent();
                },

                /**
                 * @description 渲染检查器顶部的 Tab 栏，并切换内容区域的显隐。
                 */
                renderInspectorTabs() {
                    const panel = this.elements.inspectorPanel;
                    const activeTab = this.state.ui.activeInspectorTab;

                    panel.querySelectorAll('.inspector-tab-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.tab === activeTab);
                    });

                    panel.querySelectorAll('.inspector-tab-content').forEach(content => {
                        content.classList.toggle('active', content.id === `inspector-tab-content-${activeTab}`);
                    });
                },

                /**
                 * @description 根据当前激活的 Tab 和 selection 渲染检查器的主体内容。
                 */
                renderInspectorContent() {
                    const activeTab = this.state.ui.activeInspectorTab;
                    const contentContainerId = `#inspector-tab-content-${activeTab}`;
                    const container = this.elements.inspectorPanel.querySelector(contentContainerId);
                    if (!container) return;

                    let html = '';
                    switch (activeTab) {
                        case 'global':
                            html = this.createGlobalInspectorHTML();
                            break;
                        case 'selected':
                            const { type, id } = this.selection;
                            if (type === 'personalInfo') {
                                html = this.createPersonalInfoInspectorHTML();
                            } else if (type === 'item') {
                                const item = this.findItem(id);
                                if (item) {
                                    html = this.createEditorItemHTML(item);
                                } else {
                                    html = `<div class="inspector-placeholder"><span class="iconify" data-icon="mdi:alert-circle-outline"></span><p>未找到选中的模块<br>请重新选择。</p></div>`;
                                }
                            } else {
                                html = `<div class="inspector-placeholder"><span class="iconify" data-icon="mdi:cursor-default-click-outline"></span><p>在左侧预览区点击一个元素<br>或在内容图层中选择一项<br>来编辑其样式。</p></div>`;
                            }
                            break;
                        case 'system':
                            html = this.createSystemInspectorHTML();
                            break;
                    }

                    container.innerHTML = html;

                    // 恢复"高级设置"的展开状态
                    container.querySelectorAll('.editor-section').forEach(section => {
                        if (section.id) {
                            const isOpen = localStorage.getItem(`blokko-advanced-${section.id}`) === 'true';
                            if (isOpen) {
                                section.classList.add('show-advanced');
                                const toggle = section.querySelector('.advanced-toggle');
                                if (toggle) toggle.checked = true;
                            }
                        }
                    });

                    // 根据当前激活的 Tab 初始化特定功能
                    if (activeTab === 'global') {
                        this.populateFontList();
                        this.bindColorThiefEvents();
                        if (this.lastPalette && this.lastPalette.length > 0) {
                            this.renderPalette(this.lastPalette);
                        }
                    } else if (activeTab === 'system') {
                        this.renderHistoryList();
                    } else if (activeTab === 'selected') {
                        // 异步加载图片缩略图
                        container.querySelectorAll('.thumbnail-wrapper img, .music-cover-thumb img').forEach(img => {
                            let itemId;
                            const itemEl = img.closest('.editor-item');
                            if (itemEl) itemId = itemEl.dataset.itemId;

                            if (itemId) {
                                const item = this.findItem(itemId);
                                if (!item) return;

                                let urlKey = (item.type === 'music') ? 'coverArt' : 'url';
                                if (item && item[urlKey]) {
                                    const setSrc = async (url) => {
                                        if (url && url.startsWith('idb://')) {
                                            const imageId = url.substring(6);
                                            const record = await this.getImageFromDB(imageId);
                                            if (record && record.blob) img.src = URL.createObjectURL(record.blob);
                                        } else {
                                            img.src = url;
                                        }
                                    };
                                    setSrc(item[urlKey]);
                                }
                            }
                        });

                        const { type, id } = this.selection;
                        if (type === 'item') {
                            const item = this.findItem(id);
                            if (item && item.type === 'timeline') {
                                this.initSortableTimelineEvents(id);
                            }
                        } else if (type === 'personalInfo') {
                            this.renderTagManager();
                            this.initSortableTags();
                        }
                    }

                    this.syncAllControls();
                    this.updateUndoRedoButtons();
                    this.updateBorderRadiusControls();
                },

                createGlobalInspectorHTML() {
                    return `
                        <fieldset class="editor-section" id="page-styles-section">
                            <legend>页面与头部样式</legend>
                            <div class="section-content">
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
                                    <div class="form-group advanced-setting"><label>头部圆角 (px): <span class="header-radius-value">16</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.headerBorderRadius" min="0" max="50" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                            </div>
                            <hr class="separator">
                                <div class="tab-group-wrapper">
                                    <div class="section-header" style="margin-bottom: 5px;"><h4 style="margin: 0;">页面背景</h4></div>
                                    <div class="tabs"><button class="tab-btn" data-tab="page-bg-solid">纯色/图片</button><button class="tab-btn advanced-setting" data-tab="page-bg-gradient">渐变</button></div>
                                    <div id="page-bg-solid" class="tab-content">
                                        <div class="form-group"><label>页面背景颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageBgSolidColor"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageBgSolidColor"></div></div>
                                        <div class="form-group"><label>背景图 (可选):</label>
                                            <div class="input-group simple">
                                                <button id="page-bg-upload-btn" class="btn btn-default">选择图片...</button>
                                                <button id="clear-page-bg-btn" class="btn btn-default btn-small">清除</button>
                                                <input type="file" id="physical-image-upload-input" accept="image/*" style="display: none;">
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
                                            <div class="form-group"><label>当前纹理: <span id="current-texture-name">无</span></label><button id="clear-texture-btn" class="btn btn-default btn-small">清除纹理</button></div>
                                            <div class="color-control-row">
                                                <div class="color-control-group"><label>纹理颜色:</label><div class="input-group"><input type="color" data-state-key="pageStyles.pageBgPatternColor"><input type="text" class="color-hex-input" data-state-key="pageStyles.pageBgPatternColor"></div></div>
                                                <div class="color-control-group"><label>纹理不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.pageBgPatternOpacity" min="0" max="1" step="0.05"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                            </div>
                                            <div class="form-group"><label>纹理密度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="pageStyles.pageBgPatternDensity" min="10" max="100" step="2"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </fieldset>
<fieldset class="editor-section" id="global-layout-section">
    <legend>布局设置</legend>
    <div class="section-content">
        <div class="form-group">
            <label>模块间距 (px): <span class="gap-value">20</span></label>
            <div class="input-group simple stepper-group">
                <button class="btn btn-default btn-stepper minus" aria-label="减少">-</button>
                <input type="range" data-state-key="systemSettings.previewGap" min="0" max="40" step="2">
                <button class="btn btn-default btn-stepper plus" aria-label="增加">+</button>
            </div>
        </div>
        <div class="form-group">
            <label class="checkbox-group">
                <input type="checkbox" data-state-key="systemSettings.masonryEnabled">
                启用紧凑布局 (实验性)
                <span class="tooltip-trigger" data-tooltip="使用CSS Grid技术智能排列模块，最大限度减少垂直空白，同时严格保持您的拖拽顺序。推荐在模块排布完成后开启。"><span class="iconify" data-icon="mdi:help-circle-outline"></span></span>
            </label>
        </div>
    </div>
</fieldset>
                        <fieldset class="editor-section" id="global-border-section">
                            <legend>🖼️ 全局边框样式</legend>
                            <div class="section-content">
                                <h4>1. 定义边框风格</h4>
                                <div class="form-group"><label>样式:</label><select data-state-key="globalBorderSettings.style"><option value="none">无</option><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点状</option><option value="pixel">像素</option><option value="neo-brutalism">新丑</option><option value="double-offset">双层</option></select></div>
                                <div class="color-control-row">
                                    <div class="color-control-group"><label>粗细 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.width" min="1" max="10" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                    <div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-state-key="globalBorderSettings.color"><input type="text" class="color-hex-input" data-state-key="globalBorderSettings.color"></div></div>
                                </div>
                                <div class="form-group" data-style-specific="neo-brutalism" style="display:none;"><label>阴影偏移 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.shadowOffset" min="1" max="15" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                <div class="form-group" data-style-specific="double-offset" style="display:none;"><label>图层偏移 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.shadowOffset" min="1" max="15" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                <hr class="separator">
                                <h4>2. 选择应用目标</h4>
                                <div class="form-group border-apply-to-list">
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.personalInfo">个人信息面板</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.card">卡片模块</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.image">图片模块</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.button">按钮模块</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.music">音乐模块</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.applyTo.timeline">时间轴模块</label>
                                </div>
                                <hr class="separator">
                                <!-- [新增] 位于边框面板内的阴影设置 -->
                                <div class="section-header" style="margin-bottom: 10px;"><h4 style="margin: 0;">🌫️ 全局阴影</h4></div>
                                <div class="color-control-row">
                                    <div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-state-key="globalBorderSettings.globalShadowSettings.color"><input type="text" class="color-hex-input" data-state-key="globalBorderSettings.globalShadowSettings.color"></div></div>
                                    <div class="color-control-group"><label>强度 (不透明度):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.globalShadowSettings.opacity" min="0" max="1" step="0.05"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                </div>
                                <div class="color-control-row" style="margin-top: 8px;">
                                    <div class="color-control-group"><label>X 偏移:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.globalShadowSettings.offsetX" min="-20" max="20" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                    <div class="color-control-group"><label>Y 偏移:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.globalShadowSettings.offsetY" min="-20" max="20" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                </div>
                                <div class="form-group" style="margin-top: 8px;"><label>模糊半径 (Blur):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalBorderSettings.globalShadowSettings.blur" min="0" max="50" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                
                                <div class="form-group border-apply-to-list" style="margin-top: 15px;">
                                    <label style="display:block; margin-bottom:5px; font-weight:600;">阴影应用到:</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.personalInfo">个人信息</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.card">卡片</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.image">图片</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.button">按钮</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.music">音乐</label>
                                    <label class="checkbox-group is-parent"><input type="checkbox" data-state-key="globalBorderSettings.globalShadowSettings.applyTo.timeline">时间轴</label>
                                </div>
                            </div>
                        </fieldset>
                         <fieldset class="editor-section" id="global-component-styles-section">
                            <legend>全局组件样式</legend>
                            <div class="section-content">
                                <div style="text-align: right; margin-bottom: 10px;"><label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle"> 高级</label></div>
                                <div class="tabs"><button class="tab-btn" data-tab="comp-bg-solid">纯色</button><button class="tab-btn advanced-setting" data-tab="comp-bg-gradient">渐变</button></div>
                                <div id="comp-bg-solid" class="tab-content"><div class="color-control-row"><div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.bgColor"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.bgColor"></div></div><div class="color-control-group"><label>不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalComponentStyles.opacity" min="0" max="1" step="0.05"><button class="btn btn-default btn-stepper plus">+</button></div></div></div></div>
                                <div id="comp-bg-gradient" class="tab-content advanced-setting"><div class="gradient-controls"><div class="form-group"><label>起始颜色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.bgGradientStart"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.bgGradientStart"></div></div><div class="form-group"><label>结束颜色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.bgGradientEnd"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.bgGradientEnd"></div></div><div class="gradient-angle-control form-group"><label>角度 (<span class="angle-value">135</span>°):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalComponentStyles.bgGradientAngle" min="0" max="360" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div></div></div>
                                <div class="form-group"><label>圆角 (px): <span id="gCompRadiusValue">12</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalComponentStyles.radius" min="0" max="40" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                <div class="form-group"><label>内边距 (px): <span class="padding-value">15</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-state-key="globalComponentStyles.padding" min="0" max="40" step="1"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                                <hr class="separator">
                                <div class="color-control-row">
                                    <div class="color-control-group"><label>组件背景色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.bgColor"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.bgColor"></div></div>
                                    <div class="color-control-group"><label>组件文字颜色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.textColor"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.textColor"></div></div>
                                </div>
                                <div class="form-group" style="margin-top: 10px;"><label>标题颜色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.titleColor"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.titleColor" placeholder="同文字颜色"></div></div>
                                <div class="form-group"><label>对齐:</label><div class="radio-group"><label><input type="radio" name="gCompAlign" value="left" data-state-key="globalComponentStyles.textAlign">居左</label><label><input type="radio" name="gCompAlign" value="center" data-state-key="globalComponentStyles.textAlign">居中</label><label><input type="radio" name="gCompAlign" value="right" data-state-key="globalComponentStyles.textAlign">居右</label></div></div>
                                <div class="form-group"><label>行高:</label><div class="radio-group"><label><input type="radio" name="gCompLineHeight" value="1.4" data-state-key="globalComponentStyles.lineHeight">紧凑</label><label><input type="radio" name="gCompLineHeight" value="1.5" data-state-key="globalComponentStyles.lineHeight">中等</label><label><input type="radio" name="gCompLineHeight" value="1.6" data-state-key="globalComponentStyles.lineHeight">宽松</label></div></div>
                                <hr class="separator">
                                <div class="form-group"><label>字体:</label><div class="font-controls"><input type="text" id="font-search-input" placeholder="搜索本地字体..." style="margin-bottom: 5px;"><select id="font-family-select" data-state-key="globalComponentStyles.fontFamily"></select><div class="buttons"><button id="load-local-fonts-btn" class="btn btn-default">加载本地</button><button id="upload-font-btn" class="btn btn-default">上传字体</button><button id="manage-fonts-btn" class="btn btn-default">管理</button></div><input type="file" id="font-upload-input" accept=".ttf,.woff,.woff2,.otf" multiple style="display: none;"></div></div>
                                <div class="color-control-row">
                                    <div class="color-control-group"><label>标题字号:</label><select data-state-key="globalComponentStyles.titleFontSize"><option value="1em">小</option><option value="1.1em">中</option><option value="1.2em">大</option><option value="1.4em">特大</option></select></div>
                                    <div class="color-control-group"><label>正文字号:</label><select data-state-key="globalComponentStyles.contentFontSize"><option value="0.8em">特小</option><option value="0.95em">小</option><option value="1em">中</option><option value="1.1em">大</option></select></div>
                                </div>
                                <div class="advanced-setting"><label>文字描边:<span class="tooltip-trigger" data-tooltip="为文字添加边框，建议宽度不超过2px，以保证可读性。"><span class="iconify" data-icon="mdi:help-circle-outline"></span></span></label><div class="color-control-row"><div class="color-control-group"><label>粗细(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="globalComponentStyles.textStrokeWidth" min="0" max="5" step="0.5"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div><div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-state-key="globalComponentStyles.textStrokeColor"><input type="text" class="color-hex-input" data-state-key="globalComponentStyles.textStrokeColor"></div></div></div></div>
                                </div>
                        </fieldset>
                    `;
                },

                createSystemInspectorHTML() {
                    return `
                         <fieldset class="editor-section" id="actions-section">
                             <legend>⚙️ 核心操作</legend>
                             <div class="section-content">
                                 <div class="form-group">
                                     <div class="input-group" style="display: flex; gap: 0;">
                                         <button id="random-palette-btn" class="btn btn-default" style="flex: 1; border-radius: 6px 0 0 6px; border-right: none;">🎲 随机</button>
                                         <button id="smart-palette-btn" class="btn btn-secondary" style="flex: 1.5; border-radius: 0 6px 6px 0;">🎨 自选生成</button>
                                     </div>
                                     <input type="color" id="smart-palette-input" style="visibility: hidden; position: absolute; width: 0; height: 0;">
                                 </div>
                                 <div class="form-group">
                                     <button id="share-style-btn" class="btn btn-secondary" style="width: 100%;">📱 二维码分享样式</button>
                                 </div>
                                 <hr class="separator">
                                 <div class="form-group">
                                     <label>操作历史:</label>
                                     <div id="history-list"></div>
                                 </div>
                                 <div class="form-group" style="display: flex; gap: 10px;">
                                     <button id="undo-btn" class="btn btn-default" disabled>撤销</button>
                                     <button id="redo-btn" class="btn btn-default" disabled>重做</button>
                                 </div>
                             </div>
                         </fieldset>
                         <fieldset class="editor-section" id="export-section">
                             <legend>📥 导入与导出</legend>
                             <div class="section-content">
                                 <div class="form-group" style="display: flex; gap: 10px;">
                                     <button id="import-btn" class="btn btn-secondary">导入数据 (.json/.zip)</button>
                                     <button id="show-export-modal-btn" class="btn btn-secondary">导出数据...</button>
                                 </div>
                                 <hr class="separator">
                                 <div class="form-group">
                                    <label>导出文件名前缀:</label>
                                    <input type="text" data-state-key="systemSettings.exportFilePrefix">
                                 </div>
                                 <div id="mobile-simulation-controls">
                                     <div class="checkbox-group for-desktop-only" style="margin-bottom: 10px;"><label><input type="checkbox" id="mobile-export-toggle"> 手机端导出预览</label></div>
                                 </div>
                                 <div class="checkbox-group" style="margin-bottom: 10px;"><label><input type="checkbox" id="hd-export-toggle"> 超清导出 (1800px)</label></div>
                                 <div class="checkbox-group" style="margin-bottom: 10px;"><label><input type="checkbox" id="custom-width-toggle"> 自定义尺寸</label></div>
                                 <div id="custom-dimensions-controls" style="display: none; padding-left: 20px;">
                                     <div class="checkbox-group" style="margin-bottom: 10px;"><label><input type="checkbox" id="lock-aspect-ratio-toggle" data-state-key="exportSettings.lockAspectRatio" checked> 锁定比例</label></div>
                                     <div style="display: flex; gap: 10px; align-items: center;">
                                         <input type="number" id="custom-width-input" data-state-key="exportSettings.customWidth" value="1200" style="width: 80px; padding: 4px 8px;">
                                         <span>x</span>
                                         <input type="number" id="custom-height-input" data-state-key="exportSettings.customHeight" value="750" style="width: 80px; padding: 4px 8px;" disabled>
                                     </div>
                                 </div>
                                 <div class="checkbox-group" style="margin-bottom: 10px;"><label><input type="checkbox" id="export-rounded-corners-toggle"> 导出为圆角图片</label><input type="number" id="export-corner-radius-input" value="20" style="width: 60px; padding: 4px 8px;" disabled></div>
                                 <div class="checkbox-group" style="margin-bottom: 10px;">
                                     <label><input type="checkbox" id="export-attribution-toggle">显示Blokko水印/背景作者</label>
                                     <span id="attribution-link-wrapper"></span>
                                 </div>
                                 <div id="export-size-preview" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;"></div>
                                 <button id="export-png-btn" class="btn btn-primary" style="margin-top:10px;">导出为图片 (1200px)</button>
                             </div>
                         </fieldset>
                         <fieldset class="editor-section" id="manage-section">
                             <legend>🗂️ 资源管理</legend>
                             <div class="section-content">
                                 <div class="form-group" style="display: flex; gap: 10px;">
                                     <button id="manage-fonts-btn" class="btn btn-default">管理字体</button>
                                 </div>
                                  <hr class="separator">
                                 <div class="form-group"><button id="reset-btn" class="btn btn-danger">恢复默认模板</button></div>
                                 <input type="file" id="config-file-input" accept=".json,.zip" style="display: none;">
                             </div>
                         </fieldset>
                     `;
                },

                
                createEditorItemHTML(item) {
                    let content = '';

                    // 根据模块类型分发到具体的HTML生成函数
                    switch (item.type) {
                        case 'card': content = this.createCardEditorHTML(item); break;
                        case 'image': content = this.createImageEditorHTML(item); break;
                        case 'button': content = this.createButtonEditorHTML(item); break;
                        case 'music': content = this.createMusicEditorHTML(item); break;
                        case 'progress': content = this.createProgressEditorHTML(item); break;
                        case 'timeline': content = this.createTimelineEditorHTML(item); break;
                        case 'separator': content = this.createSeparatorEditorHTML(item); break;
                        case 'spacer': content = this.createSpacerEditorHTML(item); break;
                        default: content = '<p>未知模块类型</p>';
                    }

                    const title = item.title || item.text || item.label || '';
                    const hasTitle = ['card', 'image', 'button', 'music', 'progress', 'timeline'].includes(item.type);
                    const titleInputHTML = hasTitle ? `<input type="text" class="editor-item-title-input" data-item-id-for-title="${item.id}" value="${this.escapeHTML(title)}" placeholder="模块标题 (可选)">` : `<span class="editor-item-title-input" style="color:var(--text-secondary); cursor:default;">${item.type} 模块</span>`;

                    // 所有模块通用的布局设置
                    const commonLayoutSettings = `
                        <div class="form-group">
                            <label>布局宽度:</label>
                            <div class="radio-group">
                                <label><input type="radio" data-item-key="layout.width" name="item-layout-${item.id}" value="100" ${item.layout.width === 100 ? 'checked' : ''}> 100%</label>
                                <label><input type="radio" data-item-key="layout.width" name="item-layout-${item.id}" value="67" ${item.layout.width === 67 ? 'checked' : ''}> 67%</label>
                                <label><input type="radio" data-item-key="layout.width" name="item-layout-${item.id}" value="50" ${item.layout.width === 50 ? 'checked' : ''}> 50%</label>
                                <label><input type="radio" data-item-key="layout.width" name="item-layout-${item.id}" value="33" ${item.layout.width === 33 ? 'checked' : ''}> 33%</label>
                            </div>
                        </div>
                    `;

                    return `<div class="editor-item" data-item-id="${item.id}">
                                <div class="editor-item-header">
                                    ${titleInputHTML}
                                    <div class="item-actions">
                                        <button class="btn btn-danger btn-small item-delete-btn">删除</button>
                                    </div>
                                </div>
                                <div class="editor-item-content">
                                    ${commonLayoutSettings}
                                    <hr class="separator">
                                    ${content}
                                </div>
                            </div>`;
                },

                
                createCardEditorHTML(item) {
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}" style="font-size: 1.2em; vertical-align: middle; margin-right: 5px;"></span>` : '选择图标';
                    const g = this.state.globalComponentStyles;
                    const contentPreview = item.content || '<span style="color: var(--text-placeholder);">点击编辑内容...</span>';
                    const advClass = item.isAdvancedOpen ? 'show-advanced' : '';

                    return `<div class="${advClass}">
                        <h4>基础设置</h4>
                        <div class="form-group"><label>标题:</label><div class="input-group"><input type="text" data-item-key="title" value="${this.escapeHTML(item.title || '')}" style="border-right: none;"><button class="btn btn-default select-icon-btn" style="width: auto; flex-shrink: 0; border-radius: 0 6px 6px 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${iconHTML}</button></div></div>
                        <div class="form-group">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <label style="margin-bottom: 0;">内容:</label>
                                <button class="btn btn-default btn-small edit-content-btn"><span class="iconify" data-icon="mdi:pencil"></span> 编辑内容</button>
                            </div>
                            <div class="rich-text-editor-trigger"><div class="rich-text-preview">${contentPreview}</div></div>
                        </div>
                        <div class="form-group"><label>对齐:</label><div class="radio-group">
                            <label><input type="radio" name="card-${item.id}-align" value="" data-item-key="textAlign" ${!['left', 'center', 'right'].includes(item.textAlign) ? 'checked' : ''}>默认</label>
                            <label><input type="radio" name="card-${item.id}-align" value="left" data-item-key="textAlign" ${item.textAlign === 'left' ? 'checked' : ''}>左</label>
                            <label><input type="radio" name="card-${item.id}-align" value="center" data-item-key="textAlign" ${item.textAlign === 'center' ? 'checked' : ''}>中</label>
                            <label><input type="radio" name="card-${item.id}-align" value="right" data-item-key="textAlign" ${item.textAlign === 'right' ? 'checked' : ''}>右</label>
                        </div></div>
                         <div style="text-align: right; margin-bottom: 10px;">
                            <label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle" ${item.isAdvancedOpen ? 'checked' : ''}> 高级独立样式</label>
                        </div>
                        <div class="advanced-setting">
                            <hr class="separator">
                            <h4>独立样式</h4>
                            <div class="form-group"><label>装饰贴纸:</label><div class="radio-group"><label><input type="radio" name="card-${item.id}-sticker" value="none" data-item-key="sticker" ${item.sticker === 'none' || !item.sticker ? 'checked' : ''}>无</label><label><input type="radio" name="card-${item.id}-sticker" value="tape" data-item-key="sticker" ${item.sticker === 'tape' ? 'checked' : ''}>胶带</label><label><input type="radio" name="card-${item.id}-sticker" value="pushpin" data-item-key="sticker" ${item.sticker === 'pushpin' ? 'checked' : ''}>图钉</label></div></div>
                            <div class="color-control-row">
                                <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-item-key="bgColor" value="${item.bgColor || ''}"><input class="color-hex-input" type="text" data-item-key="bgColor" value="${item.bgColor || ''}" placeholder="${g.bgColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="bgColor">重置</button></div></div>
                                <div class="color-control-group"><label>正文颜色:</label><div class="input-group"><input type="color" data-item-key="textColor" value="${item.textColor || ''}"><input class="color-hex-input" type="text" data-item-key="textColor" value="${item.textColor || ''}" placeholder="${g.textColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="textColor">重置</button></div></div>
                            </div>
                            <div class="color-control-row" style="margin-top: 10px;">
                                <div class="color-control-group"><label>标题颜色:</label><div class="input-group"><input type="color" data-item-key="titleColor" value="${item.titleColor || ''}"><input class="color-hex-input" type="text" data-item-key="titleColor" value="${item.titleColor || ''}" placeholder="同正文色"><button class="btn btn-default btn-small" data-reset-item-key="titleColor">重置</button></div></div>
                            </div>
                            <hr class="separator">
                            <div class="form-group"><label>背景图:</label><div class="input-group simple"><input type="file" class="card-bg-upload" accept="image/*"><button class="btn btn-default btn-small card-clear-bg-btn">清除</button></div></div>
                        </div>
                    </div>`;
                },

                
                createImageEditorHTML(item) {
                    return `<div class="image-card-editor-content">
                                <div class="image-card-editor-thumb">
                                    <div class="thumbnail-wrapper">
                                        <img src="" loading="lazy">
                                        <div class="thumbnail-actions">
                                            <button class="btn btn-icon crop-image-btn" title="裁剪与调整"><span class="iconify" data-icon="mdi:crop-rotate"></span></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="image-card-editor-fields">
                                    <div class="form-group"><label>标题:</label><input type="text" data-item-key="title" value="${this.escapeHTML(item.title || '')}"></div>
                                    <div class="form-group"><label>描述:</label><textarea data-item-key="description" rows="2">${this.escapeHTML(item.description || '')}</textarea></div>
                                </div>
                            </div>
                            <div class="form-group" style="margin-top: 10px;">
                                <label>图片填充模式:</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="img-fill-${item.id}" value="cover" data-item-key="imageFillMode" ${item.imageFillMode === 'cover' || !item.imageFillMode ? 'checked' : ''}>填充 (Cover)</label>
                                    <label><input type="radio" name="img-fill-${item.id}" value="contain" data-item-key="imageFillMode" ${item.imageFillMode === 'contain' ? 'checked' : ''}>完整 (Contain)</label>
                                </div>
                            </div>`;
                },

                
                createButtonEditorHTML(item) {
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}"></span>` : '图标';
                    return `
                        <div class="form-group">
                            <label>按钮内容:</label>
                            <div class="input-group">
                                <button class="btn btn-default select-icon-btn" style="width: auto; flex-shrink: 0; border-radius: 6px 0 0 6px;">${iconHTML}</button>
                                <input type="text" data-item-key="text" value="${this.escapeHTML(item.text || '')}" placeholder="按钮文字" style="border-left: none;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>对齐:</label>
                            <div class="radio-group">
                                <label><input type="radio" name="btn-align-${item.id}" value="" data-item-key="textAlign" ${!item.textAlign ? 'checked' : ''}>默认</label>
                                <label><input type="radio" name="btn-align-${item.id}" value="flex-start" data-item-key="textAlign" ${item.textAlign === 'flex-start' ? 'checked' : ''}>居左</label>
                                <label><input type="radio" name="btn-align-${item.id}" value="center" data-item-key="textAlign" ${item.textAlign === 'center' ? 'checked' : ''}>居中</label>
                                <label><input type="radio" name="btn-align-${item.id}" value="flex-end" data-item-key="textAlign" ${item.textAlign === 'flex-end' ? 'checked' : ''}>居右</label>
                            </div>
                        </div>
                        <hr class="separator">
                        <h4>独立样式 (可选)</h4>
                        <div class="color-control-row">
                            <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-item-key="bgColor"><input type="text" class="color-hex-input" data-item-key="bgColor" placeholder="全局"><button class="btn btn-default btn-small" data-reset-item-key="bgColor">重置</button></div></div>
                            <div class="color-control-group"><label>文字颜色:</label><div class="input-group"><input type="color" data-item-key="textColor"><input type="text" class="color-hex-input" data-item-key="textColor" placeholder="全局"><button class="btn btn-default btn-small" data-reset-item-key="textColor">重置</button></div></div>
                        </div>
                         <div class="form-group" style="margin-top: 15px;"><label>圆角 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="radius" min="0" max="40"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                         <button class="btn btn-default btn-small" data-reset-item-key="radius" style="margin-left: 10px;">重置</button>`;
                },

                
                createMusicEditorHTML(item) {
                    const g = this.state.globalComponentStyles;
                    const gTheme = this.state.globalTheme;
                    return `
                        <div class="form-group">
                            <label>卡片样式:</label>
                            <div class="radio-group">
                                <label><input type="radio" name="music-style-${item.id}" value="default" data-item-key="style" ${item.style !== 'vinyl' ? 'checked' : ''}> 默认</label>
                                <label><input type="radio" name="music-style-${item.id}" value="vinyl" data-item-key="style" ${item.style === 'vinyl' ? 'checked' : ''}> 黑胶</label>
                            </div>
                        </div>
                        <hr class="separator">
                        <div class="form-group"><label>专辑封面:</label>
                             <div class="image-card-editor-content">
                                <div class="music-cover-thumb" style="width: 80px; flex-shrink: 0;"><div class="thumbnail-wrapper"><img src="" loading="lazy"></div></div>
                                <div class="image-card-editor-fields"><input type="file" id="music-cover-upload" accept="image/*">
                                <div class="form-group" style="margin-top:5px; margin-bottom:0;"><label style="font-size:0.8rem">高亮色:</label><div class="input-group simple"><input type="color" data-item-key="accentColor" value="${item.accentColor || ''}"><input type="text" class="color-hex-input" data-item-key="accentColor" value="${item.accentColor || ''}" placeholder="${gTheme.accent}"><button class="btn btn-default btn-small" data-reset-item-key="accentColor">重置</button></div></div></div>
                            </div>
                        </div>
                        <div class="form-group"><label>歌曲名称:</label><input type="text" data-item-key="songTitle" value="${this.escapeHTML(item.songTitle || '')}"></div>
                        <div class="form-group"><label>歌手:</label><input type="text" data-item-key="artist" value="${this.escapeHTML(item.artist || '')}"></div>
                        <div class="form-group"><label>播放进度 (输入时间自动计算):</label><div class="input-group simple"><input type="text" data-item-key="currentTime" value="${item.currentTime || '00:00'}" placeholder="01:20" style="text-align:center;"><span style="padding:0 5px;">/</span><input type="text" data-item-key="totalTime" value="${item.totalTime || '03:00'}" placeholder="03:00" style="text-align:center;"></div></div>
                        <div class="form-group"><label>歌词 (居中显示):</label><textarea data-item-key="lyrics" rows="3" placeholder="上一句&#10;当前句(高亮)&#10;下一句">${this.escapeHTML(item.lyrics || '')}</textarea></div>
                        <hr class="separator"><div style="text-align: right; margin-bottom: 10px;"><label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle"> 🎨 独立外观设置</label></div>
                        <div class="advanced-setting">
                            <div class="color-control-row">
                                <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-item-key="bgColor" value="${item.bgColor || ''}"><input type="text" class="color-hex-input" data-item-key="bgColor" value="${item.bgColor || ''}" placeholder="${g.bgColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="bgColor">重置</button></div></div>
                                <div class="color-control-group"><label>文字色:</label><div class="input-group"><input type="color" data-item-key="textColor" value="${item.textColor || ''}"><input type="text" class="color-hex-input" data-item-key="textColor" value="${item.textColor || ''}" placeholder="${g.textColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="textColor">重置</button></div></div>
                            </div>
                            <div class="color-control-row" style="margin-top:10px;">
                                <div class="color-control-group"><label>不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="opacity" min="0" max="1" step="0.05" value="${item.opacity ?? g.opacity}"><button class="btn btn-default btn-stepper plus">+</button></div><button class="btn btn-default btn-small" data-reset-item-key="opacity" style="margin-top:5px; width:100%;">重置 (跟随全局)</button></div>
                                <div class="color-control-group"><label>圆角(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="radius" min="0" max="40" step="1" value="${item.radius ?? g.radius}"><button class="btn btn-default btn-stepper plus">+</button></div><button class="btn btn-default btn-small" data-reset-item-key="radius" style="margin-top:5px; width:100%;">重置 (跟随全局)</button></div>
                            </div>
                        </div>`;
                },

                
                createProgressEditorHTML(item) {
                    return `
                        <div class="form-group"><label>标签:</label><input type="text" data-item-key="label" value="${this.escapeHTML(item.label)}"></div>
                        <div class="form-group"><label>百分比: <span class="progress-value">${item.percentage}</span>%</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="percentage" min="0" max="100" step="1" value="${item.percentage}"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                        <div class="color-control-row">
                            <div class="color-control-group"><label>进度颜色:</label><div class="input-group"><input type="color" data-item-key="color" value="${item.color}"><input type="text" class="color-hex-input" data-item-key="color" value="${item.color}"></div></div>
                            <div class="color-control-group"><label>轨道颜色:</label><div class="input-group"><input type="color" data-item-key="trackColor" value="${item.trackColor}"><input type="text" class="color-hex-input" data-item-key="trackColor" value="${item.trackColor}"></div></div>
                        </div>
                        <div class="form-group" style="margin-top: 10px;"><label>粗细 (px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="thickness" min="2" max="30" step="1" value="${item.thickness}"><button class="btn btn-default btn-stepper plus">+</button></div></div>
                    `;
                },

                
                createTimelineEditorHTML(item) {
                    const g = this.state.globalComponentStyles;
                    const advClass = item.isAdvancedOpen ? 'show-advanced' : '';
                    let eventsHTML = !item.cards?.length ? '<div class="empty-placeholder">暂无事件</div>' : item.cards.map(c => this.createEditorTimelineEventHTML(c)).join('');

                    return `
        <div class="color-control-row">
            <div class="color-control-group"><label>时间点颜色:</label><div class="input-group"><input type="color" data-item-key="timeColor" value="${item.timeColor || ''}"><input type="text" class="color-hex-input" data-item-key="timeColor" value="${item.timeColor || ''}" placeholder="默认灰色"><button class="btn btn-default btn-small" data-reset-item-key="timeColor">重置</button></div></div>
            <div class="color-control-group"><label>节点/线颜色:</label><div class="input-group"><input type="color" data-item-key="accentColor" value="${item.accentColor || ''}"><input type="text" class="color-hex-input" data-item-key="accentColor" value="${item.accentColor || ''}" placeholder="默认主色"><button class="btn btn-default btn-small" data-reset-item-key="accentColor">重置</button></div></div>
        </div>
        <hr class="separator">
        <div class="timeline-editors-list">${eventsHTML}</div>
        <button class="btn btn-default add-timeline-event-btn" style="margin-top: 15px;">➕ 添加事件</button>
        <hr class="separator">
        <div class="advanced-settings-wrapper ${advClass}">
            <div style="text-align: right; margin-bottom: 10px;">
                <label class="checkbox-group advanced-toggle-label"><input type="checkbox" class="advanced-toggle" ${item.isAdvancedOpen ? 'checked' : ''}> 🎨 独立外观设置</label>
            </div>
            <div class="advanced-setting">
                <div class="color-control-row">
                    <div class="color-control-group"><label>背景色:</label><div class="input-group"><input type="color" data-item-key="bgColor" value="${item.bgColor || ''}"><input type="text" class="color-hex-input" data-item-key="bgColor" value="${item.bgColor || ''}" placeholder="${g.bgColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="bgColor">重置</button></div></div>
                    <div class="color-control-group"><label>内容颜色:</label><div class="input-group"><input type="color" data-item-key="textColor" value="${item.textColor || ''}"><input type="text" class="color-hex-input" data-item-key="textColor" value="${item.textColor || ''}" placeholder="${g.textColor} (全局)"><button class="btn btn-default btn-small" data-reset-item-key="textColor">重置</button></div></div>
                </div>
                <div class="color-control-row" style="margin-top:10px;">
                    <div class="color-control-group"><label>不透明度:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="opacity" min="0" max="1" step="0.1" value="${item.opacity ?? g.opacity}"><button class="btn btn-default btn-stepper plus">+</button></div><button class="btn btn-default btn-small" data-reset-item-key="opacity" style="margin-top:5px; width:100%;">重置</button></div>
                    <div class="color-control-group"><label>圆角(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus">-</button><input type="range" data-item-key="radius" min="0" max="40" step="1" value="${item.radius ?? g.radius}"><button class="btn btn-default btn-stepper plus">+</button></div><button class="btn btn-default btn-small" data-reset-item-key="radius" style="margin-top:5px; width:100%;">重置</button></div>
                </div>
            </div>
        </div>
    `;
                },

                createEditorTimelineEventHTML(card) {
                    return `
        <div class="timeline-event-editor" data-card-id="${card.id}">
            <span class="card-drag-handle">☰</span>
            <div class="editor-card-header" style="padding: 4px 8px;"><button class="btn btn-danger btn-small card-delete-btn">删</button></div>
            <div class="editor-card-content" style="padding: 10px;">
                <div class="form-group"><label>时间点:</label><input type="text" data-timeline-card-key="time" value="${this.escapeHTML(card.time || '')}"></div>
                <div class="form-group" style="margin-bottom:0;"><label>事件内容:</label><textarea data-timeline-card-key="content" rows="2">${this.escapeHTML(card.content || '')}</textarea></div>
            </div>
        </div>`;
                },

                
                createSeparatorEditorHTML(item) {
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}"></span>` : '选择图标';
                    return `
                        <div class="form-group"><label>样式:</label><div class="radio-group"><label><input type="radio" name="sep-style-${item.id}" data-item-key="style" value="solid" ${item.style === 'solid' ? 'checked' : ''}>实线</label><label><input type="radio" name="sep-style-${item.id}" data-item-key="style" value="dashed" ${item.style === 'dashed' ? 'checked' : ''}>虚线</label><label><input type="radio" name="sep-style-${item.id}" data-item-key="style" value="dotted" ${item.style === 'dotted' ? 'checked' : ''}>点状</label></div></div>
                        <div class="color-control-row">
                            <div class="color-control-group"><label>线条颜色:</label><div class="input-group"><input type="color" data-item-key="color" value="${item.color}"><input type="text" class="color-hex-input" data-item-key="color" value="${item.color}"></div></div>
                            <div class="color-control-group"><label>粗细(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-item-key="thickness" min="1" max="10" value="${item.thickness}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                        </div>
                        <div class="form-group"><label>垂直间距(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-item-key="margin" min="0" max="50" value="${item.margin}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                        <hr class="separator">
                        <div class="form-group"><label>嵌入文本 (可选):</label><div class="input-group"><input type="text" data-item-key="text" value="${this.escapeHTML(item.text || '')}" style="border-right: none;"><button class="btn btn-default select-icon-btn" style="width: auto; flex-shrink: 0; border-radius: 0 6px 6px 0;">${iconHTML}</button></div></div>
                        <div class="form-group"><label>文本颜色:</label><div class="input-group"><input type="color" data-item-key="textColor" value="${item.textColor}"><input type="text" class="color-hex-input" data-item-key="textColor" value="${item.textColor}"></div></div>`;
                },

                
                createSpacerEditorHTML(item) {
                    return `<div class="form-group"><label>高度 (px): <span class="spacer-height-value">${item.height}</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-item-key="height" min="1" max="200" value="${item.height}"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>`;
                },

                createPersonalInfoInspectorHTML() {
                    return `
                        <div class="inspector-state active">
                             <fieldset class="editor-section" id="personal-info-section">
                                <legend>个人信息</legend>
                                <div class="section-content">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
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
                                    <div class="form-group"><label>状态挂件:</label><div class="radio-group">
                                        <label><input type="radio" name="avatarBadge" value="none" data-state-key="personalInfo.statusBadge">无</label>
                                        <label><input type="radio" name="avatarBadge" value="online" data-state-key="personalInfo.statusBadge">🟢在线</label>
                                        <label><input type="radio" name="avatarBadge" value="busy" data-state-key="personalInfo.statusBadge">🔴忙碌</label>
                                        <label><input type="radio" name="avatarBadge" value="dnd" data-state-key="personalInfo.statusBadge">⛔勿扰</label>
                                        <label><input type="radio" name="avatarBadge" value="idle" data-state-key="personalInfo.statusBadge">🌙闲置</label>
                                        <label><input type="radio" name="avatarBadge" value="working" data-state-key="personalInfo.statusBadge">💻工作</label>
                                        <label><input type="radio" name="avatarBadge" value="invisible" data-state-key="personalInfo.statusBadge">⚪隐身</label>
                                        <label><input type="radio" name="avatarBadge" value="red-dot" data-state-key="personalInfo.statusBadge">🔴99+</label>
                                        <label><input type="radio" name="avatarBadge" value="emoji" data-state-key="personalInfo.statusBadge">😊自定义</label>
                                    </div></div>
                                    <div class="form-group" id="emoji-input-container" style="display:none;"><label>自定义Emoji:</label><input type="text" data-state-key="personalInfo.statusBadgeEmoji" maxlength="2"></div>
                                    <div class="form-group advanced-setting"><label>头像形状:</label><div class="radio-group"><label><input type="radio" name="avatarShape" value="50%" data-state-key="personalInfo.avatarShape">圆形</label><label><input type="radio" name="avatarShape" value="16px" data-state-key="personalInfo.avatarShape">圆角</label><label><input type="radio" name="avatarShape" value="0px" data-state-key="personalInfo.avatarShape">方形</label></div></div>
                                    <div class="form-group advanced-setting"><label>头像边框:</label><div class="color-control-row"><div class="color-control-group"><label>粗细(px):</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarBorderSize" min="0" max="10" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div><div class="color-control-group"><label>颜色:</label><div class="input-group"><input type="color" data-state-key="personalInfo.avatarBorderColor"><input type="text" class="color-hex-input" data-state-key="personalInfo.avatarBorderColor"><button class="btn btn-default btn-small" data-reset-key="personalInfo.avatarBorderColor">重置</button></div></div></div></div>
                                    <hr class="separator advanced-setting">
                                    <div class="form-group advanced-setting"><label>头像大小 (%): <span class="avatar-size-value">100</span></label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarSize" min="50" max="200" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                    <div class="form-group advanced-setting"><label>头像水平位置:</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarOffsetX" min="-100" max="100" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
                                    <div id="avatar-offsetY-control" class="form-group advanced-setting"><label>头像垂直偏移 (悬浮): <span class="avatar-offsetY-value">0</span>%</label><div class="input-group simple stepper-group"><button class="btn btn-default btn-stepper minus" aria-label="减少">-</button><input type="range" data-state-key="personalInfo.avatarOffsetY" min="0" max="100" step="1"><button class="btn btn-default btn-stepper plus" aria-label="增加">+</button></div></div>
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
                 * @description 渲染所有模块的预览效果。
                 */
                renderPreviewItems() {
                    const container = this.elements.previewItemsContainer;
                    container.innerHTML = this.state.items.length ? this.state.items.map(item => this.createPreviewItemHTML(item)).join('') : '<div class="empty-placeholder">(预览区) 无模块</div>';

                    this.postRenderAsyncUpdates(container);
                    this.updateHighlights();
                    this.renderMobileEditPencils();
                },

                createPreviewItemHTML(item) {
                    const borderSettings = this.state.globalBorderSettings;
                    const applyToKey = item.type;

                    const shouldApplyBorder = borderSettings.applyTo[applyToKey];
                    const borderClass = shouldApplyBorder ? 'apply-global-border' : '';

                    
                    const shadowSettings = borderSettings.globalShadowSettings;
                    const shouldApplyShadow = shadowSettings && shadowSettings.applyTo && shadowSettings.applyTo[applyToKey];
                    const shadowClass = shouldApplyShadow ? 'apply-global-shadow' : '';

                    const isHiddenClass = item.isVisible === false ? 'is-hidden' : '';

                    let styleAttribute = '';

                    // 仅在非紧凑模式下应用Flexbox的宽度计算
                    if (!this.state.systemSettings.masonryEnabled) {
                        const width = parseInt(item.layout.width, 10);
                        let widthStyle;
                        switch (width) {
                            case 100: widthStyle = `width: 100%;`; break;
                            case 67: widthStyle = `width: calc((100% - var(--preview-gap)) * 0.6666);`; break;
                            case 50: widthStyle = `width: calc((100% - var(--preview-gap)) / 2);`; break;
                            case 33: widthStyle = `width: calc((100% - (var(--preview-gap) * 2)) / 3);`; break;
                            default: widthStyle = 'width: 100%;';
                        }
                        styleAttribute = `style="${widthStyle}"`;
                    }

                    let innerHTML = '';
                    switch (item.type) {
                        case 'card': innerHTML = this.createPreviewCardHTML(item); break;
                        case 'image': innerHTML = this.createPreviewImageHTML(item); break;
                        case 'button': innerHTML = this.createPreviewButtonHTML(item); break;
                        case 'music': innerHTML = this.createPreviewMusicHTML(item); break;
                        case 'progress': innerHTML = this.createPreviewProgressHTML(item); break;
                        case 'timeline': innerHTML = this.createPreviewTimelineHTML(item); break;
                        case 'separator': innerHTML = this.createPreviewSeparatorHTML(item); break;
                        case 'spacer': innerHTML = this.createPreviewSpacerHTML(item); break;
                    }

                    return `<div class="preview-item-wrapper ${isHiddenClass} ${borderClass} ${shadowClass}" 
                 data-item-id="${item.id}" 
                 data-border-style="${borderSettings.style}"
                 ${styleAttribute}>
              ${innerHTML}
            </div>`;
                },

                createPreviewCardHTML(item) {
                    const stickerHTML = item.sticker && item.sticker !== 'none' ? `<div class="preview-card-sticker ${item.sticker}"></div>` : '';
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}"></span>` : '';

                    const g = this.state.globalComponentStyles;
                    const finalAlign = item.textAlign || g.textAlign;
                    const justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[finalAlign] || 'flex-start';
                    const finalTitleColor = item.titleColor || g.titleColor || item.textColor || g.textColor;

                    const cardHTML = `
                        ${stickerHTML}
                        <div class="preview-card-inner">
                            <h3 class="preview-card-title" data-item-key="title" style="justify-content: ${justifyContent}; color: ${finalTitleColor};">${iconHTML}${this.escapeHTML(item.title || '')}</h3>
                            <div class="preview-card-content" data-item-key="content">${this.sanitizeHTML(item.content || '')}</div>
                        </div>`;

                    const cardEl = document.createElement('div');
                    cardEl.className = 'preview-card';
                    cardEl.style.setProperty('--card-transition-name', `card-${item.id}`);
                    cardEl.innerHTML = cardHTML;

                    return cardEl.outerHTML;
                },

                createPreviewImageHTML(item) {
                    const textColorStyle = item.textColor ? `style="color: ${item.textColor};"` : '';
                    const figcaptionContent = (item.title || item.description) ?
                        `<figcaption ${textColorStyle}>
                            ${item.title ? `<strong data-item-key="title">${this.escapeHTML(item.title)}</strong>` : ''}
                            <span data-item-key="description">${this.escapeHTML(item.description || '')}</span>
                        </figcaption>`
                        : '';

                    return `<figure>
                                <img src="" alt="${this.escapeHTML(item.title || '')}" loading="lazy" style="object-fit: ${item.imageFillMode || 'cover'};">
                                ${figcaptionContent}
                            </figure>`;
                },

                createPreviewButtonHTML(item) {
                    const g = this.state.globalComponentStyles;
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}"></span>` : '';

                    const styles = [];
                    styles.push(`--button-bg-color: ${item.bgColor || g.bgColor}`);
                    styles.push(`--button-text-color: ${item.textColor || g.textColor}`);
                    if (item.radius != null) styles.push(`--button-border-radius: ${item.radius}px`);

                    const finalAlign = item.textAlign || 'center';
                    styles.push(`--button-text-align: ${finalAlign}`);

                    return `<div class="preview-button" style="${styles.join(';')}">
                        ${iconHTML}<span data-item-key="text">${this.escapeHTML(item.text || '')}</span>
                    </div>`;
                },

                createPreviewMusicHTML(item) {
                    if (item.style === 'vinyl') {
                        return this.createPreviewVinylMusicHTML(item);
                    }
                    const currentSec = this.parseTimeToSeconds(item.currentTime);
                    const totalSec = this.parseTimeToSeconds(item.totalTime);
                    const percent = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;
                    const lines = (item.lyrics || '').split('\n');

                    const g = this.state.globalComponentStyles;
                    const rawBg = item.bgColor || g.bgColor;
                    const opacity = (item.opacity !== undefined && item.opacity !== '') ? item.opacity : g.opacity;
                    const bgVar = this.hexToRgba(rawBg, opacity);

                    const textVar = item.textColor || g.textColor;
                    const accentVar = item.accentColor || this.state.globalTheme.accent;
                    const radiusVar = (item.radius !== undefined && item.radius !== '') ? `${item.radius}px` : `${g.radius}px`;

                    const l1 = lines[0] || '&nbsp;';
                    const l2 = lines[1] || '暂无歌词';
                    const l3 = lines[2] || '&nbsp;';

                    return `
                        <div class="music-card-preview" style="--music-bg-color:${bgVar}; --music-text-color:${textVar}; --music-radius:${radiusVar}; --music-accent-color:${accentVar};">
                            <img src="" class="music-cover" alt="Cover">
                            <div class="music-info">
                                <div class="music-header">
                                    <div class="music-title" data-item-key="songTitle">${this.escapeHTML(item.songTitle)}</div>
                                    <div class="music-artist" data-item-key="artist">${this.escapeHTML(item.artist)}</div>
                                </div>
                                <div class="music-lyrics-container">
                                    <div class="lyrics-line prev">${this.escapeHTML(l1)}</div>
                                    <div class="lyrics-line active">${this.escapeHTML(l2)}</div>
                                    <div class="lyrics-line next">${this.escapeHTML(l3)}</div>
                                </div>
                                <div class="music-bottom-area">
                                    <div class="music-progress-area">
                                        <div class="music-progress-bar"><div class="music-progress-fill" style="width: ${percent}%;"></div></div>
                                        <div class="music-time-labels"><span>${item.currentTime || '00:00'}</span><span>${item.totalTime || '00:00'}</span></div>
                                    </div>
                                    <div class="music-controls">
                                        <span class="iconify" data-icon="mdi:skip-previous"></span>
                                        <span class="iconify" data-icon="mdi:play-circle" style="font-size: 1.4em;"></span>
                                        <span class="iconify" data-icon="mdi:skip-next"></span>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                },

                createPreviewVinylMusicHTML(item) {
                    const g = this.state.globalComponentStyles;
                    const bgVar = this.hexToRgba(item.bgColor || g.bgColor, item.opacity ?? g.opacity);
                    const textVar = item.textColor || g.textColor;
                    const radiusVar = (item.radius !== undefined && item.radius !== '') ? `${item.radius}px` : `${g.radius}px`;

                    return `
                    <div class="music-card-preview music-card-vinyl" style="--music-bg-color:${bgVar}; --music-text-color:${textVar}; --music-radius:${radiusVar};">
                        <div class="vinyl-player">
                            <div class="vinyl-record">
                                <img src="" class="music-cover vinyl-label" alt="Cover">
                            </div>
                            <div class="vinyl-tonearm"></div>
                        </div>
                        <div class="music-info">
                            <div class="music-title" data-item-key="songTitle">${this.escapeHTML(item.songTitle)}</div>
                            <div class="music-artist" data-item-key="artist">${this.escapeHTML(item.artist)}</div>
                            <div class="music-controls" style="font-size: 1.5em; margin-top: 10px;">
                                <span class="iconify" data-icon="mdi:skip-previous"></span>
                                <span class="iconify" data-icon="mdi:play-circle" style="font-size: 1.4em;"></span>
                                <span class="iconify" data-icon="mdi:skip-next"></span>
                            </div>
                        </div>
                    </div>`;
                },

                createPreviewProgressHTML(item) {
                    const h = item.thickness || 8;
                    const g = this.state.globalComponentStyles;

                    const rawBg = item.bgColor || 'transparent';
                    let finalBgColor = 'transparent';

                    if (item.bgColor) {
                        const finalOpacity = (item.opacity !== undefined && item.opacity !== '') ? item.opacity : g.opacity;
                        finalBgColor = this.hexToRgba(rawBg, finalOpacity);
                    }

                    const textColor = item.textColor || g.textColor;
                    const radius = (item.radius !== undefined && item.radius !== '') ? item.radius : (item.bgColor ? g.radius : 0);
                    const padding = (item.padding !== undefined && item.padding !== '') ? item.padding : 0;

                    const bgStyle = `background-color: ${finalBgColor}; padding: ${padding}px; border-radius: ${radius}px;`;

                    return `
                        <div class="progress-bar-preview" style="${bgStyle}">
                            <div class="progress-bar-header" style="color: ${textColor};">
                                <span class="progress-bar-label" data-item-key="label">${this.escapeHTML(item.label)}</span>
                                <span class="progress-bar-value">${item.percentage}%</span>
                            </div>
                            <div class="progress-bar-track" style="background-color: ${item.trackColor || '#eee'}; height: ${h}px; border-radius: ${h / 2}px;">
                                <div class="progress-bar-fill" style="width: ${item.percentage}%; background-color: ${item.color};"></div>
                            </div>
                        </div>`;
                },

                createPreviewTimelineHTML(item) {
                    const g = this.state.globalComponentStyles;

                    const rawBg = item.bgColor || g.bgColor;
                    const finalOpacity = (item.opacity !== undefined && item.opacity !== '') ? item.opacity : g.opacity;
                    const finalBgColor = this.hexToRgba(rawBg, finalOpacity);

                    const textColor = item.textColor || g.textColor;
                    const radius = (item.radius !== undefined && item.radius !== '') ? item.radius : g.radius;

                    const styleVars = `
                        --tl-text-color: ${textColor};
                        --tl-time-color: ${item.timeColor || 'var(--text-secondary)'};
                        --tl-accent-color: ${item.accentColor || 'var(--g-theme-primary)'};
                    `;

                    const eventsHTML = (item.cards || []).map(event => `
                        <div class="timeline-event" data-card-id="${event.id}">
                             <div class="timeline-dot" style="border-color: var(--tl-accent-color); background-color: var(--bg-preview-page);"></div>
                             <div class="timeline-time" data-card-key="time" style="color: var(--tl-time-color);">${this.escapeHTML(event.time)}</div>
                             <div class="timeline-content" data-card-key="content" style="color: var(--tl-text-color);">${this.escapeHTML(event.content)}</div>
                        </div>`).join('');

                    return `<div class="timeline-preview" style="${styleVars} background-color: ${finalBgColor}; border-radius: ${radius}px;">
                                <div class="timeline-line" style="background-color: var(--border-color);"></div>
                                ${eventsHTML}
                            </div>`;
                },

                createPreviewSeparatorHTML(item) {
                    const hasTextOrIcon = item.text || item.icon;
                    const iconHTML = item.icon ? `<span class="iconify" data-icon="${item.icon}" style="margin-right: 8px; vertical-align: -0.15em;"></span>` : '';
                    const textHTML = `<span data-item-key="text" style="color: ${item.textColor}; padding: 0 12px; flex-shrink: 0;">${iconHTML}${this.escapeHTML(item.text || '')}</span>`;
                    const lineHTML = `<div class="separator-preview-line" style="flex-grow: 1; border-top: ${item.thickness}px ${item.style} ${item.color};"></div>`;

                    return `<div class="separator-preview" style="margin: ${item.margin}px 0;">
                                ${lineHTML}${hasTextOrIcon ? textHTML + lineHTML : ''}
                            </div>`;
                },

                createPreviewSpacerHTML(item) {
                    return `<div class="spacer-preview" style="height: ${item.height}px;"></div>`;
                },

                /**
                 * @description 将卡片的样式（包括全局样式和独立样式）应用到指定的DOM元素上。
                 * @param {HTMLElement} cardEl - 目标卡片的DOM元素。
                 * @param {object} itemData - 卡片的状态数据。
                 */
                async applyCardStyles(cardEl, itemData) {
                    const g = this.state.globalComponentStyles;
                    const use = (key, val) => (val === undefined || val === null || val === '') ? g[key] : val;

                    // 竖排文字支持
                    if (itemData.writingMode === 'vertical-rl') {
                        cardEl.classList.add('vertical-rl');
                    } else {
                        cardEl.classList.remove('vertical-rl');
                    }

                    const innerEl = cardEl.querySelector('.preview-card-inner');
                    if (!innerEl) return;

                    const titleEl = cardEl.querySelector('.preview-card-title');
                    const contentEl = cardEl.querySelector('.preview-card-content');
                    innerEl.style.textAlign = use('textAlign', itemData.textAlign);
                    if (titleEl) {
                        titleEl.style.fontSize = itemData.titleFontSize ? itemData.titleFontSize : '';
                    }
                    if (contentEl) {
                        contentEl.style.fontSize = itemData.contentFontSize ? itemData.contentFontSize : '';
                    }


                    const finalTextColor = use('textColor', itemData.textColor);
                    const finalTitleColor = itemData.titleColor || g.titleColor || finalTextColor;
                    if (titleEl) titleEl.style.color = finalTitleColor;


                    let finalBg;
                    if (itemData.bgImageDataUrl) {
                        let imageUrl = itemData.bgImageDataUrl;
                        if (imageUrl.startsWith('idb://')) {
                            try {
                                const imageId = imageUrl.substring(6);
                                const record = await this.getImageFromDB(imageId);
                                if (record && record.blob) imageUrl = URL.createObjectURL(record.blob);
                            } catch (e) { console.error('从数据库加载卡片背景失败:', e); }
                        }
                        finalBg = `url(${imageUrl})`;
                    } else if (itemData.bgColor) {
                        finalBg = itemData.bgColor;
                    } else {
                        finalBg = g.bgMode === 'gradient' ? `linear-gradient(${g.bgGradientAngle}deg, ${g.bgGradientStart}, ${g.bgGradientEnd})` : g.bgColor;
                    }

                    const finalOpacity = use('opacity', itemData.opacity);

                    innerEl.style.setProperty('--card-bg-final', finalBg);
                    innerEl.style.setProperty('--card-bg-opacity', finalOpacity);

                    if (parseFloat(finalOpacity) < 0.01) {
                        innerEl.style.boxShadow = 'none';
                    } else {
                        innerEl.style.setProperty('--card-text-color', finalTextColor);
                        innerEl.style.setProperty('--active-card-text-shadow', 'none');
                        const overlayOpacity = itemData.bgImageDataUrl ? (itemData.overlayOpacity ?? 0.5) : 0;
                        innerEl.style.setProperty('--card-overlay-color', itemData.overlayColor || '#FFF');
                        innerEl.style.setProperty('--card-overlay-opacity', parseFloat(overlayOpacity) > 0 ? overlayOpacity : 0);
                        innerEl.style.boxShadow = 'var(--active-card-shadow)';
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
                        let desc = historyDescription;
                        if (!desc) {
                            const parts = keyPath.split('.');
                            const keyName = parts[parts.length - 1];
                            const nameMap = {
                                'bgColor': '背景色', 'textColor': '文字色', 'radius': '圆角', 'opacity': '不透明度',
                                'text': '文本', 'title': '标题', 'songTitle': '歌名', 'artist': '歌手', 'lyrics': '歌词',
                                'percentage': '进度', 'label': '标签', 'time': '时间', 'content': '内容',
                                'gap': '间距', 'width': '宽度', 'height': '高度', 'margin': '边距',
                                'layout': '布局', 'coverArt': '封面',
                                'accentColor': '高亮色', 'trackColor': '轨道色', 'thickness': '粗细',
                                'timeColor': '时间色', 'style': '样式', 'color': '颜色',
                                'isVisible': '可见性', 'headerBgColor': '头部背景', 'headerTextColor': '头部文字',
                                'pageBgSolidColor': '页面背景', 'nickname': '昵称', 'subtitle': '副标题', 'bio': '简介'
                            };
                            const parentMap = {
                                'items': '模块', 'personalInfo': '个人信息', 'pageStyles': '页面样式',
                                'globalComponentStyles': '全局组件',
                            };
                            const actionName = nameMap[keyName] || keyName;
                            const scopeName = parentMap[parts[0]] || '';
                            desc = `修改 ${scopeName}${actionName}`;
                        }
                        this.pushHistory(desc);
                    }
                    let obj = this.state;
                    const keys = keyPath.split('.');
                    for (let i = 0; i < keys.length - 1; i++) { obj = obj?.[keys[i]]; }
                    if (obj) obj[keys[keys.length - 1]] = value;

                    this.debouncedSaveToLocal();
                    this.triggerRender(keyPath);

                    if (!document.activeElement.matches('input[type="text"].color-hex-input')) {
                        this.syncControl(keyPath);
                    }
                },

                /**
                 * @description 根据更新的状态路径，触发最高效的局部UI渲染。
                 * @param {string} keyPath - 被更新的状态路径。
                 */
                triggerRender(keyPath) {
                    const styles = this.state.pageStyles;
                    const gComp = this.state.globalComponentStyles;
                    const gBorder = this.state.globalBorderSettings;
                    const gTheme = this.state.globalTheme;
                    const info = this.state.personalInfo;
                    const r = document.documentElement.style;

                    const directUpdateMap = {
                        // 全局主题
                        'globalTheme.primary': () => r.setProperty('--g-theme-primary', gTheme.primary),
                        'globalTheme.accent': () => r.setProperty('--g-theme-accent', gTheme.accent),
                        'globalTheme.background': () => r.setProperty('--g-theme-background', gTheme.background),
                        'globalTheme.text': () => r.setProperty('--g-theme-text', gTheme.text),

                        // 头部样式
                        'pageStyles.headerBgColor': () => { if (styles.headerBgMode === 'solid') this.elements.previewHeader.style.background = this.hexToRgba(styles.headerBgColor, styles.headerOpacity); },
                        'pageStyles.headerBgGradientStart': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerBgGradientEnd': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerBgGradientAngle': () => { if (styles.headerBgMode === 'gradient') this.elements.previewHeader.style.background = `linear-gradient(${styles.headerBgGradientAngle}deg, ${this.hexToRgba(styles.headerBgGradientStart, styles.headerOpacity)}, ${this.hexToRgba(styles.headerBgGradientEnd, styles.headerOpacity)})` },
                        'pageStyles.headerOpacity': () => this.renderPageStyles(),
                        'pageStyles.headerBorderRadius': () => { this.elements.previewHeader.style.borderRadius = `${styles.headerBorderRadius}px`; },

                        // 页面背景
                        'pageStyles.pageBgSolidColor': () => { if (styles.pageBgMode === 'solid') this.elements.previewWrapper.style.backgroundColor = styles.pageBgSolidColor; },
                        'pageStyles.pageBgGradientStart': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageBgGradientEnd': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageBgGradientAngle': () => { if (styles.pageBgMode === 'gradient') this.renderPageStyles(); },
                        'pageStyles.pageOverlayOpacity': () => this.renderPageStyles(),
                        'pageStyles.pageOverlayColor': () => this.renderPageStyles(),

                        // 全局组件
                        'globalComponentStyles.opacity': () => { r.setProperty('--g-comp-opacity', gComp.opacity); this.renderPreviewItems(); },
                        'globalComponentStyles.radius': () => r.setProperty('--g-comp-border-radius', `${gComp.radius}px`),
                        'globalComponentStyles.bgColor': () => { r.setProperty('--g-comp-bg-color', gComp.bgColor); if (gComp.bgMode === 'solid') this.renderPreviewItems(); },
                        'globalComponentStyles.textColor': () => { r.setProperty('--g-comp-text-color', gComp.textColor); this.renderPreviewItems(); },
                        'globalComponentStyles.bgGradientStart': () => { if (gComp.bgMode === 'gradient') this.renderPreviewItems(); },
                        'globalComponentStyles.bgGradientEnd': () => { if (gComp.bgMode === 'gradient') this.renderPreviewItems(); },
                        'globalComponentStyles.bgGradientAngle': () => { if (gComp.bgMode === 'gradient') this.renderPreviewItems(); },
                        'globalComponentStyles.textStrokeWidth': () => { r.setProperty('--g-comp-text-stroke', gComp.textStrokeWidth > 0 ? `${gComp.textStrokeWidth}px ${gComp.textStrokeColor}` : '0px transparent'); },
                        'globalComponentStyles.textStrokeColor': () => { r.setProperty('--g-comp-text-stroke', gComp.textStrokeWidth > 0 ? `${gComp.textStrokeWidth}px ${gComp.textStrokeColor}` : '0px transparent'); },
                        'globalComponentStyles.titleColor': () => { this.renderPreviewItems(); },
                        'globalComponentStyles.titleFontSize': () => { r.setProperty('--g-comp-title-font-size', gComp.titleFontSize); },
                        'globalComponentStyles.contentFontSize': () => { r.setProperty('--g-comp-content-font-size', gComp.contentFontSize); },
                        'globalComponentStyles.padding': () => { r.setProperty('--g-comp-padding', `${gComp.padding}px`); },

                        
                        'globalComponentStyles.shadowColor': () => this.updateGlobalComponentStyleVars(),
                        'globalComponentStyles.shadowOpacity': () => this.updateGlobalComponentStyleVars(),
                        'globalComponentStyles.shadowOffsetX': () => this.updateGlobalComponentStyleVars(),
                        'globalComponentStyles.shadowOffsetY': () => this.updateGlobalComponentStyleVars(),
                        'globalComponentStyles.shadowBlur': () => this.updateGlobalComponentStyleVars(),

                        // 全局边框
                        'globalBorderSettings.style': () => {
                            this.updateGlobalBorderVars();
                            this.renderPreviewItems();
                            this.renderPersonalInfo(); 
                        },
                        'globalBorderSettings.width': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.color': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.shadowOffset': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.applyTo.personalInfo': () => this.renderPersonalInfo(),
                        'globalBorderSettings.applyTo.card': () => this.renderPreviewItems(),
                        'globalBorderSettings.applyTo.image': () => this.renderPreviewItems(),
                        'globalBorderSettings.applyTo.button': () => this.renderPreviewItems(),
                        'globalBorderSettings.applyTo.music': () => this.renderPreviewItems(),
                        'globalBorderSettings.applyTo.timeline': () => this.renderPreviewItems(),

                        
                        'globalBorderSettings.globalShadowSettings.color': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.globalShadowSettings.opacity': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.globalShadowSettings.offsetX': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.globalShadowSettings.offsetY': () => this.updateGlobalBorderVars(),
                        'globalBorderSettings.globalShadowSettings.blur': () => this.updateGlobalBorderVars(),
                        // 应用目标改变需要重绘 HTML class
                        'globalBorderSettings.globalShadowSettings.applyTo.personalInfo': () => this.renderPersonalInfo(),
                        'globalBorderSettings.globalShadowSettings.applyTo.card': () => this.renderPreviewItems(),
                        'globalBorderSettings.globalShadowSettings.applyTo.image': () => this.renderPreviewItems(),
                        'globalBorderSettings.globalShadowSettings.applyTo.button': () => this.renderPreviewItems(),
                        'globalBorderSettings.globalShadowSettings.applyTo.music': () => this.renderPreviewItems(),
                        'globalBorderSettings.globalShadowSettings.applyTo.timeline': () => this.renderPreviewItems(),

                        // 个人信息
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

                    if (mainKey === 'personalInfo') {
                        const subKey = keyParts[1];
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
                                    const wrapper = this.elements.previewHeader.querySelector('#preview-avatar-wrapper');
                                    if (wrapper) {
                                        wrapper.style.transform = `translateX(${offsetX}%)`;
                                    }
                                    const overflowAmount = (newSize * (offsetY / 100));
                                    if (wrapper) {
                                        wrapper.style.marginTop = `-${overflowAmount}px`;
                                    }
                                    previewAvatar.style.transform = 'none';
                                    previewAvatar.style.marginTop = '0';
                                    this.elements.previewWrapper.style.paddingTop = `${20 + (overflowAmount / 2.5)}px`;
                                }
                                break;
                            case 'avatarShape':
                                if (previewAvatar) previewAvatar.style.borderRadius = info.avatarShape;
                                break;
                            default:
                                this.renderPersonalInfo();
                                this.renderLayerPanel();
                                if (subKey === 'tags') this.renderTagManager();
                        }
                        this.renderMobileEditPencils();
                        return;
                    }

                    if (['pageStyles', 'globalComponentStyles', 'globalBorderSettings', 'globalTheme', 'exportSettings', 'systemSettings'].includes(mainKey)) {
                        switch (mainKey) {
                            case 'globalComponentStyles':
                                // 核心修复：只更新CSS变量，不再重新渲染所有模块。
                                this.updateGlobalComponentStyleVars();
                                break;
                            case 'globalBorderSettings':
                                this.updateGlobalBorderVars();
                                // 仅当边框的“样式”或“应用目标”改变时才需要重绘，因为这会改变HTML的class和属性。
                                if (keyPath.includes('style') || keyPath.includes('applyTo')) {
                                    this.renderPreviewItems();
                                }
                                break;
                            case 'pageStyles':
                            case 'globalTheme':
                                this.renderPageStyles();
                                break;
                            case 'exportSettings':
                                this.updatePreviewAspectRatio();
                                break;
                            case 'systemSettings':
                                this.applyLayout();
                                break;
                        }

                        // 如果当前就在“全局”编辑面板，同步一下控件状态
                        if (this.selection.type === 'global') {
                            this.syncAllControls();
                        }
                        return; // 处理完毕，提前返回
                    }

                    if (mainKey === 'items') {
                        if (keyParts.length <= 2) {
                            this.renderLayerPanel();
                            this.renderPreviewItems();
                            return;
                        }

                        const itemIndex = parseInt(keyParts[1], 10);
                        const item = this.state.items[itemIndex];
                        if (!item) return;

                        const updatedProperty = keyParts[2];

                        if (updatedProperty === 'title') {
                            this.renderLayerPanel();
                            this.renderPreviewItemById(item.id);
                            return;
                        }

                        if (updatedProperty === 'isVisible' || updatedProperty === 'isExpanded' || updatedProperty === 'layout') {
                            this.renderPreviewItemById(item.id);
                            this.renderLayerPanel();
                            return;
                        }

                        this.renderPreviewItemById(item.id);
                    }
                    if (keyPath.startsWith('items') || keyPath.startsWith('systemSettings.masonryEnabled') || keyPath.startsWith('systemSettings.previewGap')) {
                        setTimeout(() => this.applyLayout(), 50);
                    }
                },

                handleMusicCoverUpload(event, itemId) {
                    const item = this.findItem(itemId);
                    if (!item) return;
                    this.handleImageUpload(event, 'musicCover', { itemId, oldImageUrl: item.coverArt });
                },

                handleItemBgUpload(event, itemId) {
                    const item = this.findItem(itemId);
                    this.handleImageUpload(event, 'cardBg', { itemId, oldImageUrl: item?.bgImageDataUrl });
                },

                async handleImageGalleryUpload(itemId, files) {
                    if (!files.length) return;
                    this.showLoading(`正在上传 ${files.length} 张图片...`);

                    const successItems = [];
                    const failedFiles = [];

                    const results = await Promise.allSettled(Array.from(files).map(async file => {
                        const objectUrl = URL.createObjectURL(file);
                        const compressedUrl = await this.compressImage(objectUrl, 0.9, 1200, file.type);
                        const blob = this.dataURLToBlob(compressedUrl);
                        const imageId = this.generateId('img');
                        await this.saveImageToDB({ id: imageId, blob });
                        return { id: this.generateId('i'), type: 'image', isVisible: true, url: `idb://${imageId}`, title: '', description: '', imageFillMode: 'cover', layout: { width: 50 } };
                    }));

                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            successItems.push(result.value);
                        } else {
                            failedFiles.push(files[index].name);
                            console.error(`处理文件 ${files[index].name} 失败:`, result.reason);
                        }
                    });

                    if (successItems.length > 0) {
                        this.pushHistory(`添加 ${successItems.length} 张图片`);
                        const insertIndex = this.findItemIndex(itemId) + 1;
                        this.state.items.splice(insertIndex, 0, ...successItems);
                        this.debouncedSaveToLocal();
                    }

                    this.renderAll();
                    this.hideLoading();

                    if (failedFiles.length > 0) {
                        this.showErrorModal('部分图片上传失败', `以下文件未能成功上传: ${failedFiles.join(', ')}`);
                    }
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

                        
                        if (saved.blocks) {
                            saved = this.migrateV1DataToV2(saved);
                            this.showToast('检测到旧版本数据，已自动升级到 v2.0 模块化布局！', 'success');
                        }

                        if (saved && saved.personalInfo) {
                            saved = await this.processStateForImageMigration(saved);

                            if (typeof saved.personalInfo.tags === 'string') {
                                saved.personalInfo.tags = saved.personalInfo.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
                                    .map(text => ({ id: this.generateId('t'), icon: null, text }));
                                this.showToast('旧版配置已加载，标签数据已自动转换。', 'info');
                            }

                            const defaultState = this.getDefaultState();
                            this.state = this.mergeDeep(defaultState, saved);
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

                migrateV1DataToV2(oldState) {
                    const newState = this.getDefaultState();
                    newState.personalInfo = oldState.personalInfo;
                    newState.pageStyles = oldState.pageStyles;
                    newState.globalBorderSettings = oldState.globalBorderSettings;
                    newState.systemSettings = oldState.systemSettings;
                    newState.customIcons = oldState.customIcons || [];

                    // 迁移样式
                    newState.globalComponentStyles = oldState.globalCardStyles || newState.globalComponentStyles;
                    if (oldState.globalButtonStyles) {
                        newState.globalComponentStyles.buttonBgColor = oldState.globalButtonStyles.bgColor;
                        newState.globalComponentStyles.buttonTextColor = oldState.globalButtonStyles.textColor;
                    }

                    // 迁移核心内容
                    newState.items = [];
                    oldState.blocks.forEach(block => {
                        switch (block.type) {
                            case 'text':
                            case 'image':
                            case 'button':
                                let width = 100;
                                if (block.settings.layout === 'dual') width = 50;
                                if (block.settings.layout === 'triple') width = 33;
                                block.cards.forEach(card => {
                                    const newItem = {
                                        ...card,
                                        type: block.type === 'text' ? 'card' : block.type,
                                        isVisible: block.isVisible,
                                        layout: { width: width },
                                        // 继承旧区块的文本颜色设置
                                        textColor: block.settings.textColor || card.textColor
                                    };
                                    newState.items.push(newItem);
                                });
                                break;

                            case 'music':
                            case 'progress':
                                newState.items.push({
                                    ...block.settings,
                                    id: block.id,
                                    type: block.type,
                                    isVisible: block.isVisible,
                                    layout: { width: 100 }
                                });
                                break;

                            case 'timeline':
                                newState.items.push({
                                    ...block.settings,
                                    id: block.id,
                                    type: block.type,
                                    isVisible: block.isVisible,
                                    cards: block.cards,
                                    layout: { width: 100 }
                                });
                                break;

                            case 'separator':
                            case 'spacer':
                                newState.items.push({
                                    ...block.settings,
                                    id: block.id,
                                    type: block.type,
                                    isVisible: block.isVisible,
                                    layout: { width: 100 }
                                });
                                break;
                        }
                    });

                    return newState;
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
                        const inputs = this.elements.inspectorPanel.querySelectorAll(`[data-state-key="${keyPath}"], [data-item-key="${keyPath.split('.').slice(2).join('.')}"]`);
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
                                const valueDisplay = input.closest('.form-group').querySelector('span[class*="-value"]');
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
                        this.elements.inspectorPanel.querySelectorAll('[data-state-key], [data-item-key]').forEach(input => {
                            try {
                                const stateKey = input.dataset.stateKey;
                                const itemKey = input.dataset.itemKey;
                                let value;

                                if (stateKey) {
                                    if (stateKey === 'personalInfo.tags') return;
                                    value = stateKey.split('.').reduce((o, k) => o && o[k], this.state);
                                } else if (itemKey && this.selection.type === 'item') {
                                    const item = this.findItem(this.selection.id);
                                    if (item) value = itemKey.split('.').reduce((o, k) => o && o[k], item);

                                }

                                if (value !== undefined) {
                                    if (input.type === 'radio') {
                                        input.checked = (input.value == value);
                                    } else if (input.type === 'checkbox') {
                                        input.checked = !!value;
                                    } else if (input.matches('textarea[data-item-key="content"]')) {
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
                                        const valueDisplay = input.closest('.form-group').querySelector('span[class*="-value"]');
                                        if (valueDisplay) valueDisplay.textContent = value;
                                    }
                                }
                            } catch (e) { }
                        });

                        const attrToggle = this.elements.inspectorPanel.querySelector('#export-attribution-toggle');
                        if (attrToggle) {
                            if (this.state.pageStyles.pageBgImageAttribution) {
                                attrToggle.checked = true;
                            } else {
                                attrToggle.checked = false;
                            }
                            this.updateAttributionLink();
                        }

                        const gCompSection = this.elements.inspectorPanel.querySelector('#global-component-styles-section');
                        if (gCompSection) {
                            const activeTab = this.state.globalComponentStyles.bgMode === 'gradient' ? 'comp-bg-gradient' : 'comp-bg-solid';
                            gCompSection.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
                            gCompSection.querySelectorAll(':scope > .section-content > .tab-content').forEach(c => c.classList.toggle('active', c.id === activeTab));
                        }

                        const customDimControls = this.elements.inspectorPanel.querySelector('#custom-dimensions-controls');
                        if (customDimControls) {
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

                        const emojiInputContainer = this.elements.inspectorPanel.querySelector('#emoji-input-container');
                        if (emojiInputContainer) {
                            emojiInputContainer.style.display = this.state.personalInfo.statusBadge === 'emoji' ? 'block' : 'none';
                        }

                        this.elements.inspectorPanel.querySelectorAll('[data-style-specific]').forEach(el => {
                            el.style.display = this.state.globalBorderSettings.style === el.dataset.styleSpecific ? '' : 'none';
                        });

                    } finally {
                        this.isRestoringState = false;
                    }
                },

                findItem(itemId) { return this.state.items.find(item => item.id === itemId); },
                findItemIndex(itemId) { return this.state.items.findIndex(item => item.id === itemId); },

                updateItem(itemId, key, value, pushHistory, historyDescription) {
                    const itemIndex = this.findItemIndex(itemId);
                    if (itemIndex > -1) this.updateState(`items.${itemIndex}.${key}`, value, pushHistory, historyDescription);
                },

                renderPreviewItemById(itemId) {
                    const wrapper = this.elements.previewItemsContainer.querySelector(`.preview-item-wrapper[data-item-id="${itemId}"]`);
                    const item = this.findItem(itemId);
                    if (item && wrapper) {
                        // 替换新 HTML
                        wrapper.outerHTML = this.createPreviewItemHTML(item);
                        const newWrapper = this.elements.previewItemsContainer.querySelector(`.preview-item-wrapper[data-item-id="${itemId}"]`);
                        this.postRenderAsyncUpdates(newWrapper);

                        // 如果紧凑模式开启，单个元素的变化可能影响全局，需要重新计算布局
                        if (this.state.systemSettings.masonryEnabled) {
                            // 使用 requestAnimationFrame 确保在DOM更新后立即重新计算布局
                            requestAnimationFrame(() => this.applyGridCompactLayout());
                        }
                    }
                    this.renderMobileEditPencils();
                },

                pushHistory(description = '操作') {
                    if (this.isRestoringState) return;
                    if (this.historyIndex < this.history.length - 1) {
                        this.history = this.history.slice(0, this.historyIndex + 1);
                    }
                    this.history.push({ state: this.deepClone(this.state), description });
                    if (this.history.length > 50) this.history.shift();
                    this.historyIndex = this.history.length - 1;
                    this.updateUndoRedoButtons();
                    this.renderHistoryList();
                },
                undo() {
                    if (document.activeElement && (document.activeElement.isContentEditable || /INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
                        document.activeElement.blur();
                    }
                    if (this.historyIndex <= 0) return;
                    const actionDescription = this.history[this.historyIndex].description;
                    this.jumpToHistory(this.historyIndex - 1, `已撤销: ${actionDescription}`);
                },
                redo() {
                    if (document.activeElement && (document.activeElement.isContentEditable || /INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
                        document.activeElement.blur();
                    }
                    if (this.historyIndex >= this.history.length - 1) return;
                    const actionDescription = this.history[this.historyIndex + 1].description;
                    this.jumpToHistory(this.historyIndex + 1, `已重做: ${actionDescription}`);
                },
                jumpToHistory(index, toastMessage = null) {
                    if (index < 0 || index >= this.history.length) return;

                    this.isRestoringState = true;
                    const currentInspectorTab = this.state.ui.activeInspectorTab;
                    this.historyIndex = index;
                    this.state = this.deepClone(this.history[this.historyIndex].state);
                    this.state.ui.activeInspectorTab = currentInspectorTab;

                    this.renderAll();
                    this.syncAllControls();
                    this.updateUndoRedoButtons();
                    this.isRestoringState = false;

                    if (toastMessage) this.showToast(toastMessage, 'info');
                    if (currentInspectorTab === 'system') {
                        const historyContainer = this.elements.inspectorPanel.querySelector('#history-list');
                        if (historyContainer) {
                            const activeItem = historyContainer.querySelector('.history-item.active');
                            if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                },
                renderHistoryList() {
                    const container = this.elements.inspectorPanel.querySelector('#history-list');
                    if (!container) return;
                    if (this.history.length <= 1) {
                        container.innerHTML = `<div class="empty-history-list">暂无操作历史</div>`;
                        return;
                    }

                    container.innerHTML = [...this.history].reverse().map((item, i) => {
                        const index = this.history.length - 1 - i;
                        const desc = (typeof item.description === 'string') ? item.description : '未知操作';
                        return `<div class="history-item ${index === this.historyIndex ? 'active' : ''}" data-index="${index}">${this.escapeHTML(desc)}</div>`;
                    }).join('');

                    // 绑定历史记录的长按/右键事件
                    this.bindHistoryContextEvents();
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

                async handleImageGalleryUpload(files) {
                    if (!files.length) return;
                    this.showLoading(`正在上传 ${files.length} 张图片...`);

                    const successItems = [];
                    const failedFiles = [];

                    const results = await Promise.allSettled(Array.from(files).map(async file => {
                        const objectUrl = URL.createObjectURL(file);
                        const compressedUrl = await this.compressImage(objectUrl, 0.9, 1200, file.type);
                        const blob = this.dataURLToBlob(compressedUrl);
                        const imageId = this.generateId('img');
                        await this.saveImageToDB({ id: imageId, blob });
                        return {
                            id: this.generateId('i'),
                            type: 'image',
                            isVisible: true,
                            url: `idb://${imageId}`,
                            title: '',
                            description: '',
                            imageFillMode: 'cover',
                            layout: { width: 50 } // 默认50%宽度，可以自己调整
                        };
                    }));

                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            successItems.push(result.value);
                        } else {
                            failedFiles.push(files[index].name);
                            console.error(`处理文件 ${files[index].name} 失败:`, result.reason);
                        }
                    });

                    if (successItems.length > 0) {
                        this.pushHistory(`添加 ${successItems.length} 张图片`);

                        const currentSelectionIndex = this.selection.id ? this.findItemIndex(this.selection.id) : -1;
                        const insertIndex = currentSelectionIndex > -1 ? currentSelectionIndex + 1 : this.state.items.length;

                        this.state.items.splice(insertIndex, 0, ...successItems);
                        this.debouncedSaveToLocal();
                    }

                    this.renderAll();
                    this.hideLoading();

                    if (failedFiles.length > 0) {
                        this.showErrorModal('部分图片上传失败', `以下文件未能成功上传: ${failedFiles.join(', ')}`);
                    }
                },

                async handleImageUpload(event, target, itemInfo = null) {
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

                        const maxDim = (target === 'pageBg') ? 1920 : 1200;
                        const compressedUrl = await this.compressImage(objectUrl, 0.9, maxDim);

                        if (['avatar', 'pageBg', 'cardBg', 'image', 'musicCover'].includes(target)) {
                            if (target === 'pageBg') {
                                this.updateState('pageStyles.pageBgImageAttribution', null, false);
                            }
                            if (target === 'image') {
                                // For image items, we save directly and don't open cropper immediately
                                const blob = this.dataURLToBlob(compressedUrl);
                                const imageId = this.generateId('img');
                                await this.saveImageToDB({ id: imageId, blob });
                                const newItem = { id: this.generateId('i'), type: 'image', isVisible: true, url: `idb://${imageId}`, title: '', description: '', imageFillMode: 'cover', layout: { width: 50 } };
                                this.addItem(null, null, newItem);
                                this.hideLoading();
                            } else {
                                this.showCropper(compressedUrl, { type: target, ...itemInfo, originalType: file.type });
                            }
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
                    const attribution = {
                        user: imageData.user,
                        pageURL: imageData.pageURL
                    };
                    this.elements.imageSourceModal.classList.remove('visible');
                    // v2.0 适配：直接调用 showCropper，目标是页面背景
                    this.updateState('pageStyles.pageBgImageAttribution', attribution, true);
                    this.showCropper(imageData.largeImageURL, { type: 'pageBg', originalType: 'image/jpeg' });
                },

                handleMusicCoverUpload(event, itemId) {
                    const item = this.findItem(itemId);
                    if (!item) return;
                    this.handleImageUpload(event, 'musicCover', { itemId, oldImageUrl: item.coverArt });
                },

                async cropImage(itemId) {
                    const item = this.findItem(itemId);
                    if (item && item.url) {
                        let imageUrl = item.url;
                        if (imageUrl.startsWith('idb://')) {
                            const record = await this.getImageFromDB(imageUrl.substring(6));
                            if (record && record.blob) {
                                imageUrl = URL.createObjectURL(record.blob);
                            }
                        }
                        this.showCropper(imageUrl, { type: 'image', itemId, oldImageUrl: item.url, originalType: 'image/png' });
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
                            crop: this.debounce(() => {
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

                    cropperImage.crossOrigin = "anonymous";
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
                        const { type, itemId, originalType, oldImageUrl } = this.currentCropTarget;
                        let quality = 0.9;

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
                            } else if (type === 'image') {
                                this.updateItem(itemId, 'url', idbUrl, false);
                            } else if (type === 'cardBg') {
                                this.updateItem(itemId, 'bgImageDataUrl', idbUrl, false);
                            } else if (type === 'musicCover') {
                                this.updateItem(itemId, 'coverArt', idbUrl, false);
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

                        sliderEl.replaceWith(sliderEl.cloneNode(true));
                        document.getElementById(config.slider).addEventListener('input', (e) => {
                            valueEl.textContent = e.target.value;
                            handler();
                        });
                    }
                    document.getElementById('filter-controls').style.display = 'none';
                },

                /**
                 * @description 显示富文本编辑器模态框。
                 * @param {HTMLElement} targetElement - 触发编辑的预览区内容元素。
                 */
                showRichTextEditor(targetElement) {
                    if (!targetElement) return;

                    const itemEl = targetElement.closest('.preview-item-wrapper');
                    if (!itemEl) return;

                    this.currentRichTextTarget = {
                        itemId: itemEl.dataset.itemId,
                        element: targetElement
                    };

                    const item = this.findItem(this.currentRichTextTarget.itemId);

                    const container = this.elements.richTextEditorContainer;
                    const parent = container.parentElement;

                    const oldToolbar = parent.querySelector('.ql-toolbar');
                    if (oldToolbar) {
                        oldToolbar.remove();
                    }

                    container.innerHTML = '';
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

                    this.richTextEditor.root.innerHTML = item.content || '';

                    this.elements.richTextEditorModal.classList.add('visible');
                    this.richTextEditor.focus();
                },

                hideRichTextEditor() {
                    this.elements.richTextEditorModal.classList.remove('visible');
                    this.currentRichTextTarget = null;
                },

                saveRichText() {
                    if (!this.richTextEditor || !this.currentRichTextTarget) return;

                    const { itemId } = this.currentRichTextTarget;
                    const newContent = this.richTextEditor.root.innerHTML;

                    this.updateItem(itemId, 'content', newContent, true, '编辑卡片内容');
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
                            this.updateState('globalComponentStyles.fontFamily', lastUploadedFontFamily, true, `上传 ${successCount} 个字体`);
                        }
                        this.showToast(`${successCount} 个字体上传成功！`, 'success');
                    }
                },

                populateFontList(searchTerm = '') {
                    const select = this.elements.inspectorPanel.querySelector('#font-family-select');
                    if (!select) return;
                    const currentFont = this.state.globalComponentStyles.fontFamily;
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
                    if (this.state.globalComponentStyles.fontFamily) {
                        fonts.add(this.state.globalComponentStyles.fontFamily);
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

                    this.state.globalComponentStyles.bgColor = preset.gCardBgColor;
                    this.state.globalComponentStyles.bgGradientStart = preset.gCardBgGradientStart;
                    this.state.globalComponentStyles.bgGradientEnd = preset.gCardBgGradientEnd;
                    this.state.globalComponentStyles.textColor = preset.gCardTextColor;
                    this.state.globalComponentStyles.opacity = preset.gCardOpacity;

                    this.state.personalInfo.nicknameColor = preset.pNicknameColor;
                    this.state.personalInfo.subtitleColor = preset.pSubtitleColor;
                    this.state.personalInfo.bioColor = preset.pBioColor;
                    this.state.personalInfo.tagBgColor = preset.pTagBgColor;
                    this.state.personalInfo.tagTextColor = preset.pTagTextColor;

                    this.state.pageStyles.pageBgMode = 'solid';
                    this.state.pageStyles.headerBgMode = 'solid';
                    this.state.globalComponentStyles.bgMode = 'solid';

                    this.debouncedSaveToLocal();
                    this.renderAll();
                    this.syncAllControls();
                    this.showToast('预设已应用', 'success');
                },

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
                        img.crossOrigin = "Anonymous";
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
                        delete stateToSave.uploadedFonts;
                        localStorage.setItem('blokkoState', JSON.stringify(stateToSave));
                        localStorage.setItem('blokkoHistory', JSON.stringify(this.history.slice(-20)));
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

                generateFilename(type) {
                    const prefix = this.state.systemSettings.exportFilePrefix || 'Blokko';
                    const date = new Date();
                    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
                    const randomString = Math.random().toString(36).substring(2, 8);
                    return `${prefix}-${dateString}-${type}-${randomString}`;
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

                        stateToSave.items.forEach(item => {
                            if (['card', 'image', 'button', 'music', 'progress', 'timeline'].includes(item.type)) {
                                item.title = this.getDefaultState().items.find(i => i.type === item.type)?.title || item.title;
                                if (item.type === 'image') {
                                    item.url = null;
                                    item.description = '';
                                } else if (item.type === 'card' || item.type === 'button') {
                                    item.content = '示例内容';
                                    item.text = '示例按钮';
                                } else {
                                    const defaultItem = this.getDefaultState().items.find(i => i.type === item.type);
                                    if (defaultItem) {
                                        Object.keys(defaultItem).forEach(key => {
                                            if (!['id', 'type', 'isVisible', 'layout'].includes(key)) {
                                                item[key] = defaultItem[key];
                                            }
                                        });
                                    }
                                }
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
                        zip.file("readme.txt", `Blokko 强化导出备份\n版本: 2.0.0\n导出时间: ${new Date().toLocaleString()}\n\n此 .zip 文件包含了您的配置文件 (config.json) 和所有图片资源 (images/ 文件夹)。`);

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

                        
                        if (importedState.blocks) {
                            importedState = this.migrateV1DataToV2(importedState);
                            this.showToast('旧版ZIP包已自动升级为新版布局！', 'info');
                        }

                        this.state = this.mergeDeep(this.getDefaultState(), importedState);
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
                            if (!importedState || !importedState.personalInfo) throw new Error('无效的文件格式');

                            
                            if (importedState.blocks) {
                                importedState = this.migrateV1DataToV2(importedState);
                                this.showToast('旧版JSON配置已自动升级为新版布局！', 'info');
                            }

                            importedState = await this.processStateForImageMigration(importedState);

                            if (typeof importedState.personalInfo.tags === 'string') {
                                importedState.personalInfo.tags = importedState.personalInfo.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
                                    .map(text => ({ id: this.generateId('t'), icon: null, text }));
                                this.showToast('旧版配置已导入并自动升级。', 'info');
                            }

                            this.state = this.mergeDeep(this.getDefaultState(), importedState);
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
                            this.bindResizeListener();
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

                async exportPNG() {
                    try {
                        this.showLoading('加载导出组件...');
                        if (typeof domtoimage === 'undefined') {
                            await this.loadScript('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.1.5/dist/dom-to-image-more.min.js');
                        }
                    } catch (error) {
                        this.hideLoading();
                        this.showErrorModal('加载失败', '导出组件加载失败。请检查网络连接。');
                        return;
                    }

                    this.showLoading('等待字体加载...');
                    try { await document.fonts.ready; } catch (e) { console.warn("字体等待失败，继续导出。", e); }

                    this.showLoading('正在准备导出...');
                    const sourceElement = this.elements.previewWrapper;

                    // 1. 计算目标尺寸和缩放比例
                    const panel = this.elements.inspectorPanel;
                    const s = this.state.exportSettings;
                    const isMobileExport = panel.querySelector('#mobile-export-toggle').checked;
                    const isCustomWidth = panel.querySelector('#custom-width-toggle').checked;
                    const isHD = panel.querySelector('#hd-export-toggle').checked;

                    const rect = sourceElement.getBoundingClientRect();
                    const osWidth = sourceElement.offsetWidth;
                    const osHeight = sourceElement.offsetHeight;
                    const osRatio = osHeight > 0 && osWidth > 0 ? osHeight / osWidth : 1.5;

                    let targetWidth = 1200;
                    if (isMobileExport) targetWidth = 1200;
                    else if (isHD) targetWidth = 1800;
                    else if (isCustomWidth) targetWidth = s.customWidth;

                    let targetHeight = Math.round(targetWidth * osRatio);
                    if (isCustomWidth && !s.lockAspectRatio) targetHeight = s.customHeight;

                    const scaleFactor = targetWidth / osWidth;

                    let clone = null;

                    try {
                        // 新增：在开始导出过程时，为body添加一个类来隐藏辅助元素
                        document.body.classList.add('export-mode');

                        // 2. 创建克隆体
                        clone = sourceElement.cloneNode(true);
                        clone.id = "export-clone-container";

                        // --- 关键修复：移除所有铅笔图标 ---
                        clone.querySelectorAll('.mobile-edit-pencil').forEach(el => el.remove());

                        // --- 布局修复样式 ---
                        clone.style.position = 'absolute';
                        clone.style.left = '-9999px';
                        clone.style.top = '0px';
                        clone.style.margin = '0';
                        clone.style.transform = 'none';
                        clone.style.boxShadow = 'none';
                        clone.style.width = `${osWidth}px`;
                        clone.style.height = `${osHeight}px`;
                        clone.style.boxSizing = 'border-box';

                        document.body.appendChild(clone);

                        const styleReset = document.createElement('style');
                        styleReset.innerHTML = `
            #export-clone-container, #export-clone-container * { 
                transition: none !important; 
                animation: none !important; 
                view-transition-name: none !important;
            }
            #export-clone-container {
                width: ${osWidth}px !important;
                margin: 0 !important;
                transform: none !important;
            }
        `;
                        clone.appendChild(styleReset);

                        // 3. 内联图片数据
                        this.showLoading('正在内联图片数据...');
                        const imagePromises = [];

                        const inlineImageSrc = async (url) => {
                            if (url && url.startsWith('idb://')) {
                                try {
                                    const imageId = url.substring(6);
                                    const record = await this.getImageFromDB(imageId);
                                    if (record && record.blob) {
                                        return await this.blobToDataURL(record.blob);
                                    }
                                } catch (e) { console.error(`无法内联图片 ${url}:`, e); }
                            }
                            return url;
                        };

                        clone.querySelectorAll('img').forEach(img => {
                            const originalImg = Array.from(sourceElement.querySelectorAll('img')).find(orig => orig.src === img.src) || img;
                            const itemEl = originalImg.closest('.preview-item-wrapper, .preview-header');

                            let dataUrlKey;
                            if (itemEl && itemEl.id === 'preview-header') {
                                dataUrlKey = this.state.personalInfo.avatarDataUrl;
                            } else if (itemEl) {
                                const itemId = itemEl.dataset.itemId;
                                const item = this.findItem(itemId);
                                if (item) dataUrlKey = item.url || item.coverArt;
                            }

                            if (dataUrlKey && dataUrlKey.startsWith('idb://')) {
                                const promise = inlineImageSrc(dataUrlKey).then(dataUrl => {
                                    if (dataUrl) img.src = dataUrl;
                                });
                                imagePromises.push(promise);
                            }
                        });

                        const elementsWithBg = [
                            { el: clone, url: this.state.pageStyles.pageBgImageDataUrl },
                            { el: clone.querySelector('.preview-header'), url: null },
                        ];
                        clone.querySelectorAll('.preview-card-inner').forEach(cardInner => {
                            const itemId = cardInner.closest('.preview-item-wrapper').dataset.itemId;
                            const item = this.findItem(itemId);
                            if (item && item.bgImageDataUrl) {
                                elementsWithBg.push({ el: cardInner, url: item.bgImageDataUrl });
                            }
                        });

                        elementsWithBg.forEach(({ el, url }) => {
                            if (el && url && url.startsWith('idb://')) {
                                const promise = inlineImageSrc(url).then(dataUrl => {
                                    if (dataUrl) {
                                        const currentBg = window.getComputedStyle(el).backgroundImage;
                                        const newBg = `url("${dataUrl}")`;
                                        el.style.backgroundImage = currentBg.replace(/url\(.+\)/, newBg);
                                    }
                                });
                                imagePromises.push(promise);
                            }
                        });

                        await Promise.all(imagePromises);

                        // 4. 处理水印
                        if (panel.querySelector('#export-attribution-toggle').checked) {
                            const attr = this.state.pageStyles.pageBgImageAttribution;
                            let attrHTML = attr && attr.user ? `Photo by ${this.escapeHTML(attr.user)} / ` : '';
                            attrHTML += `Made with Blokko`;
                            const attrDiv = document.createElement('div');
                            attrDiv.style.cssText = `position: absolute; bottom: 10px; right: 15px; font-size: 10px; font-family: sans-serif; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 4px; z-index: 100; pointer-events: none;`;
                            attrDiv.textContent = attrHTML;
                            clone.appendChild(attrDiv);
                        }

                        this.showLoading('正在高保真渲染...');

                        // 5. 高清生成配置
                        const options = {
                            width: targetWidth,
                            height: targetHeight,
                            style: {
                                transform: `scale(${scaleFactor})`,
                                transformOrigin: 'top left',
                                width: `${osWidth}px`,
                                height: `${osHeight}px`,
                                margin: '0'
                            },
                            quality: 1.0,
                            cacheBust: true,
                        };

                        // 6. 生成截图
                        const dataUrl = await domtoimage.toPng(clone, options);

                        let finalDataUrl = dataUrl;
                        const exportRounded = panel.querySelector('#export-rounded-corners-toggle').checked;
                        const cornerRadius = parseInt(panel.querySelector('#export-corner-radius-input').value, 10) || 20;

                        // 7. 如果需要圆角
                        if (exportRounded && cornerRadius > 0) {
                            this.showLoading('应用圆角...');
                            const finalCanvas = document.createElement('canvas');
                            finalCanvas.width = targetWidth;
                            finalCanvas.height = targetHeight;
                            const ctx = finalCanvas.getContext('2d');
                            const img = new Image();

                            await new Promise(resolve => { img.onload = resolve; img.src = dataUrl; });

                            const r = cornerRadius * scaleFactor;

                            ctx.beginPath();
                            ctx.moveTo(r, 0);
                            ctx.lineTo(targetWidth - r, 0); ctx.arcTo(targetWidth, 0, targetWidth, r, r);
                            ctx.lineTo(targetWidth, targetHeight - r); ctx.arcTo(targetWidth, targetHeight, targetWidth - r, targetHeight, r);
                            ctx.lineTo(r, targetHeight); ctx.arcTo(0, targetHeight, 0, targetHeight - r, r);
                            ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
                            ctx.closePath();
                            ctx.clip();

                            ctx.drawImage(img, 0, 0);
                            finalDataUrl = finalCanvas.toDataURL('image/png');
                        }

                        // 8. 显示下载
                        const filename = this.generateFilename('Image') + '.png';
                        this.hideLoading();
                        this.showDownloadModal(finalDataUrl, filename, '图片已生成');

                    } catch (err) {
                        console.error("Export PNG failed:", err);
                        this.hideLoading();
                        this.showErrorModal('导出失败', `生成图片时发生错误：${err.message}.`);
                    } finally {
                        if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                        document.body.classList.remove('export-mode');
                    }
                }, updateAttributionLink() {
                    const wrapper = this.elements.inspectorPanel.querySelector('#attribution-link-wrapper');
                    if (!wrapper) return;

                    const attr = this.state.pageStyles.pageBgImageAttribution;
                    if (attr && attr.user) {
                        wrapper.innerHTML = `<a href="${attr.pageURL}" target="_blank" style="margin-left: 5px; font-weight: normal;">(查看作者: ${this.escapeHTML(attr.user)})</a>`;
                    } else {
                        wrapper.innerHTML = '';
                    }
                },

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
                // --- 新功能：预览区右键菜单 ---
                bindPreviewContextMenu() {
                    const menu = document.getElementById('preview-context-menu');
                    this.elements.previewPanel.addEventListener('contextmenu', (e) => {
                        // 移动端不触发
                        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

                        const itemEl = e.target.closest('.preview-item-wrapper');

                        if (itemEl) {
                            e.preventDefault();
                        } else {
                            menu.style.display = 'none';
                            return;
                        }

                        const itemId = itemEl.dataset.itemId;
                        const item = this.findItem(itemId);
                        if (!item) return;

                        const isHidden = item.isVisible === false;

                        let menuHTML = `<ul style="list-style:none; margin:0; padding:0;">`;

                        if (item.type === 'card') {
                            const isVertical = item.writingMode === 'vertical-rl';
                            menuHTML += `<li data-action="toggle-vertical" style="border-bottom:1px solid var(--border-color)">${isVertical ? '<span class="iconify" data-icon="mdi:format-text-variant"></span> 横排文字' : '<span class="iconify" data-icon="mdi:format-text-direction-vertical"></span> 竖排文字（实验性功能）'}</li>`;
                        }

                        menuHTML += `<li data-action="copy-item"><span class="iconify" data-icon="mdi:content-copy"></span> 复制模块</li>`;
                        menuHTML += `<li data-action="toggle-item">${isHidden ? '<span class="iconify" data-icon="mdi:eye"></span> 显示模块' : '<span class="iconify" data-icon="mdi:eye-off"></span> 隐藏模块'}</li>`;
                        menuHTML += `<li data-action="delete-item" style="color:var(--color-danger); border-top:1px solid var(--border-color)"><span class="iconify" data-icon="mdi:trash-can-outline"></span> 删除模块</li>`;
                        menuHTML += `</ul>`;

                        menu.innerHTML = menuHTML;
                        menu.style.display = 'block';

                        // 定位逻辑
                        const rect = menu.getBoundingClientRect();
                        let x = e.clientX;
                        let y = e.clientY;
                        if (x + rect.width > window.innerWidth) x -= rect.width;
                        if (y + rect.height > window.innerHeight) y -= rect.height;
                        menu.style.left = x + 'px';
                        menu.style.top = y + 'px';

                        // 绑定点击
                        menu.onclick = (ev) => {
                            const li = ev.target.closest('li');
                            if (!li) return;
                            const action = li.dataset.action;

                            if (action === 'toggle-item') this.toggleItemVisibility(itemId);
                            if (action === 'copy-item') this.duplicateItem(itemId);
                            if (action === 'delete-item') this.deleteItem(itemId);
                            if (action === 'toggle-vertical') {
                                const newMode = item.writingMode === 'vertical-rl' ? 'horizontal-tb' : 'vertical-rl';
                                this.updateItem(itemId, 'writingMode', newMode, true, '切换文字排列方向');
                                this.renderPreviewItemById(itemId);
                            }
                            menu.style.display = 'none';
                        };
                    });
                },

                // --- 新功能：历史记录快捷回滚 (PC右键/手机长按) ---
                bindHistoryContextEvents() {
                    const list = this.elements.inspectorPanel.querySelector('#history-list');
                    if (!list) return;

                    const handleAction = async (index) => {
                        const confirmed = await this.showConfirm(
                            '确认回滚',
                            `确定要回滚到步骤 "${this.history[index].description}" 吗？\n注意：此步骤之后的所有操作记录将被丢弃。`
                        );
                        if (confirmed) {
                            this.jumpToHistory(index, '已回滚状态');
                        }
                    };

                    // PC 右键
                    list.oncontextmenu = (e) => {
                        const item = e.target.closest('.history-item');
                        if (item) {
                            e.preventDefault();
                            handleAction(parseInt(item.dataset.index));
                        }
                    };

                    // 手机长按
                    let pressTimer;
                    list.ontouchstart = (e) => {
                        const item = e.target.closest('.history-item');
                        if (item) {
                            pressTimer = setTimeout(() => {
                                handleAction(parseInt(item.dataset.index));
                            }, 800);
                        }
                    };
                    const clear = () => clearTimeout(pressTimer);
                    list.ontouchend = clear;
                    list.ontouchmove = clear;
                },


                // --- 重写：QR码样式分享与导入系统 (安全围栏版) ---
                initShareSystem() {
                    const modal = document.getElementById('share-style-modal');
                    const exportView = document.getElementById('qr-export-view');
                    const importView = document.getElementById('qr-import-view');
                    const container = document.getElementById('qrcode-container');
                    const fileInput = document.getElementById('qr-file-input');
                    const statusText = document.getElementById('qr-scan-status');

                    // 1. Tab 切换逻辑
                    modal.querySelectorAll('.tab-btn').forEach(btn => {
                        btn.onclick = async () => {
                            modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            const isExport = btn.dataset.qrTab === 'export';
                            exportView.style.display = isExport ? 'block' : 'none';
                            importView.style.display = isExport ? 'none' : 'block';
                            statusText.textContent = '';
                            if (isExport) {
                                container.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
                                await this.generateQRCode(container);
                            } else {
                                // 【性能优化】用户一点这个 Tab，我们就立刻静默预加载 ZXing 库
                                // 这样等用户找完文件时，库已经加载好了，无需等待。
                                this.loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js').catch(()=>{});
                            }
                        };
                    });

                    // 2. 绑定按钮
                    document.getElementById('upload-qr-btn').onclick = () => fileInput.click();
                    
                    // 新增：绑定保存精美图片按钮
                    const saveBtn = document.getElementById('save-aesthetic-qr-btn');
                    if(saveBtn) saveBtn.onclick = () => this.saveAestheticQRCode();

                    // 3. 绑定文件读取与解析 
                    fileInput.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        statusText.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:5px;"></div>正在深度解析...';
                        statusText.style.color = 'var(--text-primary)';

                        try {
                            // 确保 ZXing 已加载 (如果Tab切换时没加载完，这里会等待)
                            await this.loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js');

                            const imageUrl = URL.createObjectURL(file);
                            const codeReader = new ZXing.BrowserQRCodeReader();

                            const result = await codeReader.decodeFromImageUrl(imageUrl);

                            URL.revokeObjectURL(imageUrl); // 释放内存

                            if (result && result.text) {
                                await this.applySharedStyle(result.text);
                            } else {
                                throw new Error("No QR found");
                            }
                        } catch (err) {
                            console.warn("ZXing Scan Error:", err);
                            let msg = '❌ 图片中未找到有效的 Blokko 样式二维码。';

                            // 额外的容错提示
                            if (file.size > 2 * 1024 * 1024) {
                                msg += ' (图片可能过大，请尝试裁剪二维码区域后上传)';
                            }

                            statusText.textContent = msg;
                            statusText.style.color = 'var(--color-danger)';
                        } finally {
                            fileInput.value = '';
                        }
                    };
                },

                async saveAestheticQRCode() {
                    const qrImg = document.querySelector('#qrcode-container img');
                    if (!qrImg) {
                        this.showToast('二维码尚未生成，请稍后', 'error');
                        return;
                    }

                    this.showLoading('正在设计卡片...');
                    
                    // 1. 获取当前主题色，让卡片风格与你的设计保持一致
                    const theme = this.state.globalTheme;
                    const primaryColor = theme.primary || '#007AFF';
                    const accentColor = theme.accent || '#007AFF';
                    
                    // 2. 创建高清画布 (1080x1440，竖版更适合手机阅读)
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const w = 1080;
                    const h = 1440;
                    canvas.width = w;
                    canvas.height = h;

                    // 辅助函数：绘制圆角矩形
                    const roundRect = (x, y, w, h, r) => {
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.arcTo(x + w, y, x + w, y + h, r);
                        ctx.arcTo(x + w, y + h, x, y + h, r);
                        ctx.arcTo(x, y + h, x, y, r);
                        ctx.arcTo(x, y, x + w, y, r);
                        ctx.closePath();
                    };

                    // 3. 绘制背景 (使用主色调生成的优雅渐变)
                    const bgGradient = ctx.createLinearGradient(0, 0, w, h);
                    bgGradient.addColorStop(0, '#ffffff');
                    bgGradient.addColorStop(1, '#f2f2f7');
                    ctx.fillStyle = bgGradient;
                    ctx.fillRect(0, 0, w, h);

                    // 3.1 绘制顶部的装饰色块 (增加氛围感)
                    const decorGradient = ctx.createLinearGradient(0, 0, w, h/2);
                    decorGradient.addColorStop(0, primaryColor);
                    decorGradient.addColorStop(1, accentColor);
                    
                    ctx.save();
                    ctx.globalAlpha = 0.15; // 淡淡的色彩
                    ctx.beginPath();
                    ctx.arc(w/2, -200, 900, 0, Math.PI * 2);
                    ctx.fillStyle = decorGradient;
                    ctx.fill();
                    ctx.restore();

                    // 4. 绘制中心卡片 (类似 iOS 通知卡片风格)
                    const cardW = 880;
                    const cardH = 1000;
                    const cardX = (w - cardW) / 2;
                    const cardY = (h - cardH) / 2 - 50;

                    // 卡片阴影
                    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
                    ctx.shadowBlur = 60;
                    ctx.shadowOffsetY = 30;

                    // 卡片本体
                    ctx.fillStyle = '#ffffff';
                    roundRect(cardX, cardY, cardW, cardH, 60);
                    ctx.fill();
                    
                    // 重置阴影
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    // 5. 绘制卡片内的文字
                    ctx.textAlign = 'center';
                    
                    // 标题
                    ctx.fillStyle = '#1a1a1a';
                    ctx.font = 'bold 70px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.fillText('Blokko 样式分享', w / 2, cardY + 140);

                    // 副标题 (强调色)
                    ctx.fillStyle = primaryColor;
                    ctx.font = '600 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.fillText('By ' + (this.state.personalInfo.nickname || '设计师'), w / 2, cardY + 210);

                    // 6. 绘制二维码 (放在纯白背景上，确保识别率)
                    const qrBoxSize = 600;
                    const qrX = (w - qrBoxSize) / 2;
                    const qrY = cardY + 280;

                    // 绘制二维码图片
                    // 为了提高识别率，我们在二维码周围留出足够的白边
                    ctx.drawImage(qrImg, qrX, qrY, qrBoxSize, qrBoxSize);

                    // 7. 底部提示文字
                    ctx.fillStyle = '#888888';
                    ctx.font = '40px sans-serif';
                    ctx.fillText('扫描二维码 / 导入配色方案', w / 2, qrY + qrBoxSize + 80);

                    // 8. 底部 Logo 水印
                    ctx.fillStyle = '#cccccc';
                    ctx.font = '30px sans-serif';
                    ctx.fillText('Created with Blokko', w / 2, h - 60);

                    // 9. 导出
                    canvas.toBlob(blob => {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Blokko-Share-${Date.now()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        this.hideLoading();
                        this.showToast('分享卡片已生成！', 'success');
                    }, 'image/png');
                },


                async generateQRCode(container) {
                    try {
                        // 并行加载所需的库
                        await Promise.all([
                            this.loadScript('https://cdn.bootcdn.net/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'),
                            this.loadScript('https://cdn.bootcdn.net/ajax/libs/lz-string/1.5.0/lz-string.min.js')
                        ]);

                        const styleData = {
                            gt: this.state.globalTheme,
                            ps: this.deepClone(this.state.pageStyles),
                            gcs: this.state.globalComponentStyles,
                            gbr: this.state.globalBorderSettings
                        };
                        styleData.ps.pageBgImageDataUrl = null;
                        styleData.ps.pageBgImageAttribution = null;

                        const jsonString = JSON.stringify(styleData);
                        const compressed = LZString.compressToEncodedURIComponent(jsonString);
                        const payload = `BLOKKO_STYLE_V2:${compressed}`;

                        container.innerHTML = '';
                        new QRCode(container, {
                            text: payload,
                            width: 400,
                            height: 400,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.M,
                            margin: 2
                        });
                    } catch (e) {
                        console.error("QR Generation failed:", e);
                        container.innerHTML = '<p style="color:red">组件加载失败，请检查网络。</p>';
                    }
                },

                // 应用分享的样式 (含安全校验)
                async applySharedStyle(rawData) {
                    const statusText = document.getElementById('qr-scan-status');

                    // 1. 安全围栏第一道：检查 Magic Header
                    if (!rawData.startsWith('BLOKKO_STYLE_V2:')) {
                        statusText.textContent = '⚠️ 这是一个未知的或过时的二维码，为了安全已被拦截。';
                        statusText.style.color = 'var(--color-danger)';
                        return;
                    }

                    try {
                        // 异步加载解析和净化组件
                        await Promise.all([
                            this.loadScript('https://cdn.bootcdn.net/ajax/libs/lz-string/1.5.0/lz-string.min.js'),
                            this.loadScript('https://cdn.bootcdn.net/ajax/libs/dompurify/3.0.6/purify.min.js')
                        ]);

                        // 2. 解压数据
                        const compressed = rawData.split('BLOKKO_STYLE_V2:')[1];
                        const jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
                        if (!jsonStr) throw new Error("数据损坏");

                        const styleData = JSON.parse(jsonStr);

                        // 3. XSS 清洗
                        const sanitizeObj = (obj) => {
                            for (let key in obj) {
                                if (typeof obj[key] === 'string') {
                                    obj[key] = DOMPurify.sanitize(obj[key]);
                                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                    sanitizeObj(obj[key]);
                                }
                            }
                        };
                        sanitizeObj(styleData);

                        statusText.textContent = '✅ 校验通过！请在弹窗中确认。';
                        statusText.style.color = 'green';

                        // 4. 最终确认
                        const confirmed = await this.showConfirm(
                            '导入样式',
                            '二维码解析成功！是否应用此样式模板？\n\n(注意：这将覆盖当前的【颜色、圆角、边框】设置。)'
                        );

                        if (confirmed) {
                            this.pushHistory('应用分享样式');
                            if (styleData.gt) this.state.globalTheme = styleData.gt;
                            if (styleData.ps) this.state.pageStyles = styleData.ps;
                            if (styleData.gcs) this.state.globalComponentStyles = styleData.gcs;
                            if (styleData.gbr) this.state.globalBorderSettings = styleData.gbr;

                            this.debouncedSaveToLocal();
                            this.renderAll();
                            this.syncAllControls();
                            this.showToast('样式模板已应用！', 'success');
                            document.getElementById('share-style-modal').classList.remove('visible');
                        } else {
                            statusText.textContent = '已取消导入。';
                            statusText.style.color = 'var(--text-secondary)';
                        }

                    } catch (e) {
                        console.error(e);
                        statusText.textContent = '❌ 数据解析失败，文件可能已损坏。';
                        statusText.style.color = 'var(--color-danger)';
                    }
                },

                openShareModal() {
                    const modal = document.getElementById('share-style-modal');
                    modal.classList.add('visible');

                    const exportBtn = modal.querySelector('.tab-btn[data-qr-tab="export"]');
                    if (!exportBtn.onclick) {
                        this.initShareSystem();
                    }

                    if (exportBtn) exportBtn.click();
                },

                updateGlobalComponentStyleVars() {
                    const g = this.state.globalComponentStyles;
                    const r = document.documentElement.style;

                    r.setProperty('--g-comp-bg-color', g.bgColor);
                    r.setProperty('--g-comp-text-color', g.textColor);
                    r.setProperty('--g-comp-opacity', g.opacity);
                    r.setProperty('--g-comp-border-radius', `${g.radius}px`);
                    r.setProperty('--g-comp-text-align', g.textAlign);
                    r.setProperty('--g-comp-line-height', g.lineHeight);
                    r.setProperty('--active-card-font-family', g.fontFamily ? `'${g.fontFamily}', sans-serif` : '');
                    r.setProperty('--g-comp-title-font-size', g.titleFontSize);
                    r.setProperty('--g-comp-content-font-size', g.contentFontSize);
                    r.setProperty('--g-comp-text-stroke', g.textStrokeWidth > 0 ? `${g.textStrokeWidth}px ${g.textStrokeColor}` : '0px transparent');
                    r.setProperty('--g-comp-padding', `${g.padding}px`);

                    
                    // 如果不透明度为0，直接设为 none 以提升性能
                    if (parseFloat(g.shadowOpacity) > 0) {
                        const shadowColorRgba = this.hexToRgba(g.shadowColor, g.shadowOpacity);
                        const shadowVal = `${g.shadowOffsetX}px ${g.shadowOffsetY}px ${g.shadowBlur}px ${shadowColorRgba}`;
                        r.setProperty('--active-card-shadow', shadowVal);
                    } else {
                        r.setProperty('--active-card-shadow', 'none');
                    }

                    // 更新按钮的默认值，如果未被覆盖
                    r.setProperty('--g-button-bg-color', g.buttonBgColor || g.bgColor);
                    r.setProperty('--g-button-text-color', g.buttonTextColor || g.textColor);
                },

                updateGlobalBorderVars() {
                    const b = this.state.globalBorderSettings;
                    const r = document.documentElement.style;

                    // 边框变量
                    r.setProperty('--g-border-width', `${b.width}px`);
                    r.setProperty('--g-border-style', b.style === 'none' ? 'none' : b.style);
                    r.setProperty('--g-border-color', b.color);
                    r.setProperty('--g-border-shadow-offset', `${b.shadowOffset}px`);
                    r.setProperty('--g-border-shadow-color', b.shadowColor);

                    
                    const s = b.globalShadowSettings;
                    if (s && parseFloat(s.opacity) > 0) {
                        const rgba = this.hexToRgba(s.color, s.opacity);
                        r.setProperty('--g-shadow-value', `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${rgba}`);
                    } else {
                        r.setProperty('--g-shadow-value', 'none');
                    }
                },

                initAllSortables() {
                    this.initLayerSortables();
                    this.initSortablePreviewItems();
                    this.initSortablePreviewTags();
                    this.applyLayout();

                },


                applyLayout() {
                    const s = this.state.systemSettings;
                    const container = this.elements.previewItemsContainer;
                    const r = document.documentElement.style;

                    r.setProperty('--preview-gap', `${s.previewGap || 20}px`);

                    // 重新渲染DOM结构，这是应用新布局前必须的步骤
                    this.renderPreviewItems();

                    // 根据是否启用紧凑模式，切换class并调用相应的布局函数
                    if (s.masonryEnabled) {
                        container.classList.add('compact-mode');
                        // 使用 requestAnimationFrame 确保在浏览器下一次绘制前执行，比setTimeout更精确
                        requestAnimationFrame(() => {
                            this.applyGridCompactLayout();
                        });
                    } else {
                        container.classList.remove('compact-mode');
                        // 清理所有可能残留的Grid样式
                        container.querySelectorAll('.preview-item-wrapper').forEach(itemEl => {
                            itemEl.style.gridRowEnd = '';
                            itemEl.style.gridColumnEnd = '';
                        });
                    }
                },

                applyGridCompactLayout() {
                    const container = this.elements.previewItemsContainer;
                    if (!container || !this.state.systemSettings.masonryEnabled) {
                        return; // 如果模式未开启，则直接退出
                    }

                    const gridRowHeight = 10; // 必须与 CSS 中的 grid-auto-rows 一致
                    const gap = parseInt(this.state.systemSettings.previewGap || 20);

                    const items = container.querySelectorAll('.preview-item-wrapper:not(.is-hidden)');

                    items.forEach(itemEl => {
                        const itemId = itemEl.dataset.itemId;
                        const itemData = this.findItem(itemId);
                        if (!itemData) return;

                        // --- 核心修正 ---
                        // 1. 立即设置列宽（grid-column），不再等待图片加载
                        const width = parseInt(itemData.layout.width, 10);
                        let colSpan = 6; // 默认100% (6/6)
                        if (width === 67) colSpan = 4;
                        else if (width === 50) colSpan = 3;
                        else if (width === 33) colSpan = 2;
                        itemEl.style.gridColumnEnd = `span ${colSpan}`;

                        // 2. 计算并设置行高（grid-row）
                        // 为了确保高度计算准确，我们仍然可以等待图片加载，但这不再阻塞宽度的设置
                        const images = Array.from(itemEl.querySelectorAll('img'));
                        const imagePromises = images.map(img => {
                            if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
                            return new Promise(resolve => { img.onload = img.onerror = resolve; });
                        });

                        const calculateAndSetHeight = () => {
                            // 使用 getBoundingClientRect 获取渲染后的精确高度
                            const contentHeight = itemEl.getBoundingClientRect().height;
                            // 计算需要跨越的行数
                            const rowSpan = Math.ceil((contentHeight + gap) / (gridRowHeight + gap));
                            itemEl.style.gridRowEnd = `span ${rowSpan}`;
                        };

                        // 无论图片是否加载完成，都先进行一次初步的高度计算
                        calculateAndSetHeight();

                        // 当所有图片加载完成后，再进行一次精确的高度计算，以防布局跳动
                        Promise.all(imagePromises).then(() => {
                            // 延迟一帧，确保浏览器完成图片渲染
                            requestAnimationFrame(calculateAndSetHeight);
                        });
                    });
                },

                initLayerSortables() {
                    if (this.sortableLayers) this.sortableLayers.destroy();
                    this.sortableLayers = new Sortable(this.elements.layerList, {
                        group: 'layers',
                        animation: 150,
                        handle: '.layer-item',
                        ghostClass: 'sortable-ghost',
                        filter: 'hr, .layer-item[data-type="personalInfo"], .layer-actions',
                        onEnd: e => {
                            this.vibrate(30);
                            const oldIndex = e.oldIndex - 2;
                            const newIndex = e.newIndex - 2;
                            if (oldIndex === newIndex) return;
                            this.pushHistory('排序模块');
                            const [moved] = this.state.items.splice(oldIndex, 1);
                            this.state.items.splice(newIndex, 0, moved);
                            this.debouncedSaveToLocal();
                            this.renderLayerPanel();
                            this.renderPreviewItems();
                        }
                    });
                },

                initSortablePreviewItems() {
                    if (this.sortablePreview) this.sortablePreview.destroy();
                    this.sortablePreview = new Sortable(this.elements.previewItemsContainer, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        // 关键修复：防止 Masonry 的绝对定位干扰拖拽占位符的生成
                        onStart: () => {
                            if (this.state.systemSettings.masonryEnabled) {
                                // 拖拽开始时，暂时保留 Masonry 布局，但允许 Sortable 运作
                                this.elements.previewItemsContainer.classList.add('is-dragging');
                            }
                        },
                        onEnd: e => {
                            this.vibrate(30);
                            if (e.oldIndex === e.newIndex) return;

                            this.pushHistory('排序模块');
                            const [movedItem] = this.state.items.splice(e.oldIndex, 1);
                            this.state.items.splice(e.newIndex, 0, movedItem);
                            this.debouncedSaveToLocal();

                            // 拖拽结束后，DOM顺序已经改变，只需重新应用布局
                            this.renderLayerPanel(); // 更新左侧列表顺序
                            this.applyLayout(); // 重新计算并应用布局
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

                initSortableTimelineEvents(itemId) {
                    const container = this.elements.inspectorPanel.querySelector(`.editor-item[data-item-id="${itemId}"] .timeline-editors-list`);
                    if (container) {
                        const sortableKey = `timeline_${itemId}`;
                        if (this.cardSortables[sortableKey]) this.cardSortables[sortableKey].destroy();
                        this.cardSortables[sortableKey] = new Sortable(container, {
                            handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost',
                            onEnd: e => {
                                const item = this.findItem(itemId);
                                if (item) {
                                    this.pushHistory('排序时间轴事件');
                                    const [moved] = item.cards.splice(e.oldIndex, 1);
                                    item.cards.splice(e.newIndex, 0, moved);
                                    this.debouncedSaveToLocal();
                                    this.renderPreviewItemById(itemId);
                                }
                            }
                        });
                    }
                },

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
                    const isLocked = this.elements.previewItemsContainer.classList.toggle('locked-mode');
                    const button = this.elements.lockModeToggle;

                    button.textContent = isLocked ? '预览中' : '编辑中';
                    button.title = isLocked ? '预览模式 (点击切换为编辑模式)' : '编辑模式 (点击切换为预览模式)';
                    this.renderMobileEditPencils();

                    const shouldDisable = isLocked;

                    if (this.sortableLayers) this.sortableLayers.option('disabled', shouldDisable);
                    if (this.sortablePreview) this.sortablePreview.option('disabled', shouldDisable);
                    if (this.sortableTags) this.sortableTags.option('disabled', shouldDisable);
                    if (this.sortablePreviewTags) this.sortablePreviewTags.option('disabled', shouldDisable);
                },

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
                showIconPicker(type, id) {
                    this.currentIconTarget = { type, id };
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
                        const { type, id } = this.currentIconTarget;
                        if (type === 'item') {
                            this.updateItem(id, 'icon', iconClass, true, '更改图标');
                        } else if (type === 'tag') {
                            this.updateTag(id, 'icon', iconClass, true, '更改标签图标');
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

                setSelection(newSelection) {
                    this.selection = newSelection;

                    if (newSelection.type !== 'global') {
                        this.updateState('ui.activeInspectorTab', 'selected', false);
                    }

                    this.updateHighlights();
                    this.renderInspector();
                },
                updateHighlights() {
                    document.querySelectorAll('.layer-item.selected, .preview-item-wrapper.selected, .preview-header.selected').forEach(el => el.classList.remove('selected'));

                    const { type, id } = this.selection;

                    if (type === 'personalInfo') {
                        document.querySelector('.layer-item[data-type="personalInfo"]')?.classList.add('selected');
                        this.elements.previewHeader.classList.add('selected');
                    } else if (type === 'item' && id) {
                        document.querySelector(`.layer-item[data-id="${id}"]`)?.classList.add('selected');
                        document.querySelector(`.preview-item-wrapper[data-item-id="${id}"]`)?.classList.add('selected');
                    }
                },

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

                async applyRandomPalette() {
                    try {
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/chroma-js/2.4.2/chroma.min.js');
                    } catch (e) {
                        this.showErrorModal('加载失败', '颜色库 chroma.js 加载失败，请检查网络。');
                        return;
                    }

                    this.pushHistory('应用随机配色');

                    const baseColor = chroma.random();
                    const palette = chroma.scale([baseColor, baseColor.set('hsl.h', '+150')]).mode('lch').colors(5);

                    this.updateState('pageStyles.pageBgSolidColor', chroma.mix(palette[0], 'white', 0.9).hex(), false);
                    this.updateState('pageStyles.headerBgColor', '#ffffff', false);
                    this.updateState('pageStyles.headerTextColor', palette[4], false);

                    this.updateState('globalComponentStyles.bgColor', palette[2], false);
                    this.updateState('globalComponentStyles.textColor', '#ffffff', false);

                    this.renderAll();
                    this.syncAllControls();
                    this.showToast('随机配色已应用！', 'success');
                },

                async applySmartPalette(baseHex) {
                    try {
                        await this.loadScript('https://cdn.bootcdn.net/ajax/libs/chroma-js/2.4.2/chroma.min.js');
                    } catch (e) {
                        this.showErrorModal('加载失败', '颜色库 chroma.js 加载失败，请检查网络。');
                        return;
                    }

                    this.pushHistory(`应用配色: ${baseHex}`);

                    const base = chroma(baseHex);

                    
                    const pageBg = base.set('hsl.s', 0.25).set('hsl.l', 0.91).hex();

                   
                    const cardBg = chroma.mix(base, 'white', 0.96).hex();
                    const headerBg = cardBg; // 头部和卡片保持一致

                    
                    const headerGradientEnd = chroma(headerBg).darken(0.05).hex();

                   
                    const textBase = base.set('hsl.s', 0.4).set('hsl.l', 0.15).hex();

                    let accent = base.hex();
                    if (base.luminance() < 0.1) accent = base.brighten(1.5).hex();
                    if (base.luminance() > 0.6) accent = base.darken(1.2).hex();

                    const compColor = base.set('hsl.h', base.get('hsl.h') + 180);
                    const tagBg = compColor.set('hsl.s', 0.5).set('hsl.l', 0.9).hex(); 
                    const tagText = compColor.darken(2.5).hex();


                   
                    this.updateState('pageStyles.pageBgSolidColor', pageBg, false);
                    this.updateState('pageStyles.pageBgMode', 'solid', false);

               
                    this.updateState('pageStyles.headerBgColor', headerBg, false);
                    this.updateState('pageStyles.headerBgMode', 'solid', false);
                    this.updateState('pageStyles.headerTextColor', textBase, false);
                    this.updateState('pageStyles.headerBorderRadius', 16, false);

  
                    this.updateState('pageStyles.headerBgGradientStart', headerBg, false);
                    this.updateState('pageStyles.headerBgGradientEnd', headerGradientEnd, false);

                    this.updateState('globalComponentStyles.bgColor', cardBg, false);
                    this.updateState('globalComponentStyles.bgMode', 'solid', false); 
                    this.updateState('globalComponentStyles.textColor', textBase, false);
                    this.updateState('globalComponentStyles.titleColor', accent, false);
                    this.updateState('globalComponentStyles.radius', 16, false);

                    this.updateState('personalInfo.nicknameColor', accent, false);
                    this.updateState('personalInfo.subtitleColor', chroma(textBase).brighten(1.5).hex(), false);
                    this.updateState('personalInfo.bioColor', textBase, false);

                    this.updateState('personalInfo.tagBgColor', tagBg, false);
                    this.updateState('personalInfo.tagTextColor', tagText, false);

                    this.updateState('personalInfo.avatarBorderColor', accent, false);
                    this.updateState('personalInfo.avatarBorderSize', 3, false);

                    this.state.globalTheme.primary = accent;
                    this.state.globalTheme.accent = accent;
                    this.triggerRender('globalTheme.primary');
                    this.triggerRender('globalTheme.accent');

                    this.renderAll();
                    this.syncAllControls();
                    this.showToast('已应用配色方案', 'success');
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
                        'apply-gcomp-bg': 'globalComponentStyles.bgColor',
                        'apply-gcomp-bg-gradient-start': 'globalComponentStyles.bgGradientStart',
                        'apply-gcomp-bg-gradient-end': 'globalComponentStyles.bgGradientEnd',
                        'apply-gcomp-text': 'globalComponentStyles.textColor',
                        'apply-gcomp-title-text': 'globalComponentStyles.titleColor',
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
                            } else if (action.startsWith('apply-gcomp-bg')) {
                                this.updateState('globalComponentStyles.bgMode', 'gradient', false);
                                this.switchTab('#global-component-styles-section', 'comp-bg-gradient');
                            }
                        } else if (action.includes('solid')) {
                            if (action.startsWith('apply-page-bg')) {
                                this.updateState('pageStyles.pageBgMode', 'solid', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:first-child', 'page-bg-solid');
                            } else if (action.startsWith('apply-header-bg')) {
                                this.updateState('pageStyles.headerBgMode', 'solid', false);
                                this.switchTab('#page-styles-section .tab-group-wrapper:last-child', 'header-bg-solid');
                            } else if (action.startsWith('apply-gcomp-bg')) {
                                this.updateState('globalComponentStyles.bgMode', 'solid', false);
                                this.switchTab('#global-component-styles-section', 'comp-bg-solid');
                            }
                        }
                    }
                },

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

                parseTimeToSeconds(timeStr) {
                    if (!timeStr) return 0;
                    const parts = timeStr.toString().split(':');
                    if (parts.length === 2) {
                        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    }
                    return parseFloat(timeStr) || 0;
                },

                debounce(func, wait) {
                    let timeout;
                    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
                },
                generateId(p) { return `${p}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
                vibrate(pattern = 50) {
                    if ('vibrate' in navigator) {
                        try {
                            navigator.vibrate(pattern);
                        } catch (e) {
                            console.warn("Vibration failed", e);
                        }
                    }
                },
                postRenderAsyncUpdates(container) {
                    const imageLoadPromises = [];
                    container.querySelectorAll('figure img, .music-cover').forEach(img => {
                        const itemEl = img.closest('.preview-item-wrapper');
                        if (!itemEl) return;

                        const itemId = itemEl.dataset.itemId;
                        const item = this.findItem(itemId);
                        if (!item) return;

                        let urlKey = (item.type === 'music') ? 'coverArt' : 'url';

                        if (item && item[urlKey]) {
                            const promise = new Promise(async (resolve) => {
                                img.addEventListener('load', resolve, { once: true });
                                img.addEventListener('error', resolve, { once: true });

                                let srcToSet = item[urlKey];
                                if (srcToSet.startsWith('idb://')) {
                                    try {
                                        const record = await this.getImageFromDB(srcToSet.substring(6));
                                        srcToSet = (record && record.blob) ? URL.createObjectURL(record.blob) : '';
                                    } catch {
                                        srcToSet = '';
                                    }
                                }

                                if (img.src === srcToSet && img.complete) return resolve();
                                if (!srcToSet) return resolve();
                                img.src = srcToSet;
                            });
                            imageLoadPromises.push(promise);
                        }
                    });

                    container.querySelectorAll('.preview-card').forEach(cardEl => {
                        const itemId = cardEl.closest('.preview-item-wrapper').dataset.itemId;
                        const itemData = this.findItem(itemId);
                        if (itemData) {
                            this.applyCardStyles(cardEl, itemData);
                        }
                    });
                },
                deepClone(obj) { return JSON.parse(JSON.stringify(obj)) },
                escapeHTML(str) { return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) },
                sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) },

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

                addItem(type, sourceItem = null, newItemData = null) {
                    this.pushHistory(sourceItem ? '复制模块' : '添加新模块');
                    let newItem;

                    if (newItemData) {
                        newItem = newItemData;
                    }
                    else if (sourceItem) {
                        newItem = this.deepClone(sourceItem);
                        newItem.id = this.generateId(sourceItem.type.charAt(0));
                        newItem.title = `${sourceItem.title || '模块'} (副本)`;
                        if (newItem.content) newItem.content = "";
                        if (newItem.text) newItem.text = "";
                        if (newItem.description) newItem.description = "";
                    } else {
                        const defaultItem = this.getDefaultState().items.find(i => i.type === type);
                        if (defaultItem) {
                            newItem = this.deepClone(defaultItem);
                            newItem.id = this.generateId(type.charAt(0));
                        } else {
                            return; // Should not happen
                        }
                    }

                    const insertIndex = sourceItem ? this.findItemIndex(sourceItem.id) + 1 : this.state.items.length;
                    this.state.items.splice(insertIndex, 0, newItem);

                    this.debouncedSaveToLocal();
                    this.renderLayerPanel();
                    this.applyLayout();

                    setTimeout(() => {
                        this.setSelection({ type: 'item', id: newItem.id });
                    }, 10);

                    if (sourceItem) this.showToast('模块已复制', 'success');
                },
                async deleteItem(itemId) {
                    const item = this.findItem(itemId);
                    if (!item) return;

                    const title = item.title || item.text || item.label || '该模块';

                    if (await this.showConfirm('删除模块', `确定要删除 "${title}" 吗？`)) {
                        this.pushHistory(`删除模块 "${title}"`);

                        await this.deleteImageByUrl(item.url);
                        await this.deleteImageByUrl(item.bgImageDataUrl);
                        await this.deleteImageByUrl(item.coverArt);

                        this.state.items = this.state.items.filter(i => i.id !== itemId);
                        this.debouncedSaveToLocal();

                        if (this.selection.type === 'item' && this.selection.id === itemId) {
                            this.setSelection({ type: 'global' });
                        }

                        this.renderLayerPanel();
                        this.renderPreviewItems();
                        this.showToast('模块已删除', 'info');
                    }
                },

                addTimelineEvent(itemId) {
                    const item = this.findItem(itemId);
                    if (!item || item.type !== 'timeline') return;
                    this.pushHistory('添加时间轴事件');
                    if (!item.cards) item.cards = [];
                    const newEvent = { id: this.generateId('tlc'), time: '新时间点', content: '新事件内容' };
                    item.cards.push(newEvent);
                    this.debouncedSaveToLocal();
                    this.renderInspectorContent();
                    this.renderPreviewItemById(itemId);
                },

                async deleteTimelineCard(itemId, cardId) {
                    const item = this.findItem(itemId);
                    if (!item) return;

                    if (await this.showConfirm('删除事件', '确定要删除这个时间点吗？')) {
                        this.pushHistory('删除时间轴事件');
                        item.cards = item.cards.filter(c => c.id !== cardId);
                        this.debouncedSaveToLocal();
                        this.renderInspectorContent();
                        this.renderPreviewItemById(itemId);
                        this.showToast('事件已删除', 'info');
                    }
                },

                updateTimelineCard(itemId, cardId, key, value, pushHistory, historyDescription) {
                    const itemIndex = this.findItemIndex(itemId);
                    if (itemIndex > -1) {
                        const cardIndex = this.state.items[itemIndex].cards.findIndex(c => c.id === cardId);
                        if (cardIndex > -1) this.updateState(`items.${itemIndex}.cards.${cardIndex}.${key}`, value, pushHistory, historyDescription);
                    }
                },

                toggleItemVisibility(itemId) {
                    const itemIndex = this.findItemIndex(itemId);
                    if (itemIndex > -1) {
                        const currentVisibility = this.state.items[itemIndex].isVisible;
                        this.updateState(`items.${itemIndex}.isVisible`, currentVisibility === false ? true : false, true, '切换模块可见性');
                    }
                },

                duplicateItem(itemId) {
                    const item = this.findItem(itemId);
                    if (item) {
                        this.addItem(item.type, item);
                    }
                },

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
                    randomState.globalComponentStyles.bgColor = randColor();
                    randomState.globalComponentStyles.textColor = randColor();

                    randomState.items = [];
                    const itemTypes = ['card', 'image', 'button', 'separator', 'spacer', 'music', 'progress', 'timeline'];
                    for (let i = 0; i < rand(5, 8); i++) {
                        const type = randChoice(itemTypes);
                        let newItem = this.deepClone(this.getDefaultState().items.find(it => it.type === type));
                        newItem.id = this.generateId(type.charAt(0));
                        newItem.title = `随机模块 ${i + 1}`;
                        if (newItem.cards) {
                            newItem.cards.forEach(c => c.id = this.generateId('c'));
                        }
                        randomState.items.push(newItem);
                    }
                    return randomState;
                },

                updateBorderRadiusControls() {
                    const borderStyle = this.state.globalBorderSettings.style;
                    const sharpEdgeStyles = ['pixel', 'neo-brutalism', 'double-offset'];
                    const shouldDisable = sharpEdgeStyles.includes(borderStyle);

                    
                    const radiusKeys = [
                        'globalComponentStyles.radius',
                        'pageStyles.headerBorderRadius'
                    ];

                    if (!this.stashedBorderRadiusMap) this.stashedBorderRadiusMap = {};

                    radiusKeys.forEach(key => {
                        const input = this.elements.inspectorPanel.querySelector(`[data-state-key="${key}"]`);
                        if (!input) return;

                        const formGroup = input.closest('.form-group');
                        if (!formGroup) return;

                        formGroup.style.opacity = shouldDisable ? '0.5' : '1';
                        formGroup.style.pointerEvents = shouldDisable ? 'none' : 'auto';

                        const existingTooltip = formGroup.querySelector('.disable-reason-tooltip');
                        if (existingTooltip) existingTooltip.remove();
                        if (shouldDisable) {
                            const tooltip = document.createElement('span');
                            tooltip.className = 'disable-reason-tooltip';
                            tooltip.textContent = ' (此风格不支持圆角)';
                            tooltip.style.fontSize = '0.8rem';
                            tooltip.style.color = 'var(--text-secondary)';
                            formGroup.querySelector('label').appendChild(tooltip);
                        }

                        if (shouldDisable) {
                            const currentVal = key.split('.').reduce((o, k) => o && o[k], this.state);
                            if (currentVal > 0) {
                                this.stashedBorderRadiusMap[key] = currentVal;
                                this.updateState(key, 0, false);
                                this.syncControl(key);
                            }
                        } else {
                            if (this.stashedBorderRadiusMap[key] !== undefined) {
                                this.updateState(key, this.stashedBorderRadiusMap[key], false);
                                this.syncControl(key);
                                delete this.stashedBorderRadiusMap[key];
                            }
                        }
                    });
                },
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
                    if (!mimeMatch) throw new Error('Invalid Data URL header');
                    const mime = mimeMatch[1];
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
                            if (this.state.globalComponentStyles.fontFamily === fontFamily) {
                                this.updateState('globalComponentStyles.fontFamily', '', false);
                            }
                            this.populateFontList();
                            this.showFontManager();
                            this.showToast(`字体 "${fontFamily}" 已删除。`, 'success');
                        } catch (e) {
                            this.showErrorModal('删除失败', '从数据库删除字体时出错。');
                        }
                    }
                },

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

                    const isLocked = this.elements.previewItemsContainer.classList.contains('locked-mode');
                    if (isLocked) return;

                    this.elements.previewWrapper.querySelectorAll('[data-state-key], [data-item-key], [data-separator-text-key], .tag-pill span[data-tag-id]').forEach(el => {
                        const pencil = document.createElement('div');
                        pencil.className = 'mobile-edit-pencil';
                        pencil.innerHTML = '<span class="iconify" data-icon="mdi:pencil"></span>';
                        el.appendChild(pencil);
                    });
                },
            };
            App.init();
        });
    