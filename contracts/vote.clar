;; VOTR
;; <add a description here>

(use-trait vote-permission 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

;; Errors
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_ALREADY_REGISTERED (err u400))
(define-constant ERR_NOT_REGISTERED (err u401))
(define-constant ERR_INVALID_ADDRESS (err u402))
(define-constant ERR_INVALID_VOTE_EXPIRATION (err u403))
(define-constant ERR_NOT_A_CONTESTANT (err u404))
(define-constant ERR_NO_ONGOING_VOTES (err u405))
(define-constant ERR_FIRST_VOTE_NOT_CONCLUDED (err u406))
(define-constant ERR_VOTED_ALREADY (err u407))
(define-constant ERR_VOTE_ENDED (err u408))
(define-constant ERR_VOTE_NOT_ENDED (err u409))
(define-constant ERR_UNAUTHORIZED_VOTER (err u410))
(define-constant ERR_WRONG_VOTE_PERMIT (err u410))

;; Variables
(define-data-var votr-admin principal tx-sender)
(define-data-var registration-id uint u0)
(define-data-var total-registered-organizations uint u0)
(define-data-var vote-posting-price uint u50000000)


;; Platform Data Storage
(define-map registered-organization (string-ascii 60) { organization-address: principal, registration-id: uint })
(define-map ongoing-votes (string-ascii 60) { title: (string-ascii 30), number-of-contestants: uint, expiration: uint, vote-permit: principal })
(define-map contestants principal { name: (string-ascii 60), number-of-votes: uint })
(define-map voters principal { supporter: principal })

;; the register function allows an organization to come into the platform and
;; give them the right to commence a voting exercise 
(define-public (register (organization-name (string-ascii 60)) (address principal))
    (let
        (
            (new-id (+ u1 (var-get registration-id)))
        )
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender address)) ERR_INVALID_ADDRESS)
        (asserts! (is-none (map-get? registered-organization organization-name)) ERR_ALREADY_REGISTERED)
        ;; #[filter(organization-name)]
        (map-set registered-organization organization-name { organization-address: address, registration-id: new-id })
        (var-set registration-id new-id)
        (var-set total-registered-organizations (+ (var-get total-registered-organizations) u1))
        (ok new-id)    
    )
)

;; the post-vote function allows only registered organizations to commence voting exercise
;; with an nft every verified voter must hold
(define-public (post-vote (organization-name (string-ascii 60)) (title (string-ascii 30)) (expiration uint) (participants (list 20 {address: principal, name: (string-ascii 60)})) (vote-permit <vote-permission>))
    (begin
        (asserts! (is-eq tx-sender (get organization-address (unwrap! (map-get? registered-organization organization-name) ERR_NOT_REGISTERED))) ERR_UNAUTHORIZED)
        (asserts! (is-eq true (is-registered organization-name)) ERR_NOT_REGISTERED)
        (asserts! (> expiration u0) ERR_INVALID_VOTE_EXPIRATION)
        (asserts! (is-none (map-get? ongoing-votes organization-name)) ERR_FIRST_VOTE_NOT_CONCLUDED)
        ;; #[filter(participants, title, expiration,vote-permit)]
        (try! (stx-transfer? (var-get vote-posting-price) (unwrap! (get organization-address (map-get? registered-organization organization-name)) ERR_NOT_REGISTERED) (var-get votr-admin)))
        (map-set ongoing-votes organization-name { title: title, number-of-contestants: (len participants), expiration: expiration, vote-permit: (contract-of vote-permit) })
        (map set-participants participants)
        ;; (ok participants)
        (ok (contract-of vote-permit))
    )
)


(define-private (has-nft (nft-name <vote-permission>) (nft-id uint) (user principal))
    (is-eq (unwrap-panic (contract-call? nft-name get-owner nft-id)) (some user))
)

;; the vote function allows only users with nft's from the registered organization
(define-public (vote (contestant principal) (vote-permit-contract <vote-permission>) (vote-permit-id uint))
    (let
        (
            (org-name (unwrap! (get name (map-get? contestants contestant)) ERR_NOT_A_CONTESTANT))
            (vote-expiry (unwrap-panic (get expiration (map-get? ongoing-votes org-name))))
            (votes (unwrap-panic (get number-of-votes (map-get? contestants contestant))))
            (updated-votes (merge (unwrap! (map-get? contestants contestant) ERR_NOT_A_CONTESTANT) { number-of-votes: (+ u1 votes) }))
            (vote-permit (unwrap! (get vote-permit (map-get? ongoing-votes org-name)) (err u33)))
        )
        ;; #[filter(updated-votes, contestant)]
        (asserts! (is-eq (contract-of vote-permit-contract) vote-permit) ERR_WRONG_VOTE_PERMIT)
        (asserts! (is-eq true (has-nft vote-permit-contract vote-permit-id tx-sender)) ERR_UNAUTHORIZED_VOTER)
        (asserts! (< block-height vote-expiry) ERR_VOTE_ENDED)
        (asserts! (is-none (map-get? voters contract-caller)) ERR_VOTED_ALREADY)
        (map-set contestants contestant updated-votes)
        (map-set voters tx-sender { supporter: contestant })
        (ok vote-permit)
    )
)

;; the end-vote function ends an ongoing-vote for a particular organization
;; allowing them to post another vote
(define-public (end-vote (org-name (string-ascii 60))) 
    (let
        (
            (vote-expiry (unwrap! (get expiration (map-get? ongoing-votes org-name)) ERR_NOT_REGISTERED))
        )
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender (get organization-address (unwrap! (map-get? registered-organization org-name) ERR_NOT_REGISTERED)))) ERR_UNAUTHORIZED)
        (asserts! (>= block-height vote-expiry) ERR_VOTE_NOT_ENDED)
        (map-delete ongoing-votes org-name)
        (ok "voting has ended")
    )
)

(define-private (set-participants (info {address: principal, name: (string-ascii 60)}))
    (map-set contestants (get address info) { name: (get name info), number-of-votes: u0 })
)

;; check if an organization is registered
(define-read-only (is-registered (organization-name (string-ascii 60)))
    (if (is-some (map-get? registered-organization organization-name)) true false)
)

;; see details of a vote that is ongoing
(define-read-only (check-ongoing-votes (organization-name (string-ascii 60)))
    (map-get? ongoing-votes organization-name)
)

;; the number of registered organizaions
(define-read-only (number-of-registered-organizations)
    (var-get total-registered-organizations)
)

;; get total number of votes for any contestant
(define-read-only (get-contestant-votes (address principal))
    (get number-of-votes (map-get? contestants address))
)

(define-public (set-admin (new-admin principal))
    (begin
        (asserts! (is-eq tx-sender (var-get votr-admin)) ERR_UNAUTHORIZED)
        ;; #[filter(new-admin)]
        (var-set votr-admin new-admin)
        (ok new-admin)
    )
)

(define-public (set-posting-price (new-price uint)) 
    ;; #[filter(new-price)]
    (ok (var-set vote-posting-price new-price))
)
