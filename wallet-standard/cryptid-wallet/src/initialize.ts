import { registerWallet } from './register.js';
import { CryptidWalletWallet } from './wallet.js';
import type { CryptidWallet, CryptidWalletEvent } from './window.js';
import { Keypair } from '@solana/web3.js';

export function initialize(): void {
    let keypair = Keypair.generate();

    const cryptidWallet: CryptidWallet = {
        publicKey: keypair.publicKey,
        connect,
        disconnect,
        signAndSendTransaction,
        signTransaction,
        signAllTransactions,
        signMessage,
        on: function <E extends keyof CryptidWalletEvent>(
            event: E,
            listener: CryptidWalletEvent[E],
            context?: any
        ): void {
            throw new Error('Function not implemented.');
        },
        off: function <E extends keyof CryptidWalletEvent>(
            event: E,
            listener: CryptidWalletEvent[E],
            context?: any
        ): void {
            throw new Error('Function not implemented.');
        },
    };
    registerWallet(new CryptidWalletWallet(cryptidWallet));
}
