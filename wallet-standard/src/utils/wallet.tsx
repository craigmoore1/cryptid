import React, { useCallback, useContext, useState } from 'react';
import * as bs58 from 'bs58';
import {Account, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, VersionedTransaction} from '@solana/web3.js';
import nacl from 'tweetnacl';
import {
  refreshAccountInfo,
  useAccountInfo, useConnection,
} from './connection';
import { TOKEN_PROGRAM_ID } from './tokens/instructions';
import {
  parseMintData,
  parseTokenAccountData,
} from './tokens/data';
import {sleep, useLocalStorageState} from './utils';
import { useTokenInfo } from './tokens/names';
// import { useUnlockedMnemonicAndSeed, walletSeedChanged } from './wallet-seed';
import { getAccountFromSeed, CryptidWalletAccount } from './Wallet/AccountWallet';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { useUnlockedMnemonicAndSeed } from "./wallet-seed";
import {useCallAsync} from "./notifications";
import { CryptidWalletInterface } from './window';
import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignAndSendTransactionMethod,
  SolanaSignAndSendTransactionOutput,
  SolanaSignMessageFeature,
  SolanaSignMessageMethod,
  SolanaSignMessageOutput,
  SolanaSignTransactionFeature,
  SolanaSignTransactionMethod,
  SolanaSignTransactionOutput,
} from '@solana/wallet-standard-features';
import type { Wallet } from '@wallet-standard/base';
import type {
  ConnectFeature,
  ConnectMethod,
  DisconnectFeature,
  DisconnectMethod,
  EventsFeature,
  EventsListeners,
  EventsNames,
  EventsOnMethod,
} from '@wallet-standard/features';
import { icon } from './icon.js';
import type { SolanaChain } from './Wallet/solana.js';
import { isSolanaChain, SOLANA_CHAINS } from './Wallet/solana.js';
import { bytesEqual } from './utils';

type WalletType = 'sw' | 'sw_imported' | 'adapter'

export const WalletTypeString = {
  sw: 'Seed Derived',
  sw_imported: 'Imported Private Key',
  adapter: 'Wallet Adapter'
}

export interface WalletInterface {
  publicKey: PublicKey | null;
  signTransaction?(transaction: Transaction): Promise<Transaction>;
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
}

export interface StrictWalletInterface {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
}

interface PersistedWalletType {
    type: WalletType,
    name: string,
    walletIndex?: number,
    privateKey?: {
      bs58Nonce: string,
      bs58Cipher: string,
    }
}

interface KeyedPersistedWalletType {
  [bs58PublicKey: string]: PersistedWalletType
}

export interface ExtendedPersistedWalletType extends  PersistedWalletType{
  isActive: boolean
  bs58PublicKey: string
}

interface WalletContextInterface {
  wallet: CryptidWallet,
  connectWallet: (publicKey: PublicKey) => void,
  disconnectWallet: () => void,
  addWallet: (name: string, useAdapter: boolean, importedKey?: Keypair) => PublicKey,
  hasWallet: (publicKey: PublicKey) => boolean,
  listWallets: () => ExtendedPersistedWalletType[],
  showWalletConnectDialogWithPublicKey: string | undefined,
  setShowWalletConnectDialogWithPublicKey: (v: string | undefined) => void
  hasUnlockedMnemonic: boolean
}

const DEFAULT_WALLET_INTERFACE = { publicKey: null,
 }

const WalletContext = React.createContext<WalletContextInterface>({
  wallet: ,
  connectWallet: () => {},
  disconnectWallet: () => {},
  addWallet: () => { throw new Error('Not loaded')},
  hasWallet: () => false,
  listWallets: () => [],
  showWalletConnectDialogWithPublicKey: undefined,
  setShowWalletConnectDialogWithPublicKey: () => {},
  hasUnlockedMnemonic: false,
});

export function WalletProvider({ children }) {
  // useListener(walletSeedChanged, 'change');
  const [{
    mnemonic,
    seed,
    importsEncryptionKey,
    derivationPath
  }, loadedingMnemonicPromise ] = useUnlockedMnemonicAndSeed(); // TODO how can these not be optional?

  const [wallet, setWallet] = useState<CryptidWallet>(); // we mirror the wallet-adapter interface

  // globalModals
  const [showWalletConnectDialogWithPublicKey, setShowWalletConnectDialogWithPublicKey] = useState<string|undefined>();


  const adapterWallet = useAdapterWallet()

  const [ persistedWallets, setPersistedWallets ] = useLocalStorageState<KeyedPersistedWalletType>(
    'wallets',
    {},
  );

  // `walletCount` is the number of HD wallets.
  const [walletCount, setWalletCount] = useLocalStorageState('walletCount', 1);

  const addWallet = useCallback((name: string, useAdapter: boolean = false, importedKey?: Keypair): PublicKey => {
    if (useAdapter) {
      if (!adapterWallet.publicKey) {
        throw new Error(`Trying to add Wallet from wallet-adapter, but none connected`)
      }

      setPersistedWallets( { ...persistedWallets, [adapterWallet.publicKey.toBase58()]: {
          type: "adapter",
          name
        }})
      return adapterWallet.publicKey
    }

    if (!seed || !importsEncryptionKey) {
      throw new Error('Cannot addWallet without initialized Wallet Seed')
    }

    if (importedKey) {
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const cipher = nacl.secretbox(importedKey.secretKey, nonce, importsEncryptionKey);

      setPersistedWallets( { ...persistedWallets, [importedKey.publicKey.toBase58()]: {
          type: "sw_imported",
          name,
          privateKey: {
            bs58Nonce: bs58.encode(nonce),
            bs58Cipher: bs58.encode(cipher),
          }
        }})
      return importedKey.publicKey
    }

    console.log(`Created new SW Key with Walletcount ${walletCount}`)


    // Derivation case
    const account = getAccountFromSeed(
      Buffer.from(seed, 'hex'),
      walletCount,
      derivationPath,
    )

    console.log(`Created new SW Key with ${account.publicKey.toBase58()}`)


    setPersistedWallets( { ...persistedWallets, [account.publicKey.toBase58()]: {
        type: "sw",
        name,
        walletIndex: walletCount
    }})

    // update Walletcount
    setWalletCount(walletCount + 1);
    return account.publicKey

  }, [persistedWallets, setPersistedWallets, adapterWallet, walletCount, setWalletCount, seed, importsEncryptionKey])

  const hasWallet = useCallback((publicKey: PublicKey) => {
    return !!persistedWallets[publicKey.toBase58()]
  }, [persistedWallets])

  const connectWallet = useCallback(async (publicKey: PublicKey) => {
    const persistetWallet = persistedWallets[publicKey.toBase58()];
    if (!persistetWallet) {
      throw new Error(`No persisted wallet found for ${publicKey.toBase58()}`)
    }

    if( persistetWallet.type === "adapter" ) {
      // set to adapter
      setWallet(adapterWallet)

      // preset popup to connect
      console.log('ADAPTER READY? ' + adapterWallet.ready)
      if (!adapterWallet.ready) {
        // show connection model
        setShowWalletConnectDialogWithPublicKey(publicKey.toBase58())
      } else {
        await adapterWallet.connect()
        // check matching key?
        if (!adapterWallet.publicKey || !publicKey.equals(adapterWallet.publicKey)) {
          console.log('Connection to wallet adapter failed or selected wallet does not match requested Key')
          setShowWalletConnectDialogWithPublicKey(publicKey.toBase58())
        }
      }

      return
    }

    if (!seed || !importsEncryptionKey) {
      throw new Error('Cannot connect AccountWallet without initialized Wallet Seed')
    }

    let account: Account | undefined;
    if (persistetWallet.type === "sw" && persistetWallet.walletIndex) {

      account = getAccountFromSeed(
        Buffer.from(seed, 'hex'),
        persistetWallet.walletIndex,
        derivationPath,
      )

    }

    if (persistetWallet.type === "sw_imported" && persistetWallet.privateKey ) {
      // "sw_imported"
      account = new Account(nacl.secretbox.open(
        bs58.decode(persistetWallet.privateKey.bs58Cipher),
        bs58.decode(persistetWallet.privateKey.bs58Nonce),
        importsEncryptionKey,
      ) as Uint8Array) // TODO: unhandled error-case
    }

    if (!account) {
      throw new Error(`An error occured when trying to connect AccountWallet: ${account}`)
    }

    setWallet(new CryptidWallet({}))
  }, [persistedWallets, hasWallet, adapterWallet, setWallet, seed, importsEncryptionKey])

  const disconnectWallet = useCallback(() => {
    setWallet(DEFAULT_WALLET_INTERFACE)
  }, [setWallet])

  const listWallets = useCallback(
    () => Object.keys(persistedWallets).map(key => ({ ...persistedWallets[key], bs58PublicKey: key, isActive: key === wallet.publicKey?.toBase58()})),
    [persistedWallets, wallet])

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connectWallet,
        disconnectWallet,
        addWallet,
        hasWallet,
        listWallets,
        showWalletConnectDialogWithPublicKey,
        setShowWalletConnectDialogWithPublicKey,
        hasUnlockedMnemonic: !loadedingMnemonicPromise && !!mnemonic
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}

export function useRequestAirdrop(refreshCallback?: () => void) {
  const callAsync = useCallAsync();
  const connection = useConnection();

  return (...addresses: PublicKey[]) => {
    addresses.forEach(address => {
      callAsync(
        (async () => {
          try {
            await connection.requestAirdrop(address, LAMPORTS_PER_SOL * 2);
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("429 Too Many Requests:")){
              console.log("Too many requests, trying again after 10000ms");
              await new Promise(resolve => setTimeout(resolve, 10000));
              await connection.requestAirdrop(address, LAMPORTS_PER_SOL * 5);
            } else {
              throw e;
            }
          }
        })(),
        {
          onSuccess: async () => {
            await sleep(5000);
            refreshAccountInfo(connection, address);
            refreshCallback && refreshCallback();
          },
          successMessage:
            'Success!',
        },
      );
    })
  };
}

export function useBalanceInfo(publicKey) {
  let [accountInfo, accountInfoLoaded] = useAccountInfo(publicKey);
  let { mint, owner, amount }: {mint?: PublicKey, owner?: PublicKey, amount?: number}  = accountInfo?.owner.equals(TOKEN_PROGRAM_ID)
    ? parseTokenAccountData(accountInfo.data)
    : {};
  let [mintInfo, mintInfoLoaded] = useAccountInfo(mint);
  let { name, symbol, logoUri } = useTokenInfo(mint);

  if (!accountInfoLoaded) {
    return null;
  }

  if (mint && mintInfoLoaded && mintInfo) {
    try {
      let { decimals } = parseMintData(mintInfo.data);
      return {
        amount,
        decimals,
        mint,
        owner,
        tokenName: name,
        tokenSymbol: symbol,
        tokenLogoUri: logoUri,
        valid: true,
      };
    } catch (e) {
      return {
        amount,
        decimals: 0,
        mint,
        owner,
        tokenName: 'Invalid',
        tokenSymbol: 'INVALID',
        tokenLogoUri: null,
        valid: false,
      };
    }
  }

  if (!mint) {
    return {
      amount: accountInfo?.lamports ?? 0,
      decimals: 9,
      mint: null,
      owner: publicKey,
      tokenName: 'SOL',
      tokenSymbol: 'SOL',
      valid: true,
    };
  }

  return null;
}
export type CryptidFeature = {
  'cryptid:': {
      cryptid: CryptidWalletInterface;
  };
};
export class CryptidWallet implements Wallet {
  readonly #listeners: { [E in EventsNames]?: EventsListeners[E][] } = {};
    readonly #version = '1.0.0' as const;
    readonly #name = 'Cryptid' as const;
    readonly #icon = icon;
    #account: CryptidWalletAccount | null = null;
    readonly #cryptid: CryptidWalletInterface;

    get version() {
        return this.#version;
    }

    get name() {
        return this.#name;
    }

    get icon() {
        return this.#icon;
    }

    get chains() {
        return SOLANA_CHAINS.slice();
    }

    get features(): ConnectFeature &
        DisconnectFeature &
        EventsFeature &
        SolanaSignAndSendTransactionFeature &
        SolanaSignTransactionFeature &
        SolanaSignMessageFeature &
        CryptidFeature {
        return {
            'standard:connect': {
                version: '1.0.0',
                connect: this.#connect,
            },
            'standard:disconnect': {
                version: '1.0.0',
                disconnect: this.#disconnect,
            },
            'standard:events': {
                version: '1.0.0',
                on: this.#on,
            },
            'solana:signAndSendTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signAndSendTransaction: this.#signAndSendTransaction,
            },
            'solana:signTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signTransaction: this.#signTransaction,
            },
            'solana:signMessage': {
                version: '1.0.0',
                signMessage: this.#signMessage,
            },
            'cryptid:': {
                cryptid: this.#cryptid,
            },
        };
    }

    get accounts() {
        return this.#account ? [this.#account] : [];
    }

    constructor(cryptid: CryptidWalletInterface) {
        if (new.target === CryptidWallet) {
            Object.freeze(this);
        }

        this.#cryptid = cryptid;

        cryptid.on('connect', this.#connected, this);
        cryptid.on('disconnect', this.#disconnected, this);
        cryptid.on('accountChanged', this.#reconnected, this);

        this.#connected();
    }

    #on: EventsOnMethod = (event, listener) => {
        this.#listeners[event]?.push(listener) || (this.#listeners[event] = [listener]);
        return (): void => this.#off(event, listener);
    };

    #emit<E extends EventsNames>(event: E, ...args: Parameters<EventsListeners[E]>): void {
        // eslint-disable-next-line prefer-spread
        this.#listeners[event]?.forEach((listener) => listener.apply(null, args));
    }

    #off<E extends EventsNames>(event: E, listener: EventsListeners[E]): void {
        this.#listeners[event] = this.#listeners[event]?.filter((existingListener) => listener !== existingListener);
    }

    #connected = () => {
        const address = this.#cryptid.publicKey?.toBase58();
        if (address) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const publicKey = this.#cryptid.publicKey!.toBytes();

            const account = this.#account;
            if (!account || account.address !== address || !bytesEqual(account.publicKey, publicKey)) {
                this.#account = new CryptidWalletAccount({ address, publicKey });
                this.#emit('change', { accounts: this.accounts });
            }
        }
    };

    #disconnected = () => {
        if (this.#account) {
            this.#account = null;
            this.#emit('change', { accounts: this.accounts });
        }
    };

    #reconnected = () => {
        if (this.#cryptid.publicKey) {
            this.#connected();
        } else {
            this.#disconnected();
        }
    };

    #connect: ConnectMethod = async ({ silent } = {}) => {
        if (!this.#account) {
            await this.#cryptid.connect(silent ? { onlyIfTrusted: true } : undefined);
        }

        this.#connected();

        return { accounts: this.accounts };
    };

    #disconnect: DisconnectMethod = async () => {
        await this.#cryptid.disconnect();
    };

    #signAndSendTransaction: SolanaSignAndSendTransactionMethod = async (...inputs) => {
        if (!this.#account) throw new Error('not connected');

        const outputs: SolanaSignAndSendTransactionOutput[] = [];

        if (inputs.length === 1) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { transaction, account, chain, options } = inputs[0]!;
            const { minContextSlot, preflightCommitment, skipPreflight, maxRetries } = options || {};
            if (account !== this.#account) throw new Error('invalid account');
            if (!isSolanaChain(chain)) throw new Error('invalid chain');

            const { signature } = await this.#cryptid.signAndSendTransaction(
                VersionedTransaction.deserialize(transaction),
                {
                    preflightCommitment,
                    minContextSlot,
                    maxRetries,
                    skipPreflight,
                }
            );

            outputs.push({ signature: bs58.decode(signature) });
        } else if (inputs.length > 1) {
            for (const input of inputs) {
                outputs.push(...(await this.#signAndSendTransaction(input)));
            }
        }

        return outputs;
    };

    #signTransaction: SolanaSignTransactionMethod = async (...inputs) => {
        if (!this.#account) throw new Error('not connected');

        const outputs: SolanaSignTransactionOutput[] = [];

        if (inputs.length === 1) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { transaction, account, chain } = inputs[0]!;
            if (account !== this.#account) throw new Error('invalid account');
            if (chain && !isSolanaChain(chain)) throw new Error('invalid chain');

            const signedTransaction = await this.#cryptid.signTransaction(VersionedTransaction.deserialize(transaction));

            outputs.push({ signedTransaction: signedTransaction.serialize() });
        } else if (inputs.length > 1) {
            let chain: SolanaChain | undefined = undefined;
            for (const input of inputs) {
                if (input.account !== this.#account) throw new Error('invalid account');
                if (input.chain) {
                    if (!isSolanaChain(input.chain)) throw new Error('invalid chain');
                    if (chain) {
                        if (input.chain !== chain) throw new Error('conflicting chain');
                    } else {
                        chain = input.chain;
                    }
                }
            }

            const transactions = inputs.map(({ transaction }) => Transaction.from(transaction));

            const signedTransactions = await this.#cryptid.signAllTransactions(transactions);

            outputs.push(
                ...signedTransactions.map((signedTransaction) => ({ signedTransaction: signedTransaction.serialize() }))
            );
        }

        return outputs;
    };

    #signMessage: SolanaSignMessageMethod = async (...inputs) => {
        if (!this.#account) throw new Error('not connected');

        const outputs: SolanaSignMessageOutput[] = [];

        if (inputs.length === 1) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { message, account } = inputs[0]!;
            if (account !== this.#account) throw new Error('invalid account');

            const { signature } = await this.#cryptid.signMessage(message);

            outputs.push({ signedMessage: message, signature });
        } else if (inputs.length > 1) {
            for (const input of inputs) {
                outputs.push(...(await this.#signMessage(input)));
            }
        }

        return outputs;
    };
}