-- Local development policies for enhanced features
-- Allow anonymous access for local development

-- Drop restrictive policies for new tables
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clip_quality;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clip_quality;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clip_quality;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clip_groups;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clip_groups;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clip_groups;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clip_group_members;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clip_group_members;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clip_group_members;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clip_embeddings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clip_embeddings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clip_embeddings;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON chat_conversations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON chat_conversations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON chat_conversations;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON chat_messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON chat_messages;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON chat_messages;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON assembled_videos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON assembled_videos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON assembled_videos;

-- Clip quality - allow all operations
CREATE POLICY "Enable insert for all users" ON clip_quality
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clip_quality
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clip_quality
    FOR DELETE USING (true);

-- Clip groups - allow all operations
CREATE POLICY "Enable insert for all users" ON clip_groups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clip_groups
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clip_groups
    FOR DELETE USING (true);

-- Clip group members - allow all operations
CREATE POLICY "Enable insert for all users" ON clip_group_members
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clip_group_members
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clip_group_members
    FOR DELETE USING (true);

-- Clip embeddings - allow all operations
CREATE POLICY "Enable insert for all users" ON clip_embeddings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clip_embeddings
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clip_embeddings
    FOR DELETE USING (true);

-- Chat conversations - allow all operations
CREATE POLICY "Enable insert for all users" ON chat_conversations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON chat_conversations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON chat_conversations
    FOR DELETE USING (true);

-- Chat messages - allow all operations
CREATE POLICY "Enable insert for all users" ON chat_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON chat_messages
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON chat_messages
    FOR DELETE USING (true);

-- Assembled videos - allow all operations
CREATE POLICY "Enable insert for all users" ON assembled_videos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON assembled_videos
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON assembled_videos
    FOR DELETE USING (true);
