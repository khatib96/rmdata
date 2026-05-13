import { generateSalaryCertificate, generateTradeLicense, downloadPDF } from '../../utils/pdfGenerator';
import type { EmployeeForPDF, BranchForPDF, LicenseForPDF } from '../../types/shared';
import toast from 'react-hot-toast';

/**
 * Print Service Component
 * Provides functions to generate and download PDFs
 */
export class PrintService {
  /**
   * Print Salary Certificate
   */
  static async printSalaryCertificate(employee: EmployeeForPDF, branch?: BranchForPDF) {
    try {
      const pdfBlob = await generateSalaryCertificate(employee, branch);
      const filename = `شهادة_راتب_${employee.name}_${new Date().getTime()}.pdf`;
      downloadPDF(pdfBlob, filename);
      toast.success('تم إنشاء شهادة الراتب بنجاح');
    } catch (error) {
      console.error('Error generating salary certificate:', error);
      toast.error('حدث خطأ أثناء إنشاء شهادة الراتب');
    }
  }

  /**
   * Print Trade License
   */
  static async printTradeLicense(license: LicenseForPDF, branch: BranchForPDF) {
    try {
      const pdfBlob = await generateTradeLicense(license, branch);
      const filename = `رخصة_تجارية_${branch.name}_${new Date().getTime()}.pdf`;
      downloadPDF(pdfBlob, filename);
      toast.success('تم إنشاء الرخصة التجارية بنجاح');
    } catch (error) {
      console.error('Error generating trade license:', error);
      toast.error('حدث خطأ أثناء إنشاء الرخصة التجارية');
    }
  }
}
