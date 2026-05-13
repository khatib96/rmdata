import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import type { ElectronAPI } from '../types/electron.d';
import type { DocumentExplorerFile, DocumentExplorerFolder, DocumentPreview } from '../types/documents';
import {
  FolderOpen,
  Folder,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Eye,
  Printer,
  ChevronLeft,
  Loader2,
  PlusCircle,
  Upload,
  Trash2,
  Store,
  Users,
  User,
  Home,
  Smartphone,
  Car,
} from 'lucide-react';
import TaxIcon from '../components/Icons/TaxIcon';
import DocumentPreviewModal from '../components/shared/DocumentPreviewModal';
import toast from 'react-hot-toast';
import {
  buildSavedDocumentFileName,
  getDocumentDisplayName,
  isImageDocumentName,
  isPdfDocumentName,
} from '../utils/documentHelpers';
import { deleteDocumentById, getDocumentUrl, openDocumentExternal } from '../services/documentService';

const FIXED_ROOTS = ['Branches', 'Employees', 'Employers', 'Housing', 'Phones', 'Vehicles', 'Taxes'];

/** مفتاح الترجمة لأسماء المجلدات الجذرية حسب اللغة */
const ROOT_FOLDER_I18N_KEYS: Record<string, string> = {
  Branches: 'nav.branches',
  Employees: 'nav.employees',
  Employers: 'nav.employers',
  Housing: 'nav.housing',
  Phones: 'nav.phones',
  Vehicles: 'nav.vehicles',
  Taxes: 'nav.taxes',
};

const OWNER_ICON_SRC = './icons/owner.png';

function OwnerDocumentsIcon({ className = '' }: { className?: string } & Record<string, unknown>) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // Match Sidebar behavior (broken image icon) when file isn't available.
    return <img src={OWNER_ICON_SRC} alt="" className={className} />;
  }

  const maskStyle = {
    display: 'inline-block' as const,
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url(${OWNER_ICON_SRC})`,
    WebkitMaskSize: 'contain' as const,
    WebkitMaskRepeat: 'no-repeat' as const,
    WebkitMaskPosition: 'center' as const,
    maskImage: `url(${OWNER_ICON_SRC})`,
    maskSize: 'contain' as const,
    maskRepeat: 'no-repeat' as const,
    maskPosition: 'center' as const,
  };

  return (
    <>
      <span className={className} style={maskStyle} />
      <img src={OWNER_ICON_SRC} alt="" width={0} height={0} className="hidden" onError={() => setFailed(true)} />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ROOT_FOLDER_ICONS: Record<string, React.ComponentType<any>> = {
  Branches: Store,
  Employees: Users,
  Employers: OwnerDocumentsIcon,
  Housing: Home,
  Phones: Smartphone,
  Vehicles: Car,
  Taxes: TaxIcon,
};

export default function Documents() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const api = window.electronAPI as ElectronAPI;
  const [pathStack, setPathStack] = useState<{ name: string; label: string }[]>([]);
  const [folders, setFolders] = useState<DocumentExplorerFolder[]>([]);
  const [files, setFiles] = useState<DocumentExplorerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadModal, setUploadModal] = useState<{ sourcePath: string; customName: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!can('documents', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  const currentPath = pathStack.map((p) => p.name).join('/');
  const canUpload = pathStack.length > 0;
  const isManualPath = pathStack.length > 0 && !FIXED_ROOTS.includes(pathStack[0].name);
  const isBranchPath = pathStack.length === 2 && pathStack[0].name === 'Branches';
  const isBranchSectionPath = pathStack.length === 3 && pathStack[0].name === 'Branches';
  const isEmployerPath = pathStack.length === 2 && pathStack[0].name === 'Employers';
  const isEmployeeSectionPath = pathStack.length === 3 && pathStack[0].name === 'Employees';
  const isVehiclePath = pathStack.length === 2 && pathStack[0].name === 'Vehicles';
  const isVehicleSectionPath = pathStack.length === 3 && pathStack[0].name === 'Vehicles';
  const isTaxPath = pathStack.length === 2 && pathStack[0].name === 'Taxes';
  const isTaxSectionPath = pathStack.length === 3 && pathStack[0].name === 'Taxes';
  const isHousingPath = pathStack.length >= 1 && pathStack[0].name === 'Housing';

  const load = useCallback(async (folderPath: string) => {
    setLoading(true);
    try {
      const res = await api?.documentListExplorer?.(folderPath);
      setFolders(res?.folders || []);
      setFiles(res?.files || []);
    } catch {
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load(currentPath);
  }, [currentPath, load]);

  const goTo = (name: string, label: string) => {
    setPathStack((prev) => [...prev, { name, label }]);
  };

  const goBack = () => {
    setPathStack((prev) => prev.slice(0, -1));
  };

  const getFileIcon = (name: string) => {
    const isPdf = isPdfDocumentName(name);
    const isImage = isImageDocumentName(name);
    if (isPdf) return <FileText className="w-10 h-10 text-red-600" />;
    if (['doc', 'docx'].includes(name.split('.').pop()?.toLowerCase() || '')) return <FileText className="w-10 h-10 text-blue-600" />;
    if (isImage) return <ImageIcon className="w-10 h-10 text-green-600" />;
    return <File className="w-10 h-10 text-secondary-gray" />;
  };

  const handleView = async (file: DocumentExplorerFile) => {
    const res = await getDocumentUrl(file.relativePath);
    if (!res?.success) {
      toast.error(res?.error || t('documents.openFileFailed'));
      return;
    }
    if (res.canPreview === false || !res.url) {
      await openDocumentExternal(file.relativePath);
      toast.success(t('documents.openedInDefaultApp'));
      return;
    }
    setPreview({ url: res.url, name: file.name, relativePath: file.relativePath });
  };

  const handleOpenExternal = async (file: DocumentExplorerFile) => {
    const res = await openDocumentExternal(file.relativePath);
    if (res?.success) {
      toast.success(t('documents.fileOpened'));
    } else {
      toast.error(res?.error || t('documents.openFileFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-dark-charcoal">{t('documents.title')}</h1>

      <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setPathStack([])}
          className="text-dark-charcoal/70 hover:text-primary-gold font-medium"
        >
          {t('documents.rootBreadcrumb')}
        </button>
        {pathStack.map((p, i) => (
          <span key={p.name} className="flex items-center gap-2">
            <span className="text-secondary-gray">/</span>
            <button
              type="button"
              onClick={() => setPathStack((prev) => prev.slice(0, i + 1))}
              className="text-dark-charcoal/80 hover:text-primary-gold font-medium"
            >
              {i === 0 && ROOT_FOLDER_I18N_KEYS[p.name] ? t(ROOT_FOLDER_I18N_KEYS[p.name]) : p.label}
            </button>
          </span>
        ))}
        {pathStack.length > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="mr-2 p-1.5 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setNewFolderName(''); setNewFolderOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
          >
            <PlusCircle size={18} />
            {t('documents.addFolder')}
          </button>
          {canUpload && (isManualPath || isBranchSectionPath || isEmployerPath || isHousingPath || isTaxSectionPath) && (
            <button
              type="button"
              onClick={async () => {
                const res = await window.electronAPI?.fileSelectDocument?.();
                if (res?.success && res?.filePath) setUploadModal({ sourcePath: res.filePath, customName: '' });
                else if (!res?.canceled) toast.error(res?.error || t('documents.selectFileFailed'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold text-primary-gold hover:bg-primary-gold/10 font-medium"
            >
              <Upload size={18} />
              {t('documents.uploadDocument')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-secondary-gray p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-primary-gold animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map((f) => {
              const SectionIcon = pathStack.length === 0 ? ROOT_FOLDER_ICONS[f.name] : null;
              return (
              <div key={f.name} className="relative flex flex-col items-center justify-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold hover:bg-accent-sand/30 transition-all group">
                <button
                  type="button"
                  onClick={() => goTo(f.name, f.label)}
                  className="flex flex-col items-center w-full"
                >
                  {SectionIcon ? (
                    <div className="relative w-14 h-14 mb-2 flex items-center justify-center text-primary-gold/90">
                      <Folder className="absolute inset-0 w-full h-full" strokeWidth={1.5} aria-hidden />
                      <span className="relative flex items-center justify-center w-7 h-7 text-primary-gold/95" style={{ marginTop: '-2px' }}>
                        <SectionIcon className="w-6 h-6" strokeWidth={2} />
                      </span>
                    </div>
                  ) : (
                    <Folder className="w-12 h-12 text-primary-gold mb-2" />
                  )}
                  <span className="text-sm font-medium text-dark-charcoal text-center truncate w-full">
                    {pathStack.length === 0 && ROOT_FOLDER_I18N_KEYS[f.name]
                      ? t(ROOT_FOLDER_I18N_KEYS[f.name])
                      : f.label}
                  </span>
                </button>
                {f.isDeletable && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const folderLabel = pathStack.length === 0 && ROOT_FOLDER_I18N_KEYS[f.name] ? t(ROOT_FOLDER_I18N_KEYS[f.name]) : f.label;
                      if (!confirm(t('documents.deleteFolderConfirm', { label: folderLabel }))) return;
                      const folderPath = currentPath ? `${currentPath}/${f.name}` : f.name;
                      const res = await window.electronAPI?.documentDeleteFolder?.(folderPath);
                      if (res?.success) { toast.success(t('documents.folderDeleted')); load(currentPath); }
                      else toast.error(res?.error || t('documents.deleteFailed'));
                    }}
                    className="absolute top-2 left-2 p-1.5 rounded-lg bg-alert-red/10 text-alert-red hover:bg-alert-red/20"
                    title={t('documents.deleteFolder')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
            })}
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50 bg-white relative group/file"
              >
                {getFileIcon(file.name)}
                <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">
                  {file.name}
                </span>
                <div className="flex gap-1 mt-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => handleView(file)}
                    className="p-2 rounded-lg hover:bg-secondary-gray/30 text-dark-charcoal"
                    title={t('documents.preview')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenExternal(file)}
                    className="p-2 rounded-lg hover:bg-secondary-gray/30 text-dark-charcoal"
                    title={t('documents.openDownload')}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenExternal(file)}
                    className="p-2 rounded-lg hover:bg-secondary-gray/30 text-dark-charcoal"
                    title={t('documents.print')}
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(t('documents.deleteDocumentConfirm', { name: file.name }))) return;
                      const res = await deleteDocumentById(file.id);
                      if (res?.success) { toast.success(t('documents.documentDeleted')); load(currentPath); }
                      else toast.error(res?.error || t('documents.deleteFailed'));
                    }}
                    className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
                    title={t('documents.deleteDocument')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {!loading && folders.length === 0 && files.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-secondary-gray">
                <FolderOpen className="w-16 h-16 mb-3 opacity-50" />
                <p>{t('documents.empty')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New folder modal */}
      {newFolderOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNewFolderOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-dark-charcoal mb-3">{t('documents.newFolderTitle')}</h3>
            <p className="text-sm text-dark-charcoal/70 mb-3">{t('documents.newFolderExample')}</p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('documents.folderNamePlaceholder')}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewFolderOpen(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('documents.cancel')}</button>
              <button
                disabled={creatingFolder || !newFolderName.trim()}
                onClick={async () => {
                  setCreatingFolder(true);
                  const res = await window.electronAPI?.documentCreateFolder?.(newFolderName.trim(), currentPath || undefined);
                  setCreatingFolder(false);
                  if (res?.success) {
                    toast.success(t('documents.folderCreated'));
                    setNewFolderOpen(false);
                    setNewFolderName('');
                    load(currentPath);
                  } else {
                    toast.error(res?.error || t('documents.createFolderFailed'));
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand disabled:opacity-50"
              >
                {creatingFolder ? t('documents.creating') : t('documents.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload document modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setUploadModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-dark-charcoal mb-3">{t('documents.uploadTitle')}</h3>
            <p className="text-sm text-dark-charcoal/70 mb-2">{t('documents.uploadLocation', { path: currentPath || t('documents.root') })}</p>
            <input
              type="text"
              placeholder={t('documents.documentNamePlaceholder')}
              value={uploadModal.customName}
              onChange={(e) => setUploadModal((m) => m ? { ...m, customName: e.target.value } : null)}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setUploadModal(null)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('documents.cancel')}</button>
              <button
                disabled={uploading}
                onClick={async () => {
                  setUploading(true);
                  const baseName = getDocumentDisplayName(null, uploadModal.sourcePath);
                  const targetName = buildSavedDocumentFileName(uploadModal.sourcePath, uploadModal.customName);
                  const relativePath = currentPath ? `${currentPath}/${targetName}` : targetName;
                  let entityType: string;
                  let entityId: number | undefined;
                  let section: string | undefined;
                  if (isBranchSectionPath) {
                    entityType = 'branch';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = pathStack[2].name;
                  } else if (isBranchPath) {
                    entityType = 'branch';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = undefined;
                  } else if (isEmployerPath) {
                    entityType = 'employer';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = undefined;
                  } else if (isEmployeeSectionPath) {
                    entityType = 'employee';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = pathStack[2].name;
                  } else if (isVehicleSectionPath) {
                    entityType = 'vehicle';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = pathStack[2].name;
                  } else if (isVehiclePath) {
                    entityType = 'vehicle';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = undefined;
                  } else if (isTaxSectionPath) {
                    entityType = 'entity';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = pathStack[2].name;
                  } else if (isTaxPath) {
                    entityType = 'entity';
                    entityId = parseInt(pathStack[1].name, 10);
                    section = undefined;
                  } else if (isHousingPath) {
                    entityType = 'housing';
                    section = pathStack.length > 1 ? pathStack.slice(1).map((p) => p.name).join('/') : undefined;
                  } else {
                    entityType = 'company';
                    section = currentPath;
                  }
                  const res = await window.electronAPI?.documentSave?.({
                    sourceFilePath: uploadModal.sourcePath,
                    relativePath,
                    customName: uploadModal.customName.trim() || baseName,
                    entityType,
                    entityId,
                    section,
                  });
                  setUploading(false);
                  if (res?.success) {
                    toast.success(t('documents.uploadSuccess'));
                    setUploadModal(null);
                    load(currentPath);
                  } else {
                    toast.error(res?.error || t('documents.uploadFailed'));
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand disabled:opacity-50"
              >
                {uploading ? t('documents.uploading') : t('documents.upload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      <DocumentPreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        onOpenExternal={async (relativePath) => {
          if (!relativePath) return;
          const file = files.find((f) => f.relativePath === relativePath);
          if (file) await handleOpenExternal(file);
        }}
      />
    </div>
  );
}
