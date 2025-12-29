/**
 * CSV Export Service
 * Generates CSV reports for Construction Risk Radar
 */

class CSVExportService {
  constructor() {
    this.delimiter = ',';
    this.lineEnding = '\n';
  }

  /**
   * Escape CSV field
   */
  escapeField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Convert array of objects to CSV
   */
  arrayToCSV(data, columns) {
    if (!data || data.length === 0) return '';

    // Header row
    const headers = columns.map(col => this.escapeField(col.label || col.key));
    const rows = [headers.join(this.delimiter)];

    // Data rows
    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col.key];
        if (col.transform) {
          value = col.transform(value, item);
        }
        return this.escapeField(value);
      });
      rows.push(row.join(this.delimiter));
    }

    return rows.join(this.lineEnding);
  }

  /**
   * Export portfolio risk summary
   */
  exportPortfolioSummary(portfolioRisk) {
    const columns = [
      { key: 'identifier', label: 'Property Identifier' },
      { key: 'address', label: 'Address' },
      { key: 'score', label: 'Risk Score' },
      { key: 'level', label: 'Risk Level' },
      { key: 'totalViolations', label: 'Total Violations' },
      { key: 'dobViolations', label: 'DOB Violations' },
      { key: 'ecbViolations', label: 'ECB Violations' },
      { key: 'totalPermits', label: 'Total Permits' },
      { key: 'expiredPermits', label: 'Expired Permits' },
      { key: 'totalPenaltiesDue', label: 'Outstanding Penalties ($)' },
      { key: 'topIssue', label: 'Primary Issue' }
    ];

    const data = portfolioRisk.properties.map(property => ({
      identifier: property.identifier,
      address: property.risk.summary.address,
      score: property.risk.overallScore,
      level: property.risk.riskLevel,
      totalViolations: property.risk.summary.totalViolations,
      dobViolations: property.risk.summary.totalDOBViolations,
      ecbViolations: property.risk.summary.totalECBViolations,
      totalPermits: property.risk.summary.totalPermits,
      expiredPermits: property.risk.components.permits.expiredCount || 0,
      totalPenaltiesDue: property.risk.components.violations.ecb?.totalDue || 0,
      topIssue: property.risk.summary.highlightIssues[0]?.message || 'None'
    }));

    return {
      csv: this.arrayToCSV(data, columns),
      filename: `portfolio_risk_summary_${this.getTimestamp()}.csv`,
      recordCount: data.length
    };
  }

  /**
   * Export detailed violations report
   */
  exportViolationsReport(portfolioRisk) {
    const columns = [
      { key: 'propertyId', label: 'Property Identifier' },
      { key: 'address', label: 'Property Address' },
      { key: 'violationType', label: 'Violation Type' },
      { key: 'violationNumber', label: 'Violation Number' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'violationCode', label: 'Violation Code' },
      { key: 'description', label: 'Description' },
      { key: 'severity', label: 'Severity' },
      { key: 'status', label: 'Status' },
      { key: 'penaltyImposed', label: 'Penalty Imposed ($)' },
      { key: 'amountDue', label: 'Amount Due ($)' },
      { key: 'ecbNumber', label: 'ECB Number' },
      { key: 'dispositionDate', label: 'Disposition Date' },
      { key: 'propertyRiskScore', label: 'Property Risk Score' }
    ];

    const data = [];

    for (const property of portfolioRisk.properties) {
      const address = property.risk.summary.address;
      const propertyScore = property.risk.overallScore;

      // DOB Violations
      for (const violation of (property.violations || [])) {
        data.push({
          propertyId: property.identifier,
          address,
          violationType: 'DOB',
          violationNumber: violation.violation_number || violation.isn_dob_bis_viol,
          issueDate: this.formatDate(violation.issue_date),
          violationCode: violation.violation_type_code,
          description: violation.description,
          severity: violation.violation_category,
          status: violation.disposition_comments || 'Open',
          penaltyImposed: '',
          amountDue: '',
          ecbNumber: violation.ecb_number || '',
          dispositionDate: this.formatDate(violation.disposition_date),
          propertyRiskScore: propertyScore
        });
      }

      // ECB Violations
      for (const violation of (property.ecbViolations || [])) {
        data.push({
          propertyId: property.identifier,
          address,
          violationType: 'ECB',
          violationNumber: violation.ecb_violation_number,
          issueDate: this.formatDate(violation.issue_date),
          violationCode: violation.infraction_code1,
          description: violation.violation_description || violation.section_law_description1,
          severity: violation.severity,
          status: violation.ecb_violation_status,
          penaltyImposed: violation.penality_imposed || '',
          amountDue: violation.amount_due || '',
          ecbNumber: violation.ecb_violation_number,
          dispositionDate: '',
          propertyRiskScore: propertyScore
        });
      }
    }

    return {
      csv: this.arrayToCSV(data, columns),
      filename: `violations_detailed_report_${this.getTimestamp()}.csv`,
      recordCount: data.length
    };
  }

  /**
   * Export permits report
   */
  exportPermitsReport(portfolioRisk) {
    const columns = [
      { key: 'propertyId', label: 'Property Identifier' },
      { key: 'address', label: 'Property Address' },
      { key: 'jobFilingNumber', label: 'Job Filing Number' },
      { key: 'workPermit', label: 'Work Permit' },
      { key: 'workType', label: 'Work Type' },
      { key: 'filingReason', label: 'Filing Reason' },
      { key: 'approvedDate', label: 'Approved Date' },
      { key: 'issuedDate', label: 'Issued Date' },
      { key: 'expiredDate', label: 'Expired Date' },
      { key: 'permitStatus', label: 'Permit Status' },
      { key: 'isExpired', label: 'Is Expired' },
      { key: 'ageInDays', label: 'Age (Days)' },
      { key: 'estimatedCost', label: 'Estimated Job Cost ($)' },
      { key: 'jobDescription', label: 'Job Description' },
      { key: 'ownerName', label: 'Owner Name' },
      { key: 'applicantName', label: 'Applicant Name' },
      { key: 'propertyRiskScore', label: 'Property Risk Score' }
    ];

    const data = [];
    const now = new Date();

    for (const property of portfolioRisk.properties) {
      const address = property.risk.summary.address;
      const propertyScore = property.risk.overallScore;

      for (const permit of (property.permits || [])) {
        const expiredDate = permit.expired_date ? new Date(permit.expired_date) : null;
        const issuedDate = permit.issued_date ? new Date(permit.issued_date) : null;
        const isExpired = expiredDate && expiredDate < now;
        const ageInDays = issuedDate ? Math.floor((now - issuedDate) / (1000 * 60 * 60 * 24)) : '';

        data.push({
          propertyId: property.identifier,
          address,
          jobFilingNumber: permit.job_filing_number,
          workPermit: permit.work_permit,
          workType: permit.work_type,
          filingReason: permit.filing_reason,
          approvedDate: this.formatDate(permit.approved_date),
          issuedDate: this.formatDate(permit.issued_date),
          expiredDate: this.formatDate(permit.expired_date),
          permitStatus: permit.permit_status || '',
          isExpired: isExpired ? 'Yes' : 'No',
          ageInDays,
          estimatedCost: permit.estimated_job_costs || '',
          jobDescription: permit.job_description || '',
          ownerName: permit.owner_name || permit.owner_business_name || '',
          applicantName: `${permit.applicant_first_name || ''} ${permit.applicant_last_name || ''}`.trim(),
          propertyRiskScore: propertyScore
        });
      }
    }

    return {
      csv: this.arrayToCSV(data, columns),
      filename: `permits_detailed_report_${this.getTimestamp()}.csv`,
      recordCount: data.length
    };
  }

  /**
   * Export risk recommendations
   */
  exportRecommendations(portfolioRisk) {
    const columns = [
      { key: 'propertyId', label: 'Property Identifier' },
      { key: 'address', label: 'Property Address' },
      { key: 'riskScore', label: 'Risk Score' },
      { key: 'riskLevel', label: 'Risk Level' },
      { key: 'priority', label: 'Recommendation Priority' },
      { key: 'category', label: 'Category' },
      { key: 'action', label: 'Recommended Action' },
      { key: 'rationale', label: 'Rationale' }
    ];

    const data = [];

    for (const property of portfolioRisk.properties) {
      const address = property.risk.summary.address;
      const score = property.risk.overallScore;
      const level = property.risk.riskLevel;

      for (const rec of (property.risk.recommendations || [])) {
        data.push({
          propertyId: property.identifier,
          address,
          riskScore: score,
          riskLevel: level,
          priority: rec.priority,
          category: rec.category,
          action: rec.action,
          rationale: rec.rationale
        });
      }
    }

    return {
      csv: this.arrayToCSV(data, columns),
      filename: `risk_recommendations_${this.getTimestamp()}.csv`,
      recordCount: data.length
    };
  }

  /**
   * Export complete portfolio package (multiple CSVs as object)
   */
  exportCompletePackage(portfolioRisk) {
    return {
      summary: this.exportPortfolioSummary(portfolioRisk),
      violations: this.exportViolationsReport(portfolioRisk),
      permits: this.exportPermitsReport(portfolioRisk),
      recommendations: this.exportRecommendations(portfolioRisk),
      metadata: {
        generatedAt: new Date().toISOString(),
        propertyCount: portfolioRisk.propertyCount,
        averageRiskScore: portfolioRisk.averageRiskScore,
        portfolioRiskLevel: portfolioRisk.portfolioRiskLevel
      }
    };
  }

  /**
   * Format date for CSV
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * Get timestamp for filenames
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }
}

module.exports = CSVExportService;
