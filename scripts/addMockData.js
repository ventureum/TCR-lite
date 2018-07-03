var BigNumber = require('bignumber.js')

const Forum = artifacts.require('Forum')
const Token = artifacts.require('VetXToken')

web3.eth.getAccountsPromise = function () {
  return new Promise(function (resolve, reject) {
    web3.eth.getAccounts(function (e, accounts) {
      if (e != null) {
        reject(e)
      } else {
        resolve(accounts)
      }
    })
  })
}

const tokens = [
  'VTX',
  'ABC',
  'XYZ'
]

const boards = []

const bs58 = require('bs58')

const posts = {}

const replies = {}

const ipfsPaths = [
  'QmfSYqbPt27MfWyzwJL3iBKzKvKfTLvn1W3xKR336edxiE',
  'QmfSYqbPt27MfWyzwJL3iBKzKvKfTLvn1W3xKR336edxiE',
  'QmfSYqbPt27MfWyzwJL3iBKzKvKfTLvn1W3xKR336edxiE']

const ipfsMultihash = []

/**
 * Partition multihash string into object representing multihash
 *
 * @param {string} multihash A base58 encoded multihash string
 * @returns {Multihash}
 */
function getBytes32FromMultiash (multihash) {
  const decoded = bs58.decode(multihash)

  return {
    digest: `0x${decoded.slice(2).toString('hex')}`,
    hashFunction: decoded[0],
    size: decoded[1]
  }
}

for (let i = 0; i < ipfsPaths.length; i++) {
  ipfsMultihash.push(getBytes32FromMultiash(ipfsPaths[i]))
}

// Set number of posts and replies here
const NUM_POST_HASH = 20
const NUM_REPLY_HASH = 5

// convert token symbols to hash
for (let i = 0; i < tokens.length; i++) {
  boards.push(web3.sha3(tokens[i]))
}

// generate deterministic post hashes
for (let j = 0; j < tokens.length; j++) {
  posts[tokens[j]] = []
  for (let i = 0; i < NUM_POST_HASH; i++) {
    posts[tokens[j]].push(web3.sha3(tokens[j] + i))
  }
}

// generate deterministic replies hashes
for (let j = 0; j < tokens.length; j++) {
  for (let i = 0; i < NUM_POST_HASH; i++) {
    replies[posts[tokens[j]][i]] = []
    for (let k = 0; k < NUM_REPLY_HASH; k++) {
      replies[posts[tokens[j]][i]].push(web3.sha3(posts[tokens[j]][i] + k))
    }
  }
}

module.exports = async function (callback) {
  var accounts = await web3.eth.getAccountsPromise()
  var forum = await Forum.deployed()

  console.log('================= Deploy Tokens =================')
  for (let i = 0; i < tokens.length; i++) {
    let erc20 = await Token.new(new BigNumber(1e27).toString(), tokens[i] + ' Token', 18, tokens[i])
    await forum.addBoard(boards[i], erc20.address)
    console.log('Token ' + tokens[i] + ' @ ' + erc20.address + ' for board ' + boards[i])
    await erc20.approve(forum.address, new BigNumber(1e27).toString(), {from: accounts[0]})
  }
  console.log('=================================================')

  console.log('================= Add Posts =================')
  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      await forum.post(boards[j], web3.toHex(0), posts[tokens[j]][i], ipfsMultihash[0].digest)
      console.log('Add post ' + posts[tokens[j]][i] + ' to board ' + boards[j])
    }
  }
  console.log('=================================================')

  console.log('================= Add Comments =================')
  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      for (let k = 0; k < NUM_REPLY_HASH; k++) {
        await forum.post(boards[j], posts[tokens[j]][i], replies[posts[tokens[j]][i]][k], ipfsMultihash[0].digest)
        console.log('Add reply ' + replies[posts[tokens[j]][i]][k] + ' to post ' + posts[tokens[j]][i])
      }
    }
  }
  console.log('=================================================')

  console.log('================= Upvotes =================')

  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      let base = new BigNumber(1e18)
      let val = (i + 1) * (j + 1)
      let valBig = base.times(new BigNumber(val))
      await forum.upvote(accounts[0], posts[tokens[j]][i], valBig.toString(), { from: accounts[0] })
      console.log('Upvote ' + posts[tokens[j]][i] + ' with ' + val + ' ' + tokens[j])
    }
  }
}
