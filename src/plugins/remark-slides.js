import { visit } from 'unist-util-visit';

/**
 * Remark plugin to prepare markdown for reveal.js presentations
 * Splits content by thematic breaks (---) and wraps each section in slide divs
 * Adds data attributes for client-side JavaScript to detect and transform
 */
export function remarkSlides() {
  return (tree, file) => {
    // Check if this file has presentation mode enabled
    const frontmatter = file.data?.astro?.frontmatter;
    if (!frontmatter?.presentation) {
      return; // Skip if not a presentation
    }

    const theme = frontmatter.theme || 'black';
    const slides = [];
    let currentSlide = [];

    // Process the tree and split by thematic breaks
    tree.children.forEach((node) => {
      if (node.type === 'thematicBreak') {
        // Start a new slide
        if (currentSlide.length > 0) {
          slides.push(currentSlide);
          currentSlide = [];
        }
      } else {
        currentSlide.push(node);
      }
    });

    // Push the last slide
    if (currentSlide.length > 0) {
      slides.push(currentSlide);
    }

    // If no thematic breaks found, treat entire content as one slide
    if (slides.length === 0) {
      slides.push(tree.children);
    }

    // Add presentation marker at the start
    const newChildren = [
      {
        type: 'html',
        value: `<div data-presentation="true" data-theme="${theme}" style="display: none;"></div>`,
      },
    ];

    // Wrap each slide in a section with data-slide attribute
    slides.forEach((slideContent, index) => {
      newChildren.push({
        type: 'html',
        value: `<section data-slide="${index}">`,
      });
      newChildren.push(...slideContent);
      newChildren.push({
        type: 'html',
        value: '</section>',
      });
    });

    tree.children = newChildren;
  };
}
