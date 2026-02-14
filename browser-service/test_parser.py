"""Quick test for the flight parser's resilience to malformed LLM output."""
import json
import sys
sys.path.insert(0, '/app' if __name__ == '__main__' else '.')
from main import _try_parse_flight_json, _fix_malformed_json, _try_parse_raw_text_flights, _parse_raw_text_to_flight

# Test 1: Wrong field names
test1 = """[
  {"airline_name": "Aer Lingus", "departure_time": "6:25 pm", "arrival_time": "9:05 am+1", "total_duration": "9h 40m", "number_of_stops": 1, "price": 522, "currency_code": "USD", "booking_link_url": null}
]"""
r1 = _try_parse_flight_json(test1)
print(f"Test 1 (wrong field names): {len(r1) if r1 else 0} results")
if r1:
    print(f"  airline={r1[0].airline}, duration={r1[0].duration}, stops={r1[0].stops}")

# Test 2: Truncated
test2 = """[
  {"airline": "Aer Lingus", "departure_time": "6:25 pm", "arrival_time": "9:05 am+1", "duration": "9h 40m", "stops": 1, "price": 522, "currency": "USD"},
  { ... (remaining flights as previously listed) ... }
]"""
r2 = _try_parse_flight_json(test2)
print(f"Test 2 (truncated): {len(r2) if r2 else 0} results")

# Test 3: Malformed JSON (real data from logs)
test3 = """[
  {"airline":"Aer Lingus","departure_time":"4:55 pm","arrival_time":"9:05 am+1","duration":"11h 10m","stops":1,"price":526,"currency":"USD","flight_url":null},
  {"airline" :"British Airways ", "departure_time" :"10:10 am", "arrival_time" :"1:00 pm", "duration" :"7h50m", "stops" :0 , "price" :559 , "currency" :"USD", "flight_url" :null },
  {"airline:"Finnair ",   "departure_time:"7:20pm ",   "arrival_time:"7:20am +1 ",   "duration:"7h00m ",   "stops:"0 ,   "price:"559 ,   "currency:"USD ",   "flight_url:"null }
]"""
r3 = _try_parse_flight_json(test3)
print(f"Test 3 (malformed JSON): {len(r3) if r3 else 0} results")
if r3:
    for f in r3:
        print(f"  {f.airline}: {f.departure_time} → {f.arrival_time}, ${f.price}")

# Test 4: Wrapped in long text
test4 = """I have completed the extraction of all visible flight results.

Here is the complete JSON array of extracted flights:

[
  {"airline_name": "Aer Lingus", "departure_time": "6:25 pm", "arrival_time": "9:05 am+1", "total_duration": "9h 40m", "number_of_stops": 1, "price": 522, "currency_code": "USD", "booking_link_url": null},
  {"airline_name": "Air Canada", "departure_time": "9:00 am", "arrival_time": "6:30 am+1", "total_duration": "16h 30m", "number_of_stops": 1, "price": 511, "currency_code": "USD", "booking_link_url": null}
]

If you need further details, please let me know."""
r4 = _try_parse_flight_json(test4)
print(f"Test 4 (text-wrapped): {len(r4) if r4 else 0} results")

# Test 5: Raw text from JavaScript evaluate (pipe-delimited)
test5 = """[
  {"raw_text": "6:25 PM | 9:05 AM+1 | 9h 40m | 1 stop | FRA | Aer Lingus | $522"},
  {"raw_text": "10:10 AM | 1:00 PM | 7h 50m | nonstop | British Airways | $559"},
  {"raw_text": "7:20 PM | 7:20 AM+1 | 7h 00m | nonstop | Finnair | $559"}
]"""
r5 = _try_parse_raw_text_flights(test5)
print(f"Test 5 (raw_text JS output): {len(r5) if r5 else 0} results")
if r5:
    for f in r5:
        print(f"  {f.airline}: {f.departure_time} → {f.arrival_time}, {f.duration}, {f.stops} stops, ${f.price}")

# Test 6: Single raw_text parse
test6 = "6:25 PM | 9:05 AM+1 | 9h 40m | 1 stop | FRA | Aer Lingus | $522"
r6 = _parse_raw_text_to_flight(test6)
print(f"Test 6 (single raw_text): {'OK' if r6 else 'FAIL'}")
if r6:
    print(f"  {r6.airline}: {r6.departure_time} → {r6.arrival_time}, {r6.duration}, {r6.stops} stops, ${r6.price}")

# Test 7: Structured output from output_model_schema
test7 = """{"flights": [{"airline": "Aer Lingus", "departure_time": "6:25 PM", "arrival_time": "9:05 AM+1", "duration": "9h 40m", "stops": 1, "price": 522, "currency": "USD", "flight_url": null}], "total_count": 1, "search_completed": true, "error_message": null}"""
r7 = _try_parse_flight_json(test7)
print(f"Test 7 (structured output): {len(r7) if r7 else 0} results")

# Test 8: Plain text flight info (no JSON, no pipes)
test8 = """Aer Lingus
6:25 PM – 9:05 AM+1
9h 40m
1 stop FRA
$522

British Airways
10:10 AM – 1:00 PM
7h 50m
Nonstop
$559"""
r8 = _try_parse_raw_text_flights(test8)
print(f"Test 8 (plain text flights): {len(r8) if r8 else 0} results")
if r8:
    for f in r8:
        print(f"  {f.airline}: {f.departure_time} → {f.arrival_time}, ${f.price}")

print("\nAll tests done!")

# Test 9: Kayak .nrc6-wrapper card format (from real DOM extraction 2025)
test9_raw = "Save | Share | 6:25 pm – 9:05 am+1 | Aer Lingus | 1 stop | SNN | 1h 30m layover, Shannon | 9h 40m | JFK | - | LHR | 9:50 am – 4:55 pm | Aer Lingus | 1 stop | SNN | 3h 10m layover, Shannon | 12h 05m | LHR | - | JFK | 1 | 0 | $530 | Saver | Select"
r9 = _parse_raw_text_to_flight(test9_raw)
print(f"\nTest 9 (Kayak .nrc6-wrapper card): {'OK' if r9 else 'FAIL'}")
if r9:
    print(f"  airline={r9.airline}")
    print(f"  departure_time={r9.departure_time}")
    print(f"  arrival_time={r9.arrival_time}")
    print(f"  duration={r9.duration}")
    print(f"  stops={r9.stops}")
    print(f"  price=${r9.price}")
    assert r9.airline == "Aer Lingus", f"Expected 'Aer Lingus', got '{r9.airline}'"
    assert r9.price == 530.0, f"Expected 530.0, got {r9.price}"
    assert r9.stops == 1, f"Expected 1, got {r9.stops}"
    assert "9h 40m" in r9.duration or "9h" in r9.duration, f"Expected ~9h 40m, got {r9.duration}"
    print("  ✓ All assertions passed!")
else:
    print("  ✗ Parse returned None!")

# Test 10: Kayak card as JSON array of raw_text (as returned by evaluate JS)
test10 = json.dumps([
    {"raw_text": "Save | Share | 6:25 pm – 9:05 am+1 | Aer Lingus | 1 stop | SNN | 1h 30m layover, Shannon | 9h 40m | JFK | - | LHR | 9:50 am – 4:55 pm | Aer Lingus | 1 stop | SNN | 3h 10m layover, Shannon | 12h 05m | LHR | - | JFK | 1 | 0 | $530 | Saver | Select"},
    {"raw_text": "Save | Share | 11:55 pm – 3:00 pm+1 | Aer Lingus | 1 stop | DUB | 1h 50m layover, Dublin | 10h 05m | JFK | - | LHR | 9:50 am – 4:55 pm | Aer Lingus | 1 stop | SNN | 3h 10m layover, Shannon | 12h 05m | LHR | - | JFK | 1 | 0 | $534 | Saver | Select"},
    {"raw_text": "Save | Share | 10:10 am – 10:40 pm | British Airways | nonstop | 7h 30m | JFK | - | LHR | 11:00 am – 5:30 pm | British Airways | nonstop | 8h 30m | LHR | - | JFK | 1 | 0 | $559 | Economy | Select"},
])
r10 = _try_parse_raw_text_flights(test10)
print(f"\nTest 10 (Kayak JSON array): {len(r10) if r10 else 0} results")
if r10:
    for f in r10:
        print(f"  {f.airline}: {f.departure_time} → {f.arrival_time}, {f.duration}, {f.stops} stops, ${f.price}")
    assert len(r10) == 3, f"Expected 3 results, got {len(r10)}"
    assert r10[0].airline == "Aer Lingus"
    assert r10[2].airline == "British Airways"
    print("  ✓ All assertions passed!")

