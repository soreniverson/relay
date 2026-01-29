// ============================================================================
// FILE UPLOAD COMPONENT
// Drag-and-drop file upload with preview
// ============================================================================

import { createElement, generateId, escapeHtml } from '../../utils/dom';

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  onFilesChange?: (files: File[]) => void;
}

export const fileUploadStyles = `
  .relay-file-upload {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-file-upload__label {
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
  }

  .relay-file-upload__dropzone {
    position: relative;
    padding: 24px;
    border: 2px dashed hsl(var(--relay-border));
    border-radius: 8px;
    background: hsl(var(--relay-bg-secondary));
    text-align: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-file-upload__dropzone:hover {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg-tertiary));
  }

  .relay-file-upload__dropzone--active {
    border-color: hsl(var(--relay-primary));
    background: hsla(var(--relay-primary), 0.05);
  }

  .relay-file-upload__dropzone--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .relay-file-upload__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .relay-file-upload__input:disabled {
    cursor: not-allowed;
  }

  .relay-file-upload__icon {
    width: 32px;
    height: 32px;
    margin: 0 auto 8px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__text {
    font-size: 14px;
    color: hsl(var(--relay-text));
    margin-bottom: 4px;
  }

  .relay-file-upload__hint {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__browse {
    color: hsl(var(--relay-primary));
    text-decoration: underline;
  }

  .relay-file-upload__files {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-file-upload__file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 6px;
  }

  .relay-file-upload__file-icon {
    width: 20px;
    height: 20px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__file-info {
    flex: 1;
    min-width: 0;
  }

  .relay-file-upload__file-name {
    font-size: 13px;
    color: hsl(var(--relay-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .relay-file-upload__file-size {
    font-size: 11px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__file-remove {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-file-upload__file-remove:hover {
    background: hsl(var(--relay-bg-tertiary));
    color: hsl(var(--relay-error));
  }

  .relay-file-upload__error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }
`;

export interface FileUploadResult {
  container: HTMLDivElement;
  getFiles: () => File[];
  setFiles: (files: File[]) => void;
  clearFiles: () => void;
  setError: (error: string | null) => void;
}

export function createFileUpload(label: string, props: FileUploadProps = {}): FileUploadResult {
  const {
    accept,
    multiple = true,
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5,
    disabled = false,
    className = '',
    onFilesChange,
  } = props;

  const id = generateId('file-upload');
  let files: File[] = [];

  // Create container
  const container = createElement('div', { class: `relay-file-upload ${className}`.trim() });

  // Create label
  const labelEl = createElement('label', { class: 'relay-file-upload__label' }, [label]);

  // Create dropzone
  const dropzone = createElement('div', {
    class: `relay-file-upload__dropzone ${disabled ? 'relay-file-upload__dropzone--disabled' : ''}`,
  });

  // Create hidden input
  const input = createElement('input', {
    type: 'file',
    id,
    class: 'relay-file-upload__input',
    accept,
    multiple,
    disabled,
  }) as HTMLInputElement;

  // Create dropzone content
  const icon = createElement('div', { class: 'relay-file-upload__icon' });
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>`;

  const text = createElement('div', { class: 'relay-file-upload__text' }, [
    'Drop files here or ',
  ]);
  const browseLink = createElement('span', { class: 'relay-file-upload__browse' }, ['browse']);
  text.appendChild(browseLink);

  const hint = createElement('div', { class: 'relay-file-upload__hint' });
  hint.textContent = `Max ${formatFileSize(maxSize)} per file${multiple ? `, up to ${maxFiles} files` : ''}`;

  dropzone.appendChild(input);
  dropzone.appendChild(icon);
  dropzone.appendChild(text);
  dropzone.appendChild(hint);

  // Create file list
  const fileList = createElement('div', { class: 'relay-file-upload__files' });

  // Create error
  const errorEl = createElement('div', { class: 'relay-file-upload__error' });
  errorEl.style.display = 'none';

  // Assemble
  container.appendChild(labelEl);
  container.appendChild(dropzone);
  container.appendChild(fileList);
  container.appendChild(errorEl);

  // Render file list
  const renderFiles = () => {
    fileList.innerHTML = '';
    files.forEach((file, index) => {
      const fileItem = createElement('div', { class: 'relay-file-upload__file' });

      const fileIcon = createElement('span', { class: 'relay-file-upload__file-icon' });
      fileIcon.innerHTML = getFileIcon(file.type);

      const fileInfo = createElement('div', { class: 'relay-file-upload__file-info' });
      const fileName = createElement('div', { class: 'relay-file-upload__file-name' }, [escapeHtml(file.name)]);
      const fileSize = createElement('div', { class: 'relay-file-upload__file-size' }, [formatFileSize(file.size)]);
      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileSize);

      const removeBtn = createElement('button', {
        type: 'button',
        class: 'relay-file-upload__file-remove',
      });
      removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      removeBtn.addEventListener('click', () => {
        files = files.filter((_, i) => i !== index);
        renderFiles();
        onFilesChange?.(files);
      });

      fileItem.appendChild(fileIcon);
      fileItem.appendChild(fileInfo);
      fileItem.appendChild(removeBtn);
      fileList.appendChild(fileItem);
    });
  };

  // Handle file selection
  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles: File[] = [];
    let error: string | null = null;

    Array.from(newFiles).forEach((file) => {
      if (files.length + validFiles.length >= maxFiles) {
        error = `Maximum ${maxFiles} files allowed`;
        return;
      }
      if (file.size > maxSize) {
        error = `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`;
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      files = multiple ? [...files, ...validFiles] : validFiles;
      renderFiles();
      onFilesChange?.(files);
    }

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
    } else {
      errorEl.style.display = 'none';
    }

    // Reset input
    input.value = '';
  };

  // Event handlers
  input.addEventListener('change', () => handleFiles(input.files));

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!disabled) {
      dropzone.classList.add('relay-file-upload__dropzone--active');
    }
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('relay-file-upload__dropzone--active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('relay-file-upload__dropzone--active');
    if (!disabled) {
      handleFiles(e.dataTransfer?.files ?? null);
    }
  });

  return {
    container,
    getFiles: () => [...files],
    setFiles: (newFiles: File[]) => {
      files = newFiles.slice(0, maxFiles);
      renderFiles();
    },
    clearFiles: () => {
      files = [];
      renderFiles();
      onFilesChange?.(files);
    },
    setError: (error: string | null) => {
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    },
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
  }
  if (mimeType.startsWith('video/')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`;
}
