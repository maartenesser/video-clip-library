"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceCard, type SourceStatus } from "@/components/source-card";

interface Source {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  status: SourceStatus;
  durationSeconds: number | null;
  creatorName: string | null;
  createdAt: string;
  clipCount: number;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSources = async (pageNum: number, status: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "12",
        orderBy: "created_at",
        orderDirection: "desc",
      });

      if (status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(`/api/sources?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sources");

      const data = await response.json();

      // Transform API response to match our interface
      const transformedSources: Source[] = data.data.map((source: any) => ({
        id: source.id,
        title: source.title,
        thumbnailUrl: null, // API doesn't return this yet
        status: source.status as SourceStatus,
        durationSeconds: source.duration_seconds,
        creatorName: source.creator_name,
        createdAt: source.created_at,
        clipCount: 0, // Would need to be joined from clips
      }));

      if (pageNum === 1) {
        setSources(transformedSources);
      } else {
        setSources((prev) => [...prev, ...transformedSources]);
      }

      setTotalCount(data.count);
      setHasMore(pageNum < data.totalPages);
    } catch (error) {
      console.error("Error fetching sources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchSources(1, statusFilter);
  }, [statusFilter]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSources(nextPage, statusFilter);
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
          <p className="text-muted-foreground">
            {totalCount} source video{totalCount !== 1 ? "s" : ""} in your library
          </p>
        </div>
        <Link href="/upload">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading && sources.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : sources.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                id={source.id}
                title={source.title}
                thumbnailUrl={source.thumbnailUrl}
                status={source.status}
                durationSeconds={source.durationSeconds}
                creatorName={source.creatorName}
                createdAt={source.createdAt}
                clipCount={source.clipCount}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No sources found</CardTitle>
            <CardDescription className="text-center mb-4">
              {statusFilter !== "all"
                ? "No sources match your current filter"
                : "Upload your first video to get started"}
            </CardDescription>
            {statusFilter !== "all" ? (
              <Button variant="outline" onClick={() => setStatusFilter("all")}>
                Clear filter
              </Button>
            ) : (
              <Link href="/upload">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
