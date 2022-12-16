
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "register: allow only unregistered organizations to get registered",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address

        const block = chain.mineBlock([
            Tx.contractCall(
                'votr',
                'register',
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");

    },
});

Clarinet.test({
    name: "register: don't allow registered organizations to get register again",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        // ERR_ALREADY_REGISTERED
        block.receipts[1].result.expectErr().expectUint(400);
    },
});

Clarinet.test({
    name: "create-election: allow registered organizations to create an election",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let random = accounts.get('wallet_3')!.address

        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            )
        ]);

        const election = chain.callReadOnlyFn(
            "votr",
            "get-election-info",
            [types.uint(1)],
            random
        )
        
        assertEquals(election.result, '(some {contestants: [{address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, election-id: u1, name: "Oyeins"}, {address: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, election-id: u1, name: "Eric"}], creator: "stackerspool", expiration: none, invitation-sent: u2, status: "Inactive", title: "clarity lead", total-voters: u4})');

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "create-election: do not allow unregistered organizations to create an election",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let random = accounts.get('wallet_3')!.address
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            )
        ]);

        const election = chain.callReadOnlyFn(
            "votr",
            "get-election-info",
            [types.uint(1)],
            random
        )
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        assertEquals(election.result, "none");

        // ERR_NOT_REGISTERED
        block.receipts[0].result.expectErr().expectUint(401)
    },
});

Clarinet.test({
    name: "authorize-voters: allow only registered organizations that has created an election to authorize voters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let random = accounts.get('wallet_5')!.address
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [
                    types.ascii('stackerspool'), 
                    types.uint(electionId), 
                    types.list([types.principal(voter1), types.principal(voter2)])
                ],
                organization
            )
        ]);

        const election = chain.callReadOnlyFn(
            "votr",
            "get-election-info",
            [types.uint(1)],
            random
        )
        
        assertEquals(election.result, '(some {contestants: [{address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, election-id: u1, name: "Oyeins"}, {address: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, election-id: u1, name: "Eric"}], creator: "stackerspool", expiration: none, invitation-sent: u4, status: "Inactive", title: "clarity lead", total-voters: u4})');

        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "authorize-voters: don't allow registered organizations that has not created an election to authorize voters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let electionId = 1
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);

        // ERR_NO_CREATED_ELECTION
        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectErr().expectUint(410);
    },
});

Clarinet.test({
    name: "authorize-voters: don't allow unregistered organizations to authorize voters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let electionId = 1
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        // ERR_NOT_REGISTERED
        block.receipts[0].result.expectErr().expectUint(401);
    },
});

Clarinet.test({
    name: "start-election: allow registered organizations who have created an election and authorize voters to start election",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let random = accounts.get('wallet_5')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            )
        ]);

        const election = chain.callReadOnlyFn(
            "votr",
            "get-election-info",
            [types.uint(1)],
            random
        )
        
        assertEquals(election.result, '(some {contestants: [{address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, election-id: u1, name: "Oyeins"}, {address: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, election-id: u1, name: "Eric"}], creator: "stackerspool", expiration: (some u21), invitation-sent: u4, status: "Active", title: "clarity lead", total-voters: u4})');
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");
    },
});

Clarinet.test({
    name: "start-election: don't allow registered organizations who have created an election but have not authorize voters to start election",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            )
        ]);

        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 3);

        // ERR_NOT_REGISTERED
        block.receipts[0].result.expectErr().expectUint(401)
        block.receipts[1].result.expectErr().expectUint(401)
    },
});

Clarinet.test({
    name: "start-election: dont't allow registered organizations who have created an election but have not authorize voters to start election",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let random = accounts.get('wallet_5')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            )
        ]);

        const election = chain.callReadOnlyFn(
            "votr",
            "get-election-info",
            [types.uint(1)],
            random
        )
        
        assertEquals(election.result, '(some {contestants: [{address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, election-id: u1, name: "Oyeins"}, {address: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, election-id: u1, name: "Eric"}], creator: "stackerspool", expiration: none, invitation-sent: u2, status: "Inactive", title: "clarity lead", total-voters: u4})');
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[2].result.expectErr().expectUint(412);
    },
});

Clarinet.test({
    name: "vote: allow authorized voter to vote if the block-height is less than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        // let unauthorized = accounts.get('wallet_5')!.address
        let random = accounts.get('wallet_6')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(3)], voter1
            )
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[4].events[0].type, "nft_burn_event");        

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");
    },
});

Clarinet.test({
    name: "vote: don't allow authorized voter to vote if the block-height is greater than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        // let unauthorized = accounts.get('wallet_5')!.address
        // let random = accounts.get('wallet_6')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            )           
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        chain.mineEmptyBlockUntil(24);

        let block2 = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(3)], voter1
            )
        ]);

        // ERR_VOTE_ENDED
        block2.receipts[0].result.expectErr().expectUint(407);
    },
});

Clarinet.test({
    name: "vote: don't allow authorized voter to vote if the block-height is less than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let unauthorized = accounts.get('wallet_5')!.address
        let random = accounts.get('wallet_6')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(3)], unauthorized
            )          
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        // ERR_UNAUTHORIZED_VOTER
        block.receipts[4].result.expectErr().expectUint(409);
    },
});

Clarinet.test({
    name: "vote: don't allow authorized voter to vote if the block-height is less than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let unauthorized = accounts.get('wallet_5')!.address
        let random = accounts.get('wallet_6')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(random), types.uint(3)], voter2
            )          
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        // ERR_NOT_A_CONTESTANT
        block.receipts[4].result.expectErr().expectUint(404);
    },
});

Clarinet.test({
    name: "vote: don't allow authorized voter to vote more than once",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let unauthorized = accounts.get('wallet_5')!.address
        let random = accounts.get('wallet_6')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(3)], voter2
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant2), types.uint(3)], voter2
            )         
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 6);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        // ERR_VOTED_ALREADY
        block.receipts[5].result.expectErr().expectUint(409);
    },
});

Clarinet.test({
    name: "end-election: election can be ended if block-height is greater than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(4)], voter2
            ),
               
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[4].events[0].type, "nft_burn_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        chain.mineEmptyBlockUntil(30);

        let block2 = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "end-election",
                [types.ascii("stackerspool"), types.uint(electionId)], organization
            )  
        ]);
    },
});

Clarinet.test({
    name: "end-election: election can't be ended if block-height is less than election expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(4)], voter2
            ),
            Tx.contractCall(
                "votr",
                "end-election",
                [types.ascii("stackerspool"), types.uint(electionId)], organization
            )   
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 6);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[4].events[0].type, "nft_burn_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");
        // ERR_VOTE_NOT_ENDED
        block.receipts[5].result.expectErr().expectUint(408);
    },
});

Clarinet.test({
    name: "end-election: election can only be ended by organization or admin",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let expiration = 20
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let unauthorized = accounts.get('wallet_5')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2)])], organization
            ),
            Tx.contractCall(
                "votr",
                "start-election",
                [types.ascii('stackerspool'), types.uint(electionId), types.uint(expiration)], organization
            ),
            Tx.contractCall(
                "votr",
                "vote",
                [types.uint(electionId), types.principal(contestant1), types.uint(4)], voter2
            ),
               
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.receipts[0].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[0].type, "nft_mint_event");
        assertEquals(block.receipts[2].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[4].events[0].type, "nft_burn_event");

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[3].result.expectOk().expectAscii("election has started");

        chain.mineEmptyBlockUntil(30);

        let block2 = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "end-election",
                [types.ascii("stackerspool"), types.uint(electionId)], unauthorized
            )  
        ]);
        block2.receipts[0].result.expectErr().expectUint(200);
    },
});

Clarinet.test({
    name: "get-contestants-info: can be called by anyone",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let electionId = 1
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let random = accounts.get('wallet_5')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 2);

        let block2 = chain.callReadOnlyFn(
            "votr",
            "get-contestants-info",
            [types.uint(electionId)],
            random
        );

        assertEquals(block2.result, '[{address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, name: "Oyeins", votes: u0}, {address: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, name: "Eric", votes: u0}]');
    },
});

Clarinet.test({
    name: "read-only nft functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 4
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let random = accounts.get('wallet_5')!.address
        
        const contestants = types.list([
            types.tuple({
                address: types.principal(contestant1),
                name: types.ascii("Oyeins")
            }),
            types.tuple({
                address: types.principal(contestant2),
                name: types.ascii("Eric")
            })
        ])

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "register",
                [types.ascii('stackerspool'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "votr",
                "create-election",
                [
                    types.ascii('stackerspool'), 
                    types.ascii('clarity lead'), 
                    types.uint(totalVoters), 
                    contestants
                ],
                organization
            ),
        ]);
        
        assertEquals(block.height, 2);
        assertEquals(block.receipts.length, 2);

        let block2 = chain.callReadOnlyFn(
            "votr",
            "get-last-token-id",
            [],
            random
        );

        let block3 = chain.callReadOnlyFn(
            "votr",
            "transfer",
            [types.uint(1), types.principal(contestant1), types.principal(random)],
            contestant1
        );

        let block4 = chain.callReadOnlyFn(
            "votr",
            "get-token-uri",
            [types.uint(1)],
            contestant1
        );

        assertEquals(block3.events[0].type, "nft_transfer_event");
        assertEquals(block4.result, "(ok none)");

        block2.result.expectOk().expectUint(2);
        block3.result.expectOk().expectBool(true);
    },
});
