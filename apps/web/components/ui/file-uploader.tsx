"use client";

import {
  AlertCircle,
  FileIcon,
  ImageIcon,
  Trash2,
  UploadCloud,
  Upload,
} from "lucide-react";

import { formatBytes, type UploadFile } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function iconFor(file: File) {
  if (file.type.startsWith("image/")) {
    return <ImageIcon className="size-4 opacity-60" />;
  }
  return <FileIcon className="size-4 opacity-60" />;
}

/**
 * Drop area plus a table of what is attached.
 *
 * A bare file input told you a file was chosen but not how big it was, whether
 * it was over the limit, or how to drop just one of them — so the table lists
 * each file with its size and its own remove.
 */
export function FileUploader({
  files,
  isDragging,
  errors,
  inputProps,
  maxFiles,
  maxSize,
  title = "Upload files",
  onOpen,
  onRemove,
  onClear,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  files: readonly UploadFile[];
  isDragging: boolean;
  errors: readonly string[];
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  maxFiles: number;
  maxSize: number;
  title?: string;
  onOpen: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-input p-4 transition-colors has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50 data-[files]:hidden"
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input {...inputProps} aria-label={title} className="sr-only" />
        <div className="flex flex-col items-center justify-center text-center">
          <div
            aria-hidden
            className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
          >
            <ImageIcon className="size-4 opacity-60" />
          </div>
          <p className="mb-1.5 text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} files · up to {formatBytes(maxSize)} each
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={onOpen}
            variant="outline"
          >
            <Upload aria-hidden className="-ms-1 opacity-60" />
            Select files
          </Button>
        </div>
      </div>

      {files.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Files ({files.length})</h3>
            <div className="flex gap-2">
              <Button type="button" onClick={onOpen} size="sm" variant="outline">
                <UploadCloud aria-hidden className="-ms-0.5 size-3.5 opacity-60" />
                Add files
              </Button>
              <Button type="button" onClick={onClear} size="sm" variant="outline">
                <Trash2 aria-hidden className="-ms-0.5 size-3.5 opacity-60" />
                Remove all
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableHeader className="text-xs">
                <TableRow className="bg-muted/50">
                  <TableHead className="h-9 py-2">Name</TableHead>
                  <TableHead className="h-9 w-28 py-2">Type</TableHead>
                  <TableHead className="h-9 w-28 py-2">Size</TableHead>
                  <TableHead className="h-9 w-0 py-2 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[13px]">
                {files.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-48 py-2 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="shrink-0">{iconFor(item.file)}</span>
                        <span className="truncate">{item.file.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground">
                      {item.file.type.split("/")[1]?.toUpperCase() || "UNKNOWN"}
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground tabular-nums">
                      {formatBytes(item.file.size)}
                    </TableCell>
                    <TableCell className="py-2 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        aria-label={`Remove ${item.file.name}`}
                        className="size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
                        onClick={() => onRemove(item.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {errors.length > 0 ? (
        <div
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      ) : null}
    </div>
  );
}
