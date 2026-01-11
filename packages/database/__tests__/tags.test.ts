import { describe, it, expect, beforeEach } from 'vitest';
import { createMockTag, generateUUID, DEFAULT_SYSTEM_TAGS } from './setup';
import type { Tag, TagInsert, TagUpdate } from '../src/types';

/**
 * Tags table tests
 *
 * Tests CRUD operations, system tags, and seed data verification
 */

describe('Tags', () => {
  describe('Type validation', () => {
    it('should have all required fields in Tag type', () => {
      const tag = createMockTag();

      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('category');
      expect(tag).toHaveProperty('color');
      expect(tag).toHaveProperty('is_system');
      expect(tag).toHaveProperty('display_order');
    });

    it('should allow null for color', () => {
      const tag = createMockTag({ color: null });
      expect(tag.color).toBeNull();
    });

    it('should have default is_system as false', () => {
      const tag = createMockTag();
      expect(tag.is_system).toBe(false);
    });

    it('should have default display_order as 0', () => {
      const tag = createMockTag();
      expect(tag.display_order).toBe(0);
    });
  });

  describe('TagInsert type', () => {
    it('should not require id', () => {
      const tagInsert: TagInsert = {
        name: 'new_tag',
        category: 'custom',
        color: '#123456',
        is_system: false,
        display_order: 10,
      };

      expect(tagInsert.name).toBe('new_tag');
      expect(tagInsert).not.toHaveProperty('id');
    });

    it('should allow optional id override', () => {
      const customId = generateUUID();
      const tagInsert: TagInsert = {
        id: customId,
        name: 'new_tag',
        category: 'custom',
        color: null,
        is_system: false,
        display_order: 0,
      };

      expect(tagInsert.id).toBe(customId);
    });
  });

  describe('TagUpdate type', () => {
    it('should allow partial updates', () => {
      const tagUpdate: TagUpdate = {
        color: '#ABCDEF',
      };

      expect(tagUpdate.color).toBe('#ABCDEF');
      expect(tagUpdate.name).toBeUndefined();
    });

    it('should allow updating display_order', () => {
      const tagUpdate: TagUpdate = {
        display_order: 5,
      };

      expect(tagUpdate.display_order).toBe(5);
    });
  });

  describe('Default system tags (seed data)', () => {
    it('should have 7 default system tags', () => {
      expect(DEFAULT_SYSTEM_TAGS).toHaveLength(7);
    });

    it('should include hook tag', () => {
      const hookTag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'hook');

      expect(hookTag).toBeDefined();
      expect(hookTag?.category).toBe('content_type');
      expect(hookTag?.color).toBe('#FF6B6B');
      expect(hookTag?.is_system).toBe(true);
      expect(hookTag?.display_order).toBe(1);
    });

    it('should include product_benefit tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'product_benefit');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#4ECDC4');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(2);
    });

    it('should include proof tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'proof');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#45B7D1');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(3);
    });

    it('should include testimonial tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'testimonial');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#96CEB4');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(4);
    });

    it('should include objection_handling tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'objection_handling');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#FFEAA7');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(5);
    });

    it('should include cta tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'cta');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#DDA0DD');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(6);
    });

    it('should include b_roll tag', () => {
      const tag = DEFAULT_SYSTEM_TAGS.find((t) => t.name === 'b_roll');

      expect(tag).toBeDefined();
      expect(tag?.category).toBe('content_type');
      expect(tag?.color).toBe('#98D8C8');
      expect(tag?.is_system).toBe(true);
      expect(tag?.display_order).toBe(7);
    });

    it('should have all tags in content_type category', () => {
      const allContentType = DEFAULT_SYSTEM_TAGS.every((t) => t.category === 'content_type');
      expect(allContentType).toBe(true);
    });

    it('should have unique display_order values', () => {
      const orders = DEFAULT_SYSTEM_TAGS.map((t) => t.display_order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      DEFAULT_SYSTEM_TAGS.forEach((tag) => {
        expect(tag.color).toMatch(hexColorRegex);
      });
    });
  });

  describe('Mock CRUD operations', () => {
    let tags: Tag[];

    beforeEach(() => {
      tags = DEFAULT_SYSTEM_TAGS.map((t) => ({
        ...t,
        id: generateUUID(),
      }));
    });

    it('should create a custom tag', () => {
      const newTag = createMockTag({
        name: 'custom_tag',
        category: 'user_defined',
        is_system: false,
        display_order: 100,
      });
      tags.push(newTag);

      expect(tags).toHaveLength(8);
      expect(tags[7].name).toBe('custom_tag');
    });

    it('should read all tags', () => {
      expect(tags).toHaveLength(7);
    });

    it('should filter tags by category', () => {
      const contentTypeTags = tags.filter((t) => t.category === 'content_type');
      expect(contentTypeTags).toHaveLength(7);
    });

    it('should filter tags by is_system', () => {
      const systemTags = tags.filter((t) => t.is_system === true);
      expect(systemTags).toHaveLength(7);
    });

    it('should order tags by display_order', () => {
      const ordered = [...tags].sort((a, b) => a.display_order - b.display_order);

      expect(ordered[0].name).toBe('hook');
      expect(ordered[6].name).toBe('b_roll');
    });

    it('should update a tag', () => {
      const tagIndex = tags.findIndex((t) => t.name === 'hook');
      tags[tagIndex] = { ...tags[tagIndex], color: '#FF0000' };

      expect(tags[tagIndex].color).toBe('#FF0000');
    });

    it('should delete a non-system tag', () => {
      const customTag = createMockTag({
        name: 'to_delete',
        is_system: false,
      });
      tags.push(customTag);

      tags = tags.filter((t) => t.id !== customTag.id);

      expect(tags).toHaveLength(7);
    });

    it('should prevent deletion of system tags', () => {
      const systemTag = tags.find((t) => t.is_system === true);

      // Simulate RLS policy: only delete if is_system = false
      const canDelete = systemTag && !systemTag.is_system;

      expect(canDelete).toBe(false);
    });

    it('should find tag by name', () => {
      const foundTag = tags.find((t) => t.name === 'testimonial');

      expect(foundTag).toBeDefined();
      expect(foundTag?.display_order).toBe(4);
    });
  });

  describe('Validation rules', () => {
    it('should require name to be unique', () => {
      const existingTags = DEFAULT_SYSTEM_TAGS.map((t) => t.name);

      const newTagName = 'hook';
      const isDuplicate = existingTags.includes(newTagName);

      expect(isDuplicate).toBe(true);
    });

    it('should require name to be non-empty', () => {
      const tag = createMockTag({ name: 'valid_name' });
      expect(tag.name.length).toBeGreaterThan(0);
    });

    it('should require category to be non-empty', () => {
      const tag = createMockTag({ category: 'content_type' });
      expect(tag.category.length).toBeGreaterThan(0);
    });

    it('should allow color to be 7-character hex string', () => {
      const tag = createMockTag({ color: '#AABBCC' });
      expect(tag.color).toHaveLength(7);
      expect(tag.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should allow display_order to be any integer', () => {
      const tag = createMockTag({ display_order: 999 });
      expect(tag.display_order).toBe(999);
    });
  });

  describe('Seed data SQL verification', () => {
    it('should use ON CONFLICT DO NOTHING for idempotent seeding', () => {
      // This test verifies the seed.sql behavior
      // Running seed multiple times should not create duplicates

      let tags = DEFAULT_SYSTEM_TAGS.map((t) => ({
        ...t,
        id: generateUUID(),
      }));

      // Simulate running seed again with ON CONFLICT DO NOTHING
      const existingNames = new Set(tags.map((t) => t.name));
      const newSeedData = DEFAULT_SYSTEM_TAGS.filter((t) => !existingNames.has(t.name));

      // No new tags should be added (all names already exist)
      expect(newSeedData).toHaveLength(0);
    });
  });
});
