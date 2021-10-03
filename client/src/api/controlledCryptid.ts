import { PublicKey, Transaction } from '@solana/web3.js';
import { Cryptid, CryptidOptions } from './cryptid';
import { directExecute } from '../lib/solana/transactions/directExecute';
import { NonEmptyArray } from '../types/lang';
import { AbstractCryptid } from './abstractCryptid';
import { didToPDA } from '../lib/solana/util';
import { Signer } from '../types/crypto';

export class ControlledCryptid extends AbstractCryptid {
  /**
   * Create a controlled cryptid account. Controlled by the controllerCryptid
   *
   * A controlled cryptid has no key - the key is provided by the controller
   * @param controlledDid
   * @param controllerCryptid
   * @param options
   */
  constructor(
    controlledDid: string,
    private controllerCryptid: Cryptid,
    options: CryptidOptions
  ) {
    super(controlledDid, options);
  }

  get signer(): Signer {
    return this.controllerCryptid.signer;
  }

  as(controlledDid: string): ControlledCryptid {
    return new ControlledCryptid(controlledDid, this, this.options);
  }

  async additionalKeys(): Promise<PublicKey[]> {
    const additionalKey = await didToPDA(this.controllerCryptid.did);
    const controllerAdditionalKeys =
      await this.controllerCryptid.additionalKeys();

    return [...controllerAdditionalKeys, additionalKey];
  }

  async sign(transaction: Transaction): Promise<NonEmptyArray<Transaction>> {
    const additionalSigners = await this.additionalKeys();
    const wrappedTransaction = await directExecute(
      transaction,
      this.did,
      this.signer.publicKey,
      [[this.signer, additionalSigners]]
    );
    return [wrappedTransaction];
  }
}