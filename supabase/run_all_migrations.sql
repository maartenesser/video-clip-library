-- ============================================================================
-- VIDEO CLIP LIBRARY - COMBINED MIGRATIONS
-- Run this entire file in the Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: INITIAL SCHEMA
-- ============================================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sources table: Uploaded videos
CREATE TABLE IF NOT EXISTS sources (
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
CREATE TABLE IF NOT EXISTS clips (
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
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    is_system BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0
);

-- Clip Tags junction table
CREATE TABLE IF NOT EXISTS clip_tags (
    clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence_score DECIMAL(5,4),
    assigned_by VARCHAR(50) DEFAULT 'ai',
    PRIMARY KEY (clip_id, tag_id)
);

-- Processing Jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percent INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources indexes
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_created_at ON sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_source_type ON sources(source_type);

-- Clips indexes
CREATE INDEX IF NOT EXISTS idx_clips_source_id ON clips(source_id);
CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_detection_method ON clips(detection_method);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tags_is_system ON tags(is_system);
CREATE INDEX IF NOT EXISTS idx_tags_display_order ON tags(display_order);

-- Clip Tags indexes
CREATE INDEX IF NOT EXISTS idx_clip_tags_clip_id ON clip_tags(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_tags_tag_id ON clip_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_clip_tags_assigned_by ON clip_tags(assigned_by);

-- Processing Jobs indexes
CREATE INDEX IF NOT EXISTS idx_processing_jobs_source_id ON processing_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON processing_jobs(job_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sources table
DROP TRIGGER IF EXISTS trigger_sources_updated_at ON sources;
CREATE TRIGGER trigger_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRATION 2: QUALITY AND GROUPS (Enhanced Features)
-- ============================================================================

-- Enable pgvector for semantic search embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Clip quality scores
CREATE TABLE IF NOT EXISTS clip_quality (
    clip_id UUID PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    speaking_quality_score DECIMAL(3,2) CHECK (speaking_quality_score BETWEEN 1.0 AND 5.0),
    audio_quality_score DECIMAL(3,2) CHECK (audio_quality_score BETWEEN 1.0 AND 5.0),
    overall_quality_score DECIMAL(3,2) CHECK (overall_quality_score BETWEEN 1.0 AND 5.0),
    trimmed_start_seconds DECIMAL(10,3) DEFAULT 0,
    trimmed_end_seconds DECIMAL(10,3) DEFAULT 0,
    hesitation_count INT DEFAULT 0,
    filler_word_count INT DEFAULT 0,
    words_per_minute DECIMAL(6,2),
    quality_metadata JSONB,
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clip groups (duplicates, same topic, multiple takes)
CREATE TABLE IF NOT EXISTS clip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    group_type VARCHAR(50) NOT NULL CHECK (group_type IN ('duplicate', 'same_topic', 'multiple_takes')),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    representative_clip_id UUID REFERENCES clips(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clip group members
CREATE TABLE IF NOT EXISTS clip_group_members (
    clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
    group_id UUID REFERENCES clip_groups(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4),
    is_representative BOOLEAN DEFAULT false,
    PRIMARY KEY (clip_id, group_id)
);

-- Transcript embeddings for semantic search
CREATE TABLE IF NOT EXISTS clip_embeddings (
    clip_id UUID PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    embedding vector(384),
    model_name VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    clip_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assembled videos (exports)
CREATE TABLE IF NOT EXISTS assembled_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    clip_ids UUID[] NOT NULL,
    file_url TEXT,
    file_key VARCHAR(500),
    duration_seconds DECIMAL(10,3),
    subtitle_style JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality indexes
CREATE INDEX IF NOT EXISTS idx_clip_quality_overall_score ON clip_quality(overall_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_clip_quality_speaking_score ON clip_quality(speaking_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_clip_quality_audio_score ON clip_quality(audio_quality_score DESC);

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_clip_groups_source_id ON clip_groups(source_id);
CREATE INDEX IF NOT EXISTS idx_clip_groups_group_type ON clip_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_clip_groups_created_at ON clip_groups(created_at DESC);

-- Group members indexes
CREATE INDEX IF NOT EXISTS idx_clip_group_members_clip_id ON clip_group_members(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_group_members_group_id ON clip_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_clip_group_members_is_representative ON clip_group_members(is_representative) WHERE is_representative = true;

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Assembled videos indexes
CREATE INDEX IF NOT EXISTS idx_assembled_videos_user_id ON assembled_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_assembled_videos_status ON assembled_videos(status);
CREATE INDEX IF NOT EXISTS idx_assembled_videos_created_at ON assembled_videos(created_at DESC);

-- Triggers for new tables
DROP TRIGGER IF EXISTS trigger_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER trigger_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_assembled_videos_updated_at ON assembled_videos;
CREATE TRIGGER trigger_assembled_videos_updated_at
    BEFORE UPDATE ON assembled_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE clip_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembled_videos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEMANTIC SEARCH FUNCTIONS
-- ============================================================================

-- Function to search clips by semantic similarity
CREATE OR REPLACE FUNCTION search_clips_by_embedding(
    query_embedding vector(384),
    match_threshold DECIMAL DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    clip_id UUID,
    similarity DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.clip_id,
        (1 - (ce.embedding <=> query_embedding))::DECIMAL as similarity
    FROM clip_embeddings ce
    WHERE (1 - (ce.embedding <=> query_embedding)) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get clips with quality above threshold
CREATE OR REPLACE FUNCTION get_high_quality_clips(
    min_quality DECIMAL DEFAULT 3.5,
    source_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    clip_id UUID,
    source_id UUID,
    overall_quality DECIMAL,
    speaking_quality DECIMAL,
    audio_quality DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as clip_id,
        c.source_id,
        cq.overall_quality_score as overall_quality,
        cq.speaking_quality_score as speaking_quality,
        cq.audio_quality_score as audio_quality
    FROM clips c
    JOIN clip_quality cq ON c.id = cq.clip_id
    WHERE cq.overall_quality_score >= min_quality
    AND (source_filter IS NULL OR c.source_id = source_filter)
    ORDER BY cq.overall_quality_score DESC;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (Permissive for Development)
-- ============================================================================

-- Sources policies
DROP POLICY IF EXISTS "Enable read access for all users" ON sources;
DROP POLICY IF EXISTS "Enable insert for all users" ON sources;
DROP POLICY IF EXISTS "Enable update for all users" ON sources;
DROP POLICY IF EXISTS "Enable delete for all users" ON sources;

CREATE POLICY "Enable read access for all users" ON sources FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON sources FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON sources FOR DELETE USING (true);

-- Clips policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clips;
DROP POLICY IF EXISTS "Enable insert for all users" ON clips;
DROP POLICY IF EXISTS "Enable update for all users" ON clips;
DROP POLICY IF EXISTS "Enable delete for all users" ON clips;

CREATE POLICY "Enable read access for all users" ON clips FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clips FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clips FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clips FOR DELETE USING (true);

-- Tags policies
DROP POLICY IF EXISTS "Enable read access for all users" ON tags;
DROP POLICY IF EXISTS "Enable insert for all users" ON tags;
DROP POLICY IF EXISTS "Enable update for all users" ON tags;
DROP POLICY IF EXISTS "Enable delete for all users" ON tags;

CREATE POLICY "Enable read access for all users" ON tags FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON tags FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON tags FOR DELETE USING (true);

-- Clip tags policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clip_tags;
DROP POLICY IF EXISTS "Enable insert for all users" ON clip_tags;
DROP POLICY IF EXISTS "Enable update for all users" ON clip_tags;
DROP POLICY IF EXISTS "Enable delete for all users" ON clip_tags;

CREATE POLICY "Enable read access for all users" ON clip_tags FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clip_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clip_tags FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clip_tags FOR DELETE USING (true);

-- Processing jobs policies
DROP POLICY IF EXISTS "Enable read access for all users" ON processing_jobs;
DROP POLICY IF EXISTS "Enable insert for all users" ON processing_jobs;
DROP POLICY IF EXISTS "Enable update for all users" ON processing_jobs;
DROP POLICY IF EXISTS "Enable delete for all users" ON processing_jobs;

CREATE POLICY "Enable read access for all users" ON processing_jobs FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON processing_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON processing_jobs FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON processing_jobs FOR DELETE USING (true);

-- Clip quality policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clip_quality;
DROP POLICY IF EXISTS "Enable insert for all users" ON clip_quality;
DROP POLICY IF EXISTS "Enable update for all users" ON clip_quality;
DROP POLICY IF EXISTS "Enable delete for all users" ON clip_quality;

CREATE POLICY "Enable read access for all users" ON clip_quality FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clip_quality FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clip_quality FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clip_quality FOR DELETE USING (true);

-- Clip groups policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clip_groups;
DROP POLICY IF EXISTS "Enable insert for all users" ON clip_groups;
DROP POLICY IF EXISTS "Enable update for all users" ON clip_groups;
DROP POLICY IF EXISTS "Enable delete for all users" ON clip_groups;

CREATE POLICY "Enable read access for all users" ON clip_groups FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clip_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clip_groups FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clip_groups FOR DELETE USING (true);

-- Clip group members policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clip_group_members;
DROP POLICY IF EXISTS "Enable insert for all users" ON clip_group_members;
DROP POLICY IF EXISTS "Enable update for all users" ON clip_group_members;
DROP POLICY IF EXISTS "Enable delete for all users" ON clip_group_members;

CREATE POLICY "Enable read access for all users" ON clip_group_members FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clip_group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clip_group_members FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clip_group_members FOR DELETE USING (true);

-- Clip embeddings policies
DROP POLICY IF EXISTS "Enable read access for all users" ON clip_embeddings;
DROP POLICY IF EXISTS "Enable insert for all users" ON clip_embeddings;
DROP POLICY IF EXISTS "Enable update for all users" ON clip_embeddings;
DROP POLICY IF EXISTS "Enable delete for all users" ON clip_embeddings;

CREATE POLICY "Enable read access for all users" ON clip_embeddings FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clip_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clip_embeddings FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clip_embeddings FOR DELETE USING (true);

-- Chat conversations policies
DROP POLICY IF EXISTS "Enable read access for all users" ON chat_conversations;
DROP POLICY IF EXISTS "Enable insert for all users" ON chat_conversations;
DROP POLICY IF EXISTS "Enable update for all users" ON chat_conversations;
DROP POLICY IF EXISTS "Enable delete for all users" ON chat_conversations;

CREATE POLICY "Enable read access for all users" ON chat_conversations FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON chat_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON chat_conversations FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON chat_conversations FOR DELETE USING (true);

-- Chat messages policies
DROP POLICY IF EXISTS "Enable read access for all users" ON chat_messages;
DROP POLICY IF EXISTS "Enable insert for all users" ON chat_messages;
DROP POLICY IF EXISTS "Enable update for all users" ON chat_messages;
DROP POLICY IF EXISTS "Enable delete for all users" ON chat_messages;

CREATE POLICY "Enable read access for all users" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON chat_messages FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON chat_messages FOR DELETE USING (true);

-- Assembled videos policies
DROP POLICY IF EXISTS "Enable read access for all users" ON assembled_videos;
DROP POLICY IF EXISTS "Enable insert for all users" ON assembled_videos;
DROP POLICY IF EXISTS "Enable update for all users" ON assembled_videos;
DROP POLICY IF EXISTS "Enable delete for all users" ON assembled_videos;

CREATE POLICY "Enable read access for all users" ON assembled_videos FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON assembled_videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON assembled_videos FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON assembled_videos FOR DELETE USING (true);

-- ============================================================================
-- CREATE VECTOR INDEX (Run after first data is loaded)
-- ============================================================================
-- Note: This index needs data to be created properly
-- Run this command after you have some embeddings in the table:
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON clip_embeddings
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'All migrations completed successfully!' as status;
