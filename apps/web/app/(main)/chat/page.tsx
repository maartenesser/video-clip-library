"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ChatInterface } from "@/components/chat-interface";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch("/api/chat");
        if (response.ok) {
          const data = await response.json();
          // Ensure we always set an array
          const conversationList = Array.isArray(data?.data) ? data.data : [];
          setConversations(conversationList);
        } else {
          console.error("Failed to fetch conversations:", response.status);
          setConversations([]);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setConversations([]);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, []);

  const handleNewConversation = () => {
    setActiveConversationId(undefined);
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    // Refresh conversations list
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        const conversationList = Array.isArray(data?.data) ? data.data : [];
        setConversations(conversationList);
      })
      .catch(console.error);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar with conversations */}
      <div
        className={cn(
          "border-r bg-muted/30 transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 border-b">
          <Button
            onClick={handleNewConversation}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {isLoadingConversations ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : !Array.isArray(conversations) || conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  activeConversationId === conversation.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                <div className="font-medium truncate">{conversation.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(conversation.created_at)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold">AI Clip Curator</h1>
          </div>
        </div>

        {/* Chat interface */}
        <ChatInterface
          key={activeConversationId || "new"}
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          className="flex-1"
        />
      </div>
    </div>
  );
}
