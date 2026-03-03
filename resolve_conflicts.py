import sys
import re

def resolve_ours(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # regex to find conflict markers
    # We want to match:
    # <<<<<<< HEAD
    # (side A)
    # =======
    # (side B)
    # >>>>>>> (branch)
    
    # Pattern explanation:
    # <<<<<<< HEAD\n
    # (.*?) - group 1: side A
    # \n=======\n
    # (.*?) - side B (ignored)
    # \n>>>>>>> .*?\n
    
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> .*?\n', re.DOTALL)
    
    new_content = pattern.sub(r'\1\n', content)
    
    # Multiple passes in case of nested conflicts (though rare in Git)
    # but also because the markers might not have a newline at the end of the file or something.
    
    with open(file_path, 'w') as f:
        f.write(new_content)

if __name__ == "__main__":
    resolve_ours(sys.argv[1])
