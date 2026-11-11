// functions/_lib/leadfiles.js
// Files that people attach to a lead (for example on the branding application).
// They are stored in R2 under leads/<lead id>/<n>. The slash in the key keeps
// them out of the public /assets/ route, so only the admin console can open them.

export const MAX_LEAD_FILES = 10;
export const MAX_LEAD_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB each (as the form says)
export const MAX_LEAD_TOTAL_BYTES = 30 * 1024 * 1024;  // 30 MB per submission

const ALLOWED_EXT = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'heic', 'heif', 'tif', 'tiff', 'bmp',
    'pdf', 'zip', 'rar', '7z', '7zip',
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
    'ai', 'eps', 'psd',
]);

export function leadFileKey(leadId, index) {
    return `leads/${leadId}/${index}`;
}

export function extOf(name = '') {
    const i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

/** Returns an error message, or '' when the list of files is acceptable. */
export function checkLeadFiles(files) {
    if (files.length > MAX_LEAD_FILES) return `Please attach no more than ${MAX_LEAD_FILES} files.`;
    let total = 0;
    for (const f of files) {
        const ext = extOf(f.name);
        const isImage = (f.type || '').startsWith('image/');
        if (!isImage && !ALLOWED_EXT.has(ext)) return `"${f.name}" isn't a file type we accept.`;
        if (f.size > MAX_LEAD_FILE_BYTES) return `"${f.name}" is larger than 10MB.`;
        total += f.size;
    }
    if (total > MAX_LEAD_TOTAL_BYTES) return 'Your files add up to more than 30MB. Please send fewer or smaller files.';
    return '';
}

export function parseLeadFiles(value) {
    if (!value) return [];
    try {
        const list = JSON.parse(value);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}
