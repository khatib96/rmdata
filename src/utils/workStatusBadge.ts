/**
 * ألوان شارة حالة العمل حسب المسمى
 * يعمل=أخضر | إجازة=أزرق فاتح | معار=رمادي | لا يعمل=أسود | موقوف=أحمر
 */
export function getWorkStatusBadgeClass(label: string): string {
  switch (label) {
    case 'يعمل':
      return 'bg-success-green/20 text-success-green';
    case 'إجازة':
      return 'bg-sky-200 text-sky-800';
    case 'معار':
    case 'معار داخلياً':
    case 'معار خارجياً':
      return 'bg-secondary-gray/30 text-dark-charcoal';
    case 'لا يعمل':
      return 'bg-dark-charcoal/20 text-dark-charcoal';
    case 'موقوف':
      return 'bg-alert-red/20 text-alert-red';
    case 'إلغاء تأشيرة':
      return 'bg-secondary-gray/20 text-dark-charcoal';
    case 'إنهاء التعاقد':
      return 'bg-amber-100 text-amber-800';
    case 'أرشيف':
      return 'bg-secondary-gray/30 text-dark-charcoal';
    default:
      return 'bg-secondary-gray/20 text-dark-charcoal';
  }
}
