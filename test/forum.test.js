import {
  should,
  bs58,
  wweb3,
  TimeSetter,
  Web3,
  Error
} from "./constants.js"
const shared = require('./shared.js')

const EVMRevert = Error.EVMRevert

const BigNumber = web3.BigNumber

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

const POST = web3.sha3('POST').substring(0, 10)
const COMMENT = web3.sha3('COMMENT').substring(0, 10)
const AIRDROP = web3.sha3('AIRDROP').substring(0, 10)
const AUDIT = web3.sha3('AUDIT').substring(0, 10)
const AIRDROP_REWARD = new BigNumber(1)

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

let context
let token
let vtx
let forum
let airdropMockToken
let airdropMock
let airdropMockValidate
let airdropMockAirdrop
let feesPercentage

contract('Basic Tests: ', function (accounts) {
  const root = accounts[0]
  const user1 = accounts[1]
  const user2 = accounts[2]
  const user3 = accounts[3]

  beforeEach(async function () {
    context = await shared.run(accounts)
    token = context.mockToken1
    vtx = context.vetXToken
    forum = context.forum
    airdropMockToken = context.airdropMockToken
    airdropMock = context.airdropMock

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

  describe('Milestone: ', function () {
    let milestoneToken
    const MILESTONE_PRICE = 10
    const MILESTONE_ETH = 200
    const MILESTONE_REFUND_ETH = 50
    const MILESTONE_ENDTIME_DURATION = TimeSetter.OneMonth
    const MILESTONE_POSTER = accounts[1]
    const MILESTONE_BUYER1 = accounts[2]
    const MILESTONE_BUYER2 = accounts[3]
    const MILESTONE_BUYER_INIT_TOKEN = 1000000
    const PUT_OPTION_FEE_RATE = 5
    const PUT_OPTION_RATE_GT_ONE = true

    beforeEach(async function () {
      milestoneToken = context.mockToken2
      await milestoneToken.transfer(MILESTONE_BUYER1, MILESTONE_BUYER_INIT_TOKEN);
      await milestoneToken.transfer(MILESTONE_BUYER2, MILESTONE_BUYER_INIT_TOKEN);

      await vtx.transfer(MILESTONE_BUYER1, MILESTONE_BUYER_INIT_TOKEN);
      await vtx.transfer(MILESTONE_BUYER2, MILESTONE_BUYER_INIT_TOKEN);
    })

    it('postMilestone', async function () {
      let endTimeExpect = TimeSetter.latestTime() + MILESTONE_ENDTIME_DURATION

      await forum.postMilestone(
        posts[0],
        milestoneToken.address,
        MILESTONE_PRICE,
        endTimeExpect,
        {from: MILESTONE_POSTER, value: MILESTONE_ETH}).should.be.fulfilled
      let tokenAddress = await forum.milestoneTokenAddrs.call(posts[0])
      tokenAddress.should.equal(milestoneToken.address)
      let tokenNum = await forum.milestoneAvailableToken.call(posts[0])
      tokenNum.should.be.bignumber.equal(new BigNumber(MILESTONE_PRICE * MILESTONE_ETH))
      let ethNum = await forum.milestoneWithdrawEth.call(posts[0])
      ethNum.should.be.bignumber.equal(new BigNumber(MILESTONE_ETH))
      let price = await forum.milestonePrices.call(posts[0])
      price.should.be.bignumber.equal(new BigNumber(MILESTONE_PRICE))
      let endTime = await forum.milestoneEndTime.call(posts[0])
      endTime.should.be.bignumber.equal(new BigNumber(endTimeExpect))
    })

    it('purchasePutOption: ', async function () {
      let endTimeExpect = TimeSetter.latestTime() + MILESTONE_ENDTIME_DURATION

      await forum.postMilestone(
        posts[1],
        milestoneToken.address,
        MILESTONE_PRICE,
        endTimeExpect,
        {from: MILESTONE_POSTER, value: MILESTONE_ETH}).should.be.fulfilled

      let numToken = MILESTONE_REFUND_ETH * MILESTONE_PRICE
      // revert because not set put option fee
      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.rejectedWith(EVMRevert)

      // set put option fee
      await forum.setPutOptionFee(posts[1], PUT_OPTION_FEE_RATE, PUT_OPTION_RATE_GT_ONE).should.be.fulfilled

      // revert because not approve
      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.rejectedWith(EVMRevert)

      // approve forum contract transfer token from milestoneBuyer1
      await vtx.approve(forum.address, numToken * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      // collect info for test
      const preVtxBalBuyer1 = await vtx.balanceOf(MILESTONE_BUYER1)
      const preAvailableToken = await forum.milestoneAvailableToken.call(posts[1])
      const preNumToken = await forum.putOptionNumTokenForInvestor.call(posts[1], MILESTONE_BUYER1)

      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.fulfilled

      const postVtxBalBuyer1 = await vtx.balanceOf(MILESTONE_BUYER1)
      const postAvailableToken = await forum.milestoneAvailableToken.call(posts[1])
      const postNumToken = await forum.putOptionNumTokenForInvestor.call(posts[1], MILESTONE_BUYER1)

      preVtxBalBuyer1.minus(postVtxBalBuyer1)
        .should.be.bignumber.equal(new BigNumber(numToken * PUT_OPTION_FEE_RATE))
      preAvailableToken.minus(postAvailableToken).should.be.bignumber.equal(new BigNumber(numToken))
      postNumToken.minus(preNumToken).should.be.bignumber.equal(new BigNumber(numToken))

      await vtx.approve(forum.address, (postAvailableToken + 1) * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      // revert because no enough available token
      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        postAvailableToken + 1).should.be.rejectedWith(EVMRevert)

      // revert because already pass the endTime
      TimeSetter.increaseTimeTo(endTimeExpect + 1)
      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.rejectedWith(EVMRevert)
    })

    it('executePutOption: ', async function () {
      let endTimeExpect = TimeSetter.latestTime() + MILESTONE_ENDTIME_DURATION

      await forum.postMilestone(
        posts[1],
        milestoneToken.address,
        MILESTONE_PRICE,
        endTimeExpect,
        {from: MILESTONE_POSTER, value: MILESTONE_ETH}).should.be.fulfilled

      let numToken = MILESTONE_REFUND_ETH * MILESTONE_PRICE

      // set put option fee
      await forum.setPutOptionFee(posts[1], PUT_OPTION_FEE_RATE, PUT_OPTION_RATE_GT_ONE).should.be.fulfilled

      // approve forum contract transfer token from milestoneBuyer1
      await vtx.approve(forum.address, numToken * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.fulfilled

      // approve forum contract transfer token from milestoneBuyer2
      await vtx.approve(forum.address, numToken * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER2})
        .should.be.fulfilled

      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER2,
        numToken).should.be.fulfilled

      // approve forum contract transfer milestone token from milestoneBuyer1
      await milestoneToken.approve(forum.address, numToken, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      const preTokenNumBuyer1 = await milestoneToken.balanceOf(MILESTONE_BUYER1)
      const preMilestoneWithdrawEth = await forum.milestoneWithdrawEth.call(posts[1])
      const preEthBalForum = await web3.eth.getBalance(forum.address)

      await forum.executePutOption(
        posts[1],
        numToken,
        {from: MILESTONE_BUYER1}).should.be.fulfilled

      const postTokenNumBuyer1 = await milestoneToken.balanceOf(MILESTONE_BUYER1)
      const postMilestoneWithdrawEth = await forum.milestoneWithdrawEth.call(posts[1])
      const postEthBalForum = await web3.eth.getBalance(forum.address)
      const putOptionNumToken = await forum.putOptionNumTokenForInvestor.call(posts[1], MILESTONE_BUYER1)

      preTokenNumBuyer1.minus(postTokenNumBuyer1).should.be.bignumber.equal(new BigNumber(numToken))
      putOptionNumToken.should.be.bignumber.equal(new BigNumber(0))
      preMilestoneWithdrawEth.minus(postMilestoneWithdrawEth)
        .should.be.bignumber.equal(new BigNumber(MILESTONE_REFUND_ETH))
      preEthBalForum.minus(postEthBalForum).should.be.bignumber.equal(new BigNumber(MILESTONE_REFUND_ETH))

      // fast forward to pass the endTime
      TimeSetter.increaseTimeTo(endTimeExpect + 1)

      await forum.executePutOption(
        posts[1],
        numToken,
        {from: MILESTONE_BUYER1}).should.be.rejectedWith(EVMRevert)
    })

    it('milestone withdraw: ', async function () {
      let endTimeExpect = TimeSetter.latestTime() + MILESTONE_ENDTIME_DURATION

      await forum.postMilestone(
        posts[1],
        milestoneToken.address,
        MILESTONE_PRICE,
        endTimeExpect,
        {from: MILESTONE_POSTER, value: MILESTONE_ETH}).should.be.fulfilled

      let numToken = MILESTONE_REFUND_ETH * MILESTONE_PRICE

      // set put option fee
      await forum.setPutOptionFee(posts[1], PUT_OPTION_FEE_RATE, PUT_OPTION_RATE_GT_ONE).should.be.fulfilled

      // approve forum contract transfer token from milestoneBuyer1
      await vtx.approve(forum.address, numToken * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER1,
        numToken).should.be.fulfilled

      // approve forum contract transfer token from milestoneBuyer2
      await vtx.approve(forum.address, numToken * PUT_OPTION_FEE_RATE, {from: MILESTONE_BUYER2})
        .should.be.fulfilled

      await forum.purchasePutOption(
        posts[1],
        MILESTONE_BUYER2,
        numToken).should.be.fulfilled

      // approve forum contract transfer milestone token from milestoneBuyer1
      await milestoneToken.approve(forum.address, numToken, {from: MILESTONE_BUYER1})
        .should.be.fulfilled

      await forum.executePutOption(
        posts[1],
        numToken,
        {from: MILESTONE_BUYER1}).should.be.fulfilled

      // Test milestoneWithdraw
      // revert because not expired
      await forum.milestoneWithdraw(posts[1], {from: MILESTONE_POSTER})
        .should.be.rejectedWith(EVMRevert)

      // fast forward to pass the endTime
      TimeSetter.increaseTimeTo(endTimeExpect + 1)

      // revert because not milestone poster
      await forum.milestoneWithdraw(posts[1]).should.be.rejectedWith(EVMRevert)

      const preEthBalForum = await web3.eth.getBalance(forum.address)
      const ethNum = await forum.milestoneWithdrawEth.call(posts[1])
      ethNum.should.be.bignumber.equal(new BigNumber(MILESTONE_ETH - MILESTONE_REFUND_ETH))

      await forum.milestoneWithdraw(posts[1], {from: MILESTONE_POSTER})
        .should.be.fulfilled

      const postEth = await forum.milestoneWithdrawEth.call(posts[1])
      const postEthBalForum = await web3.eth.getBalance(forum.address)

      postEth.should.be.bignumber.equal(new BigNumber(0))
      preEthBalForum.minus(postEthBalForum).should.be.bignumber.equal(ethNum)
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
        POST,
        {from: user1}).should.be.fulfilled
      let content = await forum.getContentByHash.call(posts[0])
      content.should.equal(ipfsMultihash[0].digest)
    })

    it('Post a new airdrop topic', async function () {
      await forum.postAirdrop(
        posts[1],
        airdropMock.address,
        airdropMockValidate,
        airdropMockAirdrop,
        {from: user1}).should.be.fulfilled

      const callAddress = await forum.getCallAddressByHash(posts[1])
      callAddress.should.be.equal(airdropMock.address)

      const callValidateSig = await forum.getCallValidateSigByHash.call(posts[1])
      callValidateSig.should.equal(airdropMockValidate)

      const callAirdropSig = await forum.getCallAirdropSigByHash.call(posts[1])
      callAirdropSig.should.equal(airdropMockAirdrop)
    })

    it('Validate and Airdrop a airdrop post topic', async function () {
      await forum.postAirdrop(
        posts[2],
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
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled
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

  describe('Batch read: ', function () {
    let repliesLen

    beforeEach(async function () {
      await forum.addBoard(boards[0], token.address).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[1], ipfsMultihash[1].digest, POST, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], web3.toHex(0), posts[2], ipfsMultihash[2].digest, POST, {from: user1}).should.be.fulfilled

      // replies
      await forum.post(boards[0], posts[0], replies[0], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled

      await forum.post(boards[0], posts[1], replies[1], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[1], replies[2], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled

      await forum.post(boards[0], posts[2], replies[3], ipfsMultihash[0].digest, POST, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[2], replies[4], ipfsMultihash[1].digest, POST, {from: user1}).should.be.fulfilled
      await forum.post(boards[0], posts[2], replies[5], ipfsMultihash[2].digest, POST, {from: user1}).should.be.fulfilled

      repliesLen = [1, 2, 3]
    })

    it('getBatchPosts', async function () {
      let _posts = await forum.getBatchPosts.call(posts).should.be.fulfilled
      let len = 7
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
        _posts[k + 6].should.startWith(POST)
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
