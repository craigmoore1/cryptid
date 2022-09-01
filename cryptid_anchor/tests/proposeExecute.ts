import {Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram} from "@solana/web3.js";
import chai from 'chai';
import chaiAsPromised from "chai-as-promised";
import {cryptidTransferInstruction, deriveCryptidAccountAddress, toAccountMeta} from "./util/cryptid";
import {initializeDIDAccount} from "./util/did";
import {fund, createTestContext} from "./util/anchorUtils";
import {DID_SOL_PROGRAM} from "@identity.com/sol-did-client";

chai.use(chaiAsPromised);
const {expect} = chai;

describe.skip("proposeExecute", () => {
    const {
        program,
        provider,
        authority,
        balanceOf
    } = createTestContext();

    let didAccount: PublicKey;
    let cryptidAccount: PublicKey;
    let cryptidBump: number;

    before('Set up DID account', async () => {
        didAccount = await initializeDIDAccount(authority);
    })

    before('Set up generative Cryptid Account', async () => {
        [cryptidAccount, cryptidBump] = await deriveCryptidAccountAddress(didAccount);

        await fund(provider, cryptidAccount, 20 * LAMPORTS_PER_SOL);
    })

    it("can propose and execute a transfer through Cryptid", async () => {
        const recipient = Keypair.generate();

        const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL

        const previousBalance = await balanceOf(cryptidAccount);

        const transactionAccount = Keypair.generate();
        // propose the Cryptid transaction
        await program.methods.proposeTransaction(
            [instructionData],
            2,
        ).accounts({
                cryptidAccount,
                authority: authority.publicKey,
                transactionAccount: transactionAccount.publicKey
            }
        ).remainingAccounts([
                toAccountMeta(recipient.publicKey, true, false),
                toAccountMeta(SystemProgram.programId)
            ]
        ).signers(
            [transactionAccount]
        ).rpc({skipPreflight: true}); // skip preflight so we see validator logs on error

        let currentBalance = await balanceOf(cryptidAccount);
        expect(previousBalance - currentBalance).to.equal(0); // Nothing has happened yet

        // execute the Cryptid transaction
        await program.methods.executeTransaction(
            Buffer.from([]),  // no controller chain
            cryptidBump,
            0
        ).accounts({
                cryptidAccount,
                didProgram: DID_SOL_PROGRAM,
                did: didAccount,
                signer: authority.publicKey,
                destination: authority.publicKey,
                transactionAccount: transactionAccount.publicKey
            }
        ).remainingAccounts([
            toAccountMeta(recipient.publicKey, true, false),
            toAccountMeta(SystemProgram.programId)
        ]).rpc({skipPreflight: true}); // skip preflight so we see validator logs on error

        currentBalance = await balanceOf(cryptidAccount);
        expect(previousBalance - currentBalance).to.equal(LAMPORTS_PER_SOL); // Now the tx has been executed
    });

    //
    // it("rejects the transfer if the cryptid account is not a signer", async () => {
    //     const recipient = Keypair.generate();
    //
    //     const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL
    //
    //     // set the cryptid account as a non-signer on the transfer
    //     instructionData.accounts[0].meta = 2; // writable but not a signer
    //
    //     // execute the Cryptid transaction
    //     const shouldFail = program.methods.directExecute(
    //         Buffer.from([]),  // no controller chain
    //         [instructionData],
    //         cryptidBump,
    //         0
    //     ).accounts({
    //             cryptidAccount,
    //             didProgram: DID_SOL_PROGRAM,
    //             did: didAccount,
    //             signer: authority.publicKey,
    //         }
    //     ).remainingAccounts([
    //         toAccountMeta(recipient.publicKey, true, false),
    //         toAccountMeta(SystemProgram.programId)
    //     ]).rpc({ skipPreflight: true }); // skip preflight so we see validator logs on error
    //
    //     return expect(shouldFail).to.be.rejectedWith(/MissingRequiredSignature/);
    // });
    //
    // it("rejects the transfer if the recipient account index is invalid", async () => {
    //     const recipient = Keypair.generate();
    //
    //     const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL
    //
    //     // set the recipient account as an invalid account index
    //     instructionData.accounts[1].key = 100; // account 100 does not exist
    //
    //     // execute the Cryptid transaction
    //     const shouldFail = program.methods.directExecute(
    //         Buffer.from([]),  // no controller chain
    //         [instructionData],
    //         cryptidBump,
    //         0
    //     ).accounts({
    //             cryptidAccount,
    //             didProgram: DID_SOL_PROGRAM,
    //             did: didAccount,
    //             signer: authority.publicKey,
    //         }
    //     ).remainingAccounts([
    //         toAccountMeta(recipient.publicKey, true, false),
    //         toAccountMeta(SystemProgram.programId)
    //     ]).rpc({ skipPreflight: true }); // skip preflight so we see validator logs on error
    //
    //     // TODO expose the actual error from the program
    //     return expect(shouldFail).to.be.rejectedWith(/ProgramFailedToComplete/);
    // });
    //
    // it("rejects the transfer if the signer is not a valid signer on the DID", async () => {
    //     const recipient = Keypair.generate();
    //     const bogusSigner = Keypair.generate();
    //
    //     const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL
    //
    //     // execute the Cryptid transaction
    //     const shouldFail = program.methods.directExecute(
    //         Buffer.from([]),  // no controller chain
    //         [instructionData],
    //         cryptidBump,
    //         0
    //     ).accounts({
    //             cryptidAccount,
    //             didProgram: DID_SOL_PROGRAM,
    //             did: didAccount,
    //             signer: bogusSigner.publicKey,   // specify the bogus signer as the cryptid signer
    //         }
    //     ).remainingAccounts([
    //         toAccountMeta(recipient.publicKey, true, false),
    //         toAccountMeta(SystemProgram.programId)
    //     ]).signers(
    //         [bogusSigner]    // sign with the bogus signer
    //     ).rpc({ skipPreflight: true }); // skip preflight so we see validator logs on error
    //
    //     // TODO expose the error from the program
    //     return expect(shouldFail).to.be.rejected;
    // });
    //
    // it("can transfer through Cryptid with a second key on the DID", async () => {
    //     const secondKey = Keypair.generate();
    //     const recipient = Keypair.generate();
    //
    //     const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL
    //
    //     // thunk to execute the Cryptid transaction
    //     const execute = () =>
    //         program.methods.directExecute(
    //             Buffer.from([]),  // no controller chain
    //             [instructionData],
    //             cryptidBump,
    //             0
    //         ).accounts({
    //                 cryptidAccount,
    //                 didProgram: DID_SOL_PROGRAM,
    //                 did: didAccount,
    //                 signer: secondKey.publicKey, // the second key is the signer
    //             }
    //         ).remainingAccounts([
    //             toAccountMeta(recipient.publicKey, true, false),
    //             toAccountMeta(SystemProgram.programId)
    //         ]).signers(
    //             [secondKey]    // sign with the second key
    //         ).rpc({ skipPreflight: true }); // skip preflight so we see validator logs on error
    //
    //     const previousBalance = await balanceOf(cryptidAccount);
    //
    //     // should fail before the key is added:
    //     expect(execute()).to.be.rejected;
    //
    //     // add the second key to the did
    //     await addKeyToDID(authority, secondKey.publicKey);
    //
    //     // should pass afterwards
    //     await execute();
    //
    //     const currentBalance = await balanceOf(cryptidAccount);
    //
    //     expect(previousBalance - currentBalance).to.equal(LAMPORTS_PER_SOL); // Should have lost 1 SOL
    // });
    //
    // it("can transfer through Cryptid with an additonal key on the DID, without the first key signing at all", async () => {
    //     // The difference between this case and the above, is that in the above case, the first key
    //     // is paying fees, and is therefore still a signer on the tx. In this case, only the second key is present
    //
    //     const secondKey = Keypair.generate();
    //     const secondKeyProvider = new AnchorProvider(
    //         provider.connection,
    //         new anchor.Wallet(secondKey),
    //         AnchorProvider.defaultOptions()
    //     );
    //     const secondKeyAuthority = secondKeyProvider.wallet;
    //     const secondKeyProgram = new Program<CryptidAnchor>(
    //         program.idl,
    //         program.programId,
    //         secondKeyProvider,
    //         program.coder
    //     );
    //     // fund the second key, because it has to pay gas this time
    //     await fund(provider, secondKey.publicKey, LAMPORTS_PER_SOL);
    //
    //     const recipient = Keypair.generate();
    //
    //     const instructionData = cryptidTransferInstruction(LAMPORTS_PER_SOL); // 1 SOL
    //
    //     console.log("accounts", {
    //         cryptidAccount: cryptidAccount.toBase58(),
    //         recipient: recipient.publicKey.toBase58(),
    //         signer: secondKeyAuthority.publicKey.toBase58(),
    //         DID_SOL_PROGRAM: DID_SOL_PROGRAM.toBase58(),
    //     })
    //
    //     // thunk to execute the Cryptid transaction
    //     const execute = () =>
    //         secondKeyProgram.methods.directExecute(
    //             Buffer.from([]),  // no controller chain
    //             [instructionData],
    //             cryptidBump,
    //             0
    //         ).accounts({
    //                 cryptidAccount,
    //                 didProgram: DID_SOL_PROGRAM,
    //                 did: didAccount,
    //                 signer: secondKeyAuthority.publicKey, // the second key is the signer
    //             }
    //         ).remainingAccounts([
    //             toAccountMeta(recipient.publicKey, true, false),
    //             toAccountMeta(SystemProgram.programId)
    //         ]).rpc({ skipPreflight: true }); // skip preflight so we see validator logs on error
    //
    //     const previousBalance = await balanceOf(cryptidAccount);
    //
    //     // should fail before the key is added:
    //     expect(execute()).to.be.rejected;
    //
    //     // add the second key to the did
    //     await addKeyToDID(authority, secondKey.publicKey);
    //
    //     // should pass afterwards
    //     await execute();
    //
    //     const currentBalance = await balanceOf(cryptidAccount);
    //
    //     expect(previousBalance - currentBalance).to.equal(LAMPORTS_PER_SOL); // Should have lost 1 SOL
    // });
});
