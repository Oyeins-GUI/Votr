;; VOTR
;; VOTR is a Web 3 voting platform. This platform guarantees transparency and credibility as the voters can monitor the progression of the voting exercise over the Blockchain.


;; Errors
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_ALREADY_REGISTERED (err u400))
(define-constant ERR_NOT_REGISTERED (err u401))
(define-constant ERR_INVALID_ADDRESS (err u402))
(define-constant ERR_INVALID_VOTE_EXPIRATION (err u403))
(define-constant ERR_NOT_A_CONTESTANT (err u404))
(define-constant ERR_VOTED_ALREADY (err u406))
(define-constant ERR_VOTE_ENDED (err u407))
(define-constant ERR_VOTE_NOT_ENDED (err u408))
(define-constant ERR_UNAUTHORIZED_VOTER (err u409))


;; Variables
(define-data-var votr-admin principal tx-sender)
(define-data-var elections-id uint u0)
(define-data-var total-registered-organizations uint u0)
(define-data-var vote-posting-price uint u50000000)

;; Platform Data Storage
(define-map RegisteredOrganizations (string-ascii 128) principal)
(define-map Elections { org-name: (string-ascii 128), election-id: uint } { title: (string-ascii 30), expiration: uint })
(define-map Contestants principal { name: (string-ascii 128), number-of-votes: uint })
(define-map Voters principal { supporter: principal })

;; the register function allows an organization to come into the platform and
;; give them the right to commence a voting exercise 
(define-public (register (organization-name (string-ascii 128)) (address principal))
    (begin
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender address)) ERR_INVALID_ADDRESS)
        (asserts! (is-none (map-get? RegisteredOrganizations organization-name)) ERR_ALREADY_REGISTERED)
        ;; #[filter(organization-name)]
        (map-set RegisteredOrganizations organization-name address)
        (var-set total-registered-organizations (+ (var-get total-registered-organizations) u1))
        (ok "registration successful")    
    )
)

;; the post-vote function allows only registered organizations to commence voting exercise
;; with an nft every verified voter must hold
(define-public (create-election (organization-name (string-ascii 128)) (title (string-ascii 30)) (expiration uint) (participants (list 20 {address: principal, name: (string-ascii 128)})) ) 
    (let 
        (
            (election-id (var-get elections-id))
            (id (+ u1 election-id))
        )
        ;; #[filter(title, vote-permit, participants)]
        (asserts! (is-eq (map-get? RegisteredOrganizations organization-name) (some tx-sender)) ERR_INVALID_ADDRESS)
        (asserts! (is-eq true (is-registered organization-name)) ERR_NOT_REGISTERED)
        (asserts! (> expiration u0) ERR_INVALID_VOTE_EXPIRATION)
        (try! (stx-transfer? (var-get vote-posting-price) (unwrap! (map-get? RegisteredOrganizations organization-name) ERR_NOT_REGISTERED) (var-get votr-admin)))
        (map-set Elections { org-name: organization-name, election-id: id } { title: title, expiration: expiration })

        (map set-contestants participants)
        (var-set elections-id id)
        (print participants)
        (ok id)
    )
)

;; this function will allow registered organizations to authorize specific members to have voting right
(define-public (authorize-voters (organization-name (string-ascii 128)) (election-id uint) (voters (list 128 principal))) 
    (begin
        (asserts! (is-eq (map-get? RegisteredOrganizations organization-name) (some tx-sender)) ERR_INVALID_ADDRESS)
        (unwrap-panic (contract-call? .oyeins send-invitation voters))
        (ok "authorization completed")
    )
)

;; the vote function allows only users with nft's from the registered organization
(define-public (vote (contestant principal) (vote-invitation-id uint) (election-id uint))
    (let
        (
            (org-name (unwrap! (get name (map-get? Contestants contestant)) ERR_NOT_A_CONTESTANT))
            (vote-expiry (unwrap-panic (get expiration (map-get? Elections {org-name: org-name, election-id: election-id}))))
            (votes (unwrap-panic (get number-of-votes (map-get? Contestants contestant))))
            (updated-votes (merge (unwrap! (map-get? Contestants contestant) ERR_NOT_A_CONTESTANT) { number-of-votes: (+ u1 votes) }))
        )
        ;; #[filter(updated-votes, contestant)]
        (asserts! (is-eq (unwrap-panic (contract-call? .oyeins get-owner vote-invitation-id)) (some tx-sender)) ERR_UNAUTHORIZED_VOTER)
        (asserts! (< block-height vote-expiry) ERR_VOTE_ENDED)
        (asserts! (is-none (map-get? Voters tx-sender)) ERR_VOTED_ALREADY)
        (unwrap-panic (contract-call? .oyeins burn-invitation vote-invitation-id tx-sender))
        (map-set Contestants contestant updated-votes)
        (map-set Voters tx-sender { supporter: contestant })
        (ok "your vote has been casted")
    )
)

;; the end-vote function ends an ongoing-vote for a particular organization
;; allowing them to post another vote
(define-public (end-vote (org-name (string-ascii 128)) (election-id uint)) 
    (let
        (
            (vote-expiry (unwrap! (get expiration (map-get? Elections {org-name: org-name, election-id: election-id})) ERR_NOT_REGISTERED))
        )
        ;; #[filter(election-id)]
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender (unwrap! (map-get? RegisteredOrganizations org-name) ERR_NOT_REGISTERED))) ERR_UNAUTHORIZED)
        (asserts! (>= block-height vote-expiry) ERR_VOTE_NOT_ENDED)
        (map-delete Elections { org-name: org-name, election-id: election-id })
        (ok "voting has ended")
    )
)

;; helper function to check set contestants
(define-private (set-contestants (info {address: principal, name: (string-ascii 128)}))
    (map-set Contestants (get address info) { name: (get name info), number-of-votes: u0 })
)

;; check if an organization is registered
(define-read-only (is-registered (organization-name (string-ascii 128)))
    (if (is-some (map-get? RegisteredOrganizations organization-name)) true false)
)

;; see details of a vote that is ongoing
(define-read-only (check-elections (organization-name (string-ascii 128)) (election-id uint))
    (map-get? Elections {org-name: organization-name, election-id: election-id})
)

;; the number of registered organizaions
(define-read-only (number-of-registered-organizations)
    (var-get total-registered-organizations)
)

;; get total number of votes for any contestant
(define-read-only (get-contestant-votes (address principal))
    (get number-of-votes (map-get? Contestants address))
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
