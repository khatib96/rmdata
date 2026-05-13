import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ElectronAPI } from '../types/electron.d';
import type { DocumentExplorerFile, DocumentExplorerFolder, DocumentPreview } from '../types/documents';
import {
  Users,
  Store,
  Building2,
  Car,
  Home,
  Smartphone,
  Briefcase,
  User,
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
} from 'lucide-react';
import TaxIcon from '../components/Icons/TaxIcon';
import ArchivedEntityCard from '../components/Archive/ArchivedEntityCard';
import DocumentPreviewModal from '../components/shared/DocumentPreviewModal';
import toast from 'react-hot-toast';
import { logActivity } from '../utils/activityLog';
import { useAuthStore } from '../store/authStore';
import { isImageDocumentName, isPdfDocumentName } from '../utils/documentHelpers';
import { getDocumentUrl, openDocumentExternal } from '../services/documentService';
const TABS = [
  { id: 'employees', icon: Users },
  { id: 'branches', icon: Building2 },
  { id: 'vehicles', icon: Car },
  { id: 'housing', icon: Home },
  { id: 'phones', icon: Smartphone },
  { id: 'entities', icon: Briefcase },
  { id: 'documents', icon: FolderOpen },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** مفتاح الترجمة لأسماء المجلدات الجذرية في مستكشف المؤرشفة */
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
const ROOT_ICONS: Record<string, React.ComponentType<any>> = {
  Branches: Store,
  Employees: Users,
  Employers: OwnerDocumentsIcon,
  Housing: Home,
  Phones: Smartphone,
  Vehicles: Car,
  Taxes: TaxIcon,
};

export default function Archive() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const api = window.electronAPI as ElectronAPI;
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabId>('employees');
  const [loading, setLoading] = useState(true);
  const [archivedList, setArchivedList] = useState<any[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  // Document explorer state
  const [pathStack, setPathStack] = useState<{ name: string; label: string }[]>([]);
  const [folders, setFolders] = useState<DocumentExplorerFolder[]>([]);
  const [files, setFiles] = useState<DocumentExplorerFile[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  const performerLabel = user ? `${user.fullName || user.username}${user.entityId ? ` (${user.entityId})` : ''}` : t('archive.systemPerformer');

  const loadArchived = useCallback(async (tab: TabId) => {
    if (tab === 'documents') return;
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.dbQuery) {
        setArchivedList([]);
        return;
      }
      if (tab === 'employees') {
        const r = await api.dbQuery("SELECT id, name, code, status FROM employees WHERE status = 'archived' ORDER BY name");
        setArchivedList(r?.data ?? []);
      } else if (tab === 'branches') {
        const r = await api.dbQuery("SELECT id, name, code FROM branches WHERE status = 'archived' ORDER BY name");
        setArchivedList(r?.data ?? []);
      } else if (tab === 'vehicles') {
        const r = await api.dbQuery("SELECT id, plateNumber, code FROM vehicles WHERE status = 'archived' ORDER BY plateNumber");
        setArchivedList(r?.data ?? []);
      } else if (tab === 'housing') {
        const r = await api.dbQuery("SELECT id, name FROM housing_units WHERE status = 'archived' ORDER BY name").catch(() => ({ data: [] }));
        setArchivedList(r?.data ?? []);
      } else if (tab === 'phones') {
        const r = await api.dbQuery("SELECT id, phoneNumber, provider, numberType FROM phones WHERE status = 'archived' ORDER BY id");
        setArchivedList(r?.data ?? []);
      } else if (tab === 'entities') {
        const r = await api.dbQuery("SELECT id, name, entityNickname FROM entities WHERE status = 'archived' ORDER BY name");
        setArchivedList(r?.data ?? []);
      } else {
        setArchivedList([]);
      }
    } catch {
      setArchivedList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchived(activeTab);
  }, [activeTab, loadArchived]);

  const loadExplorer = useCallback(async (folderPath: string) => {
    if (!window.electronAPI?.documentListArchiveExplorer) return;
    setExplorerLoading(true);
    try {
      const res = await window.electronAPI.documentListArchiveExplorer(folderPath);
      setFolders(res.folders || []);
      setFiles(res.files || []);
    } catch {
      setFolders([]);
      setFiles([]);
    } finally {
      setExplorerLoading(false);
    }
  }, []);

  const currentPath = pathStack.map((p) => p.name).join('/');
  useEffect(() => {
    if (activeTab === 'documents') loadExplorer(currentPath);
  }, [activeTab, currentPath, loadExplorer]);

  const handleRestore = async (tab: TabId, id: number, label: string) => {
    const api = window.electronAPI;
    if (!api?.dbQuery) return;
    setRestoringId(id);
    try {
      let table = '';
      let entityType = '';
      let entityLabel = '';
      if (tab === 'employees') {
        table = 'employees';
        entityType = 'employee';
        await api.dbQuery('UPDATE employees SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.employee', { label });
      } else if (tab === 'branches') {
        table = 'branches';
        entityType = 'branch';
        await api.dbQuery('UPDATE branches SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.branch', { label });
      } else if (tab === 'vehicles') {
        table = 'vehicles';
        entityType = 'vehicle';
        await api.dbQuery('UPDATE vehicles SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.vehicle', { label });
      } else if (tab === 'housing') {
        table = 'housing_units';
        entityType = 'housing';
        await api.dbQuery('UPDATE housing_units SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.housing', { label });
      } else if (tab === 'phones') {
        table = 'phones';
        entityType = 'phone';
        await api.dbQuery('UPDATE phones SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.phone', { label });
      } else if (tab === 'entities') {
        table = 'entities';
        entityType = 'entity';
        await api.dbQuery('UPDATE entities SET status = ? WHERE id = ?', ['active', id]);
        entityLabel = t('archive.entityLabel.entity', { label });
      }
      const details = `restored::${entityType}::${label}::${performerLabel}`;
      await logActivity({
        module: 'archive',
        action: 'restore',
        entityType,
        entityId: id,
        details,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      toast.success(t('archive.restoreSuccess'));
      loadArchived(activeTab);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('archive.restoreFailed'));
    } finally {
      setRestoringId(null);
    }
  };

  const goTo = (name: string, label: string) => {
    setPathStack((prev) => [...prev, { name, label }]);
  };
  const goBack = () => setPathStack((prev) => prev.slice(0, -1));

  const getFileIcon = (name: string) => {
    if (isPdfDocumentName(name)) return <FileText className="w-10 h-10 text-red-600" />;
    if (isImageDocumentName(name)) return <ImageIcon className="w-10 h-10 text-green-600" />;
    return <File className="w-10 h-10 text-secondary-gray" />;
  };

  const handleViewFile = async (file: DocumentExplorerFile) => {
    const res = await getDocumentUrl(file.relativePath);
    if (!res?.success) {
      toast.error(res?.error || t('archive.openFileFailed'));
      return;
    }
    if (res.canPreview === false || !res.url) {
      await openDocumentExternal(file.relativePath);
      toast.success(t('archive.openedInDefaultApp'));
      return;
    }
    setPreview({ url: res.url, name: file.name, relativePath: file.relativePath });
  };

  const handleOpenExternal = async (file: DocumentExplorerFile) => {
    const res = await openDocumentExternal(file.relativePath);
    if (res?.success) toast.success(t('archive.fileOpened'));
    else toast.error(res?.error || t('archive.openFileFailed'));
  };

  const getRowLabel = (tab: TabId, row: any) => {
    if (tab === 'employees') return row.name || row.code || t('archive.fallbackLabel.employee', { id: row.id });
    if (tab === 'branches') return row.name || row.code || t('archive.fallbackLabel.branch', { id: row.id });
    if (tab === 'vehicles') return [row.plateNumber, row.code].filter(Boolean).join(' ') || t('archive.fallbackLabel.vehicle', { id: row.id });
    if (tab === 'housing') return row.name || t('archive.fallbackLabel.housing', { id: row.id });
    if (tab === 'phones') return [row.phoneNumber, row.provider, row.numberType].filter(Boolean).join(' - ') || t('archive.fallbackLabel.phone', { id: row.id });
    if (tab === 'entities') return row.entityNickname || row.name || t('archive.fallbackLabel.entity', { id: row.id });
    return String(row.id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-dark-charcoal/90">{t('archive.title')}</h1>

      <div className="flex flex-wrap gap-1 border-b border-secondary-gray/50 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const tabLabelKey = tab.id === 'documents' ? 'archive.tabs.documentsExplorer' : `archive.tabs.${tab.id}`;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-gold text-white shadow'
                  : 'text-dark-charcoal/70 hover:bg-secondary-gray/30 hover:text-primary-gold'
              }`}
            >
              <Icon size={18} />
              {t(tabLabelKey)}
            </button>
          );
        })}
      </div>

      <div className="bg-[#2a2a2a]/70 rounded-lg border border-secondary-gray/50 shadow-lg overflow-hidden">
        {activeTab !== 'documents' && (
          <div className="p-6 min-h-[320px]">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-10 h-10 text-primary-gold animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {archivedList.map((row) => {
                  const label = getRowLabel(activeTab, row);
                  const isRestoring = restoringId === row.id;
                  return (
                    <ArchivedEntityCard
                      key={row.id}
                      label={label}
                      isRestoring={isRestoring}
                      onRestore={() => handleRestore(activeTab, row.id, label)}
                    />
                  );
                })}
                {!loading && archivedList.length === 0 && (
                  <p className="col-span-full text-secondary-gray text-center py-12">{t('archive.emptySection')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button
                type="button"
                onClick={() => setPathStack([])}
                className="text-primary-gold hover:underline font-medium"
              >
                {t('archive.archivedDocuments')}
              </button>
              {pathStack.map((p, i) => (
                <span key={p.name} className="flex items-center gap-2">
                  <span className="text-secondary-gray">/</span>
                  <button
                    type="button"
                    onClick={() => setPathStack((prev) => prev.slice(0, i + 1))}
                    className="text-dark-charcoal/70 hover:text-primary-gold font-medium"
                  >
                    {i === 0 && ROOT_FOLDER_I18N_KEYS[p.name] ? t(ROOT_FOLDER_I18N_KEYS[p.name]) : p.label}
                  </button>
                </span>
              ))}
              {pathStack.length > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="mr-2 p-1.5 rounded-lg border border-secondary-gray/50 hover:bg-secondary-gray/20 text-secondary-gray"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 min-h-[320px]">
              {explorerLoading ? (
                <div className="col-span-full flex justify-center py-16">
                  <Loader2 className="w-10 h-10 text-primary-gold animate-spin" />
                </div>
              ) : (
                <>
                  {folders.map((f) => {
                    const SectionIcon = pathStack.length === 0 ? ROOT_ICONS[f.name] : null;
                    return (
                      <div
                        key={f.name}
                        className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray/40 bg-dark-charcoal/50 hover:border-primary-gold/50 transition-all"
                      >
                        <button type="button" onClick={() => goTo(f.name, f.label)} className="flex flex-col items-center w-full">
                          {SectionIcon ? (
                            <span className="flex items-center justify-center w-12 h-12 text-primary-gold/90 mb-2">
                              <SectionIcon className="w-7 h-7" />
                            </span>
                          ) : (
                            <Folder className="w-12 h-12 text-primary-gold/80 mb-2" />
                          )}
                          <span className="text-sm font-medium text-white/90 text-center truncate w-full">
                            {pathStack.length === 0 && ROOT_FOLDER_I18N_KEYS[f.name] ? t(ROOT_FOLDER_I18N_KEYS[f.name]) : f.label}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray/40 bg-dark-charcoal/50 hover:border-primary-gold/50"
                    >
                      {getFileIcon(file.name)}
                      <span className="text-sm font-medium text-white/90 mt-2 text-center truncate w-full">{file.name}</span>
                      <div className="flex gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => handleViewFile(file)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30 text-primary-gold"
                          title={t('archive.preview')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenExternal(file)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30 text-primary-gold"
                          title={t('archive.open')}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenExternal(file)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30 text-primary-gold"
                          title={t('archive.print')}
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!explorerLoading && folders.length === 0 && files.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-secondary-gray">
                      <FolderOpen className="w-16 h-16 mb-3 opacity-50" />
                      <p>{t('archive.noArchivedDocuments')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <DocumentPreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        onOpenExternal={async (relativePath) => {
          if (relativePath) await openDocumentExternal(relativePath);
        }}
        theme="dark"
      />
    </div>
  );
}
