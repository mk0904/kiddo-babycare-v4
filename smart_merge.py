import sys

def smart_merge(file_path, output_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    output_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<<'):
            side_a = []
            i += 1
            while i < len(lines) and not lines[i].startswith('======='):
                side_a.append(lines[i])
                i += 1
            
            side_b = []
            i += 1 # skip =======
            while i < len(lines) and not lines[i].startswith('>>>>>>>'):
                side_b.append(lines[i])
                i += 1
            i += 1 # skip >>>>>>>
            
            joined_a = "".join(side_a).strip()
            joined_b = "".join(side_b).strip()
            
            if joined_a and joined_b:
                content_a = "".join(side_a)
                if not content_a.strip().endswith(',') and not content_a.strip().endswith('{') and not content_a.strip().endswith('['):
                     for j in range(len(side_a)-1, -1, -1):
                         if side_a[j].strip():
                             side_a[j] = side_a[j].rstrip() + ",\n"
                             break
                output_lines.extend(side_a)
                output_lines.extend(side_b)
            elif joined_a:
                output_lines.extend(side_a)
            elif joined_b:
                output_lines.extend(side_b)
        else:
            output_lines.append(line)
            i += 1
            
    with open(output_path, 'w') as f:
        f.writelines(output_lines)

if __name__ == "__main__":
    smart_merge(sys.argv[1], sys.argv[2])
