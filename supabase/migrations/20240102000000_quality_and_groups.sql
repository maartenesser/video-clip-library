-- Video Clip Library - Enhanced Features Migration
-- Adds: clip quality, groups, embeddings, chat, and assembly tables

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable pgvector for semantic search embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Clip quality scores
CREATE TABLE clip_quality (
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

-- 2. Clip groups (duplicates, same topic, multiple takes)
CREATE TABLE clip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    group_type VARCHAR(50) NOT NULL CHECK (group_type IN ('duplicate', 'same_topic', 'multiple_takes')),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    representative_clip_id UUID REFERENCES clips(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clip group members (junction table)
CREATE TABLE clip_group_members (
    clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
    group_id UUID REFERENCES clip_groups(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4),
    is_representative BOOLEAN DEFAULT false,
    PRIMARY KEY (clip_id, group_id)
);

-- 4. Transcript embeddings for semantic search (384 dimensions for all-MiniLM-L6-v2)
CREATE TABLE clip_embeddings (
    clip_id UUID PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    embedding vector(384),
    model_name VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI chat conversations
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- NULL until auth is added, will reference auth.users(id)
    title VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    clip_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Assembled videos (exports)
CREATE TABLE assembled_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- NULL until auth is added
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

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Clip quality indexes
CREATE INDEX idx_clip_quality_overall_score ON clip_quality(overall_quality_score DESC);
CREATE INDEX idx_clip_quality_speaking_score ON clip_quality(speaking_quality_score DESC);
CREATE INDEX idx_clip_quality_audio_score ON clip_quality(audio_quality_score DESC);

-- Clip groups indexes
CREATE INDEX idx_clip_groups_source_id ON clip_groups(source_id);
CREATE INDEX idx_clip_groups_group_type ON clip_groups(group_type);
CREATE INDEX idx_clip_groups_created_at ON clip_groups(created_at DESC);

-- Clip group members indexes
CREATE INDEX idx_clip_group_members_clip_id ON clip_group_members(clip_id);
CREATE INDEX idx_clip_group_members_group_id ON clip_group_members(group_id);
CREATE INDEX idx_clip_group_members_is_representative ON clip_group_members(is_representative) WHERE is_representative = true;

-- Clip embeddings indexes (IVFFlat for approximate nearest neighbor search)
-- Note: Build index after data is loaded for better performance
CREATE INDEX idx_embeddings_vector ON clip_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Chat conversations indexes
CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_created_at ON chat_conversations(created_at DESC);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Assembled videos indexes
CREATE INDEX idx_assembled_videos_user_id ON assembled_videos(user_id);
CREATE INDEX idx_assembled_videos_status ON assembled_videos(status);
CREATE INDEX idx_assembled_videos_created_at ON assembled_videos(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at for chat_conversations
CREATE TRIGGER trigger_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at for assembled_videos
CREATE TRIGGER trigger_assembled_videos_updated_at
    BEFORE UPDATE ON assembled_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
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
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE clip_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembled_videos ENABLE ROW LEVEL SECURITY;

-- Clip quality policies
CREATE POLICY "Enable read access for all users" ON clip_quality
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clip_quality
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clip_quality
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clip_quality
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clip groups policies
CREATE POLICY "Enable read access for all users" ON clip_groups
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clip_groups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clip_groups
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clip_groups
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clip group members policies
CREATE POLICY "Enable read access for all users" ON clip_group_members
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clip_group_members
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clip_group_members
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clip_group_members
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clip embeddings policies
CREATE POLICY "Enable read access for all users" ON clip_embeddings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON clip_embeddings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON clip_embeddings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON clip_embeddings
    FOR DELETE USING (auth.role() = 'authenticated');

-- Chat conversations policies (user-specific when auth is added)
CREATE POLICY "Enable read access for all users" ON chat_conversations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON chat_conversations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON chat_conversations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON chat_conversations
    FOR DELETE USING (auth.role() = 'authenticated');

-- Chat messages policies
CREATE POLICY "Enable read access for all users" ON chat_messages
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON chat_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON chat_messages
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON chat_messages
    FOR DELETE USING (auth.role() = 'authenticated');

-- Assembled videos policies
CREATE POLICY "Enable read access for all users" ON assembled_videos
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON assembled_videos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON assembled_videos
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON assembled_videos
    FOR DELETE USING (auth.role() = 'authenticated');
