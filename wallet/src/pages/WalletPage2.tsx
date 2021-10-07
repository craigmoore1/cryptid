import React from 'react';
import BalancesList from '../components/BalancesList2';
import { useIsProdNetwork } from '../utils/connection';
import DebugButtons from '../components/DebugButtons';
import { useIsExtensionWidth } from '../utils/utils';
import Grid from "@material-ui/core/Grid";
import {CryptidSummary} from "../components/Cryptid/CryptidSummary";
import {useCryptid} from "../utils/Cryptid/cryptid";

export default function WalletPage() {
  const isProdNetwork = useIsProdNetwork();
  const isExtensionWidth = useIsExtensionWidth();
  const { selectedCryptidAccount } = useCryptid()
  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
        {selectedCryptidAccount && <CryptidSummary cryptidAccount={selectedCryptidAccount}/>}
        <BalancesList />
        {isProdNetwork ? null : (
          <Grid item xs={12}>
            <DebugButtons />
          </Grid>
        )}
      </div>
    </div>
  );
}
