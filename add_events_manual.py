"""
Add selected major events to two Google Sheets tabs:
1) Major Events Dim
2) Events Dates per Media Outlet

This script is intentionally separate from run_polls.py and runs only when called directly.
"""
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4"
KEY_FILE = r"C:\Users\smilg\Downloads\oct-7th-foreign-nationals-224b6b0eacf0.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

MAJOR_EVENTS_SHEET = "Major Events Dim"
EVENTS_DATES_SHEET = "Events Dates per Media Outlet"

# The four events requested by user.
EVENTS_TO_ADD = [
    {
        "Event Name": 'Eisenkot launches "Yashar!" party',
        "Event Date": "2025-09-16",
        "Category": "Domestic Politics",
        "Details": 'Gadi Eisenkot launches "Yashar!" as a new political party ahead of 2026 elections.',
    },
    {
        "Event Name": "Netanyahu announces Phase 2 talks with Trump",
        "Event Date": "2025-12-07",
        "Category": "Gaza War",
        "Details": "Netanyahu says Phase 2 Gaza plan talks with Trump are close and key issues remain.",
    },
    {
        "Event Name": 'Bennett registers "Bennett 2026" party',
        "Event Date": "2025-12-24",
        "Category": "Domestic Politics",
        "Details": 'Naftali Bennett registers "Bennett 2026", signaling a formal political comeback.',
    },
    {
        "Event Name": "Iran retaliatory strikes on Israel begin",
        "Event Date": "2026-02-28",
        "Category": "Geopolitical War",
        "Details": "Iran begins retaliatory missile and drone strikes against Israel after regional escalation.",
    },
]


def get_service():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def get_values(service, sheet_range):
    return (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=sheet_range)
        .execute()
        .get("values", [])
    )


def append_values(service, sheet_name, rows):
    if not rows:
        return 0
    result = (
        service.spreadsheets()
        .values()
        .append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A1",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": rows},
        )
        .execute()
    )
    return int(result.get("updates", {}).get("updatedRows", 0))


def main():
    service = get_service()

    # Read current sheet data once (for idempotent behavior).
    major_existing = get_values(service, f"{MAJOR_EVENTS_SHEET}!A:E")
    events_dates_existing = get_values(service, f"{EVENTS_DATES_SHEET}!A:D")

    major_data = major_existing[1:] if len(major_existing) > 1 else []
    events_dates_data = events_dates_existing[1:] if len(events_dates_existing) > 1 else []

    # Build fast lookup sets.
    major_keys = {
        (row[0], row[1], row[4])
        for row in major_data
        if len(row) >= 5
    }
    events_dates_keys = {
        (row[0], row[1], row[2], row[3])
        for row in events_dates_data
        if len(row) >= 4
    }

    # Use existing outlets in the Events Dates sheet, but keep Hebrew outlet names only.
    # This intentionally excludes "i24 news" and other ASCII-only values.
    hebrew_outlets = sorted(
        {
            row[2]
            for row in events_dates_data
            if len(row) >= 3 and row[2] and (not row[2].isascii())
        }
    )

    major_rows_to_add = []
    events_dates_rows_to_add = []

    for event in EVENTS_TO_ADD:
        event_name = event["Event Name"]
        event_date = event["Event Date"]
        category = event["Category"]
        details = event["Details"]

        # Add Start/End rows in Major Events Dim (matching current table structure).
        for line in ("Start", "End"):
            key = (event_name, event_date, line)
            if key not in major_keys:
                major_rows_to_add.append([event_name, event_date, category, details, line])
                major_keys.add(key)

        # Add rows for every Hebrew media outlet with Party fixed to Likud.
        for outlet in hebrew_outlets:
            key = (event_date, event_name, outlet, "Likud")
            if key not in events_dates_keys:
                events_dates_rows_to_add.append([event_date, event_name, outlet, "Likud"])
                events_dates_keys.add(key)

    added_major = append_values(service, MAJOR_EVENTS_SHEET, major_rows_to_add)
    added_events_dates = append_values(service, EVENTS_DATES_SHEET, events_dates_rows_to_add)

    print(f"Hebrew outlets used: {len(hebrew_outlets)}")
    print(f"Added rows in '{MAJOR_EVENTS_SHEET}': {added_major}")
    print(f"Added rows in '{EVENTS_DATES_SHEET}': {added_events_dates}")
    print("Done.")


if __name__ == "__main__":
    main()
