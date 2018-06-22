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
 * Encode a multihash structure into base58 encoded multihash string
 *
 * @param {Multihash} multihash
 * @returns {(string|null)} base58 encoded multihash string
 */
export function getMultihashFromBytes32(multihash) {
  const { digest, hashFunction, size } = multihash;
  if (size === 0) return null;

  // cut off leading "0x"
  const hashBytes = Buffer.from(digest.slice(2), 'hex');

  // prepend hashFunction and digest size
  const multihashBytes = new (hashBytes.constructor)(2 + hashBytes.length);
  multihashBytes[0] = hashFunction;
  multihashBytes[1] = size;
  multihashBytes.set(hashBytes, 2);

  return bs58.encode(multihashBytes);
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
    this.feesPercentage = await this.forum.feesPercentage.call()
    await this.token.transfer(user1, 1000, {from: root})
    await this.token.transfer(user2, 500, {from: root})
    await this.token.transfer(user3, 500, {from: root})
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
      let content = await this.forum.getContentByPost.call(posts[0])
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
      let content = await this.forum.getContentByPost.call(posts[0])
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
    })

    it('getBatchPostsByHashes', async function () {
      let _posts = await this.forum.getBatchPostsByHashes.call(boards[0], web3.toHex(0)).should.be.fulfilled
      for (let i = 0; i < posts.length; i++) {
        _posts[i].should.equal(posts[i])
      }
    })

    it('getBatchContentsByPosts', async function () {
      let _posts = await this.forum.getBatchPostsByHashes.call(boards[0], web3.toHex(0)).should.be.fulfilled
      let contents = await this.forum.getBatchContentsByPosts.call(_posts).should.be.fulfilled
      for (let i = 0; i < ipfsMultihash.length; i++) {
        contents[i].should.equal(ipfsMultihash[i].digest)
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
