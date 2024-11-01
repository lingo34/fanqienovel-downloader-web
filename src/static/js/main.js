// Initialize Socket.IO
const socket = io();

// UI Elements
const content = document.getElementById('content');
const progressModal = new bootstrap.Modal(document.getElementById('progressModal'));
const progressBar = document.querySelector('.progress-bar');
const currentChapter = document.getElementById('currentChapter');
const logOutput = document.getElementById('logOutput');

// Socket.IO Event Handlers
socket.on('progress', (data) => {
    // Update progress bar width
    progressBar.style.width = `${data.percentage}%`;
    progressBar.setAttribute('aria-valuenow', data.percentage);
    
    // Update progress bar text
    progressBar.textContent = data.text || `${Math.round(data.percentage)}%`;
    
    // Update chapter info if available
    if (data.chapter) {
        currentChapter.textContent = `当前章节: ${data.chapter}`;
    }
    
    // If download is complete (100%)
    if (data.percentage === 100) {
        setTimeout(() => {
            logOutput.textContent += '下载完成！\n';
            // 移除对 downloadQueue 的引用
            fetchQueueStatus(); // 改为从服务器获取最新队列状态
        }, 1000);
    }
});

socket.on('log', (data) => {
    logOutput.textContent += data.message + '\n';
    logOutput.scrollTop = logOutput.scrollHeight;
});

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', async (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;
        const response = await fetch(`/templates/components/${page}.html`);
        content.innerHTML = await response.text();
        initializePage(page);
    });
});

// Page Initialization
function initializePage(page) {
    switch (page) {
        case 'search':
            initializeSearch();
            break;
        case 'library':
            loadLibrary();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Search Functionality
function initializeSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const directInput = document.getElementById('directInput');
    const directDownloadBtn = document.getElementById('directDownloadBtn');

    // Add direct download handler
    directDownloadBtn.addEventListener('click', async () => {
        const input = directInput.value.trim();
        if (!input) {
            alert('请输入小说ID或链接');
            return;
        }
        await downloadNovel(input);
    });

    // Add search handler
    searchBtn.addEventListener('click', async () => {
        const keyword = searchInput.value.trim();
        if (!keyword) {
            alert('请输入搜索关键词');
            return;
        }

        try {
            const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
            const results = await response.json();
            
            if (!results || results.length === 0) {
                searchResults.innerHTML = '<div class="col-12"><div class="alert alert-info">没有找到相关书籍</div></div>';
                return;
            }
            
            searchResults.innerHTML = results.map(book => `
                <div class="col-md-6 mb-3">
                    <div class="card search-result">
                        <div class="card-body">
                            <h5 class="card-title">${book.book_data[0].book_name}</h5>
                            <p class="card-text">作者: ${book.book_data[0].author}</p>
                            <p class="card-text">字数: ${book.book_data[0].word_number}</p>
                            <button class="btn btn-primary download-btn" 
                                    data-id="${book.book_data[0].book_id}">
                                下载
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            // Add download handlers
            document.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const novelId = e.target.dataset.id;
                    await downloadNovel(novelId);
                });
            });
        } catch (error) {
            searchResults.innerHTML = '<div class="col-12"><div class="alert alert-danger">搜索失败，请重试</div></div>';
        }
    });

    // Add keyboard event listeners
    directInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            directDownloadBtn.click();
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
}

// Library Functionality
async function loadLibrary() {
    const response = await fetch('/api/novels');
    const novels = await response.json();
    
    const novelList = document.getElementById('novelList');
    novelList.innerHTML = novels.map(novel => `
        <div class="col-md-4 mb-3">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">${novel.name}</h5>
                    ${novel.status ? `<p class="card-text text-muted">状态: ${novel.status}</p>` : ''}
                    <div class="btn-group mb-2">
                        ${novel.txt_path ? `
                            <a href="/download/${encodeURIComponent(novel.name)}.txt" 
                               class="btn btn-sm btn-outline-primary">TXT</a>
                        ` : ''}
                        ${novel.epub_path ? `
                            <a href="/download/${encodeURIComponent(novel.name)}.epub" 
                               class="btn btn-sm btn-outline-primary">EPUB</a>
                        ` : ''}
                        ${novel.html_path ? `
                            <a href="/download/${encodeURIComponent(novel.name)}(html).zip" 
                               class="btn btn-sm btn-outline-primary">HTML</a>
                        ` : ''}
                        ${novel.latex_path ? `
                            <a href="/download/${encodeURIComponent(novel.name)}.tex" 
                               class="btn btn-sm btn-outline-primary">LaTeX</a>
                        ` : ''}
                    </div>
                    <div class="mt-2">
                        ${novel.novel_id ? `
                            <button class="btn btn-sm btn-outline-success update-novel-btn w-100" 
                                    data-novel-id="${novel.novel_id}">
                                更新此小说
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline-secondary w-100" disabled>
                                无法更新 (ID丢失)
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add update handlers with proper event delegation
    novelList.addEventListener('click', async (e) => {
        const updateBtn = e.target.closest('.update-novel-btn');
        if (updateBtn) {
            const novelId = updateBtn.dataset.novelId;
            if (novelId) {
                await downloadNovel(novelId);
            }
        }
    });

    // Add update all handler
    const updateAllBtn = document.getElementById('updateAllBtn');
    if (updateAllBtn) {
        updateAllBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/update-all', {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (response.ok) {
                    if (data.status === 'queued') {
                        progressModal.show();
                        logOutput.textContent = `开始更新小说...\n已添加 ${data.count} 本小说到更新队列\n`;
                    } else if (data.status === 'no_novels') {
                        alert('没有找到可以更新的小说');
                    }
                } else {
                    throw new Error(data.error || '更新失败');
                }
            } catch (error) {
                alert(error.message || '更新失败，请重试');
            }
        });
    }
}

// Settings Functionality
async function loadSettings() {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    
    document.getElementById('kgf').value = settings.kgf;
    document.getElementById('kg').value = settings.kg;
    document.getElementById('delayMin').value = settings.delay[0];
    document.getElementById('delayMax').value = settings.delay[1];
    document.getElementById('saveMode').value = settings.save_mode;
    document.getElementById('xc').value = settings.xc;

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            kgf: document.getElementById('kgf').value,
            kg: parseInt(document.getElementById('kg').value),
            delay: [
                parseInt(document.getElementById('delayMin').value),
                parseInt(document.getElementById('delayMax').value)
            ],
            save_mode: parseInt(document.getElementById('saveMode').value),
            xc: parseInt(document.getElementById('xc').value)
        };

        await saveSettings(formData);
    });
}

// Add download queue management
let isDownloading = false;

// 更新下载函数
async function downloadNovel(novelId) {
    try {
        // 先检查当前队列状态
        const queueResponse = await fetch('/api/queue/status');
        const queueStatus = await queueResponse.json();
        
        if (queueStatus.queue_length > 0 || queueStatus.current_download) {
            const choice = confirm('已有小说正在下载或在队列中。是否将此小说加入下载队列？');
            if (!choice) {
                return;
            }
        }

        const response = await fetch(`/api/queue/add/${novelId}`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error('Failed to add to queue');
        }
        
        progressModal.show();
        logOutput.textContent += `已将小说 ${novelId} 添加到下载队列\n`;
    } catch (error) {
        alert('添加到下载队列失败：' + error.message);
    }
}

// 添加队列状态更新监听
socket.on('queue_update', (queueStatus) => {
    // 更新UI显示
    updateQueueDisplay(queueStatus);
});

function updateQueueDisplay(status) {
    const modalTitle = document.querySelector('.modal-title');
    const queueStatusDiv = document.querySelector('.queue-status');
    const showProgressBtn = document.getElementById('showProgress');
    
    if (!queueStatusDiv) {
        console.error('Queue status element not found');
        return;
    }
    
    // 更新队列状态显示
    if (status.current_download || status.queue_length > 0) {
        modalTitle.textContent = `下载进度 (队列中: ${status.queue_length})`;
        let statusText = '';
        if (status.current_download) {
            statusText += `正在下载: ${status.current_download}\n`;
        }
        if (status.queue_length > 0) {
            statusText += `队列中还有 ${status.queue_length} 本小说等待下载`;
        }
        queueStatusDiv.textContent = statusText;
        
        // 如果进度模态框是隐藏的，显示悬浮按钮
        if (!progressModal._isShown) {
            showProgressBtn.style.display = 'block';
        }
    } else {
        modalTitle.textContent = '下载进度';
        queueStatusDiv.textContent = '';
        // 如果没有下载任务，隐藏悬浮按钮
        showProgressBtn.style.display = 'none';
    }
}

// 页面加载时获取初始队列状态
async function fetchQueueStatus() {
    try {
        const response = await fetch('/api/queue/status');
        if (!response.ok) {
            throw new Error('Failed to fetch queue status');
        }
        const status = await response.json();
        updateQueueDisplay(status);
        
        // 移除自动显示模态框的逻辑
        // if (status.current_download || status.queue_length > 0) {
        //     progressModal.show();
        // }
    } catch (error) {
        console.error('Failed to fetch queue status:', error);
    }
}

// 添加定期检查队列状态的功能
setInterval(fetchQueueStatus, 5000); // 每5秒检查一次队列状态

// Add error handling for settings
async function saveSettings(formData) {
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save settings');
        }
        
        alert('设置已保存');
    } catch (error) {
        alert('保存设置失败，请重试');
    }
}

// Initialize the search page by default
document.addEventListener('DOMContentLoaded', async () => {
    // 确保进度模态框中有队列状态显示区域
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody.querySelector('.queue-status')) {
        const queueStatus = document.createElement('div');
        queueStatus.className = 'queue-status mt-2';
        modalBody.insertBefore(queueStatus, modalBody.firstChild);
    }

    // 获取初始队列状态
    await fetchQueueStatus();
    
    // 然后加载搜索页面
    document.querySelector('[data-page="search"]').click();
});

// Progress Modal Controls
const showProgressBtn = document.getElementById('showProgress');
const minimizeProgressBtn = document.getElementById('minimizeProgress');

minimizeProgressBtn.addEventListener('click', () => {
    progressModal.hide();
    // 如果有正在进行的下载或队列中有任务，显示悬浮按钮
    const queueStatusDiv = document.querySelector('.queue-status');
    if (queueStatusDiv && queueStatusDiv.textContent.trim()) {
        showProgressBtn.style.display = 'block';
    }
});

showProgressBtn.addEventListener('click', () => {
    progressModal.show();
    showProgressBtn.style.display = 'none';
});

// 监听模态框的隐藏事件
progressModal._element.addEventListener('hidden.bs.modal', () => {
    // 检查是否有正在进行的下载或队列中的任务
    const queueStatusDiv = document.querySelector('.queue-status');
    if (queueStatusDiv && queueStatusDiv.textContent.trim()) {
        showProgressBtn.style.display = 'block';
    }
});
