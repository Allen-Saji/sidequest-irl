module sidequest::quest;

use sui::event;

const ENotOpen: u64 = 0;
const ESelfClaim: u64 = 1;
const ENotParticipant: u64 = 2;
const EStaleClaim: u64 = 3;
const ETerminal: u64 = 4;
const EAlreadyConfirmed: u64 = 5;
const EInvalidReference: u64 = 6;

public struct Quest has key {
    id: UID,
    creator: address,
    helper: Option<address>,
    event_id: u64,
    reference: vector<u8>,
    status: u8,
    claim_version: u64,
    creator_confirmed: bool,
    helper_confirmed: bool,
}

public struct QuestChanged has copy, drop {
    quest_id: ID,
    creator: address,
    helper: Option<address>,
    reference: vector<u8>,
    status: u8,
    claim_version: u64,
}

public fun create(reference: vector<u8>, ctx: &mut TxContext) {
    assert!(reference.length() == 32, EInvalidReference);
    let quest = Quest {
        id: object::new(ctx), creator: ctx.sender(), helper: option::none(),
        event_id: 20261007, reference, status: 0, claim_version: 0,
        creator_confirmed: false, helper_confirmed: false,
    };
    emit(&quest);
    transfer::share_object(quest);
}

public fun claim(quest: &mut Quest, expected_version: u64, ctx: &TxContext) {
    assert!(quest.claim_version == expected_version, EStaleClaim);
    assert!(quest.status == 0 && quest.helper.is_none(), ENotOpen);
    assert!(ctx.sender() != quest.creator, ESelfClaim);
    quest.helper = option::some(ctx.sender());
    quest.claim_version = quest.claim_version + 1;
    quest.status = 1;
    emit(quest);
}

public fun confirm(quest: &mut Quest, expected_version: u64, ctx: &TxContext) {
    assert!(quest.claim_version == expected_version, EStaleClaim);
    assert!(quest.status == 1 && quest.helper.is_some(), ETerminal);
    let sender = ctx.sender();
    if (sender == quest.creator) {
        assert!(!quest.creator_confirmed, EAlreadyConfirmed);
        quest.creator_confirmed = true;
    } else {
        assert!(sender == *quest.helper.borrow(), ENotParticipant);
        assert!(!quest.helper_confirmed, EAlreadyConfirmed);
        quest.helper_confirmed = true;
    };
    if (quest.creator_confirmed && quest.helper_confirmed) quest.status = 2;
    emit(quest);
}

public fun release(quest: &mut Quest, expected_version: u64, ctx: &TxContext) {
    assert!(quest.claim_version == expected_version, EStaleClaim);
    assert!(quest.status == 1 && quest.helper.is_some(), ETerminal);
    assert!(ctx.sender() == *quest.helper.borrow(), ENotParticipant);
    quest.helper = option::none();
    quest.creator_confirmed = false;
    quest.helper_confirmed = false;
    quest.claim_version = quest.claim_version + 1;
    quest.status = 0;
    emit(quest);
}

public fun cancel(quest: &mut Quest, expected_version: u64, ctx: &TxContext) {
    assert!(quest.claim_version == expected_version, EStaleClaim);
    assert!(quest.status < 2, ETerminal);
    assert!(ctx.sender() == quest.creator, ENotParticipant);
    quest.status = 3;
    emit(quest);
}

fun emit(quest: &Quest) {
    event::emit(QuestChanged {
        quest_id: quest.id.to_inner(), creator: quest.creator, helper: quest.helper,
        reference: quest.reference, status: quest.status, claim_version: quest.claim_version,
    });
}

#[test_only]
public fun status(quest: &Quest): u8 { quest.status }
#[test_only]
public fun version(quest: &Quest): u64 { quest.claim_version }
#[test_only]
public fun confirmations(quest: &Quest): (bool, bool) {
    (quest.creator_confirmed, quest.helper_confirmed)
}
