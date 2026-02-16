import { PrismaClient, Decimal } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hash(password: string): string {
  return hashSync(password, 10);
}

function generateBarcode(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LF${ts}${rand}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function pad(n: number, width = 6): string {
  return String(n).padStart(width, '0');
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding LabFlow database...');

  // Clean existing data in reverse-dependency order
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.approvalAction.deleteMany(),
    prisma.testResult.deleteMany(),
    prisma.test.deleteMany(),
    prisma.specificationLimit.deleteMany(),
    prisma.specification.deleteMany(),
    prisma.chainOfCustodyEntry.deleteMany(),
    prisma.sample.deleteMany(),
    prisma.invoiceLineItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.creditNote.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.order.deleteMany(),
    prisma.project.deleteMany(),
    prisma.clientContact.deleteMany(),
    prisma.priceListItem.deleteMany(),
    prisma.priceList.deleteMany(),
    prisma.client.deleteMany(),
    prisma.testAnalyte.deleteMany(),
    prisma.testMethod.deleteMany(),
    prisma.instrument.deleteMany(),
    prisma.storageLocation.deleteMany(),
    prisma.report.deleteMany(),
    prisma.reportTemplate.deleteMany(),
    prisma.workflowConfig.deleteMany(),
    prisma.user.deleteMany(),
    prisma.sequence.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  // =========================================================================
  // Organization
  // =========================================================================

  const org = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: 'LabFlow Demo Lab',
      slug: 'labflow-demo-lab',
      address: '1234 Laboratory Drive, Suite 100',
      city: 'Sacramento',
      state: 'CA',
      zip: '95814',
      country: 'US',
      phone: '+1-916-555-0100',
      email: 'info@labflow.dev',
      website: 'https://labflow.dev',
      licenseNumber: 'CA-LIC-2024-00123',
      accreditations: ['ISO 17025', 'NELAP', 'A2LA'],
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      fiscalYearStart: 1,
      defaultPaymentTerms: 'NET_30',
      settings: {},
    },
  });

  console.log(`  Created organization: ${org.name}`);

  // =========================================================================
  // Users
  // =========================================================================

  const passwordHash = hash('password123');

  const usersData = [
    {
      email: 'admin@labflow.dev',
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN' as const,
      title: 'System Administrator',
    },
    {
      email: 'sarah.chen@labflow.dev',
      firstName: 'Sarah',
      lastName: 'Chen',
      role: 'LAB_DIRECTOR' as const,
      title: 'Laboratory Director, Ph.D.',
    },
    {
      email: 'mike.johnson@labflow.dev',
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'LAB_MANAGER' as const,
      title: 'Laboratory Manager',
    },
    {
      email: 'emily.rodriguez@labflow.dev',
      firstName: 'Emily',
      lastName: 'Rodriguez',
      role: 'SENIOR_ANALYST' as const,
      title: 'Senior Analyst',
    },
    {
      email: 'alex.kim@labflow.dev',
      firstName: 'Alex',
      lastName: 'Kim',
      role: 'ANALYST' as const,
      title: 'Analyst',
    },
    {
      email: 'jamie.obrien@labflow.dev',
      firstName: 'Jamie',
      lastName: "O'Brien",
      role: 'SAMPLE_RECEIVER' as const,
      title: 'Sample Receiving Coordinator',
    },
    {
      email: 'pat.williams@labflow.dev',
      firstName: 'Pat',
      lastName: 'Williams',
      role: 'BILLING_ADMIN' as const,
      title: 'Billing Administrator',
    },
  ];

  const users: Record<string, string> = {};
  for (const u of usersData) {
    const created = await prisma.user.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        title: u.title,
        isActive: true,
        permissions: [],
        notificationPrefs: {},
      },
    });
    users[u.role] = created.id;
  }

  console.log(`  Created ${usersData.length} users`);

  // =========================================================================
  // Instruments
  // =========================================================================

  const instrumentsData = [
    {
      name: 'Agilent 7850 ICP-MS',
      type: 'ICP-MS',
      manufacturer: 'Agilent Technologies',
      model: '7850',
      serialNumber: 'SN-ICP-2024-001',
      location: 'Metals Lab - Room 101',
    },
    {
      name: 'SCIEX Triple Quad 6500+ LC-MS/MS',
      type: 'LC-MS/MS',
      manufacturer: 'SCIEX',
      model: 'Triple Quad 6500+',
      serialNumber: 'SN-LCMS-2024-002',
      location: 'Organics Lab - Room 102',
    },
    {
      name: 'bioMerieux TEMPO',
      type: 'Microbiology Analyzer',
      manufacturer: 'bioMerieux',
      model: 'TEMPO',
      serialNumber: 'SN-MICRO-2024-003',
      location: 'Microbiology Lab - Room 103',
    },
    {
      name: 'Agilent 7890B GC-MS',
      type: 'GC-MS',
      manufacturer: 'Agilent Technologies',
      model: '7890B',
      serialNumber: 'SN-GCMS-2024-004',
      location: 'Solvents Lab - Room 104',
    },
    {
      name: 'Mettler Toledo HX204 Moisture Analyzer',
      type: 'Moisture Analyzer',
      manufacturer: 'Mettler Toledo',
      model: 'HX204',
      serialNumber: 'SN-MOIST-2024-005',
      location: 'General Lab - Room 105',
    },
  ];

  const instruments: string[] = [];
  for (const inst of instrumentsData) {
    const created = await prisma.instrument.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        name: inst.name,
        type: inst.type,
        manufacturer: inst.manufacturer,
        model: inst.model,
        serialNumber: inst.serialNumber,
        location: inst.location,
        lastCalibrationDate: daysAgo(30),
        nextCalibrationDate: daysFromNow(335),
        calibrationFrequency: 365,
        calibrationStatus: 'CURRENT',
        isActive: true,
      },
    });
    instruments.push(created.id);
  }

  console.log(`  Created ${instrumentsData.length} instruments`);

  // =========================================================================
  // Storage Locations
  // =========================================================================

  const storageData = [
    { name: 'Refrigerator A', type: 'Refrigerator', temperature: '2-8°C', capacity: 200 },
    { name: 'Freezer B', type: 'Freezer', temperature: '-20°C', capacity: 100 },
    { name: 'Ambient Shelf C', type: 'Shelf', temperature: 'Room Temp', capacity: 300 },
    { name: 'Hazmat Cabinet D', type: 'Hazmat Cabinet', temperature: 'Room Temp', capacity: 50 },
  ];

  const storageLocations: string[] = [];
  for (const sl of storageData) {
    const created = await prisma.storageLocation.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        name: sl.name,
        type: sl.type,
        building: 'Main Building',
        room: 'Sample Storage',
        temperature: sl.temperature,
        capacity: sl.capacity,
        currentCount: 0,
        isActive: true,
      },
    });
    storageLocations.push(created.id);
  }

  console.log(`  Created ${storageData.length} storage locations`);

  // =========================================================================
  // Test Methods & Analytes
  // =========================================================================

  interface AnalyteDef {
    name: string;
    code: string;
    unit: string;
    decimalPlaces: number;
    reportingLimit?: number;
  }

  interface TestMethodDef {
    code: string;
    name: string;
    category: string;
    methodology: string;
    analytes: AnalyteDef[];
    requiresCalibration: boolean;
    defaultTurnaroundDays: number;
    sampleMatrices: string[];
  }

  const testMethodsData: TestMethodDef[] = [
    {
      code: 'METALS-ICP',
      name: 'Heavy Metals by ICP-MS',
      category: 'Metals',
      methodology: 'EPA 6020B',
      requiresCalibration: true,
      defaultTurnaroundDays: 5,
      sampleMatrices: ['Cannabis', 'Water', 'Soil', 'Food'],
      analytes: [
        { name: 'Lead', code: 'Pb', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Arsenic', code: 'As', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Cadmium', code: 'Cd', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Mercury', code: 'Hg', unit: 'ppb', decimalPlaces: 3, reportingLimit: 0.1 },
      ],
    },
    {
      code: 'PEST-LCMS',
      name: 'Pesticide Screen by LC-MS/MS',
      category: 'Pesticides',
      methodology: 'Modified EPA 8321',
      requiresCalibration: true,
      defaultTurnaroundDays: 7,
      sampleMatrices: ['Cannabis', 'Food', 'Soil'],
      analytes: [
        { name: 'Myclobutanil', code: 'MYCLUB', unit: 'ppm', decimalPlaces: 3, reportingLimit: 0.01 },
        { name: 'Bifenazate', code: 'BIFEN', unit: 'ppm', decimalPlaces: 3, reportingLimit: 0.01 },
        { name: 'Spiromesifen', code: 'SPIRO', unit: 'ppm', decimalPlaces: 3, reportingLimit: 0.01 },
        { name: 'Abamectin', code: 'ABAM', unit: 'ppm', decimalPlaces: 3, reportingLimit: 0.01 },
        { name: 'Imidacloprid', code: 'IMID', unit: 'ppm', decimalPlaces: 3, reportingLimit: 0.01 },
      ],
    },
    {
      code: 'MICRO-TPC',
      name: 'Total Plate Count',
      category: 'Microbiology',
      methodology: 'FDA BAM Chapter 3',
      requiresCalibration: false,
      defaultTurnaroundDays: 3,
      sampleMatrices: ['Cannabis', 'Food', 'Water'],
      analytes: [
        { name: 'Total Aerobic Count', code: 'TAC', unit: 'CFU/g', decimalPlaces: 0, reportingLimit: 10 },
      ],
    },
    {
      code: 'MICRO-EC',
      name: 'E. coli / Coliform',
      category: 'Microbiology',
      methodology: 'FDA BAM Chapter 4',
      requiresCalibration: false,
      defaultTurnaroundDays: 3,
      sampleMatrices: ['Cannabis', 'Food', 'Water'],
      analytes: [
        { name: 'E. coli', code: 'ECOLI', unit: 'CFU/g', decimalPlaces: 0, reportingLimit: 1 },
        { name: 'Total Coliform', code: 'TCOLI', unit: 'CFU/g', decimalPlaces: 0, reportingLimit: 1 },
      ],
    },
    {
      code: 'POT-CANN',
      name: 'Cannabinoid Potency',
      category: 'Potency',
      methodology: 'HPLC-UV Internal Method',
      requiresCalibration: true,
      defaultTurnaroundDays: 3,
      sampleMatrices: ['Cannabis'],
      analytes: [
        { name: 'THC', code: 'THC', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
        { name: 'THCA', code: 'THCA', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
        { name: 'CBD', code: 'CBD', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
        { name: 'CBDA', code: 'CBDA', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
        { name: 'CBN', code: 'CBN', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
        { name: 'CBG', code: 'CBG', unit: '%', decimalPlaces: 2, reportingLimit: 0.01 },
      ],
    },
    {
      code: 'SOLV-GC',
      name: 'Residual Solvents by GC-MS',
      category: 'Residual Solvents',
      methodology: 'USP <467>',
      requiresCalibration: true,
      defaultTurnaroundDays: 5,
      sampleMatrices: ['Cannabis', 'Pharmaceutical'],
      analytes: [
        { name: 'Butane', code: 'BUTANE', unit: 'ppm', decimalPlaces: 1, reportingLimit: 1 },
        { name: 'Propane', code: 'PROPANE', unit: 'ppm', decimalPlaces: 1, reportingLimit: 1 },
        { name: 'Ethanol', code: 'ETHANOL', unit: 'ppm', decimalPlaces: 1, reportingLimit: 1 },
        { name: 'Isopropanol', code: 'IPA', unit: 'ppm', decimalPlaces: 1, reportingLimit: 1 },
        { name: 'Acetone', code: 'ACETONE', unit: 'ppm', decimalPlaces: 1, reportingLimit: 1 },
      ],
    },
    {
      code: 'MOIST',
      name: 'Moisture Content',
      category: 'Physical',
      methodology: 'AOAC 934.06',
      requiresCalibration: false,
      defaultTurnaroundDays: 1,
      sampleMatrices: ['Cannabis', 'Food', 'Soil'],
      analytes: [
        { name: 'Moisture', code: 'MOIST', unit: '%', decimalPlaces: 2, reportingLimit: 0.1 },
      ],
    },
    {
      code: 'WATER-ACT',
      name: 'Water Activity',
      category: 'Physical',
      methodology: 'AOAC 978.18',
      requiresCalibration: false,
      defaultTurnaroundDays: 1,
      sampleMatrices: ['Cannabis', 'Food'],
      analytes: [
        { name: 'Water Activity', code: 'AW', unit: 'aw', decimalPlaces: 4, reportingLimit: 0.01 },
      ],
    },
    {
      code: 'MYCO',
      name: 'Mycotoxins',
      category: 'Mycotoxins',
      methodology: 'LC-MS/MS Internal Method',
      requiresCalibration: true,
      defaultTurnaroundDays: 5,
      sampleMatrices: ['Cannabis', 'Food', 'Grain'],
      analytes: [
        { name: 'Aflatoxin B1', code: 'AFB1', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Aflatoxin B2', code: 'AFB2', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Aflatoxin G1', code: 'AFG1', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Aflatoxin G2', code: 'AFG2', unit: 'ppb', decimalPlaces: 2, reportingLimit: 0.5 },
        { name: 'Ochratoxin A', code: 'OTA', unit: 'ppb', decimalPlaces: 2, reportingLimit: 1.0 },
      ],
    },
    {
      code: 'FOREIGN',
      name: 'Foreign Material Inspection',
      category: 'Physical',
      methodology: 'Visual Inspection SOP',
      requiresCalibration: false,
      defaultTurnaroundDays: 1,
      sampleMatrices: ['Cannabis', 'Food'],
      analytes: [
        { name: 'Visual Inspection', code: 'VISUAL', unit: 'Pass/Fail', decimalPlaces: 0 },
      ],
    },
  ];

  // Maps: method code -> method id, (method code, analyte code) -> analyte id
  const methodIds: Record<string, string> = {};
  const analyteIds: Record<string, Record<string, string>> = {};

  for (let i = 0; i < testMethodsData.length; i++) {
    const m = testMethodsData[i];
    const method = await prisma.testMethod.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        code: m.code,
        name: m.name,
        category: m.category,
        methodology: m.methodology,
        sampleMatrices: m.sampleMatrices,
        requiresCalibration: m.requiresCalibration,
        defaultTurnaroundDays: m.defaultTurnaroundDays,
        accreditedMethod: true,
        isActive: true,
        sortOrder: i,
        qcRequirements: {},
      },
    });
    methodIds[m.code] = method.id;
    analyteIds[m.code] = {};

    for (let j = 0; j < m.analytes.length; j++) {
      const a = m.analytes[j];
      const analyte = await prisma.testAnalyte.create({
        data: {
          id: randomUUID(),
          testMethodId: method.id,
          name: a.name,
          code: a.code,
          unit: a.unit,
          decimalPlaces: a.decimalPlaces,
          reportingLimit: a.reportingLimit != null ? new Decimal(a.reportingLimit) : null,
          sortOrder: j,
          isActive: true,
        },
      });
      analyteIds[m.code][a.code] = analyte.id;
    }
  }

  console.log(`  Created ${testMethodsData.length} test methods with analytes`);

  // =========================================================================
  // Specifications
  // =========================================================================

  // CA-CANNABIS-2024: covers metals, pesticides, micro, mycotoxins
  const specCACannabis = await prisma.specification.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'California Cannabis Regulations',
      code: 'CA-CANNABIS-2024',
      description: 'California BCC cannabis testing action limits effective 2024',
      regulatoryBody: 'California Bureau of Cannabis Control',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      testMethodId: methodIds['METALS-ICP'],
    },
  });

  // Metal limits for CA cannabis
  const metalLimits: Array<{ code: string; max: number }> = [
    { code: 'Pb', max: 500 },
    { code: 'As', max: 200 },
    { code: 'Cd', max: 200 },
    { code: 'Hg', max: 100 },
  ];
  for (const ml of metalLimits) {
    await prisma.specificationLimit.create({
      data: {
        id: randomUUID(),
        specificationId: specCACannabis.id,
        analyteId: analyteIds['METALS-ICP'][ml.code],
        limitType: 'MAXIMUM',
        maxValue: new Decimal(ml.max),
        unit: 'ppb',
        actionOnFail: 'REJECT',
      },
    });
  }

  // Pesticide spec (reuse CA code namespace with a different spec)
  const specCAPest = await prisma.specification.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'CA Cannabis Pesticide Limits',
      code: 'CA-PEST-2024',
      description: 'California cannabis pesticide action limits',
      regulatoryBody: 'California BCC',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      testMethodId: methodIds['PEST-LCMS'],
    },
  });

  const pestLimits: Array<{ code: string; max: number }> = [
    { code: 'MYCLUB', max: 0.1 },
    { code: 'BIFEN', max: 0.1 },
    { code: 'SPIRO', max: 0.1 },
    { code: 'ABAM', max: 0.1 },
    { code: 'IMID', max: 3.0 },
  ];
  for (const pl of pestLimits) {
    await prisma.specificationLimit.create({
      data: {
        id: randomUUID(),
        specificationId: specCAPest.id,
        analyteId: analyteIds['PEST-LCMS'][pl.code],
        limitType: 'MAXIMUM',
        maxValue: new Decimal(pl.max),
        unit: 'ppm',
        actionOnFail: 'REJECT',
      },
    });
  }

  // Micro spec
  const specCAMicro = await prisma.specification.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'CA Cannabis Microbiology Limits',
      code: 'CA-MICRO-2024',
      description: 'California cannabis microbiology limits',
      regulatoryBody: 'California BCC',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      testMethodId: methodIds['MICRO-TPC'],
    },
  });

  await prisma.specificationLimit.create({
    data: {
      id: randomUUID(),
      specificationId: specCAMicro.id,
      analyteId: analyteIds['MICRO-TPC']['TAC'],
      limitType: 'MAXIMUM',
      maxValue: new Decimal(100000),
      unit: 'CFU/g',
      actionOnFail: 'REJECT',
    },
  });

  // Mycotoxin spec
  const specCAMyco = await prisma.specification.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'CA Cannabis Mycotoxin Limits',
      code: 'CA-MYCO-2024',
      description: 'California cannabis mycotoxin action limits',
      regulatoryBody: 'California BCC',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      testMethodId: methodIds['MYCO'],
    },
  });

  const mycoLimits: Array<{ code: string; max: number }> = [
    { code: 'AFB1', max: 20 },
    { code: 'AFB2', max: 20 },
    { code: 'AFG1', max: 20 },
    { code: 'AFG2', max: 20 },
    { code: 'OTA', max: 20 },
  ];
  for (const ml of mycoLimits) {
    await prisma.specificationLimit.create({
      data: {
        id: randomUUID(),
        specificationId: specCAMyco.id,
        analyteId: analyteIds['MYCO'][ml.code],
        limitType: 'MAXIMUM',
        maxValue: new Decimal(ml.max),
        unit: 'ppb',
        actionOnFail: 'REJECT',
      },
    });
  }

  // USP-467
  const specUSP467 = await prisma.specification.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'USP Residual Solvents',
      code: 'USP-467',
      description: 'USP <467> Residual Solvents concentration limits',
      regulatoryBody: 'US Pharmacopeia',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      testMethodId: methodIds['SOLV-GC'],
    },
  });

  const solvLimits: Array<{ code: string; max: number }> = [
    { code: 'BUTANE', max: 5000 },
    { code: 'PROPANE', max: 5000 },
    { code: 'ETHANOL', max: 5000 },
    { code: 'IPA', max: 5000 },
    { code: 'ACETONE', max: 5000 },
  ];
  for (const sl of solvLimits) {
    await prisma.specificationLimit.create({
      data: {
        id: randomUUID(),
        specificationId: specUSP467.id,
        analyteId: analyteIds['SOLV-GC'][sl.code],
        limitType: 'MAXIMUM',
        maxValue: new Decimal(sl.max),
        unit: 'ppm',
        actionOnFail: 'REJECT',
      },
    });
  }

  console.log('  Created specifications with limits');

  // =========================================================================
  // Price List
  // =========================================================================

  const priceList = await prisma.priceList.create({
    data: {
      id: randomUUID(),
      organizationId: org.id,
      name: 'Standard 2025',
      code: 'STD-2025',
      currency: 'USD',
      effectiveDate: new Date('2025-01-01'),
      isDefault: true,
      isActive: true,
    },
  });

  const prices: Record<string, number> = {
    'METALS-ICP': 150,
    'PEST-LCMS': 250,
    'MICRO-TPC': 75,
    'MICRO-EC': 85,
    'POT-CANN': 100,
    'SOLV-GC': 175,
    'MOIST': 25,
    'WATER-ACT': 35,
    'MYCO': 200,
    'FOREIGN': 40,
  };

  for (const [code, price] of Object.entries(prices)) {
    await prisma.priceListItem.create({
      data: {
        id: randomUUID(),
        priceListId: priceList.id,
        testMethodId: methodIds[code],
        unitPrice: new Decimal(price),
        rushSurchargePercent: new Decimal(50),
        volumeTiers: [],
      },
    });
  }

  console.log('  Created price list with items');

  // =========================================================================
  // Clients
  // =========================================================================

  const clientsData = [
    {
      name: 'Green Valley Farms',
      code: 'GVF',
      type: 'COMMERCIAL' as const,
      paymentTerms: 'NET_30' as const,
      contactFirstName: 'Robert',
      contactLastName: 'Green',
      contactEmail: 'robert@greenvalleyfarms.com',
      contactPhone: '+1-530-555-0201',
      address: '456 Farm Road',
      city: 'Chico',
      state: 'CA',
      zip: '95928',
    },
    {
      name: 'Pacific Labs Research',
      code: 'PLR',
      type: 'ACADEMIC' as const,
      paymentTerms: 'NET_60' as const,
      contactFirstName: 'Dr. Lisa',
      contactLastName: 'Park',
      contactEmail: 'lpark@pacificlabsresearch.edu',
      contactPhone: '+1-510-555-0302',
      address: '789 University Ave',
      city: 'Berkeley',
      state: 'CA',
      zip: '94720',
    },
    {
      name: 'City of Portland Water',
      code: 'CPW',
      type: 'GOVERNMENT' as const,
      paymentTerms: 'NET_45' as const,
      contactFirstName: 'Tom',
      contactLastName: 'Rivers',
      contactEmail: 'trivers@portlandwater.gov',
      contactPhone: '+1-503-555-0403',
      address: '100 Water Bureau Drive',
      city: 'Portland',
      state: 'OR',
      zip: '97204',
    },
    {
      name: 'BioHealth Supplements',
      code: 'BHS',
      type: 'COMMERCIAL' as const,
      paymentTerms: 'NET_30' as const,
      contactFirstName: 'Karen',
      contactLastName: 'Patel',
      contactEmail: 'karen@biohealthsupps.com',
      contactPhone: '+1-415-555-0504',
      address: '222 Health Blvd',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
    },
    {
      name: 'Mountain Top Cannabis',
      code: 'MTC',
      type: 'COMMERCIAL' as const,
      paymentTerms: 'COD' as const,
      contactFirstName: 'Derek',
      contactLastName: 'Stone',
      contactEmail: 'derek@mountaintopcc.com',
      contactPhone: '+1-530-555-0605',
      address: '333 Mountain Rd',
      city: 'Mount Shasta',
      state: 'CA',
      zip: '96067',
    },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clientsData) {
    const created = await prisma.client.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        name: c.name,
        code: c.code,
        type: c.type,
        paymentTerms: c.paymentTerms,
        contactFirstName: c.contactFirstName,
        contactLastName: c.contactLastName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        address: c.address,
        city: c.city,
        state: c.state,
        zip: c.zip,
        country: 'US',
        billingEmail: c.contactEmail,
        priceListId: priceList.id,
        defaultTurnaroundDays: 5,
        isActive: true,
        tags: [],
      },
    });
    clientIds[c.code] = created.id;
  }

  console.log(`  Created ${clientsData.length} clients`);

  // =========================================================================
  // Orders, Samples, Tests, Results, Invoices, Payments
  // =========================================================================

  // Order definitions with status distribution
  interface OrderDef {
    clientCode: string;
    status: string;
    priority: string;
    daysAgo: number;
    turnaround: number;
    samples: SampleDef[];
  }

  interface SampleDef {
    name: string;
    matrix: string;
    sampleType: string;
    tests: string[]; // test method codes
  }

  const orderDefs: OrderDef[] = [
    // 5 COMPLETED
    {
      clientCode: 'GVF', status: 'COMPLETED', priority: 'NORMAL', daysAgo: 45, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - OG Kush', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP', 'PEST-LCMS', 'MICRO-TPC'] },
        { name: 'Cannabis Flower - Blue Dream', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP'] },
      ],
    },
    {
      clientCode: 'MTC', status: 'COMPLETED', priority: 'HIGH', daysAgo: 40, turnaround: 3,
      samples: [
        { name: 'Cannabis Extract - Shatter', matrix: 'Cannabis', sampleType: 'Concentrate', tests: ['POT-CANN', 'SOLV-GC', 'PEST-LCMS'] },
      ],
    },
    {
      clientCode: 'BHS', status: 'COMPLETED', priority: 'NORMAL', daysAgo: 35, turnaround: 5,
      samples: [
        { name: 'CBD Tincture - 1000mg', matrix: 'Cannabis', sampleType: 'Tincture', tests: ['POT-CANN', 'METALS-ICP', 'MICRO-TPC', 'MICRO-EC'] },
        { name: 'CBD Gummies - Mixed Berry', matrix: 'Cannabis', sampleType: 'Edible', tests: ['POT-CANN', 'MYCO'] },
        { name: 'CBD Capsules - 50mg', matrix: 'Cannabis', sampleType: 'Capsule', tests: ['POT-CANN', 'SOLV-GC'] },
      ],
    },
    {
      clientCode: 'CPW', status: 'COMPLETED', priority: 'NORMAL', daysAgo: 30, turnaround: 7,
      samples: [
        { name: 'Water - Intake Point 3', matrix: 'Water', sampleType: 'Drinking Water', tests: ['METALS-ICP', 'MICRO-EC'] },
        { name: 'Water - Distribution Hub 7', matrix: 'Water', sampleType: 'Drinking Water', tests: ['METALS-ICP', 'MICRO-EC'] },
      ],
    },
    {
      clientCode: 'PLR', status: 'COMPLETED', priority: 'LOW', daysAgo: 28, turnaround: 10,
      samples: [
        { name: 'Soil Sample - Site 42', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP'] },
        { name: 'Soil Sample - Site 43', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP'] },
        { name: 'Soil Sample - Control', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP'] },
      ],
    },

    // 3 IN_PROGRESS
    {
      clientCode: 'GVF', status: 'IN_PROGRESS', priority: 'NORMAL', daysAgo: 5, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - Gelato', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP', 'PEST-LCMS', 'MOIST'] },
        { name: 'Cannabis Flower - Wedding Cake', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'PEST-LCMS'] },
      ],
    },
    {
      clientCode: 'MTC', status: 'IN_PROGRESS', priority: 'RUSH', daysAgo: 3, turnaround: 2,
      samples: [
        { name: 'Cannabis Pre-Roll - Indica Blend', matrix: 'Cannabis', sampleType: 'Pre-Roll', tests: ['POT-CANN', 'FOREIGN', 'MOIST', 'WATER-ACT'] },
      ],
    },
    {
      clientCode: 'BHS', status: 'IN_PROGRESS', priority: 'HIGH', daysAgo: 4, turnaround: 5,
      samples: [
        { name: 'Hemp Oil - Raw Extract', matrix: 'Cannabis', sampleType: 'Oil', tests: ['POT-CANN', 'METALS-ICP', 'SOLV-GC', 'MYCO'] },
        { name: 'Hemp Seed Protein Powder', matrix: 'Food', sampleType: 'Supplement', tests: ['METALS-ICP', 'MICRO-TPC', 'MYCO'] },
      ],
    },

    // 3 RECEIVED
    {
      clientCode: 'GVF', status: 'RECEIVED', priority: 'NORMAL', daysAgo: 1, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - Purple Punch', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP', 'PEST-LCMS'] },
      ],
    },
    {
      clientCode: 'CPW', status: 'RECEIVED', priority: 'HIGH', daysAgo: 1, turnaround: 3,
      samples: [
        { name: 'Water - Reservoir East', matrix: 'Water', sampleType: 'Surface Water', tests: ['METALS-ICP', 'MICRO-EC', 'MICRO-TPC'] },
        { name: 'Water - Reservoir West', matrix: 'Water', sampleType: 'Surface Water', tests: ['METALS-ICP', 'MICRO-EC'] },
      ],
    },
    {
      clientCode: 'PLR', status: 'RECEIVED', priority: 'LOW', daysAgo: 2, turnaround: 10,
      samples: [
        { name: 'Soil Sample - Riverbank A', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP'] },
        { name: 'Soil Sample - Riverbank B', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP'] },
        { name: 'Sediment Sample - River Bottom', matrix: 'Soil', sampleType: 'Environmental', tests: ['METALS-ICP', 'PEST-LCMS'] },
      ],
    },

    // 2 DRAFT
    {
      clientCode: 'MTC', status: 'DRAFT', priority: 'NORMAL', daysAgo: 0, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - Sour Diesel', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP'] },
      ],
    },
    {
      clientCode: 'BHS', status: 'DRAFT', priority: 'NORMAL', daysAgo: 0, turnaround: 5,
      samples: [
        { name: 'Melatonin Gummies - Cherry', matrix: 'Food', sampleType: 'Supplement', tests: ['METALS-ICP', 'MICRO-TPC'] },
        { name: 'Vitamin D Capsules - 5000IU', matrix: 'Food', sampleType: 'Supplement', tests: ['METALS-ICP'] },
      ],
    },

    // 2 IN_REVIEW
    {
      clientCode: 'GVF', status: 'IN_REVIEW', priority: 'NORMAL', daysAgo: 10, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - Jack Herer', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN', 'METALS-ICP', 'PEST-LCMS', 'FOREIGN'] },
      ],
    },
    {
      clientCode: 'MTC', status: 'IN_REVIEW', priority: 'HIGH', daysAgo: 8, turnaround: 3,
      samples: [
        { name: 'Cannabis Vape Cart - Hybrid', matrix: 'Cannabis', sampleType: 'Cartridge', tests: ['POT-CANN', 'SOLV-GC', 'METALS-ICP'] },
        { name: 'Cannabis Vape Cart - Sativa', matrix: 'Cannabis', sampleType: 'Cartridge', tests: ['POT-CANN', 'SOLV-GC'] },
      ],
    },

    // 2 APPROVED
    {
      clientCode: 'CPW', status: 'APPROVED', priority: 'NORMAL', daysAgo: 15, turnaround: 7,
      samples: [
        { name: 'Water - Treatment Plant Effluent', matrix: 'Water', sampleType: 'Treated Water', tests: ['METALS-ICP', 'MICRO-EC', 'MICRO-TPC'] },
      ],
    },
    {
      clientCode: 'PLR', status: 'APPROVED', priority: 'LOW', daysAgo: 20, turnaround: 10,
      samples: [
        { name: 'Grain Sample - Wheat Lot 101', matrix: 'Food', sampleType: 'Grain', tests: ['MYCO', 'MOIST'] },
        { name: 'Grain Sample - Corn Lot 202', matrix: 'Food', sampleType: 'Grain', tests: ['MYCO', 'MOIST'] },
      ],
    },

    // 1 REPORTED
    {
      clientCode: 'GVF', status: 'REPORTED', priority: 'NORMAL', daysAgo: 25, turnaround: 5,
      samples: [
        { name: 'Cannabis Trim - Batch T-2025', matrix: 'Cannabis', sampleType: 'Trim', tests: ['POT-CANN', 'PEST-LCMS', 'MOIST', 'WATER-ACT'] },
      ],
    },

    // 1 ON_HOLD
    {
      clientCode: 'BHS', status: 'ON_HOLD', priority: 'NORMAL', daysAgo: 12, turnaround: 5,
      samples: [
        { name: 'CBD Lotion - Lavender', matrix: 'Cannabis', sampleType: 'Topical', tests: ['POT-CANN', 'METALS-ICP', 'MICRO-TPC'] },
      ],
    },

    // 1 CANCELLED
    {
      clientCode: 'MTC', status: 'CANCELLED', priority: 'NORMAL', daysAgo: 18, turnaround: 5,
      samples: [
        { name: 'Cannabis Flower - Cancelled Batch', matrix: 'Cannabis', sampleType: 'Flower', tests: ['POT-CANN'] },
      ],
    },
  ];

  let orderCounter = 0;
  let sampleCounter = 0;
  const allOrderIds: string[] = [];
  const allOrderClients: string[] = []; // parallel: client code per order
  const allOrderStatuses: string[] = [];
  const allOrderTotals: number[] = [];

  // Realistic result generators per method code
  function generateResultValue(methodCode: string, analyteCode: string): {
    rawValue: string; finalValue: string; numericValue: number | null;
    isDetected: boolean; passStatus: 'PASS' | 'FAIL';
  } {
    let numericValue: number;
    let passStatus: 'PASS' | 'FAIL' = 'PASS';
    let isDetected = true;

    switch (methodCode) {
      case 'METALS-ICP':
        numericValue = parseFloat((Math.random() * 50).toFixed(2));
        if (numericValue < 0.5) { isDetected = false; numericValue = 0; }
        break;
      case 'PEST-LCMS':
        numericValue = parseFloat((Math.random() * 0.05).toFixed(3));
        if (numericValue < 0.01) { isDetected = false; numericValue = 0; }
        break;
      case 'MICRO-TPC':
        numericValue = Math.floor(Math.random() * 5000);
        isDetected = numericValue > 10;
        break;
      case 'MICRO-EC':
        numericValue = Math.floor(Math.random() * 100);
        isDetected = numericValue > 1;
        break;
      case 'POT-CANN':
        if (analyteCode === 'THC') numericValue = parseFloat((Math.random() * 25 + 5).toFixed(2));
        else if (analyteCode === 'THCA') numericValue = parseFloat((Math.random() * 28 + 2).toFixed(2));
        else if (analyteCode === 'CBD') numericValue = parseFloat((Math.random() * 15).toFixed(2));
        else if (analyteCode === 'CBDA') numericValue = parseFloat((Math.random() * 18).toFixed(2));
        else numericValue = parseFloat((Math.random() * 2).toFixed(2));
        break;
      case 'SOLV-GC':
        numericValue = parseFloat((Math.random() * 100).toFixed(1));
        if (numericValue < 1) { isDetected = false; numericValue = 0; }
        break;
      case 'MOIST':
        numericValue = parseFloat((Math.random() * 12 + 2).toFixed(2));
        break;
      case 'WATER-ACT':
        numericValue = parseFloat((Math.random() * 0.3 + 0.3).toFixed(4));
        break;
      case 'MYCO':
        numericValue = parseFloat((Math.random() * 5).toFixed(2));
        if (numericValue < 0.5) { isDetected = false; numericValue = 0; }
        break;
      case 'FOREIGN':
        numericValue = 0;
        isDetected = false;
        return {
          rawValue: 'Pass',
          finalValue: 'Pass',
          numericValue: null,
          isDetected: false,
          passStatus: 'PASS',
        };
      default:
        numericValue = 0;
    }

    return {
      rawValue: String(numericValue),
      finalValue: String(numericValue),
      numericValue,
      isDetected,
      passStatus,
    };
  }

  // Statuses where tests should have results
  const completedLikeStatuses = new Set(['COMPLETED', 'IN_REVIEW', 'APPROVED', 'REPORTED']);
  const inProgressStatus = new Set(['IN_PROGRESS']);

  for (const od of orderDefs) {
    orderCounter++;
    const orderNumber = `WO-2025-${pad(orderCounter)}`;
    const receivedDate = daysAgo(od.daysAgo);
    const dueDate = new Date(receivedDate);
    dueDate.setDate(dueDate.getDate() + od.turnaround);

    const order = await prisma.order.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        clientId: clientIds[od.clientCode],
        orderNumber,
        status: od.status as any,
        priority: od.priority as any,
        receivedDate: od.status !== 'DRAFT' ? receivedDate : null,
        dueDate,
        completedDate: completedLikeStatuses.has(od.status) ? daysAgo(od.daysAgo - od.turnaround) : null,
        turnaroundDays: od.turnaround,
        rushRequested: od.priority === 'RUSH',
        rushApproved: od.priority === 'RUSH',
        rushSurchargePercent: od.priority === 'RUSH' ? new Decimal(50) : null,
        notes: null,
        createdById: users['SAMPLE_RECEIVER'],
        attachments: [],
      },
    });
    allOrderIds.push(order.id);
    allOrderClients.push(od.clientCode);
    allOrderStatuses.push(od.status);

    let orderTotal = 0;

    for (const sd of od.samples) {
      sampleCounter++;
      const sampleNumber = `SPL-2025-${pad(sampleCounter)}`;

      const sample = await prisma.sample.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          orderId: order.id,
          sampleNumber,
          name: sd.name,
          matrix: sd.matrix,
          sampleType: sd.sampleType,
          collectedDate: daysAgo(od.daysAgo + 1),
          receivedDate: od.status !== 'DRAFT' ? receivedDate : null,
          receivedById: users['SAMPLE_RECEIVER'],
          status: mapOrderStatusToSampleStatus(od.status),
          storageLocationId: storageLocations[Math.floor(Math.random() * storageLocations.length)],
          barcodeValue: generateBarcode(),
          barcodeFormat: 'CODE128',
          quantity: new Decimal(10),
          quantityUnit: 'g',
          tags: [],
          customFields: {},
          attachments: [],
          createdById: users['SAMPLE_RECEIVER'],
        },
      });

      // Create tests for this sample
      for (const testMethodCode of sd.tests) {
        const testMethodId = methodIds[testMethodCode];
        const analytes = analyteIds[testMethodCode];

        // Determine test status based on order status
        let testStatus: string;
        let assignedToId: string | null = null;
        let reviewedById: string | null = null;
        let approvedById: string | null = null;

        if (completedLikeStatuses.has(od.status)) {
          testStatus = od.status === 'COMPLETED' || od.status === 'APPROVED' || od.status === 'REPORTED'
            ? 'APPROVED'
            : 'IN_REVIEW';
          assignedToId = users['ANALYST'];
          reviewedById = users['SENIOR_ANALYST'];
          if (testStatus === 'APPROVED') approvedById = users['LAB_DIRECTOR'];
        } else if (inProgressStatus.has(od.status)) {
          // Some tests done, some in-progress
          const chance = Math.random();
          if (chance < 0.4) {
            testStatus = 'COMPLETED';
            assignedToId = users['ANALYST'];
          } else if (chance < 0.7) {
            testStatus = 'IN_PROGRESS';
            assignedToId = users['ANALYST'];
          } else {
            testStatus = 'ASSIGNED';
            assignedToId = users['ANALYST'];
          }
        } else if (od.status === 'CANCELLED') {
          testStatus = 'CANCELLED';
        } else if (od.status === 'ON_HOLD') {
          testStatus = 'ON_HOLD';
        } else {
          testStatus = 'PENDING';
        }

        // Pick instrument based on method
        let instrumentId: string | null = null;
        if (testMethodCode === 'METALS-ICP') instrumentId = instruments[0];
        else if (testMethodCode === 'PEST-LCMS' || testMethodCode === 'MYCO') instrumentId = instruments[1];
        else if (testMethodCode === 'MICRO-TPC' || testMethodCode === 'MICRO-EC') instrumentId = instruments[2];
        else if (testMethodCode === 'SOLV-GC') instrumentId = instruments[3];
        else if (testMethodCode === 'MOIST' || testMethodCode === 'WATER-ACT') instrumentId = instruments[4];

        const hasResults = ['COMPLETED', 'IN_REVIEW', 'APPROVED'].includes(testStatus);

        const test = await prisma.test.create({
          data: {
            id: randomUUID(),
            sampleId: sample.id,
            testMethodId,
            status: testStatus as any,
            priority: od.priority as any,
            assignedToId,
            assignedDate: assignedToId ? daysAgo(od.daysAgo) : null,
            startedDate: ['IN_PROGRESS', 'COMPLETED', 'IN_REVIEW', 'APPROVED'].includes(testStatus)
              ? daysAgo(od.daysAgo - 1)
              : null,
            completedDate: ['COMPLETED', 'IN_REVIEW', 'APPROVED'].includes(testStatus)
              ? daysAgo(Math.max(0, od.daysAgo - 3))
              : null,
            instrumentId,
            reviewedById: ['IN_REVIEW', 'APPROVED'].includes(testStatus) ? reviewedById : null,
            reviewedDate: ['IN_REVIEW', 'APPROVED'].includes(testStatus)
              ? daysAgo(Math.max(0, od.daysAgo - 4))
              : null,
            approvedById: testStatus === 'APPROVED' ? approvedById : null,
            approvedDate: testStatus === 'APPROVED'
              ? daysAgo(Math.max(0, od.daysAgo - 5))
              : null,
            overallResult: hasResults ? 'PASS' : null,
          },
        });

        // Create results if test has been completed
        if (hasResults) {
          for (const [aCode, aId] of Object.entries(analytes)) {
            const rv = generateResultValue(testMethodCode, aCode);
            await prisma.testResult.create({
              data: {
                id: randomUUID(),
                testId: test.id,
                analyteId: aId,
                rawValue: rv.rawValue,
                finalValue: rv.finalValue,
                numericValue: rv.numericValue != null ? new Decimal(rv.numericValue) : null,
                unit: getAnalyteUnit(testMethodCode, aCode),
                isDetected: rv.isDetected,
                passStatus: rv.passStatus,
                dilutionFactor: new Decimal(1),
              },
            });
          }
        }

        // Add to order total
        orderTotal += prices[testMethodCode] || 0;
      }
    }

    allOrderTotals.push(orderTotal);
  }

  console.log(`  Created ${orderCounter} orders with ${sampleCounter} samples`);

  // =========================================================================
  // Invoices & Payments
  // =========================================================================

  // Invoice distribution:
  // 3 PAID, 2 SENT, 2 OVERDUE, 1 DRAFT, 1 PARTIALLY_PAID, 1 VOID
  interface InvoiceDef {
    orderIdx: number;
    status: string;
  }

  const invoiceDefs: InvoiceDef[] = [
    { orderIdx: 0, status: 'PAID' },
    { orderIdx: 1, status: 'PAID' },
    { orderIdx: 2, status: 'PAID' },
    { orderIdx: 3, status: 'SENT' },
    { orderIdx: 4, status: 'SENT' },
    { orderIdx: 5, status: 'OVERDUE' },
    { orderIdx: 6, status: 'OVERDUE' },
    { orderIdx: 7, status: 'DRAFT' },
    { orderIdx: 8, status: 'PARTIALLY_PAID' },
    { orderIdx: 9, status: 'VOID' },
  ];

  let invoiceCounter = 0;

  for (const invDef of invoiceDefs) {
    invoiceCounter++;
    const invoiceNumber = `INV-2025-${pad(invoiceCounter)}`;
    const clientCode = allOrderClients[invDef.orderIdx];
    const cId = clientIds[clientCode];
    const subtotal = new Decimal(allOrderTotals[invDef.orderIdx]);
    const taxRate = new Decimal(0.0875);
    const taxAmount = subtotal.mul(taxRate);
    const total = subtotal.add(taxAmount);

    let balanceDue = total;
    let paidDate: Date | null = null;
    const issueDate = daysAgo(30 - invDef.orderIdx * 2);
    const dueDate30 = new Date(issueDate);
    dueDate30.setDate(dueDate30.getDate() + 30);

    if (invDef.status === 'PAID') {
      balanceDue = new Decimal(0);
      paidDate = daysAgo(15 - invDef.orderIdx * 2);
    } else if (invDef.status === 'PARTIALLY_PAID') {
      balanceDue = total.div(2);
    } else if (invDef.status === 'VOID') {
      balanceDue = new Decimal(0);
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        clientId: cId,
        invoiceNumber,
        status: invDef.status as any,
        issueDate: invDef.status !== 'DRAFT' ? issueDate : null,
        dueDate: dueDate30,
        paidDate,
        subtotal,
        discountAmount: new Decimal(0),
        taxRate,
        taxAmount,
        rushSurcharge: new Decimal(0),
        total,
        balanceDue,
        paymentTerms: 'NET_30',
        notes: null,
        sentAt: ['SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'].includes(invDef.status)
          ? issueDate
          : null,
        sentToEmails: ['SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'].includes(invDef.status)
          ? [`billing@${clientCode.toLowerCase()}.com`]
          : [],
        createdById: users['BILLING_ADMIN'],
        voidedAt: invDef.status === 'VOID' ? daysAgo(5) : null,
        voidedById: invDef.status === 'VOID' ? users['BILLING_ADMIN'] : null,
        voidReason: invDef.status === 'VOID' ? 'Duplicate invoice created in error' : null,
      },
    });

    // Add line item
    await prisma.invoiceLineItem.create({
      data: {
        id: randomUUID(),
        invoiceId: invoice.id,
        orderId: allOrderIds[invDef.orderIdx],
        description: `Laboratory testing services - ${orderDefs[invDef.orderIdx].samples.map(s => s.name).join(', ')}`,
        sampleCount: orderDefs[invDef.orderIdx].samples.length,
        quantity: new Decimal(1),
        unitPrice: subtotal,
        discount: new Decimal(0),
        total: subtotal,
        sortOrder: 0,
      },
    });

    // Create payments for PAID and PARTIALLY_PAID invoices
    if (invDef.status === 'PAID') {
      await prisma.payment.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          invoiceId: invoice.id,
          clientId: cId,
          amount: total,
          method: 'ACH',
          status: 'COMPLETED',
          referenceNumber: `PAY-${invoiceCounter}-${Date.now().toString(36)}`,
          paymentDate: paidDate!,
          processedAt: paidDate!,
          recordedById: users['BILLING_ADMIN'],
        },
      });
    } else if (invDef.status === 'PARTIALLY_PAID') {
      await prisma.payment.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          invoiceId: invoice.id,
          clientId: cId,
          amount: total.div(2),
          method: 'CHECK',
          status: 'COMPLETED',
          referenceNumber: `CHK-${invoiceCounter}-${Math.floor(Math.random() * 90000 + 10000)}`,
          paymentDate: daysAgo(10),
          processedAt: daysAgo(10),
          recordedById: users['BILLING_ADMIN'],
        },
      });
    }
  }

  console.log(`  Created ${invoiceCounter} invoices with payments`);

  // =========================================================================
  // Sequences
  // =========================================================================

  await prisma.$transaction([
    prisma.sequence.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        entityType: 'ORDER',
        year: 2025,
        currentValue: orderCounter,
      },
    }),
    prisma.sequence.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        entityType: 'SAMPLE',
        year: 2025,
        currentValue: sampleCounter,
      },
    }),
    prisma.sequence.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        entityType: 'INVOICE',
        year: 2025,
        currentValue: invoiceCounter,
      },
    }),
    prisma.sequence.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        entityType: 'REPORT',
        year: 2025,
        currentValue: 0,
      },
    }),
    prisma.sequence.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        entityType: 'CREDIT_NOTE',
        year: 2025,
        currentValue: 0,
      },
    }),
  ]);

  console.log('  Created sequence records');

  // =========================================================================
  // Summary
  // =========================================================================

  console.log('\nSeed complete!');
  console.log('---------------------------------------------------');
  console.log(`Organization: ${org.name}`);
  console.log(`Users:        ${usersData.length}`);
  console.log(`Instruments:  ${instrumentsData.length}`);
  console.log(`Storage:      ${storageData.length}`);
  console.log(`Test Methods: ${testMethodsData.length}`);
  console.log(`Clients:      ${clientsData.length}`);
  console.log(`Orders:       ${orderCounter}`);
  console.log(`Samples:      ${sampleCounter}`);
  console.log(`Invoices:     ${invoiceCounter}`);
  console.log('---------------------------------------------------');
  console.log('\nDefault login:');
  console.log('  Email:    admin@labflow.dev');
  console.log('  Password: password123');
  console.log('');
}

// ---------------------------------------------------------------------------
// Utility: map order status -> sample status
// ---------------------------------------------------------------------------

function mapOrderStatusToSampleStatus(
  orderStatus: string
): 'REGISTERED' | 'RECEIVED' | 'IN_PROGRESS' | 'TESTING_COMPLETE' | 'APPROVED' | 'REPORTED' | 'ON_HOLD' | 'CANCELLED' {
  switch (orderStatus) {
    case 'DRAFT':
      return 'REGISTERED';
    case 'SUBMITTED':
    case 'RECEIVED':
      return 'RECEIVED';
    case 'IN_PROGRESS':
    case 'TESTING_COMPLETE':
      return 'IN_PROGRESS';
    case 'IN_REVIEW':
      return 'TESTING_COMPLETE';
    case 'APPROVED':
      return 'APPROVED';
    case 'REPORTED':
    case 'COMPLETED':
      return 'REPORTED';
    case 'ON_HOLD':
      return 'ON_HOLD';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'REGISTERED';
  }
}

// ---------------------------------------------------------------------------
// Utility: get analyte unit
// ---------------------------------------------------------------------------

function getAnalyteUnit(methodCode: string, analyteCode: string): string {
  const units: Record<string, string> = {
    'METALS-ICP': 'ppb',
    'PEST-LCMS': 'ppm',
    'MICRO-TPC': 'CFU/g',
    'MICRO-EC': 'CFU/g',
    'POT-CANN': '%',
    'SOLV-GC': 'ppm',
    'MOIST': '%',
    'WATER-ACT': 'aw',
    'MYCO': 'ppb',
    'FOREIGN': 'Pass/Fail',
  };
  return units[methodCode] || '';
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
