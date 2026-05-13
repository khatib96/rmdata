# Document Domain Contract

## Overview

The Documents domain is a polymorphic file registry layered on top of filesystem storage.

Current runtime contract:

- The physical file is stored under the documents root using `relativePath`.
- The database row in `documents` is the source of truth for metadata and relationships.
- Entity linkage is polymorphic and must remain behavior-identical:
  - `entityType`
  - `entityId`
  - `section`
- Archive behavior is document-local and must remain unchanged:
  - active documents use `isArchived = 0` or `NULL`
  - archived documents use `isArchived = 1`

## Scope

This contract reflects the current runtime behavior used by:

- `src/pages/Documents.tsx`
- `src/pages/Archive.tsx`
- `electron/main.ts` document IPC handlers
- entity-specific viewers that consume `document:list` / `document:get-url` / `document:open-external`

## Sensitivity Summary

High sensitivity areas:

- `document:save` archive-offload behavior for same `entityType/entityId/section`
- explorer folder semantics derived from hardcoded roots and section labels
- filesystem path handling through `relativePath`
- archive explorer behavior based on `isArchived = 1`
- preview fallback behavior where unsupported inline types open externally

Low-risk maintenance areas:

- shared front-end document types
- pure file-name and extension helpers
- centralized preview modal rendering
- shared name formatting and path normalization helpers

## Current Runtime Contracts

### `document:list`

Current active query shape:

```sql
SELECT id, relativePath, customName, entityType, entityId, section, createdAt
FROM documents
WHERE (isArchived = 0 OR isArchived IS NULL)
```

Behavior:

- Optional filters are appended for `entityType`, `entityId`, and `section`
- Results are ordered by `createdAt DESC`
- Used by entity-specific profile pages and document tabs

Returned front-end shape:

```ts
interface DocumentListItem {
  id: number;
  relativePath: string;
  customName?: string | null;
  entityType: string;
  entityId?: number | null;
  section?: string | null;
  createdAt?: string;
}
```

### `document:get-url`

Behavior:

- Resolves `relativePath` against the documents root
- Returns a base64 data URL for previewable formats
- Returns `canPreview: false` and `url: null` for non-previewable formats
- Does not change any archive or relation state

Returned shape:

```ts
{
  success: boolean;
  url?: string | null;
  canPreview?: boolean;
  fullPath?: string;
  error?: string;
}
```

### `document:open-external`

Behavior:

- Opens the physical file using the OS default application
- Accepts only `relativePath`
- Used as the fallback path when inline preview is unsupported or empty

### `Documents.tsx`

Current page contract:

- Uses `document:list-explorer`
- Root explorer uses fixed top-level folders:
  - `Branches`
  - `Employees`
  - `Housing`
  - `Phones`
  - `Vehicles`
  - `Taxes`
- Manual filesystem folders are allowed and may be deletable
- Preview flow:
  1. call `document:get-url`
  2. if `canPreview === false` or `url` is empty, call `document:open-external`
  3. otherwise render inline preview
- Upload flow preserves current semantics for:
  - `entityType = branch` on branch section path
  - `entityType = entity` on tax section path
  - `entityType = housing` on housing path
  - `entityType = company` on manual/company paths

Explorer file shape:

```ts
interface DocumentExplorerFile {
  id: number;
  name: string;
  relativePath: string;
  createdAt: string;
}
```

### `Archive.tsx`

Current archive explorer contract:

- Archived document browsing is isolated under the `documents` tab inside Archive
- Uses `document:list-archive-explorer`
- Archive preview uses the same open-or-preview flow as active documents
- Restore/archive flows for non-document entities must remain untouched by document cleanup

### Entity-Specific Viewers

Observed consumers:

- employees
- branches
- entities
- phones
- employers

Current behavioral assumptions:

- `customName || basename(relativePath)` is treated as the display name
- `relativePath` is the only stable key for preview/open-external
- image extensions are previewed as `<img>`
- everything else is rendered in `<webview>` when a preview URL exists

## Shared Type Proposal

```ts
interface DocumentEntityReference {
  entityType: string;
  entityId?: number | null;
  section?: string | null;
}

interface DocumentListItem extends DocumentEntityReference {
  id: number;
  relativePath: string;
  customName?: string | null;
  createdAt?: string;
}

interface DocumentExplorerFolder {
  type: 'folder';
  name: string;
  label: string;
  isDeletable?: boolean;
}

interface DocumentExplorerFile {
  id: number;
  name: string;
  relativePath: string;
  createdAt: string;
}

interface DocumentPreview {
  url: string;
  name: string;
  relativePath?: string | null;
}

type DocumentSection = string | null | undefined;
```

## Safe Helper Extraction Candidates

Pure helpers that are safe to share:

- `normalizeDocumentPath(path)`
- `getDocumentBaseName(relativePath)`
- `getDocumentDisplayName(customName, relativePath)`
- `getDocumentExtension(fileName)`
- `isImageDocumentName(fileName)`
- `isPdfDocumentName(fileName)`
- `isImagePreviewSource(fileName, previewUrl)`
- `sanitizeDocumentCustomName(name)`
- `buildSavedDocumentFileName(sourcePath, customName)`

UI extraction candidate with low risk:

- shared `DocumentPreviewModal` used by active/archive/entity viewers

## Risk Map

### Safe To Touch

- front-end shared types for document rows and preview state
- pure name/path/extension helpers
- duplicated preview modal markup
- repeated icon classification logic

### Risky

- explorer root and section label mapping
- path-based inference of `entityType/entityId/section`
- tax and housing explorer path rules
- any change to how `relativePath` is constructed

### Do Not Touch

- `document:save` offload-to-archive semantics
- `entityType` meanings
- `isArchived` semantics
- restore/archive flows in `Archive.tsx`
- delete/archive business rules for entities outside the document domain

## Behavioral Invariants

- `entityType` values must remain exactly as currently consumed
- `entityId` remains optional for non-entity-root/manual paths
- `section` remains optional and path-dependent
- archived files remain accessible through archive explorer handlers
- unsupported inline preview types must continue to open externally
- display names continue to prefer `customName` over `relativePath` basename

## Future Safe Refactor Checklist

- introduce query-row types for document IPC handlers in `electron/main.ts`
- centralize repeated explorer file mapping in the main process
- replace remaining inline document preview modals with the shared modal
- replace remaining inline basename logic with shared helpers
- document all known `section` values by entity type
- add focused regression tests for:
  - preview fallback
  - archive explorer visibility
  - branch/tax/housing path inference
  - same-slot document offload to archive
