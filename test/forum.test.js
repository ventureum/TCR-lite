import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert'
import bs58 from 'bs58'

const BigNumber = web3.BigNumber

// eslint-disable-next-line
const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-string'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Forum = artifacts.require('Forum')
const Token = artifacts.require('VetXToken')

//Mocked data
const AirdropMock = artifacts.require('AirdropMock')

const boards = [
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000001',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000002',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000003']

const posts = [
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000004',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000005',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000006']

const replies = [
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000007',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000008',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000009',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000010',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000011',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000012']

const ipfsPaths = [
  'QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o',
  'QmTitSFQFQeBMZRDsGEvzdNgPnwx7coBCQxEYvNzgWPkK8',
  'QmTkzDwWqPbnAh5YiV5VwcTLnGdwSNsNTn2aDxdXBFca7D']

const ipfsMultihash = []

const AIRDROP_REWARD = 1

/**
 * Partition multihash string into object representing multihash
 *
 * @param {string} multihash A base58 encoded multihash string
 * @returns {Multihash}
 */
export function getBytes32FromMultiash(multihash) {
  const decoded = bs58.decode(multihash);

  return {
    digest: `0x${decoded.slice(2).toString('hex')}`,
    hashFunction: decoded[0],
    size: decoded[1],
  };
}

/**
 * Parse Solidity response in array to a Multihash object
 *
 * @param {array} response Response array from Solidity
 * @returns {Multihash} multihash object
 */
export function parseContractResponse(response) {
  const [digest, hashFunction, size] = response;
  return {
    digest,
    hashFunction: hashFunction.toNumber(),
    size: size.toNumber(),
  };
}

export function getMultihashFromBytes32(digest) {
  const hashFunction = 18;
  const size = 32;

  // cut off leading "0x"
  const hashBytes = Buffer.from(digest.slice(2), 'hex');

  // prepend hashFunction and digest size
  const multihashBytes = new (hashBytes.constructor)(2 + hashBytes.length);
  multihashBytes[0] = hashFunction;
  multihashBytes[1] = size;
  multihashBytes.set(hashBytes, 2);

  return bs58.encode(multihashBytes);
}

for (let i = 0; i < ipfsPaths.length; i++) {
  ipfsMultihash.push(getBytes32FromMultiash(ipfsPaths[i]))
}

function calculateFees (feesPercentage, val) {
  return val.times(feesPercentage).div(new BigNumber(100))
}

let token
let forum
let airdropMockToken
let airdropMock
let airdropMockValidate
let airdropMockAirdrop
let feesPercentage

contract('Basic Tests: ', function ([root, user1, user2, user3, _]) {
  beforeEach(async function () {
    token = await Token.new('10000', 'VetX', 18, 'VTX')
    forum = await Forum.new()
    airdropMockToken = await Token.new('1000000', 'AirdropMockToken', 18, 'AMT')
    airdropMock = await AirdropMock.new(airdropMockToken.address)

    //transfer token to AirdropMock contract
    airdropMockToken.transfer(airdropMock.address, 1000000)

    feesPercentage = await forum.feesPercentage.call()
    await token.transfer(user1, 1000, {from: root})
    await token.transfer(user2, 500, {from: root})
    await token.transfer(user3, 500, {from: root})

    let AirdropMockWeb3 = web3.eth.contract(airdropMock.abi)
    let airdropMockWeb3Instance = AirdropMockWeb3.at(airdropMock.address)
    airdropMockValidate = airdropMockWeb3Instance.validate.getData("0x0").slice(0, 10)
    airdropMockAirdrop = airdropMockWeb3Instance.airdrop.getData("0x0").slice(0, 10)
  })

  describe('Add a board: ', function () {
    it('by owner', async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
    })

    it('by non-owner', async function () {
      await forum.addBoard(boards[0], token.address, {from: user1}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Set board tokens: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
    })

    it('by owner', async function () {
      await forum.setBoardToken(boards[0], token.address).should.be.fulfilled
    })

    it('by non-owner', async function () {
      await forum.setBoardToken(boards[0], token.address, {from: user1}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Post: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
    })

    it('Post a new topic', async function () {
      await forum.post(
        boards[0],
        web3.toHex(0),
        posts[0],
        ipfsMultihash[0].digest,
        {from: user1}).should.be.fulfilled
      let content = await forum.getContentByHash.call(posts[0])
      content.should.equal(ipfsMultihash[0].digest)
    })

    it('Post a new airdrop topic', async function () {
      await forum.postAirdrop(
        boards[0],
        posts[1],
        ipfsMultihash[0].digest,
        airdropMock.address,
        airdropMockValidate,
        airdropMockAirdrop,
        {from: user1}).should.be.fulfilled

      const content = await forum.getContentByHash.call(posts[1])
      content.should.equal(ipfsMultihash[0].digest)

      const callAddress = await forum.getCallAddressByHash(posts[1])
      callAddress.should.be.equal(airdropMock.address)

      const callValidateSig = await forum.getCallValidateSigByHash.call(posts[1])
      callValidateSig.should.equal(airdropMockValidate)

      const callAirdropSig = await forum.getCallAirdropSigByHash.call(posts[1])
      callAirdropSig.should.equal(airdropMockAirdrop)
    })

    it('Validate and Airdrop a airdrop post topic', async function () {
      await forum.postAirdrop(
        boards[0],
        posts[2],
        ipfsMultihash[0].digest,
        airdropMock.address,
        airdropMockValidate,
        airdropMockAirdrop).should.be.fulfilled
      const validate = await forum.airdropValidate(posts[2], {from: user2})
      validate.should.be.equal(true)

      const preBal = await airdropMockToken.balanceOf(user2).should.be.fulfilled
      const preBalAirdropMock = await airdropMockToken.balanceOf(airdropMock.address)
        .should.be.fulfilled
      await forum.airdropCall(posts[2], {from: user2})
      const postBal = await airdropMockToken.balanceOf(user2).should.be.fulfilled
      const postBalAirdropMock = await airdropMockToken.balanceOf(airdropMock.address)
        .should.be.fulfilled

      postBal.minus(preBal).should.be.bignumber.equal(AIRDROP_REWARD)
      preBalAirdropMock.minus(postBalAirdropMock).should.be.bignumber.equal(AIRDROP_REWARD)
    })
  })

  describe('Update post: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
    })

    it('Update post by poster', async function () {
      await forum.updatePost(posts[0], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      let content = await forum.getContentByHash.call(posts[0])
      content.should.equal(ipfsMultihash[1].digest)
    })

    it('Update post by non original poster', async function () {
      await forum.updatePost(posts[0], ipfsMultihash[2].digest, {from: user2}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Upvote post: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
    })

    it('Simple upvote', async function () {
      await token.approve(forum.address, 100, {from: user2}).should.be.fulfilled
      await forum.upvote(user2, posts[0], 100, {from: user2}).should.be.fulfilled

      let rewards = await forum.rewards.call(posts[0])
      rewards.should.be.bignumber.equal(new BigNumber(100).sub(calculateFees(feesPercentage,
        new BigNumber(100))))
    })
  })

  describe('Withdraw rewards: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await token.approve(forum.address, 100, {from: user2}).should.be.fulfilled
      await forum.upvote(user2, posts[0], 100, {from: user2}).should.be.fulfilled
    })

    it('Simple withdraw', async function () {
      let rewards = await forum.rewards.call(posts[0])
      let preBal = await token.balanceOf.call(user1).should.be.fulfilled
      await forum.withdraw(posts[0], {from: user1}).should.be.fulfilled
      let bal = await token.balanceOf.call(user1).should.be.fulfilled
      bal.sub(preBal).should.be.bignumber.equal(rewards)
    })
  })

  describe('Batch read: ', function () {
    let repliesLen

    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[1], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[2], ipfsMultihash[2].digest, {from: user1}).should.be.fulfilled

      // replies
      await forum.post(boards[0], posts[0], replies[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled

      await forum.post(boards[0], posts[1], replies[1], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[1], replies[2], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled

      await forum.post(boards[0], posts[2], replies[3], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[2], replies[4], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[2], replies[5], ipfsMultihash[2].digest, {from: user1}).should.be.fulfilled

      repliesLen = [1, 2, 3]
    })

    it('getBatchPosts', async function () {
      let _posts = await forum.getBatchPosts.call(posts).should.be.fulfilled
      let len = 6
      for (let i = 0; i < 3; i++) {
        let k = i * len
        let tokenAddr = token.address.substr(2)
        let userAddr = user1.substr(2)
        tokenAddr = '0x' + tokenAddr.padStart(64, '0')
        userAddr = '0x' + userAddr.padStart(64, '0')
        _posts[k].should.equal(posts[i])
        _posts[k + 1].should.equal(tokenAddr)
        _posts[k + 2].should.equal(ipfsMultihash[i].digest)
        _posts[k + 3].should.equal(userAddr)
        web3.toBigNumber(_posts[k + 4]).should.be.bignumber.equal(new BigNumber(0))
        web3.toBigNumber(_posts[k + 5]).should.be.bignumber.equal(new BigNumber(repliesLen[i]))
      }
    })
  })

  describe('Get board token: ', function () {
    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
    })

    it('getBoardToken', async function () {
      const tokenRes = await forum.getBoardToken.call(boards[0])
      tokenRes.should.equal(token.address)
    })
  })
})
