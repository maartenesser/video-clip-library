"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  className?: string;
}

export function SearchBar({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = "Search transcripts...",
  debounceMs = 300,
  isLoading = false,
  className,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Track if user has interacted with the search
  const hasUserTyped = useRef(false);
  const previousValue = useRef(value);

  // Debounce effect - only trigger if user has typed and value actually changed
  useEffect(() => {
    if (!onSearch) return;

    // Skip if value hasn't changed or user hasn't typed yet
    if (!hasUserTyped.current || value === previousValue.current) {
      previousValue.current = value;
      return;
    }

    previousValue.current = value;

    const handler = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [value, debounceMs, onSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      hasUserTyped.current = true;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [isControlled, onChange]
  );

  const handleClear = useCallback(() => {
    if (!isControlled) {
      setInternalValue("");
    }
    onChange?.("");
    onSearch?.("");
  }, [isControlled, onChange, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear]
  );

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-10 pr-10"
        data-testid="search-input"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 min-h-[44px] min-w-[44px] -mr-1"
          onClick={handleClear}
          aria-label="Clear search"
          data-testid="clear-search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
