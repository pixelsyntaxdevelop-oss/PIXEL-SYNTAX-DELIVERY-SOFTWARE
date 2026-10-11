import ExcelJS from 'exceljs';

/**
 * Service to generate the official, enterprise-grade Employee Bulk Import template.
 * Filename: pixel_syntax_master_employees_template.xlsx
 *
 * Rules:
 * 1. Exact 13 columns matching existing import schema.
 * 2. Explicit TEXT format (@) for:
 *    - Employee Code
 *    - Emirates ID
 *    - Personal Mobile
 *    - Company Mobile
 *    - Passport Number
 *    (Guarantees Excel never converts to scientific notation or strips leading zeros)
 * 3. Dates displayed as YYYY-MM-DD.
 * 4. Basic Salary strictly numeric with #,##0.00 format.
 * 5. Professional header styling: deep slate #0F172A background, white bold text, wrapped headers.
 * 6. Frozen top row and active autofilters.
 * 7. Generous column widths.
 */

export interface EmployeeTemplateOptions {
  author?: string;
  companyName?: string;
}

export async function generateMasterEmployeeXlsxTemplate(
  options: EmployeeTemplateOptions = {}
): Promise<Buffer> {
  const author = options.author || 'Pixel Syntax Delivery Software';
  const company = options.companyName || 'Pixel Syntax Delivery Software';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = author;
  workbook.lastModifiedBy = author;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = company;

  const worksheet = workbook.addWorksheet('Master Employees', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }],
    pageSetup: { fitToPage: true, orientation: 'landscape', paperSize: 9 }, // A4
  });

  // Define exact 13 columns with readable, spacious widths
  worksheet.columns = [
    { header: 'Full Name', key: 'full_name', width: 28 },
    { header: 'Employee Code', key: 'employee_code', width: 18, style: { numFmt: '@' } },
    { header: 'Emirates ID', key: 'emirates_id', width: 26, style: { numFmt: '@' } },
    { header: 'Personal Mobile', key: 'personal_mobile', width: 22, style: { numFmt: '@' } },
    { header: 'Company Mobile', key: 'company_mobile', width: 22, style: { numFmt: '@' } },
    { header: 'Passport Number', key: 'passport_number', width: 22, style: { numFmt: '@' } },
    { header: 'Passport Expiry (YYYY-MM-DD)', key: 'passport_expiry', width: 28, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Branch (DXB/AUH/SHJ)', key: 'branch', width: 34 },
    { header: 'Contract / Visa Category (Company Visa/Own Visa/Contractor)', key: 'contractor', width: 44 },
    { header: 'Designation (Bike Rider/Car Driver/Supervisor)', key: 'designation', width: 36 },
    { header: 'Basic Salary (AED)', key: 'basic_salary', width: 20, style: { numFmt: '#,##0.00' } },
    { header: 'Employee Status (Active/Inactive)', key: 'status', width: 32 },
    { header: 'Joining Date (YYYY-MM-DD)', key: 'joining_date', width: 26, style: { numFmt: 'yyyy-mm-dd' } },
  ];

  // Set AutoFilter over all 13 columns
  worksheet.autoFilter = 'A1:M1';

  // Format Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Deep Navy Slate
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0284C7' } }, // Accent blue bottom border
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  // Explicit sample rows demonstrating the data format
  const sampleRows: any[] = [];

  sampleRows.forEach((data) => {
    const row = worksheet.addRow([
      data.full_name,
      data.employee_code,
      data.emirates_id,
      data.personal_mobile,
      data.company_mobile,
      data.passport_number,
      data.passport_expiry,
      data.branch,
      data.contractor,
      data.designation,
      data.basic_salary,
      data.status,
      data.joining_date,
    ]);

    row.height = 24;

    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10.5,
        color: { argb: 'FF0F172A' },
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Column specific alignment & formatting
      // Columns 2 (Code), 3 (EID), 4 (PMobile), 5 (CMobile), 6 (Passport) -> TEXT format (@)
      if ([2, 3, 4, 5, 6].includes(colNumber)) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if ([7, 13].includes(colNumber)) {
        // Dates YYYY-MM-DD
        cell.numFmt = 'yyyy-mm-dd';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 11) {
        // Basic Salary -> numeric
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Pre-format subsequent blank rows (rows 4 to 300) with column styles
  // so Excel preserves text formatting on paste/entry
  for (let r = 4; r <= 300; r++) {
    const row = worksheet.getRow(r);
    // Explicitly lock text formats on text-sensitive columns
    for (const colIdx of [2, 3, 4, 5, 6]) {
      const cell = row.getCell(colIdx);
      cell.numFmt = '@';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    // Dates
    for (const colIdx of [7, 13]) {
      const cell = row.getCell(colIdx);
      cell.numFmt = 'yyyy-mm-dd';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    // Salary
    const salaryCell = row.getCell(11);
    salaryCell.numFmt = '#,##0.00';
    salaryCell.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
