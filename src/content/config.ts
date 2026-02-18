import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

// Extend docsSchema to support presentation mode and screen preview
const extendedSchema = docsSchema({
  extend: z.object({
    presentation: z.boolean().optional().default(false),
    theme: z.enum(['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized']).optional().default('black'),
    // Screen preview fields
    screen: z.string().optional(),
    screens: z.array(z.object({
      url: z.string(),
      label: z.string().optional(),
    })).optional(),
    figma: z.string().optional(),
    status: z.enum(['draft', 'review', 'confirmed', 'dev', 'done']).optional(),
    version: z.string().optional(),
  }),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: extendedSchema }),
};
