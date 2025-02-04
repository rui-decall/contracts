// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Booking is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    uint256 public cancellationPeriod;
    
    struct BookingDetails {
        address buyer;
        address seller;
        uint256 amount;
        uint256 bookingTime;
        bool exists;
    }
    
    mapping(string => BookingDetails) public bookings;
    
    event Booked(address indexed buyer, address indexed seller, uint256 amount, string bookingId);
    event Cancelled(address indexed buyer, address indexed seller, uint256 amount, string bookingId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        cancellationPeriod = 30 minutes;
    }

    function book(address seller, uint256 amount, string memory bookingId) public payable nonReentrant {
        require(!bookings[bookingId].exists, "Booking ID already exists");
        require(msg.value == amount, "Sent ETH must match booking amount");
        require(seller != address(0), "Invalid seller address");
        
        bookings[bookingId] = BookingDetails({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            bookingTime: block.timestamp,
            exists: true
        });
        
        emit Booked(msg.sender, seller, amount, bookingId);
    }

    function setCancellationPeriod(uint256 newPeriod) public onlyOwner {
        require(newPeriod > 0, "Cancellation period must be greater than 0");
        cancellationPeriod = newPeriod;
    }

    function cancelBooking(string memory bookingId) public nonReentrant {
        BookingDetails storage booking = bookings[bookingId];
        
        require(booking.exists, "Booking does not exist");
        require(msg.sender == booking.buyer, "Only buyer can cancel");
        require(
            block.timestamp <= booking.bookingTime + cancellationPeriod,
            "Cancellation period has expired"
        );
        
        uint256 amount = booking.amount;
        address seller = booking.seller;
        
        // Transfer the ETH back from seller to buyer
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
        
        delete bookings[bookingId];
        
        emit Cancelled(msg.sender, seller, amount, bookingId);
    }
}
