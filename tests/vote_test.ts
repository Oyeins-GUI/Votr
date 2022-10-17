
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "register: allow only unregistered organizations to get registered",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let organization = accounts.get('wallet_1')!.address

        const block = chain.mineBlock(
            Tx.contractCall(
                'vote',
                'register',
                [types.ascii('votr'), types.principal(organization)],
                organization
            )
        );

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
                "vote",
                "register",
                [types.principal('votr'), types.principal(organization)],
                organization
            ),
            Tx.contractCall(
                "vote",
                "register",
                [types.principal('votr'), types.principal(organization)],
                organization
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);
    },
});
