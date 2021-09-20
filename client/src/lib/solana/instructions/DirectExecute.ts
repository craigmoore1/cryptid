import {
  AccountMeta,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Signer } from '../../../types/crypto';
import { deriveDefaultDOA } from '../util';
import { CryptidInstruction } from './instruction';
import { DOA_PROGRAM_ID } from '../../constants';
import { DecentralizedIdentifier } from '@identity.com/sol-did-client';
import { PROGRAM_ID } from '@identity.com/sol-did-client/dist/lib/constants';
import { any, find, propEq } from 'ramda';
import { InstructionData } from '../model/InstructionData';
import { TransactionAccountMeta } from '../model/TransactionAccountMeta';

export const create = async (
  unsignedTransaction: Transaction,
  did: string,
  signers: Signer[],
  doa?: PublicKey
): Promise<TransactionInstruction> => {
  const sendingDoa = doa || (await deriveDefaultDOA(did));
  const did_identifier = DecentralizedIdentifier.parse(did);

  const instruction_accounts: AccountMeta[] = [];
  unsignedTransaction.instructions.forEach(instruction => {
    if (!any(propEq('pubkey', instruction.programId))(instruction_accounts)) {
      instruction_accounts.push({
        pubkey: instruction.programId,
        isSigner: false,
        isWritable: false,
      });
    }

    instruction.keys.forEach(account => {
      const found: AccountMeta | undefined = find<AccountMeta>(
        propEq('pubkey', account.pubkey)
      )(instruction_accounts);
      if (found) {
        found.isSigner = found.isSigner || account.isSigner;
        found.isWritable = found.isWritable || account.isWritable;
      } else {
        instruction_accounts.push(account);
      }
    });
  });

  const keys: AccountMeta[] = [
    { pubkey: sendingDoa, isSigner: false, isWritable: false },
    {
      pubkey: did_identifier.pubkey.toPublicKey(),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
    ...signers.map(signer => ({
      pubkey: signer.publicKey,
      isSigner: true,
      isWritable: false,
    })),
    ...instruction_accounts,
  ];

  const instructions: InstructionData[] = unsignedTransaction.instructions.map(
    instruction =>
      new InstructionData({
        program_id: instruction.programId,
        accounts: instruction.keys.map(TransactionAccountMeta.fromAccountMeta),
        data: instruction.data,
      })
  );

  const data = CryptidInstruction.directExecute(
    signers.length,
    instructions
  ).encode();

  return new TransactionInstruction({
    keys,
    programId: DOA_PROGRAM_ID,
    data,
  });
};
