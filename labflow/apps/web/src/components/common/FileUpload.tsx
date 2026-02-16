'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export function FileUpload({
  accept,
  multiple = false,
  maxSize = 10,
  onFilesSelected,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (fileList: File[]): File[] => {
      setError(null);
      const maxBytes = maxSize * 1024 * 1024;
      const valid: File[] = [];

      for (const file of fileList) {
        if (file.size > maxBytes) {
          setError(`File "${file.name}" exceeds ${maxSize}MB limit.`);
          continue;
        }
        valid.push(file);
      }

      return valid;
    },
    [maxSize]
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const arr = Array.from(fileList);
      const valid = validateFiles(arr);
      if (valid.length > 0) {
        const newFiles = multiple ? [...files, ...valid] : valid;
        setFiles(newFiles);
        onFilesSelected(newFiles);
      }
    },
    [files, multiple, onFilesSelected, validateFiles]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-input hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {accept ? `Accepted: ${accept}` : 'All file types'} (max {maxSize}MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border bg-card p-2"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
