import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import {initialize} from '../../cryptid-wallet'
import {CryptidWallet} from '../../cryptid-wallet/src/account'
const cryptid = new CryptidWallet()
initialize(cryptid)
ReactDOM.render(
    <StrictMode>
        <App />
    </StrictMode>,
    document.getElementById('app')
);
