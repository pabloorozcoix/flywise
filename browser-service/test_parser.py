"""Quick test for the flight parser's resilience to malformed LLM output."""
import sys
sys.path.insert(0, '/app' if __name__ == '__main__' else '.')
from main import _try_parse_flight_json, _fix_malformed_json

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

print("\nAll tests done!")
