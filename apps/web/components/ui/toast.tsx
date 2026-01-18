"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "relative bg-background border rounded-lg shadow-lg p-4 pr-8 animate-in slide-in-from-right fade-in duration-300",
            toast.variant === "destructive" && "border-destructive bg-destructive/10"
          )}
        >
          <button
            onClick={() => dismiss(toast.id)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          {toast.title && (
            <div className={cn(
              "font-semibold text-sm",
              toast.variant === "destructive" && "text-destructive"
            )}>
              {toast.title}
            </div>
          )}
          {toast.description && (
            <div className="text-sm text-muted-foreground mt-1">
              {toast.description}
            </div>
          )}
          {toast.action && (
            <div className="mt-2">
              {toast.action}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
