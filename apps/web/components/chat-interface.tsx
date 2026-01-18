"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, MessageSquare, Video, Plus, Check, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ClipCard } from "@/components/clip-card";
import { Badge } from "@/components/ui/badge";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  clip_ids: string[];
  created_at: string;
}

interface SuggestedClip {
  id: string;
  file_url: string;
  thumbnail_url?: string | null;
  duration_seconds: number;
  transcript_segment?: string | null;
}

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
  className?: string;
}

export function ChatInterface({
  conversationId,
  onConversationCreated,
  className,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedClips, setSuggestedClips] = useState<SuggestedClip[]>([]);
  const [selectedForAssembly, setSelectedForAssembly] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleClipSelection = (clipId: string) => {
    setSelectedForAssembly((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const addSelectedToAssembly = () => {
    // Get the selected clips data
    const clipsToAdd = suggestedClips.filter((clip) => selectedForAssembly.has(clip.id));

    // Get existing assembly clips from localStorage
    const existingClips = JSON.parse(localStorage.getItem("assemblyClips") || "[]");

    // Merge, avoiding duplicates
    const existingIds = new Set(existingClips.map((c: SuggestedClip) => c.id));
    const newClips = clipsToAdd.filter((c) => !existingIds.has(c.id));
    const mergedClips = [...existingClips, ...newClips.map((clip) => ({
      id: clip.id,
      thumbnailUrl: clip.thumbnail_url,
      fileUrl: clip.file_url,
      durationSeconds: clip.duration_seconds,
      transcriptSegment: clip.transcript_segment,
    }))];

    // Save to localStorage
    localStorage.setItem("assemblyClips", JSON.stringify(mergedClips));

    // Navigate to assemble page
    router.push("/assemble");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message optimistically
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      clip_ids: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: currentConversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Update conversation ID if new
      if (!currentConversationId && data.conversation_id) {
        setCurrentConversationId(data.conversation_id);
        onConversationCreated?.(data.conversation_id);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.message.id,
        role: "assistant",
        content: data.message.content,
        clip_ids: data.message.clip_ids || [],
        created_at: data.message.created_at,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update suggested clips
      if (data.suggested_clips && data.suggested_clips.length > 0) {
        setSuggestedClips(data.suggested_clips);
      } else if (data.all_relevant_clips && data.all_relevant_clips.length > 0) {
        setSuggestedClips(data.all_relevant_clips.slice(0, 6));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          clip_ids: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="max-w-md">
              Tell me what kind of video you want to create, and I&apos;ll help you find
              and arrange the perfect clips from your library.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">Try asking:</p>
              <ul className="space-y-1 text-left">
                <li>&ldquo;Find clips about product benefits for a YouTube Short&rdquo;</li>
                <li>&ldquo;I need testimonial clips under 15 seconds&rdquo;</li>
                <li>&ldquo;Show me clips that would work as hooks&rdquo;</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested clips */}
      {suggestedClips.length > 0 && (
        <div className="border-t p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span className="text-sm font-medium">Suggested Clips</span>
              {selectedForAssembly.size > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedForAssembly.size} selected
                </Badge>
              )}
            </div>
            {selectedForAssembly.size > 0 && (
              <Button size="sm" onClick={addSelectedToAssembly}>
                <Clapperboard className="h-4 w-4 mr-2" />
                Add to Assembly
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {suggestedClips.slice(0, 8).map((clip) => {
              const isSelected = selectedForAssembly.has(clip.id);
              return (
                <div key={clip.id} className="relative group">
                  <button
                    onClick={() => toggleClipSelection(clip.id)}
                    className={cn(
                      "absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                    )}
                    title={isSelected ? "Remove from selection" : "Add to selection"}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </button>
                  <ClipCard
                    id={clip.id}
                    fileUrl={clip.file_url}
                    thumbnailUrl={clip.thumbnail_url}
                    durationSeconds={clip.duration_seconds}
                    transcriptSegment={clip.transcript_segment}
                    className={cn(
                      "h-full transition-all",
                      isSelected && "ring-2 ring-primary"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you're looking for..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
