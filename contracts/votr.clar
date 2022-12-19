
;; this nft contract will be used by registered organizations
;; to authorize users who can vote for an election created
;; by registered organizations
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant contract-address (as-contract tx-sender))

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
        (nft-transfer? vote-invitation invitation-id sender recipient)
    )
)

(define-private (send-invitation (address principal))
    (let 
        (
            (invitation-id (+ (var-get invitation-id-nonce) u1))
        )
        (try! (nft-mint? vote-invitation invitation-id address))
        (var-set invitation-id-nonce invitation-id)
        (ok invitation-id)
    )
)

(define-private (send-invitation-to-many (voters (list 128 principal)))
    (begin
        (map send-invitation voters)
        (ok "sent")
    )
)

(define-private (burn-invitation (invitation-id uint) (sender principal)) 
    ;; #[filter(invitation-id, sender)]
    (nft-burn? vote-invitation invitation-id sender)
)
;; end of nft contract


;; VOTR
;; is a Web 3 voting platform. 
;; This platform guarantees transparency and credibility as the voters can monitor 
;; the progression of the voting exercise over the Blockchain 
;; and it also makes use of nfts to make sure only authorize voters
;; can vote for an election

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_ALREADY_REGISTERED (err u400))
(define-constant ERR_NOT_REGISTERED (err u401))
(define-constant ERR_INVALID_ADDRESS (err u402))
(define-constant ERR_INVALID_VOTE_EXPIRATION (err u403))
(define-constant ERR_NOT_A_CONTESTANT (err u404))
(define-constant ERR_VOTED_ALREADY (err u406))
(define-constant ERR_VOTE_ENDED (err u407))
(define-constant ERR_VOTE_NOT_STARTED (err u418))
(define-constant ERR_VOTE_NOT_ENDED (err u408))
(define-constant ERR_UNAUTHORIZED_VOTER (err u409))
(define-constant ERR_NO_CREATED_ELECTION (err u410))
(define-constant ERR_EXCEEDING_INVITE_LIMIT (err u411))
(define-constant ERR_SOME_INVITATIONS_NOT_SENT (err u412))

(define-data-var votr-admin principal tx-sender)
(define-data-var elections-id uint u0)
(define-data-var total-registered-organizations uint u0)
(define-data-var registration-fee uint u100000000)

(define-map RegisteredOrganizations (string-ascii 128) principal)
(define-map Elections { election-id: uint } { 
        title: (string-ascii 30), 
        total-voters: uint, 
        expiration: (optional uint), 
        invitation-sent: uint,
        status: (string-ascii 10),
        contestants: (list 128 { address: principal, name: (string-ascii 128), election-id: uint }),
        creator: (string-ascii 128)
    }
)
(define-map ContestantVotes { address: principal, election-id: uint } { votes: uint, name: (string-ascii 128) })
(define-map Voters { address: principal, election-id: uint } { supporter: principal })

;; PUBLIC FUNCTIONS

;; the register function allows an organization to come into the platform and
;; give them the right to commence a voting exercise 
(define-public (register (organization-name (string-ascii 128)) (address principal))
    (begin
        ;; #[filter(organization-name)]
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender address)) ERR_INVALID_ADDRESS)
        (asserts! (is-none (map-get? RegisteredOrganizations organization-name)) ERR_ALREADY_REGISTERED)

        (map-set RegisteredOrganizations organization-name address)
        (var-set total-registered-organizations (+ (var-get total-registered-organizations) u1))
        (try! (stx-transfer? (var-get registration-fee) address (as-contract CONTRACT_OWNER)))

        (ok "registration successful")  
    )
)

;; the create-election function allows only registered organizations to commence voting exercise
;; with an nft every verified voter must hold
(define-public  (create-election 
                    (organization-name (string-ascii 128)) 
                    (title (string-ascii 30)) 
                    (total-voters uint) 
                    (contestants (list 128 { address: principal, name: (string-ascii 128) }))
                ) 
    (begin
        (map init-constestant contestants)
        (let 
            (
                (election-id (var-get elections-id))
                (id (+ u1 election-id))
                (x (var-set elections-id id))
                (organization-address (unwrap! (map-get? RegisteredOrganizations organization-name) ERR_NOT_REGISTERED ))
                (newListOfContestants (map contestant-to-election contestants))
            )
            ;; #[filter(title, total-voters, contestants)]
            (asserts! (is-eq organization-address tx-sender) ERR_UNAUTHORIZED)

            (map-set Elections { election-id: id } { 
                title: title, 
                total-voters: total-voters, 
                expiration: none, 
                invitation-sent: u0,
                status: "Inactive",
                contestants: newListOfContestants,
                creator: organization-name
            })
            (try! (authorize-voters organization-name id (map get-contestant-address contestants)))

            (ok id)
        )
    )
)

;; this function will allow registered organizations to authorize specific members to have voting right
;; by sending the nft defined above to the user they want to participate in the vote
(define-public (authorize-voters (organization-name (string-ascii 128)) (election-id uint) (voters (list 128 principal))) 
    (begin 
        (asserts! (is-eq (map-get? RegisteredOrganizations organization-name) (some tx-sender)) ERR_NOT_REGISTERED)
        (asserts! (is-some (map-get? Elections { election-id: election-id })) ERR_NO_CREATED_ELECTION)
        (let
            (
                (election (unwrap! (map-get? Elections { election-id: election-id }) ERR_NO_CREATED_ELECTION))
                (total-sent (get invitation-sent election))
                (updated-election (merge election { invitation-sent: (+ total-sent (len voters)) }))
            )
            ;; #[filter(election-id, voters)]
            (try! (can-send-invitation election-id (len voters)))

            (map-set Elections { election-id: election-id } updated-election)

            (send-invitation-to-many voters)
        )
    )
)

;; when an election is created by a registered organization, the election will not be started immediately
;; until they've authorize voters for the election before they can start the election they've created
(define-public (start-election (organization-name (string-ascii 128)) (election-id uint) (expiration uint)) 
    (let
        (
            (election (unwrap! (map-get? Elections { election-id: election-id }) ERR_NO_CREATED_ELECTION))
            (total-voters (get total-voters election))
            (total-sent (get invitation-sent election))
            (updated-election (merge election { status: "Active", expiration: (some (+ block-height expiration)) }))
        )
        ;; #[filter(election-id)]
        (asserts! (> expiration u0) ERR_INVALID_VOTE_EXPIRATION)
        (asserts! (is-eq (map-get? RegisteredOrganizations organization-name) (some tx-sender)) ERR_INVALID_ADDRESS)
        (asserts! (is-eq total-voters total-sent) ERR_SOME_INVITATIONS_NOT_SENT)

        (map-set Elections { election-id: election-id } updated-election)

        (ok "election has started")
    )
)

;; the vote function allows only users with the nft defined above to vote
;; for any contestant of their choice
(define-public (vote (election-id uint) (contestant principal) (invitation-id uint))
    (let
        (
            (election (unwrap! (map-get? Elections { election-id: election-id }) ERR_NO_CREATED_ELECTION))
            (vote-expiry (get expiration election))
            (votes (unwrap! (map-get? ContestantVotes { address: contestant, election-id: election-id }) ERR_NOT_A_CONTESTANT))
        )
        ;; #[filter(updated-votes, contestant, election-id)]
        (asserts! (< block-height (unwrap! vote-expiry ERR_VOTE_NOT_STARTED)) ERR_VOTE_ENDED)
        (asserts! (is-eq (get-owner invitation-id) (ok (some tx-sender))) ERR_UNAUTHORIZED_VOTER)
        (asserts! (is-none (map-get? Voters { address: tx-sender, election-id: election-id })) ERR_VOTED_ALREADY)
        (asserts! (is-some (index-of (get contestants election) { address: contestant, name: (get name votes), election-id: election-id })) ERR_NOT_A_CONTESTANT)

        (map-set Voters { address: tx-sender, election-id: election-id } { supporter: contestant })
        (map-set ContestantVotes 
            { address: contestant, election-id: election-id } 
            { votes: (+ (get votes votes) u1), name: (get name votes) }
        )

        (try! (burn-invitation invitation-id tx-sender))

        (ok "your vote has been casted")
    )
)

;; the end-vote function will delete any election that has expired from the map
(define-public (end-election (organization-name (string-ascii 128)) (election-id uint)) 
    (let
        (
            (vote-expiry (unwrap! (get expiration (map-get? Elections { election-id: election-id })) ERR_NO_CREATED_ELECTION))
        )
        ;; #[filter(election-id)]
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender (unwrap! (map-get? RegisteredOrganizations organization-name) ERR_NOT_REGISTERED))) ERR_UNAUTHORIZED)
        (asserts! (>= block-height (unwrap! vote-expiry ERR_VOTE_NOT_STARTED)) ERR_VOTE_NOT_ENDED)

        (map-delete Elections { election-id: election-id })

        (ok "voting has ended")
    )
)

;; gets the information of the entire election
(define-read-only (get-election-info (election-id uint)) 
    (map-get? Elections { election-id: election-id })
)

;; gets the information for every contestant in a
;; particular election
(define-read-only (get-contestants-info (election-id uint))
    (let
        (
            (election (unwrap-panic (map-get? Elections { election-id: election-id })))
            (allContestants (get contestants election))
        )
        (map fetch-contestant-votes allContestants)
    )
)

;; PRIVATE FUNCTIONS

;; sets all contestants of an election to the ContestantsVotes map
(define-private (init-constestant (contestants { name: (string-ascii 128), address: principal }))
    (map-set ContestantVotes 
        { address: (get address contestants), election-id: (+ (var-get elections-id) u1) } 
        { votes: u0, name: (get name contestants) }
    )
)

;; merge the election-id to contestants tuple in the Elections map
;; to differentiate contestants for one election from the others
(define-private (contestant-to-election (contestant { address: principal, name: (string-ascii 128) }))
    (merge { election-id: (var-get elections-id) } contestant)
)

;; merge the address of contestants to the value of the ContestantVotes map 
(define-private (fetch-contestant-votes (contestant {address: principal, name: (string-ascii 128), election-id: uint})) 
    (let 
        (
            (votes (unwrap-panic (map-get? ContestantVotes { address: (get address contestant), election-id: (get election-id contestant) } )))
        ) 
        (merge { address: (get address contestant) } votes)
    )
)

;; check if the number of nft given out is equal to the total-voters for an election
(define-private (can-send-invitation (election-id uint) (invitations uint))
    (let 
        (
            (election (unwrap! (map-get? Elections { election-id: election-id }) ERR_NO_CREATED_ELECTION))
            (total-voters (get total-voters election))
            (total-sent (get invitation-sent election))
            (remaining-invites (- total-voters total-sent))
        )
        (asserts! (>= remaining-invites invitations) ERR_EXCEEDING_INVITE_LIMIT)
        (ok true)
    )
)

;; gets the address from the tuple
(define-private (get-contestant-address (contestant { address: principal, name: (string-ascii 128) }))
    (get address contestant)
)
