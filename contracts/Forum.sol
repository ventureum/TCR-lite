pragma solidity^0.4.24;

import "./library/DLLBytes32.sol";
import "./mocks/AirdropMock.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Forum is Ownable {
    using SafeMath for uint;
    using DLLBytes32 for DLLBytes32.Data;

    event AddBoard(bytes32 indexed boardId, address token);
    event SetBoardToken(bytes32 indexed boardId, address token);

    /*
      @param typeHash bytes4(keccak256([TYPE]))
      Type = [ POST | COMMENT | AUDIT | AIRDROP ]
     */
    event Post (
        address indexed poster,
        bytes32 indexed boardId,
        bytes32 parentHash,
        bytes32 indexed postHash,
        bytes32 ipfsPath,
        bytes4 typeHash,
        uint timestamp
    );

    event PostAirdrop (
        address indexed poster,
        bytes32 indexed postHash,
        address airdropContractAddress,
        bytes4 callValidateSig,
        bytes4 callAirdropSig,
        uint timestamp
    );

    event UpdatePost (
        address indexed poster,
        bytes32 indexed postHash,
        bytes32 ipfsPath,
        uint timestamp
    );

    event Upvote(
        address indexed upvoter,
        bytes32 indexed boardId,
        bytes32 indexed postHash,
        uint value,
        uint timestamp
    );

    event Withdraw(address indexed poster, bytes32 indexed postHash, uint rewards, uint timestamp);

    struct Board {
        bool exist;
        address token;
        DLLBytes32.Data posts;
        mapping(bytes32 => DLLBytes32.Data) replies;
    }

    address constant NULL = address(0x0);

    uint public feesPercentage = 5;
    uint constant BATCH_SIZE = 10;

    mapping(bytes32 => Board) boards;
    mapping(bytes32 => bytes32) public contents;
    mapping(bytes32 => bytes32) public parent;
    mapping(bytes32 => address) public author;
    mapping(bytes32 => uint) public rewards;
    mapping(bytes32 => bytes32) public fromBoard;
    mapping(bytes32 => uint) public replyLen;
    mapping(bytes32 => bytes4) public _type;

    mapping(bytes32 => address) public callAddresses; 
    // store the validate function sigs
    mapping(bytes32 => bytes4) public callValidateSigs;
    // store the airdrop function sigs
    mapping(bytes32 => bytes4) public callAirdropSigs;

    /*
      Retrieve a batch of posts/replies by hashes

      @param hashes hash array of posts/replies to be retrieved
      @returns a flatten array of posts/replies
     */
    function getBatchPosts(bytes32[] hashes)
        external
        view
        returns (bytes32[]) {

        bytes32 _curr;
        bytes32[] memory posts = new bytes32[](BATCH_SIZE * 7);
        for(uint i = 0; i < hashes.length; i++) {
            _curr = hashes[i];
            uint j = i * 7;
            posts[j] = _curr; // hash
            posts[j+1] = bytes32(boards[fromBoard[_curr]].token); // associated token address
            posts[j+2] = contents[_curr]; // IPFS hash
            posts[j+3] = bytes32(author[_curr]);  // author
            posts[j+4] = bytes32(rewards[_curr]);  // rewards
            posts[j+5] = bytes32(replyLen[_curr]); // number of replies
            posts[j+6] = bytes32(_type[_curr]); // type of the post
        }
        return posts;
    }

    /*
     *Check if the sender(msg.sender) can receive airdrop(free token)
     *
     *@param hashes hash array of posts/replies to be retrieved
     *@returns bool show if sender can receive airdrop
     */
    function airdropValidate(bytes32 postHash) external view returns(bool) {
        address airdropContractAddress = callAddresses[postHash];
        bytes4 callValidateSig = callValidateSigs[postHash];
        require (airdropContractAddress != NULL);
        require (callValidateSig != bytes4(0x0));

        return airdropContractAddress.call(callValidateSig, msg.sender);
    }

    /*
     * Call airdrop function that poster provide. 
     * More behavior depends on the airdrop function that poster provider 
     *  (usually the airdrop function will check sender's permission for airdrop)
     *
     * @param hashes hash array of posts/replies to be retrieved
     */
    function airdropCall(bytes32 postHash) external {
        address airdropContractAddress = callAddresses[postHash];
        bytes4 callAirdropSig = callAirdropSigs[postHash];
        require (airdropContractAddress != NULL);
        require (callAirdropSig != bytes4(0x0));

        require (airdropContractAddress.call(callAirdropSig, msg.sender));
    }

    /**
    *  Add the board to contract with token
    * 
    *  @param boardId hash value of a board id
    *  @param token the token address
    */
    function addBoard(bytes32 boardId, address token) external onlyOwner {
        require(!boardExist(boardId));
        boards[boardId].exist = true;
        boards[boardId].token = token;

        emit AddBoard(boardId, token);
    }

    /**
    *  change the token of given board
    * 
    *  @param boardId hash value of a board id
    *  @param token the token address
    */
    function setBoardToken(bytes32 boardId, address token) external onlyOwner {
        require(boardExist(boardId));
        boards[boardId].token = token;

        emit SetBoardToken(boardId, token);
    }

    /*
    *  Assicoate an airdrop event with a post
    *  A post with airdrop means user can receive free token by poster's policy
    *  An user can call:
    *    airdropContractAddress.callValidateSig to check if the user has permission
    *    airdropContractAddress.callAirdropSig to trigger airdrop in order to receive free token
    *       (depend on poster's airdrop policy)
    *
    *  @param postHash hash value of a post
    *  @param airdropContractAddress airdrop contract address
    *  @param callValidateSig calldata for validate function at airdrop contract
    *  @param callAirdropSig calldata at airdrop contract
    */
    function postAirdrop(
        bytes32 postHash,
        address airdropContractAddress,
        bytes4 callValidateSig,
        bytes4 callAirdropSig
        )
        external {
        require(airdropContractAddress != NULL);

        callAddresses[postHash] = airdropContractAddress;
        callValidateSigs[postHash] = callValidateSig;
        callAirdropSigs[postHash] = callAirdropSig;

        emit PostAirdrop(
            msg.sender, 
            postHash, 
            airdropContractAddress, 
            callValidateSig, 
            callAirdropSig, 
            now);
    }

    /*
    *  Submit an post event to a board
    *
    *  @param boardId hash value of a board id
    *  @param parentHash hash for parent post
    *  @param postHash hash value of a post
    *  @param ipfsPath hash value of ipfs file
    */
    function post(
        bytes32 boardId,
        bytes32 parentHash,
        bytes32 postHash,
        bytes32 ipfsPath,
        bytes4 typeHash
        )
        external {
        require(!recordExist(postHash));

        contents[postHash] = ipfsPath;
        parent[postHash] = parentHash;
        author[postHash] = msg.sender;
        fromBoard[postHash] = boardId;
        _type[postHash] = typeHash;

        if (parentHash != bytes32(0x0)) {
            // reply
            DLLBytes32.Data storage replies = boards[boardId].replies[parentHash];
            replies.insert(replies.getPrev(bytes32(0x0)), postHash, bytes32(0x0));

            // update reply length
            replyLen[parentHash] = replyLen[parentHash].add(1);
        } else {
            // post
            DLLBytes32.Data storage posts = boards[boardId].posts;
            posts.insert(posts.getPrev(bytes32(0x0)), postHash, bytes32(0x0));
        }

        emit Post(msg.sender, boardId, parentHash, postHash, ipfsPath, typeHash, now);
    }

    /*
    *  update ipfsPath for the given post
    *
    *  @param postHash hash value of a post
    *  @param ipfsPath hash value of ipfs file
    */
    function updatePost(
        bytes32 postHash,
        bytes32 ipfsPath
        )
        external {
        require(author[postHash] == msg.sender);
        contents[postHash] = ipfsPath;

        emit UpdatePost(msg.sender, postHash, ipfsPath, now);
    }

    /*
    *  upvote a post
    *
    *  @param upvoter  the address of the upvoter
    *  @param postHash hash value of a post
    *  @param value the number of upvote
    */
    function upvote(address upvoter, bytes32 postHash, uint value) external {
        require(recordExist(postHash));

        bytes32 boardId = fromBoard[postHash];
        require(ERC20(boards[boardId].token).transferFrom(upvoter, address(this), value));

        uint fees = (value.mul(5)).div(100);

        require(ERC20(boards[boardId].token).transfer(owner, fees));

        rewards[postHash] = rewards[postHash].add(value.sub(fees));

        emit Upvote(upvoter, boardId, postHash, value, now);
    }

    /*
    *  the poster withdraw the reward
    *
    *  @param postHash hash value of a post
    */
    function withdraw(bytes32 postHash) external {
        require(author[postHash] == msg.sender);

        uint _rewards = rewards[postHash];
        rewards[postHash] = 0;

        bytes32 boardId = fromBoard[postHash];

        require(ERC20(boards[boardId].token).transfer(msg.sender, _rewards));
        emit Withdraw(msg.sender, postHash, _rewards, now);
    }

    // Utils functions

    function getBoardToken(bytes32 boardId) external view returns (address) {
        return boards[boardId].token;
    }

    function getCallAddressByHash (bytes32 hash) public view returns (address) {
        return callAddresses[hash];
    }

    function getCallValidateSigByHash (bytes32 hash) public view returns (bytes4) {
        return callValidateSigs[hash];
    }

    function getCallAirdropSigByHash (bytes32 hash) public view returns (bytes4) {
        return callAirdropSigs[hash];
    }

    function getContentByHash(bytes32 hash) public view returns (bytes32) {
        return contents[hash];
    }

    function getNextPostByHash(bytes32 boardId, bytes32 curr) public view returns (bytes32) {
        return boards[boardId].posts.getNext(curr);
    }

    function getNextReplyByHash(bytes32 boardId, bytes32 postId, bytes32 curr) 
        public 
        view 
        returns (bytes32) 
    {
        return boards[boardId].replies[postId].getNext(curr);
    }

    /**
    *  check this board is exist or not
    * 
    *  @param boardId hash value of a board id
    *  @return boolean shows does this board eixst
    */
    function boardExist(bytes32 boardId) internal view returns (bool) {
        return boards[boardId].exist;
    }

    /**
    *  check this author is exist or not
    * 
    *  @param hash hash value of a post
    *  @return boolean shows does this post's author eixst
    */
    function recordExist(bytes32 hash) internal view returns (bool) {
        return author[hash] != address(0x0);
    }
}
