#[test_only]
module sidequest::quest_tests;
use sidequest::quest::{Self, Quest};
use sui::test_scenario;

fun setup(): test_scenario::Scenario {
    let mut s = test_scenario::begin(@0xA);
    quest::create(vector[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], s.ctx());
    s.next_tx(@0xB);
    s
}

#[test]
fun two_confirmations_complete() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    assert!(quest::status(&q) == 1);
    quest::confirm(&mut q, 1, s.ctx());
    assert!(quest::status(&q) == 1);
    test_scenario::return_shared(q);
    s.next_tx(@0xA);
    let mut q = s.take_shared<Quest>();
    quest::confirm(&mut q, 1, s.ctx());
    assert!(quest::status(&q) == 2);
    test_scenario::return_shared(q);
    s.end();
}

#[test]
fun release_clears_confirmations() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    quest::confirm(&mut q, 1, s.ctx());
    quest::release(&mut q, 1, s.ctx());
    assert!(quest::status(&q) == 0 && quest::version(&q) == 2);
    let (creator, helper) = quest::confirmations(&q);
    assert!(!creator && !helper);
    test_scenario::return_shared(q);
    s.end();
}

#[test, expected_failure(abort_code = 1, location = sidequest::quest)]
fun self_claim_fails() {
    let mut s = setup();
    s.next_tx(@0xA);
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    test_scenario::return_shared(q);
    s.end();
}

#[test, expected_failure(abort_code = 0, location = sidequest::quest)]
fun second_helper_fails() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    test_scenario::return_shared(q);
    s.next_tx(@0xC);
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 1, s.ctx());
    test_scenario::return_shared(q);
    s.end();
}

#[test, expected_failure(abort_code = 2, location = sidequest::quest)]
fun outsider_cannot_confirm() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    test_scenario::return_shared(q);
    s.next_tx(@0xC);
    let mut q = s.take_shared<Quest>();
    quest::confirm(&mut q, 1, s.ctx());
    test_scenario::return_shared(q);
    s.end();
}

#[test, expected_failure(abort_code = 3, location = sidequest::quest)]
fun stale_confirmation_fails() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    quest::release(&mut q, 1, s.ctx());
    quest::claim(&mut q, 2, s.ctx());
    quest::confirm(&mut q, 1, s.ctx());
    test_scenario::return_shared(q);
    s.end();
}

#[test, expected_failure(abort_code = 5, location = sidequest::quest)]
fun duplicate_confirmation_fails() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    quest::confirm(&mut q, 1, s.ctx());
    quest::confirm(&mut q, 1, s.ctx());
    test_scenario::return_shared(q);
    s.end();
}

#[test]
fun creator_can_cancel_after_one_confirmation() {
    let mut s = setup();
    let mut q = s.take_shared<Quest>();
    quest::claim(&mut q, 0, s.ctx());
    quest::confirm(&mut q, 1, s.ctx());
    test_scenario::return_shared(q);
    s.next_tx(@0xA);
    let mut q = s.take_shared<Quest>();
    quest::cancel(&mut q, 1, s.ctx());
    assert!(quest::status(&q) == 3);
    test_scenario::return_shared(q);
    s.end();
}
