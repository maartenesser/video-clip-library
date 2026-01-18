-- Local development policies
-- Allow anonymous access for local development
-- In production, use the authenticated policies from the initial schema

-- Drop restrictive policies and replace with permissive ones for local dev
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sources;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON sources;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON sources;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clips;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clips;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clips;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tags;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON tags;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON tags;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clip_tags;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clip_tags;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clip_tags;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON processing_jobs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON processing_jobs;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON processing_jobs;

-- Sources - allow all operations
CREATE POLICY "Enable insert for all users" ON sources
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON sources
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON sources
    FOR DELETE USING (true);

-- Clips - allow all operations
CREATE POLICY "Enable insert for all users" ON clips
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clips
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clips
    FOR DELETE USING (true);

-- Tags - allow all operations
CREATE POLICY "Enable insert for all users" ON tags
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON tags
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON tags
    FOR DELETE USING (true);

-- Clip Tags - allow all operations
CREATE POLICY "Enable insert for all users" ON clip_tags
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON clip_tags
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON clip_tags
    FOR DELETE USING (true);

-- Processing Jobs - allow all operations
CREATE POLICY "Enable insert for all users" ON processing_jobs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON processing_jobs
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON processing_jobs
    FOR DELETE USING (true);
