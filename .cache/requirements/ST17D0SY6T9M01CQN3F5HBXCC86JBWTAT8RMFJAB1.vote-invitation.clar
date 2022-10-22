
;; vote-invitation
(impl-trait 'ST17D0SY6T9M01CQN3F5HBXCC86JBWTAT8RMFJAB1.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant contract-address (as-contract tx-sender))
(define-constant mint-price u1500)

(define-constant err-owner-only (err u100))
(define-constant err-token-id-failure (err u101))
(define-constant err-not-token-owner (err u102))

(define-non-fungible-token vote-invitation uint)
(define-data-var invitation-id-nonce uint u0)

(define-read-only (get-last-token-id)
    (ok (var-get invitation-id-nonce))
)

(define-read-only (get-token-uri (token-id uint))
    (ok none)
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? vote-invitation token-id))
)

(define-public (transfer (invitation-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        ;; #[filter(vote-invitation, invitation-id, sender, recipient)]
        (nft-transfer? vote-invitation invitation-id sender (as-contract contract-owner))
    )
)

(define-private (mint (address principal))
    (let 
        (
            (invitation-id (+ (var-get invitation-id-nonce) u1))
        )
        (try! (nft-mint? vote-invitation invitation-id address))
        (var-set invitation-id-nonce invitation-id)
        (ok invitation-id)
    )
)

(define-public (send-invitation (voters (list 128 principal))) 
    (begin
        (map mint voters)
        (print voters)
        (ok true)
    )
)

(define-public (burn-invitation (invitation-id uint) (sender principal)) 
    ;; #[filter(invitation-id, sender)]
    (nft-burn? vote-invitation invitation-id sender)
)

