import { ethers, upgrades, network } from "hardhat";
import { verify } from "./verify";

async function main() {
  // Get the proxy address for the current network
  const PROXY_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS;
  if (!PROXY_ADDRESS) {
    throw new Error(`No proxy address found for network: ${network.name}`);
  }
  
  console.log("Upgrading Booking contract...");
  console.log("Proxy address:", PROXY_ADDRESS);

  // Get the contract factory for the new implementation
  const BookingV2 = await ethers.getContractFactory("Booking");

  // Upgrade the proxy to the new implementation
  const booking = await upgrades.upgradeProxy(PROXY_ADDRESS, BookingV2);
  await booking.waitForDeployment();

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation address:", implementationAddress);

  // Verify the new implementation contract
//   try {
//     console.log("Verifying new implementation...");
//     await verify(implementationAddress, []);
//     console.log("Contract verified successfully");
//   } catch (error) {
//     console.log("Verification failed:", error);
//   }

  // Log upgrade details
  console.log("\nUpgrade details:");
  console.log("--------------------");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("New implementation address:", implementationAddress);
  console.log("Network:", network.name);
  console.log("--------------------");

  // Optionally verify the upgrade was successful by calling a function
  const upgradedBooking = await ethers.getContractAt("Booking", PROXY_ADDRESS);
  const owner = await upgradedBooking.owner();
  console.log("Contract owner:", owner);
}

// Execute upgrade
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 