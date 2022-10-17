
;; oyeins
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant contract-address (as-contract tx-sender))
(define-constant mint-price u1500)

(define-constant err-owner-only (err u100))
(define-constant err-token-id-failure (err u101))
(define-constant err-not-token-owner (err u102))

(define-non-fungible-token oyeins uint)
(define-data-var token-id-nonce uint u0)

(define-read-only (get-last-token-id)
    (ok (var-get token-id-nonce))
)

(define-read-only (get-token-uri (token-id uint))
    (ok none)
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? oyeins token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        ;; #[filter(oyeins, token-id, sender, recipient)]
        (nft-transfer? oyeins token-id sender recipient)
    )
)

(define-public (mint)
    (let 
        (
            (token-id (+ (var-get token-id-nonce) u1))
        )
        (try! (nft-mint? oyeins token-id tx-sender))
        (try! (stx-transfer? mint-price tx-sender contract-address))
        (var-set token-id-nonce token-id)
        (ok token-id)
    )
)
