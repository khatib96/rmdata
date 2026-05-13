import { Download, Eye, FileText, File, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getDocumentDisplayName } from '../../../utils/documentHelpers';
import type { DocumentListItem } from '../../../types/documents';

export function EntityProfileDocumentsTab({
  documents,
  onSaved,
  onPreview,
  t,
}: {
  entityId: number;
  documents: (DocumentListItem & { section?: string | null })[];
  onSaved: () => void;
  onPreview: (p: { url: string; name: string; relativePath?: string } | null) => void;
  t: (k: string, options?: Record<string, unknown>) => string;
}) {
  const vatDocs = documents.filter((d) => d.section === 'vat_cert');
  const corpDocs = documents.filter((d) => d.section === 'corporate_tax_cert');

  const renderDocCard = (doc: DocumentListItem) => {
    const name = getDocumentDisplayName(doc.customName, doc.relativePath);
    const ext = name.split('.').pop()?.toLowerCase();
    const icon =
      ext === 'pdf' ? (
        <FileText className="w-10 h-10 text-red-600" />
      ) : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '') ? (
        <ImageIcon className="w-10 h-10 text-green-600" />
      ) : (
        <File className="w-10 h-10 text-secondary-gray" />
      );
    return (
      <div
        key={doc.id}
        className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50"
      >
        {icon}
        <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">{name}</span>
        <div className="flex gap-1 mt-2">
          <button
            type="button"
            onClick={async () => {
              const r = await window.electronAPI?.documentGetUrl?.(doc.relativePath);
              if (r?.success && r?.url) onPreview({ url: r.url, name, relativePath: doc.relativePath });
            }}
            className="p-2 rounded-lg hover:bg-secondary-gray/30"
            title={t('entities.preview')}
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.documentOpenExternal?.(doc.relativePath)}
            className="p-2 rounded-lg hover:bg-secondary-gray/30"
            title={t('entities.download')}
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(t('entities.addModal.deleteDocConfirm', { name }))) return;
              await window.electronAPI?.documentDelete?.(doc.id);
              onSaved();
            }}
            className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
            title={t('entities.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-primary-gold font-semibold mb-2">{t('entities.tabVat')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{vatDocs.map(renderDocCard)}</div>
        {vatDocs.length === 0 && <p className="text-secondary-gray text-sm py-2">{t('entities.noDocuments')}</p>}
      </div>
      <div>
        <h4 className="text-primary-gold font-semibold mb-2">{t('entities.tabCorporate')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{corpDocs.map(renderDocCard)}</div>
        {corpDocs.length === 0 && <p className="text-secondary-gray text-sm py-2">{t('entities.noDocuments')}</p>}
      </div>
    </div>
  );
}
