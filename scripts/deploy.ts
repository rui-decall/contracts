import { ethers, network, upgrades } from "hardhat";
import { verify } from "./verify";

async function main() {
  console.log("Deploying Booking contract...");

  // Get the contract factory
  const Booking = await ethers.getContractFactory("Booking");

  // Deploy as upgradeable contract
  const booking = await upgrades.deployProxy(Booking, []);
  await booking.waitForDeployment();

  const address = await booking.getAddress();
  console.log("Booking deployed to:", address);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(address);
  console.log("Implementation address:", implementationAddress);

  // Verify the implementation contract on Etherscan
  // Remove this if deploying to a network that doesn't support verification
  try {
    console.log("Verifying contract...");
    await verify(implementationAddress, []);
    console.log("Contract verified successfully");
  } catch (error) {
    console.log("Verification failed:", error);
  }

  // Log deployment details for future reference
  console.log("\nDeployment details:");
  console.log("--------------------");
  console.log("Proxy address:", address);
  console.log("Implementation address:", implementationAddress);
  console.log("Network:", network.name);
  console.log("--------------------");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 