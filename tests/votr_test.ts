
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
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectErr().expectUint(400);
    },
});

Clarinet.test({
    name: "create-election: allow registered organizations to create an election",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 10
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address

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
                [types.ascii('stackerspool'), types.ascii('clarity lead'), types.uint(totalVoters), types.list([types.principal(contestant1), types.principal(contestant2)])],
                organization
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[1].events[0].type, "stx_transfer_event");
        assertEquals(block.receipts[1].events[1].type, "nft_mint_event");
        assertEquals(block.receipts[1].events[2].type, "nft_mint_event");
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectOk().expectUint(1);
        
    },
});

Clarinet.test({
    name: "create-election: do not allow unregistered organizations to create an election",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 10
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "create-election",
                [types.ascii('stackerspool'), types.ascii('clarity lead'), types.uint(totalVoters), types.list([types.principal(contestant1), types.principal(contestant2)])],
                organization
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectErr().expectUint(402)
    },
});

Clarinet.test({
    name: "authorize-voters: allow only registered organizations that has created an election to authorize voters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 10
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let voter3 = accounts.get('wallet_5')!.address
        let voter4 = accounts.get('wallet_6')!.address

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
                [types.ascii('stackerspool'), types.ascii('clarity lead'), types.uint(totalVoters), types.list([types.principal(contestant1), types.principal(contestant2)])],
                organization
            ),
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2), types.principal(voter3), types.principal(voter4)])], organization
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectAscii("registration successful");
        block.receipts[1].result.expectErr().expectUint(401)
        console.log(block.receipts);
        
    },
});

Clarinet.test({
    name: "authorize-voters: don't allow registered organizations that has not created an election to authorize voters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let electionId = 1
        let voter1 = accounts.get('wallet_3')!.address
        let voter2 = accounts.get('wallet_4')!.address
        let voter3 = accounts.get('wallet_5')!.address
        let voter4 = accounts.get('wallet_6')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "authorize-voters",
                [types.ascii('stackerspool'), types.uint(electionId), types.list([types.principal(voter1), types.principal(voter2), types.principal(voter3), types.principal(voter4)])], organization
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectErr().expectUint(401)
        console.log(block.receipts);
        
    },
});
