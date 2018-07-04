import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert'
import bs58 from 'bs58'

const BigNumber = web3.BigNumber

// eslint-disable-next-line
const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Forum = artifacts.require('Forum')
const Token = artifacts.require('VetXToken')

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


contract('Basic Tests: ', function ([root, user1, user2, user3, _]) {
  beforeEach(async function () {
    this.token = await Token.new('10000', 'VetX', 18, 'VTX')
    this.forum = await Forum.new()
    this.proxy = await Proxy.new()

    this.feesPercentage = await this.forum.feesPercentage.call()
    await this.token.transfer(user1, 1000, {from: root})
    await this.token.transfer(user2, 500, {from: root})
    await this.token.transfer(user3, 500, {from: root})

    let ForumWeb3 = web3.eth.contract(this.forum.abi)
    let forumWeb3Instance = ForumWeb3.at(this.forum.address)

    let TokenWeb3 = web3.eth.contract(this.token.abi)
    let tokenWeb3Instance = TokenWeb3.at(this.token.address)

    this.approveUser2 = tokenWeb3Instance.approve.getData(this.forum.address, 100)
    this.upvoteUser2 = forumWeb3Instance.upvote.getData(user2, posts[0], 100)
  })
  
  describe('Add a board: ', function () {
    it('by owner', async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
    })

    it('by non-owner', async function () {
      await this.forum.addBoard(boards[0], this.token.address, {from: user1}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Set board tokens: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
    })

    it('by owner', async function () {
      await this.forum.setBoardToken(boards[0], this.token.address).should.be.fulfilled
    })

    it('by non-owner', async function () {
      await this.forum.setBoardToken(boards[0], this.token.address, {from: user1}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Post: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
    })

    it('Post a new topic', async function () {
      await this.forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      let content = await this.forum.getContentByHash.call(posts[0])
      content.should.equal(ipfsMultihash[0].digest)
    })
  })

  describe('Update post: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
    })

    it('Update post by poster', async function () {
      await this.forum.updatePost(posts[0], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      let content = await this.forum.getContentByHash.call(posts[0])
      content.should.equal(ipfsMultihash[1].digest)
    })

    it('Update post by non original poster', async function () {
      await this.forum.updatePost(posts[0], ipfsMultihash[2].digest, {from: user2}).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Upvote post: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
    })

    it('Simple upvote', async function () {
      await this.proxy.concat(this.approveUser2, this.upvoteUser2, {from: user2})
      
      await this.token.approve(this.forum.address, 100, {from: user2}).should.be.fulfilled
      await this.forum.upvote(user2, posts[0], 100, {from: user2}).should.be.fulfilled

      let rewards = await this.forum.rewards.call(posts[0])
      rewards.should.be.bignumber.equal(new BigNumber(100).sub(calculateFees(this.feesPercentage,
        new BigNumber(100))))
    })
  })

  describe('Withdraw rewards: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await this.token.approve(this.forum.address, 100, {from: user2}).should.be.fulfilled
      await this.forum.upvote(user2, posts[0], 100, {from: user2}).should.be.fulfilled
    })

    it('Simple withdraw', async function () {
      let rewards = await this.forum.rewards.call(posts[0])
      let preBal = await this.token.balanceOf.call(user1).should.be.fulfilled
      await this.forum.withdraw(posts[0], {from: user1}).should.be.fulfilled
      let bal = await this.token.balanceOf.call(user1).should.be.fulfilled
      bal.sub(preBal).should.be.bignumber.equal(rewards)
    })
  })

  describe('Batch read: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[1], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      await this.forum.post(boards[0], web3.toHex(0), posts[2], ipfsMultihash[2].digest, {from: user1}).should.be.fulfilled

      // replies
      await this.forum.post(boards[0], posts[0], replies[0], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled

      await this.forum.post(boards[0], posts[1], replies[1], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await this.forum.post(boards[0], posts[1], replies[2], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled

      await this.forum.post(boards[0], posts[2], replies[3], ipfsMultihash[0].digest, {from: user1}).should.be.fulfilled
      await this.forum.post(boards[0], posts[2], replies[4], ipfsMultihash[1].digest, {from: user1}).should.be.fulfilled
      await this.forum.post(boards[0], posts[2], replies[5], ipfsMultihash[2].digest, {from: user1}).should.be.fulfilled

      this.repliesLen = [1, 2, 3]
    })

    it('getBatchPosts', async function () {
      let _posts = await this.forum.getBatchPosts.call(posts).should.be.fulfilled
      let len = 6
      for (let i = 0; i < 3; i++) {
        let k = i * len
        let tokenAddr = this.token.address.substr(2)
        let userAddr = user1.substr(2)
        tokenAddr = '0x' + tokenAddr.padStart(64, '0')
        userAddr = '0x' + userAddr.padStart(64, '0')
        _posts[k].should.equal(posts[i])
        _posts[k + 1].should.equal(tokenAddr)
        _posts[k + 2].should.equal(ipfsMultihash[i].digest)
        _posts[k + 3].should.equal(userAddr)
        web3.toBigNumber(_posts[k + 4]).should.be.bignumber.equal(new BigNumber(0))
        web3.toBigNumber(_posts[k + 5]).should.be.bignumber.equal(new BigNumber(this.repliesLen[i]))
      }
    })
  })

  describe('Get board token: ', function () {
    beforeEach(async function () {
      await this.forum.addBoard(boards[0], this.token.address).should.be.fulfilled
    })

    it('getBoardToken', async function () {
      let token = await this.forum.getBoardToken.call(boards[0])
      token.should.equal(this.token.address)
    })
  })
})
