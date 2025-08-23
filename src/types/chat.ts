export type Attachment = {
  url: string;
  publicId: string;
  resourceType: 'image'|'video'|'raw'|'auto';
  width?: number|null;
  height?: number|null;
  bytes?: number;
  format?: string|null;
  originalFilename?: string|null;
  provider?: 'cloudinary';
};
