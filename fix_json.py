import json

def fix_json(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Try multiple common syntax fixes if there is an error
    while True:
        try:
            json.loads(content)
            break
        except json.decoder.JSONDecodeError as e:
            err_msg = str(e)
            idx = int(err_msg.split('char ')[1].split(')')[0])
            print("Error at char:", idx, e)
            
            # Simple heuristic fixes
            if "Expecting ',' delimiter:" in err_msg:
                # Might be a missing comma, let's look at the char before
                content = content[:idx] + ',' + content[idx:]
            elif "Expecting value: line" in err_msg:
                # Might be an extra comma
                if content[idx] == ']':
                    # Need to remove trailing comma inside array
                    last_comma = content.rfind(',', 0, idx)
                    content = content[:last_comma] + content[last_comma+1:]
                elif content[idx] == '}':
                    # Need to remove trailing comma inside object
                    last_comma = content.rfind(',', 0, idx)
                    content = content[:last_comma] + content[last_comma+1:]
                else:
                    print("Unknown case:", repr(content[idx-5:idx+5]))
                    break
            elif "Extra data: line" in err_msg:
                print("Extra data found.")
                break
            else:
                 # Check if it complains about expecting property name enclosed in double quotes
                 line, col = int(e.lineno), int(e.colno)
                 err_lines = content.split('\n')
                 print("Error around:", err_lines[line-2:line+1])
                 # Example: },\n],\n"discounts"
                 # It's better simply to use regex or string replace for known syntax errors:
                 if '},\n],\n"discounts": {' in content:
                     content = content.replace('},\n],\n"discounts": {', '}\n],\n"discounts": {')
                     print('Replaced },\n],\n"discounts": {')
                     continue
                 if '}\n],\n"discounts": {' in content:
                     content = content.replace('}\n],\n"discounts": {', '}\n],\n"discounts": {')
                     continue
                 break

    with open(file_path, 'w') as f:
        f.write(content)
    
    print("Verification:")
    try:
        json.loads(content)
        print("Success")
    except Exception as e:
        print("Still failing:", e)

fix_json('config/kiddoAppConfig_fixed.json')
