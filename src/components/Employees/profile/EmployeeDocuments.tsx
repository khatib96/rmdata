import { useTranslation } from 'react-i18next';
import { FolderOpen, FileText, Eye, Download, Trash2, File, Image as ImageIcon } from 'lucide-react';
import type { EmployeeDocument } from './types';
import { getDocumentDisplayName, isImageDocumentName, isPdfDocumentName } from '../../../utils/documentHelpers';

interface EmployeeDocumentsProps {
  documents: EmployeeDocument[];
  onPreview: (doc: EmployeeDocument, name: string) => void;
  onOpenExternal: (relativePath: string) => void;
  onDelete: (doc: EmployeeDocument, name: string) => void;
  allowDelete?: boolean;
}

export default function EmployeeDocuments({
  documents,
  onPreview,
  onOpenExternal,
  onDelete,
  allowDelete = true,
}: EmployeeDocumentsProps) {
  const { t } = useTranslation();
  return (
    <div className="border border-secondary-gray rounded-lg p-6">
      <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('employees.docsTitle')}</h4>
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto text-secondary-gray mb-3" size={48} />
          <p className="text-dark-charcoal/70">{t('employees.noDocsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {documents.map((doc) => {
            const name = getDocumentDisplayName(doc.customName, doc.relativePath);
            const isPdf = isPdfDocumentName(name);
            const isImg = isImageDocumentName(name);
            const icon = isPdf ? <FileText className="w-10 h-10 text-red-600" /> : isImg ? <ImageIcon className="w-10 h-10 text-green-600" /> : <File className="w-10 h-10 text-secondary-gray" />;

            return (
              <div key={doc.id} className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50">
                {icon}
                <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">{name}</span>
                <div className="flex gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => onPreview(doc, name)}
                    className="p-2 rounded-lg hover:bg-secondary-gray/30"
                    title={t('employees.preview')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenExternal(doc.relativePath)}
                    className="p-2 rounded-lg hover:bg-secondary-gray/30"
                    title={t('employees.download')}
                  >
                    <Download size={16} />
                  </button>
                  {allowDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(doc, name)}
                      className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
                      title={t('employees.deleteDoc')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
