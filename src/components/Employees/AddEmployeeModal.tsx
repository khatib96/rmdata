import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { UAE_EMIRATES, getEmirateLabel } from '../../constants/uae';
import { useLanguageStore } from '../../store/languageStore';
import { ContractType, EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';
import { generateNextCode } from '../../utils/entityCode';
import { PROFESSIONS } from '../../constants/professions';
import { getEmployeeFormBranches, getEnabledEstablishmentBranchIds } from '../../services/branchService';
import { getDistinctEmployeeNationalities } from '../../services/employeeService';
import { FormModal } from '../shared/FormModal';
import { FormSection } from '../shared/FormSection';
import { DatePicker } from '../shared/DatePicker';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  canEmployeeUiTab,
  canEmployeeFieldInTab,
  EMPLOYEE_MODAL_STEP_TAB,
  type EmployeeProfileTabId,
} from '../../services/employeePermissions';
import { canEmployeesFieldView, canEmployeesSensitiveAction } from '../../services/permissionsService';


const DMS_SECTIONS = { photo: 'photo', passport: 'passport', residency: 'residency', mohre_contract: 'mohre_contract', health_insurance: 'health_insurance', unemployment_insurance: 'unemployment_insurance' } as const;
const EMPLOYEE_EDIT_QUERY = `SELECT
  id, name, nationality, email, phone, imagePath,
  passportNumber, passportIssueDate, passportExpiry,
  emiratesId, emiratesIdIssueDate, emiratesIdExpiry, issueEmirate,
  contractType, contractBranchId, workBranchId, employerName, establishmentNumber, immigrationEstablishmentNumber,
  professionKeys, professionCustomTitle, professionPerContract, contractStartDate, contractExpiryDate,
  basicSalary, housingAllowance, transportAllowance, otherAllowances,
  status, loanType, targetEntityName, loanExpiryDate, tempContractNumber, loanSalary,
  loanBranchId, loanProfession, loanSubStatus, actualSalary,
  healthInsuranceEnabled, healthInsuranceProvider, healthInsuranceIssueDate, healthInsuranceExpiryDate,
  unemploymentInsuranceEnabled, unemploymentInsuranceProvider, unemploymentInsuranceIssueDate, unemploymentInsuranceExpiryDate
  FROM employees
  WHERE id = ?`;

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editEmployeeId?: number | null;
}

interface EmployeeEditRow {
  id: number;
  name?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  imagePath?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiry?: string;
  emiratesId?: string;
  emiratesIdIssueDate?: string;
  emiratesIdExpiry?: string;
  issueEmirate?: string;
  contractType?: string;
  contractBranchId?: number | null;
  workBranchId?: number | null;
  employerName?: string;
  establishmentNumber?: string;
  immigrationEstablishmentNumber?: string;
  professionKeys?: string;
  professionCustomTitle?: string;
  professionPerContract?: string;
  contractStartDate?: string;
  contractExpiryDate?: string;
  basicSalary?: number | null;
  housingAllowance?: number | null;
  transportAllowance?: number | null;
  otherAllowances?: number | null;
  status?: string;
  loanType?: string;
  targetEntityName?: string;
  loanExpiryDate?: string;
  tempContractNumber?: string;
  loanSalary?: number | null;
  loanBranchId?: number | null;
  loanProfession?: string;
  loanSubStatus?: string;
  actualSalary?: number | null;
  healthInsuranceEnabled?: number | boolean | null;
  healthInsuranceProvider?: string;
  healthInsuranceIssueDate?: string;
  healthInsuranceExpiryDate?: string;
  unemploymentInsuranceEnabled?: number | boolean | null;
  unemploymentInsuranceProvider?: string;
  unemploymentInsuranceIssueDate?: string;
  unemploymentInsuranceExpiryDate?: string;
}

const INITIAL_FORM = {
  name: '',
  nationality: '',
  email: '',
  phone: '',
  passportNumber: '',
  passportIssueDate: '',
  passportExpiryDate: '',
  emiratesId: '',
  emiratesIdIssueDate: '',
  emiratesIdExpiryDate: '',
  issueEmirate: '',
  contractType: ContractType.PERMANENT as ContractType,
  contractBranchId: '',
  workBranchId: '',
  employerName: '',
  establishmentNumber: '',
  immigrationEstablishmentNumber: '',
  professionKeys: [] as string[],
  professionCustomTitle: '',
  professionPerContract: '',
  contractIssueDate: '',
  contractExpiryDate: '',
  basicSalary: '',
  housingAllowance: '',
  transportAllowance: '',
  otherAllowances: '',
  status: EmploymentStatus.ACTIVE as EmploymentStatus,
  loanType: '' as '' | (typeof LoanType)[keyof typeof LoanType],
  targetEntityName: '',
  loanExpiryDate: '',
  tempContractNumber: '',
  loanSalary: '',
  loanBranchId: '',
  loanProfession: '',
  loanSubStatus: '' as '' | (typeof LoanSubStatus)[keyof typeof LoanSubStatus],
  actualSalary: '',
  healthInsuranceEnabled: false,
  healthInsuranceProvider: '',
  healthInsuranceIssueDate: '',
  healthInsuranceExpiryDate: '',
  unemploymentInsuranceEnabled: false,
  unemploymentInsuranceProvider: '',
  unemploymentInsuranceIssueDate: '',
  unemploymentInsuranceExpiryDate: '',
};

export default function AddEmployeeModal({ isOpen, onClose, onSuccess, editEmployeeId }: AddEmployeeModalProps) {
  const { t } = useTranslation();
  const lang = useLanguageStore((s) => s.language);
  const user = useAuthStore((s) => s.user);
  const updateLinkedEntityImagePath = useAuthStore((s) => s.updateLinkedEntityImagePath);
  const { permissions, loading: permLoading } = usePermissions();
  const canUploadDocs = canEmployeesSensitiveAction(permissions, 'uploadDocuments');
  const CONTRACT_TYPES = useMemo(() => [
    { value: ContractType.PERMANENT, label: t('employees.contractPermanent') },
    { value: ContractType.TEMPORARY, label: t('employees.contractTemporary') },
  ] as const, [t]);
  const STEPS = useMemo(() => [
    { step: 1, label: t('employees.stepBasic') },
    { step: 2, label: t('employees.stepPassport') },
    { step: 3, label: t('employees.stepContract') },
    { step: 4, label: t('employees.stepResidency') },
    { step: 5, label: t('employees.stepInsurances') },
  ], [t]);
  const visibleSteps = useMemo(
    () => STEPS.filter((s) => canEmployeeUiTab(permissions, EMPLOYEE_MODAL_STEP_TAB[s.step])),
    [STEPS, permissions]
  );
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<{ id: number; name: string; tradeName: string; emirate: string; hasEstablishment: boolean }[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ sectionKey: string; sourcePath: string; customName: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>(null);
  const existingDataRef = useRef<{ imagePath?: string | null }>({});
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  const isEdit = !!editEmployeeId;

  useEffect(() => {
    if (!isOpen || permLoading) return;
    if (visibleSteps.length === 0) return;
    if (!visibleSteps.some((v) => v.step === step)) {
      setStep(visibleSteps[0].step);
    }
  }, [isOpen, permLoading, visibleSteps, step]);

  const fin = (tab: EmployeeProfileTabId, fieldAction: string) =>
    canEmployeeFieldInTab(permissions, tab, fieldAction);

  const goPrevStep = () => {
    const i = visibleSteps.findIndex((v) => v.step === step);
    const p = visibleSteps[i - 1];
    if (p) setStep(p.step);
  };

  const goNextStep = () => {
    const i = visibleSteps.findIndex((v) => v.step === step);
    const n = visibleSteps[i + 1];
    if (n) setStep(n.step);
  };

  const isFirstVisibleStep = visibleSteps.length > 0 && step === visibleSteps[0].step;
  const isLastVisibleStep =
    visibleSteps.length > 0 && step === visibleSteps[visibleSteps.length - 1].step;

  const filteredBranches = branches.filter((b) => b.hasEstablishment);
  const isPermanent = form.contractType === ContractType.PERMANENT;

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    (async () => {
      const bRes = await getEmployeeFormBranches();
      const estRes = await getEnabledEstablishmentBranchIds();
      const estRows = (estRes?.data ?? []) as { branchId: number }[];
      const estBranchIds = new Set(estRows.map((r) => r.branchId));
      const branchRows = (bRes?.data ?? []) as { id: number; name: string; emirate: string; tradeName?: string }[];
      setBranches(branchRows.map((r) => ({
        id: r.id, name: r.name, tradeName: r.tradeName || r.name || '', emirate: r.emirate || '', hasEstablishment: estBranchIds.has(r.id),
      })));
      const natRes = await getDistinctEmployeeNationalities();
      setNationalities((natRes?.data || []).map((r: { nationality: string }) => r.nationality || '').filter(Boolean));
    })();
  }, [isOpen]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!isOpen || !editEmployeeId || !api?.dbQuery) return;
    (async () => {
      const empRes = await api.dbQuery(EMPLOYEE_EDIT_QUERY, [editEmployeeId]);
      const emp = empRes?.success && empRes?.data?.[0] ? (empRes.data[0] as EmployeeEditRow) : null;
      if (emp) {
        let professionKeys: string[] = [];
        try {
          if (emp.professionKeys) professionKeys = JSON.parse(emp.professionKeys) || [];
        } catch {}
        const loadedForm = {
          ...INITIAL_FORM,
          name: emp.name || '',
          nationality: emp.nationality || '',
          email: emp.email || '',
          phone: emp.phone || '',
          passportNumber: emp.passportNumber || '',
          passportIssueDate: emp.passportIssueDate ? String(emp.passportIssueDate).slice(0, 10) : '',
          passportExpiryDate: emp.passportExpiry ? String(emp.passportExpiry).slice(0, 10) : '',
          emiratesId: emp.emiratesId || '',
          emiratesIdIssueDate: emp.emiratesIdIssueDate ? String(emp.emiratesIdIssueDate).slice(0, 10) : '',
          emiratesIdExpiryDate: emp.emiratesIdExpiry ? String(emp.emiratesIdExpiry).slice(0, 10) : '',
          issueEmirate: emp.issueEmirate || '',
          contractType: (emp.contractType as ContractType) || ContractType.PERMANENT,
          contractBranchId: emp.contractBranchId != null ? String(emp.contractBranchId) : (emp.workBranchId != null ? String(emp.workBranchId) : ''),
          workBranchId: emp.workBranchId != null ? String(emp.workBranchId) : '',
          employerName: emp.employerName || '',
          establishmentNumber: emp.establishmentNumber || '',
          immigrationEstablishmentNumber: emp.immigrationEstablishmentNumber || '',
          professionKeys: professionKeys,
          professionCustomTitle: emp.professionCustomTitle || '',
          professionPerContract: emp.professionPerContract || '',
          contractIssueDate: emp.contractStartDate ? String(emp.contractStartDate).slice(0, 10) : '',
          contractExpiryDate: emp.contractExpiryDate ? String(emp.contractExpiryDate).slice(0, 10) : '',
          basicSalary: emp.basicSalary != null ? String(emp.basicSalary) : '',
          housingAllowance: emp.housingAllowance != null ? String(emp.housingAllowance) : '',
          transportAllowance: emp.transportAllowance != null ? String(emp.transportAllowance) : '',
          otherAllowances: emp.otherAllowances != null ? String(emp.otherAllowances) : '',
          status: (emp.status as EmploymentStatus) || EmploymentStatus.ACTIVE,
          loanType: (emp.loanType || '') as (typeof INITIAL_FORM)['loanType'],
          targetEntityName: emp.targetEntityName || '',
          loanExpiryDate: emp.loanExpiryDate ? String(emp.loanExpiryDate).slice(0, 10) : '',
          tempContractNumber: emp.tempContractNumber || '',
          loanSalary: emp.loanSalary != null ? String(emp.loanSalary) : '',
          loanBranchId: emp.loanBranchId != null ? String(emp.loanBranchId) : '',
          loanProfession: emp.loanProfession || '',
          loanSubStatus: (emp.loanSubStatus || '') as (typeof INITIAL_FORM)['loanSubStatus'],
          actualSalary: emp.actualSalary != null ? String(emp.actualSalary) : '',
          healthInsuranceEnabled: !!emp.healthInsuranceEnabled,
          healthInsuranceProvider: emp.healthInsuranceProvider || '',
          healthInsuranceIssueDate: emp.healthInsuranceIssueDate ? String(emp.healthInsuranceIssueDate).slice(0, 10) : '',
          healthInsuranceExpiryDate: emp.healthInsuranceExpiryDate ? String(emp.healthInsuranceExpiryDate).slice(0, 10) : '',
          unemploymentInsuranceEnabled: !!emp.unemploymentInsuranceEnabled,
          unemploymentInsuranceProvider: emp.unemploymentInsuranceProvider || '',
          unemploymentInsuranceIssueDate: emp.unemploymentInsuranceIssueDate ? String(emp.unemploymentInsuranceIssueDate).slice(0, 10) : '',
          unemploymentInsuranceExpiryDate: emp.unemploymentInsuranceExpiryDate ? String(emp.unemploymentInsuranceExpiryDate).slice(0, 10) : '',
        };
        setForm(loadedForm);
        existingDataRef.current = { imagePath: emp.imagePath };
        oldFormRef.current = { ...loadedForm, imagePath: emp.imagePath || null };
        if (emp.imagePath && api.fileGetImageUrl) {
          const imgRes = await api.fileGetImageUrl(emp.imagePath);
          if (imgRes?.success && imgRes.url) setImagePreview(imgRes.url);
        }
      } else {
        existingDataRef.current = { imagePath: undefined };
      }
    })();
  }, [isOpen, editEmployeeId]);

  const handleContractBranchChange = async (branchId: string) => {
    if (!branchId) {
      setForm((f) => ({ ...f, contractBranchId: '', establishmentNumber: '', ...(form.contractType === ContractType.PERMANENT ? { employerName: '', immigrationEstablishmentNumber: '', issueEmirate: '' } : {}) }));
      return;
    }
    if (!window.electronAPI?.dbQuery) return;
    const id = parseInt(branchId, 10);
    const estRes = await window.electronAPI.dbQuery('SELECT laborEstablishmentCardNo, immigrationEstablishmentCardNo FROM branch_establishments WHERE branchId = ? LIMIT 1', [id]);
    const est = estRes?.data?.[0];
    const establishmentNumber = est?.laborEstablishmentCardNo || '';
    if (form.contractType === ContractType.PERMANENT) {
      const licRes = await window.electronAPI.dbQuery('SELECT tradeName FROM branch_licenses WHERE branchId = ? LIMIT 1', [id]);
      const branch = branches.find((b) => b.id === id);
      const lic = licRes?.data?.[0];
      setForm((f) => ({
        ...f,
        contractBranchId: branchId,
        establishmentNumber,
        employerName: lic?.tradeName || branch?.name || '',
        immigrationEstablishmentNumber: est?.immigrationEstablishmentCardNo || '',
        issueEmirate: branch?.emirate || '',
      }));
    } else {
      setForm((f) => ({
        ...f,
        contractBranchId: branchId,
        establishmentNumber,
        employerName: f.employerName,
        immigrationEstablishmentNumber: f.immigrationEstablishmentNumber,
        issueEmirate: f.issueEmirate,
      }));
    }
  };

  const basicSalary = parseFloat(form.basicSalary) || 0;
  const housing = parseFloat(form.housingAllowance) || 0;
  const transport = parseFloat(form.transportAllowance) || 0;
  const others = parseFloat(form.otherAllowances) || 0;
  const totalSalary = basicSalary + housing + transport + others;

  const handleImageSelect = async () => {
    if (!window.electronAPI?.fileSelectImage) return;
    const result = await window.electronAPI.fileSelectImage();
    if (result?.success && result.base64Data && result.filename) {
      setImagePreview(result.base64Data);
      setImageFilename(result.filename);
    }
  };

  const handleAddDoc = async (sectionKey: string, sectionLabel: string) => {
    const res = await window.electronAPI?.fileSelectDocument?.();
    if (res?.success && res?.filePath) setDocModal({ sectionKey, sectionLabel, sourcePath: res.filePath, customName: '' });
    else if (!res?.canceled) toast.error(res?.error || t('employees.selectFileFailed'));
  };

  const DOC_SECTION_LABELS: Record<string, string> = useMemo(() => ({
    passport: t('employees.docSectionPassport'),
    mohre_contract: t('employees.docSectionMohre'),
    residency: t('employees.docSectionResidency'),
    health_insurance: t('employees.docSectionHealth'),
    unemployment_insurance: t('employees.docSectionUnemployment'),
  }), [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name?.trim()) { setError(t('employees.fullNameRequired')); return; }
    if (!permLoading && visibleSteps.length === 0 && !isEdit) {
      setError(t('employees.noTabPermission'));
      return;
    }
    setLoading(true);
    try {
      if (!window.electronAPI?.dbQuery) throw new Error(t('employees.dbUnavailable'));

      let f = { ...form };
      const prev = oldFormRef.current as typeof form | null;
      if (isEdit && prev) {
        if (!canEmployeeUiTab(permissions, 'basic')) {
          f.nationality = prev.nationality;
          f.email = prev.email;
          f.phone = prev.phone;
        } else {
          if (!fin('basic', 'field.nationality.view')) f.nationality = prev.nationality;
          if (!fin('basic', 'field.email.view')) f.email = prev.email;
          if (!fin('basic', 'field.phone.view')) f.phone = prev.phone;
        }
        if (!canEmployeeUiTab(permissions, 'passport')) {
          f.passportNumber = prev.passportNumber;
          f.passportIssueDate = prev.passportIssueDate;
          f.passportExpiryDate = prev.passportExpiryDate;
        } else {
          if (!fin('passport', 'field.passportNo.view')) f.passportNumber = prev.passportNumber;
          if (!fin('passport', 'field.passportIssueDate.view')) f.passportIssueDate = prev.passportIssueDate;
          if (!fin('passport', 'field.passportExpiry.view')) f.passportExpiryDate = prev.passportExpiryDate;
        }
        if (!canEmployeeUiTab(permissions, 'residency')) {
          f.emiratesId = prev.emiratesId;
          f.emiratesIdIssueDate = prev.emiratesIdIssueDate;
          f.emiratesIdExpiryDate = prev.emiratesIdExpiryDate;
          f.issueEmirate = prev.issueEmirate;
          f.employerName = prev.employerName;
          f.immigrationEstablishmentNumber = prev.immigrationEstablishmentNumber;
        } else {
          if (!fin('residency', 'field.nationalId.view')) f.emiratesId = prev.emiratesId;
          if (!fin('residency', 'field.emiratesIdIssueDate.view')) f.emiratesIdIssueDate = prev.emiratesIdIssueDate;
          if (!fin('residency', 'field.emiratesIdExpiry.view')) f.emiratesIdExpiryDate = prev.emiratesIdExpiryDate;
          if (!fin('residency', 'field.residencyEmirate.view')) f.issueEmirate = prev.issueEmirate;
          if (!fin('residency', 'field.residencyEmployer.view')) f.employerName = prev.employerName;
          if (!fin('residency', 'field.immigrationEstablishment.view')) f.immigrationEstablishmentNumber = prev.immigrationEstablishmentNumber;
        }
        if (!canEmployeeUiTab(permissions, 'contract')) {
          f.contractType = prev.contractType;
          f.contractBranchId = prev.contractBranchId;
          f.workBranchId = prev.workBranchId;
          f.employerName = prev.employerName;
          f.establishmentNumber = prev.establishmentNumber;
          f.professionPerContract = prev.professionPerContract;
          f.contractIssueDate = prev.contractIssueDate;
          f.contractExpiryDate = prev.contractExpiryDate;
          f.basicSalary = prev.basicSalary;
          f.housingAllowance = prev.housingAllowance;
          f.transportAllowance = prev.transportAllowance;
          f.otherAllowances = prev.otherAllowances;
        } else {
          if (!fin('contract', 'field.contractTradeName.view')) {
            f.contractBranchId = prev.contractBranchId;
            f.workBranchId = prev.workBranchId;
          }
          if (!fin('contract', 'field.contractEstablishmentNumber.view')) f.establishmentNumber = prev.establishmentNumber;
          if (!fin('contract', 'field.professionContract.view')) f.professionPerContract = prev.professionPerContract;
          if (!fin('contract', 'field.contractStartDate.view')) f.contractIssueDate = prev.contractIssueDate;
          if (!fin('contract', 'field.contractExpiryField.view')) f.contractExpiryDate = prev.contractExpiryDate;
          if (!canEmployeesFieldView(permissions, 'field.salaryComponents.view')) {
            f.basicSalary = prev.basicSalary;
            f.housingAllowance = prev.housingAllowance;
            f.transportAllowance = prev.transportAllowance;
            f.otherAllowances = prev.otherAllowances;
          }
        }
        if (!canEmployeesFieldView(permissions, 'field.actualSalary.view')) f.actualSalary = prev.actualSalary;
        if (!canEmployeeUiTab(permissions, 'insurances')) {
          f.healthInsuranceEnabled = prev.healthInsuranceEnabled;
          f.healthInsuranceProvider = prev.healthInsuranceProvider;
          f.healthInsuranceIssueDate = prev.healthInsuranceIssueDate;
          f.healthInsuranceExpiryDate = prev.healthInsuranceExpiryDate;
          f.unemploymentInsuranceEnabled = prev.unemploymentInsuranceEnabled;
          f.unemploymentInsuranceProvider = prev.unemploymentInsuranceProvider;
          f.unemploymentInsuranceIssueDate = prev.unemploymentInsuranceIssueDate;
          f.unemploymentInsuranceExpiryDate = prev.unemploymentInsuranceExpiryDate;
        } else {
          if (!fin('insurances', 'field.healthInsuranceFields.view')) {
            f.healthInsuranceEnabled = prev.healthInsuranceEnabled;
            f.healthInsuranceProvider = prev.healthInsuranceProvider;
            f.healthInsuranceIssueDate = prev.healthInsuranceIssueDate;
            f.healthInsuranceExpiryDate = prev.healthInsuranceExpiryDate;
          }
          if (!fin('insurances', 'field.unemploymentInsuranceFields.view')) {
            f.unemploymentInsuranceEnabled = prev.unemploymentInsuranceEnabled;
            f.unemploymentInsuranceProvider = prev.unemploymentInsuranceProvider;
            f.unemploymentInsuranceIssueDate = prev.unemploymentInsuranceIssueDate;
            f.unemploymentInsuranceExpiryDate = prev.unemploymentInsuranceExpiryDate;
          }
        }
        if (!canEmployeeUiTab(permissions, 'work-status')) {
          f.loanType = prev.loanType;
          f.loanExpiryDate = prev.loanExpiryDate;
          f.tempContractNumber = prev.tempContractNumber;
          f.loanSalary = prev.loanSalary;
          f.loanBranchId = prev.loanBranchId;
          f.loanProfession = prev.loanProfession;
          f.loanSubStatus = prev.loanSubStatus;
        } else if (!fin('work-status', 'field.secondedLoanDetails.view')) {
          f.loanType = prev.loanType;
          f.loanExpiryDate = prev.loanExpiryDate;
          f.tempContractNumber = prev.tempContractNumber;
          f.loanSalary = prev.loanSalary;
          f.loanBranchId = prev.loanBranchId;
          f.loanProfession = prev.loanProfession;
          f.loanSubStatus = prev.loanSubStatus;
        }
      }

      const basicSalaryN = parseFloat(f.basicSalary) || 0;
      const housingN = parseFloat(f.housingAllowance) || 0;
      const transportN = parseFloat(f.transportAllowance) || 0;
      const othersN = parseFloat(f.otherAllowances) || 0;
      const totalSalaryN = basicSalaryN + housingN + transportN + othersN;

      let imagePath: string | null = null;
      const allowPhoto = fin('basic', 'field.profilePhoto.view');
      if (allowPhoto && imagePreview && imageFilename && window.electronAPI.fileSaveImage) {
        const ext = imageFilename.split('.').pop() || 'jpg';
        const saveResult = await window.electronAPI.fileSaveImage(imagePreview, `employee_${Date.now()}.${ext}`);
        if (!saveResult?.success) {
          throw new Error(saveResult?.error || t('employees.saveEmployeeFailed'));
        }
        if (saveResult.relativePath) imagePath = saveResult.relativePath;
        else if (saveResult.fullPath) imagePath = saveResult.fullPath;
      } else if (isEdit && existingDataRef.current?.imagePath) {
        imagePath = existingDataRef.current.imagePath;
      }

      let actualSal: number | null = totalSalaryN;
      if ((f.status === EmploymentStatus.ACTIVE || f.status === EmploymentStatus.LEAVE) && f.actualSalary) {
        actualSal = parseFloat(f.actualSalary);
      } else if (
        f.status === EmploymentStatus.SECONDED &&
        f.loanType === LoanType.INTERNAL &&
        (f.actualSalary || f.loanSalary)
      ) {
        actualSal = parseFloat(f.actualSalary || f.loanSalary);
      }

      const professionDisplay = (() => {
        const labels = f.professionKeys.map((k) => {
          const p = PROFESSIONS.find((x) => x.key === k);
          if (k === 'admin') {
            const base = p ? t(`employees.profession_${p.key}`) : 'إداري';
            return f.professionCustomTitle?.trim() ? `${base}:${f.professionCustomTitle.trim()}` : base;
          }
          if (k === 'other') return f.professionCustomTitle || (p ? t(`employees.profession_${p.key}`) : k);
          return p ? t(`employees.profession_${p.key}`) : k;
        });
        return labels.join('، ') || '';
      })();
      let employeeId: number;

      if (isEdit && editEmployeeId) {
        const upRes = await window.electronAPI.dbQuery(
          `UPDATE employees SET name=?, nationality=?, email=?, phone=?, imagePath=?,
            passportNumber=?, passportIssueDate=?, passportExpiry=?,
            emiratesId=?, emiratesIdIssueDate=?, emiratesIdExpiry=?, issueEmirate=?,
            contractType=?, contractBranchId=?, workBranchId=?, employerName=?, establishmentNumber=?, immigrationEstablishmentNumber=?,
            profession=?, professionKeys=?, professionCustomTitle=?, professionPerContract=?,
            contractStartDate=?, contractExpiryDate=?,
            basicSalary=?, housingAllowance=?, transportAllowance=?, otherAllowances=?,
            totalSalary=?, actualSalary=?, status=?,
            loanType=?, targetEntityName=?, loanExpiryDate=?, tempContractNumber=?, loanSalary=?,
            loanBranchId=?, loanProfession=?, loanSubStatus=?,
            healthInsuranceEnabled=?, healthInsuranceProvider=?, healthInsuranceIssueDate=?, healthInsuranceExpiryDate=?,
            unemploymentInsuranceEnabled=?, unemploymentInsuranceProvider=?, unemploymentInsuranceIssueDate=?, unemploymentInsuranceExpiryDate=?
          WHERE id=?`,
          [
            f.name, f.nationality || null, f.email || null, f.phone || null, imagePath,
            f.passportNumber || null, f.passportIssueDate || null, f.passportExpiryDate || null,
            f.emiratesId || null, f.emiratesIdIssueDate || null, f.emiratesIdExpiryDate || null, f.issueEmirate || null,
            f.contractType, f.contractBranchId ? parseInt(f.contractBranchId, 10) : null, f.workBranchId ? parseInt(f.workBranchId, 10) : null,
            f.employerName || null, f.establishmentNumber || null, f.immigrationEstablishmentNumber || null,
            professionDisplay, JSON.stringify(f.professionKeys), f.professionCustomTitle || null, f.professionPerContract || null,
            f.contractIssueDate || null, f.contractExpiryDate || null,
            basicSalaryN || null, housingN || null, transportN || null, othersN || null,
            totalSalaryN || null, actualSal || null, f.status,
            f.loanType || null, f.targetEntityName || null, f.loanExpiryDate || null,
            f.tempContractNumber || null, f.loanSalary ? parseFloat(f.loanSalary) : null,
            f.loanBranchId ? parseInt(f.loanBranchId, 10) : null, f.loanProfession || null, f.loanSubStatus || null,
            f.healthInsuranceEnabled ? 1 : 0, f.healthInsuranceProvider || null, f.healthInsuranceIssueDate || null, f.healthInsuranceExpiryDate || null,
            f.unemploymentInsuranceEnabled ? 1 : 0, f.unemploymentInsuranceProvider || null, f.unemploymentInsuranceIssueDate || null, f.unemploymentInsuranceExpiryDate || null,
            editEmployeeId,
          ]
        );
        if (!upRes?.success) throw new Error(upRes?.error || t('employees.updateFailed'));
        employeeId = editEmployeeId;
      } else {
        const empCode = await generateNextCode('RME', 'employees', (sql, params) =>
          window.electronAPI!.dbQuery!(sql, params)
        );
        const insRes = await window.electronAPI.dbQuery(
          `INSERT INTO employees (code, name, nationality, email, phone, imagePath,
          passportNumber, passportIssueDate, passportExpiry,
          emiratesId, emiratesIdIssueDate, emiratesIdExpiry, issueEmirate,
          contractType, contractBranchId, workBranchId, employerName, establishmentNumber, immigrationEstablishmentNumber,
          profession, professionKeys, professionCustomTitle, professionPerContract,
          contractStartDate, contractExpiryDate,
          basicSalary, housingAllowance, transportAllowance, otherAllowances,
          totalSalary, actualSalary, status,
          loanType, targetEntityName, loanExpiryDate, tempContractNumber, loanSalary,
          loanBranchId, loanProfession, loanSubStatus,
          healthInsuranceEnabled, healthInsuranceProvider, healthInsuranceIssueDate, healthInsuranceExpiryDate,
          unemploymentInsuranceEnabled, unemploymentInsuranceProvider, unemploymentInsuranceIssueDate, unemploymentInsuranceExpiryDate)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          empCode,
          f.name, f.nationality || null, f.email || null, f.phone || null, imagePath,
          f.passportNumber || null, f.passportIssueDate || null, f.passportExpiryDate || null,
          f.emiratesId || null, f.emiratesIdIssueDate || null, f.emiratesIdExpiryDate || null, f.issueEmirate || null,
          f.contractType, f.contractBranchId ? parseInt(f.contractBranchId, 10) : null, f.workBranchId ? parseInt(f.workBranchId, 10) : null,
          f.employerName || null, f.establishmentNumber || null, f.immigrationEstablishmentNumber || null,
          professionDisplay, JSON.stringify(f.professionKeys), f.professionCustomTitle || null, f.professionPerContract || null,
          f.contractIssueDate || null, f.contractExpiryDate || null,
          basicSalaryN || null, housingN || null, transportN || null, othersN || null,
          totalSalaryN || null, actualSal || null, f.status,
          f.loanType || null, f.targetEntityName || null, f.loanExpiryDate || null,
          f.tempContractNumber || null, f.loanSalary ? parseFloat(f.loanSalary) : null,
          f.loanBranchId ? parseInt(f.loanBranchId, 10) : null, f.loanProfession || null, f.loanSubStatus || null,
          f.healthInsuranceEnabled ? 1 : 0, f.healthInsuranceProvider || null, f.healthInsuranceIssueDate || null, f.healthInsuranceExpiryDate || null,
          f.unemploymentInsuranceEnabled ? 1 : 0, f.unemploymentInsuranceProvider || null, f.unemploymentInsuranceIssueDate || null, f.unemploymentInsuranceExpiryDate || null,
        ]
      );
        if (!insRes?.success) throw new Error(insRes?.error || t('employees.addFailed'));
        employeeId = insRes?.lastInsertId ?? 0;
        if (!employeeId) {
          const chk = await window.electronAPI.dbQuery('SELECT id FROM employees WHERE name = ? ORDER BY id DESC LIMIT 1', [f.name]);
          employeeId = chk?.data?.[0]?.id ?? 0;
        }
      }

      if (window.electronAPI?.documentSave) {
        const docSectionAllowed = (sectionKey: string) => {
          if (!canUploadDocs) return false;
          if (sectionKey === DMS_SECTIONS.passport) return fin('passport', 'field.passportNo.view');
          if (sectionKey === DMS_SECTIONS.mohre_contract) return fin('contract', 'field.contractTradeName.view');
          if (sectionKey === DMS_SECTIONS.residency) return fin('residency', 'field.nationalId.view');
          if (sectionKey === DMS_SECTIONS.health_insurance) return fin('insurances', 'field.healthInsuranceFields.view');
          if (sectionKey === DMS_SECTIONS.unemployment_insurance) return fin('insurances', 'field.unemploymentInsuranceFields.view');
          return true;
        };
        // Build base path dynamically via employeeId for robust reference
        const basePath = `Employees/${employeeId}`;
        const sectionPaths: Record<string, string> = {
          passport: `${basePath}/passport`, residency: `${basePath}/residency`, mohre_contract: `${basePath}/mohre_contract`,
          photo: `${basePath}/photo`, health_insurance: `${basePath}/health_insurance`, unemployment_insurance: `${basePath}/unemployment_insurance`,
        };
        for (const doc of pendingDocs) {
          if (!docSectionAllowed(doc.sectionKey)) continue;
          const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
          const base = parts[parts.length - 1] || 'file';
          const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
          const name = (doc.customName && doc.customName.trim())
            ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext
            : base;
          const relPath = `${sectionPaths[doc.sectionKey] || basePath}/${name}`;
          await window.electronAPI.documentSave({ sourceFilePath: doc.sourcePath, relativePath: relPath, customName: doc.customName || base, entityType: 'employee', entityId: employeeId, section: doc.sectionKey });
        }
      }

      const TRACKED_FIELDS = [
        'name', 'nationality', 'email', 'phone', 'imagePath',
        'passportNumber', 'passportIssueDate', 'passportExpiryDate',
        'emiratesId', 'emiratesIdIssueDate', 'emiratesIdExpiryDate', 'issueEmirate',
        'contractType', 'contractBranchId', 'workBranchId', 'employerName',
        'establishmentNumber', 'immigrationEstablishmentNumber',
        'professionCustomTitle', 'professionPerContract',
        'contractIssueDate', 'contractExpiryDate',
        'basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances',
        'status', 'loanType', 'targetEntityName', 'loanExpiryDate',
        'loanSalary', 'loanBranchId', 'loanProfession', 'loanSubStatus', 'actualSalary',
        'healthInsuranceEnabled', 'healthInsuranceProvider',
        'healthInsuranceIssueDate', 'healthInsuranceExpiryDate',
        'unemploymentInsuranceEnabled', 'unemploymentInsuranceProvider',
        'unemploymentInsuranceIssueDate', 'unemploymentInsuranceExpiryDate',
      ];
      let logDetails: string;
      if (isEdit && oldFormRef.current) {
        const newData = { ...f, imagePath: imagePath || null };
        logDetails = buildChangeSummary(oldFormRef.current, newData, 'employee', f.name, TRACKED_FIELDS);
      } else {
        logDetails = `${isEdit ? 'edited' : 'created'}::employee::${f.name}`;
      }
      await logActivity({
        module: 'employee',
        action: isEdit ? 'edit' : 'create',
        entityType: 'employee',
        entityId: employeeId,
        details: logDetails,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      toast.success(isEdit ? t('employees.employeeUpdated') : t('employees.employeeAdded'));
      if (isEdit && user?.linkedEntityType === 'employee' && user?.linkedEntityId === employeeId) {
        try {
          const res = await window.electronAPI?.authRefreshLinkedImage?.(user.id);
          if (res?.success) updateLinkedEntityImagePath(res.linkedEntityImagePath ?? null);
        } catch { /* best-effort */ }
      }
      onSuccess();
      onClose();
      setStep(1);
      setForm(INITIAL_FORM);
      setImagePreview(null);
      setPendingDocs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      toast.error(t('employees.saveEmployeeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white';
  const labelClass = 'block text-sm font-medium text-dark-charcoal mb-1';

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('employees.editEmployee') : t('employees.addEmployee')}
      subtitle={t('employees.uae')}
      steps={visibleSteps}
      currentStep={step}
      onStepClick={setStep}
    >
      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="mb-4 p-3 bg-alert-red/10 text-alert-red rounded-lg text-sm">{error}</div>}
        {permLoading && <p className="text-secondary-gray text-sm mb-4">{t('common.loading')}</p>}
        {!permLoading && visibleSteps.length === 0 && (
          <p className="text-secondary-gray text-sm mb-4">{t('employees.noTabPermission')}</p>
        )}

        {step === 1 && (
          <FormSection title={t('employees.tabBasic')}>
            <div className="space-y-4">
              <div><label className={labelClass}>{t('employees.fullName')} *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required /></div>
              {fin('basic', 'field.nationality.view') && (
              <div>
                <label className={labelClass}>{t('employees.nationality')}</label>
                <input
                  type="text"
                  list="nationalities-list"
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  placeholder={t('employees.nationalityPlaceholder')}
                  className={inputClass}
                />
                <datalist id="nationalities-list">
                  {nationalities.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              )}
              {fin('basic', 'field.email.view') && (
              <div><label className={labelClass}>{t('employees.email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
              )}
              {fin('basic', 'field.phone.view') && (
              <div><label className={labelClass}>{t('employees.phone')}</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
              )}
              {fin('basic', 'field.profilePhoto.view') && (
              <div>
                <label className={labelClass}>{t('employees.profilePhoto')}</label>
                <div className="flex items-center gap-4">
                  {imagePreview && <img src={imagePreview} alt="" className="w-20 h-20 object-cover rounded-lg border" />}
                  <button type="button" onClick={handleImageSelect} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10">
                    <Upload size={18} /> {t('employees.selectImage')}
                  </button>
                </div>
              </div>
              )}
            </div>
          </FormSection>
        )}

        {step === 2 && (
          <FormSection title={t('employees.stepPassport')}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {fin('passport', 'field.passportNo.view') && (
                <div><label className={labelClass}>{t('employees.passportNumber')}</label><input type="text" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} className={inputClass} /></div>
                )}
                {fin('passport', 'field.passportIssueDate.view') && (
                <div><label className={labelClass}>{t('employees.issueDate')}</label><DatePicker value={form.passportIssueDate} onChange={(v) => setForm({ ...form, passportIssueDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
                {fin('passport', 'field.passportExpiry.view') && (
                <div><label className={labelClass}>{t('employees.expiryDate')}</label><DatePicker value={form.passportExpiryDate} onChange={(v) => setForm({ ...form, passportExpiryDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
              </div>
              <div className="mt-3">
                {canUploadDocs && fin('passport', 'field.passportNo.view') && (
                <button type="button" onClick={() => handleAddDoc(DMS_SECTIONS.passport, DOC_SECTION_LABELS.passport)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                  <Upload size={16} /> {t('employees.addDocuments')}
                </button>
                )}
                {pendingDocs.map((d, i) => d.sectionKey === DMS_SECTIONS.passport ? (
                  <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                    <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                    <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                  </span>
                ) : null)}
              </div>
            </div>
          </FormSection>
        )}

        {step === 3 && (
          <FormSection title={t('employees.stepContract')}>
            <div className="space-y-4">
              <div><label className={labelClass}>{t('employees.contractTypeLabel')}</label>
                <select value={form.contractType} onChange={(e) => { const v = e.target.value as ContractType; setForm({ ...form, contractType: v, contractBranchId: '', workBranchId: '', employerName: '', establishmentNumber: '', immigrationEstablishmentNumber: '', issueEmirate: '' }); }} className={inputClass}>
                  {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {fin('contract', 'field.contractTradeName.view') && (
              <div><label className={labelClass}>{t('employees.establishment')}</label>
                <select value={form.contractBranchId} onChange={(e) => handleContractBranchChange(e.target.value)} className={inputClass}>
                  <option value="">-- {t('employees.chooseEstablishment')} --</option>
                  {filteredBranches.map((b) => <option key={b.id} value={b.id}>{b.tradeName && b.tradeName !== b.name ? `${b.tradeName} - ${b.name}` : b.name}</option>)}
                </select>
                {filteredBranches.length === 0 && <p className="text-xs text-secondary-gray mt-1">{t('employees.noBranchesWithEstablishment')}</p>}
                {!isPermanent && <p className="text-xs text-secondary-gray mt-1">{t('employees.tempContractHint')}</p>}
              </div>
              )}
              {(form.contractBranchId || form.establishmentNumber) && fin('contract', 'field.contractEstablishmentNumber.view') && (
                <div><label className={labelClass}>{t('employees.laborEstablishmentNo')}</label><input type="text" value={form.establishmentNumber} readOnly className={inputClass} /></div>
              )}
              {fin('contract', 'field.professionContract.view') && (
              <div><label className={labelClass}>{t('employees.professionPerContract')}</label>
                <input type="text" placeholder={t('employees.professionInContractPlaceholder')} value={form.professionPerContract} onChange={(e) => setForm({ ...form, professionPerContract: e.target.value })} className={inputClass} />
              </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {fin('contract', 'field.contractStartDate.view') && (
                <div><label className={labelClass}>{t('employees.issueDate')}</label><DatePicker value={form.contractIssueDate} onChange={(v) => setForm({ ...form, contractIssueDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
                {fin('contract', 'field.contractExpiryField.view') && (
                <div><label className={labelClass}>{t('employees.expiryDate')}</label><DatePicker value={form.contractExpiryDate} onChange={(v) => setForm({ ...form, contractExpiryDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
              </div>
              {(canEmployeesFieldView(permissions, 'field.salaryComponents.view') || canEmployeesFieldView(permissions, 'field.contractSalary.view')) && (
              <div className="grid grid-cols-2 gap-4">
                {canEmployeesFieldView(permissions, 'field.salaryComponents.view') && (
                <>
                <div><label className={labelClass}>{t('employees.salaryBasic')}</label><input type="number" step="0.01" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>{t('employees.salaryHousing')}</label><input type="number" step="0.01" value={form.housingAllowance} onChange={(e) => setForm({ ...form, housingAllowance: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>{t('employees.salaryTransport')}</label><input type="number" step="0.01" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>{t('employees.salaryOther')}</label><input type="number" step="0.01" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: e.target.value })} className={inputClass} /></div>
                </>
                )}
              </div>
              )}
              {(canEmployeesFieldView(permissions, 'field.salaryTotal.view') || canEmployeesFieldView(permissions, 'field.salaryComponents.view') || canEmployeesFieldView(permissions, 'field.contractSalary.view')) && (
              <p className="text-sm font-medium text-primary-gold">{t('employees.salaryTotal')}: {totalSalary.toLocaleString('en')} {t('employees.aed')}</p>
              )}
              <div className="mt-3">
                {canUploadDocs && fin('contract', 'field.contractTradeName.view') && (
                <button type="button" onClick={() => handleAddDoc(DMS_SECTIONS.mohre_contract, DOC_SECTION_LABELS.mohre_contract)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                  <Upload size={16} /> {t('employees.addDocuments')}
                </button>
                )}
                {pendingDocs.map((d, i) => d.sectionKey === DMS_SECTIONS.mohre_contract ? (
                  <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                    <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                    <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                  </span>
                ) : null)}
              </div>
            </div>
          </FormSection>
        )}

        {step === 4 && (
          <FormSection title={t('employees.stepResidency')}>
            <p className="text-sm text-secondary-gray mb-4">
              {isPermanent ? t('employees.residencyPermanentHint') : t('employees.residencyTempHint')}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {fin('residency', 'field.nationalId.view') && (
                <div><label className={labelClass}>{t('employees.emiratesIdNumber')}</label><input type="text" value={form.emiratesId} onChange={(e) => setForm({ ...form, emiratesId: e.target.value })} className={inputClass} /></div>
                )}
                {fin('residency', 'field.emiratesIdIssueDate.view') && (
                <div><label className={labelClass}>{t('employees.issueDate')}</label><DatePicker value={form.emiratesIdIssueDate} onChange={(v) => setForm({ ...form, emiratesIdIssueDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
                {fin('residency', 'field.emiratesIdExpiry.view') && (
                <div><label className={labelClass}>{t('employees.expiryDate')}</label><DatePicker value={form.emiratesIdExpiryDate} onChange={(v) => setForm({ ...form, emiratesIdExpiryDate: v })} placeholder={t('employees.chooseDate')} /></div>
                )}
                {fin('residency', 'field.residencyEmirate.view') && (
                <div><label className={labelClass}>{t('employees.issueEmirate')}</label>
                  <select value={form.issueEmirate} onChange={(e) => setForm({ ...form, issueEmirate: e.target.value })} className={inputClass} disabled={isPermanent}>
                    <option value="">--</option>
                    {UAE_EMIRATES.map((em) => <option key={em.value} value={em.value}>{getEmirateLabel(em.value, lang)}</option>)}
                  </select>
                </div>
                )}
                {fin('residency', 'field.residencyEmployer.view') && (
                <div><label className={labelClass}>{t('employees.employerTradeName')}</label><input type="text" value={isPermanent && form.contractBranchId ? [form.employerName, branches.find(b=>b.id===parseInt(form.contractBranchId))?.name].filter(Boolean).join(' - ') : form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} className={inputClass} disabled={isPermanent} readOnly={isPermanent} /></div>
                )}
              </div>
              {fin('residency', 'field.immigrationEstablishment.view') && (
              <div><label className={labelClass}>{t('employees.immigrationEstablishmentNo')}</label><input type="text" value={form.immigrationEstablishmentNumber} onChange={(e) => setForm({ ...form, immigrationEstablishmentNumber: e.target.value })} className={inputClass} readOnly={isPermanent} placeholder={t('employees.immigrationEstablishmentPlaceholder')} title={isPermanent ? t('employees.immigrationEstablishmentTitleAuto') : t('employees.immigrationEstablishmentTitleManual')} /></div>
              )}
              <div className="mt-3">
                {canUploadDocs && fin('residency', 'field.nationalId.view') && (
                <button type="button" onClick={() => handleAddDoc(DMS_SECTIONS.residency, DOC_SECTION_LABELS.residency)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                  <Upload size={16} /> {t('employees.addDocuments')}
                </button>
                )}
                {pendingDocs.map((d, i) => d.sectionKey === DMS_SECTIONS.residency ? (
                  <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                    <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                    <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                  </span>
                ) : null)}
              </div>
            </div>
          </FormSection>
        )}

        {step === 5 && (
          <FormSection title={t('employees.stepInsurances')} optional>
            <div className="space-y-6">
              {fin('insurances', 'field.healthInsuranceFields.view') && (
              <div className="border border-secondary-gray rounded-lg p-4">
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" checked={form.healthInsuranceEnabled} onChange={(e) => setForm({ ...form, healthInsuranceEnabled: e.target.checked })} />
                  <span className="font-medium">{t('employees.healthInsuranceSection')}</span>
                </label>
                {form.healthInsuranceEnabled && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pr-6">
                    <div><label className={labelClass}>{t('employees.insuranceProvider')}</label><input type="text" value={form.healthInsuranceProvider} onChange={(e) => setForm({ ...form, healthInsuranceProvider: e.target.value })} className={inputClass} /></div>
                    <div><label className={labelClass}>{t('employees.issueDate')}</label><DatePicker value={form.healthInsuranceIssueDate} onChange={(v) => setForm({ ...form, healthInsuranceIssueDate: v })} placeholder={t('employees.chooseDate')} /></div>
                    <div><label className={labelClass}>{t('employees.expiryDate')}</label><DatePicker value={form.healthInsuranceExpiryDate} onChange={(v) => setForm({ ...form, healthInsuranceExpiryDate: v })} placeholder={t('employees.chooseDate')} /></div>
                    <div className="flex flex-wrap items-end gap-2">
                      {canUploadDocs && (
                      <button type="button" onClick={() => handleAddDoc(DMS_SECTIONS.health_insurance, DOC_SECTION_LABELS.health_insurance)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                        <Upload size={16} /> {t('employees.addDocuments')}
                      </button>
                      )}
                      {pendingDocs.map((d, i) => d.sectionKey === DMS_SECTIONS.health_insurance ? (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                          <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                          <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                        </span>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>
              )}
              {fin('insurances', 'field.unemploymentInsuranceFields.view') && (
              <div className="border border-secondary-gray rounded-lg p-4">
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" checked={form.unemploymentInsuranceEnabled} onChange={(e) => setForm({ ...form, unemploymentInsuranceEnabled: e.target.checked })} />
                  <span className="font-medium">{t('employees.unemploymentInsuranceSection')}</span>
                </label>
                {form.unemploymentInsuranceEnabled && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pr-6">
                    <div><label className={labelClass}>{t('employees.insuranceProvider')}</label><input type="text" value={form.unemploymentInsuranceProvider} onChange={(e) => setForm({ ...form, unemploymentInsuranceProvider: e.target.value })} className={inputClass} /></div>
                    <div><label className={labelClass}>{t('employees.issueDate')}</label><DatePicker value={form.unemploymentInsuranceIssueDate} onChange={(v) => setForm({ ...form, unemploymentInsuranceIssueDate: v })} placeholder={t('employees.chooseDate')} /></div>
                    <div><label className={labelClass}>{t('employees.expiryDate')}</label><DatePicker value={form.unemploymentInsuranceExpiryDate} onChange={(v) => setForm({ ...form, unemploymentInsuranceExpiryDate: v })} placeholder={t('employees.chooseDate')} /></div>
                    <div className="flex flex-wrap items-end gap-2">
                      {canUploadDocs && (
                      <button type="button" onClick={() => handleAddDoc(DMS_SECTIONS.unemployment_insurance, DOC_SECTION_LABELS.unemployment_insurance)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                        <Upload size={16} /> {t('employees.addDocuments')}
                      </button>
                      )}
                      {pendingDocs.map((d, i) => d.sectionKey === DMS_SECTIONS.unemployment_insurance ? (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                          <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                          <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                        </span>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </FormSection>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <button type="button" onClick={goPrevStep} disabled={isFirstVisibleStep || visibleSteps.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg border disabled:opacity-50">
            <ChevronRight size={18} /> {t('employees.previous')}
          </button>
          {!isLastVisibleStep ? (
            <button type="button" onClick={goNextStep} disabled={visibleSteps.length === 0} className="flex items-center gap-2 px-6 py-2 bg-primary-gold text-white rounded-lg">{t('employees.next')} <ChevronLeft size={18} /></button>
          ) : (
            <button type="submit" disabled={loading || visibleSteps.length === 0} className="px-6 py-2 bg-primary-gold text-white rounded-lg disabled:opacity-50">{loading ? t('employees.saving') : isEdit ? t('employees.saveEdits') : t('employees.addEmployee')}</button>
          )}
        </div>
      </form>

      {docModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setDocModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-dark-charcoal mb-2">{t('employees.addDocTitle')}</h4>
            <p className="text-sm text-dark-charcoal/70 mb-2">{t('employees.docSectionLabel')}: {docModal.sectionLabel}</p>
            <input
              type="text"
              placeholder={t('employees.docNameOptional')}
              value={docModal.customName}
              onChange={(e) => setDocModal((m) => m ? { ...m, customName: e.target.value } : null)}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDocModal(null)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('employees.cancel')}</button>
              <button
                type="button"
                onClick={() => {
                  setPendingDocs((p) => [...p, { sectionKey: docModal.sectionKey, sourcePath: docModal.sourcePath, customName: docModal.customName }]);
                  setDocModal(null);
                  toast.success(t('employees.docWillUploadOnSave'));
                }}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand"
              >
                {t('employees.addToList')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FormModal>
  );
}
