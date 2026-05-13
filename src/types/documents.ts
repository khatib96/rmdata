export interface DocumentEntityReference {
  entityType: string;
  entityId?: number | null;
  section?: string | null;
}

export interface DocumentListItem extends DocumentEntityReference {
  id: number;
  relativePath: string;
  customName?: string | null;
  createdAt?: string;
}

export interface DocumentExplorerFolder {
  type: 'folder';
  name: string;
  label: string;
  isDeletable?: boolean;
}

export interface DocumentExplorerFile {
  id: number;
  name: string;
  relativePath: string;
  createdAt: string;
}

export interface DocumentPreview {
  url: string;
  name: string;
  relativePath?: string | null;
}

export type DocumentSection = string | null | undefined;
