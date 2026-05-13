export function listDocuments(entityType?: string, entityId?: number, section?: string) {
  return window.electronAPI?.documentList
    ? window.electronAPI.documentList(entityType, entityId, section)
    : Promise.resolve(undefined);
}

export function getDocumentUrl(relativePath: string) {
  return window.electronAPI?.documentGetUrl
    ? window.electronAPI.documentGetUrl(relativePath)
    : Promise.resolve(undefined);
}

export function openDocumentExternal(relativePath: string) {
  return window.electronAPI?.documentOpenExternal
    ? window.electronAPI.documentOpenExternal(relativePath)
    : Promise.resolve(undefined);
}

export function deleteDocumentById(id: number) {
  return window.electronAPI?.documentDelete
    ? window.electronAPI.documentDelete(id)
    : Promise.resolve(undefined);
}
