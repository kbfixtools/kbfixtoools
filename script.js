/**
 * KB-FixTools — Main Application Logic
 * All tools run entirely in the browser using Canvas and jsPDF.
 */

// ============================================================
// 1. PAGE NAVIGATION
// ============================================================
const pages = {
    home: document.getElementById('page-home'),
    imagetopdf: document.getElementById('page-imagetopdf'),
    compress: document.getElementById('page-compress'),
    resize: document.getElementById('page-resize'),
    jpgtopng: document.getElementById('page-jpgtopng'),
    pngtojpg: document.getElementById('page-pngtojpg'),
};

const navLinks = document.querySelectorAll('.nav-links a');
const backBtns = document.querySelectorAll('.back-btn');
const logoLink = document.getElementById('logoLink');

function showPage(pageId) {
    Object.values(pages).forEach(p => p.style.display = 'none');
    if (pages[pageId]) pages[pageId].style.display = 'block';
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
    document.getElementById('navLinks').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(link.dataset.page);
    });
});

backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        showPage(btn.dataset.page);
    });
});

logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('home');
});

document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
        showPage(card.dataset.page);
    });
});

document.querySelector('.hero-actions .btn-primary')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('imagetopdf');
});

// ============================================================
// 2. DARK MODE — FIXED (works reliably)
// ============================================================
const darkToggle = document.getElementById('darkToggle');
const darkIcon = darkToggle?.querySelector('i');

function applyDarkMode(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (darkIcon) darkIcon.className = 'fas fa-sun';
    } else {
        document.documentElement.classList.remove('dark');
        if (darkIcon) darkIcon.className = 'fas fa-moon';
    }
    localStorage.setItem('kb-dark', isDark);
}

// Load saved preference
const savedDark = localStorage.getItem('kb-dark');
if (savedDark === 'true') {
    applyDarkMode(true);
} else if (savedDark === 'false') {
    applyDarkMode(false);
} else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyDarkMode(prefersDark);
}

// Toggle handler with debug
if (darkToggle) {
    darkToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isDark = !document.documentElement.classList.contains('dark');
        applyDarkMode(isDark);
        console.log('Dark mode toggled:', isDark ? 'ON' : 'OFF');
    });
} else {
    console.warn('Dark toggle button not found!');
}

// Listen for system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('kb-dark') === null) {
        applyDarkMode(e.matches);
    }
});

// ============================================================
// 3. MOBILE MENU TOGGLE
// ============================================================
document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
});

// ============================================================
// 4. IMAGE TO PDF — ENHANCED with Target Size
// ============================================================
const pdfFiles = [];
const pdfFileInput = document.getElementById('pdfFileInput');
const pdfPreviewList = document.getElementById('pdfPreviewList');
const pdfGenerateBtn = document.getElementById('pdfGenerateBtn');
const pdfPreviewBtn = document.getElementById('pdfPreviewBtn');
const pdfDownloadJpgBtn = document.getElementById('pdfDownloadJpgBtn');
const pdfClearBtn = document.getElementById('pdfClearBtn');
const pdfLayoutSelect = document.getElementById('pdfLayout');
const pdfQualitySlider = document.getElementById('pdfQuality');
const pdfQualityLabel = document.getElementById('pdfQualityLabel');
const pdfSizeEstimate = document.getElementById('pdfSizeEstimate');
const pdfTargetIndicator = document.getElementById('pdfTargetIndicator');

const pdfTargetSize = document.getElementById('pdfTargetSize');
const pdfTargetUnit = document.getElementById('pdfTargetUnit');
const pdfOptimizeBtn = document.getElementById('pdfOptimizeBtn');

const pdfPreviewModal = document.getElementById('pdfPreviewModal');
const pdfPreviewIframe = document.getElementById('pdfPreviewIframe');
const pdfPreviewClose = document.getElementById('pdfPreviewClose');
const pdfPreviewCloseBtn = document.getElementById('pdfPreviewCloseBtn');
const pdfPreviewDownloadBtn = document.getElementById('pdfPreviewDownloadBtn');

let cachedPDFBlob = null;

// Toast notification system
function showToast(message, isSuccess = true) {
    const existing = document.querySelector('.kb-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'kb-toast';
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: var(--bg-card); color: var(--text-primary);
        padding: 14px 28px; border-radius: var(--radius-sm);
        box-shadow: var(--shadow-hover); border: 1px solid var(--border-color);
        z-index: 9999; font-weight: 500; max-width: 90%;
        animation: fadeUp 0.3s ease;
        border-left: 4px solid ${isSuccess ? 'var(--success)' : 'var(--danger)'};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function requireImages() {
    if (pdfFiles.length === 0) {
        showToast('📸 Please upload images first!', false);
        return false;
    }
    return true;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function getTargetBytes() {
    const val = parseFloat(pdfTargetSize.value);
    if (isNaN(val) || val <= 0) return null;
    const unit = pdfTargetUnit.value;
    return unit === 'KB' ? val * 1024 : val * 1048576;
}

function renderPDFPreviews() {
    pdfPreviewList.innerHTML = '';
    pdfFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'pdf-preview-item';
        div.draggable = true;
        div.dataset.index = index;

        const img = document.createElement('img');
        img.src = item.dataURL;
        img.alt = item.file.name;

        const span = document.createElement('span');
        span.textContent = item.file.name.length > 20 ? item.file.name.slice(0, 18) + '…' : item.file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pdfFiles.splice(index, 1);
            renderPDFPreviews();
            updateSizeEstimateAndTarget();
        });

        div.appendChild(img);
        div.appendChild(span);
        div.appendChild(removeBtn);
        pdfPreviewList.appendChild(div);

        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
        });
        div.addEventListener('dragover', (e) => e.preventDefault());
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text/plain'));
            const to = index;
            if (from === to) return;
            const [moved] = pdfFiles.splice(from, 1);
            pdfFiles.splice(to, 0, moved);
            renderPDFPreviews();
            cachedPDFBlob = null;
            updateSizeEstimateAndTarget();
        });
    });
    updateSizeEstimateAndTarget();
}

async function estimatePDFSize(quality) {
    if (pdfFiles.length === 0) return 0;
    let totalBytes = 0;
    for (const item of pdfFiles) {
        const compressedDataURL = await compressImageData(item.dataURL, quality);
        const bytes = Math.round((compressedDataURL.length * 3) / 4);
        totalBytes += bytes;
    }
    return totalBytes;
}

function updateSizeEstimateAndTarget() {
    if (pdfFiles.length === 0) {
        pdfSizeEstimate.textContent = '—';
        pdfTargetIndicator.textContent = '';
        pdfTargetIndicator.className = 'target-indicator';
        return;
    }
    const quality = parseInt(pdfQualitySlider.value) / 100;
    estimatePDFSize(quality).then(size => {
        pdfSizeEstimate.textContent = formatFileSize(size);
        const targetBytes = getTargetBytes();
        if (targetBytes !== null) {
            const ratio = size / targetBytes;
            if (ratio <= 1.05) {
                pdfTargetIndicator.textContent = '✅ Within target';
                pdfTargetIndicator.className = 'target-indicator success';
            } else {
                pdfTargetIndicator.textContent = `🔴 ${Math.round(ratio * 100)}% of target`;
                pdfTargetIndicator.className = 'target-indicator fail';
            }
        } else {
            pdfTargetIndicator.textContent = '';
            pdfTargetIndicator.className = 'target-indicator';
        }
        cachedPDFBlob = null;
    });
}

pdfQualitySlider.addEventListener('input', () => {
    pdfQualityLabel.textContent = pdfQualitySlider.value + '%';
    updateSizeEstimateAndTarget();
});

pdfTargetSize.addEventListener('input', updateSizeEstimateAndTarget);
pdfTargetUnit.addEventListener('change', updateSizeEstimateAndTarget);

pdfOptimizeBtn.addEventListener('click', async () => {
    if (!requireImages()) return;
    const targetBytes = getTargetBytes();
    if (targetBytes === null) {
        showToast('⚠️ Please set a valid target size.', false);
        return;
    }

    let low = 10,
        high = 100;
    let bestQuality = 10;
    let bestSize = Infinity;

    for (let i = 0; i < 10; i++) {
        const mid = Math.round((low + high) / 2);
        const q = mid / 100;
        const size = await estimatePDFSize(q);
        if (size <= targetBytes) {
            bestQuality = mid;
            bestSize = size;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
        if (low > high) break;
    }

    if (bestQuality === 10 && bestSize > targetBytes) {
        bestQuality = 10;
        bestSize = await estimatePDFSize(0.1);
    }

    pdfQualitySlider.value = bestQuality;
    pdfQualityLabel.textContent = bestQuality + '%';
    updateSizeEstimateAndTarget();

    showToast(`✅ Optimized to ${formatFileSize(bestSize)} (quality ${bestQuality}%)`, true);
});

function compressImageData(dataURL, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const mimeType = dataURL.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
            resolve(canvas.toDataURL(mimeType, quality));
        };
        img.src = dataURL;
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

pdfFileInput.addEventListener('change', async () => {
    const files = Array.from(pdfFileInput.files);
    for (const file of files) {
        const dataURL = await readFileAsDataURL(file);
        pdfFiles.push({ file, dataURL });
    }
    renderPDFPreviews();
    pdfFileInput.value = '';
    cachedPDFBlob = null;
});

const pdfZone = document.getElementById('pdfUploadZone');
pdfZone.addEventListener('dragover', (e) => { e.preventDefault();
    pdfZone.style.borderColor = 'var(--accent)'; });
pdfZone.addEventListener('dragleave', () => { pdfZone.style.borderColor = ''; });
pdfZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    pdfZone.style.borderColor = '';
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
        const dataURL = await readFileAsDataURL(file);
        pdfFiles.push({ file, dataURL });
    }
    renderPDFPreviews();
    cachedPDFBlob = null;
});

pdfClearBtn.addEventListener('click', () => {
    pdfFiles.length = 0;
    renderPDFPreviews();
    cachedPDFBlob = null;
    pdfSizeEstimate.textContent = '—';
    pdfTargetIndicator.textContent = '';
    pdfTargetIndicator.className = 'target-indicator';
    showToast('🗑️ All images cleared', true);
});

async function generatePDFBlob() {
    if (pdfFiles.length === 0) return null;
    if (cachedPDFBlob) return cachedPDFBlob;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const layout = pdfLayoutSelect.value;
    const quality = parseInt(pdfQualitySlider.value) / 100;
    const margin = 20;
    const gap = 20;

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const loadImage = (dataURL) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = dataURL;
        });
    };

    const total = pdfFiles.length;
    let index = 0;

    while (index < total) {
        if (layout === 'single') {
            const item = pdfFiles[index];
            const compressedDataURL = await compressImageData(item.dataURL, quality);
            const img = await loadImage(compressedDataURL);
            if (index > 0) pdf.addPage();

            const maxWidth = pageWidth - 2 * margin;
            const maxHeight = pageHeight - 2 * margin;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (pageWidth - w) / 2;
            const y = (pageHeight - h) / 2;

            const format = compressedDataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            pdf.addImage(compressedDataURL, format, x, y, w, h);
            index++;
        } else {
            const items = [];
            items.push(pdfFiles[index]);
            if (index + 1 < total) items.push(pdfFiles[index + 1]);

            if (index > 0) pdf.addPage();

            const availableHeight = (pageHeight - 2 * margin - gap) / 2;
            const availableWidth = pageWidth - 2 * margin;

            const loaded = [];
            for (let i = 0; i < items.length; i++) {
                const compressedDataURL = await compressImageData(items[i].dataURL, quality);
                const img = await loadImage(compressedDataURL);
                const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                const x = (pageWidth - w) / 2;
                const y = margin + i * (availableHeight + gap) + (availableHeight - h) / 2;
                const format = compressedDataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                loaded.push({ dataURL: compressedDataURL, x, y, w, h, format });
            }

            for (const d of loaded) {
                pdf.addImage(d.dataURL, d.format, d.x, d.y, d.w, d.h);
            }
            index += items.length;
        }
    }

    cachedPDFBlob = pdf.output('blob');
    return cachedPDFBlob;
}

// ===== PREVIEW PDF (always clickable) =====
pdfPreviewBtn.addEventListener('click', async () => {
    if (!requireImages()) return;
    const blob = await generatePDFBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    pdfPreviewIframe.src = url;
    pdfPreviewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
});

function closePreviewModal() {
    pdfPreviewModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (pdfPreviewIframe.src) {
            URL.revokeObjectURL(pdfPreviewIframe.src);
        }
        pdfPreviewIframe.src = '';
    }, 300);
}

pdfPreviewClose.addEventListener('click', closePreviewModal);
pdfPreviewCloseBtn.addEventListener('click', closePreviewModal);
pdfPreviewModal.addEventListener('click', (e) => {
    if (e.target === pdfPreviewModal) closePreviewModal();
});

pdfPreviewDownloadBtn.addEventListener('click', async () => {
    if (!requireImages()) return;
    const blob = await generatePDFBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KB-FixTools-merged.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
});

// ===== DOWNLOAD PDF (always clickable) =====
pdfGenerateBtn.addEventListener('click', async () => {
    if (!requireImages()) return;
    const blob = await generatePDFBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KB-FixTools-merged.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
});

// ===== DOWNLOAD AS JPG (always clickable) =====
pdfDownloadJpgBtn.addEventListener('click', async () => {
    if (!requireImages()) return;

    const layout = pdfLayoutSelect.value;
    const quality = parseInt(pdfQualitySlider.value) / 100;
    const margin = 20;
    const gap = 20;
    const pageWidth = 210;
    const pageHeight = 297;

    const loadImage = (dataURL) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = dataURL;
        });
    };

    const total = pdfFiles.length;
    let index = 0;
    const allPages = [];

    while (index < total) {
        const pageImages = [];
        if (layout === 'single') {
            pageImages.push(pdfFiles[index]);
            index++;
        } else {
            pageImages.push(pdfFiles[index]);
            if (index + 1 < total) pageImages.push(pdfFiles[index + 1]);
            index += pageImages.length;
        }
        allPages.push(pageImages);
    }

    for (let p = 0; p < allPages.length; p++) {
        const pageItems = allPages[p];
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = pageWidth * scale;
        canvas.height = pageHeight * scale;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const availableWidth = (pageWidth - 2 * margin) * scale;
        const availableHeight = (pageHeight - 2 * margin - (pageItems.length > 1 ? gap : 0) * scale) / pageItems.length;

        for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const compressedDataURL = await compressImageData(item.dataURL, quality);
            const img = await loadImage(compressedDataURL);

            const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (canvas.width - w) / 2;
            const y = (margin * scale) + i * (availableHeight + gap * scale) + (availableHeight - h) / 2;

            ctx.drawImage(img, x, y, w, h);
        }

        const jpgDataURL = canvas.toDataURL('image/jpeg', 0.92);
        const a = document.createElement('a');
        a.href = jpgDataURL;
        a.download = `KB-FixTools-page-${p + 1}.jpg`;
        a.click();
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    showToast(`✅ Downloaded ${allPages.length} page${allPages.length > 1 ? 's' : ''} as JPG`, true);
});

pdfLayoutSelect.addEventListener('change', () => {
    cachedPDFBlob = null;
    updateSizeEstimateAndTarget();
});

// ============================================================
// 5. IMAGE COMPRESSOR
// ============================================================
const compressInput = document.getElementById('compressFileInput');
const compressQuality = document.getElementById('compressQuality');
const qualityLabel = document.getElementById('compressQualityLabel');
const compressOriginalImg = document.getElementById('compressOriginalImg');
const compressCompressedImg = document.getElementById('compressCompressedImg');
const compressOriginalSize = document.getElementById('compressOriginalSize');
const compressCompressedSize = document.getElementById('compressCompressedSize');
const compressDownloadBtn = document.getElementById('compressDownloadBtn');
const compressClearBtn = document.getElementById('compressClearBtn');

let compressOriginalFile = null;
let compressCompressedDataURL = null;

function resetCompressor() {
    compressOriginalFile = null;
    compressCompressedDataURL = null;
    compressOriginalImg.src = '';
    compressCompressedImg.src = '';
    compressOriginalSize.textContent = '—';
    compressCompressedSize.textContent = '—';
    compressDownloadBtn.disabled = true;
    compressInput.value = '';
    compressQuality.value = 80;
    qualityLabel.textContent = '80%';
}

compressClearBtn.addEventListener('click', resetCompressor);

compressInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressOriginalFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        compressOriginalImg.src = ev.target.result;
        compressOriginalSize.textContent = `Size: ${(file.size / 1024).toFixed(1)} KB`;
        compressAndPreview();
    };
    reader.readAsDataURL(file);
});

compressQuality.addEventListener('input', () => {
    qualityLabel.textContent = compressQuality.value + '%';
    if (compressOriginalFile) compressAndPreview();
});

function compressAndPreview() {
    if (!compressOriginalFile) return;
    const quality = parseInt(compressQuality.value) / 100;
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const mimeType = compressOriginalFile.type || 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        compressCompressedImg.src = dataUrl;
        compressCompressedDataURL = dataUrl;
        const sizeBytes = Math.round((dataUrl.length * 3) / 4);
        compressCompressedSize.textContent = `Size: ${(sizeBytes / 1024).toFixed(1)} KB`;
        compressDownloadBtn.disabled = false;
    };
    img.src = URL.createObjectURL(compressOriginalFile);
}

compressDownloadBtn.addEventListener('click', () => {
    if (!compressCompressedDataURL) return;
    const a = document.createElement('a');
    a.href = compressCompressedDataURL;
    const ext = compressOriginalFile.type.split('/')[1] || 'jpg';
    a.download = `compressed.${ext}`;
    a.click();
});

const compressZone = document.getElementById('compressUploadZone');
compressZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        compressInput.files = e.dataTransfer.files;
        compressInput.dispatchEvent(new Event('change'));
    }
});
compressZone.addEventListener('dragover', (e) => e.preventDefault());

// ============================================================
// 6. IMAGE RESIZER
// ============================================================
const resizeInput = document.getElementById('resizeFileInput');
const resizePreviewImg = document.getElementById('resizePreviewImg');
const resizeOriginalSize = document.getElementById('resizeOriginalSize');
const resizeWidth = document.getElementById('resizeWidth');
const resizeHeight = document.getElementById('resizeHeight');
const resizeLockRatio = document.getElementById('resizeLockRatio');
const resizeApplyBtn = document.getElementById('resizeApplyBtn');
const resizeDownloadBtn = document.getElementById('resizeDownloadBtn');

let resizeOriginalFile = null;
let resizeResultDataURL = null;
let resizeOriginalWidth = 0,
    resizeOriginalHeight = 0;

resizeInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resizeOriginalFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            resizeOriginalWidth = img.width;
            resizeOriginalHeight = img.height;
            resizePreviewImg.src = ev.target.result;
            resizeOriginalSize.textContent =
                `Original: ${resizeOriginalWidth}×${resizeOriginalHeight}  (${(file.size / 1024).toFixed(1)} KB)`;
            resizeWidth.value = resizeOriginalWidth;
            resizeHeight.value = resizeOriginalHeight;
            resizeApplyBtn.disabled = false;
            resizeResultDataURL = null;
            resizeDownloadBtn.disabled = true;
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

function updateHeightFromWidth() {
    if (resizeLockRatio.checked && resizeOriginalWidth > 0) {
        const ratio = resizeOriginalHeight / resizeOriginalWidth;
        resizeHeight.value = Math.round(parseInt(resizeWidth.value) * ratio);
    }
}

function updateWidthFromHeight() {
    if (resizeLockRatio.checked && resizeOriginalHeight > 0) {
        const ratio = resizeOriginalWidth / resizeOriginalHeight;
        resizeWidth.value = Math.round(parseInt(resizeHeight.value) * ratio);
    }
}
resizeWidth.addEventListener('input', updateHeightFromWidth);
resizeHeight.addEventListener('input', updateWidthFromHeight);

resizeApplyBtn.addEventListener('click', () => {
    if (!resizeOriginalFile) return;
    const w = parseInt(resizeWidth.value);
    const h = parseInt(resizeHeight.value);
    if (!w || !h || w < 1 || h < 1) return;

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resizeResultDataURL = canvas.toDataURL(resizeOriginalFile.type || 'image/jpeg');
        resizePreviewImg.src = resizeResultDataURL;
        resizeDownloadBtn.disabled = false;
        resizeOriginalSize.textContent = `Resized: ${w}×${h}`;
    };
    img.src = URL.createObjectURL(resizeOriginalFile);
});

resizeDownloadBtn.addEventListener('click', () => {
    if (!resizeResultDataURL) return;
    const a = document.createElement('a');
    a.href = resizeResultDataURL;
    const ext = (resizeOriginalFile.type || 'image/jpeg').split('/')[1] || 'jpg';
    a.download = `resized.${ext}`;
    a.click();
});

document.getElementById('resizeUploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        resizeInput.files = e.dataTransfer.files;
        resizeInput.dispatchEvent(new Event('change'));
    }
});
document.getElementById('resizeUploadZone').addEventListener('dragover', (e) => e.preventDefault());

// ============================================================
// 7. JPG TO PNG
// ============================================================
const jpgtopngInput = document.getElementById('jpgtopngFileInput');
const jpgtopngOriginalImg = document.getElementById('jpgtopngOriginalImg');
const jpgtopngResultImg = document.getElementById('jpgtopngResultImg');
const jpgtopngConvertBtn = document.getElementById('jpgtopngConvertBtn');
const jpgtopngDownloadBtn = document.getElementById('jpgtopngDownloadBtn');

let jpgtopngDataURL = null;

jpgtopngInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        jpgtopngOriginalImg.src = ev.target.result;
        jpgtopngResultImg.src = '';
        jpgtopngDataURL = null;
        jpgtopngConvertBtn.disabled = false;
        jpgtopngDownloadBtn.disabled = true;
    };
    reader.readAsDataURL(file);
});

jpgtopngConvertBtn.addEventListener('click', () => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        jpgtopngDataURL = canvas.toDataURL('image/png');
        jpgtopngResultImg.src = jpgtopngDataURL;
        jpgtopngDownloadBtn.disabled = false;
    };
    img.src = jpgtopngOriginalImg.src;
});

jpgtopngDownloadBtn.addEventListener('click', () => {
    if (!jpgtopngDataURL) return;
    const a = document.createElement('a');
    a.href = jpgtopngDataURL;
    a.download = 'converted.png';
    a.click();
});

document.getElementById('jpgtopngUploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/jpeg' || file.name.match(/\.jpe?g$/i))) {
        jpgtopngInput.files = e.dataTransfer.files;
        jpgtopngInput.dispatchEvent(new Event('change'));
    }
});
document.getElementById('jpgtopngUploadZone').addEventListener('dragover', (e) => e.preventDefault());

// ============================================================
// 8. PNG TO JPG
// ============================================================
const pngtojpgInput = document.getElementById('pngtojpgFileInput');
const pngtojpgOriginalImg = document.getElementById('pngtojpgOriginalImg');
const pngtojpgResultImg = document.getElementById('pngtojpgResultImg');
const pngtojpgConvertBtn = document.getElementById('pngtojpgConvertBtn');
const pngtojpgDownloadBtn = document.getElementById('pngtojpgDownloadBtn');

let pngtojpgDataURL = null;

pngtojpgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        pngtojpgOriginalImg.src = ev.target.result;
        pngtojpgResultImg.src = '';
        pngtojpgDataURL = null;
        pngtojpgConvertBtn.disabled = false;
        pngtojpgDownloadBtn.disabled = true;
    };
    reader.readAsDataURL(file);
});

pngtojpgConvertBtn.addEventListener('click', () => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        pngtojpgDataURL = canvas.toDataURL('image/jpeg', 0.92);
        pngtojpgResultImg.src = pngtojpgDataURL;
        pngtojpgDownloadBtn.disabled = false;
    };
    img.src = pngtojpgOriginalImg.src;
});

pngtojpgDownloadBtn.addEventListener('click', () => {
    if (!pngtojpgDataURL) return;
    const a = document.createElement('a');
    a.href = pngtojpgDataURL;
    a.download = 'converted.jpg';
    a.click();
});

document.getElementById('pngtojpgUploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/png' || file.name.match(/\.png$/i))) {
        pngtojpgInput.files = e.dataTransfer.files;
        pngtojpgInput.dispatchEvent(new Event('change'));
    }
});
document.getElementById('pngtojpgUploadZone').addEventListener('dragover', (e) => e.preventDefault());

// ============================================================
// INIT
// ============================================================
showPage('home');