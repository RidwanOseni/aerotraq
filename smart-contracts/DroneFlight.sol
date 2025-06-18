// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DroneFlight is Ownable {

    constructor(address initialOwner) Ownable(initialOwner) {}

    struct FlightRecord {
        bytes32 initialDataHash; // Renamed for clarity
        address registrant;
        // Add other potential future fields related to the initial registration
    }

    uint256 public nextFlightId = 1;

    // Maps flightId to the FlightRecord
    mapping(uint256 => FlightRecord) public flightRecords;

    // Maps user address to an array of their flightIds
    mapping(address => uint256[]) public userFlights;

    // Maps the initial flight data hash to a boolean indicating if it's registered
    mapping(bytes32 => bool) public initialHashExists; // Renamed for clarity

    // Maps the initial flight data hash to its flight ID
    mapping(bytes32 => uint256) public initialDataHashToFlightId; // New mapping

    // Maps the initial flight data hash to the DGIP data hash
    mapping(bytes32 => bytes32) public initialHashToDgipHash; // New mapping

    event FlightRegistered(
        uint256 indexed flightId,
        address indexed registrant,
        bytes32 indexed initialDataHash // Renamed for clarity
    );

    // New event for registering DGIP data
    event DGIPDataRegistered(
        bytes32 indexed initialDataHash,
        bytes32 indexed dgipDataHash,
        address indexed registrant
    );

    // Function to register the initial flight plan data
    function registerFlight(bytes32 initialDataHash) external {
        require(initialDataHash != bytes32(0), "Invalid flight data hash");
        require(!initialHashExists[initialDataHash], "Flight plan already registered");

        uint256 currentFlightId = nextFlightId;

        flightRecords[currentFlightId] = FlightRecord({
            initialDataHash: initialDataHash,
            registrant: msg.sender
        });

        userFlights[msg.sender].push(currentFlightId);
        initialHashExists[initialDataHash] = true;
        initialDataHashToFlightId[initialDataHash] = currentFlightId; // Store the flight ID

        emit FlightRegistered(currentFlightId, msg.sender, initialDataHash);

        nextFlightId++;
    }

    // New function to register the DGIP data hash and link it to the initial flight plan hash
    function registerDGIPData(bytes32 initialDataHash, bytes32 dgipDataHash) external {
        require(initialHashExists[initialDataHash], "Initial flight plan not registered");
        require(dgipDataHash != bytes32(0), "Invalid DGIP data hash");
        require(initialHashToDgipHash[initialDataHash] == bytes32(0), "DGIP data already registered for this flight");

        uint256 flightId = initialDataHashToFlightId[initialDataHash];
        require(flightRecords[flightId].registrant == msg.sender, "Not authorized to register DGIP for this flight");

        initialHashToDgipHash[initialDataHash] = dgipDataHash;

        emit DGIPDataRegistered(initialDataHash, dgipDataHash, msg.sender);
    }


    // Function to get initial flight data hash and registrant by flightId
    function getFlight(uint256 flightId) external view returns (bytes32, address) {
        require(
            flightRecords[flightId].registrant != address(0),
            "Flight ID does not exist"
        );
        // Optional access control can be re-added here if needed
        FlightRecord memory flight = flightRecords[flightId];
        return (flight.initialDataHash, flight.registrant);
    }

    // Function to get the DGIP data hash associated with an initial flight data hash
    function getDgipHash(bytes32 initialDataHash) external view returns (bytes32) {
        return initialHashToDgipHash[initialDataHash];
    }

    function getMyFlights() external view returns (uint256[] memory) {
        return userFlights[msg.sender];
    }

}