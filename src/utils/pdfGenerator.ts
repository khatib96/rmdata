import jsPDF from 'jspdf';
import type { EmployeeForPDF, BranchForPDF, LicenseForPDF } from '../types/shared';

/**
 * Generate Salary Certificate PDF
 */
export async function generateSalaryCertificate(
  employee: EmployeeForPDF,
  branch?: BranchForPDF
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Set RTL support (basic)
  doc.setFont('helvetica');

  // Header
  doc.setFillColor(163, 122, 63); // Primary Gold
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('شهادة راتب', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('شركة الرداء الموحد', 105, 30, { align: 'center' });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Content
  let yPos = 60;
  doc.setFontSize(14);
  doc.text('نشهد نحن شركة الرداء الموحد بأن:', 20, yPos);
  
  yPos += 15;
  doc.setFontSize(12);
  doc.text(`الاسم: ${employee.name}`, 20, yPos);
  
  yPos += 10;
  doc.text(`الجنسية: ${employee.nationality || 'غير محدد'}`, 20, yPos);
  
  yPos += 10;
  doc.text(`المهنة: ${employee.profession || 'غير محدد'}`, 20, yPos);
  
  if (branch) {
    yPos += 10;
    doc.text(`مكان العمل: ${branch.name}`, 20, yPos);
  }

  yPos += 15;
  doc.setFontSize(14);
  doc.text('يتقاضى الراتب التالي:', 20, yPos);
  
  yPos += 10;
  doc.setFontSize(12);
  if (employee.basicSalary) {
    doc.text(`الراتب الأساسي: ${employee.basicSalary.toFixed(2)} درهم`, 20, yPos);
    yPos += 10;
  }
  
  if (employee.housingAllowance) {
    doc.text(`بدل السكن: ${employee.housingAllowance.toFixed(2)} درهم`, 20, yPos);
    yPos += 10;
  }
  
  if (employee.transportAllowance) {
    doc.text(`بدل المواصلات: ${employee.transportAllowance.toFixed(2)} درهم`, 20, yPos);
    yPos += 10;
  }
  
  if (employee.totalSalary) {
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`إجمالي الراتب: ${employee.totalSalary.toFixed(2)} درهم`, 20, yPos);
    doc.setFont('helvetica', 'normal');
  }

  // Footer
  yPos = 250;
  doc.setFontSize(10);
  doc.text('تاريخ الإصدار:', 20, yPos);
  doc.text(new Date().toLocaleDateString('en'), 60, yPos);
  
  yPos += 15;
  doc.setFontSize(10);
  doc.text('الختم والتوقيع', 150, yPos);

  // Generate blob
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

/**
 * Generate Trade License PDF
 */
export async function generateTradeLicense(
  license: LicenseForPDF,
  branch: BranchForPDF
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  doc.setFillColor(163, 122, 63); // Primary Gold
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('رخصة تجارية', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('شركة الرداء الموحد', 105, 30, { align: 'center' });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Content
  let yPos = 60;
  doc.setFontSize(14);
  doc.text('بيانات الرخصة التجارية:', 20, yPos);
  
  yPos += 15;
  doc.setFontSize(12);
  doc.text(`اسم الفرع: ${branch.name}`, 20, yPos);
  
  yPos += 10;
  doc.text(`رقم الرخصة: ${license.licenseNo}`, 20, yPos);
  
  yPos += 10;
  doc.text(`الاسم التجاري: ${license.tradeName}`, 20, yPos);
  
  if (license.issueDate) {
    yPos += 10;
    const d = license.issueDate instanceof Date ? license.issueDate : new Date(license.issueDate);
    doc.text(`تاريخ الإصدار: ${d.toLocaleDateString('en')}`, 20, yPos);
  }
  
  if (license.expiryDate) {
    yPos += 10;
    const d = license.expiryDate instanceof Date ? license.expiryDate : new Date(license.expiryDate);
    doc.text(`تاريخ الانتهاء: ${d.toLocaleDateString('en')}`, 20, yPos);
  }
  
  yPos += 10;
  doc.text(`الإمارة: ${branch.emirate}`, 20, yPos);
  
  if (branch.address) {
    yPos += 10;
    doc.text(`العنوان: ${branch.address}`, 20, yPos);
  }

  // Footer
  yPos = 250;
  doc.setFontSize(10);
  doc.text('تاريخ الإصدار:', 20, yPos);
  doc.text(new Date().toLocaleDateString('en'), 60, yPos);
  
  yPos += 15;
  doc.setFontSize(10);
  doc.text('الختم والتوقيع', 150, yPos);

  // Generate blob
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

/**
 * Download PDF
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
