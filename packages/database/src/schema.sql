-- Video Clip Library Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Sources table: Uploaded videos
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(50) NOT NULL,
    creator_name VARCHAR(255),
    original_file_url TEXT NOT NULL,
    original_file_key VARCHAR(500) NOT NULL,
    duration_seconds DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips table: Generated clips from sources
CREATE TABLE clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    start_time_seconds DECIMAL(10,3) NOT NULL,
    end_time_seconds DECIMAL(10,3) NOT NULL,
    duration_seconds DECIMAL(10,3) GENERATED ALWAYS AS (end_time_seconds - start_time_seconds) STORED,
    file_url TEXT NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    thumbnail_url TEXT,
    transcript_segment TEXT,
    detection_method VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table: Content type labels
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    is_system BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0
);

-- Clip Tags junction table: Many-to-many relationship
CREATE TABLE clip_tags (
    clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence_score DECIMAL(5,4),
    assigned_by VARCHAR(50) DEFAULT 'ai',
    PRIMARY KEY (clip_id, tag_id)
);

-- Processing Jobs table: Job tracking
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percent INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Sources indexes
CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_created_at ON sources(created_at DESC);
CREATE INDEX idx_sources_source_type ON sources(source_type);

-- Clips indexes
CREATE INDEX idx_clips_source_id ON clips(source_id);
CREATE INDEX idx_clips_created_at ON clips(created_at DESC);
CREATE INDEX idx_clips_detection_method ON clips(detection_method);

-- Tags indexes
CREATE INDEX idx_tags_category ON tags(category);
CREATE INDEX idx_tags_is_system ON tags(is_system);
CREATE INDEX idx_tags_display_order ON tags(display_order);

-- Clip Tags indexes
CREATE INDEX idx_clip_tags_clip_id ON clip_tags(clip_id);
CREATE INDEX idx_clip_tags_tag_id ON clip_tags(tag_id);
CREATE INDEX idx_clip_tags_assigned_by ON clip_tags(assigned_by);

-- Processing Jobs indexes
CREATE INDEX idx_processing_jobs_source_id ON processing_jobs(source_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_job_type ON processing_jobs(job_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sources table
CREATE TRIGGER trigger_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Sources policies
CREATE POLICY "Enable read access for all users" ON sources
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sources
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON sources
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON sources
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clips policies
CREATE POLICY "Enable read access for all users" ON clips
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clips
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clips
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clips
    FOR DELETE USING (auth.role() = 'authenticated');

-- Tags policies
CREATE POLICY "Enable read access for all users" ON tags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON tags
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON tags
    FOR DELETE USING (auth.role() = 'authenticated' AND is_system = false);

-- Clip Tags policies
CREATE POLICY "Enable read access for all users" ON clip_tags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clip_tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clip_tags
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clip_tags
    FOR DELETE USING (auth.role() = 'authenticated');

-- Processing Jobs policies
CREATE POLICY "Enable read access for all users" ON processing_jobs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON processing_jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON processing_jobs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON processing_jobs
    FOR DELETE USING (auth.role() = 'authenticated');
