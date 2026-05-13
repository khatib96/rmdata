interface FormSectionProps {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}

export function FormSection({ title, optional, children }: FormSectionProps) {
  return (
    <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
      <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
        {title}
        {optional && <span className="text-sm font-normal text-dark-charcoal/60 mr-2">(اختياري)</span>}
      </h3>
      {children}
    </div>
  );
}
