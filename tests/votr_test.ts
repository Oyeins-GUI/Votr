
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
    },
});

Clarinet.test({
    name: "create-election: allow registered organizations to create an election",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address
        let totalVoters = 10
        let contestant1 = accounts.get('wallet_1')!.address
        let contestant2 = accounts.get('wallet_2')!.address
        let contestant3 = accounts.get('wallet_3')!.address

        let block = chain.mineBlock([
            Tx.contractCall(
                "votr",
                "create-election",
                [types.ascii('stackerspool'), types.ascii('clarity lead'), types.uint(totalVoters), types.list([types.principal(contestant1), types.principal(contestant2), types.principal(contestant3)])],
                organization
            )
            // Tx.contractCall(
            //     "votr",
            //     "create-election",
            //     [types.ascii('stackerspool'), types.ascii('clarity lead'), types.principal(organization)],
            //     organization
            // )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
    },
});
