import { refreshWalletPublicKeys, useBalanceInfo } from '../utils/wallet';
import { useUpdateTokenName } from '../utils/tokens/names';
import { useCallAsync, useSendTransaction } from '../utils/notifications';
import {Account, Keypair, LAMPORTS_PER_SOL} from '@solana/web3.js';
import { abbreviateAddress, sleep } from '../utils/utils';
import {
  refreshAccountInfo,
  useConnectionConfig,
} from '../utils/connection';
import { createAndInitializeMint } from '../utils/tokens';
import { Tooltip, Button } from '@material-ui/core';
import React from 'react';
import { MAINNET_URL } from "../utils/clusters";
import {useCryptid} from "../utils/Cryptid/cryptid";

export default function DebugButtons() {
  // const wallet = useWallet();
  // const balanceInfo = useBalanceInfo(wallet.publicKey);

  const { selectedCryptidAccount } = useCryptid()
  const balanceInfo = useBalanceInfo(selectedCryptidAccount.address);

  const updateTokenName = useUpdateTokenName();
  const { endpoint } = useConnectionConfig();
  const [sendTransaction, sending] = useSendTransaction();
  const callAsync = useCallAsync();

  let { amount } = balanceInfo || {};

  function requestAirdrop() {
    callAsync(
      selectedCryptidAccount.connection.requestAirdrop(selectedCryptidAccount.address, LAMPORTS_PER_SOL),
      
      {
        onSuccess: async () => {
          await sleep(5000);
          refreshAccountInfo(selectedCryptidAccount.connection, selectedCryptidAccount.address);
        },
        successMessage:
          'Success! Please wait up to 30 seconds for the SOL tokens to appear in your wallet.',
      },
    );

    callAsync(
      selectedCryptidAccount.connection.requestAirdrop(selectedCryptidAccount.activeSigningKey(), LAMPORTS_PER_SOL),
      {
        onSuccess: async () => {
          await sleep(5000);
          refreshAccountInfo(selectedCryptidAccount.connection, selectedCryptidAccount.address);
        },
        successMessage:
          'Success! Please wait up to 30 seconds for the SOL tokens to appear in your wallet.',
      },
    );
    
  }

  function mintTestToken() {
    let mint = new Account();
    updateTokenName(
      mint.publicKey,
      `Test Token ${abbreviateAddress(mint.publicKey)}`,
      `TEST${mint.publicKey.toBase58().slice(0, 2)}`,
    );
    console.log("account address: ", selectedCryptidAccount.address.toBase58());
    createAndInitializeMint({
        connection: selectedCryptidAccount.connection,
        owner: selectedCryptidAccount,
        mint,
        amount: 1000,
        decimals: 2,
        initialAccount: Keypair.generate(),
        transactionCallback: sendTransaction,
        onSuccess: () => refreshWalletPublicKeys(selectedCryptidAccount),
    });
  }

  const noSol = amount === 0;
  const requestAirdropDisabled = endpoint === MAINNET_URL;
  const spacing = 24;
  return (
    <div style={{ display: 'flex', marginLeft: spacing }}>
      <Tooltip
        title={
          requestAirdropDisabled
            ? 'Receive some devnet SOL for free. Only enabled on the devnet'
            : 'Receive some devnet SOL for free'
        }
      >
        <span>
          <Button
            variant="contained"
            color="primary"
            onClick={requestAirdrop}
            disabled={requestAirdropDisabled}
          >
            Request Airdrop
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        title={
          noSol
            ? 'Generate and receive balances in a new test token. Requires SOL balance'
            : 'Generate and receive balances in a new test token'
        }
      >
        <span>
          <Button
            variant="contained"
            color="primary"
            onClick={mintTestToken}
            disabled={sending || noSol}
            style={{ marginLeft: spacing }}
          >
            Mint Test Token
          </Button>
        </span>
      </Tooltip>
    </div>
  );
}
