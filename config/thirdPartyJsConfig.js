const rootDir = __dirname + '/../'

import { expect } from 'chai'
import bs58 from 'bs58'

const env = require(rootDir + '.env.json')


export default function () {
  const fs = require('fs')
  const HDWalletProvider = require('truffle-hdwallet-provider')
  const Web3 = require('web3')
  const ganachiWeb3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  const mnemonic = fs.readFileSync(rootDir + 'mnemonic.txt').toString().split('\n')[0]
  let wweb3 = ganachiWeb3
  if (env['provider'] == "on") {
    wweb3 = new Web3(new HDWalletProvider(mnemonic, 'http://localhost:8545'))
  }
  const BigNumber = wweb3.BigNumber
  const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-string'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

  return {
    'wweb3': wweb3,
    'ganachiWeb3': ganachiWeb3,
    'Web3': Web3,
    'should': should,
    'fs': fs,
    'bs58': bs58,
    'expect': expect
  }
}
