// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./AirnodeRrp.sol";
import "./interfaces/IAirnodePsp.sol";

/// @title Airnode publish–subscribe protocol (PSP) and its relayed version
/// @notice Differently from PSP, relayed PSP allows the requester to specify
/// an Airnode that will sign the fulfillment in the subscription and a relayer
/// that will report the signed fulfillment in the respective Allocator
/// contract.
contract AirnodePsp is AirnodeRrp, IAirnodePsp {
    using ECDSA for bytes32;

    struct Subscription {
        bytes32 templateId;
        bytes parameters;
        bytes conditions;
        address relayer;
        address sponsor;
        address requester;
        bytes4 fulfillFunctionId;
    }

    /// @notice Subscription with the ID
    mapping(bytes32 => Subscription) public override subscriptions;

    mapping(bytes32 => bytes32) public override subscriptionIdToHash;

    /// @notice Stores a subscription record
    /// @param templateId Template ID
    /// @param parameters Parameters provided by the subscription in addition
    /// to the parameters in the request template
    /// @param conditions Conditions under which the subscription is requested
    /// to be fulfilled
    /// @param relayer Relayer address
    /// @param sponsor Sponsor address
    /// @param requester Requester address
    /// @param fulfillFunctionId Selector of the function to be called for
    /// fulfillment
    /// @return subscriptionId Subscription ID
    function storeSubscription(
        bytes32 templateId,
        bytes calldata parameters,
        bytes calldata conditions,
        address relayer,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId
    ) external override returns (bytes32 subscriptionId) {
        address airnode = templateIdToAirnode[templateId];
        require(airnode != address(0), "Template not registered");
        require(
            parameters.length <= MAXIMUM_PARAMETER_LENGTH,
            "Parameters too long"
        );
        require(
            conditions.length <= MAXIMUM_PARAMETER_LENGTH,
            "Conditions too long"
        );
        require(relayer != address(0), "Relayer address zero");
        require(sponsor != address(0), "Sponsor address zero");
        require(requester != address(0), "Requester address zero");
        require(fulfillFunctionId != bytes4(0), "Function selector zero");
        subscriptionId = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                templateId,
                parameters,
                conditions,
                relayer,
                sponsor,
                requester,
                fulfillFunctionId
            )
        );
        subscriptions[subscriptionId] = Subscription({
            templateId: templateId,
            parameters: parameters,
            conditions: conditions,
            relayer: relayer,
            sponsor: sponsor,
            requester: requester,
            fulfillFunctionId: fulfillFunctionId
        });
        subscriptionIdToHash[subscriptionId] = keccak256(
            abi.encodePacked(airnode, requester, sponsor, fulfillFunctionId)
        );
        emit StoredSubscription(
            subscriptionId,
            templateId,
            parameters,
            conditions,
            relayer,
            sponsor,
            requester,
            fulfillFunctionId
        );
    }

    function registerSubscription(
        bytes32 templateId,
        bytes calldata parameters,
        bytes calldata conditions,
        address relayer,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId
    ) external override returns (bytes32 subscriptionId) {
        address airnode = templateIdToAirnode[templateId];
        require(airnode != address(0), "Template not registered");
        require(
            parameters.length <= MAXIMUM_PARAMETER_LENGTH,
            "Parameters too long"
        );
        require(
            conditions.length <= MAXIMUM_PARAMETER_LENGTH,
            "Conditions too long"
        );
        require(relayer != address(0), "Relayer address zero");
        require(sponsor != address(0), "Sponsor address zero");
        require(requester != address(0), "Requester address zero");
        require(fulfillFunctionId != bytes4(0), "Function selector zero");
        subscriptionId = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                templateId,
                parameters,
                conditions,
                relayer,
                sponsor,
                requester,
                fulfillFunctionId
            )
        );
        subscriptionIdToHash[subscriptionId] = keccak256(
            abi.encodePacked(airnode, requester, sponsor, fulfillFunctionId)
        );
        emit RegisteredSubscription(
            subscriptionId,
            templateId,
            parameters,
            conditions,
            relayer,
            sponsor,
            requester,
            fulfillFunctionId
        );
    }

    /// @notice Called by the Airnode to fulfill the subscription
    /// @dev An Airnode gets the active subscriptions that it needs to serve
    /// from Allocator contracts. These subscriptions will be fulfilled
    /// continually, as long as the conditions specified under their parameters
    /// are met. In other words, unlike RRP requests, a subscription being
    /// fulfilled does not result in its expiration.
    /// The Airnode will only fulfill a subscription if the subsequent static
    /// call returns `true` for `callSuccess`. If it does not in this static
    /// call or the transaction following that, this will not be handled by the
    /// Airnode in any way (i.e., there is no error message as in RRP).
    /// @param subscriptionId Subscription ID
    /// @param timestamp Timestamp used in the signature
    /// @param data Fulfillment data
    /// @param signature Subscription ID, a timestamp and the sponsor wallet
    /// address signed by the Airnode address
    /// @return callSuccess If the fulfillment call succeeded
    /// @return callData Data returned by the fulfillment call (if there is
    /// any)
    function fulfillSubscription(
        bytes32 subscriptionId,
        address airnode,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId,
        uint256 timestamp,
        bytes calldata data,
        bytes calldata signature
    ) external override returns (bool callSuccess, bytes memory callData) {
        require(
            subscriptionIdToHash[subscriptionId] ==
                keccak256(
                    abi.encodePacked(
                        airnode,
                        requester,
                        sponsor,
                        fulfillFunctionId
                    )
                ),
            "Subscription not registered"
        );
        require(
            (
                keccak256(
                    abi.encodePacked(subscriptionId, timestamp, msg.sender)
                ).toEthSignedMessageHash()
            ).recover(signature) == airnode,
            "Signature mismatch"
        );
        require(
            requester == sponsor ||
                sponsorToRequesterToSponsorshipStatus[sponsor][requester],
            "Requester not sponsored"
        );
        (callSuccess, callData) = requester.call( // solhint-disable-line avoid-low-level-calls
            abi.encodeWithSelector(
                fulfillFunctionId,
                subscriptionId,
                timestamp,
                data
            )
        );
        if (callSuccess) {
            emit FulfilledSubscription(subscriptionId, timestamp, data);
        }
    }

    /// @notice Called by the relayer to fulfill the subscription
    /// @dev In relayed PSP, the relayer gets its active subscriptions from the
    /// Allocator contracts it uses, gets Airnode to sign responses for them,
    /// and sends the fulfillment transaction.
    /// @param subscriptionId Subscription ID
    /// @param timestamp Timestamp used in the signature
    /// @param data Fulfillment data
    /// @param signature Subscription ID, a timestamp, the relayer address,
    /// the sponsor wallet address and the fulfillment data signed by the
    /// Airnode address
    /// @return callSuccess If the fulfillment call succeeded
    /// @return callData Data returned by the fulfillment call (if there is
    /// any)
    function fulfillSubscriptionRelayed(
        bytes32 subscriptionId,
        address airnode,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId,
        uint256 timestamp,
        bytes calldata data,
        bytes calldata signature
    ) external override returns (bool callSuccess, bytes memory callData) {
        require(
            subscriptionIdToHash[subscriptionId] ==
                keccak256(
                    abi.encodePacked(
                        airnode,
                        requester,
                        sponsor,
                        fulfillFunctionId
                    )
                ),
            "Subscription not registered"
        );
        require(
            (
                keccak256(
                    abi.encodePacked(
                        subscriptionId,
                        timestamp,
                        msg.sender,
                        data
                    )
                ).toEthSignedMessageHash()
            ).recover(signature) == airnode,
            "Signature mismatch"
        );
        require(
            requester == sponsor ||
                sponsorToRequesterToSponsorshipStatus[sponsor][requester],
            "Requester not sponsored"
        );
        (callSuccess, callData) = requester.call( // solhint-disable-line avoid-low-level-calls
            abi.encodeWithSelector(
                fulfillFunctionId,
                subscriptionId,
                timestamp,
                data
            )
        );
        if (callSuccess) {
            emit FulfilledSubscriptionRelayed(subscriptionId, timestamp, data);
        }
    }
}
