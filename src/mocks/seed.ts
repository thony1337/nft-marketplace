import type { User, Wallet } from '../types';

// Mock-only credentials. Passwords are never stored in clear: only a salted SHA-256 hash.
export const SEED_PASSWORD = 'Senha@123';

export type DbUser = User & { salt: string; passwordHash: string };

export const seedUsers: DbUser[] = [
  {
    id: 'user-1',
    name: 'Anthony Silva',
    email: 'anthony@example.com',
    salt: 'kurio-salt-user-1',
    passwordHash: 'c1e6423394c19a55b39607006a862141bf9f202cf46eb3cbf90e012903b5d4ec',
  },
  {
    id: 'user-2',
    name: 'CryptoCollector',
    email: 'collector@example.com',
    salt: 'kurio-salt-user-2',
    passwordHash: 'cb1d9f63de68a6c9fb148a7af3797e15002645fbc3de4e72cf0149d1cdabcba1',
  },
];

export const MAX_WALLETS = 5;

// Wallets belong to a user; new accounts start with none
export const seedWallets: Record<string, Wallet[]> = {
  'user-1': [
    { id: 'wallet-1', name: 'MetaMask Principal', address: '0x71C7656EC7ab88b098defB751B7401B5f6d839A2', isPrimary: true, network: 'Ethereum Mainnet' },
    { id: 'wallet-2', name: 'Coinbase Vault', address: '0x94B2c5d8e6A3f1b7094D8c2E5a1F3b6c7D8e81F1', isPrimary: false, network: 'Polygon' },
  ],
  'user-2': [
    { id: 'wallet-3', name: 'Carteira Principal', address: '0x3aD4f1B7c9E2058a6d1C4b8E7F0a29c5D6e3B7A1', isPrimary: true, network: 'Ethereum Mainnet' },
  ],
};
