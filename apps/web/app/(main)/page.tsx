import Link from "next/link";
import { Video, Film, Upload, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceCard, type SourceStatus } from "@/components/source-card";

interface RecentSource {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  status: SourceStatus;
  durationSeconds: number | null;
  creatorName: string | null;
  createdAt: string;
  clipCount: number;
}

// Fetch stats from the database
async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Fetch sources and clips to calculate stats
    const [sourcesRes, clipsRes] = await Promise.all([
      fetch(`${baseUrl}/api/sources?limit=1000`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/clips?limit=1`, { cache: 'no-store' }),
    ]);

    const sourcesData = sourcesRes.ok ? await sourcesRes.json() : { data: [], count: 0 };
    const clipsData = clipsRes.ok ? await clipsRes.json() : { count: 0 };

    const sources = sourcesData.data || [];
    const processingCount = sources.filter((s: any) => s.status === 'processing').length;
    const completedCount = sources.filter((s: any) => s.status === 'completed').length;

    return {
      totalSources: sourcesData.count || 0,
      totalClips: clipsData.count || 0,
      processingCount,
      completedCount,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalSources: 0,
      totalClips: 0,
      processingCount: 0,
      completedCount: 0,
    };
  }
}

async function getRecentSources(): Promise<RecentSource[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/sources?limit=6&orderBy=created_at&orderDirection=desc`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.data || []).map((source: Record<string, unknown>): RecentSource => ({
      id: source.id as string,
      title: source.title as string,
      thumbnailUrl: source.original_file_url ? `/api/media/${source.original_file_key}` : null,
      status: source.status as SourceStatus,
      durationSeconds: source.duration_seconds as number | null,
      creatorName: source.creator_name as string | null,
      createdAt: source.created_at as string,
      clipCount: (source.clip_count as number) || 0,
    }));
  } catch (error) {
    console.error('Error fetching recent sources:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const stats = await getStats();
  const recentSources = await getRecentSources();

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your video clip library
          </p>
        </div>
        <Link href="/upload">
          <Button size="lg" className="gap-2">
            <Upload className="h-5 w-5" />
            Upload Video
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSources}</div>
            <p className="text-xs text-muted-foreground">
              Videos uploaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clips</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClips}</div>
            <p className="text-xs text-muted-foreground">
              Generated clips
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processingCount}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedCount}</div>
            <p className="text-xs text-muted-foreground">
              Ready for use
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Sources</h2>
          <Link href="/sources">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>

        {recentSources.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentSources.map((source) => (
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
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">No sources yet</CardTitle>
              <CardDescription className="text-center mb-4">
                Upload your first video to get started with clip generation
              </CardDescription>
              <Link href="/upload">
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/upload" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Upload className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Upload Video</CardTitle>
              <CardDescription>
                Upload a new video for processing and clip generation
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/sources" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Video className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Browse Sources</CardTitle>
              <CardDescription>
                View and manage all your uploaded source videos
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/clips" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Film className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Clip Library</CardTitle>
              <CardDescription>
                Search and filter through your generated video clips
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
