import * as bip32 from 'bip32';
import nacl from 'tweetnacl';
import {
  Account,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { CryptidWalletInterface } from '../window';
import type { IdentifierArray, WalletAccount } from '@wallet-standard/base';
import { Cryptid } from '@identity.com/cryptid';
import * as bs58 from 'bs58';
import { SOLANA_CHAINS } from './solana.js';
import { icon } from '../icon';
const chains = SOLANA_CHAINS;
const features = [
  'solana:signAndSendTransaction',
  'solana:signTransaction',
  'standard:signMessage',
] as const;

export const DERIVATION_PATH = {
  deprecated: undefined,
  bip44: 'bip44',
  bip44Change: 'bip44Change',
  bip44Root: 'bip44Root', // Ledger only.
};

export function getAccountFromSeed(
  seed: Buffer,
  walletIndex: number,
  dPath: string | undefined = undefined,
  accountIndex: number = 0,
) {
  const derivedSeed = deriveSeed(seed, walletIndex, dPath, accountIndex);
  return new Account(nacl.sign.keyPair.fromSeed(derivedSeed).secretKey);
}

function deriveSeed(
  seed: Buffer,
  walletIndex: number,
  derivationPath: string | undefined,
  accountIndex: number,
) {
  switch (derivationPath) {
    case DERIVATION_PATH.deprecated:
      const path = `m/501'/${walletIndex}'/0/${accountIndex}`;
      return bip32.fromSeed(seed).derivePath(path).privateKey as Buffer;
    case DERIVATION_PATH.bip44:
      const path44 = `m/44'/501'/${walletIndex}'`;
      return derivePath(path44, seed.toString('hex')).key;
    case DERIVATION_PATH.bip44Change:
      const path44Change = `m/44'/501'/${walletIndex}'/0'`;
      return derivePath(path44Change, seed.toString('hex')).key;
    default:
      throw new Error(`invalid derivation path: ${derivationPath}`);
  }
}

export class CryptidWalletAccount implements WalletAccount {
  readonly #address: WalletAccount['address'];
  readonly #publicKey: WalletAccount['publicKey'];
  readonly #chains: WalletAccount['chains'];
  readonly #features: WalletAccount['features'];
  readonly #label: WalletAccount['label'];
  readonly #icon: WalletAccount['icon'];
  constructor({
    address,
    publicKey,
    label,
    icon,
  }: Omit<WalletAccount, 'chains' | 'features'>) {
    if (new.target === CryptidWalletAccount) {
      Object.freeze(this);
    }
    this.#address = address;
    this.#publicKey = publicKey;
    this.#chains = chains;
    this.#features = features;
    this.#label = label;
    this.#icon = icon;
  }

  get address() {
    return this.#address;
  }

  get publicKey() {
    return this.#publicKey.slice();
  }

  get chains() {
    return this.#chains.slice();
  }

  get features() {
    return this.#features.slice();
  }

  get label() {
    return this.#label;
  }

  get icon() {
    return this.#icon;
  }
}
