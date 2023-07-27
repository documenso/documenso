import { defineDocumentType, makeSource } from 'contentlayer/source-files';

export const BlogPost = defineDocumentType(() => ({
  name: 'BlogPost',
  filePathPattern: `blog/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    date: { type: 'date', required: true },
    tags: { type: 'list', of: { type: 'string' }, required: false, default: [] },
    authorName: { type: 'string', required: true },
    authorImage: { type: 'string', required: false },
    authorRole: { type: 'string', required: true },
  },
  computedFields: {
    href: { type: 'string', resolve: (post) => `/${post._raw.flattenedPath}` },
  },
}));

export const Privacy = defineDocumentType(() => ({
  name: 'Privacy',
  filePathPattern: 'privacy.mdx',
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
  },
  computedFields: {
    href: { type: 'string', resolve: (post) => `/${post._raw.flattenedPath}` },
  },
}));

export default makeSource({ contentDirPath: 'content', documentTypes: [BlogPost, Privacy] });
