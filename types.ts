
export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface ThumbnailSet {
  id: string;
  small?: Thumbnail;
  medium?: Thumbnail;
  large?: Thumbnail;
}

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount?: number;
  };
  '@microsoft.graph.downloadUrl'?: string;
  thumbnails?: ThumbnailSet[];
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}