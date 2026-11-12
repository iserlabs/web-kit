#!/usr/bin/env python3
"""Builds the four `owner-statement/1` contract fixtures from the October 2026 catalog.

Usage: python3 build_fixtures.py <path to catalog.json> [out dir]

Every money figure is parsed out of the catalog and never typed here. Who the figures belong to is
replaced: this repo is public, so owner names, home addresses, guest names, vendor names, invoice
numbers and gate passwords are stand-ins. Business names (the sender) are real.
"""
import json
import pathlib
import re
import sys

CAT = json.load(open(sys.argv[1]))
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent)

ENT = {(e["kind"], e["id"]): {k: v["value"] for k, v in e["facts"].items()} for e in CAT["entities"]}


def S(brand, key):
    return ENT[("statement", brand)][key]


def cents(text):
    if text is None:
        return None
    t = str(text).strip()
    neg = t.startswith("(") or t.startswith("-")
    t = t.strip("()-").replace("$", "").replace(",", "")
    c = round(float(t) * 100)
    return -c if neg else c


def pct(text):
    return None if text is None else float(str(text).replace("%", ""))


def n(text):
    return int(str(text).replace(",", ""))


CALL = ENT[("meta", "board")]["call_link"]
STAY_ORDER = json.loads(ENT[("meta", "board")]["stay_order"])
NO_YTD = "year to date is not in the October record yet"
YTD_OFF = {"known": False, "reason": NO_YTD, "from": None}


def row(label, role, month, ytd=None):
    return {"label": label, "role": role, "month": month, "ytd": ytd}


def money_cols(*keys):
    return [{"key": k, "label": lb, "kind": kind} for k, lb, kind in keys]


# --------------------------------------------------------------------------- Sun Mountain
def sun_mountain():
    b = "sms"
    rows, details = [], []
    for i, code in enumerate(STAY_ORDER[b]):
        s = ENT[("stay", f"{b}-{code}")]
        detail = []
        if cents(s["tax"]):
            detail.append({"label": "Guest paid, tax included", "cents": cents(s["gross"])})
            detail.append({"label": "Booking.com collected tax, passed through", "cents": -cents(s["tax"])})
        detail += [
            {"label": "Booked revenue", "cents": cents(s["revenue"])},
            {"label": "Cleaning", "cents": cents(s["cleaning"])},
            {"label": "Net", "cents": cents(s["net"]), "strong": True},
            {"label": f"Management fee, {S(b, 'fee_rate')}", "cents": cents(s["fee"])},
            {"label": "Your share", "cents": cents(s["share"]), "strong": True},
        ]
        r = {"ref": f"A-{i + 1}",
             "cells": {"dates": s["dates"], "channel": s["channel"], "nights": n(s["nights"]),
                       "revenue": cents(s["revenue"]), "share": cents(s["share"])},
             "detail": detail}
        if s["running"]:
            r["note"] = s["running"][0].upper() + s["running"][1:]
        rows.append(r)
    costs_ce = cents(S(b, "costs_ce"))
    return {
        "schema": "owner-statement/1", "brand": "sun-mountain", "business": S(b, "brand"),
        "month": "2026-10", "monthLabel": S(b, "month"), "monthShort": S(b, "month").split()[0],
        "status": "final",
        "owner": {"key": "sample-owner", "name": "Alex and Jordan Sample", "greeting": "Alex and Jordan"},
        "property": {"label": "100 Pine Street", "line": "100 Pine Street, Springfield, CO 80000"},
        "prepared": {"by": S(b, "preparer"), "date": "2026-11-01"},
        "moves": {"direction": "to_owner", "cents": cents(S(b, "paid")),
                  "headline": f"From Sun Mountain, {S(b, 'month')}",
                  "line": f"by {S(b, 'method')}, {S(b, 'date')}",
                  "method": S(b, "method"), "date": "2026-11-02", "dateUnknown": None,
                  "sentence": f"We are sending you {S(b, 'paid')} for October by {S(b, 'method')} on {S(b, 'date')}."},
        "summary": {
            "title": "Statement summary",
            "columns": {"month": "October", "ytd": "Year to date"},
            "ytd": YTD_OFF,
            "rows": [
                row("Money in: booked revenue", "in", cents(S(b, "revenue"))),
                row("Costs: cleaning and expenses paid for you", "cost", costs_ce),
                row(f"Fees: management, {S(b, 'fee_rate')}", "fee", cents(S(b, "fee"))),
                row("The money that moves: sent to you", "moves", cents(S(b, "paid"))),
            ],
            "foot": [["in", "cost", "fee"], "moves"],
        },
        "groups": [{
            "title": "Every stay, by property", "property": "100 Pine Street",
            "columns": money_cols(("dates", "Dates", "text"), ("channel", "Channel", "text"),
                                  ("nights", "Nights", "int"), ("revenue", "Revenue", "money"),
                                  ("share", "Your share", "money")),
            "rows": rows,
            "subtotal": {"label": f"{S(b, 'stays')} stays",
                         "cells": {"nights": n(S(b, "nights")), "revenue": cents(S(b, "revenue")),
                                   "share": cents(S(b, "share"))}},
            "note": f"Cleaning is inside each line; our fee is {S(b, 'fee_rate')} of net on every stay.",
        }],
        "costs": {
            "title": "Expenses paid on your behalf",
            "rows": [
                {"ref": "B-1", "label": "Hot tub service, two invoices", "payee": "Hot tub service",
                 "number": S(b, "drspa_inv"), "date": "2026-10-01", "note": f"Paid {S(b, 'drspa_date')}",
                 "cents": cents(S(b, "drspa")), "href": "https://example.com/invoices/hot-tub"},
                {"ref": "B-2", "label": "Linen and cleaning supplies, invoice 1", "payee": "Cleaning supplier",
                 "number": "1", "date": "2026-10-15",
                 "note": f"{S(b, 'r1924_date')}. {S(b, 'r_extra')}",
                 "cents": cents(S(b, "r1924")), "href": "https://example.com/invoices/supplies-1"},
                {"ref": "B-3", "label": "Linen and cleaning supplies, invoice 2", "payee": "Cleaning supplier",
                 "number": "2", "date": "2026-10-31", "note": S(b, "r1939_date"),
                 "cents": cents(S(b, "r1939")), "href": "https://example.com/invoices/supplies-2"},
            ],
            "subtotal": {"label": "3 invoices", "cents": cents(S(b, "expenses"))},
        },
        "settlement": None,
        "attention": [
            f"The stay of {S(b, 'running_stay')} was still running at close and is counted here.",
            f"Your own stay, {S(b, 'owner_stay')}, is held on the calendar with no revenue and no fee.",
            f"Rented duvet covers were billed because the house's own were short: {S(b, 'r1924')} and {S(b, 'r1939')}.",
        ],
        "stats": {"stays": n(S(b, "stays")), "nights": n(S(b, "nights")), "occupancyPct": pct(S(b, "occ")),
                  "last": {"monthLabel": S(b, "last_month"), "stays": n(S(b, "stays_last")),
                           "nights": n(S(b, "nights_last")), "occupancyPct": pct(S(b, "occ_last"))}},
        "sources": [
            {"label": "Reservations export, October 2026 (pulled November 1)", "file": "reservations-2026-10.csv", "href": None},
            {"label": "Airbnb transaction record, October 2026", "file": None, "href": None},
            {"label": "Booking.com payout, October 13", "file": None, "href": None},
            {"label": "Vendor invoices B-1 to B-3", "file": None, "href": None},
        ],
        "email": {
            "subject": "100 Pine Street | October 2026 owner statement",
            "summary": [
                {"label": "Revenue", "month": cents(S(b, "revenue")), "last": cents(S(b, "revenue_last"))},
                {"label": "Cleaning, fee, expenses", "month": cents(S(b, "costs")), "last": cents(S(b, "costs_last"))},
                {"label": "Sent to you", "month": cents(S(b, "paid")), "last": cents(S(b, "paid_last"))},
                {"label": "Occupancy", "pct": pct(S(b, "occ")), "lastPct": pct(S(b, "occ_last"))},
            ],
            "button": "Open the October statement", "password": "sample",
        },
        "links": {"page": "https://example.com/client/sample/report/october-2026",
                  "pdf": "https://example.com/client/sample/report/october-2026/pdf"},
        "calls": CALL,
    }


# --------------------------------------------------------------------------- Palisade
def palisade():
    b = "ps"
    rows = []
    for i, code in enumerate(STAY_ORDER[b]):
        s = ENT[("stay", f"{b}-{code}")]
        rows.append({
            "ref": f"A-{i + 1}",
            "cells": {"dates": s["dates"], "nights": n(s["nights"]), "payout": cents(s["payout"]),
                      "fee": cents(s["fee"])},
            "detail": [
                {"label": f"Paid to us by Airbnb, {s['payout_date']}", "cents": cents(s["payout"])},
                {"label": "Cleaning payout, passed to the cleaner", "cents": cents(s["cleaning"])},
                {"label": f"Our fee, {S(b, 'fee_rate')} of room revenue", "cents": -cents(s["fee"]), "strong": True},
                {"label": "Room revenue", "cents": cents(s["revenue"])},
            ],
        })
    return {
        "schema": "owner-statement/1", "brand": "palisade", "business": S(b, "brand"),
        "month": "2026-10", "monthLabel": S(b, "month"), "monthShort": S(b, "month").split()[0],
        "status": "final",
        "owner": {"key": "sample-owner", "name": "Sam Sample", "greeting": "Sam"},
        "property": {"label": "200 Oak Street", "line": "200 Oak Street, Springfield, NJ"},
        "prepared": {"by": S(b, "preparer"), "date": "2026-11-01"},
        "moves": {"direction": "none", "cents": 0,
                  "headline": f"Between us, {S(b, 'month')}",
                  "line": "nothing moves; our fee came out of the co-host payout",
                  "method": None, "date": None, "dateUnknown": None,
                  "sentence": (f"Nothing moves between us for October: our {S(b, 'fee_rate')} fee, {S(b, 'fee')}, "
                               "came out of Airbnb's co-host payout.")},
        "summary": {
            "title": "Statement summary",
            "columns": {"month": "October", "ytd": "Year to date"},
            "ytd": YTD_OFF,
            "rows": [
                row("Money in: Airbnb co-host payout to us", "in", cents(S(b, "collected"))),
                row("Costs: cleaning payout, passed to the cleaner", "cost", cents(S(b, "cleaning"))),
                row(f"Fees: our management fee, {S(b, 'fee_rate')}", "fee", cents(S(b, "fee_neg"))),
                row("The money that moves: nothing", "moves", 0),
            ],
            "foot": [["in", "cost", "fee"], "moves"],
        },
        "groups": [{
            "title": "Every stay, by property", "property": f"200 Oak Street: {S(b, 'stays')} stays, {S(b, 'nights')} nights",
            "columns": money_cols(("dates", "Dates", "text"), ("nights", "Nights", "int"),
                                  ("payout", "Paid to us", "money"), ("fee", "Our fee", "money")),
            "rows": rows,
            "subtotal": {"label": "Subtotal, 200 Oak Street",
                         "cells": {"nights": n(S(b, "nights")), "payout": cents(S(b, "collected")),
                                   "fee": cents(S(b, "fee"))}},
            "note": (f"Cleaning payout on every stay, shown once: {S(b, 'stays')} at "
                     f"{ENT[('stay', 'ps-' + STAY_ORDER[b][0])]['cleaning']}, {S(b, 'cleaning')} in all."),
        }],
        "costs": {
            "title": "Costs and invoices",
            "rows": [
                {"ref": "B-1", "label": f"Cleaner, invoice {S(b, 'rosa_inv')}", "payee": "Cleaner",
                 "number": S(b, "rosa_inv"), "date": "2026-11-01",
                 "note": f"{S(b, 'rosa_turns')} turnovers, paid {S(b, 'rosa_date')}. {S(b, 'covered')} covered by us.",
                 "cents": cents(S(b, "rosa_pos")), "href": "https://example.com/invoices/cleaner-5"},
                {"ref": "B-2", "label": "Supply restock, invoice 1", "payee": "Supplier", "number": "1",
                 "date": "2026-10-05", "note": f"{S(b, 'inv1_what')}. {S(b, 'inv1_paid')}",
                 "cents": cents(S(b, "inv1_amt")), "href": "https://example.com/invoices/restock-1"},
                {"ref": "B-3", "label": "Furnishings and supplies, invoice 0", "payee": "Supplier", "number": "0",
                 "date": "2026-10-07", "note": f"{S(b, 'inv0_what')}. {S(b, 'inv0_paid')}",
                 "cents": cents(S(b, "inv0_amt")), "href": None},
            ],
        },
        "settlement": None,
        "attention": [
            (f"The {S(b, 'vrbo')} is not on this statement. Vrbo is holding payment, and a refund of up to "
             f"{S(b, 'vrbo_refund')} is still to be settled."),
            (f"The cleaner's invoice {S(b, 'rosa_inv')}, {S(b, 'rosa_pos')} for {S(b, 'rosa_turns')} turnovers, was paid "
             f"on {S(b, 'rosa_date')}. The {S(b, 'covered')} above the cleaning payouts is ours, not billed to you."),
        ],
        "stats": {"stays": n(S(b, "stays")), "nights": n(S(b, "nights")), "occupancyPct": pct(S(b, "occ")),
                  "last": {"monthLabel": S(b, "last_month"), "stays": n(S(b, "stays_last")),
                           "nights": n(S(b, "nights_last")), "occupancyPct": pct(S(b, "occ_last"))}},
        "sources": [
            {"label": "Airbnb co-host payout notices, October 2026", "file": None, "href": None},
            {"label": "Airbnb transaction history, October 2026", "file": None, "href": None},
            {"label": "Vendor invoices B-1 to B-3", "file": None, "href": None},
        ],
        "email": {
            "subject": "200 Oak Street | October 2026 owner statement",
            "summary": [
                {"label": "Revenue", "month": cents(S(b, "revenue")), "last": cents(S(b, "revenue_last"))},
                {"label": "Our fee", "month": cents(S(b, "fee")), "last": cents(S(b, "fee_last"))},
                {"label": "Your net", "month": cents(S(b, "owner_net")), "last": cents(S(b, "owner_net_last"))},
                {"label": "Occupancy", "pct": pct(S(b, "occ")), "lastPct": pct(S(b, "occ_last"))},
            ],
            "button": "Open the October statement", "password": "sample",
        },
        "links": {"page": "https://example.com/clients/sample/october-2026",
                  "pdf": "https://example.com/clients/sample/october-2026/pdf"},
        "calls": CALL,
    }


# --------------------------------------------------------------------------- Columbus
def columbus():
    b = "ch"
    suites = [e for e in CAT["entities"] if e["kind"] == "suite"]
    groups, ref = [], 0
    for bld, ttl in (("52", "52 Cottage Street"), ("89", "89 Cottage Street")):
        bd = ENT[("building", f"ch-{bld}")]
        rows = []
        for e in suites:
            f = {k: v["value"] for k, v in e["facts"].items()}
            if not f["unit"].startswith(bld + "-"):
                continue
            if n(f["stays"]) == 0 and cents(f["net"]) == 0:
                continue  # a zero row is dropped by the writer (ruling 2026-10-02)
            ref += 1
            rows.append({"ref": f"A-{ref}",
                         "cells": {"suite": f"{f['unit']} {f['name']}", "stays": n(f["stays"]),
                                   "nights": n(f["nights"]), "net": cents(f["net"])}})
        groups.append({
            "title": "Every suite, by building", "property": f"{ttl}: {len(rows)} suites with stays",
            "columns": money_cols(("suite", "Suite", "text"), ("stays", "Stays", "int"),
                                  ("nights", "Nights", "int"), ("net", "Host payout", "money")),
            "rows": rows,
            "subtotal": {"label": f"Subtotal, {ttl}",
                         "cells": {"stays": n(bd["stays"]), "nights": n(bd["nights"]), "net": cents(bd["net"])}},
            "note": (f"Turnovers are {S(b, 'turn_rate')} a stay, and {S(b, 'turn_rate_406')} in 52-406, "
                     "shown once." if bld == "52" else None),
        })
    groups[1].pop("note")
    groups[0]["note"] = (f"Turnovers are {S(b, 'turn_rate')} a stay, and {S(b, 'turn_rate_406')} in 52-406, "
                         "set out once on the summary.")
    total = cents(S(b, "total"))
    return {
        "schema": "owner-statement/1", "brand": "columbus", "business": S(b, "brand"),
        "month": "2026-10", "monthLabel": S(b, "month"), "monthShort": S(b, "month").split()[0],
        "status": "final",
        "owner": {"key": "sample-owner", "name": "Pat Sample", "greeting": "Pat"},
        "property": {"label": S(b, "property"), "line": S(b, "address")},
        "prepared": {"by": S(b, "preparer"), "date": "2026-11-03"},
        "moves": {"direction": "from_owner", "cents": cents(S(b, "paid")),
                  "headline": f"Your management fee, {S(b, 'month')}",
                  "line": f"from you, by {S(b, 'method')}", "method": S(b, "method"), "date": None,
                  "dateUnknown": "due date not set yet",
                  "sentence": (f"Your October total is {S(b, 'total')}, and our management fee is {S(b, 'fee')} "
                               "by check, due date not set yet.")},
        "summary": {
            "title": "Statement summary",
            "columns": {"month": "October", "ytd": "Year to date"},
            "ytd": YTD_OFF,
            "rows": [
                row("Money in: host payout, all channels", "in", cents(S(b, "host"))),
                row("Set aside for you: hotel tax", "set_aside", cents(S(b, "tax"))),
                row("Set aside: stayed, not collected", "set_aside", cents(S(b, "uncollected"))),
                row("Costs: turnovers", "cost", cents(S(b, "turnovers"))),
                row(f"Fees: management, {S(b, 'fee_rate')}", "fee", cents(S(b, "fee_neg"))),
                row("Hotel tax returned to you", "in", cents(S(b, "tax_pos"))),
                row("Your October total, tax returned", "subtotal", total),
                row("The money that moves: your fee check to us", "moves", -cents(S(b, "paid"))),
            ],
            "foot": [["in", "cost", "fee", "set_aside"], "subtotal"],
        },
        "groups": groups,
        "costs": None,
        "settlement": None,
        "attention": [
            (f"89-204, Oct 3 to 7: {S(b, 'owed')} was paid to us directly. We send it to you on its own, "
             "apart from your fee check."),
            f"52-301: a {S(b, 'judy')} Expedia charge is held, pending a refund decision.",
        ],
        "stats": {"stays": n(S(b, "stays")), "nights": n(S(b, "nights")), "occupancyPct": pct(S(b, "occ")),
                  "last": {"monthLabel": S(b, "last_month"), "stays": n(S(b, "stays_last")),
                           "nights": n(S(b, "nights_last")), "occupancyPct": pct(S(b, "occ_last"))}},
        "sources": [
            {"label": "Reservation pull, November 1 with November 3 corrections", "file": None, "href": None},
            {"label": "Expedia reservations, 52 Cottage Street", "file": None, "href": None},
            {"label": "Expedia reservations, 89 Cottage Street", "file": None, "href": None},
            {"label": "Airbnb transaction history, October", "file": None, "href": None},
            {"label": "Booking.com payout statements, 52 Cottage Street", "file": None, "href": None},
        ],
        "email": {
            "subject": "The Columbus Hotel | October 2026 owner statement",
            "summary": [
                {"label": "Host payout", "month": cents(S(b, "host")), "last": cents(S(b, "host_last"))},
                {"label": "Management fee", "month": cents(S(b, "fee")), "last": None},
                {"label": "Your total", "month": total, "last": None},
                {"label": "Occupancy", "pct": pct(S(b, "occ")), "lastPct": pct(S(b, "occ_last"))},
            ],
            "button": "Open the October statement", "password": "sample",
        },
        "links": {"page": "https://example.com/owner/october-2026",
                  "pdf": "https://example.com/owner/october-2026/pdf"},
        "calls": CALL,
    }


# --------------------------------------------------------------------------- Xenia (Roam North)
def xenia():
    b = "rns"
    units = [e for e in CAT["entities"] if e["kind"] == "unit"]
    rows, tot = [], {"stays": 0, "nights": 0, "payout": 0, "net": 0}
    for i, e in enumerate(units):
        f = {k: v["value"] for k, v in e["facts"].items()}
        rows.append({
            "ref": f"A-{i + 1}",
            "cells": {"unit": f"{f['unit']}, {f['size']}", "stays": n(f["stays"]), "nights": n(f["nights"]),
                      "payout": cents(f["payout"]), "net": cents(f["net"])},
            "detail": [
                {"label": "Payouts, Airbnb and Vrbo", "cents": cents(f["payout"])},
                {"label": "Cleaning, flat rate per stay", "cents": cents(f["cleaning"])},
                {"label": "Net after costs", "cents": cents(f["net"]), "strong": True},
            ],
        })
    owed = cents(S(b, "open"))
    return {
        "schema": "owner-statement/1", "brand": "xenia", "business": S(b, "sender"),
        "month": "2026-10", "monthLabel": S(b, "month"), "monthShort": S(b, "month").split()[0],
        "status": "final",
        "owner": {"key": "sample-owner", "name": "Morgan Example", "greeting": "Morgan"},
        "property": {"label": S(b, "property"), "line": f"{S(b, 'brand')}, {S(b, 'property')}"},
        "prepared": {"by": S(b, "preparer"), "date": "2026-11-11"},
        "moves": {"direction": "to_partner", "cents": owed,
                  "headline": "Owed to Riley at the close of October 2026",
                  "line": "from you to Riley, for October", "method": None, "date": None,
                  "dateUnknown": "due date not set yet",
                  "sentence": f"You owe Riley {S(b, 'owed')} for October, half of your {S(b, 'net')} net, due on a date not set yet."},
        "summary": {
            "title": "Statement summary",
            "columns": {"month": "October", "ytd": "Since Sept 28"},
            "ytd": {"known": True, "reason": None, "from": "2026-09-28"},
            "rows": [
                row("Opening position, owed to Riley on October 1", "balance", -cents(S(b, "opening")), -cents(S(b, "ytd_opening"))),
                row("Money in: payouts, Airbnb and Vrbo", "in", cents(S(b, "payout")), cents(S(b, "ytd_payout"))),
                row("Costs: cleaning, flat rate per stay", "cost", cents(S(b, "cleaning")), cents(S(b, "ytd_cleaning"))),
                row("Net after costs", "subtotal", cents(S(b, "net")), cents(S(b, "ytd_net"))),
                row("Riley's share, 50% of net", "share", cents(S(b, "owed_neg")), cents(S(b, "ytd_owed_neg"))),
                row("Closing position, owed to Riley", "moves", -owed, cents(S(b, "ytd_owed_neg"))),
            ],
            "foot": [[["in", "cost"], "subtotal"], [["balance", "share"], "moves"]],
        },
        "groups": [{
            "title": "Every stay, by property",
            "property": f"{S(b, 'property')}: {S(b, 'units')} apartments, {S(b, 'stays')} stays",
            "columns": money_cols(("unit", "Apartment", "text"), ("stays", "Stays", "int"),
                                  ("nights", "Nights", "int"), ("payout", "Payouts", "money"),
                                  ("net", "Net", "money")),
            "rows": rows,
            "subtotal": {"label": f"{S(b, 'units')} apartments",
                         "cells": {"stays": n(S(b, "stays")), "nights": n(S(b, "nights")),
                                   "payout": cents(S(b, "payout")), "net": cents(S(b, "net"))}},
            "note": f"Cleaning on every stay at one flat rate, shown once: {S(b, 'clean_rate')}.",
        }],
        "costs": None,
        "settlement": {
            "title": "Settlement with Riley",
            "rows": [
                {"ref": "C-1", "label": "Owed at the close of September", "cents": cents(S(b, "opening")), "role": None},
                {"ref": "C-2", "label": "Riley's share of October, 50% of net", "cents": cents(S(b, "owed")), "role": None},
                {"ref": "C-3", "label": "Paid so far", "cents": cents(S(b, "paid_so_far")), "role": None},
                {"ref": "C-4", "label": "Owed at the close of October", "cents": owed, "role": "balance"},
            ],
        },
        "attention": [
            f"Open to Riley: {S(b, 'open')}, with {S(b, 'paid_so_far')} paid so far.",
            f"Your {S(b, 'vrbo_n')} Vrbo stays ({S(b, 'vrbo_total')}) come from your own Vrbo payout report.",
        ],
        "stats": {"stays": n(S(b, "stays")), "nights": n(S(b, "nights")), "occupancyPct": pct(S(b, "occ")),
                  "last": {"monthLabel": S(b, "last_month"), "stays": n(S(b, "stays_last")),
                           "nights": n(S(b, "nights_last")), "occupancyPct": pct(S(b, "occ_last"))}},
        "sources": [
            {"label": "Reservations export, pulled November 11", "file": None, "href": None},
            {"label": "Vrbo payout report, exported November 11", "file": None, "href": None},
            {"label": "Cleaning record, flat rate per stay", "file": None, "href": None},
        ],
        "email": {
            "subject": f"{S(b, 'property')} | October 2026 owner statement",
            "summary": [
                {"label": "Payouts", "month": cents(S(b, "payout")), "last": cents(S(b, "payout_last"))},
                {"label": "Cleaning", "month": cents(S(b, "cleaning")), "last": cents(S(b, "cleaning_last"))},
                {"label": "Net", "month": cents(S(b, "net")), "last": cents(S(b, "net_last"))},
                {"label": "Occupancy", "pct": pct(S(b, "occ")), "lastPct": pct(S(b, "occ_last"))},
            ],
            "button": "Open the October statement", "password": "sample",
        },
        "links": {"page": "https://example.com/clients/sample/october-2026",
                  "pdf": "https://example.com/clients/sample/october-2026/pdf"},
        "calls": CALL,
    }


if __name__ == "__main__":
    for name, fn in (("sun-mountain", sun_mountain), ("palisade", palisade), ("columbus", columbus),
                     ("xenia", xenia)):
        m = fn()
        (OUT / f"{name}.json").write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
        print("wrote", name)
