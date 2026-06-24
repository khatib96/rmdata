import { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import AddEntityModal from './AddEntityModal';
import TaxIcon from '../Icons/TaxIcon';
import { EntityListView } from '../shared/EntityListView';
import { usePermissions } from '../../hooks/usePermissions';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useViewMode } from '../../hooks/useViewMode';

interface Entity {
  id: number;
  entityNickname?: string;
  name: string;
  trn?: string;
  corporateTaxGiban?: string;
  vatFilingCycle?: string;
  vatTrn?: string;
  linkedBranchCount?: number;
}

const ENTITIES_QUERY = `SELECT e.id, e.entityNickname, e.name, e.trn, e.corporateTaxGiban, e.vatFilingCycle,
                  (SELECT COUNT(*) FROM tax_entity_branches teb WHERE teb.entityId = e.id) AS linkedBranchCount
           FROM entities e ORDER BY e.id DESC`;

const EntityGridCard = memo(function EntityGridCard({
  entity: e,
  onOpen,
  linkedLabel,
}: {
  entity: Entity;
  onOpen: (id: number) => void;
  linkedLabel: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(e.id)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') onOpen(e.id);
      }}
      className="bg-white p-3 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col"
    >
      <div className="w-full h-40 mb-3 flex items-center justify-center rounded-lg">
        <TaxIcon size={56} className="text-primary-gold" golden />
      </div>
      <div className="flex flex-col items-center text-start flex-1 w-full">
        <h3 className="font-bold text-primary-gold text-lg w-full text-center">{e.entityNickname || e.name || '—'}</h3>
        <div className="w-full mt-2 space-y-0.5">
          {e.trn && <p className="text-sm text-dark-charcoal font-medium">TRN: {e.trn}</p>}
          {e.corporateTaxGiban && <p className="text-sm text-dark-charcoal font-medium">CTRN: {e.corporateTaxGiban}</p>}
          <p className="text-sm text-dark-charcoal/70">
            {linkedLabel}: {Number(e.linkedBranchCount) || 0}
          </p>
        </div>
      </div>
    </div>
  );
});

const EntityTableRow = memo(function EntityTableRow({
  entity: e,
  onOpen,
}: {
  entity: Entity;
  onOpen: (id: number) => void;
}) {
  return (
    <tr
      className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
      onClick={() => onOpen(e.id)}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
            <TaxIcon size={20} className="text-primary-gold" golden />
          </div>
          <span className="font-medium text-dark-charcoal">{e.entityNickname || e.name || '—'}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-dark-charcoal">{e.trn || '—'}</td>
      <td className="py-4 px-4 text-dark-charcoal">{e.corporateTaxGiban || '—'}</td>
      <td className="py-4 px-4 text-dark-charcoal">{e.vatFilingCycle || '—'}</td>
      <td className="py-4 px-4 text-dark-charcoal">{Number(e.linkedBranchCount) || 0}</td>
      <td className="py-4 px-4">
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onOpen(e.id);
          }}
          className="p-2 hover:bg-secondary-gray/30 rounded-lg"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      </td>
    </tr>
  );
});

export default function Entities() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const [viewMode, setViewMode] = useViewMode('entities_viewMode');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEntityId, setEditEntityId] = useState<number | null>(null);

  const { data: entities, isLoading, error, refetch } = useDbQuery<Entity>(ENTITIES_QUERY, [], {});
  const list = entities ?? [];

  const openEntity = useCallback(
    (id: number) => {
      navigate(`/dashboard/entities/${id}`);
    },
    [navigate]
  );

  if (!can('entities', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <EntityListView
      title={t('entities.title')}
      dir={dir}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      toolbarEnd={
        <>
          {can('entities', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="bg-primary-gold text-white px-6 py-2.5 rounded-lg hover:bg-primary-gold/90 transition-colors font-medium"
            >
              {t('entities.addEntity')}
            </button>
          )}
        </>
      }
    >
      {isLoading ? (
        <p className="text-secondary-gray">{t('entities.loading')}</p>
      ) : error ? (
        <p className="text-alert-red text-sm">{error.message}</p>
      ) : list.length === 0 ? (
        <p className="text-secondary-gray">{t('entities.noEntities')}</p>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {list.map((e) => (
            <EntityGridCard key={e.id} entity={e} onOpen={openEntity} linkedLabel={t('entities.linkedBranchesCount')} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-light-background">
              <tr>
                <th className="py-4 px-4 font-medium text-dark-charcoal">{t('entities.tableEntity')}</th>
                <th className="py-4 px-4 font-medium text-dark-charcoal">TRN</th>
                <th className="py-4 px-4 font-medium text-dark-charcoal">CTRN</th>
                <th className="py-4 px-4 font-medium text-dark-charcoal">{t('entities.tableTaxCycle')}</th>
                <th className="py-4 px-4 font-medium text-dark-charcoal">{t('entities.tableBranchesCount')}</th>
                <th className="py-4 px-4" />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <EntityTableRow key={e.id} entity={e} onOpen={openEntity} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEntityModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditEntityId(null);
        }}
        onSuccess={() => void refetch()}
        editEntityId={editEntityId}
      />
    </EntityListView>
  );
}
