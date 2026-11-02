/**
 * How long a sign-in lasts, in one place. A sign-in does not end a fixed time after the day it was
 * made: every time the Desk opens it is renewed for the full time again, so someone who uses the
 * Desk at least once in that time is never signed out by the clock.
 *
 * A personal link lasts ninety days. The Desk password lasts 180.
 */
export const PERSON_COOKIE_AGE = 60 * 60 * 24 * 90;
export const WORD_COOKIE_AGE = 60 * 60 * 24 * 180;
