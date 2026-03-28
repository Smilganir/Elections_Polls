from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4"
KEY_FILE = r"C:\Users\smilg\Downloads\oct-7th-foreign-nationals-224b6b0eacf0.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Old/new aliases -> canonical fields
MAPPING = {
    'Eisenkot launches "Yashar!" party': (
        "Yashar Launched",
        "2025-09-16",
        "Domestic Politics",
        'Gadi Eisenkot launches "Yashar!" as a new political party ahead of 2026 elections.',
    ),
    "Yashar Launched": (
        "Yashar Launched",
        "2025-09-16",
        "Domestic Politics",
        'Gadi Eisenkot launches "Yashar!" as a new political party ahead of 2026 elections.',
    ),
    "Netanyahu announces Phase 2 talks with Trump": (
        "Iran War Begins",
        "2026-02-28",
        "Geopolitical War",
        "Start of the current Iran-Israel war period after major regional escalation.",
    ),
    "Iran War Begins": (
        "Iran War Begins",
        "2026-02-28",
        "Geopolitical War",
        "Start of the current Iran-Israel war period after major regional escalation.",
    ),
    'Bennett registers "Bennett 2026" party': (
        "Bennett 2026",
        "2025-12-24",
        "Domestic Politics",
        'Naftali Bennett registers "Bennett 2026", signaling a formal political comeback.',
    ),
    "Bennett 2026": (
        "Bennett 2026",
        "2025-12-24",
        "Domestic Politics",
        'Naftali Bennett registers "Bennett 2026", signaling a formal political comeback.',
    ),
    "Iran retaliatory strikes on Israel begin": (
        "Iran Retaliates",
        "2026-02-28",
        "Geopolitical War",
        "Iran begins retaliatory missile and drone strikes against Israel after regional escalation.",
    ),
    "Iran Retaliates": (
        "Iran Retaliates",
        "2026-02-28",
        "Geopolitical War",
        "Iran begins retaliatory missile and drone strikes against Israel after regional escalation.",
    ),
}


def update_major(vals):
    changed = 0
    for i in range(1, len(vals)):
        row = vals[i]
        if len(row) >= 2 and row[0] in MAPPING:
            new_name, new_date, new_category, new_details = MAPPING[row[0]]
            if row[0] != new_name:
                row[0] = new_name
                changed += 1
            row[1] = new_date
            if len(row) < 5:
                row.extend([""] * (5 - len(row)))
            row[2] = new_category
            row[3] = new_details
    return changed


def update_events(vals):
    changed = 0
    for i in range(1, len(vals)):
        row = vals[i]
        if len(row) >= 2 and row[1] in MAPPING:
            new_name, new_date, _, _ = MAPPING[row[1]]
            if row[1] != new_name:
                row[1] = new_name
                changed += 1
            row[0] = new_date
    return changed


def main():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    svc = build("sheets", "v4", credentials=creds)

    major_range = "Major Events Dim!A:E"
    events_range = "Events Dates per Media Outlet!A:D"

    major_vals = (
        svc.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=major_range)
        .execute()
        .get("values", [])
    )
    events_vals = (
        svc.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=events_range)
        .execute()
        .get("values", [])
    )

    major_changed = update_major(major_vals)
    events_changed = update_events(events_vals)

    svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=major_range,
        valueInputOption="USER_ENTERED",
        body={"values": major_vals},
    ).execute()

    svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=events_range,
        valueInputOption="USER_ENTERED",
        body={"values": events_vals},
    ).execute()

    print(f"Updated Major Events rows: {major_changed}")
    print(f"Updated Events Dates rows: {events_changed}")


if __name__ == "__main__":
    main()
