import { Builder } from './api/builder';
export { createSpendingLimit } from './api/spendingLimit';
import { publicKeyToDid } from './lib/solana/util';
import { didToDefaultDOASigner } from './lib/util';
export { ExtendedCluster } from './types/solana';
export { Cryptid } from './api/cryptid';

export const build = Builder.build;

export const util = {
  publicKeyToDid,
  didToDefaultDOASigner,
};

// Types exports
export * from './types';
