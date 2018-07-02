pragma solidity^0.4.24;

import "./DLLBytes32.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Forum is Ownable {
    using SafeMath for uint;
    using DLLBytes32 for DLLBytes32.Data;

    event AddBoard(bytes32 indexed boardId, address token);
    event SetBoardToken(bytes32 indexed boardId, address token);
    event Post(
               bytes32 indexed boardId,
               bytes32 parentHash,
               bytes32 postHash,
               bytes32 ipfsPath);

    event UpdatePost(
                     bytes32 postHash,
                     bytes32 ipfsPath);

    event Upvote(address upvoter, bytes32 indexed boardId, bytes32 postHash, uint value);
    event Withdraw(address poster, bytes32 postHash, uint rewards);

    struct Board {
        bool exist;
        address token;
        DLLBytes32.Data posts;
        mapping(bytes32 => DLLBytes32.Data) replies;
    }

    uint public feesPercentage = 5;
    uint constant BATCH_SIZE = 10;

    mapping(bytes32 => Board) boards;
    mapping(bytes32 => bytes32) public contents;
    mapping(bytes32 => bytes32) public parent;
    mapping(bytes32 => address) public author;
    mapping(bytes32 => uint) public rewards;
    mapping(bytes32 => bytes32) public fromBoard;

    function boardExist(bytes32 boardId) internal view returns (bool) {
        return boards[boardId].exist;
    }

    function recordExist(bytes32 hash) internal view returns (bool) {
        return author[hash] != address(0x0);
    }

    function addBoard(bytes32 boardId, address token) external onlyOwner {
        require(!boardExist(boardId));
        boards[boardId].exist = true;
        boards[boardId].token = token;

        emit AddBoard(boardId, token);
    }

    function setBoardToken(bytes32 boardId, address token) external onlyOwner {
        require(boardExist(boardId));
        boards[boardId].token = token;

        emit SetBoardToken(boardId, token);
    }

    function post(
        bytes32 boardId,
        bytes32 parentHash,
        bytes32 postHash,
        bytes32 ipfsPath
        )
        external {
        require(!recordExist(postHash));

        contents[postHash] = ipfsPath;
        parent[postHash] = parentHash;
        author[postHash] = msg.sender;
        fromBoard[postHash] = boardId;

        if (parentHash != bytes32(0x0)) {
            // reply
            DLLBytes32.Data storage replies = boards[boardId].replies[parentHash];
            replies.insert(replies.getPrev(bytes32(0x0)), postHash, bytes32(0x0));
        } else {
            // post
            DLLBytes32.Data storage posts = boards[boardId].posts;
            posts.insert(posts.getPrev(bytes32(0x0)), postHash, bytes32(0x0));
        }

        emit Post(boardId, parentHash, postHash, ipfsPath);
    }

    function updatePost(
        bytes32 postHash,
        bytes32 ipfsPath
        )
        external {
        require(author[postHash] == msg.sender);
        contents[postHash] = ipfsPath;

        emit UpdatePost(postHash, ipfsPath);
    }

    function upvote(address upvoter, bytes32 postHash, uint value) external {
        require(recordExist(postHash));

        bytes32 boardId = fromBoard[postHash];
        require(ERC20(boards[boardId].token).transferFrom(upvoter, address(this), value));

        uint fees = (value.mul(5)).div(100);

        require(ERC20(boards[boardId].token).transfer(owner, fees));

        rewards[postHash] = rewards[postHash].add(value.sub(fees));

        emit Upvote(upvoter, boardId, postHash, value);
    }

    function withdraw(bytes32 postHash) external {
        require(author[postHash] == msg.sender);

        uint _rewards = rewards[postHash];
        rewards[postHash] = 0;

        bytes32 boardId = fromBoard[postHash];

        require(ERC20(boards[boardId].token).transfer(msg.sender, _rewards));
        emit Withdraw(msg.sender, postHash, _rewards);
    }

    // Utils functions

    function getContentByHash(bytes32 hash) public view returns (bytes32) {
        return contents[hash];
    }

    function getNextPostByHash(bytes32 boardId, bytes32 curr) public view returns (bytes32) {
        return boards[boardId].posts.getNext(curr);
    }

    function getNextReplyByHash(bytes32 boardId, bytes32 postId, bytes32 curr) public view returns (bytes32) {
        return boards[boardId].replies[postId].getNext(curr);
    }

    function getBatchPostsByHashes(
        bytes32 boardId,
        bytes32 curr
        )
        external
        view
        returns (bytes32[]) {

        bytes32 _curr = curr;
        bytes32[] memory posts = new bytes32[](BATCH_SIZE * 5);
        for(uint i = 0; i < BATCH_SIZE * 5; i += 5) {
            _curr = getNextPostByHash(boardId, _curr);
            if (_curr == bytes32(0x0)) {
                break;
            }
            posts[i] = _curr;
            posts[i+1] = contents[_curr];
            posts[i+2] = bytes32(author[_curr]);
            posts[i+3] = bytes32(rewards[_curr]);
            posts[i+4] = bytes32(getRepliesLength(boardId, _curr));
        }

        return posts;
    }

    function getBatchRepliesByHashes(
        bytes32 boardId,
        bytes32 postId,
        bytes32 curr
        )
        external
        view
        returns (bytes32[]) {

        bytes32 _curr = curr;
        bytes32[] memory replies = new bytes32[](BATCH_SIZE * 4);
        for(uint i = 0; i < 10; i += 4) {
            _curr = getNextReplyByHash(boardId, postId, _curr);
            if (_curr == bytes32(0x0)) {
                break;
            }
            replies[i] = _curr;
            replies[i+1] = contents[_curr];
            replies[i+2] = bytes32(author[_curr]);
            replies[i+3] = bytes32(rewards[_curr]);
        }

        return replies;
    }

    function getPostsLength(bytes32 boardId) public view returns (uint) {
        return boards[boardId].posts.length;
    }

    function getRepliesLength(bytes32 boardId, bytes32 postId) public view returns (uint) {
        return boards[boardId].replies[postId].length;
    }

    function getBoardToken(bytes32 boardId) external view returns (address) {
        return boards[boardId].token;
    }

}
