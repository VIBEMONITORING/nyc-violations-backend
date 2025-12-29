/**
 * NYC Open Data Dataset Configuration
 * Construction Risk Radar - DOB Data Sources
 */

const NYC_OPEN_DATA_BASE_URL = 'https://data.cityofnewyork.us/resource';

const DATASETS = {
  // DOB NOW: Build – Approved Permits
  DOB_NOW_PERMITS: {
    id: 'rbx6-tga4',
    name: 'DOB NOW: Build – Approved Permits',
    endpoint: `${NYC_OPEN_DATA_BASE_URL}/rbx6-tga4.json`,
    description: 'Approved construction permits from DOB NOW (excludes Electrical, Elevator, LAA)',
    queryFields: {
      bbl: 'bbl',
      bin: 'bin',
      borough: 'borough',
      block: 'block',
      lot: 'lot'
    },
    keyFields: [
      'job_filing_number',
      'work_permit',
      'filing_reason',
      'house_no',
      'street_name',
      'borough',
      'bin',
      'block',
      'lot',
      'bbl',
      'work_type',
      'approved_date',
      'issued_date',
      'expired_date',
      'permit_status',
      'job_description',
      'estimated_job_costs',
      'owner_business_name',
      'owner_name',
      'latitude',
      'longitude'
    ]
  },

  // DOB Violations (Active)
  DOB_VIOLATIONS_ACTIVE: {
    id: 'cepu-5g8r',
    name: 'DOB Violations (Active)',
    endpoint: `${NYC_OPEN_DATA_BASE_URL}/cepu-5g8r.json`,
    description: 'Active violations issued by the Department of Buildings',
    queryFields: {
      bin: 'bin',
      borough: 'boro',
      block: 'block',
      lot: 'lot'
    },
    keyFields: [
      'isn_dob_bis_viol',
      'boro',
      'bin',
      'block',
      'lot',
      'issue_date',
      'violation_type_code',
      'violation_number',
      'house_number',
      'street',
      'disposition_date',
      'disposition_comments',
      'device_number',
      'description',
      'ecb_number',
      'number',
      'violation_category',
      'violation_type'
    ],
    // Violation severity classifications based on NYC DOB standards
    severityMapping: {
      'V*-DOB VIOLATION - DISMISSED': { level: 0, weight: 0 },
      'V-DOB VIOLATION': { level: 1, weight: 1 },
      'AEUHAZ1-EMERGENCY/HAZARDOUS': { level: 5, weight: 5 },
      'AEUHAZ2-EMERGENCY/HAZARDOUS': { level: 5, weight: 5 },
      'AEUAMEND': { level: 2, weight: 2 },
      'B-BOILER': { level: 3, weight: 3 },
      'C-CONSTRUCTION': { level: 3, weight: 3 },
      'CMQ-COMPULSORY MODIFICATION': { level: 4, weight: 4 },
      'E-ELEVATOR': { level: 4, weight: 4 },
      'EGNCY-EMERGENCY': { level: 5, weight: 5 },
      'HBLVIO-HIGH PRESSURE BOILER': { level: 4, weight: 4 },
      'HVIOAM-AMENDED': { level: 2, weight: 2 },
      'LBLVIO-LOW PRESSURE BOILER': { level: 3, weight: 3 },
      'LL1080-LOCAL LAW': { level: 3, weight: 3 },
      'LL11-LOCAL LAW 11': { level: 3, weight: 3 },
      'LL2604-LOCAL LAW 26': { level: 3, weight: 3 },
      'LL6291-LOCAL LAW 62': { level: 3, weight: 3 },
      'P-PLUMBING': { level: 2, weight: 2 },
      'UB-UNSAFE BUILDING': { level: 5, weight: 5 },
      'VCAT1-CLASS 1': { level: 1, weight: 1 },
      'VCAT2-CLASS 2': { level: 2, weight: 2 },
      'VCAT3-CLASS 3': { level: 3, weight: 3 },
      'VCAT4-IMMEDIATELY HAZARDOUS': { level: 5, weight: 5 }
    }
  },

  // DOB ECB Violations
  DOB_ECB_VIOLATIONS: {
    id: '6bgk-3dad',
    name: 'DOB ECB Violations',
    endpoint: `${NYC_OPEN_DATA_BASE_URL}/6bgk-3dad.json`,
    description: 'Summonses issued by DOB adjudicated by OATH/ECB',
    queryFields: {
      bin: 'bin',
      borough: 'boro',
      block: 'block',
      lot: 'lot'
    },
    keyFields: [
      'isn_dob_bis_extract',
      'ecb_violation_number',
      'bin',
      'boro',
      'block',
      'lot',
      'ecb_violation_status',
      'dob_violation_number',
      'dob_violation_status',
      'issue_date',
      'severity',
      'violation_type',
      'violation_description',
      'penality_imposed',
      'amount_paid',
      'amount_due',
      'infraction_code1',
      'section_law_description1',
      'hearing_status',
      'hearing_date',
      'scheduled_hearing_date',
      'actual_hearing_date',
      'respondent_name',
      'respondent_house_number',
      'respondent_street',
      'house_number',
      'street',
      'certif_correction_deadline',
      'aggravated_level'
    ],
    // ECB Severity classifications
    severityMapping: {
      'Unknown': { level: 1, weight: 1, typicalFine: [500, 1500] },
      'NON-HAZARDOUS': { level: 1, weight: 1, typicalFine: [500, 2500] },
      'MINOR': { level: 2, weight: 2, typicalFine: [1000, 2500] },
      'LESSER': { level: 2, weight: 2, typicalFine: [1500, 5000] },
      'AGGRAVATED I': { level: 3, weight: 3, typicalFine: [2500, 10000] },
      'AGGRAVATED II': { level: 4, weight: 4, typicalFine: [5000, 15000] },
      'MAJOR': { level: 4, weight: 4, typicalFine: [5000, 10000] },
      'HAZARDOUS': { level: 5, weight: 5, typicalFine: [10000, 25000] },
      'IMMEDIATELY HAZARDOUS': { level: 5, weight: 5, typicalFine: [15000, 25000] }
    }
  }
};

// Borough code mappings
const BOROUGH_CODES = {
  '1': 'MANHATTAN',
  '2': 'BRONX',
  '3': 'BROOKLYN',
  '4': 'QUEENS',
  '5': 'STATEN ISLAND',
  'MN': 'MANHATTAN',
  'BX': 'BRONX',
  'BK': 'BROOKLYN',
  'QN': 'QUEENS',
  'SI': 'STATEN ISLAND',
  'MANHATTAN': '1',
  'BRONX': '2',
  'BROOKLYN': '3',
  'QUEENS': '4',
  'STATEN ISLAND': '5'
};

module.exports = {
  DATASETS,
  BOROUGH_CODES,
  NYC_OPEN_DATA_BASE_URL
};
