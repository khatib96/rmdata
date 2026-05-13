import { useTranslation } from 'react-i18next';
import { Phone, Smartphone } from 'lucide-react';
import type { EmployeePhone } from './types';

interface EmployeePhonesProps {
  employeePhones: EmployeePhone[];
  onNavigatePhone: (phoneId: number) => void;
}

export default function EmployeePhones({ employeePhones, onNavigatePhone }: EmployeePhonesProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary-gray/50">
        <h4 className="font-bold text-lg text-primary-gold">{t('employees.phonesTitle')}</h4>
      </div>
      {employeePhones.length === 0 ? (
        <p className="text-secondary-gray py-8 text-center text-lg">{t('employees.noPhones')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employeePhones.map((p) => (
            <div
              key={p.id}
              onClick={() => onNavigatePhone(p.id)}
              className="border border-secondary-gray/30 p-4 rounded-lg flex items-center justify-between hover:border-primary-gold/50 transition-colors cursor-pointer bg-light-background"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary-gray/20 flex items-center justify-center shrink-0 text-primary-gold">
                  {p.numberType === 'landline' ? <Phone size={20} /> : <Smartphone size={20} />}
                </div>
                <div>
                  <p className="font-bold text-dark-charcoal text-lg" dir="ltr">{p.phoneNumber}</p>
                  <p className="text-sm text-secondary-gray mt-1">{p.provider === 'etisalat' ? t('employees.providerEtisalat') : p.provider === 'du' ? t('employees.providerDu') : p.provider} - {p.category === 'prepaid' ? t('employees.categoryPrepaid') : t('employees.categoryPostpaid')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
