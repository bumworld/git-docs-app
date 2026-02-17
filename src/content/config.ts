import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

// Extend docsSchema to support presentation mode
const extendedSchema = docsSchema({
  extend: z.object({
    presentation: z.boolean().optional().default(false),
    theme: z.enum(['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized']).optional().default('black'),
  }),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: extendedSchema }),
};
