# Branch Domain Contract

This document captures the **current runtime contract** of the Branches domain as it exists today in the system. It is intended to serve as a **safety reference for future refactoring**.

The current behavior is the source of truth.

- No schema rewrites are assumed.
- No query rewrites are assumed.
- No UI structure changes are assumed.
- No save, delete, archive, or linked-branch semantics are changed by this document.

---

## 1. Overview

The Branches domain is one of the most connected and behavior-sensitive parts of the application.

A branch is not only a display entity. It participates in:

- employee work assignment
- employee contract assignment
- internal loan assignment
- branch establishment activation
- branch license and lease tracking
- lease installment tracking
- tax entity linkage
- branch-linked phones
- branch-linked documents
- employer-to-branch relationships
- activity log references
- archive and restore flows

In practice, the Branches domain behaves as a **hub domain** with both:

- direct state stored in `branches`
- related state stored in dependent tables such as `branch_licenses`, `branch_leases`, `lease_installments`, `branch_establishments`, and `branch_custom_fields`

Because of this, even small refactors can have cross-module impact.

---

## 2. Scope

This contract documents the current runtime behavior for:

- `src/components/Branches/BranchProfile.tsx`
- `src/components/Branches/ViewBranchModal.tsx`
- `src/components/Branches/AddBranchModal.tsx`
- `src/components/Branches/Branches.tsx`

It also references related runtime dependencies where needed:

- employees
- phones
- housing
- vehicles
- employers
- tax entities
- documents
- activity logs

This document does **not** redefine the domain. It only describes the current implementation contract that should be preserved unless a future change is intentionally planned and validated.

---

## 3. Branch Domain Sensitivity Summary

The Branches domain is sensitive for the following reasons:

### High coupling

Branches are referenced by many other modules through:

- `workBranchId`
- `contractBranchId`
- `loanBranchId`
- `assignedBranchId`
- `branchId`
- `attachedToId`
- `tax_entity_branches`
- `branch_employers`

### Mixed data model usage

The runtime shape mixes:

- legacy branch-level fields in `branches`
- relation-derived fields from dedicated tables

For example, `Branches.tsx` still consumes a flat list shape that includes values such as:

- `tradeLicenseNo`
- `tradeLicenseExpiry`
- `establishmentCardNo`
- `establishmentCardExpiry`

while `BranchProfile` and `AddBranchModal` rely on dedicated tables:

- `branch_licenses`
- `branch_leases`
- `branch_establishments`

### Repeated query logic

The same or nearly identical branch-loading logic appears in:

- `BranchProfile`
- `ViewBranchModal`
- `AddBranchModal` edit mode

The same behavioral helpers also appear more than once:

- `computeLiveStatus`
- `isTimeInRange`
- `shouldShowUpdateButton`
- label helpers

### Business rules encoded inside UI code

Current UI code contains runtime business assumptions such as:

- branch employees are determined by `workBranchId`
- establishment employees are determined by `COALESCE(contractBranchId, workBranchId)`
- internal secondment employees are determined by `loanBranchId + status + loanType`
- office and website branches hide specific sections and rely on `attachedToId`

These rules are part of the runtime contract and should be treated as behavior, not just implementation detail.

---

## 4. Current Runtime Contracts

## 4.1 `BranchProfile`

### Purpose

Displays the full branch profile screen and aggregates most branch-related runtime behavior.

### Runtime data sources

`BranchProfile` currently reads from:

- `branches`
- `branch_licenses`
- `branch_leases`
- `lease_installments`
- `branch_establishments`
- `branch_custom_fields`
- `employees`
- `tax_entity_branches`
- `entities`
- documents via `documentList('branch', branchId)`
- phones via `assignedBranchId`

### Runtime query contract

The main load flow currently expects:

1. One branch row from `branches`
2. Optional single related row from `branch_licenses`
3. Optional single related row from `branch_leases`
4. Zero or more `lease_installments`
5. Optional single related row from `branch_establishments`
6. Zero or more `branch_custom_fields`
7. Active branch employees from `employees` where `workBranchId = branchId`
8. Optional tax entity link from `tax_entity_branches`
9. Optional tax entity details from `entities`
10. Optional linked physical branch from `branches` via `attachedToId`
11. Optional branch documents
12. Optional branch phones

### Runtime state shape expected by the screen

`BranchProfile` expects the branch screen state to be represented approximately as:

- `branch: BranchDetails | null`
- `employees: BranchEmployee[]`
- `establishmentEmployees: EstablishmentEmployee[]`
- `branchDocuments: BranchDocument[]`
- `branchPhones: BranchPhone[]`
- `docPreview: { url: string; name: string; relativePath?: string } | null`
- `linkedEmployeesCount: number | null`
- `entitySubTab: 'entityInfo' | 'entityEmployees'`

### Behavioral contract

The following behaviors are part of the current contract:

- `branch.license`, `branch.lease`, `branch.leaseInstallments`, `branch.establishment`, and `branch.customFields` are nested into the loaded branch view state
- `linkedBranch` is only populated when `attachedToId` exists
- `taxEntityTrn` and `taxEntityCorporateTax` are derived values added to the runtime branch object
- the `entity` tab is visible only when establishment is enabled and the branch type allows it
- the `phones` tab is backed by a separate phones query
- archive/delete protection uses employee linkage checks before allowing destructive actions

### Sensitive assumptions

The screen assumes all of the following are stable:

- `COALESCE(contractBranchId, workBranchId)` is the establishment employee rule
- internal seconded employees are identified by `loanBranchId`, `status = seconded`, and `loanType = internal`
- document sections such as `license_expiry`, `lease`, and `establishment_immigration_expiry` are preserved
- office and website branches may behave differently from store/workshop branches

---

## 4.2 `ViewBranchModal`

### Purpose

Displays a branch details modal that mirrors much of `BranchProfile` behavior in a lighter context.

### Runtime data sources

`ViewBranchModal` currently reads from:

- `branches`
- `branch_licenses`
- `branch_leases`
- `branch_establishments`
- `branch_custom_fields`
- `employees`

### Runtime query contract

The current load flow expects:

1. One branch row from `branches`
2. Optional license row
3. Optional lease row
4. Optional establishment row
5. Zero or more custom fields
6. Active branch employees via `workBranchId`
7. Establishment employees using the same contract and internal secondment rules used by `BranchProfile`

### Runtime state shape expected by the screen

- `branch: BranchDetails | null`
- `employees: BranchEmployee[]`
- `establishmentEmployees: EstablishmentEmployee[]`
- `imageUrl: string | null`
- `activeTab: 'basic' | 'licenses' | 'entity' | 'employees' | 'documents'`

### Behavioral contract

- `ViewBranchModal` expects a branch object with nested `license`, `lease`, `establishment`, and `customFields`
- status labels for establishment employees follow the same derived rules as `BranchProfile`
- update-expiry flows use branch-specific `entityType = 'branch'`

### Sensitivity note

Although lighter than `BranchProfile`, this modal duplicates important branch rules and should be treated as behaviorally coupled to the full profile screen.

---

## 4.3 `AddBranchModal`

### Purpose

Creates and edits a branch along with several dependent records.

### Runtime data sources in edit mode

When editing, the modal currently reads from:

- `branches`
- `branch_licenses`
- `branch_leases`
- `lease_installments`
- `branch_establishments`
- `branch_custom_fields`

It also reads physical branches for linked-branch selection.

### Runtime input contract

The modal expects the runtime form state to cover:

- basic branch fields
- branch type
- linked physical branch
- work timing schedule
- image preview / image filename
- license fields
- lease fields
- lease installments
- establishment fields
- custom sections
- pending documents

### Runtime form state shape

The current screen logic expects:

- `form`
- `workSchedule`
- `customSections`
- `pendingDocs`
- `physicalBranches`
- `docModal`

### Behavioral contract

The following are current runtime rules:

- `office` and `website` require `linkedBranchId`
- `store` and `workshop` can maintain license and lease sections
- `workTimingSlots` is saved as either:
  - a JSON schedule object
  - or `{"_24h":true}`
- custom sections are stored as JSON in `branch_custom_fields.content`
- edit mode reloads existing branch-dependent rows and maps them into local form state

### Critical safety note

`AddBranchModal` is not only a form. It is a multi-table save orchestrator. Its runtime behavior depends on the current save order and conditional branching between:

- `branches`
- `branch_licenses`
- `branch_leases`
- `lease_installments`
- `branch_establishments`
- `branch_custom_fields`
- document save flows

This makes it one of the highest-risk files for future refactoring.

---

## 4.4 `Branches`

### Purpose

Displays the branch listing screen, supports filtering, and derives live status and expiry alerts.

### Runtime data sources

`Branches.tsx` currently reads from:

- `branches`
- `branch_licenses` via subquery
- `branch_leases` via subquery
- `branch_establishments` via subquery
- `tax_entity_branches` via subquery
- `phones` via subquery
- `branch_custom_fields` for custom alerts

### Runtime query contract

The listing screen expects a flat row shape with:

- direct branch columns from `branches`
- flat relation-derived fields such as:
  - `licenseExpiry`
  - `leaseExpiry`
  - `establishmentExpiry`
  - `establishmentEnabled`
  - `taxLinked`
  - `assignedPhones`

### Runtime state shape expected by the screen

- `branches: BranchListItem[]`
- `customAlerts: { branchId: number; title: string; alertDate: string }[]`
- `filterBy`
- `filterValue`
- `entityOptions`

### Behavioral contract

- the listing screen treats current query output as a flat projection, not a nested branch aggregate
- filtering behavior is implemented directly at query-building time
- branch live status is computed locally from `workTimingSlots` and `status`
- alert cards are composed from both built-in branch expiries and custom alert dates

### Sensitivity note

This screen still uses a mixed model of:

- direct branch columns
- relation-derived subqueries
- custom alert overlays

That mixed shape is part of the current runtime contract.

---

## 5. Shared Type Proposal

The following proposed shared types are intended only to describe and stabilize the current runtime contract. They do not imply logic changes.

```ts
export interface BranchLicense {
  id: number;
  branchId?: number;
  licenseNo?: string;
  tradeName?: string;
  tradeNameEn?: string;
  issueDate?: string;
  expiryDate?: string;
}

export interface BranchLeaseInstallment {
  id: number;
  seq: number;
  amount: number;
  dueDate?: string;
  note?: string;
}

export interface BranchLease {
  id: number;
  branchId?: number;
  contractNo?: string;
  landlordName?: string;
  amount?: number;
  issueDate?: string;
  expiryDate?: string;
  installments?: BranchLeaseInstallment[];
}

export interface BranchEstablishment {
  id?: number;
  branchId?: number;
  isEnabled?: number | boolean;
  laborEstablishmentCardNo?: string;
  immigrationEstablishmentCardNo?: string;
  immigrationCardIssueDate?: string;
  immigrationCardExpiryDate?: string;
  trn?: string;
  corporateTaxRegistration?: string;
}

export interface BranchDocument {
  id: number;
  relativePath: string;
  customName: string | null;
  section: string | null;
}

export interface BranchPhone {
  id: number;
  phoneNumber: string;
  provider: string;
  category: string;
  numberType: string;
  registeredName: string;
}

export interface BranchEmployee {
  id: number;
  name: string;
  phone?: string;
  profession?: string;
  professionPerContract?: string;
  imagePath?: string;
  actualSalary?: number;
  status?: string;
  loanType?: string;
  loanSubStatus?: string;
  workCardNumber?: string;
  workCardExpiry?: string;
}

export interface EstablishmentEmployee {
  id: number;
  name: string;
  imagePath?: string;
  isSecondedToThis: boolean;
  contractTypeLabel: string;
  totalSalary?: number;
  professionPerContract: string;
  contractExpiryDate?: string;
  emiratesIdExpiry?: string;
  workStatusLabel: string;
}

export interface BranchDetails {
  id: number;
  code?: string;
  name: string;
  nameEn?: string;
  country?: string;
  emirate: string;
  city?: string;
  address?: string;
  phone?: string;
  photoPath?: string;
  branchType: string;
  status: string;
  workHours?: string;
  workTimingSlots?: string;
  googleMapUrl?: string;
  attachedToId?: number;
  linkedBranch?: {
    id: number;
    name: string;
    emirate?: string;
    city?: string;
    address?: string;
  };
  license?: BranchLicense;
  lease?: BranchLease;
  establishment?: BranchEstablishment;
  customFields?: Array<{
    id: number;
    title: string;
    content?: string;
    enableAlert?: boolean;
    alertDate?: string;
    daysBeforeExpiry?: number;
  }>;
  taxEntityTrn?: string;
  taxEntityCorporateTax?: string;
}
```

---

## 6. Safe Helper Extraction Candidates

The following helper candidates appear safe to extract later **only if extraction is behavior-identical**.

### Candidate helpers

- `isTimeInRange(now, from, to)`
- `computeLiveStatus(workTimingSlots, status)`
- `shouldShowUpdateButton(dateStr)`
- `getEmirateLabel(value)`
- `getBranchTypeLabel(value)`
- establishment employee mapping helpers
- custom field parsing helpers
- branch expiry aggregation helpers

### Candidate extraction rules

Any future extraction must preserve:

- identical input contract
- identical output values
- identical fallback behavior
- identical date parsing behavior
- identical status-label derivation behavior

### Not included in safe helper candidates

The following are not considered safe helper extraction targets at this stage:

- save orchestration logic
- delete and archive orchestration logic
- query-building logic
- linked-branch semantics
- business rules that decide employee grouping unless verified against current behavior

---

## 7. Risk Map

## 7.1 Safe to Touch

The following work is generally safe if done conservatively:

- documentation updates
- shared TypeScript type definitions only
- pure helper candidate identification
- constants for labels and status text, if behavior-identical
- runtime contract documentation for current query shapes

## 7.2 Risky

The following work is possible later, but should be treated as medium-to-high risk:

- replacing `SELECT *` with explicit columns
- deduplicating branch load queries
- unifying `BranchProfile` and `ViewBranchModal`
- strongly typing `branch.establishment` in-place
- extracting mapping logic for establishment employees
- extracting document preview rendering
- centralizing branch list projection used by `Branches.tsx`

These changes may still be valuable, but they require verification against current runtime behavior.

## 7.3 Do Not Touch

The following areas should not be changed in an early safety pass:

- save flow in `AddBranchModal`
- delete flow in `BranchProfile`
- archive blocking logic in `BranchProfile`
- employee grouping semantics using:
  - `workBranchId`
  - `contractBranchId`
  - `loanBranchId`
  - `COALESCE(contractBranchId, workBranchId)`
- office and website linked-branch semantics via `attachedToId`
- document section naming and branch document routing
- current `Branches.tsx` query behavior
- current branch-to-tax-entity runtime linkage behavior

---

## 8. Behavioral Invariants

The following invariants should be treated as current runtime truth and preserved during future refactoring.

### Branch-type invariants

- `store` and `workshop` behave as physical branches
- `office` and `website` behave differently and may hide establishment or property-specific sections
- office and website branches rely on `attachedToId`

### Employee relationship invariants

- branch employees are currently derived from `workBranchId`
- establishment employees are currently derived from `COALESCE(contractBranchId, workBranchId)`
- internal seconded employees are currently derived from `loanBranchId` with secondment-specific filters

### Branch aggregate invariants

- a branch profile may include nested license, lease, installments, establishment, and custom field data
- listing screen rows are flat projections, not nested branch aggregates
- tax entity data may be derived and merged into the branch runtime object

### Document invariants

- branch documents use `entityType = 'branch'`
- branch document sections are meaningful behavior and must remain stable for current runtime flows

### Expiry invariants

- update buttons appear based on current "expired or within 30 days" behavior
- live status is computed from branch status plus `workTimingSlots`
- custom alert dates participate in listing-level expiry display

### Safety invariants

- current behavior is the source of truth even if duplication exists
- repeated logic should be treated as duplicated behavior, not automatically as refactor-ready code

---

## 9. Future Safe Refactor Checklist

This checklist is intentionally conservative.

1. Create shared branch-domain type definitions only.
2. Ensure `BranchProfile` and `ViewBranchModal` can reference the same type contracts without runtime changes.
3. Write tests or behavior snapshots around branch loading before changing any SQL.
4. Extract only pure helpers first:
   - `isTimeInRange`
   - `computeLiveStatus`
   - `shouldShowUpdateButton`
   - label helpers
5. Verify extracted helpers against current visual and behavioral output.
6. Extract establishment employee mapping into a pure helper only after confirming identical labels and fallbacks.
7. Do not change query structure while introducing shared types.
8. Do not change save order or branching behavior in `AddBranchModal`.
9. Do not change delete or archive logic in `BranchProfile`.
10. Do not change linked-branch behavior for office and website branches.
11. Do not alter branch document section conventions.
12. Keep the branch list screen contract flat until explicitly migrated in a later planned pass.
13. If a later refactor is approved, proceed in this order:
    - types
    - pure helpers
    - UI decomposition only
    - then query stabilization in a separate controlled pass

---

## Final Note

This document does not define the ideal architecture of the Branches domain.

It defines the **current runtime contract that future work must preserve** unless a later change is intentionally designed, validated, and tested as a behavior change.
