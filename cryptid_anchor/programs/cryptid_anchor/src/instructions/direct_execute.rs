use std::collections::HashMap;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::log::sol_log_compute_units;
use bitflags::bitflags;
use crate::state::cryptid_account::CryptidAccount;
use crate::state::instruction_data::InstructionData;
use crate::util::SolDID;

#[derive(Accounts)]
#[instruction(
/// A vector of the number of extras for each signer, signer count is the length
signers_extras: Vec<u8>,
/// The instructions to execute
instructions: Vec<InstructionData>,
/// Additional flags
flags: DirectExecuteFlags,
)]
pub struct DirectExecute<'info> {
    /// The Cryptid instance to execute with
    pub cryptid_account: Account<'info, CryptidAccount>,
    /// The DID on the Cryptid instance
    pub did: Account<'info, DidAccount>,
    /// The program for the DID
    pub did_program: Program<'info, SolDID>,

    // RemainingAccounts:
    // /// The set of keys that sign for this transaction
    // #[account_argument(instruction_data = signers_extras)]
    // pub signing_keys: Vec<SigningKey>,
    // /// Accounts for the instructions, each should only appear once
    // pub instruction_accounts: Rest<AccountInfo>,
}

/// Executes a transaction directly if all required keys sign
pub fn direct_execute<'info>(
    ctx: Context<'_, '_, '_, 'info, DirectExecute<'info>>,
    signers_extras: Vec<u8>,
    instructions: Vec<InstructionData>,
    flags: DirectExecuteFlags,
) -> Result<()> {
    let debug = flags.contains(DirectExecuteFlags::DEBUG);
    if debug {
        accounts.print_keys();
    }

    // let signing_keys: Vec<AccountInfo> = ctx.remaining_accounts;
    if (ctx.accounts.cryptid_account.is_generative()) {
        msg!("Cryptid is generative")
    } else {
        msg!("Cryptid is not generative")
    }

    // // Retrieve needed data from cryptid account
    // let (key_threshold, signer_key, signer_seed_set) = match &ctx.accounts.cryptid_account {
    //     CryptidAccountAddress::OnChain(cryptid) => {
    //         cryptid.verify_did_and_program(accounts.did.key, accounts.did_program.key)?;
    //         let seeder = CryptidSignerSeeder {
    //             cryptid_account: cryptid.info.key,
    //         };
    //         let signer_key = seeder.create_address(program_id, cryptid.signer_nonce)?;
    //         (
    //             cryptid.key_threshold,
    //             signer_key,
    //             PDASeedSet::new(seeder, cryptid.signer_nonce),
    //         )
    //     }
    //     CryptidAccountAddress::Generative(cryptid) => {
    //         CryptidAccountAddress::verify_seeds(
    //             cryptid.key,
    //             program_id,
    //             accounts.did_program.key,
    //             accounts.did.key,
    //         )?;
    //         let seeder = CryptidSignerSeeder {
    //             cryptid_account: cryptid.key,
    //         };
    //         let (signer_key, signer_nonce) = seeder.find_address(program_id);
    //         (
    //             CryptidAccount::GENERATIVE_CRYPTID_KEY_THRESHOLD,
    //             signer_key,
    //             PDASeedSet::new(seeder, signer_nonce),
    //         )
    //     }
    // };
    //
    // // Error if there aren't enough signers
    // require_gte!(data.signers_extras.len(), key_threshold as usize, CryptidSignerError::NotEnoughSigners);
    //
    // msg!("Verifying keys");
    // // Verify the keys sent, this only checks that one is valid for now but will use the threshold eventually
    // verify_keys(
    //     &ctx.accounts.did_program,
    //     &ctx.accounts.did,
    //     accounts.signing_keys.iter(),
    // )?;
    //
    // let instruction_accounts_ref = accounts.instruction_accounts.iter().collect::<Vec<_>>();
    // let instruction_account_keys = accounts
    //     .instruction_accounts
    //     .iter()
    //     .map(|account| account.key)
    //     .collect::<Vec<_>>();
    //
    // msg!("Executing instructions");
    // // Execute instructions
    // for (index, instruction) in data.instructions.into_iter().enumerate() {
    //     // Convert the metas
    //     let metas = instruction
    //         .accounts
    //         .iter()
    //         .cloned()
    //         .map(|meta| meta.into_solana_account_meta(&instruction_account_keys))
    //         .collect::<Vec<_>>();
    //
    //     msg!("Remaining compute units for sub-instruction `{}`", index);
    //     sol_log_compute_units();
    //
    //     // Check if the metas contain a the signer and run relevant invoke
    //     let sub_instruction_result = if metas.iter().any(|meta| meta.pubkey == signer_key) {
    //         msg!("Invoking signed");
    //         signer_seed_set.invoke_signed_variable_size(
    //             &SolanaInstruction {
    //                 program_id: instruction_account_keys[instruction.program_id as usize],
    //                 accounts: metas,
    //                 data: instruction.data,
    //             },
    //             &instruction_accounts_ref,
    //         )
    //     } else {
    //         msg!("Invoking without signature");
    //         invoke_variable_size(
    //             &SolanaInstruction {
    //                 program_id: instruction_account_keys[instruction.program_id as usize],
    //                 accounts: metas,
    //                 data: instruction.data,
    //             },
    //             &instruction_accounts_ref,
    //         )
    //     };
    //
    //     // If sub-instruction errored log the index and error
    //     if let Err(error) = sub_instruction_result {
    //         return err!(CryptidSignerError::SubInstructionError);
    //     }
    // }

    Ok(())
}

fn build_instruction(
    program_id: Pubkey,
    arg: Self::BuildArg,
) -> Result<(Vec<SolanaAccountMeta>, Self::Data)> {
    let signer_key = CryptidSignerSeeder {
        cryptid_account: arg.cryptid_account,
    }
        .find_address(program_id)
        .0;
    let mut instruction_accounts = HashMap::new();

    // Go through all the instructions and collect all the accounts together
    for instruction in arg.instructions.iter() {
        instruction_accounts
            .entry(instruction.program_id)
            .or_insert_with(AccountMeta::empty); // No need to take the strongest as program has both false
        for account in instruction.accounts.iter() {
            let meta_value = if arg.instruction_accounts[account.key as usize] == signer_key {
                // If the account is the signer we don't want to sign it ourselves, the program will do that
                account.meta & AccountMeta::IS_WRITABLE
            } else {
                account.meta
            };

            *instruction_accounts
                .entry(account.key)
                .or_insert_with(AccountMeta::empty) |= meta_value; // Take the strongest value for each account
        }
    }
    // recombine `instruction_accounts` into a iterator of `SolanaAccountMeta`s
    let instruction_accounts =
        arg.instruction_accounts
            .into_iter()
            .enumerate()
            .map(|(index, value)| {
                let meta = instruction_accounts
                    .get(&(index as u8))
                    .expect("Could not get meta");
                SolanaAccountMeta {
                    pubkey: value,
                    is_signer: meta.contains(AccountMeta::IS_SIGNER),
                    is_writable: meta.contains(AccountMeta::IS_WRITABLE),
                }
            });

    let data = DirectExecuteData {
        signers_extras: arg
            .signing_keys
            .iter()
            .map(SigningKeyBuild::extra_count)
            .collect(),
        instructions: arg.instructions,
        flags: arg.flags,
    };
    let mut accounts = vec![
        SolanaAccountMeta::new_readonly(arg.cryptid_account, false),
        arg.did,
        SolanaAccountMeta::new_readonly(arg.did_program, false),
    ];
    accounts.extend(arg.signing_keys.iter().flat_map(SigningKeyBuild::to_metas));
    accounts.extend(instruction_accounts);
    Ok((accounts, data))
}

impl DirectExecute {
    /// Prints all the keys to the program log (compute budget intensive)
    pub fn print_keys(&self) {
        msg!("cryptid_account: {}", self.cryptid_account.info().key);
        msg!("did: {}", self.did.key);
        msg!("did_program: {}", self.did_program.key);
        msg!(
            "signing_keys: {:?}",
            self.signing_keys
                .iter()
                .map(|signing_keys| signing_keys.to_key_string())
                .collect::<Vec<_>>()
        );
        msg!(
            "instruction_accounts: {:?}",
            self.instruction_accounts
                .0
                .iter()
                .map(|account| account.key)
                .collect::<Vec<_>>()
        );
    }
}

bitflags! {
    /// Extra flags passed to DirectExecute
    #[derive(AnchorDeserialize, AnchorSerialize)]
    pub struct DirectExecuteFlags: u8{
        /// Print debug logs, uses a large portion of the compute budget
        const DEBUG = 1 << 0;
    }
}
