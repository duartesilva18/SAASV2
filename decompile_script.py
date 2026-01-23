import dis
import marshal
import sys

def disassemble_pyc(pyc_path):
    with open(pyc_path, 'rb') as f:
        # Skip the 16-byte header in Python 3.7+
        f.read(16)
        try:
            code_obj = marshal.load(f)
            dis.dis(code_obj)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Set stdout to utf-8
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        disassemble_pyc(sys.argv[1])
