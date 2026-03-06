import sys
f = open('tests/fixtures/generate.ts', 'r', encoding='utf-8')
c = f.read()
f.close()

# Change 1
c = c.replace(
    '// Ensure output directory exists\nmkdirSync(OUT_DIR, { recursive: true })',
    "// Ensure output directories exist\nmkdirSync(OUT_DIR, { recursive: true })\nmkdirSync(join(OUT_DIR, 'stress_test'), { recursive: true })"
)

print('Change 1 done:', 'stress_test' in c)
f = open('tests/fixtures/generate.ts', 'w', encoding='utf-8', newline='\n')
f.write(c)
f.close()