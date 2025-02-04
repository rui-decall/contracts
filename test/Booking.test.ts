import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Booking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Booking", function () {
  async function deployBookingFixture() {
    const [owner, buyer, seller] = await ethers.getSigners();
    
    const Booking = await ethers.getContractFactory("Booking");
    const booking = await upgrades.deployProxy(Booking, []) as Booking;
    await booking.waitForDeployment();

    const bookingId = "booking_" + Date.now().toString();
    const bookingAmount = ethers.parseEther("1.0");

    return { booking, owner, buyer, seller, bookingId, bookingAmount };
  }

  describe("Initialization", function () {
    it("Should set the correct owner", async function () {
      const { booking, owner } = await loadFixture(deployBookingFixture);
      expect(await booking.owner()).to.equal(owner.address);
    });

    it("Should set the default cancellation period", async function () {
      const { booking } = await loadFixture(deployBookingFixture);
      expect(await booking.cancellationPeriod()).to.equal(30 * 60); // 30 minutes in seconds
    });
  });

  describe("Booking Creation", function () {
    it("Should create a new booking and transfer ETH", async function () {
      const { booking, buyer, seller, bookingId, bookingAmount } = await loadFixture(deployBookingFixture);

      const contractBalanceBefore = await ethers.provider.getBalance(await booking.getAddress());

      await expect(booking.connect(buyer).book(seller.address, bookingAmount, bookingId, {
        value: bookingAmount
      }))
        .to.emit(booking, "Booked")
        .withArgs(buyer.address, seller.address, bookingAmount, bookingId);

      const contractBalanceAfter = await ethers.provider.getBalance(await booking.getAddress());
      expect(contractBalanceAfter - contractBalanceBefore).to.equal(bookingAmount);

      const bookingDetails = await booking.bookings(bookingId);
      expect(bookingDetails.buyer).to.equal(buyer.address);
      expect(bookingDetails.seller).to.equal(seller.address);
      expect(bookingDetails.amount).to.equal(bookingAmount);
      expect(bookingDetails.exists).to.be.true;
    });

    it("Should not allow booking with incorrect ETH amount", async function () {
      const { booking, buyer, seller, bookingId, bookingAmount } = await loadFixture(deployBookingFixture);
      
      await expect(
        booking.connect(buyer).book(seller.address, bookingAmount, bookingId, {
          value: bookingAmount - 1n
        })
      ).to.be.revertedWith("Sent ETH must match booking amount");
    });

    it("Should not allow booking with zero address seller", async function () {
      const { booking, buyer, bookingId, bookingAmount } = await loadFixture(deployBookingFixture);
      
      await expect(
        booking.connect(buyer).book(ethers.ZeroAddress, bookingAmount, bookingId, {
          value: bookingAmount
        })
      ).to.be.revertedWith("Invalid seller address");
    });

    it("Should not allow duplicate booking IDs", async function () {
      const { booking, buyer, seller, bookingId, bookingAmount } = await loadFixture(deployBookingFixture);
      
      await booking.connect(buyer).book(seller.address, bookingAmount, bookingId, {
        value: bookingAmount
      });
      
      await expect(
        booking.connect(buyer).book(seller.address, bookingAmount, bookingId)
      ).to.be.revertedWith("Booking ID already exists");
    });
  });

  describe("Cancellation Period", function () {
    it("Should allow owner to set cancellation period", async function () {
      const { booking, owner } = await loadFixture(deployBookingFixture);
      const newPeriod = 60 * 60; // 1 hour
      
      await booking.connect(owner).setCancellationPeriod(newPeriod);
      expect(await booking.cancellationPeriod()).to.equal(newPeriod);
    });

    it("Should not allow non-owner to set cancellation period", async function () {
      const { booking, buyer } = await loadFixture(deployBookingFixture);
      const newPeriod = 60 * 60;
      
      await expect(
        booking.connect(buyer).setCancellationPeriod(newPeriod)
      ).to.be.revertedWithCustomError(booking, "OwnableUnauthorizedAccount")
        .withArgs(buyer.address);
    });

    it("Should not allow setting cancellation period to zero", async function () {
      const { booking, owner } = await loadFixture(deployBookingFixture);
      
      await expect(
        booking.connect(owner).setCancellationPeriod(0)
      ).to.be.revertedWith("Cancellation period must be greater than 0");
    });
  });

  describe("Booking Cancellation", function () {
    async function deployAndCreateBookingFixture() {
      const baseFixture = await deployBookingFixture();
      const { booking, buyer, seller, bookingId, bookingAmount } = baseFixture;
      
      await booking.connect(buyer).book(seller.address, bookingAmount, bookingId, {
        value: bookingAmount
      });
      
      return { ...baseFixture };
    }

    it("Should allow buyer to cancel within cancellation period and return ETH", async function () {
      const { booking, buyer, seller, bookingId, bookingAmount } = await loadFixture(deployAndCreateBookingFixture);

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await booking.connect(buyer).cancelBooking(bookingId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      
      // Account for gas costs in the balance check
      expect(buyerBalanceAfter + gasUsed - buyerBalanceBefore).to.equal(bookingAmount);

      const bookingDetails = await booking.bookings(bookingId);
      expect(bookingDetails.exists).to.be.false;
    });

    it("Should not allow cancellation after cancellation period", async function () {
      const { booking, buyer, bookingId } = await loadFixture(deployAndCreateBookingFixture);

      // Fast forward time by 31 minutes
      await time.increase(31 * 60);

      await expect(
        booking.connect(buyer).cancelBooking(bookingId)
      ).to.be.revertedWith("Cancellation period has expired");
    });

    it("Should not allow seller to cancel", async function () {
      const { booking, seller, bookingId } = await loadFixture(deployAndCreateBookingFixture);

      await expect(
        booking.connect(seller).cancelBooking(bookingId)
      ).to.be.revertedWith("Only buyer can cancel");
    });

    it("Should not allow cancelling non-existent booking", async function () {
      const { booking, buyer } = await loadFixture(deployBookingFixture);

      await expect(
        booking.connect(buyer).cancelBooking("non_existent_booking")
      ).to.be.revertedWith("Booking does not exist");
    });
  });
}); 