;; VOTR
;; <add a description here>

;; Errors
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_ALREADY_REGISTERED (err u400))
(define-constant ERR_NOT_REGISTERED (err u401))
(define-constant ERR_INVALID_ADDRESS (err u402))
(define-constant ERR_INVALID_VOTE_EXPIRATION (err u403))
(define-constant ERR_NOT_A_CONTESTANT (err u404))
(define-constant ERR_NO_ONGOING_VOTES (err u405))
(define-constant ERR_FIRST_VOTE_NOT_CONCLUDED (err u406))

(define-data-var default-expiration uint (+ block-height u36))

;; Platform Variables
(define-data-var votr-admin principal tx-sender) ;;usefull
(define-data-var registration-id uint u0) ;;useful
(define-data-var vote-id uint u0) ;; useful
(define-data-var total-registered-organizations uint u0) ;; useful


;; Platform Data
(define-map registered-organization (string-ascii 60) { organization-address: principal, registration-id: uint, registered: bool })
(define-map ongoing-votes (string-ascii 60) { title: (string-ascii 30), number-of-contestants: uint, vote-id: uint, expiration: uint })
(define-map contestants principal { name: (string-ascii 60), number-of-votes: uint })

;; Public & Private Functions
;; (define-public (vote (contestant principal)))

;; Public & Private functions IN USE
(define-read-only (is-registered (organization-name (string-ascii 60)))
    (if (is-some (map-get? registered-organization organization-name)) true false)
)

(define-public (register (organization-name (string-ascii 60)) (address principal))
    (let
        (
            (new-id (+ u1 (var-get registration-id)))
        )
        (asserts! (or (is-eq tx-sender (var-get votr-admin)) (is-eq tx-sender address)) ERR_INVALID_ADDRESS)
        (asserts! (is-none (map-get? registered-organization organization-name)) ERR_ALREADY_REGISTERED)
        ;; #[filter(organization-name)]
        (map-set registered-organization organization-name { organization-address: address, registration-id: new-id, registered: true })
        (var-set registration-id new-id)
        (var-set total-registered-organizations (+ (var-get total-registered-organizations) u1))
        (ok new-id)    
    )
)

(define-private (set-participants (info {address: principal, name: (string-ascii 60)}))
    (map-set contestants (get address info) { name: (get name info), number-of-votes: u0 })
)

(define-public (post-vote (organization-name (string-ascii 60)) (title (string-ascii 30)) (expiration uint) (participants (list 20 {address: principal, name: (string-ascii 60)})))
    (let
        (
            (new-id (+ (var-get vote-id) u1))
            (vote-expiration (+ (var-get default-expiration) expiration))
        )
        (asserts! (is-eq tx-sender (get organization-address (unwrap! (map-get? registered-organization organization-name) ERR_NOT_REGISTERED))) ERR_UNAUTHORIZED)
        (asserts! (is-eq true (is-registered organization-name)) ERR_NOT_REGISTERED)
        (asserts! (> expiration u0) ERR_INVALID_VOTE_EXPIRATION)
        (asserts! (is-none (map-get? ongoing-votes organization-name)) ERR_FIRST_VOTE_NOT_CONCLUDED)
        ;; #[filter(participants, title, expiration)]
        (map-set ongoing-votes organization-name { title: title, number-of-contestants: (len participants), vote-id: new-id, expiration: vote-expiration })
        (map set-participants participants)
        (var-set vote-id new-id)
        (ok new-id)
    )
)

(define-read-only (check-ongoing-votes (organization-name (string-ascii 60)))
    (map-get? ongoing-votes organization-name)
)

(define-read-only (number-of-registered-organizations)
    (var-get total-registered-organizations)
)

(define-read-only (get-contestant-votes (address principal))
    (map-get? contestants address)
)

(define-public (set-admin (new-admin principal))
    (begin
        (asserts! (is-eq tx-sender (var-get votr-admin)) ERR_UNAUTHORIZED)
        ;; #[filter(new-admin)]
        (var-set votr-admin new-admin)
        (ok new-admin)
    )
)
