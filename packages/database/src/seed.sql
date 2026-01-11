-- Video Clip Library Seed Data
-- Default tags for content categorization

-- Insert default system tags
INSERT INTO tags (name, category, color, is_system, display_order) VALUES
    ('hook', 'content_type', '#FF6B6B', true, 1),
    ('product_benefit', 'content_type', '#4ECDC4', true, 2),
    ('proof', 'content_type', '#45B7D1', true, 3),
    ('testimonial', 'content_type', '#96CEB4', true, 4),
    ('objection_handling', 'content_type', '#FFEAA7', true, 5),
    ('cta', 'content_type', '#DDA0DD', true, 6),
    ('b_roll', 'content_type', '#98D8C8', true, 7)
ON CONFLICT (name) DO NOTHING;
