import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { validateInsertSql } from '../utils/sqlInsertValidator';
import {
  User,
  LegalEntity,
  Branch,
  Employee,
  Employer,
  BranchEmployer,
  Vehicle,
  Phone,
  HousingUnit,
  HousingInstallment,
  HousingOccupant,
  BranchLicense,
  BranchLease,
  LeaseInstallment,
  BranchEstablishment,
  BranchCustomField,
  VehicleCustomField,
  Notification,
} from './entities';

const isDev = process.env.NODE_ENV === 'development';

let initializePromise: Promise<DataSource> | null = null;

// Get database path - always use userData (set by Electron) for persistence when closing/reopening
const getDatabasePath = () => {
  if (process.env.ELECTRON_DB_PATH) {
    return process.env.ELECTRON_DB_PATH;
  }
  // Fallback: project database folder (e.g. when running tests without Electron)
  return path.join(__dirname, '../../database/uniform_base.db');
};

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: getDatabasePath(),
  synchronize: false, // Disabled for production safety — use migrations instead
  logging: isDev,
  entities: [
    User,
    LegalEntity,
    Branch,
    Employee,
    Employer,
    BranchEmployer,
    Vehicle,
    Phone,
    HousingUnit,
    HousingInstallment,
    HousingOccupant,
    BranchLicense,
    BranchLease,
    LeaseInstallment,
    BranchEstablishment,
    BranchCustomField,
    VehicleCustomField,
    Notification,
  ],
  migrations: [],
  subscribers: [],
  // sqlite3 driver configuration
  extra: {
    // sqlite3 specific options
  },
});

// Enforce INSERT validation for any direct AppDataSource.query/queryRunner.query usage.
const originalCreateQueryRunner = AppDataSource.createQueryRunner.bind(AppDataSource);
AppDataSource.createQueryRunner = (...args: Parameters<typeof AppDataSource.createQueryRunner>) => {
  const qr = originalCreateQueryRunner(...args);
  const originalQrQuery = qr.query.bind(qr);
  qr.query = (query: string, parameters?: unknown[]) => {
    validateInsertSql(query, parameters);
    return originalQrQuery(query, parameters);
  };
  return qr;
};

const originalDataSourceQuery = AppDataSource.query.bind(AppDataSource);
AppDataSource.query = (query: string, parameters?: unknown[]) => {
  validateInsertSql(query, parameters);
  return originalDataSourceQuery(query, parameters);
};

// Initialize database connection
export const initializeDatabase = async () => {
  // Prevent concurrent initializations during app startup.
  if (AppDataSource.isInitialized) return AppDataSource;
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('✅ Database initialized:', getDatabasePath());

        // Set PRAGMA settings for SQLite - DELETE mode ensures writes go directly to main file
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.query('PRAGMA journal_mode = DELETE');
        await queryRunner.query('PRAGMA synchronous = FULL');
        await queryRunner.query('PRAGMA foreign_keys = ON');

        // Ensure columns exist (migration helpers)
        try {
          const { ensureBranchColumns } = await import('./migrations/ensure-branch-columns');
          await ensureBranchColumns(queryRunner);
        } catch (migrationError) {
          console.warn('Migration warning:', migrationError);
        }
        try {
          const { ensureVehicleColumns } = await import('./migrations/ensure-vehicle-columns');
          await ensureVehicleColumns(queryRunner);
        } catch (migrationError) {
          console.warn('Vehicle migration warning:', migrationError);
        }
        try {
          const { ensureHousingColumns } = await import('./migrations/ensure-housing-columns');
          await ensureHousingColumns(queryRunner);
        } catch (migrationError) {
          console.warn('Housing migration warning:', migrationError);
        }
        try {
          const { updatePhoneColumns } = await import('./migrations/update-phone-columns');
          await updatePhoneColumns(queryRunner);
        } catch (migrationError) {
          console.warn('Phone migration warning:', migrationError);
        }

        await queryRunner.release();
      }

      return AppDataSource;
    } catch (error) {
      console.error('❌ Error initializing database:', error);
      throw error;
    } finally {
      initializePromise = null;
    }
  })();

  return initializePromise;
};

// Close database connection - checkpoint WAL first to ensure all writes are persisted
export const closeDatabase = async () => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database:', error);
    throw error;
  }
};
