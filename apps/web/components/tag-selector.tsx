"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  category?: string;
}

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagSelector({
  tags,
  selectedTagIds,
  onSelectionChange,
  placeholder = "Select tags...",
  className,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const getTagColor = (color?: string | null) => {
    if (!color) return undefined;
    if (color.startsWith("#")) {
      return { backgroundColor: color, color: getContrastColor(color) };
    }
    return undefined;
  };

  const getContrastColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  // Group tags by category
  const groupedTags = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const category = tag.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tag);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between min-h-[40px] h-auto", className)}
          data-testid="tag-selector-trigger"
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="mr-1 mb-1 pr-0.5 flex items-center"
                  style={getTagColor(tag.color)}
                  data-testid={`selected-tag-${tag.id}`}
                >
                  {tag.name}
                  <button
                    className="ml-1 min-h-[44px] min-w-[44px] -my-2 -mr-1 flex items-center justify-center ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-black/10"
                    onClick={(e) => handleRemoveTag(tag.id, e)}
                    aria-label={`Remove ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
                onClick={handleClearAll}
                aria-label="Clear all tags"
                data-testid="clear-all-tags"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto p-2" data-testid="tag-list">
          {Object.entries(groupedTags).map(([category, categoryTags]) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </div>
              {categoryTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="flex items-center gap-2 px-2 py-2.5 min-h-[44px] w-full rounded-sm hover:bg-accent cursor-pointer text-left"
                  onClick={() => handleToggleTag(tag.id)}
                  data-testid={`tag-option-${tag.id}`}
                  aria-pressed={selectedTagIds.includes(tag.id)}
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    className="pointer-events-none"
                    aria-hidden="true"
                  />
                  <Badge
                    variant="secondary"
                    className="flex-1"
                    style={getTagColor(tag.color)}
                  >
                    {tag.name}
                  </Badge>
                </button>
              ))}
            </div>
          ))}
          {tags.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No tags available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
