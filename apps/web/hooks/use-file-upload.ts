"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, InputHTMLAttributes } from "react";

export type UploadFile = {
  id: string;
  file: File;
  /** Object URL for previewing an image before it is uploaded. */
  preview: string;
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Drag-and-drop file selection with the limits enforced where the user can see
 * them, rather than only server-side after a long upload.
 */
export function useFileUpload({
  accept,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  multiple = true,
}: {
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
} = {}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const add = useCallback(
    (incoming: File[]) => {
      const problems: string[] = [];
      setFiles((current) => {
        const next = [...current];
        for (const file of incoming) {
          if (next.length >= maxFiles) {
            problems.push(`You can attach at most ${maxFiles} files.`);
            break;
          }
          if (file.size > maxSize) {
            problems.push(`${file.name} is larger than ${formatBytes(maxSize)}.`);
            continue;
          }
          // Same name and size twice is a re-pick, not a second file.
          if (next.some((item) => item.file.name === file.name && item.file.size === file.size)) {
            continue;
          }
          next.push({
            id: `${file.name}-${file.size}-${next.length}`,
            file,
            preview: URL.createObjectURL(file),
          });
        }
        return next;
      });
      setErrors(problems);
    },
    [maxFiles, maxSize],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((current) => {
      for (const item of current) URL.revokeObjectURL(item.preview);
      return [];
    });
    setErrors([]);
  }, []);

  const openFileDialog = useCallback(() => inputRef.current?.click(), []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);
  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
  }, []);
  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);
  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      add(Array.from(event.dataTransfer.files));
    },
    [add],
  );

  const getInputProps = useCallback(
    (): InputHTMLAttributes<HTMLInputElement> & {
      ref: typeof inputRef;
    } => ({
      ref: inputRef,
      id: inputId,
      type: "file",
      multiple,
      ...(accept ? { accept } : {}),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        add(Array.from(event.target.files ?? []));
        // Reset so re-picking the same file still fires a change.
        event.target.value = "";
      },
    }),
    [accept, add, inputId, multiple],
  );

  return [
    { files, isDragging, errors },
    {
      addFiles: add,
      clearFiles,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
    },
  ] as const;
}
